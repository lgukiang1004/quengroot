-- =====================================================================
--  퀸장그루터기 온라인 교회 · 추가 설정 (2026-11-17 · 미션 · 쇼룸 · 주문)
--   1) 🎯 미션 기록 (오늘의 미션 · 연속 출석 · 배지 · 절기 스킨 · 신앙 앨범)
--   2) 🧀 치즈멜로바이트 쇼룸 (청년부가 만든 박스 수)
--   3) 🛒 치즈멜로바이트 주문 (손님 연락처는 전체 관리자만 봐요)
--   4) 🔔 주문 알림 (관리자 폰으로)
--
--  ★ supabase-setup.sql(처음 설정)과 supabase-update-community.sql을 이미 실행한 프로젝트에서,
--    이 파일 내용을 SQL Editor에 붙여넣고 Run 하면 돼요.
--    여러 번 실행해도 괜찮아요. 다른 데이터는 그대로 있어요.
--    admin_check() 함수(처음 설정에 있음)를 써요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 🎯 미션 기록: 하루(뉴욕 날짜)마다 한 일의 종류와 횟수
--    kind 예: visit(출석) · pray(기도) · read:43:3(요한복음 3장) · give(간식 나누기) · catfeed · quiz · jam · cookie
--             stamp(오늘의 미션 3개 다 함) · resolve(새해 다짐) · season:xmas:2026(절기 스킨 받음)
--    화면(anon)에서는 표를 직접 못 읽고, 함수로 "내 기록"만 받아요.
-- ---------------------------------------------------------------------
create table if not exists public.mission_log (
  token text        not null,
  day   date        not null,
  kind  text        not null,
  n     int         not null default 1,
  name  text        not null default '',
  note  text,
  at    timestamptz not null default now(),
  primary key (token, day, kind)
);
create index if not exists mission_log_day_idx on public.mission_log (day);
alter table public.mission_log enable row level security;
revoke all on public.mission_log from anon, authenticated;

create or replace function public.mission_add(p_token text, p_name text, p_kind text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'America/New_York')::date;
  cap int; cur_n int; cur_at timestamptz; kinds int;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if p_kind is null or p_kind !~ '^(visit|pray|give|catfeed|quiz|jam|cookie|stamp|resolve|read:[0-9]{1,2}:[0-9]{1,3}|season:[a-z]{2,12}:[0-9]{4})$' then
    raise exception '잘못된 요청이에요';
  end if;
  cap := case
    when p_kind in ('visit', 'stamp', 'resolve', 'jam') or p_kind like 'read:%' or p_kind like 'season:%' then 1
    when p_kind = 'pray' then 20
    else 30 end;
  select count(*) into kinds from mission_log where token = p_token and day = d;
  if kinds > 300 then raise exception '오늘은 기록이 너무 많아요. 내일 다시 해 주세요'; end if;
  select n, at into cur_n, cur_at from mission_log where token = p_token and day = d and kind = p_kind;
  if found then
    if cur_n >= cap then return cur_n; end if;
    if cur_at > now() - interval '5 seconds' then return cur_n; end if; -- 너무 빠른 반복은 한 번으로
    update mission_log set n = n + 1, at = now(), name = left(coalesce(trim(p_name), ''), 12),
      note = coalesce(left(nullif(trim(p_note), ''), 80), note)
      where token = p_token and day = d and kind = p_kind returning n into cur_n;
    return cur_n;
  end if;
  insert into mission_log (token, day, kind, n, name, note)
    values (p_token, d, p_kind, 1, left(coalesce(trim(p_name), ''), 12), left(nullif(trim(p_note), ''), 80));
  return 1;
end; $$;

-- 내 기록 한꺼번에: { log: [[날짜, 종류, 횟수], ...], books: [[책, 읽은 장 수, 마지막으로 읽은 때], ...], resolve: "새해 다짐" }
create or replace function public.mission_me(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare lg jsonb; bk jsonb := '[]'::jsonb; rs text;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  select coalesce(jsonb_agg(jsonb_build_array(day, kind, n)), '[]'::jsonb) into lg
    from mission_log where token = p_token and day > current_date - 800;
  select note into rs from mission_log where token = p_token and kind = 'resolve' order by day desc limit 1;
  begin -- 통독 기록(supabase-update-community.sql)이 없으면 그냥 빈 목록
    select coalesce(jsonb_agg(jsonb_build_array(book, cnt, last)), '[]'::jsonb) into bk
      from (select book, count(*) as cnt, max(read_at) as last from reading_progress where token = p_token group by book) b;
  exception when undefined_table then bk := '[]'::jsonb;
  end;
  return jsonb_build_object('log', lg, 'books', bk, 'resolve', rs);
end; $$;

revoke all on function public.mission_add(text, text, text, text) from public;
revoke all on function public.mission_me(text) from public;
grant execute on function public.mission_add(text, text, text, text) to anon, authenticated;
grant execute on function public.mission_me(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) 🧀 쇼룸: 청년부가 게임에서 만든 박스 수 (누구나 읽고, 함수로만 올려요)
-- ---------------------------------------------------------------------
create table if not exists public.showroom_counter (
  id    int primary key default 1 check (id = 1),
  boxes bigint not null default 0
);
insert into public.showroom_counter (id, boxes) values (1, 0) on conflict do nothing;
create table if not exists public.cookie_log (
  token text        not null,
  at    timestamptz not null default now()
);
create index if not exists cookie_log_tok_idx on public.cookie_log (token, at);
alter table public.showroom_counter enable row level security;
alter table public.cookie_log enable row level security;
revoke all on public.showroom_counter from anon, authenticated;
revoke all on public.cookie_log from anon, authenticated;
grant select on public.showroom_counter to anon, authenticated;
drop policy if exists showroom_counter_read on public.showroom_counter;
create policy showroom_counter_read on public.showroom_counter for select to anon, authenticated using (true);

create or replace function public.cookie_make(p_token text)
returns bigint language plpgsql security definer set search_path = public as $$
declare b bigint;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if exists (select 1 from cookie_log where token = p_token and at > now() - interval '15 seconds') then
    raise exception '방금 한 박스 만들었어요! 조금 쉬었다가 만들어요 🧀';
  end if;
  if (select count(*) from cookie_log where token = p_token and at > now() - interval '1 hour') >= 40 then
    raise exception '오늘 정말 많이 만들었어요! 조금 있다가 다시 해요 🧀';
  end if;
  insert into cookie_log (token) values (p_token);
  delete from cookie_log where at < now() - interval '2 days';
  update showroom_counter set boxes = boxes + 1 where id = 1 returning boxes into b;
  return b;
end; $$;
revoke all on function public.cookie_make(text) from public;
grant execute on function public.cookie_make(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) 🛒 치즈멜로바이트 주문
--    200g 한 박스 $8 · 450g 한 박스 $15 (가격을 바꾸면 아래 order_add 안의 8, 15와 app.js CM_PRICE를 같이 바꿔요)
--    손님 이름·연락처는 화면(anon)에서 절대 못 읽어요. 전체 관리자 비밀번호로만 봐요.
-- ---------------------------------------------------------------------
create table if not exists public.cm_orders (
  id         bigserial primary key,
  token      text        not null,
  name       text        not null,
  contact    text        not null,
  qty_s      int         not null default 0 check (qty_s between 0 and 30),
  qty_l      int         not null default 0 check (qty_l between 0 and 30),
  pickup     text        not null default 'church' check (pickup in ('church', 'contact')),
  memo       text        not null default '',
  total      int         not null default 0,
  status     text        not null default 'new' check (status in ('new', 'contacted', 'done', 'canceled')),
  notified   boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cm_orders_created_idx on public.cm_orders (created_at);
alter table public.cm_orders enable row level security;
revoke all on public.cm_orders from anon, authenticated;

create or replace function public.order_add(p_token text, p_name text, p_contact text, p_s int, p_l int, p_pickup text, p_memo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare oid bigint; nm text := left(coalesce(trim(p_name), ''), 20); ct text := left(coalesce(trim(p_contact), ''), 60);
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 64 then raise exception '잘못된 요청이에요'; end if;
  if length(nm) < 1 then raise exception '이름을 적어 주세요'; end if;
  if length(ct) < 3 then raise exception '연락받을 전화번호나 카톡 아이디를 적어 주세요'; end if;
  if coalesce(p_s, 0) < 0 or coalesce(p_l, 0) < 0 or coalesce(p_s, 0) > 30 or coalesce(p_l, 0) > 30 then raise exception '수량을 확인해 주세요'; end if;
  if coalesce(p_s, 0) + coalesce(p_l, 0) < 1 then raise exception '한 박스 이상 골라 주세요'; end if;
  if (select count(*) from cm_orders where token = p_token and created_at > now() - interval '1 hour') >= 3 then
    raise exception '주문이 이미 들어갔어요. 더 필요하면 연락드릴 때 말씀해 주세요 🙂';
  end if;
  if (select count(*) from cm_orders where created_at > now() - interval '1 hour') >= 40 then
    raise exception '지금 주문이 많아요. 조금 있다가 다시 해 주세요';
  end if;
  insert into cm_orders (token, name, contact, qty_s, qty_l, pickup, memo, total)
    values (p_token, nm, ct, coalesce(p_s, 0), coalesce(p_l, 0),
            case when p_pickup = 'contact' then 'contact' else 'church' end,
            left(coalesce(trim(p_memo), ''), 200), coalesce(p_s, 0) * 8 + coalesce(p_l, 0) * 15)
    returning id into oid;
  return oid;
end; $$;

create or replace function public.admin_orders(p_pw text)
returns table (id bigint, name text, contact text, qty_s int, qty_l int, pickup text, memo text, total int, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  return query select o.id, o.name, o.contact, o.qty_s, o.qty_l, o.pickup, o.memo, o.total, o.status, o.created_at
    from cm_orders o order by o.created_at desc limit 300;
end; $$;
create or replace function public.admin_order_status(p_pw text, p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_status not in ('new', 'contacted', 'done', 'canceled') then raise exception '잘못된 요청이에요'; end if;
  update cm_orders set status = p_status where id = p_id;
end; $$;
create or replace function public.admin_order_delete(p_pw text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  delete from cm_orders where id = p_id;
end; $$;
revoke all on function public.order_add(text, text, text, int, int, text, text) from public;
revoke all on function public.admin_orders(text) from public;
revoke all on function public.admin_order_status(text, bigint, text) from public;
revoke all on function public.admin_order_delete(text, bigint) from public;
grant execute on function public.order_add(text, text, text, int, int, text, text) to anon, authenticated;
grant execute on function public.admin_orders(text) to anon, authenticated;
grant execute on function public.admin_order_status(text, bigint, text) to anon, authenticated;
grant execute on function public.admin_order_delete(text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) 🔔 주문 알림: 관리자가 "이 폰으로 주문 알림 받기"를 켠 기기에만 보내요
--    (알림 함수 notify가 새 주문 번호를 받으면, 아직 안 알린 새 주문일 때만 한 번 보내요)
-- ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.push_subs') is not null then
    alter table public.push_subs add column if not exists wants_order boolean not null default false;
  end if;
end $$;

create or replace function public.push_order_set(p_pw text, p_endpoint text, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if not public.admin_check(p_pw) then raise exception '관리자 비밀번호가 틀렸어요'; end if;
  if p_endpoint is not null and p_on is not null then
    update push_subs set wants_order = p_on where endpoint = p_endpoint;
    if p_on and not found then raise exception '먼저 🔔 알림을 이 기기에서 켜 주세요'; end if;
  end if;
  select count(*) into c from push_subs where wants_order;
  return c;
end; $$;
revoke all on function public.push_order_set(text, text, boolean) from public;
grant execute on function public.push_order_set(text, text, boolean) to anon, authenticated;

create or replace function public.order_notify_gate(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r cm_orders%rowtype;
begin
  update cm_orders set notified = true
    where id = p_id and not notified and created_at > now() - interval '15 minutes'
    returning * into r;
  if not found then return null; end if;
  return jsonb_build_object('name', r.name, 'qty_s', r.qty_s, 'qty_l', r.qty_l, 'total', r.total, 'pickup', r.pickup);
end; $$;
revoke all on function public.order_notify_gate(bigint) from public, anon, authenticated;
grant execute on function public.order_notify_gate(bigint) to service_role;

-- 바뀐 함수 목록을 Supabase(API)가 바로 다시 읽어 오게 해요
notify pgrst, 'reload schema';
