-- =====================================================================
--  🧍 푸드 트럭 손님(NPC) · 2026-11-13
--  가상 손님이 영업시간(뉴욕 시간 오전 7시 ~ 밤 10시)에 몇 분마다 와서 하나씩 사 가요.
--  트럭에 남은 게 없으면 줄을 서요(최대 8명, 더 오면 그냥 돌아가요).
--  누가 만들면 줄 선 손님에게 바로 팔려서 줄이 줄어요.
--  계산은 서버에서 해서 모두가 같은 숫자를 봐요. (여러 번 실행해도 안전)
--  ※ supabase-update-footprints.sql(푸드 트럭 숫자)을 먼저 실행해 둔 상태여야 해요.
-- =====================================================================
alter table public.food_counters add column if not exists npc_sold int not null default 0;          -- 손님에게 판 개수 (누적)
alter table public.food_counters add column if not exists queue    int not null default 0;          -- 지금 줄 선 손님 수
alter table public.food_counters add column if not exists npc_at   timestamptz not null default now(); -- 어디까지 계산했는지

-- 손님 흐름 계산 (안에서만 써요): 마지막 계산 시각부터 지금까지 1분씩 진행
create or replace function public.food_sim(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; m timestamptz; m_end timestamptz; hr int; rate int; arrive int; stock int; sold int := 0; q int;
begin
  select * into r from food_counters where kind = p_kind for update;
  if not found then return; end if;
  m_end := date_trunc('minute', now());
  m := greatest(date_trunc('minute', r.npc_at), m_end - interval '2 days');
  if m >= m_end then return; end if;
  q := r.queue;
  stock := greatest(0, r.made - r.taken - r.npc_sold);
  while m < m_end loop
    m := m + interval '1 minute';
    hr := extract(hour from (m at time zone 'America/New_York'))::int;
    if hr < 7 or hr >= 22 then
      q := 0; -- 문 닫으면 다들 집에 가요
    else
      -- 1분에 손님이 올 확률 (천분율): 붕어빵이 조금 더 잘 팔려요, 점심·저녁엔 더 많이
      rate := case when p_kind = 'tako' then 120 else 180 end;
      if hr in (12, 13, 18, 19) then rate := rate * 16 / 10;
      elsif hr < 9 or hr >= 21 then rate := rate * 6 / 10; end if;
      arrive := case when abs(hashtext(p_kind || ':' || extract(epoch from m)::bigint::text)) % 1000 < rate then 1 else 0 end;
      q := least(8, q + arrive);
      if stock > 0 and q > 0 then
        arrive := least(stock, q); stock := stock - arrive; q := q - arrive; sold := sold + arrive;
      end if;
    end if;
  end loop;
  update food_counters set npc_sold = npc_sold + sold, queue = q, npc_at = m_end where kind = p_kind;
end; $$;

-- 지금 상태 (누구나 불러요). 10초 안에 이미 계산했으면 그냥 읽기만 해요
create or replace function public.food_tick()
returns table (kind text, made int, taken int, npc_sold int, queue int)
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from food_counters c where c.npc_at < now() - interval '10 seconds') then
    perform food_sim('tako'); perform food_sim('bungeo');
  end if;
  return query select c.kind, c.made, c.taken, c.npc_sold, c.queue from food_counters c;
end; $$;

-- 만들기: 먼저 손님 흐름을 계산하고 → 만든 만큼 줄 선 손님에게 바로 팔아요
create or replace function public.food_make(p_token text, p_kind text, p_n int)
returns int language plpgsql security definer set search_path = public as $$
declare v_recent int; v_made int; v_serve int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('tako', 'bungeo') or p_n is null or p_n < 1 or p_n > 9 then raise exception '잘못된 요청이에요'; end if;
  select count(*) into v_recent from food_events where token = p_token and at > now() - interval '1 minute';
  if v_recent >= 15 then raise exception '조금만 쉬었다가 다시 만들어 주세요 🙂'; end if;
  insert into food_events (token) values (p_token);
  perform food_sim(p_kind);
  update food_counters set made = made + p_n where kind = p_kind returning made into v_made;
  update food_counters c set npc_sold = c.npc_sold + least(c.queue, greatest(0, c.made - c.taken - c.npc_sold)),
         queue = c.queue - least(c.queue, greatest(0, c.made - c.taken - c.npc_sold))
   where c.kind = p_kind;
  if random() < 0.02 then delete from food_events where at < now() - interval '1 day'; end if;
  return v_made;
end; $$;

-- 하나 받기 (친구들 몫): 손님에게 판 것까지 빼고 남은 게 있을 때만
create or replace function public.food_take(p_token text, p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare v_recent int; v_left int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('tako', 'bungeo') then raise exception '잘못된 요청이에요'; end if;
  select count(*) into v_recent from food_events where token = p_token and at > now() - interval '1 minute';
  if v_recent >= 15 then raise exception '조금만 쉬었다가 다시 받아 주세요 🙂'; end if;
  insert into food_events (token) values (p_token);
  perform food_sim(p_kind);
  update food_counters set taken = taken + 1 where kind = p_kind and made > taken + npc_sold returning made - taken - npc_sold into v_left;
  return coalesce(v_left, -1);
end; $$;

revoke all on function public.food_sim(text) from public, anon, authenticated;
revoke all on function public.food_tick() from public;
revoke all on function public.food_make(text, text, int) from public;
revoke all on function public.food_take(text, text) from public;
grant execute on function public.food_tick() to anon, authenticated;
grant execute on function public.food_make(text, text, int) to anon, authenticated;
grant execute on function public.food_take(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
