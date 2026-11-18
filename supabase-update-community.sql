-- =====================================================================
--  퀸장그루터기 온라인 교회 · 추가 설정 (2026-11 · 함께하는 기능 모음)
--   1) 사이트 설정 (설교 본문 · 계절 테마 · 밤 모드)
--   2) 📅 모임 시간표
--   3) 📚 통독 기록 (서버 저장) + 함께 통독 챌린지
--   4) 🌳 감사 나무 (기도 응답 나눔)
--   5) ⛹️ 운동장 점수 (이번 주 랭킹)
--   6) 🔔 알림 구독 (홈 화면 앱 푸시)
--
--  ★ supabase-setup.sql(처음 설정)을 이미 실행한 프로젝트에서,
--    이 파일 내용을 SQL Editor에 붙여넣고 Run 하면 돼요.
--    여러 번 실행해도 괜찮아요. 다른 데이터는 그대로 있어요.
--    admin_check() 함수(처음 설정에 있음)를 써요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 사이트 설정: 관리자만 바꾸고, 누구나 읽어요
--    sermon = {"title","book"(1~66),"chap","verses","date"} / theme = "auto" 등 / night = "auto" | "day" | "night"
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key check (key in ('sermon', 'theme', 'night')),
  value      jsonb not null default 'null',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);

create or replace function public.admin_set_setting(p_pw text, p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_key not in ('sermon', 'theme', 'night') then raise exception '잘못된 요청이에요'; end if;
  if length(coalesce(p_value::text, '')) > 2000 then raise exception '내용이 너무 길어요'; end if;
  insert into site_settings (key, value, updated_at) values (p_key, coalesce(p_value, 'null'::jsonb), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end; $$;
revoke all on function public.admin_set_setting(text, text, jsonb) from public;
grant execute on function public.admin_set_setting(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) 📅 모임 시간표
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id         bigserial primary key,
  title      text        not null check (char_length(title) between 1 and 60),
  place      text        not null default 'yard',          -- yard | worship | cafe | vision | room301 | praise | court | 그 밖의 장소 글자
  memo       text        not null default '',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events (starts_at);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to anon, authenticated using (ends_at > now() - interval '1 day');

create or replace function public.admin_add_event(p_pw text, p_title text, p_place text, p_memo text, p_starts timestamptz, p_ends timestamptz)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception '모임 이름을 적어주세요'; end if;
  if p_starts is null then raise exception '시작 시간을 골라주세요'; end if;
  insert into events (title, place, memo, starts_at, ends_at)
    values (left(trim(p_title), 60), left(coalesce(nullif(trim(p_place), ''), 'yard'), 30), left(coalesce(trim(p_memo), ''), 120),
            p_starts, greatest(coalesce(p_ends, p_starts + interval '2 hours'), p_starts + interval '10 minutes'))
    returning id into v_id;
  delete from events where ends_at < now() - interval '30 days';
  return v_id;
end; $$;
create or replace function public.admin_delete_event(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from events where id = p_id;
end; $$;
revoke all on function public.admin_add_event(text, text, text, text, timestamptz, timestamptz) from public;
revoke all on function public.admin_delete_event(text, bigint) from public;
grant execute on function public.admin_add_event(text, text, text, text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.admin_delete_event(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) 📚 통독 기록 + 함께 통독 챌린지
--    read_at: 이 기능 전에 기기에 있던 기록은 옛날 날짜(2000-01-01)로 올라가서 챌린지에는 안 들어가요
-- ---------------------------------------------------------------------
create table if not exists public.reading_progress (
  token   text        not null,
  name    text        not null default '',
  book    smallint    not null check (book between 1 and 66),
  chap    smallint    not null check (chap between 1 and 150),
  read_at timestamptz not null default now(),
  primary key (token, book, chap)
);
create index if not exists reading_progress_read_idx on public.reading_progress (read_at);
alter table public.reading_progress enable row level security;
revoke all on public.reading_progress from anon, authenticated;

create or replace function public.reading_mark(p_token text, p_name text, p_book int, p_chap int, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_book not between 1 and 66 or p_chap not between 1 and 150 then raise exception '잘못된 요청이에요'; end if;
  if p_on then
    insert into reading_progress (token, name, book, chap) values (p_token, left(coalesce(trim(p_name), ''), 12), p_book, p_chap)
      on conflict (token, book, chap) do update set name = excluded.name;
  else
    delete from reading_progress where token = p_token and book = p_book and chap = p_chap;
  end if;
  update reading_progress set name = left(coalesce(trim(p_name), ''), 12) where token = p_token and name <> left(coalesce(trim(p_name), ''), 12);
end; $$;
-- 기기에 있던 통독표를 한 번에 올리기: p_items = [[책(1~66), 장], ...]
create or replace function public.reading_sync(p_token text, p_name text, p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; it jsonb;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 1300 then raise exception '잘못된 요청이에요'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>0)::int between 1 and 66 and (it->>1)::int between 1 and 150 then
      insert into reading_progress (token, name, book, chap, read_at)
        values (p_token, left(coalesce(trim(p_name), ''), 12), (it->>0)::int, (it->>1)::int, '2000-01-01')
        on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  return n;
end; $$;
revoke all on function public.reading_mark(text, text, int, int, boolean) from public;
revoke all on function public.reading_sync(text, text, jsonb) from public;
grant execute on function public.reading_mark(text, text, int, int, boolean) to anon, authenticated;
grant execute on function public.reading_sync(text, text, jsonb) to anon, authenticated;

create table if not exists public.reading_challenges (
  id         bigserial primary key,
  title      text        not null check (char_length(title) between 1 and 60),
  books      smallint[]  not null,
  starts     date        not null,
  ends       date        not null,
  created_at timestamptz not null default now()
);
alter table public.reading_challenges enable row level security;
revoke all on public.reading_challenges from anon, authenticated;
grant select on public.reading_challenges to anon, authenticated;
drop policy if exists reading_challenges_read on public.reading_challenges;
create policy reading_challenges_read on public.reading_challenges for select to anon, authenticated using (true);

create or replace function public.admin_add_challenge(p_pw text, p_title text, p_books int[], p_starts date, p_ends date)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v smallint[];
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  select coalesce(array_agg(distinct b order by b), '{}') into v from unnest(coalesce(p_books, '{}')) as b where b between 1 and 66;
  if array_length(v, 1) is null then raise exception '읽을 책을 골라주세요'; end if;
  if p_starts is null or p_ends is null or p_ends < p_starts then raise exception '날짜를 확인해 주세요'; end if;
  insert into reading_challenges (title, books, starts, ends) values (left(trim(p_title), 60), v, p_starts, p_ends) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.admin_delete_challenge(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from reading_challenges where id = p_id;
end; $$;
revoke all on function public.admin_add_challenge(text, text, int[], date, date) from public;
revoke all on function public.admin_delete_challenge(text, bigint) from public;
grant execute on function public.admin_add_challenge(text, text, int[], date, date) to anon, authenticated;
grant execute on function public.admin_delete_challenge(text, bigint) to anon, authenticated;

-- 챌린지 현황: 기간 안에 그 책들을 읽은 장 수 (뉴욕 날짜 기준)
create or replace function public.challenge_board(p_id bigint, p_token text default null)
returns table (name text, n bigint, me boolean)
language sql security definer set search_path = public stable as $$
  with c as (select * from reading_challenges where id = p_id),
  r as (
    select p.token, max(p.name) as name, count(*)::bigint as n
    from reading_progress p, c
    where p.book = any (c.books)
      and p.read_at >= (c.starts::timestamp at time zone 'America/New_York')
      and p.read_at < ((c.ends + 1)::timestamp at time zone 'America/New_York')
    group by p.token
  )
  select coalesce(nullif(r.name, ''), '익명'), r.n, (r.token = p_token) from r order by r.n desc, r.name limit 100;
$$;
revoke all on function public.challenge_board(bigint, text) from public;
grant execute on function public.challenge_board(bigint, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) 🌳 감사 나무 (기도 응답 나눔)
-- ---------------------------------------------------------------------
create table if not exists public.testimonies (
  id           bigserial primary key,
  token        text        not null,
  name         text        not null default '',
  content      text        not null check (char_length(content) between 1 and 200),
  amen_count   int         not null default 0,
  report_count int         not null default 0,
  hidden       boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists testimonies_created_idx on public.testimonies (created_at desc);
create table if not exists public.testimony_marks (
  token text   not null,
  tid   bigint not null references public.testimonies(id) on delete cascade,
  kind  text   not null check (kind in ('amen', 'report')),
  primary key (token, tid, kind)
);
alter table public.testimonies enable row level security;
alter table public.testimony_marks enable row level security;
revoke all on public.testimonies from anon, authenticated;
revoke all on public.testimony_marks from anon, authenticated;
grant select (id, name, content, amen_count, created_at) on public.testimonies to anon, authenticated;
drop policy if exists testimonies_read on public.testimonies;
create policy testimonies_read on public.testimonies for select to anon, authenticated using (not hidden);

create or replace function public.add_testimony(p_token text, p_name text, p_content text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_recent int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_content is null or length(trim(p_content)) = 0 then raise exception '내용을 적어주세요'; end if;
  select count(*) into v_recent from testimonies where token = p_token and created_at > now() - interval '10 minutes';
  if v_recent >= 3 then raise exception '조금 있다가 다시 남겨 주세요 🙂'; end if;
  insert into testimonies (token, name, content) values (p_token, left(coalesce(trim(p_name), ''), 12), left(trim(p_content), 200)) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.amen_testimony(p_id bigint, p_token text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_token is null or length(p_token) < 8 then raise exception '잘못된 요청이에요'; end if;
  insert into testimony_marks (token, tid, kind) values (p_token, p_id, 'amen') on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update testimonies set amen_count = amen_count + 1 where id = p_id; end if;
  select amen_count into n from testimonies where id = p_id;
  return coalesce(n, 0);
end; $$;
create or replace function public.report_testimony(p_id bigint, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_token is null or length(p_token) < 8 then raise exception '잘못된 요청이에요'; end if;
  insert into testimony_marks (token, tid, kind) values (p_token, p_id, 'report') on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update testimonies set report_count = report_count + 1, hidden = (report_count + 1 >= 3) where id = p_id; end if;
end; $$;
create or replace function public.delete_my_testimony(p_id bigint, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin delete from testimonies where id = p_id and token = p_token; end; $$;
create or replace function public.admin_delete_testimony(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from testimonies where id = p_id;
end; $$;
revoke all on function public.add_testimony(text, text, text) from public;
revoke all on function public.amen_testimony(bigint, text) from public;
revoke all on function public.report_testimony(bigint, text) from public;
revoke all on function public.delete_my_testimony(bigint, text) from public;
revoke all on function public.admin_delete_testimony(text, bigint) from public;
grant execute on function public.add_testimony(text, text, text) to anon, authenticated;
grant execute on function public.amen_testimony(bigint, text) to anon, authenticated;
grant execute on function public.report_testimony(bigint, text) to anon, authenticated;
grant execute on function public.delete_my_testimony(bigint, text) to anon, authenticated;
grant execute on function public.admin_delete_testimony(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) ⛹️ 운동장 점수: 농구 골(2·3점), 테니스·배드민턴 득점(1점), 판 승리(3점)
-- ---------------------------------------------------------------------
create table if not exists public.sport_points (
  id         bigserial primary key,
  token      text        not null,
  name       text        not null default '',
  kind       text        not null check (kind in ('bb', 'tn', 'bm')),
  points     smallint    not null check (points between 1 and 3),
  created_at timestamptz not null default now()
);
create index if not exists sport_points_created_idx on public.sport_points (created_at desc);
create index if not exists sport_points_token_idx on public.sport_points (token, created_at desc);
alter table public.sport_points enable row level security;
revoke all on public.sport_points from anon, authenticated;

create or replace function public.sport_add(p_token text, p_name text, p_kind text, p_points int)
returns void language plpgsql security definer set search_path = public as $$
declare v_recent int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('bb', 'tn', 'bm') or p_points not between 1 and 3 then raise exception '잘못된 요청이에요'; end if;
  select count(*) into v_recent from sport_points where token = p_token and created_at > now() - interval '10 minutes';
  if v_recent >= 60 then return; end if; -- 너무 많으면 조용히 무시
  insert into sport_points (token, name, kind, points) values (p_token, left(coalesce(trim(p_name), ''), 12), p_kind, p_points);
  if random() < 0.01 then delete from sport_points where created_at < now() - interval '120 days'; end if;
end; $$;
revoke all on function public.sport_add(text, text, text, int) from public;
grant execute on function public.sport_add(text, text, text, int) to anon, authenticated;

create or replace function public.sport_ranking(p_period text, p_token text default null)
returns table (rank bigint, name text, points bigint, bb bigint, rk bigint, me boolean)
language sql security definer set search_path = public stable as $$
  with since as (
    select case when p_period = 'week'
      then (date_trunc('week', now() at time zone 'America/New_York')) at time zone 'America/New_York'
      else '-infinity'::timestamptz end as t
  ), agg as (
    select s.token, sum(s.points)::bigint as points,
           coalesce(sum(s.points) filter (where s.kind = 'bb'), 0)::bigint as bb,
           coalesce(sum(s.points) filter (where s.kind <> 'bb'), 0)::bigint as rk,
           max(s.created_at) as last_at, (array_agg(s.name order by s.created_at desc))[1] as name
    from sport_points s, since where s.created_at >= since.t group by s.token
  ), ranked as (
    select rank() over (order by points desc, last_at asc) as rank, coalesce(nullif(name, ''), '익명') as name, points, bb, rk, (token = p_token) as me from agg
  )
  select rank, name, points, bb, rk, me from ranked where rank <= 10 or me order by rank, name limit 11;
$$;
revoke all on function public.sport_ranking(text, text) from public;
grant execute on function public.sport_ranking(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) 🔔 알림 구독 (홈 화면 앱 푸시). 실제로 보내는 건 Edge Function 'notify'가 해요
-- ---------------------------------------------------------------------
create table if not exists public.push_subs (
  endpoint    text primary key,
  token       text        not null,
  name        text        not null default '',
  sub         jsonb       not null,
  wants_visit boolean     not null default true,
  wants_event boolean     not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.push_log (
  id    bigserial primary key,
  kind  text        not null,
  token text,
  at    timestamptz not null default now()
);
alter table public.push_subs enable row level security;
alter table public.push_log enable row level security;
revoke all on public.push_subs from anon, authenticated;
revoke all on public.push_log from anon, authenticated;

create or replace function public.push_subscribe(p_token text, p_name text, p_sub jsonb, p_visit boolean, p_event boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_sub is null or coalesce(p_sub->>'endpoint', '') !~ '^https://' or length(p_sub::text) > 2000 then raise exception '잘못된 요청이에요'; end if;
  insert into push_subs (endpoint, token, name, sub, wants_visit, wants_event)
    values (p_sub->>'endpoint', p_token, left(coalesce(trim(p_name), ''), 12), p_sub, coalesce(p_visit, true), coalesce(p_event, true))
    on conflict (endpoint) do update set token = excluded.token, name = excluded.name, sub = excluded.sub,
      wants_visit = excluded.wants_visit, wants_event = excluded.wants_event;
end; $$;
create or replace function public.push_unsubscribe(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin delete from push_subs where endpoint = p_endpoint; end; $$;
revoke all on function public.push_subscribe(text, text, jsonb, boolean, boolean) from public;
revoke all on function public.push_unsubscribe(text) from public;
grant execute on function public.push_subscribe(text, text, jsonb, boolean, boolean) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

-- '누가 왔어요' 알림을 너무 자주 보내지 않게: 전체 15분에 한 번, 같은 사람은 3시간에 한 번 (Edge Function만 불러요)
create or replace function public.push_visit_gate(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from push_log where kind = 'visit' and at > now() - interval '15 minutes') then return false; end if;
  if exists (select 1 from push_log where kind = 'visit' and token = p_token and at > now() - interval '3 hours') then return false; end if;
  insert into push_log (kind, token) values ('visit', p_token);
  delete from push_log where at < now() - interval '3 days';
  return true;
end; $$;
revoke all on function public.push_visit_gate(text) from public, anon, authenticated;
grant execute on function public.push_visit_gate(text) to service_role;

-- 바뀐 함수 목록을 Supabase(API)가 바로 다시 읽어 오게 해요
notify pgrst, 'reload schema';
