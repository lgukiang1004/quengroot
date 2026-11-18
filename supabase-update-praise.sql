-- =====================================================================
--  퀸장그루터기 온라인 교회 · 추가 설정 (2026-11-12 · 🎸 찬양팀 연습실)
--   1) 📝 추천 찬양 게시판 (song_recs) — 곡 제목 · 부른 사람 · 한마디 · 유튜브 링크
--   2) 발자취에 '찬양팀 연습실(praise)'도 남을 수 있게
--
--  ★ 이 파일 내용을 Supabase → SQL Editor에 붙여넣고 Run 하면 돼요.
--    여러 번 실행해도 괜찮아요. 다른 데이터는 그대로 있어요.
--    admin_check() 함수(처음 설정 supabase-setup.sql에 있음)를 써요.
--  ※ 연주(합주) 소리는 실시간 방송만 써서 따로 설정이 필요 없어요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 📝 추천 찬양
-- ---------------------------------------------------------------------
create table if not exists public.song_recs (
  id           bigserial primary key,
  token        text        not null,
  name         text        not null default '',
  title        text        not null check (char_length(title) between 1 and 40),
  artist       text        not null default '' check (char_length(artist) <= 30),
  note         text        not null default '' check (char_length(note) <= 80),
  link         text        not null default '' check (link = '' or link ~ '^https://youtu\.be/[A-Za-z0-9_-]{11}$'),
  like_count   int         not null default 0,
  report_count int         not null default 0,
  hidden       boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists song_recs_created_idx on public.song_recs (created_at desc);
create table if not exists public.song_rec_marks (
  token text   not null,
  rid   bigint not null references public.song_recs(id) on delete cascade,
  kind  text   not null check (kind in ('like', 'report')),
  primary key (token, rid, kind)
);
alter table public.song_recs enable row level security;
alter table public.song_rec_marks enable row level security;
revoke all on public.song_recs from anon, authenticated;
revoke all on public.song_rec_marks from anon, authenticated;
-- 화면에서는 token(기기 표시) 칸을 못 읽어요
grant select (id, name, title, artist, note, link, like_count, created_at) on public.song_recs to anon, authenticated;
drop policy if exists song_recs_read on public.song_recs;
create policy song_recs_read on public.song_recs for select to anon, authenticated using (not hidden);

create or replace function public.add_song_rec(p_token text, p_name text, p_title text, p_artist text, p_note text, p_link text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_recent int; v_link text := coalesce(trim(p_link), '');
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception '곡 제목을 적어 주세요'; end if;
  if v_link <> '' and v_link !~ '^https://youtu\.be/[A-Za-z0-9_-]{11}$' then raise exception '링크는 유튜브 주소만 넣을 수 있어요'; end if;
  -- 도배 방지: 한 기기에서 10분에 5개까지
  select count(*) into v_recent from song_recs where token = p_token and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then raise exception '조금 있다가 다시 남겨 주세요 🙂'; end if;
  insert into song_recs (token, name, title, artist, note, link)
  values (p_token, left(coalesce(trim(p_name), ''), 12), left(trim(p_title), 40), left(coalesce(trim(p_artist), ''), 30), left(coalesce(trim(p_note), ''), 80), v_link)
  returning id into v_id;
  return v_id;
end; $$;
create or replace function public.like_song_rec(p_id bigint, p_token text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_token is null or length(p_token) < 8 then raise exception '잘못된 요청이에요'; end if;
  insert into song_rec_marks (token, rid, kind) values (p_token, p_id, 'like') on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update song_recs set like_count = like_count + 1 where id = p_id; end if;
  select like_count into n from song_recs where id = p_id;
  return coalesce(n, 0);
end; $$;
create or replace function public.report_song_rec(p_id bigint, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_token is null or length(p_token) < 8 then raise exception '잘못된 요청이에요'; end if;
  insert into song_rec_marks (token, rid, kind) values (p_token, p_id, 'report') on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update song_recs set report_count = report_count + 1, hidden = (report_count + 1 >= 3) where id = p_id; end if;
end; $$;
create or replace function public.delete_my_song_rec(p_id bigint, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin delete from song_recs where id = p_id and token = p_token; end; $$;
create or replace function public.admin_delete_song_rec(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from song_recs where id = p_id;
end; $$;
revoke all on function public.add_song_rec(text, text, text, text, text, text) from public;
revoke all on function public.like_song_rec(bigint, text) from public;
revoke all on function public.report_song_rec(bigint, text) from public;
revoke all on function public.delete_my_song_rec(bigint, text) from public;
revoke all on function public.admin_delete_song_rec(text, bigint) from public;
grant execute on function public.add_song_rec(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.like_song_rec(bigint, text) to anon, authenticated;
grant execute on function public.report_song_rec(bigint, text) to anon, authenticated;
grant execute on function public.delete_my_song_rec(bigint, text) to anon, authenticated;
grant execute on function public.admin_delete_song_rec(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) 발자취: '찬양팀 연습실(praise)'에 다녀간 것도 남겨요
--    (footprints 테이블이 없으면 이 부분은 건너뛰어요 → supabase-update-footprints.sql을 먼저 실행)
-- ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.footprints') is not null then
    alter table public.footprints drop constraint if exists footprints_room_check;
    alter table public.footprints add constraint footprints_room_check
      check (room in ('yard', 'worship', 'cafe', 'vision', 'room301', 'praise'));
  end if;
end $$;

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
revoke all on function public.add_footprint(text, text, text, text, text, int, int, text, real, real, text) from public;
grant execute on function public.add_footprint(text, text, text, text, text, int, int, text, real, real, text) to anon, authenticated;

-- 바뀐 함수 목록을 Supabase(API)가 바로 다시 읽어 오게 해요
notify pgrst, 'reload schema';
