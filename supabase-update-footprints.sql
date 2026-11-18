-- =====================================================================
--  퀸장그루터기 온라인 교회 · 추가 설정 (발자취 / 읽은 말씀 기록 / 방명록 / 이번주 공지 / 푸드 트럭 숫자 / 고양이 밥 기록)
--  2026-11 추가분
--
--  ★ 이미 supabase-setup.sql을 한 번 실행한 프로젝트에서,
--    이 파일 내용을 SQL Editor에 붙여넣고 Run 하면 돼요.
--    기존 기도 벽 / 공동 기도제목 데이터는 그대로 있어요.
--    여러 번 실행해도 괜찮아요.
-- =====================================================================

-- 1) 발자취 테이블: 누가 언제 어느 방에 와서 무엇을 하고 갔는지
create table if not exists public.footprints (
  id          bigserial primary key,
  token       text        not null,               -- 기기 구분용 (화면에는 안 보임)
  name        text        not null default '',    -- 비어 있으면 '익명'
  room        text        not null,
  kind        text        not null check (kind in ('visit', 'pray', 'read')),
  detail      text        not null default '',    -- 예: '요한복음 15장'
  book        smallint,                           -- 1~66
  chap        smallint,
  seat        text,                               -- 기도/읽기한 자리 (3D 흔적 표시용)
  pos_x       real,
  pos_z       real,
  color       text,                               -- 캐릭터 옷 색 (대시보드 점 색)
  created_at  timestamptz not null default now()
);
-- 방 이름: 마당 / 본당 / 성경 읽는 공간 / 비전 / 301호 / 찬양팀 연습실(praise)
alter table public.footprints drop constraint if exists footprints_room_check;
alter table public.footprints add constraint footprints_room_check
  check (room in ('yard', 'worship', 'cafe', 'vision', 'room301', 'praise'));
create index if not exists footprints_created_idx on public.footprints (created_at desc);
create index if not exists footprints_token_idx   on public.footprints (token, created_at desc);

-- 2) 보안: 읽기는 최근 8일치만, token 칸은 아무도 못 읽게
alter table public.footprints enable row level security;
revoke all on public.footprints from anon, authenticated;
grant select (id, name, room, kind, detail, book, chap, seat, pos_x, pos_z, color, created_at)
  on public.footprints to anon, authenticated;

drop policy if exists footprints_read on public.footprints;
create policy footprints_read on public.footprints
  for select to anon, authenticated
  using (created_at > now() - interval '8 days');

-- 3) 발자취 남기기 (사이트에서 이 함수로만 저장돼요)
create or replace function public.add_footprint(
  p_token  text,
  p_name   text,
  p_room   text,
  p_kind   text,
  p_detail text,
  p_book   int,
  p_chap   int,
  p_seat   text,
  p_x      real,
  p_z      real,
  p_color  text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     bigint;
  v_recent int;
  v_window interval;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then
    raise exception '잘못된 요청이에요';
  end if;
  if p_room not in ('yard', 'worship', 'cafe', 'vision', 'room301', 'praise') or p_kind not in ('visit', 'pray', 'read') then
    raise exception '잘못된 요청이에요';
  end if;
  if p_kind = 'read' and (p_book is null or p_book < 1 or p_book > 66 or p_chap is null or p_chap < 1 or p_chap > 150) then
    raise exception '잘못된 성경 장이에요';
  end if;

  -- 도배 방지: 한 기기에서 1시간에 60개까지
  select count(*) into v_recent from footprints
   where token = p_token and created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception '잠시 후 다시 해주세요';
  end if;

  -- 같은 일을 짧은 시간에 반복하면 새로 쌓지 않고 시간·자리만 갱신
  v_window := case p_kind when 'read' then interval '12 hours' else interval '30 minutes' end;
  select id into v_id from footprints
   where token = p_token and room = p_room and kind = p_kind
     and (p_kind <> 'read' or (book = p_book and chap = p_chap))
     and created_at > now() - v_window
   order by created_at desc limit 1;

  if v_id is not null then
    update footprints
       set created_at = now(),
           name  = left(coalesce(trim(p_name), ''), 12),
           seat  = coalesce(left(p_seat, 12), seat),
           pos_x = coalesce(p_x, pos_x),
           pos_z = coalesce(p_z, pos_z),
           color = coalesce(left(p_color, 9), color)
     where id = v_id;
    return v_id;
  end if;

  insert into footprints (token, name, room, kind, detail, book, chap, seat, pos_x, pos_z, color)
  values (p_token, left(coalesce(trim(p_name), ''), 12), p_room, p_kind, left(coalesce(p_detail, ''), 40),
          p_book, p_chap, left(p_seat, 12), p_x, p_z, left(p_color, 9))
  returning id into v_id;

  -- 오래된 발자취(30일 지난 것)는 가끔 정리
  if random() < 0.05 then
    delete from footprints where created_at < now() - interval '30 days';
  end if;
  return v_id;
end;
$$;

-- 4) 관리자: 발자취 지우기 (이상한 이름 등)
create or replace function public.admin_delete_footprint(p_pw text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_check(p_pw) then
    raise exception '관리자 비밀번호가 틀렸어요';
  end if;
  delete from footprints where id = p_id;
end;
$$;

revoke all on function public.add_footprint(text, text, text, text, text, int, int, text, real, real, text) from public;
grant execute on function public.add_footprint(text, text, text, text, text, int, int, text, real, real, text) to anon, authenticated;
revoke all on function public.admin_delete_footprint(text, bigint) from public;
grant execute on function public.admin_delete_footprint(text, bigint) to anon, authenticated;

-- =====================================================================
--  방명록 (벽에 붙는 쪽지) — 비전 / 301호 방마다 따로
-- =====================================================================
create table if not exists public.guestbook (
  id           bigserial primary key,
  token        text        not null,
  name         text        not null default '',
  content      text        not null check (char_length(content) between 1 and 80),
  report_count int         not null default 0,
  hidden       boolean     not null default false,
  created_at   timestamptz not null default now()
);
-- 방 구분 칸 (먼저 실행했던 분도 이 줄로 추가돼요. 예전 쪽지는 301호로 남아요)
alter table public.guestbook add column if not exists room text not null default 'room301';
alter table public.guestbook drop constraint if exists guestbook_room_check;
alter table public.guestbook add constraint guestbook_room_check check (room in ('vision', 'room301'));
create index if not exists guestbook_created_idx on public.guestbook (created_at desc);
create index if not exists guestbook_room_idx on public.guestbook (room, created_at desc);
create table if not exists public.guestbook_reports (
  gid   bigint not null references public.guestbook(id) on delete cascade,
  token text   not null,
  primary key (gid, token)
);
alter table public.guestbook enable row level security;
alter table public.guestbook_reports enable row level security;
revoke all on public.guestbook from anon, authenticated;
revoke all on public.guestbook_reports from anon, authenticated;
grant select (id, room, name, content, created_at) on public.guestbook to anon, authenticated;
drop policy if exists guestbook_read on public.guestbook;
create policy guestbook_read on public.guestbook for select to anon, authenticated using (not hidden);

drop function if exists public.add_guestbook(text, text, text);
create or replace function public.add_guestbook(p_token text, p_name text, p_content text, p_room text default 'room301')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_recent int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_content is null or length(trim(p_content)) = 0 then raise exception '내용을 적어주세요'; end if;
  if p_room not in ('vision', 'room301') then raise exception '잘못된 요청이에요'; end if;
  select count(*) into v_recent from guestbook where token = p_token and created_at > now() - interval '1 hour';
  if v_recent >= 10 then raise exception '방명록은 1시간에 10개까지 쓸 수 있어요'; end if;
  insert into guestbook (token, room, name, content)
  values (p_token, p_room, left(coalesce(trim(p_name), ''), 12), left(trim(p_content), 80))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.delete_my_guestbook(p_id bigint, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from guestbook where id = p_id and token = p_token;
end; $$;

create or replace function public.report_guestbook(p_id bigint, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into guestbook_reports (gid, token) values (p_id, p_token) on conflict do nothing;
  select count(*) into v_n from guestbook_reports where gid = p_id;
  update guestbook set report_count = v_n, hidden = (v_n >= 3) where id = p_id;
end; $$;

create or replace function public.admin_delete_guestbook(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from guestbook where id = p_id;
end; $$;

revoke all on function public.add_guestbook(text, text, text, text) from public;
revoke all on function public.delete_my_guestbook(bigint, text) from public;
revoke all on function public.report_guestbook(bigint, text) from public;
revoke all on function public.admin_delete_guestbook(text, bigint) from public;
grant execute on function public.add_guestbook(text, text, text, text) to anon, authenticated;
grant execute on function public.delete_my_guestbook(bigint, text) to anon, authenticated;
grant execute on function public.report_guestbook(bigint, text) to anon, authenticated;
grant execute on function public.admin_delete_guestbook(text, bigint) to anon, authenticated;

-- =====================================================================
--  이번주 공지 (비전 / 301호) — 관리자만 올리고 지울 수 있어요
-- =====================================================================
create table if not exists public.notices (
  id         bigserial primary key,
  room       text        not null default 'all' check (room in ('all', 'vision', 'room301')),
  content    text        not null check (char_length(content) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists notices_created_idx on public.notices (created_at desc);
alter table public.notices enable row level security;
revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;
drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices for select to anon, authenticated using (true);

create or replace function public.admin_add_notice(p_pw text, p_room text, p_content text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_room not in ('all', 'vision', 'room301') then raise exception '잘못된 요청이에요'; end if;
  if p_content is null or length(trim(p_content)) = 0 then raise exception '내용을 적어주세요'; end if;
  insert into notices (room, content) values (p_room, left(trim(p_content), 200)) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_delete_notice(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from notices where id = p_id;
end; $$;

revoke all on function public.admin_add_notice(text, text, text) from public;
revoke all on function public.admin_delete_notice(text, bigint) from public;
grant execute on function public.admin_add_notice(text, text, text) to anon, authenticated;
grant execute on function public.admin_delete_notice(text, bigint) to anon, authenticated;

-- =====================================================================
--  푸드 트럭 숫자 (타코야끼 / 붕어빵): 만든 개수, 받아간 개수
--  트럭에 남은 것 = 만든 것 - 받아간 것
-- =====================================================================
create table if not exists public.food_counters (
  kind  text primary key check (kind in ('tako', 'bungeo')),
  made  int  not null default 0,
  taken int  not null default 0
);
insert into public.food_counters (kind) values ('tako'), ('bungeo') on conflict do nothing;
create table if not exists public.food_events (
  token text        not null,
  at    timestamptz not null default now()
);
create index if not exists food_events_idx on public.food_events (token, at desc);
alter table public.food_counters enable row level security;
alter table public.food_events enable row level security;
revoke all on public.food_counters from anon, authenticated;
revoke all on public.food_events from anon, authenticated;
grant select on public.food_counters to anon, authenticated;
drop policy if exists food_read on public.food_counters;
create policy food_read on public.food_counters for select to anon, authenticated using (true);

-- 만들기: 한 번에 1~9개까지, 한 기기에서 1분에 15번까지
create or replace function public.food_make(p_token text, p_kind text, p_n int)
returns int language plpgsql security definer set search_path = public as $$
declare v_recent int; v_made int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('tako', 'bungeo') or p_n is null or p_n < 1 or p_n > 9 then raise exception '잘못된 요청이에요'; end if;
  select count(*) into v_recent from food_events where token = p_token and at > now() - interval '1 minute';
  if v_recent >= 15 then raise exception '조금만 쉬었다가 다시 만들어 주세요 🙂'; end if;
  insert into food_events (token) values (p_token);
  update food_counters set made = made + p_n where kind = p_kind returning made into v_made;
  if random() < 0.02 then delete from food_events where at < now() - interval '1 day'; end if;
  return v_made;
end; $$;

-- 하나 받기: 남은 게 있으면 1 줄이고 남은 개수를, 없으면 -1을 돌려줘요
create or replace function public.food_take(p_token text, p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare v_recent int; v_left int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('tako', 'bungeo') then raise exception '잘못된 요청이에요'; end if;
  select count(*) into v_recent from food_events where token = p_token and at > now() - interval '1 minute';
  if v_recent >= 15 then raise exception '조금만 쉬었다가 다시 받아 주세요 🙂'; end if;
  insert into food_events (token) values (p_token);
  update food_counters set taken = taken + 1 where kind = p_kind and made > taken returning made - taken into v_left;
  return coalesce(v_left, -1);
end; $$;

revoke all on function public.food_make(text, text, int) from public;
revoke all on function public.food_take(text, text) from public;
grant execute on function public.food_make(text, text, int) to anon, authenticated;
grant execute on function public.food_take(text, text) to anon, authenticated;

-- =====================================================================
--  고양이 밥 준 기록 (교회 마당 고양이 콘도)
-- =====================================================================
create table if not exists public.cat_feeds (
  id         bigserial primary key,
  token      text        not null,
  name       text        not null default '',
  kind       text        not null check (kind in ('dry', 'wet', 'churu', 'water')),
  created_at timestamptz not null default now()
);
create index if not exists cat_feeds_created_idx on public.cat_feeds (created_at desc);
alter table public.cat_feeds enable row level security;
revoke all on public.cat_feeds from anon, authenticated;
grant select (id, name, kind, created_at) on public.cat_feeds to anon, authenticated;
drop policy if exists cat_feeds_read on public.cat_feeds;
create policy cat_feeds_read on public.cat_feeds for select to anon, authenticated using (created_at > now() - interval '8 days');

-- 밥 주기: 한 기기에서 20초에 한 번, 1시간에 20번까지
create or replace function public.feed_cat(p_token text, p_name text, p_kind text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_last timestamptz; v_hour int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('dry', 'wet', 'churu', 'water') then raise exception '잘못된 요청이에요'; end if;
  select max(created_at), count(*) filter (where created_at > now() - interval '1 hour') into v_last, v_hour from cat_feeds where token = p_token;
  if v_last is not null and v_last > now() - interval '20 seconds' then raise exception '방금 줬어요! 고양이들이 먹는 중이에요 🐾'; end if;
  if v_hour >= 20 then raise exception '오늘은 배불러요! 조금 있다 다시 주세요 🐾'; end if;
  insert into cat_feeds (token, name, kind) values (p_token, left(coalesce(trim(p_name), ''), 12), p_kind) returning id into v_id;
  if random() < 0.02 then delete from cat_feeds where created_at < now() - interval '30 days'; end if;
  return v_id;
end; $$;
revoke all on function public.feed_cat(text, text, text) from public;
grant execute on function public.feed_cat(text, text, text) to anon, authenticated;

-- 바뀐 함수 목록을 Supabase(API)가 바로 다시 읽어 오게 해요
notify pgrst, 'reload schema';
