-- =====================================================================
--  퀸장그루터기 · 마당 새 단장 1차 (2026-11-18)
--  ① 🎯 미션 기록에 새 종류 추가: 🌿 말씀 산책길(walk·walkq) · 🔥 캠프파이어(campfire) · 🍡 마시멜로(marsh)
--     · 🐱 고양이 쓰다듬기(catpet, 하루 10번) · 🎒 고양이 특식(treat:종류, 하루 합쳐서 2개)
--  ② 🐾 고양이 밥에 특식 5가지 추가 (연어 큐브 · 캣닢 쿠션 · 털실 공 · 닭가슴살 · 새우)
--  ③ 🌿 산책 노트: 산책길 끝 '오늘의 질문'에 쓴 답 (나만 봐요, 하루 하나)
--
--  ★ Supabase → SQL Editor에 이 파일 내용을 붙여넣고 Run.
--    supabase-update-missions.sql · supabase-update-footprints.sql 을 먼저 실행한 프로젝트에서 돌려 주세요.
--    여러 번 실행해도 안전해요.
-- =====================================================================

-- ① 미션 기록 (예전 함수를 새로 씀 · 나머지 규칙은 그대로)
create or replace function public.mission_add(p_token text, p_name text, p_kind text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'America/New_York')::date;
  cap int; cur_n int; cur_at timestamptz; kinds int; tr int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind is null or p_kind !~ '^(visit|pray|give|catfeed|quiz|jam|cookie|stamp|resolve|walk|walkq|campfire|marsh|catpet|read:[0-9]{1,2}:[0-9]{1,3}|season:[a-z]{2,12}:[0-9]{4}|gift:[a-z]{2,16}|treat:(salmon|catnip|yarn|chicken|shrimp))$' then
    raise exception '잘못된 요청이에요';
  end if;
  cap := case
    when p_kind in ('visit', 'stamp', 'resolve', 'jam', 'walk', 'walkq', 'campfire') or p_kind like 'read:%' or p_kind like 'season:%' or p_kind like 'gift:%' then 1
    when p_kind = 'pray' then 20
    when p_kind = 'catpet' then 10
    when p_kind like 'treat:%' then 2
    else 30 end;
  select count(*) into kinds from mission_log where token = p_token and day = d;
  if kinds > 300 then raise exception '오늘은 기록이 너무 많아요. 내일 다시 해 주세요'; end if;
  -- 🎁 선물은 하루에 하나만 (미션 도장을 받은 날만)
  if p_kind like 'gift:%' then
    if exists (select 1 from mission_log where token = p_token and day = d and kind like 'gift:%') then return 1; end if;
    if not exists (select 1 from mission_log where token = p_token and day = d and kind = 'stamp') then raise exception '오늘의 미션 3개를 먼저 다 해 주세요'; end if;
  end if;
  -- 🎒 특식은 하루에 합쳐서 2개까지
  if p_kind like 'treat:%' then
    select coalesce(sum(n), 0) into tr from mission_log where token = p_token and day = d and kind like 'treat:%';
    if tr >= 2 then return 2; end if;
  end if;
  select n, at into cur_n, cur_at from mission_log where token = p_token and day = d and kind = p_kind;
  if found then
    if cur_n >= cap then return cur_n; end if;
    if cur_at > now() - interval '5 seconds' and p_kind not like 'treat:%' then return cur_n; end if; -- 너무 빠른 반복은 한 번으로
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

-- ② 고양이 밥 + 특식
alter table public.cat_feeds drop constraint if exists cat_feeds_kind_check;
alter table public.cat_feeds add constraint cat_feeds_kind_check
  check (kind in ('dry', 'wet', 'churu', 'water', 'salmon', 'catnip', 'yarn', 'chicken', 'shrimp'));
create or replace function public.feed_cat(p_token text, p_name text, p_kind text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_last timestamptz; v_hour int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind not in ('dry', 'wet', 'churu', 'water', 'salmon', 'catnip', 'yarn', 'chicken', 'shrimp') then raise exception '잘못된 요청이에요'; end if;
  select max(created_at), count(*) filter (where created_at > now() - interval '1 hour') into v_last, v_hour from cat_feeds where token = p_token;
  if v_last is not null and v_last > now() - interval '20 seconds' then raise exception '방금 줬어요! 고양이들이 먹는 중이에요 🐾'; end if;
  if v_hour >= 20 then raise exception '오늘은 배불러요! 조금 있다 다시 주세요 🐾'; end if;
  insert into cat_feeds (token, name, kind) values (p_token, left(coalesce(trim(p_name), ''), 12), p_kind) returning id into v_id;
  if random() < 0.02 then delete from cat_feeds where created_at < now() - interval '30 days'; end if;
  return v_id;
end; $$;
revoke all on function public.feed_cat(text, text, text) from public;
grant execute on function public.feed_cat(text, text, text) to anon, authenticated;

-- ③ 🌿 산책 노트 (하루 하나 · 다시 쓰면 그날 답을 바꿔요 · 나만 읽어요)
create table if not exists public.walk_notes (
  token      text        not null,
  day        date        not null,
  q          text        not null default '',
  a          text        not null default '',
  created_at timestamptz not null default now(),
  primary key (token, day)
);
alter table public.walk_notes enable row level security;
revoke all on public.walk_notes from anon, authenticated;

create or replace function public.walk_note_save(p_token text, p_q text, p_a text)
returns boolean language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/New_York')::date;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_a is null or length(trim(p_a)) < 1 then raise exception '한 줄이라도 적어 주세요'; end if;
  insert into walk_notes (token, day, q, a) values (p_token, d, left(coalesce(p_q, ''), 120), left(trim(p_a), 500))
    on conflict (token, day) do update set q = excluded.q, a = excluded.a, created_at = now();
  return true;
end; $$;
create or replace function public.walk_notes_me(p_token text)
returns table (day date, q text, a text)
language sql security definer set search_path = public stable as $$
  select n.day, n.q, n.a from walk_notes n where n.token = p_token order by n.day desc limit 400;
$$;
revoke all on function public.walk_note_save(text, text, text) from public;
revoke all on function public.walk_notes_me(text) from public;
grant execute on function public.walk_note_save(text, text, text) to anon, authenticated;
grant execute on function public.walk_notes_me(text) to anon, authenticated;

notify pgrst, 'reload schema';
