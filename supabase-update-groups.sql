-- =====================================================================
--  퀸장그루터기 온라인 교회 · 추가 설정 (2026-11-12 · 1부/2부 나누기 + 찬양팀 곡 악보)
--   1) 관리자 비밀번호 역할: 전체 관리자(원래 비밀번호) / 청년 1부 관리자 / 찬양팀
--   2) 📢 공지 셋으로: 전체(마당) · 1부(301호) · 2부(비전)
--   3) 🧩 성경 퀴즈: 301호(1부) · 비전(2부) 따로 (출제 범위 · 랭킹)
--   4) 📚 함께 성경 읽기(챌린지): 1부 · 2부 따로 동시에
--   5) 🎼 찬양팀 곡 악보 (악보 사진 · 코드 · 유튜브 · 콘티 순서)
--
--  ★ 먼저 supabase-update-footprints.sql · supabase-update-quiz.sql · supabase-update-community.sql 을
--    실행한 프로젝트에서, 이 파일 내용을 SQL Editor에 붙여넣고 Run 하면 돼요.
--    여러 번 실행해도 괜찮아요. 예전 공지 · 퀴즈 점수 · 챌린지는 그대로 남아요.
--  ★ 1부 · 찬양팀 비밀번호는 이 파일에 없어요 (사이트에 올라가는 파일이라서).
--    따로 드린 role-passwords-SECRET.sql 을 실행하거나, 사이트 ⚙️ 관리자 → 🔑 비밀번호 관리에서 정해요.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) 관리자 역할
--    'all'    = 전체 관리자 (supabase-setup.sql 의 원래 비밀번호, admin_check)
--    'g1'     = 청년 1부 관리자: 1부 공지 · 301호 퀴즈 · 1부 함께 성경 읽기만
--    'praise' = 찬양팀: 찬양팀 곡 악보 올리기·고치기·지우기만
-- ---------------------------------------------------------------------
create table if not exists public.admin_roles (
  role       text primary key check (role in ('g1', 'praise')),
  pw_hash    text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
revoke all on public.admin_roles from anon, authenticated;
-- 틀린 비밀번호 기록 (10분에 30번 넘게 틀리면 잠깐 막아요)
create table if not exists public.admin_fails (at timestamptz not null default now());
alter table public.admin_fails enable row level security;
revoke all on public.admin_fails from anon, authenticated;

-- 비밀번호 → 역할 ('all' | 'g1' | 'praise' | null). 틀리면 기록만 남기고 null
create or replace function public.admin_role(p_pw text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare r text; n int;
begin
  if p_pw is null or length(p_pw) = 0 then return null; end if;
  select count(*) into n from admin_fails where at > now() - interval '10 minutes';
  if n >= 30 then raise exception '비밀번호를 너무 많이 틀렸어요. 10분 뒤에 다시 해 주세요'; end if;
  if public.admin_check(p_pw) then return 'all'; end if;
  select role into r from admin_roles where pw_hash = extensions.crypt(p_pw, pw_hash) order by role limit 1;
  if r is null then
    insert into admin_fails default values;
    delete from admin_fails where at < now() - interval '1 day';
  end if;
  return r;
end; $$;
-- 이 일을 해도 되는 비밀번호인가? area: notice_all | notice_g1 | notice_g2 | quiz_g1 | quiz_g2 | ch_g1 | ch_g2 | praise
create or replace function public.role_ok(p_pw text, p_area text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r text := public.admin_role(p_pw);
begin
  if r is null then return false; end if;
  if r = 'all' then return true; end if;
  if r = 'g1' then return p_area in ('notice_g1', 'quiz_g1', 'ch_g1'); end if;
  if r = 'praise' then return p_area = 'praise'; end if;
  return false;
end; $$;
-- 전체 관리자만: 1부 · 찬양팀 비밀번호 정하기 (4글자 이상)
create or replace function public.admin_set_role_pw(p_pw text, p_role text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pw) then raise exception '전체 관리자 비밀번호가 필요해요'; end if;
  if p_role not in ('g1', 'praise') then raise exception '잘못된 요청이에요'; end if;
  if p_new is null or length(p_new) < 3 then raise exception '비밀번호를 3글자 이상으로 정해 주세요'; end if;
  if public.admin_check(p_new) then raise exception '전체 관리자 비밀번호와 다르게 정해 주세요'; end if;
  insert into admin_roles (role, pw_hash, updated_at) values (p_role, extensions.crypt(p_new, extensions.gen_salt('bf')), now())
    on conflict (role) do update set pw_hash = excluded.pw_hash, updated_at = now();
end; $$;
revoke all on function public.admin_role(text) from public;
revoke all on function public.role_ok(text, text) from public, anon, authenticated;
revoke all on function public.admin_set_role_pw(text, text, text) from public;
grant execute on function public.admin_role(text) to anon, authenticated;
grant execute on function public.admin_set_role_pw(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) 📢 공지: room 'all' = 전체(마당), 'room301' = 1부, 'vision' = 2부
--    (예전 'all'(비전+301호 둘 다) 공지는 이제 마당에 보여요)
-- ---------------------------------------------------------------------
create or replace function public.notice_add(p_pw text, p_room text, p_content text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_room not in ('all', 'vision', 'room301') then raise exception '잘못된 요청이에요'; end if;
  if not public.role_ok(p_pw, case p_room when 'room301' then 'notice_g1' when 'vision' then 'notice_g2' else 'notice_all' end) then return null; end if;
  if p_content is null or length(trim(p_content)) = 0 then raise exception '내용을 적어주세요'; end if;
  insert into notices (room, content) values (p_room, left(trim(p_content), 200)) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.notice_delete(p_pw text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_room text;
begin
  select room into v_room from notices where id = p_id;
  if v_room is null then return true; end if;
  if not public.role_ok(p_pw, case v_room when 'room301' then 'notice_g1' when 'vision' then 'notice_g2' else 'notice_all' end) then return false; end if;
  delete from notices where id = p_id;
  return true;
end; $$;
revoke all on function public.notice_add(text, text, text) from public;
revoke all on function public.notice_delete(text, bigint) from public;
grant execute on function public.notice_add(text, text, text) to anon, authenticated;
grant execute on function public.notice_delete(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) 🧩 성경 퀴즈 1부 / 2부
--    quiz_settings id 1 = 2부(비전, 예전 설정 그대로) · id 2 = 1부(301호, 처음엔 2부 설정을 복사)
--    quiz_solves 에 grp 칸 ('g1' | 'g2'). 예전 점수는 1부·2부 양쪽에 똑같이 넣어 둬요
-- ---------------------------------------------------------------------
alter table public.quiz_settings drop constraint if exists quiz_settings_id_check;
alter table public.quiz_settings add constraint quiz_settings_id_check check (id in (1, 2));
insert into public.quiz_settings (id, books, general) select 2, books, general from public.quiz_settings where id = 1 on conflict do nothing;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_solves' and column_name = 'grp') then
    alter table public.quiz_solves add column grp text not null default 'g2' check (grp in ('g1', 'g2'));
    alter table public.quiz_solves drop constraint if exists quiz_solves_pkey;
    alter table public.quiz_solves add primary key (token, qid, grp);
    insert into public.quiz_solves (token, qid, level, points, created_at, grp)
      select token, qid, level, points, created_at, 'g1' from public.quiz_solves where grp = 'g2' on conflict do nothing;
  end if;
end $$;
create or replace function public.quiz_set_books(p_pw text, p_grp text, p_books int[], p_general boolean default true)
returns boolean language plpgsql security definer set search_path = public as $$
declare v smallint[];
begin
  if p_grp not in ('g1', 'g2') then raise exception '잘못된 요청이에요'; end if;
  if not public.role_ok(p_pw, 'quiz_' || p_grp) then return false; end if;
  select coalesce(array_agg(distinct b order by b), '{}') into v from unnest(coalesce(p_books, '{}')) as b where b between 1 and 66;
  update quiz_settings set books = v, general = coalesce(p_general, true), updated_at = now() where id = case p_grp when 'g1' then 2 else 1 end;
  return true;
end; $$;
create or replace function public.quiz_reset(p_pw text, p_grp text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_grp not in ('g1', 'g2') then raise exception '잘못된 요청이에요'; end if;
  if not public.role_ok(p_pw, 'quiz_' || p_grp) then return false; end if;
  delete from quiz_solves where grp = p_grp;
  return true;
end; $$;
create or replace function public.quiz_submit_g(p_token text, p_name text, p_items jsonb, p_grp text)
returns int language plpgsql security definer set search_path = public as $$
declare v_last timestamptz; v_gain int := 0; it jsonb; v_lv text; v_pt int; v_id text; n int;
begin
  if p_grp not in ('g1', 'g2') then raise exception '잘못된 요청이에요'; end if;
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5 then raise exception '잘못된 요청이에요'; end if;
  select updated_at into v_last from quiz_players where token = p_token;
  if v_last is not null and v_last > now() - interval '6 seconds' then raise exception '조금만 천천히! 몇 초 뒤에 다시 제출해 주세요 🙂'; end if;
  select count(*) into n from quiz_solves where token = p_token and created_at > now() - interval '1 hour';
  if n >= 200 then raise exception '오늘 퀴즈 많이 풀었어요! 잠깐 쉬었다가 해요 🙂'; end if;
  insert into quiz_players (token, name, rounds, updated_at) values (p_token, left(coalesce(trim(p_name), ''), 12), 1, now())
    on conflict (token) do update set name = excluded.name, rounds = quiz_players.rounds + 1, updated_at = now();
  for it in select * from jsonb_array_elements(p_items) loop
    v_id := left(coalesce(it->>'id', ''), 80); v_lv := it->>'level';
    if length(v_id) < 3 or v_lv not in ('easy', 'fun', 'mid', 'high') then continue; end if;
    v_pt := case v_lv when 'high' then 3 when 'mid' then 2 else 1 end;
    insert into quiz_solves (token, qid, level, points, grp) values (p_token, v_id, v_lv, v_pt, p_grp) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then v_gain := v_gain + v_pt; end if;
  end loop;
  return v_gain;
end; $$;
create or replace function public.quiz_ranking_g(p_period text, p_token text, p_grp text)
returns table (rank bigint, name text, points bigint, solved bigint, me boolean)
language sql security definer set search_path = public stable as $$
  with since as (
    select case when p_period = 'week'
      then (date_trunc('week', now() at time zone 'America/New_York')) at time zone 'America/New_York'
      else '-infinity'::timestamptz end as t
  ), agg as (
    select s.token, sum(s.points)::bigint as points, count(*)::bigint as solved, max(s.created_at) as last_at
    from quiz_solves s, since where s.created_at >= since.t and s.grp = p_grp group by s.token
  ), ranked as (
    select rank() over (order by a.points desc, a.last_at asc) as rank,
           coalesce(nullif(p.name, ''), '익명') as name, a.points, a.solved, (a.token = p_token) as me
    from agg a left join quiz_players p on p.token = a.token
  )
  select rank, name, points, solved, me from ranked where rank <= 20 or me order by rank, name limit 21;
$$;
revoke all on function public.quiz_set_books(text, text, int[], boolean) from public;
revoke all on function public.quiz_reset(text, text) from public;
revoke all on function public.quiz_submit_g(text, text, jsonb, text) from public;
revoke all on function public.quiz_ranking_g(text, text, text) from public;
grant execute on function public.quiz_set_books(text, text, int[], boolean) to anon, authenticated;
grant execute on function public.quiz_reset(text, text) to anon, authenticated;
grant execute on function public.quiz_submit_g(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.quiz_ranking_g(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) 📚 함께 성경 읽기: 1부(g1) · 2부(g2) · 청년부 전체(all, 예전 챌린지)
-- ---------------------------------------------------------------------
alter table public.reading_challenges add column if not exists grp text not null default 'all';
alter table public.reading_challenges drop constraint if exists reading_challenges_grp_check;
alter table public.reading_challenges add constraint reading_challenges_grp_check check (grp in ('all', 'g1', 'g2'));
create or replace function public.challenge_add(p_pw text, p_grp text, p_title text, p_books int[], p_starts date, p_ends date)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v smallint[];
begin
  if p_grp not in ('g1', 'g2', 'all') then raise exception '잘못된 요청이에요'; end if;
  if not public.role_ok(p_pw, case p_grp when 'g1' then 'ch_g1' when 'g2' then 'ch_g2' else 'notice_all' end) then return null; end if;
  select coalesce(array_agg(distinct b order by b), '{}') into v from unnest(coalesce(p_books, '{}')) as b where b between 1 and 66;
  if array_length(v, 1) is null then raise exception '읽을 책을 골라주세요'; end if;
  if p_starts is null or p_ends is null or p_ends < p_starts then raise exception '날짜를 확인해 주세요'; end if;
  insert into reading_challenges (title, books, starts, ends, grp) values (left(trim(p_title), 60), v, p_starts, p_ends, p_grp) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.challenge_delete(p_pw text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare g text;
begin
  select grp into g from reading_challenges where id = p_id;
  if g is null then return true; end if;
  if not public.role_ok(p_pw, case g when 'g1' then 'ch_g1' when 'g2' then 'ch_g2' else 'notice_all' end) then return false; end if;
  delete from reading_challenges where id = p_id;
  return true;
end; $$;
revoke all on function public.challenge_add(text, text, text, int[], date, date) from public;
revoke all on function public.challenge_delete(text, bigint) from public;
grant execute on function public.challenge_add(text, text, text, int[], date, date) to anon, authenticated;
grant execute on function public.challenge_delete(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) 🎼 찬양팀 곡 악보
--    praise_songs: 곡 정보 + 코드(구간별, 글자) + 유튜브 + 콘티 순서(set_no, 비우면 콘티 아님)
--    praise_sheets: 악보 사진 (폰에서 줄여서 jpg로 올림, 한 장에 최대 약 1.5MB)
-- ---------------------------------------------------------------------
create table if not exists public.praise_songs (
  id         bigserial primary key,
  title      text        not null check (char_length(title) between 1 and 60),
  artist     text        not null default '' check (char_length(artist) <= 40),
  key_root   smallint    not null default 7 check (key_root between 0 and 11),
  bpm        smallint    not null default 72 check (bpm between 40 and 220),
  sig        text        not null default '4/4' check (char_length(sig) <= 6),
  chords     text        not null default '' check (char_length(chords) <= 4000),
  youtube    text        not null default '' check (youtube = '' or youtube ~ '^[A-Za-z0-9_-]{11}$'),
  set_no     smallint    check (set_no between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.praise_sheets (
  id         bigserial primary key,
  song_id    bigint      not null references public.praise_songs(id) on delete cascade,
  page       smallint    not null default 1,
  data       text        not null check (data like 'data:image/%;base64,%' and char_length(data) < 2000000),
  created_at timestamptz not null default now()
);
create index if not exists praise_sheets_song_idx on public.praise_sheets (song_id, page);
alter table public.praise_songs enable row level security;
alter table public.praise_sheets enable row level security;
revoke all on public.praise_songs from anon, authenticated;
revoke all on public.praise_sheets from anon, authenticated;
grant select on public.praise_songs to anon, authenticated;
grant select on public.praise_sheets to anon, authenticated;
drop policy if exists praise_songs_read on public.praise_songs;
create policy praise_songs_read on public.praise_songs for select to anon, authenticated using (true);
drop policy if exists praise_sheets_read on public.praise_sheets;
create policy praise_sheets_read on public.praise_sheets for select to anon, authenticated using (true);

-- 곡 저장 (p_id 가 없으면 새 곡). 반환: 곡 id (비밀번호가 틀리면 null)
create or replace function public.song_save(p_pw text, p_id bigint, p_title text, p_artist text, p_key int, p_bpm int, p_sig text, p_chords text, p_youtube text, p_set_no int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.role_ok(p_pw, 'praise') then return null; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception '곡 제목을 적어 주세요'; end if;
  if p_id is null then
    insert into praise_songs (title, artist, key_root, bpm, sig, chords, youtube, set_no)
    values (left(trim(p_title), 60), left(coalesce(trim(p_artist), ''), 40), ((coalesce(p_key, 7) % 12) + 12) % 12, greatest(40, least(220, coalesce(p_bpm, 72))),
            left(coalesce(p_sig, '4/4'), 6), left(coalesce(p_chords, ''), 4000), coalesce(p_youtube, ''), nullif(p_set_no, 0))
    returning id into v_id;
  else
    update praise_songs set title = left(trim(p_title), 60), artist = left(coalesce(trim(p_artist), ''), 40), key_root = ((coalesce(p_key, 7) % 12) + 12) % 12,
      bpm = greatest(40, least(220, coalesce(p_bpm, 72))), sig = left(coalesce(p_sig, '4/4'), 6), chords = left(coalesce(p_chords, ''), 4000),
      youtube = coalesce(p_youtube, ''), set_no = nullif(p_set_no, 0), updated_at = now()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.song_delete(p_pw text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.role_ok(p_pw, 'praise') then return false; end if;
  delete from praise_songs where id = p_id;
  return true;
end; $$;
-- 콘티 비우기 (새 주 준비)
create or replace function public.song_clear_set(p_pw text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.role_ok(p_pw, 'praise') then return false; end if;
  update praise_songs set set_no = null where set_no is not null;
  return true;
end; $$;
create or replace function public.sheet_add(p_pw text, p_song bigint, p_page int, p_data text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; n int;
begin
  if not public.role_ok(p_pw, 'praise') then return null; end if;
  select count(*) into n from praise_sheets where song_id = p_song;
  if n >= 6 then raise exception '악보 사진은 곡마다 6장까지 올릴 수 있어요'; end if;
  insert into praise_sheets (song_id, page, data) values (p_song, coalesce(p_page, n + 1), p_data) returning id into v_id;
  update praise_songs set updated_at = now() where id = p_song;
  return v_id;
end; $$;
create or replace function public.sheet_delete(p_pw text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.role_ok(p_pw, 'praise') then return false; end if;
  delete from praise_sheets where id = p_id;
  return true;
end; $$;
revoke all on function public.song_save(text, bigint, text, text, int, int, text, text, text, int) from public;
revoke all on function public.song_delete(text, bigint) from public;
revoke all on function public.song_clear_set(text) from public;
revoke all on function public.sheet_add(text, bigint, int, text) from public;
revoke all on function public.sheet_delete(text, bigint) from public;
grant execute on function public.song_save(text, bigint, text, text, int, int, text, text, text, int) to anon, authenticated;
grant execute on function public.song_delete(text, bigint) to anon, authenticated;
grant execute on function public.song_clear_set(text) to anon, authenticated;
grant execute on function public.sheet_add(text, bigint, int, text) to anon, authenticated;
grant execute on function public.sheet_delete(text, bigint) to anon, authenticated;

-- 처음 곡: '예수의 길' (HYSSOP, E키, 64) — 코드만 (악보 사진은 찬양팀이 올려요)
insert into public.praise_songs (title, artist, key_root, bpm, sig, chords)
select '예수의 길', 'HYSSOP(히솝)', 4, 64, '4/4',
'V: A2 | E/G# | F#m7 Bsus4 | E2 | E/G# | A2 | E/G# | F#m7 Bsus4 | E2
PC: E/G# | A2 | E/G# | F#m7 Bsus4 | E2 Bm | E7 | A2 | E/G# C#m7 | F#m7 | Bsus4 B
C: A/B | E2 | G#m7 | A2 | E/G# | F#m7 Bsus4 | E2 B/D# C#m7 | F#sus4 F#7 | Bsus4 B
C2: A/B | E2 | G#m7 | A2 | E/G# | F#m7 Bsus4 | E2 B/D# C#m7 | F#m7 Bsus4 | E2'
where not exists (select 1 from public.praise_songs where title = '예수의 길');

-- 바뀐 함수 목록을 Supabase(API)가 바로 다시 읽어 오게 해요
notify pgrst, 'reload schema';
