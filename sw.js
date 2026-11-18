/* 퀸장그루터기 · 서비스워커 (홈 화면 앱용)
   - 사이트 파일은 인터넷 먼저 → 넷리파이에 새로 올리면 바로 새 버전, 인터넷이 없을 때만 저장된 것
   - 성경 본문(bible/*.json)은 한 번 읽으면 폰에 저장 → 인터넷이 약해도 열려요
   - Supabase(실시간·글쓰기)는 저장하지 않고 항상 인터넷으로
   - 음원 파일(mp3 등)은 저장하지 않아요 (용량이 커서) */
const VERSION = "qpc-2026-11-18l";
const SHELL = ["./", "index.html", "style.css", "app.js", "world.js", "jam-audio.js", "data.js", "verses.js", "quiz-bank.js", "config.js", "lib/three.min.js", "christmas-reason-cover.jpg", "cheese-mellow-poster.jpg", "ad-banner.jpg",
  "manifest.webmanifest", "icons/icon-192.png", "icons/logo-160.png", "icons/favicon-64.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "qpc-bible").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (/supabase\.(co|in)/.test(url.hostname)) return; // 실시간·데이터는 항상 인터넷
  if (/\.(mp3|m4a|wav)$/i.test(url.pathname)) return; // 음원은 브라우저가 알아서 조금씩 받아요 (저장 안 함)
  // 성경 본문: 저장된 것 먼저
  if (url.origin === location.origin && url.pathname.includes("/bible/")) {
    e.respondWith(caches.open("qpc-bible").then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  // 우리 사이트 파일: 인터넷 먼저 (새로 올린 버전이 바로 보이게), 안 되면 저장된 것
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? c.match("index.html") : Response.error());
      }
    }));
    return;
  }
  // 바깥 파일 (글꼴, supabase-js): 저장된 것 먼저, 뒤에서 새로 받아두기
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

// 🔔 알림 (Supabase 알림 함수 'notify'가 보내요): 누가 들어왔어요 / 새 모임
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "퀸장그루터기", {
    body: d.body || "", icon: "icons/icon-192.png", badge: "icons/favicon-64.png", tag: d.tag || "qpc", renotify: true, data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) return c.focus();
    return self.clients.openWindow(url);
  }));
});
