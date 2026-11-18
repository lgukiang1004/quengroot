-- =====================================================================
--  퀸장그루터기 · 2차·3차 새 단장 (2026-11-18 오후)
--  ① 🎶 한밤의 청음회: 누구나 예약 (날짜·시간·제목·설명·유튜브 찬양 30분 안팎) · 시간 겹치면 막아요
--  ② 🔖 말씀 노트: 마음에 드는 구절 담기 · ⭐ 올해의 말씀 하나
--  ③ 📝 추천 찬양: ❤️ 누른 시각을 남겨서 '이번 주 순위'를 만들어요
--     · 🎼 찬양팀 비밀번호(악보·콘티 관리)는 이제 안 써요 → 지워요
--  ④ 🎯 오늘의 미션: 새 종류 추가 (신앙·함께·놀이)
--  ⑤ 🧀 쇼룸: 내 주문 보기 · 주마다 재고 · 픽업 날짜 고르기 · 품절이면 다음 주 예약
--  ⑥ ⛸ 스케이트장: 이번 주 순위
--  ⑦ 🛋 301호: 🙏 응원 기도 카드
--  ⑧ 🕊 비전: 🌱 4주 습관 챌린지 (벽 게시판)
--
--  ★ Supabase → SQL Editor에 이 파일 내용을 붙여넣고 Run.
--    missions → site → yard 파일을 먼저 실행한 다음에 이 파일을 돌려 주세요. 여러 번 실행해도 안전해요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ① 🎶 한밤의 청음회
-- ---------------------------------------------------------------------
create table if not exists public.listen_events (
  id         bigserial primary key,
  token      text        not null,
  host       text        not null default '',
  title      text        not null,
  descr      text        not null default '',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  songs      jsonb       not null default '[]'::jsonb,   -- [{ "v": 유튜브 영상 번호 11자, "t": 곡 제목, "s": 길이(초) }]
  created_at timestamptz not null default now()
);
create index if not exists listen_events_start_idx on public.listen_events (starts_at);
alter table public.listen_events enable row level security;
revoke all on public.listen_events from anon, authenticated;

create or replace function public.listen_add(p_token text, p_host text, p_title text, p_descr text, p_start timestamptz, p_songs jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_sec int := 0; v_n int; s jsonb; v_end timestamptz; v_clash text;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_title is null or length(trim(p_title)) < 1 then raise exception '청음회 제목을 적어 주세요'; end if;
  if p_start is null or p_start < now() - interval '2 minutes' then raise exception '시작 시간은 지금 이후로 골라 주세요'; end if;
  if p_start > now() + interval '60 days' then raise exception '두 달 안의 날짜로 골라 주세요'; end if;
  if jsonb_typeof(p_songs) <> 'array' then raise exception '찬양을 넣어 주세요'; end if;
  v_n := jsonb_array_length(p_songs);
  if v_n < 1 then raise exception '찬양을 한 곡 이상 넣어 주세요'; end if;
  if v_n > 15 then raise exception '찬양은 15곡까지 넣을 수 있어요'; end if;
  for s in select * from jsonb_array_elements(p_songs) loop
    if coalesce(s->>'v', '') !~ '^[A-Za-z0-9_-]{11}$' then raise exception '유튜브 링크가 이상한 곡이 있어요'; end if;
    if coalesce((s->>'s')::int, 0) < 20 or (s->>'s')::int > 1200 then raise exception '곡 길이가 이상한 곡이 있어요'; end if;
    v_sec := v_sec + (s->>'s')::int;
  end loop;
  if v_sec > 45 * 60 then raise exception '전체 길이가 45분을 넘어요. 30분 정도로 줄여 주세요'; end if;
  v_end := p_start + make_interval(secs => v_sec);
  select title into v_clash from listen_events where starts_at < v_end + interval '5 minutes' and ends_at > p_start - interval '5 minutes' limit 1;
  if v_clash is not null then raise exception '그 시간에는 이미 「%」 청음회가 있어요. 다른 시간을 골라 주세요', v_clash; end if;
  if (select count(*) from listen_events where token = p_token and ends_at > now()) >= 3 then raise exception '예약은 한 사람이 3개까지 할 수 있어요'; end if;
  if (select count(*) from listen_events where token = p_token and created_at > now() - interval '1 minute') >= 1 then raise exception '조금만 천천히! 🙂'; end if;
  insert into listen_events (token, host, title, descr, starts_at, ends_at, songs)
    values (p_token, left(coalesce(trim(p_host), ''), 12), left(trim(p_title), 40), left(coalesce(trim(p_descr), ''), 200), p_start, v_end,
            (select jsonb_agg(jsonb_build_object('v', e->>'v', 't', left(coalesce(e->>'t', ''), 60), 's', (e->>'s')::int)) from jsonb_array_elements(p_songs) e))
    returning id into v_id;
  delete from listen_events where ends_at < now() - interval '30 days';
  return v_id;
end; $$;

create or replace function public.listen_list(p_token text default '')
returns table (id bigint, host text, title text, descr text, starts_at timestamptz, ends_at timestamptz, songs jsonb, mine boolean)
language sql security definer set search_path = public stable as $$
  select e.id, e.host, e.title, e.descr, e.starts_at, e.ends_at, e.songs, e.token = coalesce(p_token, '')
    from listen_events e where e.ends_at > now() - interval '10 minutes' order by e.starts_at limit 30;
$$;
create or replace function public.listen_delete(p_token text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin delete from listen_events where id = p_id and token = p_token; end; $$;
create or replace function public.admin_listen_delete(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from listen_events where id = p_id;
end; $$;
revoke all on function public.listen_add(text, text, text, text, timestamptz, jsonb) from public;
revoke all on function public.listen_list(text) from public;
revoke all on function public.listen_delete(text, bigint) from public;
revoke all on function public.admin_listen_delete(text, bigint) from public;
grant execute on function public.listen_add(text, text, text, text, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.listen_list(text) to anon, authenticated;
grant execute on function public.listen_delete(text, bigint) to anon, authenticated;
grant execute on function public.admin_listen_delete(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ② 🔖 말씀 노트 (나만 봐요)
-- ---------------------------------------------------------------------
create table if not exists public.verse_notes (
  id         bigserial primary key,
  token      text        not null,
  ref        text        not null,          -- 예: 시편 23:1
  txt        text        not null,
  b          int         not null default 0,
  c          int         not null default 0,
  memo       text        not null default '',
  star       boolean     not null default false, -- ⭐ 올해의 말씀
  created_at timestamptz not null default now()
);
create unique index if not exists verse_notes_tok_ref on public.verse_notes (token, ref);
alter table public.verse_notes enable row level security;
revoke all on public.verse_notes from anon, authenticated;

create or replace function public.note_save(p_token text, p_ref text, p_txt text, p_b int, p_c int, p_memo text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if coalesce(trim(p_ref), '') = '' or coalesce(trim(p_txt), '') = '' then raise exception '잘못된 요청이에요'; end if;
  if (select count(*) from verse_notes where token = p_token) >= 1000 then raise exception '말씀 노트가 꽉 찼어요 (1000개)'; end if;
  insert into verse_notes (token, ref, txt, b, c, memo) values (p_token, left(trim(p_ref), 40), left(trim(p_txt), 600), coalesce(p_b, 0), coalesce(p_c, 0), left(coalesce(trim(p_memo), ''), 300))
    on conflict (token, ref) do update set memo = case when excluded.memo <> '' then excluded.memo else verse_notes.memo end
    returning id into v_id;
  return v_id;
end; $$;
create or replace function public.note_memo(p_token text, p_id bigint, p_memo text)
returns void language sql security definer set search_path = public as $$
  update verse_notes set memo = left(coalesce(trim(p_memo), ''), 300) where id = p_id and token = p_token;
$$;
create or replace function public.note_star(p_token text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update verse_notes set star = false where token = p_token and star and id <> p_id;
  update verse_notes set star = not star where token = p_token and id = p_id;
end; $$;
create or replace function public.note_delete(p_token text, p_id bigint)
returns void language sql security definer set search_path = public as $$
  delete from verse_notes where id = p_id and token = p_token;
$$;
create or replace function public.notes_me(p_token text)
returns table (id bigint, ref text, txt text, b int, c int, memo text, star boolean, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select n.id, n.ref, n.txt, n.b, n.c, n.memo, n.star, n.created_at from verse_notes n where n.token = p_token order by n.star desc, n.created_at desc limit 1000;
$$;
revoke all on function public.note_save(text, text, text, int, int, text) from public;
revoke all on function public.note_memo(text, bigint, text) from public;
revoke all on function public.note_star(text, bigint) from public;
revoke all on function public.note_delete(text, bigint) from public;
revoke all on function public.notes_me(text) from public;
grant execute on function public.note_save(text, text, text, int, int, text) to anon, authenticated;
grant execute on function public.note_memo(text, bigint, text) to anon, authenticated;
grant execute on function public.note_star(text, bigint) to anon, authenticated;
grant execute on function public.note_delete(text, bigint) to anon, authenticated;
grant execute on function public.notes_me(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ③ 📝 추천 찬양 순위 (이번 주 ❤️ · 전체 ❤️) + 찬양팀 비밀번호 정리
-- ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.song_rec_marks') is not null then
    alter table public.song_rec_marks add column if not exists at timestamptz not null default now();
  end if;
end $$;
create or replace function public.rec_rank(p_scope text default 'week')
returns table (id bigint, name text, title text, artist text, note text, link text, like_count int, week_likes int, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select r.id, r.name, r.title, r.artist, r.note, r.link, r.like_count,
         (select count(*)::int from song_rec_marks m where m.rid = r.id and m.kind = 'like' and m.at > now() - interval '7 days') as week_likes,
         r.created_at
    from song_recs r where not r.hidden
    order by case when p_scope = 'week' then (select count(*) from song_rec_marks m where m.rid = r.id and m.kind = 'like' and m.at > now() - interval '7 days') else r.like_count end desc, r.like_count desc, r.created_at desc
    limit 10;
$$;
revoke all on function public.rec_rank(text) from public;
grant execute on function public.rec_rank(text) to anon, authenticated;
-- 내가 ❤️ 누른 곡 번호들
create or replace function public.rec_my_likes(p_token text)
returns setof bigint language sql security definer set search_path = public stable as $$
  select rid from song_rec_marks where token = p_token and kind = 'like';
$$;
revoke all on function public.rec_my_likes(text) from public;
grant execute on function public.rec_my_likes(text) to anon, authenticated;
-- 🎼 찬양팀 비밀번호는 이제 안 써요
do $$ begin
  if to_regclass('public.admin_roles') is not null then delete from public.admin_roles where role = 'praise'; end if;
end $$;

-- ---------------------------------------------------------------------
-- ④ 🎯 오늘의 미션 기록 (새 종류 추가 · 나머지 규칙은 그대로)
-- ---------------------------------------------------------------------
create or replace function public.mission_add(p_token text, p_name text, p_kind text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'America/New_York')::date;
  cap int; cur_n int; cur_at timestamptz; kinds int; tr int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind is null or p_kind !~ '^(visit|pray|give|catfeed|quiz|jam|cookie|stamp|resolve|walk|walkq|campfire|marsh|catpet|note|plan|rest|reclike|recplay|cheer|prank|dance|skate|listen|study|party|habit|bball|read:[0-9]{1,2}:[0-9]{1,3}|season:[a-z]{2,12}:[0-9]{4}|gift:[a-z]{2,16}|treat:(salmon|catnip|yarn|chicken|shrimp))$' then
    raise exception '잘못된 요청이에요';
  end if;
  cap := case
    when p_kind in ('visit', 'stamp', 'resolve', 'jam', 'walk', 'walkq', 'campfire', 'plan', 'rest', 'skate', 'listen', 'study', 'party', 'habit', 'dance') or p_kind like 'read:%' or p_kind like 'season:%' or p_kind like 'gift:%' then 1
    when p_kind = 'pray' then 20
    when p_kind in ('catpet', 'note', 'reclike', 'recplay', 'cheer') then 10
    when p_kind = 'prank' then 5
    when p_kind like 'treat:%' then 2
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
  select n, at into cur_n, cur_at from mission_log where token = p_token and day = d and kind = p_kind;
  if found then
    if cur_n >= cap then return cur_n; end if;
    if cur_at > now() - interval '5 seconds' and p_kind not like 'treat:%' then return cur_n; end if;
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
-- ⑤ 🧀 쇼룸: 픽업 날짜 · 주마다 재고 · 내 주문 보기
-- ---------------------------------------------------------------------
alter table public.cm_orders add column if not exists pickup_day date;
create table if not exists public.cm_stock (
  day   date primary key,            -- 픽업하는 날 (보통 주일)
  qty_s int  not null default 0 check (qty_s between 0 and 999),
  qty_l int  not null default 0 check (qty_l between 0 and 999)
);
alter table public.cm_stock enable row level security;
revoke all on public.cm_stock from anon, authenticated;

-- 날짜별 남은 수량 (재고를 안 정한 날은 null = 넉넉해요)
create or replace function public.cm_stock_left(p_from date default null, p_days int default 35)
returns table (day date, left_s int, left_l int)
language sql security definer set search_path = public stable as $$
  select s.day,
         s.qty_s - coalesce((select sum(o.qty_s) from cm_orders o where o.pickup_day = s.day and o.status <> 'canceled'), 0)::int,
         s.qty_l - coalesce((select sum(o.qty_l) from cm_orders o where o.pickup_day = s.day and o.status <> 'canceled'), 0)::int
    from cm_stock s
    where s.day >= coalesce(p_from, (now() at time zone 'America/New_York')::date) and s.day < coalesce(p_from, (now() at time zone 'America/New_York')::date) + p_days
    order by s.day;
$$;
create or replace function public.order_add2(p_token text, p_name text, p_contact text, p_s int, p_l int, p_pickup text, p_memo text, p_day date)
returns bigint language plpgsql security definer set search_path = public as $$
declare oid bigint; ls int; ll int; today date := (now() at time zone 'America/New_York')::date;
begin
  if p_day is null or p_day < today or p_day > today + 60 then raise exception '픽업 날짜를 골라 주세요'; end if;
  if exists (select 1 from cm_stock where day = p_day) then
    select left_s, left_l into ls, ll from public.cm_stock_left(p_day, 1);
    if coalesce(p_s, 0) > greatest(ls, 0) or coalesce(p_l, 0) > greatest(ll, 0) then
      raise exception '그날은 남은 수량이 모자라요 (200g %개 · 450g %개 남음). 다음 주로 예약해 주세요', greatest(ls, 0), greatest(ll, 0);
    end if;
  end if;
  oid := public.order_add(p_token, p_name, p_contact, p_s, p_l, p_pickup, p_memo);
  update cm_orders set pickup_day = p_day where id = oid;
  return oid;
end; $$;
-- 내 주문 (연락처는 안 보여줘요)
create or replace function public.my_orders(p_token text)
returns table (id bigint, qty_s int, qty_l int, pickup text, pickup_day date, total int, status text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select o.id, o.qty_s, o.qty_l, o.pickup, o.pickup_day, o.total, o.status, o.created_at
    from cm_orders o where o.token = p_token and o.created_at > now() - interval '120 days' order by o.created_at desc limit 20;
$$;
create or replace function public.my_order_cancel(p_token text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update cm_orders set status = 'canceled', status_at = now() where id = p_id and token = p_token and status = 'new';
  if not found then raise exception '이미 연락드린 주문은 연락처로 취소해 주세요'; end if;
end; $$;
create or replace function public.admin_stock_set(p_pw text, p_day date, p_s int, p_l int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_s is null and p_l is null then delete from cm_stock where day = p_day; return; end if;
  insert into cm_stock (day, qty_s, qty_l) values (p_day, greatest(0, coalesce(p_s, 0)), greatest(0, coalesce(p_l, 0)))
    on conflict (day) do update set qty_s = excluded.qty_s, qty_l = excluded.qty_l;
end; $$;
-- 관리자 주문 목록에 픽업 날짜 추가
drop function if exists public.admin_orders(text);
create or replace function public.admin_orders(p_pw text)
returns table (id bigint, name text, contact text, qty_s int, qty_l int, pickup text, memo text, total int, status text, created_at timestamptz, pickup_day date)
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if to_regprocedure('public.order_contact_cleanup()') is not null then perform public.order_contact_cleanup(); end if;
  return query select o.id, o.name, o.contact, o.qty_s, o.qty_l, o.pickup, o.memo, o.total, o.status, o.created_at, o.pickup_day
    from cm_orders o order by o.created_at desc limit 300;
end; $$;
revoke all on function public.cm_stock_left(date, int) from public;
revoke all on function public.order_add2(text, text, text, int, int, text, text, date) from public;
revoke all on function public.my_orders(text) from public;
revoke all on function public.my_order_cancel(text, bigint) from public;
revoke all on function public.admin_stock_set(text, date, int, int) from public;
revoke all on function public.admin_orders(text) from public;
grant execute on function public.cm_stock_left(date, int) to anon, authenticated;
grant execute on function public.order_add2(text, text, text, int, int, text, text, date) to anon, authenticated;
grant execute on function public.my_orders(text) to anon, authenticated;
grant execute on function public.my_order_cancel(text, bigint) to anon, authenticated;
grant execute on function public.admin_stock_set(text, date, int, int) to anon, authenticated;
grant execute on function public.admin_orders(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ⑥ ⛸ 스케이트장 이번 주 순위 (월요일부터 새로)
-- ---------------------------------------------------------------------
create table if not exists public.rink_week (
  token      text        not null,
  kind       text        not null check (kind in ('figure', 'speed')),
  wk         date        not null,
  name       text        not null default '',
  score      numeric(7,2) not null,
  song       text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (token, kind, wk)
);
alter table public.rink_week enable row level security;
revoke all on public.rink_week from anon, authenticated;
create or replace function public._rink_wk() returns date language sql stable as $$
  select date_trunc('week', (now() at time zone 'America/New_York'))::date;
$$;
create or replace function public.rink_score_add(p_token text, p_name text, p_kind text, p_score numeric, p_song text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old numeric; v_last timestamptz; v_better boolean := true; v_best numeric; v_rank int; w date := public._rink_wk(); v_wold numeric; v_wrank int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('figure', 'speed') or p_score is null then raise exception '잘못된 요청이에요'; end if;
  if p_kind = 'figure' and (p_score <= 0 or p_score > 150) then raise exception '점수가 이상해요'; end if;
  if p_kind = 'speed' and (p_score < 8 or p_score > 600) then raise exception '기록이 이상해요'; end if;
  select score, updated_at into v_old, v_last from rink_scores where token = p_token and kind = p_kind;
  if v_last is not null and v_last > now() - interval '8 seconds' then raise exception '조금만 천천히! 🙂'; end if;
  if v_old is null then
    insert into rink_scores (token, kind, name, score, song) values (p_token, p_kind, left(coalesce(trim(p_name), ''), 12), round(p_score, 2), left(coalesce(p_song, ''), 16));
  else
    v_better := case when p_kind = 'figure' then p_score > v_old else p_score < v_old end;
    update rink_scores set name = left(coalesce(trim(p_name), ''), 12), tries = tries + 1, updated_at = now(),
      score = case when v_better then round(p_score, 2) else score end,
      song  = case when v_better then left(coalesce(p_song, ''), 16) else song end
      where token = p_token and kind = p_kind;
  end if;
  -- 이번 주 기록
  select score into v_wold from rink_week where token = p_token and kind = p_kind and wk = w;
  if v_wold is null then
    insert into rink_week (token, kind, wk, name, score, song) values (p_token, p_kind, w, left(coalesce(trim(p_name), ''), 12), round(p_score, 2), left(coalesce(p_song, ''), 16));
  elsif (case when p_kind = 'figure' then p_score > v_wold else p_score < v_wold end) then
    update rink_week set score = round(p_score, 2), song = left(coalesce(p_song, ''), 16), name = left(coalesce(trim(p_name), ''), 12), updated_at = now()
      where token = p_token and kind = p_kind and wk = w;
  end if;
  delete from rink_week where wk < w - 70;
  select score into v_best from rink_scores where token = p_token and kind = p_kind;
  select count(*) + 1 into v_rank from rink_scores where kind = p_kind and (case when p_kind = 'figure' then score > v_best else score < v_best end);
  select count(*) + 1 into v_wrank from rink_week x where x.kind = p_kind and x.wk = w
    and (case when p_kind = 'figure' then x.score > (select score from rink_week where token = p_token and kind = p_kind and wk = w)
              else x.score < (select score from rink_week where token = p_token and kind = p_kind and wk = w) end);
  return jsonb_build_object('best', v_best, 'rank', v_rank, 'new', v_better, 'wrank', v_wrank);
end; $$;
create or replace function public.rink_top_week(p_kind text, p_token text default '')
returns table (name text, score numeric, song text, me boolean)
language sql security definer set search_path = public stable as $$
  select r.name, r.score, r.song, r.token = coalesce(p_token, '') from rink_week r
    where r.kind = p_kind and r.wk = public._rink_wk()
    order by case when p_kind = 'figure' then -r.score else r.score end, r.updated_at limit 10;
$$;
revoke all on function public.rink_score_add(text, text, text, numeric, text) from public;
revoke all on function public.rink_top_week(text, text) from public;
grant execute on function public.rink_score_add(text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.rink_top_week(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ⑦ 🛋 301호 · 🙏 응원 기도 카드 (시험·면접·이사… 짧게 부탁하면 친구들이 🙏 눌러 줘요 · 2주 뒤 사라져요)
-- ---------------------------------------------------------------------
create table if not exists public.cheer_cards (
  id         bigserial primary key,
  token      text        not null,
  room       text        not null default 'room301' check (room in ('room301', 'vision')),
  name       text        not null default '',
  txt        text        not null,
  amen       int         not null default 0,
  report     int         not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cheer_cards_room_idx on public.cheer_cards (room, created_at desc);
create table if not exists public.cheer_marks (
  token text   not null,
  cid   bigint not null references public.cheer_cards(id) on delete cascade,
  kind  text   not null default 'amen' check (kind in ('amen', 'report')),
  primary key (token, cid, kind)
);
alter table public.cheer_cards enable row level security;
alter table public.cheer_marks enable row level security;
revoke all on public.cheer_cards from anon, authenticated;
revoke all on public.cheer_marks from anon, authenticated;
create or replace function public.cheer_add(p_token text, p_room text, p_name text, p_txt text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_room not in ('room301', 'vision') then raise exception '잘못된 요청이에요'; end if;
  if coalesce(length(trim(p_txt)), 0) < 2 then raise exception '한 줄 적어 주세요'; end if;
  if (select count(*) from cheer_cards where token = p_token and created_at > now() - interval '1 day') >= 3 then raise exception '응원 카드는 하루 3장까지 쓸 수 있어요'; end if;
  insert into cheer_cards (token, room, name, txt) values (p_token, p_room, left(coalesce(trim(p_name), ''), 12), left(trim(p_txt), 80)) returning id into v_id;
  delete from cheer_cards where created_at < now() - interval '14 days';
  return v_id;
end; $$;
create or replace function public.cheer_list(p_room text, p_token text default '')
returns table (id bigint, name text, txt text, amen int, mine boolean, prayed boolean, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select c.id, c.name, c.txt, c.amen, c.token = coalesce(p_token, ''),
         exists (select 1 from cheer_marks m where m.cid = c.id and m.token = coalesce(p_token, '') and m.kind = 'amen'), c.created_at
    from cheer_cards c where c.room = p_room and c.report < 3 and c.created_at > now() - interval '14 days'
    order by c.created_at desc limit 40;
$$;
create or replace function public.cheer_amen(p_token text, p_id bigint)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_token is null or length(p_token) < 8 then raise exception '잘못된 요청이에요'; end if;
  insert into cheer_marks (token, cid, kind) values (p_token, p_id, 'amen') on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update cheer_cards set amen = amen + 1 where id = p_id; end if;
  select amen into n from cheer_cards where id = p_id; return coalesce(n, 0);
end; $$;
create or replace function public.cheer_report(p_token text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into cheer_marks (token, cid, kind) values (p_token, p_id, 'report') on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update cheer_cards set report = report + 1 where id = p_id; end if;
end; $$;
create or replace function public.cheer_delete(p_token text, p_id bigint)
returns void language sql security definer set search_path = public as $$ delete from cheer_cards where id = p_id and token = p_token; $$;
create or replace function public.admin_cheer_delete(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if; delete from cheer_cards where id = p_id; end; $$;
revoke all on function public.cheer_add(text, text, text, text) from public;
revoke all on function public.cheer_list(text, text) from public;
revoke all on function public.cheer_amen(text, bigint) from public;
revoke all on function public.cheer_report(text, bigint) from public;
revoke all on function public.cheer_delete(text, bigint) from public;
revoke all on function public.admin_cheer_delete(text, bigint) from public;
grant execute on function public.cheer_add(text, text, text, text) to anon, authenticated;
grant execute on function public.cheer_list(text, text) to anon, authenticated;
grant execute on function public.cheer_amen(text, bigint) to anon, authenticated;
grant execute on function public.cheer_report(text, bigint) to anon, authenticated;
grant execute on function public.cheer_delete(text, bigint) to anon, authenticated;
grant execute on function public.admin_cheer_delete(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ⑧ 🕊 비전 · 🌱 4주 습관 챌린지 (한 사람 하나 · 28일 · 벽 게시판에 이름·목표·체크 수가 보여요)
-- ---------------------------------------------------------------------
create table if not exists public.habits (
  token      text        primary key,
  name       text        not null default '',
  goal       text        not null,
  emoji      text        not null default '🌱',
  start_day  date        not null,
  checks     int[]       not null default '{}',   -- 체크한 날 (0~27)
  shown      boolean     not null default true,   -- 벽 게시판에 보이기
  updated_at timestamptz not null default now()
);
alter table public.habits enable row level security;
revoke all on public.habits from anon, authenticated;
create or replace function public.habit_start(p_token text, p_name text, p_goal text, p_emoji text, p_shown boolean)
returns void language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/New_York')::date;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if coalesce(length(trim(p_goal)), 0) < 2 then raise exception '목표를 적어 주세요'; end if;
  insert into habits (token, name, goal, emoji, start_day, checks, shown) values (p_token, left(coalesce(trim(p_name), ''), 12), left(trim(p_goal), 40), left(coalesce(p_emoji, '🌱'), 4), today, '{}', coalesce(p_shown, true))
    on conflict (token) do update set name = excluded.name, goal = excluded.goal, emoji = excluded.emoji, start_day = today, checks = '{}', shown = excluded.shown, updated_at = now();
end; $$;
create or replace function public.habit_check(p_token text, p_name text)
returns int language plpgsql security definer set search_path = public as $$
declare h habits; d int; today date := (now() at time zone 'America/New_York')::date;
begin
  select * into h from habits where token = p_token;
  if not found then raise exception '먼저 습관을 정해 주세요'; end if;
  d := today - h.start_day;
  if d < 0 or d > 27 then raise exception '4주가 끝났어요. 새 챌린지를 시작해 보세요 🌱'; end if;
  if not (d = any(h.checks)) then update habits set checks = array_append(checks, d), name = left(coalesce(trim(p_name), name), 12), updated_at = now() where token = p_token; end if;
  return coalesce(array_length((select checks from habits where token = p_token), 1), 0);
end; $$;
create or replace function public.habit_me(p_token text)
returns table (goal text, emoji text, start_day date, checks int[], shown boolean)
language sql security definer set search_path = public stable as $$
  select h.goal, h.emoji, h.start_day, h.checks, h.shown from habits h where h.token = p_token;
$$;
create or replace function public.habit_board(p_token text default '')
returns table (name text, goal text, emoji text, n int, day int, today boolean, me boolean)
language sql security definer set search_path = public stable as $$
  select h.name, h.goal, h.emoji, coalesce(array_length(h.checks, 1), 0),
         ((now() at time zone 'America/New_York')::date - h.start_day),
         ((now() at time zone 'America/New_York')::date - h.start_day) = any(h.checks),
         h.token = coalesce(p_token, '')
    from habits h
    where h.shown and h.start_day > (now() at time zone 'America/New_York')::date - 35
    order by h.updated_at desc limit 30;
$$;
create or replace function public.habit_stop(p_token text)
returns void language sql security definer set search_path = public as $$ delete from habits where token = p_token; $$;
revoke all on function public.habit_start(text, text, text, text, boolean) from public;
revoke all on function public.habit_check(text, text) from public;
revoke all on function public.habit_me(text) from public;
revoke all on function public.habit_board(text) from public;
revoke all on function public.habit_stop(text) from public;
grant execute on function public.habit_start(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.habit_check(text, text) to anon, authenticated;
grant execute on function public.habit_me(text) to anon, authenticated;
grant execute on function public.habit_board(text) to anon, authenticated;
grant execute on function public.habit_stop(text) to anon, authenticated;

notify pgrst, 'reload schema';
