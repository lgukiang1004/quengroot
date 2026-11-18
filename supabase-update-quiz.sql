-- =====================================================================
--  퀸장그루터기 온라인 교회 · 추가 설정 (성경 퀴즈: 출제 범위 + 랭킹)
--  2026-11 추가분
--
--  ★ supabase-setup.sql(처음 설정)을 이미 실행한 프로젝트에서,
--    이 파일 내용을 SQL Editor에 붙여넣고 Run 하면 돼요.
--    여러 번 실행해도 괜찮아요. 다른 데이터는 그대로 있어요.
--
--  점수: 쉬운 퀴즈 1점 · 재밌는 넌센스 1점 · 중간 2점 · 하이 3점
--        같은 문제는 처음 맞혔을 때만 점수가 들어가요 (기기마다)
--  랭킹: 이번 주(뉴욕 시간 월요일 0시부터) / 전체
-- =====================================================================

-- 1) 출제 범위 (관리자가 정함). books가 비어 있으면 66권 전체
--    (Supabase 화면에서 이 파일을 여러 번 실행해도 안전해요)
create table if not exists public.quiz_settings (
  id         int primary key default 1 check (id = 1),
  books      smallint[]  not null default '{}',
  updated_at timestamptz not null default now()
);
-- 교리·성경 일반 문제(소요리문답, 성경 66권 등)도 섞을지
alter table public.quiz_settings add column if not exists general boolean not null default true;
insert into public.quiz_settings (id) values (1) on conflict do nothing;
alter table public.quiz_settings enable row level security;
revoke all on public.quiz_settings from anon, authenticated;
grant select on public.quiz_settings to anon, authenticated;
drop policy if exists quiz_settings_read on public.quiz_settings;
create policy quiz_settings_read on public.quiz_settings for select to anon, authenticated using (true);

create or replace function public.admin_set_quiz_books(p_pw text, p_books int[], p_general boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v smallint[];
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  select coalesce(array_agg(distinct b order by b), '{}') into v
    from unnest(coalesce(p_books, '{}')) as b where b between 1 and 66;
  update quiz_settings set books = v, general = coalesce(p_general, true), updated_at = now() where id = 1;
end; $$;
revoke all on function public.admin_set_quiz_books(text, int[], boolean) from public;
grant execute on function public.admin_set_quiz_books(text, int[], boolean) to anon, authenticated;

-- 2) 맞힌 문제 기록 (기기 token + 문제 id 하나에 한 줄 → 같은 문제는 한 번만 점수)
create table if not exists public.quiz_solves (
  token      text        not null,
  qid        text        not null,
  level      text        not null check (level in ('easy', 'fun', 'mid', 'high')),
  points     smallint    not null,
  created_at timestamptz not null default now(),
  primary key (token, qid)
);
create index if not exists quiz_solves_created_idx on public.quiz_solves (created_at desc);
-- 랭킹에 보일 이름 (기기마다 마지막으로 쓴 이름)
create table if not exists public.quiz_players (
  token      text primary key,
  name       text        not null default '',
  rounds     int         not null default 0,
  updated_at timestamptz not null default now()
);
-- 화면(anon)에서는 직접 못 읽고, 아래 함수로만 써요 (token이 보이지 않게)
alter table public.quiz_solves  enable row level security;
alter table public.quiz_players enable row level security;
revoke all on public.quiz_solves  from anon, authenticated;
revoke all on public.quiz_players from anon, authenticated;

-- 3) 한 판(5문제) 제출: 맞힌 문제 id 목록을 받아서 처음 맞힌 것만 점수로 쌓아요
--    p_items 예: [{"id":"q:43:e:1a2b3c","level":"easy"}, ...]  (맞힌 것만, 최대 5개)
--    한 기기에서 6초에 한 판까지, 1시간에 맞힌 문제 200개까지
create or replace function public.quiz_submit(p_token text, p_name text, p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_last timestamptz; v_rounds int; v_gain int := 0; it jsonb; v_lv text; v_pt int; v_id text; n int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5 then raise exception '잘못된 요청이에요'; end if;
  select updated_at into v_last from quiz_players where token = p_token;
  if v_last is not null and v_last > now() - interval '6 seconds' then raise exception '조금만 천천히! 몇 초 뒤에 다시 제출해 주세요 🙂'; end if;
  select count(*) into n from quiz_solves where token = p_token and created_at > now() - interval '1 hour';
  if n >= 200 then raise exception '오늘 퀴즈 많이 풀었어요! 잠깐 쉬었다가 해요 🙂'; end if;
  insert into quiz_players (token, name, rounds, updated_at) values (p_token, left(coalesce(trim(p_name), ''), 12), 1, now())
    on conflict (token) do update set name = excluded.name, rounds = quiz_players.rounds + 1, updated_at = now();
  for it in select * from jsonb_array_elements(p_items) loop
    v_id := left(coalesce(it->>'id', ''), 80);
    v_lv := it->>'level';
    if length(v_id) < 3 or v_lv not in ('easy', 'fun', 'mid', 'high') then continue; end if;
    v_pt := case v_lv when 'high' then 3 when 'mid' then 2 else 1 end;
    insert into quiz_solves (token, qid, level, points) values (p_token, v_id, v_lv, v_pt) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then v_gain := v_gain + v_pt; end if;
  end loop;
  return v_gain;
end; $$;
revoke all on function public.quiz_submit(text, text, jsonb) from public;
grant execute on function public.quiz_submit(text, text, jsonb) to anon, authenticated;

-- 4) 랭킹: 상위 20명 + (20등 밖이면) 내 순위
--    p_period: 'week' (뉴욕 시간 이번 주 월요일 0시부터) | 'all'
create or replace function public.quiz_ranking(p_period text, p_token text default null)
returns table (rank bigint, name text, points bigint, solved bigint, me boolean)
language sql security definer set search_path = public stable as $$
  with since as (
    select case when p_period = 'week'
      then (date_trunc('week', now() at time zone 'America/New_York')) at time zone 'America/New_York'
      else '-infinity'::timestamptz end as t
  ), agg as (
    select s.token, sum(s.points)::bigint as points, count(*)::bigint as solved, max(s.created_at) as last_at
    from quiz_solves s, since where s.created_at >= since.t group by s.token
  ), ranked as (
    select rank() over (order by a.points desc, a.last_at asc) as rank,
           coalesce(nullif(p.name, ''), '익명') as name, a.points, a.solved, (a.token = p_token) as me
    from agg a left join quiz_players p on p.token = a.token
  )
  select rank, name, points, solved, me from ranked where rank <= 20 or me order by rank, name limit 21;
$$;
revoke all on function public.quiz_ranking(text, text) from public;
grant execute on function public.quiz_ranking(text, text) to anon, authenticated;

-- 5) 관리자: 랭킹 기록 모두 지우기 (새 학기 등, 필요할 때만)
create or replace function public.admin_reset_quiz(p_pw text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from quiz_solves where true;
  delete from quiz_players where true;
end; $$;
revoke all on function public.admin_reset_quiz(text) from public;
grant execute on function public.admin_reset_quiz(text) to anon, authenticated;

-- 바뀐 함수 목록을 Supabase(API)가 바로 다시 읽어 오게 해요
notify pgrst, 'reload schema';
