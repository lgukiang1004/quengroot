// =====================================================================
//  퀸장그루터기 · 알림 보내는 함수 (Supabase Edge Function 이름: notify)
//  - type "visit": 누가 들어오면 → 알림 켠 사람들에게 (전체 15분에 한 번, 같은 사람 3시간에 한 번)
//  - type "event": 관리자가 모임을 올리면 → 모임 알림 켠 사람들에게 (관리자 비밀번호 확인)
//  - type "order": 🧀 치즈멜로바이트 새 주문 → "주문 알림 받기"를 켠 관리자 기기에만 (2026-11-17 추가)
//                  새 주문 번호를 받아서 서버(order_notify_gate)가 '15분 안에 들어온, 아직 안 알린 주문'일 때만 한 번 보내요
//  - type "listen": 🎶 청음회 30분 전 → 모임 알림 켠 사람들에게 (2026-11-20 추가)
//                  누구나 부를 수 있지만 서버(listen_notify_gate)가 '15~40분 뒤 시작, 아직 안 알린 청음회'일 때만 한 번 보내요
//  필요한 비밀 값(Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
//  (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 줘요)
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    webpush.setVapidDetails("mailto:" + (Deno.env.get("VAPID_EMAIL") || "youth@example.com"), Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
    const b = await req.json();
    let title = "", body = "", col = "", exclude = "", tag = "";
    if (b.type === "visit") {
      const tok = clip(b.token, 64);
      if (tok.length < 8) return json({ error: "bad request" }, 400);
      const { data: ok, error } = await sb.rpc("push_visit_gate", { p_token: tok });
      if (error) return json({ error: error.message }, 500);
      if (!ok) return json({ sent: 0, skipped: true });
      title = "🌱 그루터기에 친구가 왔어요";
      body = `${clip(b.name, 12) || "누군가"}님이 ${clip(b.room, 12) || "마당"}에 들어왔어요. 같이 놀아요!`;
      col = "wants_visit"; exclude = tok; tag = "visit";
    } else if (b.type === "event") {
      const { data: isAdmin } = await sb.rpc("admin_check", { p_pw: clip(b.pw, 200) });
      if (!isAdmin) return json({ error: "관리자 비밀번호가 틀렸어요" }, 403);
      title = `📅 새 모임: ${clip(b.title, 60)}`;
      body = clip(b.body, 140) || "그루터기에서 만나요!";
      col = "wants_event"; tag = "event";
    } else if (b.type === "order") {
      const id = Number(b.id);
      if (!Number.isInteger(id) || id < 1) return json({ error: "bad request" }, 400);
      const { data: o, error } = await sb.rpc("order_notify_gate", { p_id: id });
      if (error) return json({ error: error.message }, 500);
      if (!o) return json({ sent: 0, skipped: true });
      const parts = [o.qty_s ? `200g ${o.qty_s}박스` : "", o.qty_l ? `450g ${o.qty_l}박스` : ""].filter(Boolean).join(" · ");
      title = "🧀 치즈멜로바이트 새 주문!";
      body = `${clip(o.name, 20)}님 · ${parts} · $${o.total} · ${o.pickup === "contact" ? "연락해서 정하기" : "주일 교회 픽업"}`;
      col = "wants_order"; tag = "order-" + id;
    } else if (b.type === "listen") {
      const { data: rows, error } = await sb.rpc("listen_notify_gate");
      if (error) return json({ error: error.message }, 500);
      const e = Array.isArray(rows) ? rows[0] : rows;
      if (!e) return json({ sent: 0, skipped: true });
      const t = new Date(e.estart).toLocaleTimeString("ko-KR", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
      title = `🎶 ${clip(e.etitle, 40)} · 30분 뒤 시작`;
      body = `오늘 ${t} 마당 잔디밭에서 찬양 ${e.n}곡을 함께 들어요. 간식 챙겨 오세요 🍡`;
      col = "wants_event"; tag = "listen-" + e.eid;
    } else return json({ error: "bad request" }, 400);

    const { data: subs, error: e2 } = await sb.from("push_subs").select("endpoint, sub, token").eq(col, true).limit(2000);
    if (e2) return json({ error: e2.message }, 500);
    const payload = JSON.stringify({ title, body, tag, url: "./" });
    let sent = 0;
    await Promise.all((subs || []).filter((s) => s.token !== exclude).map(async (s) => {
      try { await webpush.sendNotification(s.sub, payload, { TTL: 3600 }); sent++; }
      catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        console.warn("push 실패", code, String((err as Error).message || err).slice(0, 200));
        if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint); // 구독이 끝난 기기는 정리
      }
    }));
    return json({ sent });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
