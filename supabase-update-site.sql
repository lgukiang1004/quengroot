-- =====================================================================
--  퀸장그루터기 · 사이트 전체 보완 (2026-11-18)
--  ① 📱 기기 연결 코드 (폰 ↔ 컴퓨터 기록 합치기)
--  ② 📊 관리자 요약판 (이번 주 숫자 한눈에)
--  ③ 🧀 주문 손님 연락처 자동 정리 (픽업 완료·취소 후 30일)
--
--  ★ Supabase → SQL Editor에 이 파일 내용을 붙여넣고 Run.
--    supabase-update-missions.sql 을 먼저 실행한 프로젝트에서 돌려 주세요.
--    여러 번 실행해도 안전해요. 다른 데이터는 그대로 있어요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ① 📱 기기 연결 코드
--    원래 기기(A)에서 6자리 코드를 만들고(10분), 새 기기(B)에서 넣으면
--    B의 기록이 A로 합쳐지고, B는 앞으로 A의 기기 번호(token)를 써요.
-- ---------------------------------------------------------------------
create table if not exists public.device_codes (
  code       text        primary key,
  token      text        not null,
  created_at timestamptz not null default now()
);
alter table public.device_codes add column if not exists used_at timestamptz; -- 다른 기기가 코드를 쓴 때 (만든 기기가 알아채고 새로고침해요)
create table if not exists public.device_fails (
  token text        not null,
  at    timestamptz not null default now()
);
alter table public.device_codes enable row level security;
alter table public.device_fails enable row level security;
revoke all on public.device_codes from anon, authenticated;
revoke all on public.device_fails from anon, authenticated;

create or replace function public.device_code_make(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; n int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  delete from device_codes where created_at < now() - interval '10 minutes';
  select count(*) into n from device_codes where token = p_token and used_at is null;
  if n >= 3 then raise exception '코드를 너무 많이 만들었어요. 10분 뒤에 다시 해 주세요'; end if;
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from device_codes where code = v_code);
  end loop;
  insert into device_codes (code, token) values (v_code, p_token);
  return v_code;
end; $$;

-- 한 표(table)의 기록을 B → A로 옮겨요. 같은 칸(기본 키)이 이미 A에 있으면 A 것을 남겨요
create or replace function public._device_merge_table(p_table text, p_a text, p_b text)
returns void language plpgsql security definer set search_path = public as $$
declare v_pk text[]; v_cond text;
begin
  select array_agg(a.attname order by a.attnum) into v_pk
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = ('public.' || quote_ident(p_table))::regclass and i.indisprimary;
  if v_pk is not null and 'token' = any(v_pk) then
    select string_agg(format('a.%1$I is not distinct from b.%1$I', c), ' and ') into v_cond from unnest(v_pk) c where c <> 'token';
    if v_cond is null then v_cond := 'true'; end if;
    execute format('delete from public.%I b using public.%I a where b.token = $2 and a.token = $1 and %s', p_table, p_table, v_cond) using p_a, p_b;
  end if;
  begin
    execute format('update public.%I set token = $1 where token = $2', p_table) using p_a, p_b;
  exception when unique_violation then
    raise notice '%: 겹치는 기록이 있어서 일부는 옮기지 않았어요', p_table;
  end;
end; $$;
revoke all on function public._device_merge_table(text, text, text) from public, anon, authenticated;

create or replace function public.device_link(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_a text; v_name text; t record; n int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  -- 마구 넣어 보기 막기: 한 기기 10분에 8번, 전체 10분에 60번까지 틀릴 수 있어요
  delete from device_fails where at < now() - interval '1 day';
  select count(*) into n from device_fails where token = p_token and at > now() - interval '10 minutes';
  if n >= 8 then return jsonb_build_object('error', '잘못 넣은 횟수가 많아요. 10분 뒤에 다시 해 주세요'); end if;
  select count(*) into n from device_fails where at > now() - interval '10 minutes';
  if n >= 60 then return jsonb_build_object('error', '지금은 연결이 잠깐 막혀 있어요. 10분 뒤에 다시 해 주세요'); end if;
  delete from device_codes where created_at < now() - interval '10 minutes';
  select token into v_a from device_codes where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g') and used_at is null;
  if v_a is null then
    insert into device_fails (token) values (p_token); -- (오류로 끝내면 이 기록도 취소돼서, 오류 대신 안내를 돌려줘요)
    return jsonb_build_object('error', '코드가 맞지 않거나 10분이 지났어요');
  end if;
  update device_codes set used_at = now() where code = regexp_replace(p_code, '\D', '', 'g');
  if v_a = p_token then return jsonb_build_object('token', v_a, 'name', ''); end if;

  -- 합치기 전에: 미션 기록은 더 큰 숫자, 스케이트장 기록은 더 좋은 기록을 A에 남겨요
  if to_regclass('public.mission_log') is not null then
    update mission_log a set n = greatest(a.n, b.n) from mission_log b
      where a.token = v_a and b.token = p_token and a.day = b.day and a.kind = b.kind;
  end if;
  if to_regclass('public.rink_scores') is not null then
    update rink_scores a set score = case when a.kind = 'figure' then greatest(a.score, b.score) else least(a.score, b.score) end
      from rink_scores b where a.token = v_a and b.token = p_token and a.kind = b.kind;
  end if;
  if to_regclass('public.quiz_players') is not null then
    update quiz_players a set rounds = a.rounds + b.rounds from quiz_players b where a.token = v_a and b.token = p_token;
  end if;

  -- token 칸이 있는 표는 모두 옮겨요 (알림 구독·기기 코드·관리자 표는 빼고)
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name = 'token'
        and c.table_name not in ('device_codes', 'device_fails', 'push_subs', 'push_log', 'admin_roles', 'admin_fails')
  loop
    perform public._device_merge_table(t.table_name, v_a, p_token);
  end loop;

  if to_regclass('public.mission_log') is not null then
    select name into v_name from mission_log where token = v_a and name <> '' order by at desc limit 1;
  end if;
  return jsonb_build_object('token', v_a, 'name', coalesce(v_name, ''));
end; $$;

-- 새 기기에서 들어온 이름이 이미 기록이 있는 사람 이름인지 (안내만 해요 · 기록은 코드가 있어야 합쳐져요)
create or replace function public.name_known(p_name text, p_token text)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  if p_name is null or length(trim(p_name)) < 1 or to_regclass('public.mission_log') is null then return false; end if;
  return exists (select 1 from mission_log where name = left(trim(p_name), 12) and token <> coalesce(p_token, '') and day > current_date - 90);
end; $$;

-- 코드를 만든 기기가 3초마다 물어봐요: 'waiting'(기다리는 중) · 'used'(연결됨) · 'gone'(시간 지남)
create or replace function public.device_code_status(p_code text, p_token text)
returns text language sql security definer set search_path = public stable as $$
  select coalesce((select case when used_at is not null then 'used' else 'waiting' end from device_codes where code = p_code and token = p_token), 'gone');
$$;
-- 내 통독표 (서버에 있는 체크한 장): 기기를 연결하면 두 기기 통독표가 같아지게 들어올 때마다 받아요
create or replace function public.reading_me(p_token text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_array(book, chap)) from reading_progress where token = p_token), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end; $$;
revoke all on function public.device_code_status(text, text) from public;
revoke all on function public.reading_me(text) from public;
grant execute on function public.device_code_status(text, text) to anon, authenticated;
grant execute on function public.reading_me(text) to anon, authenticated;
revoke all on function public.device_code_make(text) from public;
revoke all on function public.device_link(text, text) from public;
revoke all on function public.name_known(text, text) from public;
grant execute on function public.device_code_make(text) to anon, authenticated;
grant execute on function public.device_link(text, text) to anon, authenticated;
grant execute on function public.name_known(text, text) to anon, authenticated;

-- 🧑 캐릭터 · 이름 (기기를 연결하면 마지막으로 바꾼 모습이 모든 기기에 똑같이)
create table if not exists public.user_profiles (
  token      text        primary key,
  profile    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;
create or replace function public.profile_save(p_token text, p_profile jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' or length(p_profile::text) > 3000 then raise exception '잘못된 요청이에요'; end if;
  insert into user_profiles (token, profile, updated_at) values (p_token, p_profile, now())
    on conflict (token) do update set profile = excluded.profile, updated_at = now();
  return true;
end; $$;
create or replace function public.profile_me(p_token text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object('profile', profile, 'at', floor(extract(epoch from updated_at) * 1000)) from user_profiles where token = p_token;
$$;
revoke all on function public.profile_save(text, jsonb) from public;
revoke all on function public.profile_me(text) from public;
grant execute on function public.profile_save(text, jsonb) to anon, authenticated;
grant execute on function public.profile_me(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ③ 🧀 주문 연락처 자동 정리: 픽업 완료(done)·취소(canceled)로 바꾼 지 30일이 지나면
--    연락처만 '(30일 지나 지움)'으로 바꿔요. 이름·수량·금액 기록은 남아요.
-- ---------------------------------------------------------------------
alter table public.cm_orders add column if not exists status_at timestamptz;
create or replace function public.order_contact_cleanup()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update cm_orders set contact = '(30일 지나 지움)', memo = ''
    where status in ('done', 'canceled') and coalesce(status_at, created_at) < now() - interval '30 days'
      and contact <> '(30일 지나 지움)';
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.order_contact_cleanup() from public, anon, authenticated;

create or replace function public.admin_order_status(p_pw text, p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_status not in ('new', 'contacted', 'done', 'canceled') then raise exception '잘못된 요청이에요'; end if;
  update cm_orders set status = p_status, status_at = now() where id = p_id;
end; $$;
-- 관리자가 주문 목록을 열 때마다 먼저 정리해요
create or replace function public.admin_orders(p_pw text)
returns table (id bigint, name text, contact text, qty_s int, qty_l int, pickup text, memo text, total int, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  perform public.order_contact_cleanup();
  return query select o.id, o.name, o.contact, o.qty_s, o.qty_l, o.pickup, o.memo, o.total, o.status, o.created_at
    from cm_orders o order by o.created_at desc limit 300;
end; $$;
revoke all on function public.admin_order_status(text, bigint, text) from public;
revoke all on function public.admin_orders(text) from public;
grant execute on function public.admin_order_status(text, bigint, text) to anon, authenticated;
grant execute on function public.admin_orders(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ② 📊 관리자 요약판 (전체 관리자만)
-- ---------------------------------------------------------------------
create or replace function public._sum_count(p_sql text)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  execute p_sql into n; return n;
exception when others then return null; -- 그 표가 아직 없으면 '-'로 보여요
end; $$;
revoke all on function public._sum_count(text) from public, anon, authenticated;

create or replace function public.admin_summary(p_pw text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  perform public.order_contact_cleanup();
  return jsonb_build_object(
    'visitors7',   public._sum_count($q$select count(distinct token) from footprints where created_at > now() - interval '7 days'$q$),
    'today',       public._sum_count($q$select count(distinct token) from footprints where (created_at at time zone 'America/New_York')::date = (now() at time zone 'America/New_York')::date$q$),
    'prayers7',    public._sum_count($q$select count(*) from footprints where kind = 'pray' and created_at > now() - interval '7 days'$q$),
    'reads7',      public._sum_count($q$select count(*) from footprints where kind = 'read' and created_at > now() - interval '7 days'$q$),
    'stamps7',     public._sum_count($q$select count(*) from mission_log where kind = 'stamp' and day > current_date - 7$q$),
    'orders_new',  public._sum_count($q$select count(*) from cm_orders where status = 'new'$q$),
    'orders_week', public._sum_count($q$select count(*) from cm_orders where created_at > now() - interval '7 days'$q$),
    'reports',     public._sum_count($q$select count(*) from guestbook where report_count > 0$q$),
    'events_next', public._sum_count($q$select count(*) from events where starts_at between now() and now() + interval '14 days'$q$),
    'members30',   public._sum_count($q$select count(distinct token) from mission_log where day > current_date - 30$q$)
  );
end; $$;
revoke all on function public.admin_summary(text) from public;
grant execute on function public.admin_summary(text) to anon, authenticated;
