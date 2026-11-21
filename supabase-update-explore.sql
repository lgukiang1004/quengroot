-- =====================================================================
--  퀸장그루터기 · 2026-11-20 '탐험 라운드' 추가분 (supabase-update-round3.sql 다음에 실행)
--  여러 번 실행해도 안전해요. admin_check() 함수(처음 설정)를 사용해요.
--   ① 🎶 매주 자동 청음회 (토요일 밤 10:30, 그 주 최신 추천 찬양 5곡) + 시간 설정 + 30분 전 알림 확인
--   ② 🎵 추천 찬양 곡 길이(초) 저장 — 자동 청음회에 쓰려고
--   ③ 🍡 고양이 특식 조각 (푸드 트럭·쇼룸 ⭐3) · 🗺 탐험 도장판 기록 → 미션 기록(mission_add)이 받는 종류를 늘려요
--   ④ 🗺 탐험 장터(점수로 사기) · 오늘의 장터 물건(팻말 말씀·청음회 응원·돗자리 색) · 🏅 100일 탐험가 명판 · 관리자 장소별 방문 수
-- =====================================================================

-- ---------------------------------------------------------------------
-- ② 🎵 추천 찬양 곡 길이
-- ---------------------------------------------------------------------
alter table public.song_recs add column if not exists secs int;
grant select (secs) on public.song_recs to anon, authenticated;
-- 곡 길이는 아직 비어 있을 때만 한 번 채울 수 있어요 (화면이 유튜브에서 알아낸 길이)
create or replace function public.rec_set_secs(p_id bigint, p_secs int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secs is null or p_secs < 20 or p_secs > 1200 then return; end if;
  update song_recs set secs = p_secs where id = p_id and coalesce(secs, 0) = 0 and link <> '';
end; $$;
revoke all on function public.rec_set_secs(bigint, int) from public;
grant execute on function public.rec_set_secs(bigint, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ① 🎶 매주 자동 청음회
-- ---------------------------------------------------------------------
alter table public.listen_events add column if not exists auto_day date;      -- 자동 청음회 날짜(뉴욕), 같은 날 한 번만
alter table public.listen_events add column if not exists notified boolean not null default false; -- 30분 전 알림 보냈는지
create unique index if not exists listen_events_auto_idx on public.listen_events (auto_day) where auto_day is not null;

create table if not exists public.listen_auto (
  id   int primary key default 1 check (id = 1),
  on_  boolean not null default true,
  dow  int     not null default 6 check (dow between 0 and 6),   -- 0 일 … 6 토
  hh   int     not null default 22 check (hh between 0 and 23),
  mm   int     not null default 30 check (mm between 0 and 59),
  n    int     not null default 5 check (n between 1 and 10)      -- 몇 곡
);
insert into public.listen_auto (id) values (1) on conflict do nothing;
alter table public.listen_auto enable row level security;
revoke all on public.listen_auto from anon, authenticated;

create or replace function public.listen_auto_get()
returns table (on_ boolean, dow int, hh int, mm int, n int)
language sql security definer set search_path = public stable as $$ select on_, dow, hh, mm, n from listen_auto where id = 1; $$;

create or replace function public.admin_listen_auto_set(p_pw text, p_on boolean, p_dow int, p_hh int, p_mm int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_dow not between 0 and 6 or p_hh not between 0 and 23 or p_mm not between 0 and 59 then raise exception '시간이 이상해요'; end if;
  update listen_auto set on_ = coalesce(p_on, true), dow = p_dow, hh = p_hh, mm = p_mm where id = 1;
  -- 아직 시작 안 한 오늘 자동 청음회는 지워서, 새 시간으로 다시 만들어지게 해요
  delete from listen_events where auto_day is not null and starts_at > now();
end; $$;

-- 화면이 들어올 때마다 불러요. 그날(뉴욕)이 청음회 요일이면, 아직 없을 때만 한 번 만들어요.
-- 곡: 지난 한 주 동안 올라온 추천 찬양 중 유튜브 링크·길이가 있는 최신 n곡 (모자라면 그 전 최신 곡으로 채움), 전체 45분까지
create or replace function public.listen_auto_ensure()
returns bigint language plpgsql security definer set search_path = public as $$
declare a listen_auto; v_ny timestamp := now() at time zone 'America/New_York'; v_day date; v_start timestamptz;
        v_songs jsonb := '[]'::jsonb; v_sec int := 0; r record; v_id bigint; v_cnt int := 0;
begin
  select * into a from listen_auto where id = 1;
  if a is null or not a.on_ then return null; end if;
  if extract(dow from v_ny)::int <> a.dow then return null; end if;
  v_day := v_ny::date;
  if exists (select 1 from listen_events where auto_day = v_day) then return null; end if;
  v_start := (v_day + make_time(a.hh, a.mm, 0)) at time zone 'America/New_York';
  if v_start < now() - interval '20 minutes' then return null; end if;   -- 이미 지난 시간이면 이번 주는 건너뛰어요
  for r in (select id, title, artist, link, secs, (created_at > v_start - interval '7 days') as fresh from song_recs
             where not hidden and link <> '' and coalesce(secs, 0) between 20 and 1200
             order by (created_at > v_start - interval '7 days') desc, created_at desc limit 20) loop
    exit when v_cnt >= a.n;
    if v_sec + r.secs > 45 * 60 then continue; end if;
    v_songs := v_songs || jsonb_build_array(jsonb_build_object('v', right(r.link, 11), 't', left(r.title || case when r.artist <> '' then ' · ' || r.artist else '' end, 60), 's', r.secs));
    v_sec := v_sec + r.secs; v_cnt := v_cnt + 1;
  end loop;
  if v_cnt = 0 then return null; end if;
  begin
    insert into listen_events (token, host, title, descr, starts_at, ends_at, songs, auto_day)
      values ('auto-weekly', '그루터기', '이번 주 추천 찬양 청음회', '이번 주 찬양팀 방에 올라온 최신 추천 찬양을 함께 들어요 🎶', v_start, v_start + make_interval(secs => v_sec), v_songs, v_day)
      returning id into v_id;
  exception when unique_violation then return null; end;
  return v_id;
end; $$;

-- 청음회 목록에 '자동' 표시를 더해요 (돌려주는 칸이 바뀌어서 지우고 다시 만들어요)
drop function if exists public.listen_list(text);
create or replace function public.listen_list(p_token text default '')
returns table (id bigint, host text, title text, descr text, starts_at timestamptz, ends_at timestamptz, songs jsonb, mine boolean, auto boolean)
language sql security definer set search_path = public stable as $$
  select e.id, e.host, e.title, e.descr, e.starts_at, e.ends_at, e.songs, e.token = coalesce(p_token, ''), e.auto_day is not null
    from listen_events e where e.ends_at > now() - interval '10 minutes' order by e.starts_at limit 30;
$$;

drop function if exists public.listen_notify_gate();
-- 🔔 30분 전 알림: 알림 함수(notify)가 부르면, 25~40분 뒤에 시작하는 아직 안 알린 청음회 하나를 돌려주고 '알렸음'으로 바꿔요
create or replace function public.listen_notify_gate()
returns table (eid bigint, etitle text, estart timestamptz, n int)
language plpgsql security definer set search_path = public as $$
declare e listen_events;
begin
  select * into e from listen_events x where not x.notified and x.starts_at between now() + interval '15 minutes' and now() + interval '40 minutes' order by x.starts_at limit 1 for update skip locked;
  if e.id is null then return; end if;
  update listen_events x set notified = true where x.id = e.id;
  return query select e.id, e.title, e.starts_at, jsonb_array_length(e.songs);
end; $$;

revoke all on function public.listen_auto_get() from public;
revoke all on function public.admin_listen_auto_set(text, boolean, int, int, int) from public;
revoke all on function public.listen_auto_ensure() from public;
revoke all on function public.listen_list(text) from public;
revoke all on function public.listen_notify_gate() from public;
grant execute on function public.listen_auto_get() to anon, authenticated;
grant execute on function public.admin_listen_auto_set(text, boolean, int, int, int) to anon, authenticated;
grant execute on function public.listen_auto_ensure() to anon, authenticated;
grant execute on function public.listen_list(text) to anon, authenticated;
grant execute on function public.listen_notify_gate() to service_role;   -- 알림 함수만 불러요


-- ---------------------------------------------------------------------
-- ③ 미션 기록 종류 늘리기 (round3 내용 + 새 종류)
--    truck(푸드 트럭 만들기) · frag:새우/연어/닭(⭐3 조각, 모두 합쳐 하루 2개) · xfrag:(탐험 상자 조각, 하루 1개)
--    ex:장소(오늘 도장) · exdone(오늘 코스 완주) · exgem(숨은 보물) · exwith(동행 도장) · exbox(탐험 상자) · exdeco:꾸미기 · exflavor:맛
-- ---------------------------------------------------------------------
create or replace function public.mission_add(p_token text, p_name text, p_kind text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'America/New_York')::date;
  cap int; cur_n int; cur_at timestamptz; kinds int; tr int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind is null or p_kind !~ '^(visit|pray|give|catfeed|quiz|jam|cookie|stamp|resolve|walk|walkq|campfire|marsh|catpet|note|plan|rest|reclike|recplay|cheer|prank|dance|skate|listen|study|party|habit|bball|truck|exdone|exgem|exwith|exbox|ex:[a-z0-9]{2,12}|exdeco:[a-z0-9_]{2,16}|exflavor:[a-z]{2,12}|frag:(salmon|chicken|shrimp)|xfrag:(salmon|catnip|yarn|chicken|shrimp)|read:[0-9]{1,2}:[0-9]{1,3}|season:[a-z]{2,12}:[0-9]{4}|gift:[a-z]{2,16}|treat:(salmon|catnip|yarn|chicken|shrimp))$' then
    raise exception '잘못된 요청이에요';
  end if;
  cap := case
    when p_kind in ('visit', 'stamp', 'resolve', 'jam', 'walk', 'walkq', 'campfire', 'plan', 'rest', 'skate', 'listen', 'study', 'party', 'habit', 'dance', 'exdone', 'exgem', 'exwith', 'exbox')
      or p_kind like 'read:%' or p_kind like 'season:%' or p_kind like 'gift:%' or p_kind like 'ex:%' or p_kind like 'exdeco:%' or p_kind like 'exflavor:%' or p_kind like 'xfrag:%' then 1
    when p_kind = 'pray' then 20
    when p_kind in ('catpet', 'note', 'reclike', 'recplay', 'cheer') then 10
    when p_kind = 'prank' then 5
    when p_kind like 'treat:%' or p_kind like 'frag:%' then 2
    else 30 end;
  select count(*) into kinds from mission_log where token = p_token and day = d;
  if kinds > 300 then raise exception '오늘은 기록이 너무 많아요. 내일 다시 해 주세요'; end if;
  if p_kind like 'gift:%' then
    if exists (select 1 from mission_log where token = p_token and day = d and kind like 'gift:%') then return 1; end if;
    if not exists (select 1 from mission_log where token = p_token and day = d and kind = 'stamp') then raise exception '오늘의 미션 3개를 먼저 다 해 주세요'; end if;
  end if;
  if p_kind like 'treat:%' then
    select coalesce(sum(n), 0) into tr from mission_log where token = p_token and day = d and kind like 'treat:%';
    if tr >= 2 then return 2; end if;
  end if;
  if p_kind like 'frag:%' then   -- 특식 조각은 모두 합쳐 하루 2개
    select coalesce(sum(n), 0) into tr from mission_log where token = p_token and day = d and kind like 'frag:%';
    if tr >= 2 then return 2; end if;
  end if;
  if p_kind in ('exbox', 'exdone') or p_kind like 'xfrag:%' or p_kind like 'exdeco:%' or p_kind like 'exflavor:%' then  -- 탐험 상자는 오늘 도장 5개(ex:)를 다 찍은 뒤에만
    if (select count(*) from mission_log where token = p_token and day = d and kind like 'ex:%') < 5 then raise exception '오늘의 탐험 코스를 먼저 다 돌아 주세요'; end if;
    if p_kind <> 'exdone' and p_kind <> 'exbox' and exists (select 1 from mission_log where token = p_token and day = d and (kind like 'xfrag:%' or kind like 'exdeco:%' or kind like 'exflavor:%')) then return 1; end if;
  end if;
  select n, at into cur_n, cur_at from mission_log where token = p_token and day = d and kind = p_kind;
  if found then
    if cur_n >= cap then return cur_n; end if;
    if cur_at > now() - interval '5 seconds' and p_kind not like 'treat:%' and p_kind not like 'frag:%' then return cur_n; end if;
    update mission_log set n = n + 1, at = now(), name = left(coalesce(trim(p_name), ''), 12),
      note = coalesce(left(nullif(trim(p_note), ''), 80), note)
      where token = p_token and day = d and kind = p_kind returning n into cur_n;
    return cur_n;
  end if;
  insert into mission_log (token, day, kind, n, name, note)
    values (p_token, d, p_kind, 1, left(coalesce(trim(p_name), ''), 12), left(nullif(trim(p_note), ''), 80));
  return 1;
end; $$;
revoke all on function public.mission_add(text, text, text, text) from public;
grant execute on function public.mission_add(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ④ 🗺 탐험 장터 · 명판 · 관리자 통계
--    점수 = 코스 완주한 날 1 + 숨은 보물 1 + 동행 도장 0.5 − 장터에서 쓴 점수
-- ---------------------------------------------------------------------
create table if not exists public.explore_shop (
  id         bigserial primary key,
  token      text        not null,
  name       text        not null default '',
  item       text        not null check (item in ('treat', 'verse', 'cheer', 'mat')),
  arg        text        not null default '',
  cost       numeric     not null,
  day        date        not null default ((now() at time zone 'America/New_York')::date),
  created_at timestamptz not null default now()
);
create index if not exists explore_shop_day_idx on public.explore_shop (day, item);
create index if not exists explore_shop_tok_idx on public.explore_shop (token);
alter table public.explore_shop enable row level security;
revoke all on public.explore_shop from anon, authenticated;

create table if not exists public.explore_hall (
  token      text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.explore_hall enable row level security;
revoke all on public.explore_hall from anon, authenticated;

create or replace function public.explore_points(p_token text)
returns numeric language sql security definer set search_path = public stable as $$
  select coalesce((select sum(case when kind in ('exdone', 'exgem') then 1 when kind = 'exwith' then 0.5 else 0 end) from mission_log where token = p_token and kind in ('exdone', 'exgem', 'exwith')), 0)
       - coalesce((select sum(cost) from explore_shop where token = p_token), 0);
$$;

create or replace function public.shop_buy(p_token text, p_name text, p_item text, p_arg text default '')
returns numeric language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/New_York')::date; v_cost numeric; v_arg text := left(coalesce(trim(p_arg), ''), 80); n int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  v_cost := case p_item when 'treat' then 3 when 'verse' then 5 when 'cheer' then 2 when 'mat' then 3 else null end;
  if v_cost is null then raise exception '없는 물건이에요'; end if;
  if p_item = 'treat' and v_arg !~ '^(salmon|catnip|yarn|chicken|shrimp)$' then raise exception '특식을 골라 주세요'; end if;
  if p_item = 'mat' and v_arg !~ '^#[0-9a-fA-F]{6}$' then raise exception '색을 골라 주세요'; end if;
  if p_item in ('verse', 'cheer') and length(v_arg) < 2 then raise exception '내용을 적어 주세요'; end if;
  if p_item = 'cheer' and length(v_arg) > 30 then v_arg := left(v_arg, 30); end if;
  select count(*) into n from explore_shop where token = p_token and day = d and item = p_item;
  if n >= (case when p_item = 'treat' then 2 else 1 end) then raise exception '이 물건은 오늘 이미 샀어요. 내일 또 와요 🙂'; end if;
  if p_item = 'mat' and exists (select 1 from explore_shop where day = d and item = 'mat') then raise exception '오늘 돗자리 색은 이미 누가 정했어요. 내일 일찍 와요 🙂'; end if;
  if public.explore_points(p_token) < v_cost then raise exception '탐험 점수가 모자라요 (필요 %점)', v_cost; end if;
  insert into explore_shop (token, name, item, arg, cost) values (p_token, left(coalesce(trim(p_name), ''), 12), p_item, v_arg, v_cost);
  return public.explore_points(p_token);
end; $$;

-- 내 점수 + 내가 산 것
drop function if exists public.shop_me(text);
create or replace function public.shop_me(p_token text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object('points', public.explore_points(p_token),
    'items', coalesce((select jsonb_agg(jsonb_build_object('item', item, 'arg', arg, 'day', day) order by created_at desc) from explore_shop where token = p_token), '[]'::jsonb));
$$;

-- 오늘 모두에게 보이는 장터 물건 (팻말 말씀 · 청음회 응원 · 돗자리 색)
create or replace function public.shop_today()
returns table (item text, name text, arg text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select item, name, arg, created_at from explore_shop
   where day = (now() at time zone 'America/New_York')::date and item in ('verse', 'cheer', 'mat')
   order by created_at desc limit 20;
$$;

-- 🏅 100일 연속 탐험가 명판 (코스 완주한 날이 100일 이어지면)
create or replace function public.hall_join(p_token text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare best int;
begin
  if p_token is null or length(p_token) < 8 then raise exception '잘못된 요청이에요'; end if;
  select coalesce(max(c), 0) into best from (
    select count(*) c from (select day, day - (row_number() over (order by day))::int g from mission_log where token = p_token and kind = 'exdone') t group by g) x;
  if best < 100 then return false; end if;
  insert into explore_hall (token, name) values (p_token, left(coalesce(nullif(trim(p_name), ''), '탐험가'), 12))
    on conflict (token) do update set name = excluded.name;
  return true;
end; $$;
create or replace function public.hall_list()
returns table (name text, created_at timestamptz)
language sql security definer set search_path = public stable as $$ select name, created_at from explore_hall order by created_at limit 60; $$;

-- 관리자: 최근 7일 장소별 방문(도장) 수
create or replace function public.admin_explore_stats(p_pw text)
returns table (place text, visits bigint, people bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  return query select substr(m.kind, 4), sum(m.n)::bigint, count(distinct m.token)::bigint from mission_log m
    where m.kind like 'ex:%' and m.day >= (now() at time zone 'America/New_York')::date - 6 group by 1 order by 2 desc;
end; $$;

revoke all on function public.explore_points(text) from public;
revoke all on function public.shop_buy(text, text, text, text) from public;
revoke all on function public.shop_me(text) from public;
revoke all on function public.shop_today() from public;
revoke all on function public.hall_join(text, text) from public;
revoke all on function public.hall_list() from public;
revoke all on function public.admin_explore_stats(text) from public;
grant execute on function public.shop_buy(text, text, text, text) to anon, authenticated;
grant execute on function public.shop_me(text) to anon, authenticated;
grant execute on function public.shop_today() to anon, authenticated;
grant execute on function public.hall_join(text, text) to anon, authenticated;
grant execute on function public.hall_list() to anon, authenticated;
grant execute on function public.admin_explore_stats(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- (선택) 🔔 아무도 접속해 있지 않아도 30분 전 알림이 가게 하려면
--   Supabase 대시보드 → Database → Extensions 에서 pg_cron, pg_net 을 켠 뒤
--   아래 주석(--)을 지우고 <프로젝트주소>, <anon 공개 키> 를 config.js 값으로 바꿔 한 번 실행하세요.
--   (안 해도 괜찮아요: 그 시간에 누군가 사이트에 들어와 있으면 그 화면이 알림을 대신 부탁해요)
-- select cron.schedule('listen-notify', '*/5 * * * *', $$
--   select net.http_post(url := 'https://<프로젝트주소>.supabase.co/functions/v1/notify',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon 공개 키>"}'::jsonb,
--     body := '{"type":"listen"}'::jsonb) $$);
-- ---------------------------------------------------------------------

notify pgrst, 'reload schema';
