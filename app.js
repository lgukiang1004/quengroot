(() => {
"use strict";

const CFG = window.APP_CONFIG || {};
const VERSES = window.VERSES || [];
const BOOKS = window.BOOKS || [];
const W = window.World;
const LIMIT = { bubble: 80, status: 60, wall: 200, name: 12 };
// 코드 안의 방 이름: yard = 마당, worship = 본당(기도하는 공간), cafe = 성경 읽는 공간, vision = 비전, room301 = 301호, praise = 찬양팀 연습실(리빙리버)
const ROOMS = ["yard", "worship", "cafe", "vision", "room301", "praise", "showroom"]; // showroom = 🧀 치즈멜로바이트 쇼룸 (마당에서 문으로 들어가요, 위쪽 탭은 없음)
const ROOM_NAME = { yard: "마당", worship: "본당", cafe: "성경 읽는 공간", vision: "비전", room301: "301호 · 3Q", praise: "찬양팀 연습실", showroom: "치즈멜로 쇼룸" };
const SITE_TITLE = CFG.siteTitle || "퀸장그루터기";

/* ================= 유틸 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem("oc_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("oc_" + k, JSON.stringify(v)); } catch {} },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id" + Math.random().toString(36).slice(2) + Date.now().toString(36));
const token = store.get("token") || (() => { const t = uuid(); store.set("token", t); return t; })();
const myId = uuid();
const clip = (s, n) => String(s ?? "").slice(0, n);

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return Math.floor(s / 60) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "일 전";
  return new Date(iso).toLocaleDateString("ko-KR");
}
// 날짜는 교회가 있는 뉴욕 시간 기준으로 맞춰요 (모두가 같은 날 같은 말씀을 보도록)
const TZ = "America/New_York";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const nyDay = (d = new Date()) => dayFmt.format(d);
const isToday = (iso) => nyDay(new Date(iso)) === nyDay();
const clockTime = (iso) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
// 이번 주 월요일 0시 (뉴욕 시간) — 퀴즈 '이번 주 랭킹'용
function weekStartNY() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return Date.now() - back * 86400e3 - ((+p.hour % 24) * 60 + +p.minute) * 60e3;
}
const QUIZ_PTS = { easy: 1, fun: 1, mid: 2, high: 3 };
const dayLabel = (iso) => { const d = nyDay(new Date(iso)); if (d === nyDay()) return "오늘"; if (d === nyDay(new Date(Date.now() - 86400e3))) return "어제"; return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" }); };

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}
const BAD_WORDS = ["시발", "씨발", "씨바", "시바새", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "븅신", "개새", "좆", "존나", "졸라", "지랄", "ㅈㄹ",
  "미친놈", "미친년", "니미", "느금", "엠창", "fuck", "shit", "bitch"];
function hasBadWord(s) { const t = String(s).toLowerCase().replace(/[\s.\-_*~!@#^0-9]/g, ""); return BAD_WORDS.some((w) => t.includes(w)); }
function checkText(s) { if (hasBadWord(s)) { toast("따뜻한 말로 바꿔서 다시 적어주세요 🙂"); return false; } return true; }

/* ================= 데모 백엔드 ================= */
const L = W.LOOK;
const DEMO_BOTS = {
  yard: [
    { name: "사무엘", color: "#85b8a0", hair: "short", hairColor: "#2b2220", glasses: "sun", gender: "m", bubble: "구름 구경 중 ☁️", pos: { x: -10.5, z: 6.2 }, ground: true },
    { name: "은혜", color: "#85b8a0", hair: "long", hairColor: "#2b2220", glasses: "none", gender: "f", item: "coffee", wear: "scarf", bubble: "주일 예배 기다리는 중 ☺️", pos: { x: -6, z: 4 } },
    { name: "다니엘", color: "#8fa8d6", hair: "short", hairColor: "#5a3a26", glasses: "square", gender: "m", item: "guitar", bubble: "", seat: "B0-1" },
    { name: "소망", color: "#d69ac2", hair: "bun", hairColor: "#2b2220", glasses: "round", gender: "f", wear: "santa", bubble: "트리 너무 예뻐요 🎄", seat: "B0-0" },
    { name: "요한", color: "#e6c86e", hair: "curly", hairColor: "#9a6a3a", glasses: "none", gender: "m", item: "tambourine", wear: "antlers", bubble: "", pos: { x: 6, z: 8 } },
  ],
  worship: [
    { name: "은혜", color: "#85b8a0", hair: "long", hairColor: "#2b2220", glasses: "none", gender: "f", bubble: "엄마 수술이 잘 끝나도록 기도해주세요", praying: true, seat: "PL1-3" },
    { name: "", color: "#8fa8d6", hair: "short", hairColor: "#2b2220", glasses: "square", bubble: "취업 준비 중인데 지치지 않게 해주세요", seat: "PR2-1" },
    { name: "다니엘", color: "#e6c86e", hair: "short", hairColor: "#5a3a26", glasses: "none", gender: "m", item: "bible", bubble: "", praying: true, pos: { x: -2.2, z: -8.6 } },
    { name: "소망", color: "#d69ac2", hair: "bob", hairColor: "#9a6a3a", glasses: "round", gender: "f", bubble: "이번 주 감사한 일이 많았어요. 감사기도 드려요", seat: "PL4-2" },
    { name: "요한", color: "#7fb3c9", hair: "curly", hairColor: "#2b2220", glasses: "none", gender: "m", wear: "scarf", bubble: "", seat: "PR5-4" },
  ],
  vision: [
    { name: "요셉", color: "#7fb3c9", hair: "short", hairColor: "#2b2220", glasses: "round", gender: "m", wear: "beanie", bubble: "다음 주 소그룹 모임 여기서 해요!", seat: "VT1-0" },
    { name: "은혜", color: "#85b8a0", hair: "long", hairColor: "#2b2220", glasses: "none", gender: "f", item: "coffee", bubble: "", seat: "VT1-3" },
    { name: "다니엘", color: "#8fa8d6", hair: "short", hairColor: "#5a3a26", glasses: "square", gender: "m", item: "guitar", wear: "santa", bubble: "보드게임 하실 분 🎲", seat: "VB0-1" },
  ],
  room301: [
    { name: "소망", color: "#d69ac2", hair: "bun", hairColor: "#2b2220", glasses: "round", gender: "f", item: "coffee", wear: "scarf", bubble: "여기 너무 아늑해요 ☕", seat: "SA-0" },
    { name: "요한", color: "#e6c86e", hair: "curly", hairColor: "#9a6a3a", glasses: "none", gender: "m", wear: "beanie", bubble: "", seat: "SB-0", lying: true },
    { name: "하늘", color: "#b39ddb", hair: "pony", hairColor: "#2b2220", glasses: "none", gender: "f", wear: "beanie", bubble: "방명록 썼어요 📝", seat: "C-0" },
  ],
  praise: [
    { name: "은혜", color: "#85b8a0", hair: "long", hairColor: "#2b2220", glasses: "none", gender: "f", bubble: "주일 콘티 키 G로 맞춰요 🎹", seat: "WK-0" },
    { name: "다니엘", color: "#8fa8d6", hair: "short", hairColor: "#5a3a26", glasses: "square", gender: "m", wear: "beanie", bubble: "베이스 줄 갈았어요 🎸", seat: "WB" },
    { name: "하늘", color: "#b39ddb", hair: "bobperm", hairColor: "#2b2220", glasses: "none", gender: "f", bubble: "화음 연습 같이 해요 🎶", seat: "WS-1" },
    { name: "미라", color: "#f08a8a", hair: "pony", hairColor: "#5a3a26", glasses: "none", gender: "f", bubble: "율동 연습 중이에요 🙌", pos: { x: 3.2, z: 2.6 }, dance: { k: "praise", t0: Date.now(), bpm: 112 } },
    { name: "요셉", color: "#7fb3c9", hair: "short", hairColor: "#2b2220", glasses: "round", gender: "m", item: "coffee", bubble: "💿 '나의 길' 듣는 중", seat: "PC-1" },
  ],
  cafe: [
    { name: "하늘", color: "#b39ddb", hair: "pony", hairColor: "#2b2220", glasses: "none", gender: "f", item: "bible", bubble: "📖 시편 23장 · 여호와는 나의 목자시니", seat: "T0-0" },
    { name: "요셉", color: "#7fb3c9", hair: "short", hairColor: "#2b2220", glasses: "round", gender: "m", item: "coffee", bubble: "📖 요한복음 15장", seat: "T1-3" },
    { name: "", color: "#f08a8a", hair: "bob", hairColor: "#d9b46a", glasses: "none", gender: "f", item: "bible", bubble: "퇴근하고 조용히 말씀 읽는 중 ☕", seat: "S-1" },
    { name: "마리아", color: "#e8a87c", hair: "long", hairColor: "#5a3a26", glasses: "square", gender: "f", item: "coffee", bubble: "", pos: { x: 5.6, z: -1.5 } },
  ],
};
DEMO_BOTS.showroom = [
  { name: "은혜", color: "#85b8a0", hair: "long", hairColor: "#2b2220", glasses: "none", gender: "f", bubble: "치즈 모형 너무 귀여워요 🧀", pos: { x: -1.8, z: 2.4 } },
  { name: "요셉", color: "#7fb3c9", hair: "short", hairColor: "#2b2220", glasses: "round", gender: "m", apron: "cheese", bubble: "🧀 쫀득쿠키 만드는 중!", seat: "CM-1" },
];
const DEMO_WALK = {
  showroom: [{ pos: { x: -4.4, z: -1.0 } }, { pos: { x: -2.0, z: 2.6 } }, { pos: { x: 1.8, z: 2.6 } }],
  yard: [{ pos: { x: -3, z: 1 } }, { pos: { x: 8.5, z: 3 } }, { sled: 1 }, { seat: "B2-0" }, { pos: { x: -12, z: 9 } }],
  worship: [{ seat: "PR0-0" }, { pos: { x: 2.5, z: -8.6 }, praying: true }, { seat: "PL7-5" }, { pos: { x: -8, z: 9 } }],
  cafe: [{ seat: "A-0" }, { pos: { x: -2, z: 3.5 } }, { seat: "T4-2" }, { pos: { x: 5.5, z: -2 } }],
  vision: [{ seat: "VB0-0" }, { pos: { x: -3, z: 1.5 } }, { seat: "VT0-2" }, { pos: { x: 4, z: 2.5 } }],
  room301: [{ seat: "C-1" }, { pos: { x: 0.5, z: 1.5 } }, { pos: { x: -2.6, z: 0.6 } }, { pos: { x: 2.2, z: 2.6 } }],
  praise: [{ seat: "PC-2" }, { pos: { x: 1.2, z: 2.2 } }, { seat: "WS-3" }, { pos: { x: -3, z: 3.2 } }],
};
// 데모용 추천 찬양
const DEMO_RECS = [
  [40, "하늘", "주 이름 찬양해", "", "출근길에 듣고 하루를 시작해요 ☀️", 5],
  [300, "요셉", "선하신 목자", "리빙리버", "우리 찬양팀 버전 최고 👍", 8],
  [1500, "", "내 평생에 가는 길", "", "힘들 때 늘 붙잡는 찬양이에요", 3],
  [3200, "은혜", "기쁨으로 드리기 원하네", "리빙리버", "헌금 시간에 같이 불러요 🙌", 2],
];
const DEMO_FROM = ["은혜", "소망", "하늘", "요셉", "누군가"];
// 데모용 발자취 (지금 시각 기준 몇 분/시간 전)
const DEMO_FOOT = [
  [12, "다니엘", "#8fa8d6", "yard", "visit"],
  [40, "은혜", "#85b8a0", "worship", "pray", { seat: "PL1-3" }],
  [55, "요한", "#7fb3c9", "worship", "visit"],
  [120, "소망", "#d69ac2", "worship", "pray", { seat: "PL4-2" }],
  [180, "", "#8fa8d6", "worship", "pray", { seat: "PR2-1" }],
  [25, "하늘", "#b39ddb", "cafe", "read", { book: 19, chap: 23, seat: "T0-0" }],
  [65, "요셉", "#7fb3c9", "cafe", "read", { book: 43, chap: 15, seat: "T1-3" }],
  [300, "마리아", "#e8a87c", "cafe", "read", { book: 45, chap: 8, seat: "S-1" }],
  [1560, "은혜", "#85b8a0", "cafe", "read", { book: 1, chap: 1, seat: "T2-4" }],
  [1600, "다니엘", "#e6c86e", "worship", "pray", { seat: "PR3-2" }],
  [2900, "소망", "#d69ac2", "cafe", "read", { book: 43, chap: 15, seat: "T3-1" }],
  [30, "소망", "#d69ac2", "room301", "visit"],
  [90, "요셉", "#7fb3c9", "vision", "visit"],
];
const DEMO_GB = {
  room301: [
    [20, "하늘", "301호 소파 최고… 다음 주에 또 올게요 🛋"],
    [180, "요한", "수련회 준비팀 화이팅! 기도할게요 🙏"],
    [1500, "", "오늘 처음 와봤어요. 반가워요 😊"],
    [3000, "은혜", "그루터기 모여라~ 🌱"],
  ],
  vision: [
    [45, "요셉", "소그룹 모임 너무 좋았어요! 다음 주에도 여기서 🙌"],
    [400, "다니엘", "보드게임 한 판 하실 분 구해요 🎲"],
    [2600, "", "비전실 창가 벤치 자리 최고 ☀️"],
  ],
};
// 방명록·이번주 공지가 있는 방
const GB_ROOMS = ["vision", "room301"];
// 공지: all = 전체(마당) · room301 = 청년 1부 · vision = 청년 2부
const DEMO_NOTICES = [
  [60, "vision", "이번 주 금요일 저녁 7:30 비전실에서 2부 소그룹 모임이 있어요 🙌"],
  [300, "room301", "3Q 간식 채워놨어요! 드신 자리는 정리 부탁해요 🍪"],
  [1440, "all", "성탄 발표회 연습 · 주일 오후 2시 본당 🎄"],
];
// 데모 찬양팀 곡 (예수의 길 · 코드만)
const DEMO_SONGS = [{ id: 1, title: "예수의 길", artist: "HYSSOP(히솝)", key_root: 4, bpm: 64, sig: "4/4", youtube: "", set_no: 1,
  chords: "V: A2 | E/G# | F#m7 Bsus4 | E2 | E/G# | A2 | E/G# | F#m7 Bsus4 | E2\nPC: E/G# | A2 | E/G# | F#m7 Bsus4 | E2 Bm | E7 | A2 | E/G# C#m7 | F#m7 | Bsus4 B\nC: A/B | E2 | G#m7 | A2 | E/G# | F#m7 Bsus4 | E2 B/D# C#m7 | F#sus4 F#7 | Bsus4 B\nC2: A/B | E2 | G#m7 | A2 | E/G# | F#m7 Bsus4 | E2 B/D# C#m7 | F#m7 Bsus4 | E2" }];
const GRP_NAME = { g1: "청년 1부", g2: "청년 2부", all: "청년부 전체" };
const ROLE_NAME = { all: "전체 관리자", g1: "청년 1부 관리자", praise: "찬양팀" };

class DemoBackend {
  constructor() { this.demo = true; }
  joinRoom(room, me, hd) {
    this.leaveRoom();
    this.hd = hd; this.me = { ...me };
    const now = Date.now();
    this.bots = /[?&]nobots/.test(location.search) ? [] : DEMO_BOTS[room].map((b, i) => ({ ...b, id: `bot-${room}-${i}`, joinedAt: now - 100000 * (5 - i), amens: Math.floor(Math.random() * 4) }));
    setTimeout(() => { this.emit(); hd.onStatus && hd.onStatus("ok"); }, 60);
    // 데모 모드에서도 같은 컴퓨터의 다른 탭끼리는 서로 보이고 같이 놀 수 있어요 (운동장 시험용)
    this.tabs = new Map();
    if (window.BroadcastChannel) {
      this.bc = new BroadcastChannel("qpc-demo-" + room);
      this.bc.onmessage = ({ data }) => {
        if (!data || !this.hd) return;
        if (data.t === "me" && data.me && data.me.id !== myId) { this.tabs.set(data.me.id, { me: data.me, at: Date.now() }); this.emit(); }
        else if (data.t === "bye") { this.tabs.delete(data.id); this.emit(); }
        else if (data.t === "sport") this.hd.onSport && this.hd.onSport(data.p);
        else if (data.t === "jam") this.hd.onJam && this.hd.onJam(data.p);
        else if (data.t === "react") this.hd.onReact(data.p);
        else if (data.t === "give") this.hd.onGive && this.hd.onGive(data.p);
      };
      this.bc.postMessage({ t: "me", me: this.me });
      this.beat = setInterval(() => {
        this.bc && this.bc.postMessage({ t: "me", me: this.me });
        const now = Date.now(); let gone = false; for (const [id, v] of this.tabs) if (now - v.at > 7000) { this.tabs.delete(id); gone = true; } if (gone) this.emit();
      }, 2000);
    }
    this.timer = setInterval(() => {
      const all = this.list().filter((p) => p.bubble); if (!all.length) return;
      const target = Math.random() < 0.45 && this.me.bubble ? this.me : all[Math.floor(Math.random() * all.length)];
      this.hd.onReact({ target: target.id, from: DEMO_FROM[Math.floor(Math.random() * DEMO_FROM.length)] });
    }, 8000);
    let n = 0;
    this.walker = setInterval(() => {
      const b = this.bots[this.bots.length - 1], sp = DEMO_WALK[room][n++ % DEMO_WALK[room].length];
      if (!b) return; // (?nobots 로 열면 가상 친구 없이 시험)
      if (sp.sled) { b.sled = { n: Date.now(), lane: 1 }; b.seat = null; b.pos = W.sledEnd(1); this.emit(); return; }
      b.seat = sp.seat || null; b.pos = sp.pos || null; b.praying = !!sp.praying;
      this.emit();
    }, 6500);
  }
  list() { return [...this.bots, ...[...(this.tabs || new Map()).values()].map((v) => v.me), this.me]; }
  emit() { this.hd && this.hd.onPeers(this.list()); }
  update(me) { this.me = { ...me }; this.emit(); this.bc && this.bc.postMessage({ t: "me", me: this.me }); }
  sendReact(target, from) { const b = this.bots && this.bots.find((x) => x.id === target); if (b) { b.amens = (b.amens || 0) + 1; this.emit(); } else this.bc && this.bc.postMessage({ t: "react", p: { target, from } }); }
  sendSport(p) { this.bc && this.bc.postMessage({ t: "sport", p }); }
  sendJam(p) { this.bc && this.bc.postMessage({ t: "jam", p }); }
  // 추천 찬양 (데모)
  _recs() { const saved = store.get("demo_recs", null); if (saved) return saved; const t = Date.now(); return DEMO_RECS.map(([min, name, title, artist, note, likes], i) => ({ id: DEMO_RECS.length - i, name, title, artist, note, link: "", like_count: likes, created_at: new Date(t - min * 60e3).toISOString() })); }
  async listRecs() { return this._recs(); }
  async addRec(r) { const l = this._recs(); const id = Math.max(0, ...l.map((x) => x.id)) + 1; l.unshift({ id, ...r, like_count: 0, created_at: new Date().toISOString() }); store.set("demo_recs", l); return id; }
  async likeRec(id) { const l = this._recs(), x = l.find((y) => y.id === id); if (x) x.like_count++; store.set("demo_recs", l); return x ? x.like_count : 0; }
  async reportRec() {}
  async deleteMyRec(id) { store.set("demo_recs", this._recs().filter((x) => x.id !== id)); }
  async adminDeleteRec(pw, id) { this._admin(pw); store.set("demo_recs", this._recs().filter((x) => x.id !== id)); }
  // 데모: 가상 친구에게 간식을 주면 "고마워요!" 하고 조금 있다 먹어요
  sendGive(target, from, kind) {
    const b = this.bots && this.bots.find((x) => x.id === target); if (!b) { this.bc && this.bc.postMessage({ t: "give", p: { target, from, kind } }); return; }
    const old = b.bubble; b.carry = kind; b.bubble = "고마워요! 잘 먹을게요 😋"; this.emit();
    setTimeout(() => { b.eatN = (b.eatN || 0) + 1; b.carry = null; this.emit(); }, 3500);
    setTimeout(() => { b.bubble = old; this.emit(); }, 6000);
  }
  // 고양이 밥 (데모)
  _cf() { const saved = store.get("demo_catfeeds", null); if (saved) return saved; const now = Date.now(); return [{ id: 2, name: "은혜", kind: "churu", created_at: new Date(now - 50 * 60e3).toISOString() }, { id: 1, name: "요셉", kind: "dry", created_at: new Date(now - 4 * 3600e3).toISOString() }]; }
  async listCatFeeds() { return this._cf(); }
  async feedCat(kind, name) { const l = this._cf(); const last = l[0]; if (last && Date.now() - new Date(last.created_at) < 20000 && last.mine) throw new Error("방금 줬어요! 고양이들이 먹는 중이에요 🐾"); l.unshift({ id: Math.max(0, ...l.map((x) => x.id)) + 1, name, kind, mine: true, created_at: new Date().toISOString() }); store.set("demo_catfeeds", l.slice(0, 50)); }
  sendCatFeed() {}
  // 데모: 서버(supabase-update-foodnpc.sql)와 같은 규칙으로 이 브라우저 안에서 손님 흐름을 계산해요
  _food() {
    const f = store.get("demo_food2", null) || { tako: { made: 37, taken: 31, sold: 0, queue: 0, at: Date.now() - 20 * 60000 }, bungeo: { made: 128, taken: 121, sold: 0, queue: 0, at: Date.now() - 20 * 60000 } };
    for (const k of ["tako", "bungeo"]) foodSim(k, f[k], Date.now());
    store.set("demo_food2", f); return f;
  }
  async foodCounts() { return this._food(); }
  async foodMake(kind, n) { const f = this._food(), c = f[kind]; c.made += n; const sv = Math.min(c.queue, Math.max(0, c.made - c.taken - c.sold)); c.sold += sv; c.queue -= sv; store.set("demo_food2", f); return f; }
  async foodTake(kind) { const f = this._food(), c = f[kind]; if (c.made - c.taken - c.sold <= 0) return -1; c.taken++; store.set("demo_food2", f); return c.made - c.taken - c.sold; }
  leaveRoom() { clearInterval(this.timer); clearInterval(this.walker); clearInterval(this.beat); if (this.bc) { this.bc.postMessage({ t: "bye", id: myId }); this.bc.close(); this.bc = null; } }
  resume() {}
  // 성경 퀴즈 (데모: 이 기기에만 저장, 가상 친구 점수는 고정)
  async quizSettings(grp) { return store.get("demo_quiz_set_" + grp, { books: [], general: true }); }
  async adminSetQuiz(pw, grp, books, general) { this._role(pw, "quiz_" + grp); store.set("demo_quiz_set_" + grp, { books, general }); }
  async adminResetQuiz(pw, grp) { this._role(pw, "quiz_" + grp); store.set("demo_quiz_solves_" + grp, {}); }
  // ---- 함께하는 기능 (데모: 이 기기에만 저장) ----
  async getSettings() { return store.get("demo_settings", {}); }
  async adminSetSetting(pw, key, value) { this._admin(pw); const s = store.get("demo_settings", {}); s[key] = value; store.set("demo_settings", s); }
  _ev() { const saved = store.get("demo_events", null); if (saved) return saved; const t = Date.now(); return [
    { id: 2, title: "301호 보드게임 번개 🎲", place: "room301", memo: "", starts_at: new Date(t + 26 * 3600e3).toISOString(), ends_at: new Date(t + 28 * 3600e3).toISOString() },
    { id: 1, title: "농구 한 판 🏀", place: "court", memo: "", starts_at: new Date(t - 10 * 60e3).toISOString(), ends_at: new Date(t + 100 * 60e3).toISOString() }]; }
  async listEvents() { return this._ev().filter((e) => new Date(e.ends_at) > Date.now() - 3600e3).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)); }
  async adminAddEvent(pw, ev) { this._admin(pw); const l = this._ev(); l.push({ id: Math.max(0, ...l.map((x) => x.id)) + 1, ...ev }); store.set("demo_events", l); }
  async adminDeleteEvent(pw, id) { this._admin(pw); store.set("demo_events", this._ev().filter((x) => x.id !== id)); }
  async readingMark() {} async readingSync() { return 0; }
  _ch() { const saved = store.get("demo_challenges", null); if (saved) return saved; const d = new Date(), f = (x) => x.toISOString().slice(0, 10);
    return [{ id: 2, grp: "g1", title: "1부 11월 복음서 함께 읽기", books: [40, 41, 42, 43], starts: f(new Date(d.getTime() - 10 * 864e5)), ends: f(new Date(d.getTime() + 20 * 864e5)) },
      { id: 1, grp: "g2", title: "2부 시편 한 달 읽기", books: [19], starts: f(new Date(d.getTime() - 5 * 864e5)), ends: f(new Date(d.getTime() + 25 * 864e5)) }]; }
  async listChallenges() { return this._ch(); }
  async challengeBoard(id) {
    const c = this._ch().find((x) => x.id === id); if (!c) return [];
    const mine = Object.entries(store.get("progress", {})).filter(([b]) => c.books.includes(+b + 1)).reduce((a, [, l]) => a + l.length, 0);
    return [{ name: "은혜", n: 31, me: false }, { name: "요셉", n: 22, me: false }, { name: "하늘", n: 9, me: false }, { name: S.profile?.name || "나", n: mine, me: true }].filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  }
  async adminAddChallenge(pw, c) { this._role(pw, c.grp === "g1" ? "ch_g1" : "ch_" + c.grp); const l = this._ch(); l.unshift({ id: Math.max(0, ...l.map((x) => x.id)) + 1, ...c }); store.set("demo_challenges", l); }
  async adminDeleteChallenge(pw, id) { const c = this._ch().find((x) => x.id === id); this._role(pw, "ch_" + ((c && c.grp) || "all")); store.set("demo_challenges", this._ch().filter((x) => x.id !== id)); }
  _ts() { const saved = store.get("demo_testimonies", null); if (saved) return saved; const t = Date.now(); return [
    { id: 3, name: "다니엘", content: "기도해 주신 덕분에 취업했어요! 하나님께 감사드려요 🙏", amen_count: 9, created_at: new Date(t - 5 * 3600e3).toISOString() },
    { id: 2, name: "", content: "엄마 수술이 잘 끝났어요. 함께 기도해 주셔서 감사해요.", amen_count: 14, created_at: new Date(t - 2 * 864e5).toISOString() },
    { id: 1, name: "은혜", content: "이사 잘 마쳤어요. 새 집 근처에 좋은 교회 식구들이 있어요 🌱", amen_count: 6, created_at: new Date(t - 6 * 864e5).toISOString() }]; }
  async listTestimonies() { return this._ts(); }
  async addTestimony(name, content) { const l = this._ts(); const id = Math.max(0, ...l.map((x) => x.id)) + 1; l.unshift({ id, name, content, amen_count: 0, created_at: new Date().toISOString() }); store.set("demo_testimonies", l); return id; }
  async amenTestimony(id) { const l = this._ts(), x = l.find((y) => y.id === id); if (x) x.amen_count++; store.set("demo_testimonies", l); return x ? x.amen_count : 0; }
  async reportTestimony() {}
  async deleteMyTestimony(id) { store.set("demo_testimonies", this._ts().filter((x) => x.id !== id)); }
  async adminDeleteTestimony(pw, id) { this._admin(pw); store.set("demo_testimonies", this._ts().filter((x) => x.id !== id)); }
  async sportAdd(kind, pts) { const l = store.get("demo_sport", []); l.push([kind, pts, Date.now()]); store.set("demo_sport", l.slice(-500)); }
  async sportRanking(period) {
    const since = period === "week" ? weekStartNY() : 0, mine = store.get("demo_sport", []).filter(([, , at]) => at >= since);
    const rows = (period === "week" ? [["요한", 14, 10, 4], ["다니엘", 9, 6, 3], ["소망", 5, 0, 5]] : [["요한", 62, 40, 22], ["다니엘", 44, 30, 14], ["소망", 31, 6, 25], ["은혜", 12, 2, 10]]).map(([name, points, bb, rk]) => ({ name, points, bb, rk, me: false }));
    if (mine.length) rows.push({ name: S.profile?.name || "익명", points: mine.reduce((a, [, p]) => a + p, 0), bb: mine.filter(([k]) => k === "bb").reduce((a, [, p]) => a + p, 0), rk: mine.filter(([k]) => k !== "bb").reduce((a, [, p]) => a + p, 0), me: true });
    rows.sort((a, b) => b.points - a.points); let r = 0, last = null; rows.forEach((x, i) => { if (x.points !== last) { r = i + 1; last = x.points; } x.rank = r; });
    return rows;
  }
  async pushSave() { throw new Error("알림은 Supabase에 연결한 뒤에 쓸 수 있어요"); }
  async pushRemove() {}
  async notify() {}

  async quizSubmit(name, items, grp) {
    const sv = store.get("demo_quiz_solves_" + grp, {}); let gain = 0;
    for (const it of items) { if (sv[it.id]) continue; const pt = QUIZ_PTS[it.level] || 1; sv[it.id] = [pt, Date.now()]; gain += pt; }
    store.set("demo_quiz_solves_" + grp, sv); store.set("demo_quiz_name", name || ""); return gain;
  }
  async quizRanking(period, grp) {
    const since = period === "week" ? weekStartNY() : 0, sv = Object.values(store.get("demo_quiz_solves_" + grp, {})).filter(([, at]) => at >= since);
    const bots = grp === "g1" ? (period === "week" ? [["요한", 15, 9], ["소망", 9, 7], ["하늘", 3, 3]] : [["요한", 80, 50], ["소망", 52, 31], ["하늘", 20, 14]])
      : period === "week" ? [["은혜", 18, 11], ["요셉", 12, 8], ["다니엘", 4, 3]] : [["은혜", 96, 61], ["요셉", 71, 44], ["다니엘", 19, 13]];
    const rows = bots.map(([name, points, solved]) => ({ name, points, solved, me: false }));
    if (sv.length) rows.push({ name: store.get("demo_quiz_name", "") || "익명", points: sv.reduce((a, [p]) => a + p, 0), solved: sv.length, me: true });
    rows.sort((x, y) => y.points - x.points);
    let r = 0, last = null; rows.forEach((x, i) => { if (x.points !== last) { r = i + 1; last = x.points; } x.rank = r; });
    return rows;
  }

  // 👥 전체 접속 인원 (데모: 방마다 있는 가상 친구들 + 나)
  lobbyJoin(info, onList) {
    const list = Object.entries(DEMO_BOTS).flatMap(([room, bots]) => bots.map((b, i) => ({ id: `bot-${room}-${i}`, name: b.name, color: b.color, room })));
    setTimeout(() => onList(list.filter((x) => x.room !== info.room).concat(info)), 50);
  }
  lobbyResume() {}
  lobbyLeave() {}
  async profileSave() { return true; }
  async profileMe() { return null; }
  // 🎯 미션 (데모: 이 기기에만 저장 · 화면 쪽 MS가 기록을 들고 있어요)
  async missionAdd() { return 1; }
  async missionMe() { return { log: [], books: [], resolve: null }; }
  // 🧀 쇼룸 · 주문 (데모)
  async cookieCount() { return store.get("demo_cookie", 128); }
  // 🌿 산책 노트 (데모: 이 기기에만)
  async walkNoteSave(q, a) { const l = store.get("demo_walk", []).filter((n) => n.day !== nyDay()); l.unshift({ day: nyDay(), q, a }); store.set("demo_walk", l.slice(0, 400)); return true; }
  async walkNotes() { return store.get("demo_walk", []); }
  // 📱 기기 연결 (데모: 같은 브라우저 안에서만 흉내)
  async deviceCodeMake() { const code = String(100000 + Math.floor(Math.random() * 900000)); store.set("demo_link", { code, at: Date.now() }); return code; }
  async deviceLink(code) { const d = store.get("demo_link", null); if (!d || d.code !== code || Date.now() - d.at > 600e3 || d.used) return { error: "코드가 맞지 않거나 10분이 지났어요" }; d.used = true; store.set("demo_link", d); return { token, name: S.profile?.name || "" }; }
  async deviceCodeStatus(code) { const d = store.get("demo_link", null); return !d || d.code !== code || Date.now() - d.at > 600e3 ? "gone" : d.used ? "used" : "waiting"; }
  async readingMe() { return []; }
  async nameKnown() { return false; }
  async adminSummary() { return { visitors7: 23, today: 6, prayers7: 41, reads7: 88, stamps7: 19, orders_new: 2, orders_week: 5, reports: 1, events_next: 2, members30: 37 }; }
  // ⛸ 스케이트장 랭킹 (데모: 이 기기에만 저장 + 가상 친구들)
  async rinkScoreAdd(kind, score, song) {
    const k = "demo_rink_" + kind, old = store.get(k, null), better = !old || (kind === "figure" ? score > old.score : score < old.score);
    if (better) store.set(k, { score, song: song || "", name: clip(S.profile?.name, LIMIT.name) || "익명" });
    const best = better ? score : old.score, list = await this.rinkTop(kind);
    return { best, rank: list.findIndex((r) => r.me) + 1, new: better };
  }
  async rinkTop(kind) {
    const bots = kind === "figure" ? [["은혜", 58.4, "silent"], ["요셉", 47.2, "jingle"], ["소망", 39.8, "grace"], ["하늘", 31.5, "joy"]] : [["다니엘", 14.8, ""], ["요한", 17.3, ""], ["하늘", 21.6, ""]];
    const rows = bots.map(([name, score, song]) => ({ name, score, song, me: false })), mine = store.get("demo_rink_" + kind, null);
    if (mine) rows.push({ name: mine.name, score: mine.score, song: mine.song, me: true });
    return rows.sort((a, b) => (kind === "figure" ? b.score - a.score : a.score - b.score)).slice(0, 10);
  }
  async cookieMake() { const n = store.get("demo_cookie", 128) + 1; store.set("demo_cookie", n); return n; }
  _ord() { return store.get("demo_orders", null) || [{ id: 1, name: "은혜", contact: "010-1234-5678", qty_s: 2, qty_l: 1, pickup: "church", memo: "주일 2부 끝나고 받을게요!", total: 31, status: "new", created_at: new Date(Date.now() - 40 * 60e3).toISOString() }]; }
  async orderAdd(o) { const l = this._ord(), id = Math.max(0, ...l.map((x) => x.id)) + 1; l.unshift({ id, ...o, total: o.qty_s * CM_PRICE.s + o.qty_l * CM_PRICE.l, status: "new", created_at: new Date().toISOString() }); store.set("demo_orders", l); return id; }
  async adminOrders(pw) { this._admin(pw); return this._ord(); }
  async adminOrderStatus(pw, id, st) { this._admin(pw); const l = this._ord(), x = l.find((y) => y.id === id); if (x) x.status = st; store.set("demo_orders", l); }
  async adminOrderDelete(pw, id) { this._admin(pw); store.set("demo_orders", this._ord().filter((x) => x.id !== id)); }
  async pushOrderSet() { throw new Error("알림은 Supabase에 연결한 뒤에 쓸 수 있어요"); }

  _p() { return store.get("demo_prayers", null) || [
    { id: 3, name: null, content: "부모님 건강을 위해 기도 부탁드려요.", amen_count: 7, answered: false, created_at: new Date(Date.now() - 3600e3).toISOString() },
    { id: 2, name: "은혜", content: "다음 달 이사가 순조롭게 진행되도록 기도해주세요.", amen_count: 4, answered: false, created_at: new Date(Date.now() - 86400e3).toISOString() },
    { id: 1, name: "다니엘", content: "합격했어요! 함께 기도해주신 분들 감사합니다 🙏", amen_count: 12, answered: true, created_at: new Date(Date.now() - 3 * 86400e3).toISOString() },
  ]; }
  _save(p) { store.set("demo_prayers", p); }
  async listPrayers() { return this._p().filter((x) => !x.hidden); }
  async addPrayer(name, content) { const p = this._p(); const id = Math.max(0, ...p.map((x) => x.id)) + 1; p.unshift({ id, name: name || null, content, amen_count: 0, answered: false, report_count: 0, created_at: new Date().toISOString() }); this._save(p); return id; }
  async amenPrayer(id) { const p = this._p(); const x = p.find((y) => y.id === id); if (x) x.amen_count++; this._save(p); return x ? x.amen_count : 0; }
  async reportPrayer(id, reason) { const p = this._p(); const x = p.find((y) => y.id === id); if (x) { x.report_count = (x.report_count || 0) + 1; x.reason = reason; if (x.report_count >= 3) x.hidden = true; } this._save(p); }
  async setAnswered(id, v) { const p = this._p(); const x = p.find((y) => y.id === id); if (x) x.answered = v; this._save(p); }
  async deleteMyPrayer(id) { this._save(this._p().filter((x) => x.id !== id)); }
  _g() { return store.get("demo_group", null) || [
    { id: 2, content: "다음 주 청년부 수련회가 은혜 가운데 진행되도록", answered: false, created_at: new Date().toISOString() },
    { id: 1, content: "아픈 지체들의 회복을 위해", answered: false, created_at: new Date().toISOString() },
  ]; }
  async listGroup() { return this._g(); }
  _admin(pw) { if (pw !== "demo") throw new Error("관리자 비밀번호가 틀렸어요"); }
  async adminCheck(pw) { return pw === "demo"; }
  // 데모 비밀번호: 전체 demo · 1부 demo1 · 찬양팀 demo3
  async adminRole(pw) { return { demo: "all", demo1: "g1", demo3: "praise" }[pw] || null; }
  async adminSetRolePw(pw) { this._admin(pw); }
  _role(pw, area) { const r = { demo: "all", demo1: "g1", demo3: "praise" }[pw]; if (r === "all" || (r === "g1" && /_g1$/.test(area)) || (r === "praise" && area === "praise")) return; throw new Error("이 비밀번호로는 할 수 없는 일이에요"); }
  // 🎼 찬양팀 곡 (데모: 곡은 이 기기에, 악보 사진은 새로고침하면 사라져요)
  _songs() { return store.get("demo_songs", null) || DEMO_SONGS.map((x) => ({ ...x })); }
  async listSongs() { const l = this._songs(); this._sh = this._sh || []; return l.map((x) => ({ ...x, sheets: this._sh.filter((y) => y.song_id === x.id).map(({ id, page }) => ({ id, page })) })); }
  async getSheets(id) { return (this._sh || []).filter((y) => y.song_id === id).sort((a, b) => a.page - b.page); }
  async songSave(pw, sg) { this._role(pw, "praise"); const l = this._songs(); let id = sg.id; if (id) { const i = l.findIndex((x) => x.id === id); l[i] = { ...l[i], ...sg }; } else { id = Math.max(0, ...l.map((x) => x.id)) + 1; l.push({ ...sg, id }); } store.set("demo_songs", l); return id; }
  async songDelete(pw, id) { this._role(pw, "praise"); store.set("demo_songs", this._songs().filter((x) => x.id !== id)); }
  async songClearSet(pw) { this._role(pw, "praise"); store.set("demo_songs", this._songs().map((x) => ({ ...x, set_no: null }))); }
  async sheetAdd(pw, song, page, data) { this._role(pw, "praise"); this._sh = this._sh || []; const id = Math.max(0, ...this._sh.map((x) => x.id)) + 1; this._sh.push({ id, song_id: song, page, data }); return id; }
  async sheetDelete(pw, id) { this._role(pw, "praise"); this._sh = (this._sh || []).filter((x) => x.id !== id); }
  async adminAddGroup(pw, c) { this._admin(pw); const g = this._g(); g.unshift({ id: Math.max(0, ...g.map((x) => x.id)) + 1, content: c, answered: false, created_at: new Date().toISOString() }); store.set("demo_group", g); }
  async adminSetGroupAnswered(pw, id, v) { this._admin(pw); const g = this._g(); const x = g.find((y) => y.id === id); if (x) x.answered = v; store.set("demo_group", g); }
  async adminDeleteGroup(pw, id) { this._admin(pw); store.set("demo_group", this._g().filter((x) => x.id !== id)); }
  async adminListReported(pw) { this._admin(pw); return this._p().filter((x) => x.report_count > 0); }
  async adminDeletePrayer(pw, id) { this._admin(pw); this._save(this._p().filter((x) => x.id !== id)); }
  async adminRestorePrayer(pw, id) { this._admin(pw); const p = this._p(); const x = p.find((y) => y.id === id); if (x) { x.report_count = 0; x.hidden = false; } this._save(p); }

  // 발자취 (데모: 이 기기에만 저장)
  _seedFoot() {
    if (this._seed) return this._seed;
    const now = Date.now();
    this._seed = DEMO_FOOT.map(([min, name, color, room, kind, ex = {}], i) => ({
      id: -1 - i, name, color, room, kind, seat: ex.seat || null, pos_x: null, pos_z: null,
      book: ex.book || null, chap: ex.chap || null, detail: ex.book ? `${BOOKS[ex.book - 1][0]} ${ex.chap}장` : "",
      created_at: new Date(now - min * 60e3).toISOString(),
    }));
    return this._seed;
  }
  _myFoot() { return store.get("demo_foot", []); }
  async addFootprint(f) {
    const list = this._myFoot(), now = Date.now();
    const win = f.kind === "read" ? 12 * 3600e3 : 30 * 60e3;
    const same = list.find((x) => x.room === f.room && x.kind === f.kind && (f.kind !== "read" || (x.book === f.book && x.chap === f.chap)) && now - new Date(x.created_at).getTime() < win);
    const row = { name: f.name || "", color: f.color, room: f.room, kind: f.kind, detail: f.detail || "", book: f.book || null, chap: f.chap || null, seat: f.seat || null, pos_x: f.x ?? null, pos_z: f.z ?? null, created_at: new Date().toISOString() };
    if (same) Object.assign(same, row, { seat: row.seat || same.seat });
    else list.unshift({ id: Math.max(0, ...list.map((x) => x.id)) + 1, ...row });
    store.set("demo_foot", list.filter((x) => now - new Date(x.created_at).getTime() < 8 * 86400e3).slice(0, 300));
    return 1;
  }
  async listFootprints(since) {
    const t = new Date(since).getTime();
    return [...this._myFoot(), ...this._seedFoot()].filter((x) => new Date(x.created_at).getTime() >= t)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  // 이번주 공지 (데모)
  _nt() { const saved = store.get("demo_notices", null); if (saved) return saved; const now = Date.now(); return DEMO_NOTICES.map(([min, room, content], i) => ({ id: DEMO_NOTICES.length - i, room, content, created_at: new Date(now - min * 60e3).toISOString() })); }
  async listNotices(room) { return this._nt().filter((n) => !room || n.room === room); }
  async adminAddNotice(pw, room, content) { this._role(pw, room === "room301" ? "notice_g1" : "notice_all"); const n = this._nt(); n.unshift({ id: Math.max(0, ...n.map((x) => x.id)) + 1, room, content, created_at: new Date().toISOString() }); store.set("demo_notices", n); }
  async adminDeleteNotice(pw, id) { const x = this._nt().find((y) => y.id === id); this._role(pw, x && x.room === "room301" ? "notice_g1" : "notice_all"); store.set("demo_notices", this._nt().filter((x) => x.id !== id)); }
  // 방명록 (데모)
  _gbAll() {
    const saved = store.get("demo_gb2", null); if (saved) return saved;
    const now = Date.now(); let id = 0;
    return Object.entries(DEMO_GB).flatMap(([room, rows]) => rows.map(([min, name, content]) => ({ id: ++id, room, name, content, created_at: new Date(now - min * 60e3).toISOString() })));
  }
  async listGuestbook(room) { return this._gbAll().filter((x) => x.room === room).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
  async addGuestbook(room, name, content) { const g = this._gbAll(); const id = Math.max(0, ...g.map((x) => x.id)) + 1; g.unshift({ id, room, name: name || "", content, created_at: new Date().toISOString() }); store.set("demo_gb2", g); return id; }
  async deleteMyGuestbook(id) { store.set("demo_gb2", this._gbAll().filter((x) => x.id !== id)); }
  async reportGuestbook() {}
  async adminDeleteGuestbook(pw, id) { this._admin(pw); store.set("demo_gb2", this._gbAll().filter((x) => x.id !== id)); }
  async adminDeleteFootprint(pw, id) {
    this._admin(pw);
    if (id < 0) { this._seed = this._seedFoot().filter((x) => x.id !== id); return; }
    store.set("demo_foot", this._myFoot().filter((x) => x.id !== id));
  }
}

/* ================= Supabase 백엔드 ================= */
// 실시간 접속(Presence): 방마다 채널 하나. 끊기면 자동으로 다시 붙고, 20초마다 "나 여기 있어요"를 다시 알려요.
class SupaBackend {
  constructor(url, key) {
    this.demo = false;
    this.sb = window.supabase.createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
    this.ch = null; this.joined = false; this.room = null;
    this.lastTrack = 0; this.trackTimer = null; this.retry = 0; this.rt = null; this.keep = null; this.lastEnsure = 0;
  }
  joinRoom(room, me, hd) {
    this.leaveRoom();
    this.room = room; this.hd = hd; this.me = { ...me }; this.retry = 0;
    this._connect();
    this.keep = setInterval(() => this._keepAlive(), 20000);
  }
  _connect() {
    const hd = this.hd;
    const ch = this.sb.channel("qpc-room-" + this.room, { config: { presence: { key: myId }, broadcast: { self: false } } });
    this.ch = ch; this.joined = false;
    ch.on("presence", { event: "sync" }, () => {
      if (ch !== this.ch) return;
      const st = ch.presenceState(), list = [];
      let meSeen = false;
      for (const k in st) { const metas = st[k]; if (metas && metas.length) { list.push(metas[metas.length - 1]); if (k === myId) meSeen = true; } }
      hd.onPeers(list);
      // 서버 목록에 내가 빠져 있으면 (잠깐 끊겼다 돌아온 경우) 다시 알려요
      if (this.joined && !meSeen) this._ensureTracked();
    });
    ch.on("broadcast", { event: "react" }, ({ payload }) => payload && ch === this.ch && hd.onReact(payload));
    ch.on("broadcast", { event: "give" }, ({ payload }) => payload && ch === this.ch && hd.onGive && hd.onGive(payload));
    ch.on("broadcast", { event: "catfeed" }, ({ payload }) => payload && ch === this.ch && hd.onCatFeed && hd.onCatFeed(payload));
    ch.on("broadcast", { event: "sport" }, ({ payload }) => payload && ch === this.ch && hd.onSport && hd.onSport(payload));
    ch.on("broadcast", { event: "jam" }, ({ payload }) => payload && ch === this.ch && hd.onJam && hd.onJam(payload));
    ch.subscribe((status) => {
      if (ch !== this.ch) return;
      if (status === "SUBSCRIBED") {
        this.joined = true; this.retry = 0; clearTimeout(this.rt); this.rt = null;
        this._send();
        hd.onStatus && hd.onStatus("ok");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.joined = false;
        hd.onStatus && hd.onStatus("retry");
        this._scheduleReconnect();
      }
    });
  }
  _scheduleReconnect() {
    if (this.rt || !this.room) return;
    const wait = Math.min(15000, 1000 * Math.pow(2, this.retry++));
    this.rt = setTimeout(() => { this.rt = null; this.reconnect(); }, wait);
  }
  reconnect() {
    if (!this.room) return;
    const old = this.ch; this.ch = null; this.joined = false;
    if (old) { old.untrack().catch(() => {}); this.sb.removeChannel(old); }
    this._connect();
  }
  _send() { this.lastTrack = Date.now(); if (this.ch && this.joined) this.ch.track(this.me).catch(() => {}); }
  _ensureTracked() { const now = Date.now(); if (now - this.lastEnsure < 3000) return; this.lastEnsure = now; this._send(); }
  _keepAlive() {
    if (!this.room) return;
    if (this.joined && this.ch && this.ch.state === "joined") this._send();
    else this._scheduleReconnect();
    if (this.lob && !this.lobOk && !this.lobT) this._lobbyReconnect();
  }
  // 폰에서 다른 앱에 갔다가 돌아왔을 때
  resume(hiddenMs) {
    if (!this.room) return;
    if (!this.joined || !this.ch || this.ch.state !== "joined" || hiddenMs > 15000) { this.retry = 0; clearTimeout(this.rt); this.rt = null; this.reconnect(); }
    else this._send();
  }
  update(me) {
    this.me = { ...me };
    // 0.3초에 한 번까지만 보내고, 마지막 상태는 꼭 보냄
    const now = Date.now(), wait = 300 - (now - this.lastTrack);
    clearTimeout(this.trackTimer);
    if (wait <= 0) this._send(); else this.trackTimer = setTimeout(() => this._send(), wait);
  }
  sendReact(target, from) { this.ch && this.joined && this.ch.send({ type: "broadcast", event: "react", payload: { target, from } }); }
  sendGive(target, from, kind) { this.ch && this.joined && this.ch.send({ type: "broadcast", event: "give", payload: { target, from, kind } }); }
  sendCatFeed(name, kind) { this.ch && this.joined && this.ch.send({ type: "broadcast", event: "catfeed", payload: { name, kind } }); }
  sendSport(p) { this.ch && this.joined && this.ch.send({ type: "broadcast", event: "sport", payload: p }); }
  sendJam(p) { this.ch && this.joined && this.ch.send({ type: "broadcast", event: "jam", payload: p }); }
  // 📝 추천 찬양
  listRecs() { return this._sel(this.sb.from("song_recs").select("id,name,title,artist,note,link,like_count,created_at").order("created_at", { ascending: false }).limit(150)); }
  addRec(r) { return this._rpc("add_song_rec", { p_token: token, p_name: r.name || "", p_title: r.title, p_artist: r.artist || "", p_note: r.note || "", p_link: r.link || "" }); }
  likeRec(id) { return this._rpc("like_song_rec", { p_id: id, p_token: token }); }
  reportRec(id) { return this._rpc("report_song_rec", { p_id: id, p_token: token }); }
  deleteMyRec(id) { return this._rpc("delete_my_song_rec", { p_id: id, p_token: token }); }
  adminDeleteRec(pw, id) { return this._rpc("admin_delete_song_rec", { p_pw: pw, p_id: id }); }
  async listCatFeeds() {
    const { data, error } = await this.sb.from("cat_feeds").select("id,name,kind,created_at").gte("created_at", new Date(Date.now() - 30 * 3600e3).toISOString()).order("created_at", { ascending: false }).limit(60);
    if (error) throw new Error(error.message); return data;
  }
  feedCat(kind, name) { return this._rpc("feed_cat", { p_token: token, p_name: name || "", p_kind: kind }); }
  async foodCounts() {
    const out = { tako: { made: 0, taken: 0, sold: 0, queue: 0 }, bungeo: { made: 0, taken: 0, sold: 0, queue: 0 } };
    if (!this.noFoodNpc) {
      const { data, error } = await this.sb.rpc("food_tick");
      if (!error) { for (const r of data || []) out[r.kind] = { made: r.made, taken: r.taken, sold: r.npc_sold || 0, queue: r.queue || 0 }; out.npc = true; return out; }
      if (/schema cache|does not exist|Could not find/i.test(error.message)) { this.noFoodNpc = true; console.warn("손님(NPC) 기능: Supabase에서 supabase-update-foodnpc.sql을 실행해 주세요"); }
      else throw new Error(error.message);
    }
    const { data, error } = await this.sb.from("food_counters").select("kind,made,taken");
    if (error) throw new Error(error.message);
    for (const r of data) out[r.kind] = { made: r.made, taken: r.taken, sold: 0, queue: 0 }; return out;
  }
  async foodMake(kind, n) { await this._rpc("food_make", { p_token: token, p_kind: kind, p_n: n }); return this.foodCounts(); }
  foodTake(kind) { return this._rpc("food_take", { p_token: token, p_kind: kind }); }
  leaveRoom() {
    clearTimeout(this.trackTimer); clearTimeout(this.rt); clearInterval(this.keep);
    this.rt = null; this.room = null; this.joined = false;
    if (this.ch) { const c = this.ch; this.ch = null; c.untrack().catch(() => {}); this.sb.removeChannel(c); }
  }
  async _rpc(fn, args) {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) {
      // Supabase에 SQL이 아직 적용되지 않았을 때: 알아보기 쉬운 안내로 바꿔요
      if (/schema cache|does not exist/i.test(error.message)) { console.warn(error.message); throw new Error(`아직 준비 중인 기능이에요. 관리자: Supabase에서 ${/^(walk_note|cat_)/.test(fn) ? "supabase-update-yard.sql" : /^(device_|name_known|admin_summary|reading_me|profile_)/.test(fn) ? "supabase-update-site.sql" : /^(mission_|cookie_|order_|admin_order|push_order|rink_)/.test(fn) ? "supabase-update-missions.sql" : /^(admin_role|admin_set_role_pw|notice_|quiz_set_books|quiz_reset|quiz_submit_g|quiz_ranking_g|challenge_add|challenge_delete|song_save|song_delete|song_clear_set|sheet_)/.test(fn) ? "supabase-update-groups.sql" : /song_rec/.test(fn) ? "supabase-update-praise.sql" : /quiz/.test(fn) ? "supabase-update-quiz.sql" : /setting|event|reading|challenge|testimon|sport|push/.test(fn) ? "supabase-update-community.sql" : "supabase-update-footprints.sql"}을 실행해 주세요`); }
      throw new Error(error.message);
    }
    return data;
  }
  async listPrayers() {
    const { data, error } = await this.sb.from("prayers").select("id,name,content,amen_count,answered,created_at").order("created_at", { ascending: false }).limit(150);
    if (error) throw new Error(error.message); return data;
  }
  addPrayer(name, content) { return this._rpc("add_prayer", { p_token: token, p_name: name || "", p_content: content }); }
  amenPrayer(id) { return this._rpc("amen_prayer", { p_id: id, p_token: token }); }
  reportPrayer(id, reason) { return this._rpc("report_prayer", { p_id: id, p_token: token, p_reason: reason }); }
  setAnswered(id, v) { return this._rpc("set_prayer_answered", { p_id: id, p_token: token, p_answered: v }); }
  deleteMyPrayer(id) { return this._rpc("delete_my_prayer", { p_id: id, p_token: token }); }
  async listGroup() {
    const { data, error } = await this.sb.from("group_prayers").select("id,content,answered,created_at").order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message); return data;
  }
  adminCheck(pw) { return this._rpc("admin_check", { p_pw: pw }); }
  adminAddGroup(pw, c) { return this._rpc("admin_add_group", { p_pw: pw, p_content: c }); }
  adminSetGroupAnswered(pw, id, v) { return this._rpc("admin_set_group_answered", { p_pw: pw, p_id: id, p_answered: v }); }
  adminDeleteGroup(pw, id) { return this._rpc("admin_delete_group", { p_pw: pw, p_id: id }); }
  adminListReported(pw) { return this._rpc("admin_list_reported", { p_pw: pw }); }
  adminDeletePrayer(pw, id) { return this._rpc("admin_delete_prayer", { p_pw: pw, p_id: id }); }
  adminRestorePrayer(pw, id) { return this._rpc("admin_restore_prayer", { p_pw: pw, p_id: id }); }
  // 발자취
  addFootprint(f) {
    return this._rpc("add_footprint", {
      p_token: token, p_name: f.name || "", p_room: f.room, p_kind: f.kind, p_detail: f.detail || "",
      p_book: f.book ?? null, p_chap: f.chap ?? null, p_seat: f.seat ?? null,
      p_x: Number.isFinite(f.x) ? f.x : null, p_z: Number.isFinite(f.z) ? f.z : null, p_color: f.color ?? null,
    });
  }
  async listFootprints(since) {
    const { data, error } = await this.sb.from("footprints").select("id,name,room,kind,detail,book,chap,seat,pos_x,pos_z,color,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message); return data;
  }
  adminDeleteFootprint(pw, id) { return this._rpc("admin_delete_footprint", { p_pw: pw, p_id: id }); }
  // 이번주 공지 (비전 / 301호, 관리자만 올려요)
  // 공지: room = all(전체·마당) | room301(1부) | vision(2부)
  async listNotices(room) {
    let q = this.sb.from("notices").select("id,room,content,created_at").order("created_at", { ascending: false }).limit(30);
    if (room) q = q.eq("room", room);
    const { data, error } = await q; if (error) throw new Error(error.message); return data;
  }
  // 1부 관리자 등 역할 비밀번호용 함수(supabase-update-groups.sql). 비밀번호가 맞지 않으면 null/false가 와요
  async _roleRpc(fn, args) { const r = await this._rpc(fn, args); if (r === null || r === false) throw new Error("이 비밀번호로는 할 수 없는 일이에요"); return r; }
  async adminRole(pw) {
    try { return await this._rpc("admin_role", { p_pw: pw }); }
    catch (e) { if (/준비 중/.test(e.message)) return (await this.adminCheck(pw)) ? "all" : null; throw e; } // 아직 groups SQL 전이면 예전처럼
  }
  adminSetRolePw(pw, role, nw) { return this._rpc("admin_set_role_pw", { p_pw: pw, p_role: role, p_new: nw }); }
  adminAddNotice(pw, room, content) { return this._roleRpc("notice_add", { p_pw: pw, p_room: room, p_content: content }); }
  adminDeleteNotice(pw, id) { return this._roleRpc("notice_delete", { p_pw: pw, p_id: id }); }
  // 🎼 찬양팀 곡 악보
  async listSongs() {
    const songs = await this._sel(this.sb.from("praise_songs").select("id,title,artist,key_root,bpm,sig,chords,youtube,set_no,updated_at").order("title").limit(300));
    const sh = await this._sel(this.sb.from("praise_sheets").select("id,song_id,page").order("page").limit(2000));
    return songs.map((x) => ({ ...x, sheets: sh.filter((y) => y.song_id === x.id) }));
  }
  getSheets(id) { return this._sel(this.sb.from("praise_sheets").select("id,page,data").eq("song_id", id).order("page")); }
  songSave(pw, sg) { return this._roleRpc("song_save", { p_pw: pw, p_id: sg.id || null, p_title: sg.title, p_artist: sg.artist || "", p_key: sg.key_root, p_bpm: sg.bpm, p_sig: sg.sig || "4/4", p_chords: sg.chords || "", p_youtube: sg.youtube || "", p_set_no: sg.set_no || 0 }); }
  songDelete(pw, id) { return this._roleRpc("song_delete", { p_pw: pw, p_id: id }); }
  songClearSet(pw) { return this._roleRpc("song_clear_set", { p_pw: pw }); }
  sheetAdd(pw, song, page, data) { return this._roleRpc("sheet_add", { p_pw: pw, p_song: song, p_page: page, p_data: data }); }
  sheetDelete(pw, id) { return this._roleRpc("sheet_delete", { p_pw: pw, p_id: id }); }
  // 방명록 (비전 / 301호, 방마다 따로)
  async listGuestbook(room) {
    const { data, error } = await this.sb.from("guestbook").select("id,name,content,created_at").eq("room", room).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message); return data;
  }
  addGuestbook(room, name, content) { return this._rpc("add_guestbook", { p_token: token, p_name: name || "", p_content: content, p_room: room }); }
  deleteMyGuestbook(id) { return this._rpc("delete_my_guestbook", { p_id: id, p_token: token }); }
  reportGuestbook(id) { return this._rpc("report_guestbook", { p_id: id, p_token: token }); }
  adminDeleteGuestbook(pw, id) { return this._rpc("admin_delete_guestbook", { p_pw: pw, p_id: id }); }
  // 성경 퀴즈 (supabase-update-quiz.sql)
  // 퀴즈 1부(g1, 설정 id 2) / 2부(g2, 설정 id 1). groups SQL 전이면 예전 함수로
  async quizSettings(grp) {
    let { data, error } = await this.sb.from("quiz_settings").select("books,general").eq("id", grp === "g1" ? 2 : 1).maybeSingle();
    if (!error && !data && grp === "g1") ({ data, error } = await this.sb.from("quiz_settings").select("books,general").eq("id", 1).maybeSingle());
    if (error) throw new Error(error.message);
    return data || { books: [], general: true };
  }
  async _rpcOr(fn, args, old, oldArgs) { try { return await this._rpc(fn, args); } catch (e) { if (/준비 중/.test(e.message)) return this._rpc(old, oldArgs); throw e; } }
  quizSubmit(name, items, grp) { return this._rpcOr("quiz_submit_g", { p_token: token, p_name: name || "", p_items: items, p_grp: grp }, "quiz_submit", { p_token: token, p_name: name || "", p_items: items }); }
  quizRanking(period, grp) { return this._rpcOr("quiz_ranking_g", { p_period: period, p_token: token, p_grp: grp }, "quiz_ranking", { p_period: period, p_token: token }); }
  adminSetQuiz(pw, grp, books, general) { return this._roleRpc("quiz_set_books", { p_pw: pw, p_grp: grp, p_books: books, p_general: general }); }
  adminResetQuiz(pw, grp) { return this._roleRpc("quiz_reset", { p_pw: pw, p_grp: grp }); }
  // ---- 함께하는 기능 (supabase-update-community.sql) ----
  async _sel(q) { const { data, error } = await q; if (error) { if (/does not exist|schema cache/i.test(error.message)) console.warn("supabase-update-community.sql을 실행해 주세요:", error.message); throw new Error(error.message); } return data; }
  async getSettings() { const rows = await this._sel(this.sb.from("site_settings").select("key,value")); return Object.fromEntries(rows.map((r) => [r.key, r.value])); }
  adminSetSetting(pw, key, value) { return this._rpc("admin_set_setting", { p_pw: pw, p_key: key, p_value: value }); }
  listEvents() { return this._sel(this.sb.from("events").select("id,title,place,memo,starts_at,ends_at").gte("ends_at", new Date(Date.now() - 3600e3).toISOString()).order("starts_at").limit(30)); }
  adminAddEvent(pw, ev) { return this._rpc("admin_add_event", { p_pw: pw, p_title: ev.title, p_place: ev.place, p_memo: ev.memo || "", p_starts: ev.starts_at, p_ends: ev.ends_at }); }
  adminDeleteEvent(pw, id) { return this._rpc("admin_delete_event", { p_pw: pw, p_id: id }); }
  readingMark(book1, chap, on) { return this._rpc("reading_mark", { p_token: token, p_name: clip(S.profile?.name, LIMIT.name), p_book: book1, p_chap: chap, p_on: on }); }
  readingSync(items) { return this._rpc("reading_sync", { p_token: token, p_name: clip(S.profile?.name, LIMIT.name), p_items: items }); }
  async listChallenges() {
    const q = (cols) => this.sb.from("reading_challenges").select(cols).gte("ends", nyDay(new Date(Date.now() - 7 * 864e5))).order("starts", { ascending: false }).limit(20);
    try { return await this._sel(q("id,grp,title,books,starts,ends")); } catch (e) { return (await this._sel(q("id,title,books,starts,ends"))).map((c) => ({ ...c, grp: "all" })); } // groups SQL 전
  }
  challengeBoard(id) { return this._rpc("challenge_board", { p_id: id, p_token: token }); }
  adminAddChallenge(pw, c) { return this._roleRpc("challenge_add", { p_pw: pw, p_grp: c.grp, p_title: c.title, p_books: c.books, p_starts: c.starts, p_ends: c.ends }); }
  adminDeleteChallenge(pw, id) { return this._roleRpc("challenge_delete", { p_pw: pw, p_id: id }); }
  listTestimonies() { return this._sel(this.sb.from("testimonies").select("id,name,content,amen_count,created_at").order("created_at", { ascending: false }).limit(120)); }
  addTestimony(name, content) { return this._rpc("add_testimony", { p_token: token, p_name: name || "", p_content: content }); }
  amenTestimony(id) { return this._rpc("amen_testimony", { p_id: id, p_token: token }); }
  reportTestimony(id) { return this._rpc("report_testimony", { p_id: id, p_token: token }); }
  deleteMyTestimony(id) { return this._rpc("delete_my_testimony", { p_id: id, p_token: token }); }
  adminDeleteTestimony(pw, id) { return this._rpc("admin_delete_testimony", { p_pw: pw, p_id: id }); }
  sportAdd(kind, pts) { return this._rpc("sport_add", { p_token: token, p_name: clip(S.profile?.name, LIMIT.name), p_kind: kind, p_points: pts }); }
  sportRanking(period) { return this._rpc("sport_ranking", { p_period: period, p_token: token }); }
  pushSave(sub, visit, event) { return this._rpc("push_subscribe", { p_token: token, p_name: clip(S.profile?.name, LIMIT.name), p_sub: sub, p_visit: visit, p_event: event }); }
  pushRemove(endpoint) { return this._rpc("push_unsubscribe", { p_endpoint: endpoint }); }
  // 알림 보내기는 Supabase Edge Function 'notify'가 해요 (없으면 조용히 넘어가요)
  async notify(body) { try { const { error } = await this.sb.functions.invoke("notify", { body }); if (error) console.warn("알림 함수:", error.message); } catch (e) { console.warn("알림 함수:", e.message); } }
  // ---- 👥 전체 접속 인원: 모든 방 사람이 같이 들어가는 채널 하나 (이름 · 색 · 지금 방만 보내요) ----
  lobbyJoin(info, onList) { this.lobbyInfo = info; this.onLobby = onList; if (!this.lob) this._lobbyConnect(); else this._lobbyTrack(); }
  _lobbyConnect() {
    const ch = this.sb.channel("qpc-lobby", { config: { presence: { key: myId } } }); this.lob = ch; this.lobOk = false;
    ch.on("presence", { event: "sync" }, () => {
      if (ch !== this.lob) return;
      const st = ch.presenceState(), list = [];
      for (const k in st) { const m = st[k]; if (m && m.length) list.push(m[m.length - 1]); }
      this.onLobby && this.onLobby(list);
    });
    ch.subscribe((status) => {
      if (ch !== this.lob) return;
      if (status === "SUBSCRIBED") { this.lobOk = true; this.lobRetry = 0; this._lobbyTrack(); }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.lobOk = false; clearTimeout(this.lobT);
        this.lobRetry = (this.lobRetry || 0) + 1;
        this.lobT = setTimeout(() => this._lobbyReconnect(), Math.min(20000, 1000 * Math.pow(2, this.lobRetry)));
      }
    });
  }
  _lobbyReconnect() { const old = this.lob; this.lob = null; if (old) { old.untrack().catch(() => {}); this.sb.removeChannel(old); } this._lobbyConnect(); }
  _lobbyTrack() { if (this.lob && this.lobOk && this.lobbyInfo) this.lob.track(this.lobbyInfo).catch(() => {}); }
  lobbyLeave() { this.lobbyInfo = null; if (this.lob && this.lobOk) this.lob.untrack().catch(() => {}); }
  profileSave(pr) { return this._rpc("profile_save", { p_token: token, p_profile: pr }); }
  profileMe() { return this._rpc("profile_me", { p_token: token }); }
  lobbyResume(hiddenMs) { if (!this.lob) return; if (!this.lobOk || hiddenMs > 15000) { this.lobRetry = 0; this._lobbyReconnect(); } else this._lobbyTrack(); }
  // ---- 🎯 미션 · 🧀 쇼룸 · 🛒 주문 (supabase-update-missions.sql) ----
  missionAdd(kind, note) { return this._rpc("mission_add", { p_token: token, p_name: clip(S.profile?.name, LIMIT.name), p_kind: kind, p_note: note || null }); }
  missionMe() { return this._rpc("mission_me", { p_token: token }); }
  walkNoteSave(q, a) { return this._rpc("walk_note_save", { p_token: token, p_q: q, p_a: a }); }
  walkNotes() { return this._rpc("walk_notes_me", { p_token: token }); }
  deviceCodeMake() { return this._rpc("device_code_make", { p_token: token }); }
  deviceLink(code) { return this._rpc("device_link", { p_code: code, p_token: token }); }
  deviceCodeStatus(code) { return this._rpc("device_code_status", { p_code: code, p_token: token }); }
  readingMe() { return this._rpc("reading_me", { p_token: token }); }
  nameKnown(name) { return this._rpc("name_known", { p_name: name, p_token: token }); }
  adminSummary(pw) { return this._rpc("admin_summary", { p_pw: pw }); }
  rinkScoreAdd(kind, score, song) { return this._rpc("rink_score_add", { p_token: token, p_name: clip(S.profile?.name, LIMIT.name) || "", p_kind: kind, p_score: score, p_song: song || "" }); }
  rinkTop(kind) { return this._rpc("rink_top", { p_kind: kind, p_token: token }); }
  async cookieCount() { const { data, error } = await this.sb.from("showroom_counter").select("boxes").eq("id", 1).maybeSingle(); if (error) throw new Error(error.message); return data ? Number(data.boxes) : 0; }
  cookieMake() { return this._rpc("cookie_make", { p_token: token }); }
  orderAdd(o) { return this._rpc("order_add", { p_token: token, p_name: o.name, p_contact: o.contact, p_s: o.qty_s, p_l: o.qty_l, p_pickup: o.pickup, p_memo: o.memo || "" }); }
  adminOrders(pw) { return this._rpc("admin_orders", { p_pw: pw }); }
  adminOrderStatus(pw, id, st) { return this._rpc("admin_order_status", { p_pw: pw, p_id: id, p_status: st }); }
  adminOrderDelete(pw, id) { return this._rpc("admin_order_delete", { p_pw: pw, p_id: id }); }
  pushOrderSet(pw, endpoint, on) { return this._rpc("push_order_set", { p_pw: pw, p_endpoint: endpoint || null, p_on: on == null ? null : !!on }); }

}

const useSupa = CFG.supabaseUrl && CFG.supabaseKey && window.supabase;
const NEW_USER = !store.get("profile", null); // 이 기기에서 처음 들어온 사람 (안내 투어)
const api = useSupa ? new SupaBackend(CFG.supabaseUrl, CFG.supabaseKey) : new DemoBackend();

/* ================= 상태 ================= */
const S = {
  profile: store.get("profile", null),
  room: "yard",
  peers: [],
  joinedAt: Date.now(),
  bubble: "", kind: "status", anon: false, praying: false, amens: 0,
  pos: { x: 0, z: 11 }, seat: null,
  cafeMode: "read",
  reading: store.get("reading", { book: 42, chap: 3 }),
  progress: store.get("progress", {}),
  myPrayers: store.get("myPrayers", []),
  amened: store.get("amened", []),
  reactedLive: new Set(),
  wallFilter: "all",
  prayers: [],
  admin: null, adminRole: null,
  reportTarget: null,
  needSpread: false,
  lying: false,
  dance: null,   // 💃 { k, t0, bpm } 찬양팀 연습실에서 춤추는 중
  ground: false, // 🌿 마당 풀밭에 누워 있음
  sled: null,
  carry: null, eatN: 0, giveMode: false, cooking: null,
  myGb: store.get("myGb", []),
  gb: {},
};
const REACT = { showroom: ["🧀", "맛있겠다"], yard: ["👋", "반가워요"], worship: ["🙏", "함께 기도해요"], cafe: ["💛", "공감해요"], vision: ["👋", "반가워요"], room301: ["😊", "좋아요"], praise: ["👏", "박수"] };
// 🎸 찬양팀 연습실 상태 (키·빠르기·음색은 이 기기에 기억해요)
const JAM = {
  key: Math.max(0, Math.min(11, store.get("jamKey", 7))), bpm: Math.max(50, Math.min(180, store.get("jamBpm", 72))),
  tone: { key: store.get("jamToneKey", "piano"), key2: store.get("jamToneKey2", "pad"), egtr: store.get("jamToneGtr", "drive"), sing: store.get("jamVowel", "a") },
  loop: null, metro: false, hearOthers: store.get("jamHear", true), min: false, song: null, sec: 0, chordMode: "song",
  q: [], qT: 0, flush: null, lastFloat: {}, bassRoot: null, barKey: "",
};

function meState() {
  const p = S.profile || {};
  return {
    id: myId,
    name: S.anon ? "" : clip(p.name, LIMIT.name),
    color: p.color, hair: p.hair, hairColor: p.hairColor, glasses: p.glasses,
    gender: p.gender, sled: S.sled, carry: S.carry, eatN: S.eatN,
    ...mySkins(), // ✨ item · wear · halo · trail · pet · shoulder · apron · pin · badge · book (받은 것만)
    bubble: S.bubble, kind: S.kind, anon: S.anon,
    praying: S.room === "worship" && S.praying,
    lying: S.lying && W.canLie(S.seat),
    dance: S.room === "praise" && S.dance ? S.dance : null,
    ground: S.room === "yard" && S.ground && !S.seat,
    bball: BB.holder === myId, bbSeq: BB.seq,
    jam: S.room === "praise" ? jamPresence() : null,
    skr: S.room === "yard" && typeof SK !== "undefined" ? skState() : null, // ⛸ 경주 중
    fig: S.room === "yard" && S.fig ? S.fig : null,                         // ⛸ 피겨 기술
    fpr: S.room === "yard" && typeof SK !== "undefined" && SK.prog && !SK.prog.done ? SK.prog.song.id : null, // 🩰 피겨 연기 중인 곡
    cd: S.room === "praise" ? S.cdShare || null : null,
    amens: S.amens, joinedAt: S.joinedAt,
    who: S.who || "", act: S.act, // 🧑 같은 사람(연결한 기기)인지 · 이 기기가 '나'가 된 시각 (기기 번호 대신 바꾼 값)
    pos: S.pos, seat: S.seat,
  };
}
function refreshMe() {
  S.peers = S.peers.filter((p) => p.id !== myId).concat(meState());
  renderPeople();
  api.update(meState());
  lobbyUpdate(); // 이름이 바뀌었을 때만 다시 보내요
}

/* ================= 말풍선 / 이름표 ================= */
function renderOverlay(ov, p, mine) {
  const text = clip(p.bubble, LIMIT.bubble + 40);
  const reacted = S.reactedLive.has(p.id + "|" + text);
  const key = [text, p.name, p.amens, reacted, mine, !!p.praying, S.room, p.badge, p.book, p.title, !!p.catBoss].join("|");
  if (ov.dataset.key === key) return;
  ov.dataset.key = key;
  ov.classList.toggle("mine", mine);
  const name = (clip(p.name, LIMIT.name) || "익명") + (mine ? " (나)" : "");
  ov.replaceChildren();
  if (text) {
    const [emo, title] = REACT[S.room] || REACT.yard;
    ov.append(h("div", { class: "bubble", onclick: (e) => { e.stopPropagation(); ov.classList.toggle("open"); } },
      h("div", { class: "btext", text }),
      h("div", { class: "bmeta" }, h("button", {
        class: "react" + (reacted ? " done" : ""), title,
        onclick: (e) => { e.stopPropagation(); reactLive(p, text); },
      }, emo, h("span", { text: String(Math.max(0, Number(p.amens) || 0)) })))));
  }
  if (p.praying) ov.append(h("div", { class: "praying-tag", text: "🙏 기도중" }));
  const tags = [typeof p.title === "string" && TITLE_TXT[p.title], p.book, p.badge, p.catBoss && S.room === "yard" ? "👑🐱" : ""].filter((x) => typeof x === "string" && x).map((x) => h("span", { class: "ntag", text: clip(x, 18) }));
  ov.append(h("div", { class: "name" + (p.title === "tree" ? " gold" : "") }, name, ...tags));
}
function renderPeople() {
  W.sync(S.peers);
  renderPeopleCount();
  if (S.room === "cafe") renderReadingNow(S.peers);
  if (S.room === "praise") { jamSyncLoops(); renderJamWho(); renderJamBar(); renderCdShare(); }
  if (!$("#peoplePop").hidden) renderPeopleList();
}
// 👥 위쪽 숫자 = 지금 그루터기 전체에 있는 사람 (모든 방 합쳐서)
S.lobby = [];
function lobbyAll() {
  const m = new Map(); for (const p of S.lobby) if (p && typeof p.id === "string") m.set(p.id, p);
  for (const p of S.peers) if (!m.has(p.id)) m.set(p.id, { id: p.id, name: p.name, color: p.color, room: S.room }); // 이 방 사람은 꼭 들어가게
  return [...m.values()];
}
function renderPeopleCount() { $("#peopleCount").textContent = lobbyAll().length; }
let lobbyKey = "";
function lobbyUpdate() {
  if (!started) return;
  if (S.away) return;
  const me = meState(), info = { id: myId, name: me.name, color: me.color, room: S.room, who: me.who, act: me.act }, key = JSON.stringify(info);
  if (key === lobbyKey) return; lobbyKey = key;
  api.lobbyJoin(info, (list) => { if (S.away) return; list = list.filter((p) => p && typeof p.id === "string" && ROOMS.includes(p.room)); checkTakeover(list); S.lobby = oneEach(list); renderPeopleCount(); if (!$("#peoplePop").hidden && !S.giveMode) renderPeopleList(); });
}
function renderReadingNow(peers) {
  const counts = {};
  for (const p of peers) { const m = /^📖 (\S+)/.exec(p.bubble || ""); if (m) counts[m[1]] = (counts[m[1]] || 0) + 1; }
  const box = $("#readingNow"); box.replaceChildren();
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) box.append(h("span", { class: "none", text: "아직 아무도 없어요. 첫 번째로 읽어볼까요?" }));
  for (const [book, n] of entries) box.append(h("span", { class: "chip", text: `${clip(book, 12)} ${n}명` }));
}
function dot(color) { const d = h("span", { class: "pdot" }); d.style.background = color || "#ccc"; return d; }
// 지금 이 방에 있는 사람 목록 (이름을 누르면 그 사람을 찾아가요)
function renderPeopleList() {
  const ul = $("#peopleList");
  $("#peopleTitle").textContent = S.giveMode ? `🎁 ${carryName()} 누구에게 줄까요?` : "지금 여기 있는 사람";
  let list = [...S.peers].sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : (a.joinedAt || 0) - (b.joinedAt || 0)));
  if (S.giveMode) {
    list = list.filter((p) => p.id !== myId);
    if (!list.length) { ul.replaceChildren(h("li", { class: "none", text: "지금 이 방에 다른 친구가 없어요. 친구가 오면 줄 수 있어요 🙂" })); return; }
    ul.replaceChildren(...list.map((p) => h("li", {}, h("button", { onclick: () => giveTo(p) }, dot(p.color),
      h("span", { class: "nm", text: (clip(p.name, LIMIT.name) || "익명") }), h("small", { text: "🎁 눌러서 주기" + (p.carry ? ` · 지금 ${CARRY[p.carry]?.emoji || ""} 들고 있음` : "") })))));
    return;
  }
  const others = lobbyAll().filter((p) => p.room !== S.room && p.id !== myId);
  $("#peopleTitle").textContent = `지금 그루터기에 ${lobbyAll().length}명`;
  const byRoom = ROOMS.filter((r) => r !== S.room).map((r) => [r, others.filter((p) => p.room === r)]).filter(([, l]) => l.length);
  const otherEls = byRoom.length ? [h("li", { class: "pp-sec", text: "다른 방에 있는 사람 · 누르면 그 방으로 가요" }),
    ...byRoom.flatMap(([r, l]) => l.map((p) => h("li", {}, h("button", { onclick: () => { $("#peoplePop").hidden = true; joinRoom(r, S.room); } }, dot(p.color),
      h("span", { class: "nm", text: clip(p.name, LIMIT.name) || "익명" }), h("small", { text: `${ROOM_NAME[r]}에 있어요 →` })))))] : [];
  ul.replaceChildren(h("li", { class: "pp-sec", text: `${ROOM_NAME[S.room]}에 있는 사람 ${list.length}명` }), ...list.map((p) => {
    const st = [p.praying ? "🙏 기도중" : "", p.dance && W.DANCES[p.dance.k] ? W.DANCES[p.dance.k] + " 추는 중" : "", p.ground ? "🌿 풀밭에 누워 있어요" : p.lying ? "🛌 누워 쉬는 중" : p.seat ? "앉아 있어요" : "", p.bubble ? "💬 " + clip(p.bubble, 22) : ""].filter(Boolean).join(" · ");
    return h("li", {}, h("button", { onclick: () => { if (W.focus(p.id) && window.innerWidth < 720) $("#peoplePop").hidden = true; } },
      dot(p.color), h("span", { class: "nm", text: (clip(p.name, LIMIT.name) || "익명") + (p.id === myId ? " (나)" : "") }),
      h("small", { text: st || "둘러보는 중" })));
  }), ...otherEls);
}
$("#peopleBtn").onclick = () => { const pop = $("#peoplePop"); S.giveMode = false; pop.hidden = !pop.hidden; if (!pop.hidden) renderPeopleList(); };
$("#peopleClose").onclick = () => { $("#peoplePop").hidden = true; S.giveMode = false; };

function floatAt(id, emoji, from) {
  const el = document.querySelector(`.ov[data-id="${CSS.escape(id)}"]`);
  if (!el || el.style.display === "none") return;
  const r = el.getBoundingClientRect();
  const f = h("div", { class: "floater" }, emoji, from ? h("small", { text: clip(from, 10) }) : null);
  f.style.left = r.left + r.width / 2 + "px"; f.style.top = r.top - 10 + "px";
  document.body.append(f); setTimeout(() => f.remove(), 1700);
}
function reactLive(p, text) {
  const key = p.id + "|" + text, emo = (REACT[S.room] || REACT.yard)[0];
  if (p.id === myId) { toast(S.room === "worship" ? "다른 사람들이 함께 기도해줄 거예요 🙂" : "다른 사람들이 반응해줄 거예요 🙂"); return; }
  if (S.reactedLive.has(key)) { toast("이미 눌렀어요 " + emo); return; }
  S.reactedLive.add(key);
  api.sendReact(p.id, clip(S.profile?.name, LIMIT.name) || "익명");
  floatAt(p.id, emo, "나");
  W.sync(S.peers);
}
function onReact({ target, from }) {
  if (typeof target !== "string") return;
  floatAt(target, (REACT[S.room] || REACT.yard)[0], clip(from, 10) || "익명");
  if (target === myId && S.bubble) { S.amens++; refreshMe(); }
}

/* ================= 연결 상태 ================= */
function onStatus(st) {
  const el = $("#connState");
  if (st === "ok") { el.hidden = true; return; }
  el.textContent = "⚠ 다시 연결하는 중…"; el.hidden = false;
}
const roomHandlers = {
  onPeers: (list) => {
    if (S.away) return;
    list = list.filter((p) => p && typeof p.id === "string" && p.id !== myId);
    checkTakeover(list);
    S.peers = oneEach(list).filter((p) => !(S.who && p.who === S.who)).concat(meState());
    if (S.room === "yard") bbPeers();
    renderPeople();
    // 처음 들어왔을 때 다른 사람과 같은 자리에 겹쳐 서 있으면 살짝 비켜서요
    if (S.needSpread && S.peers.length > 1) {
      S.needSpread = false;
      const others = S.peers.filter((p) => p.id !== myId && !p.seat && p.pos).map((p) => p.pos);
      if (!S.seat && others.some((o) => Math.hypot(o.x - S.pos.x, o.z - S.pos.z) < 0.6)) {
        const np = W.spawnFor(S.room, S.from, others);
        W.moveMe({ x: np.x, z: np.z });
      }
    }
  },
  onReact,
  onStatus,
  onGive,
  onCatFeed,
  onSport,
  onJam,
};

/* ================= 방 이동 ================= */
let worldReady = false, visitTimer = null;
function joinRoom(room, from) {
  if (S.room === "yard" && room !== "yard" && BB.holder === myId) bbDrop(); // 공은 운동장에 두고 가요
  if (typeof SK !== "undefined" && SK.race) { SK.race = null; W.raceMe = null; W.keyBlock = false; clearInterval(SK.tick); }
  if (typeof SK !== "undefined" && SK.prog) figAbort();
  if (room !== "yard" && typeof CW !== "undefined" && CW) catWalkEnd("🐾 실내로 들어가서 고양이가 콘도로 돌아갔어요");
  if (!$("#cookModal").hidden) closeModal("cookModal");
  if (!$("#cmGameModal").hidden) closeModal("cmGameModal");
  if (!$("#quizModal").hidden && !GB_ROOMS.includes(room)) closeModal("quizModal");
  if (!$("#songModal").hidden) closeModal("songModal");
  if (S.room === "praise" && room !== "praise") jamLeave(); // 연습실을 나가면 리듬·메트로놈·CD를 꺼요
  const prev = S.room;
  S.room = room;
  S.from = from || prev;
  S.joinedAt = Date.now();
  S.bubble = ""; S.amens = 0; S.praying = false; S.anon = false; S.lying = false; S.dance = null; S.ground = false; updateDanceBtns(); updateGroundBtn();
  S.kind = room === "worship" ? "prayer" : room === "cafe" ? "read" : "status";
  S.seat = null;
  S.pos = W.spawnFor(room, S.from);
  S.needSpread = true;
  W.setRoom(room);
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.room === room));
  $$(".panel").forEach((p) => (p.hidden = p.dataset.room !== room));
  for (const r of ROOMS) $("#composer-" + r).hidden = r !== room;
  updateLieBtn();
  $("#prayToggle").classList.remove("on"); $("#prayToggle").textContent = "🙏 기도하기";
  $("#anonChk").checked = false;
  $$(".stand-btn").forEach((b) => (b.hidden = true));
  $("#peoplePop").hidden = true;
  S.peers = [meState()];
  renderPeople();
  api.joinRoom(room, meState(), roomHandlers);
  mAdd("visit"); renderMissionBits(); // 🎯 오늘 출석
  lobbyUpdate();
  renderSportBar(true);
  if (Sound.on) Sound.start(room);
  const at = $(".tab.active"); if (at && at.scrollIntoView) try { at.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch (e) {}
  if (prev !== room && worldReady) toast(room === "worship" ? "본당(기도하는 공간)에 들어왔어요" : `${ROOM_NAME[room]}에 들어왔어요`);
  worldReady = true;
  lastTraceKey = "";
  renderTraces();
  if (GB_ROOMS.includes(room)) { loadGuestbook(room); loadQuizMeta(); }
  if (NOTICE_ROOMS[room]) loadNotices(room);
  if (room === "yard") { loadFood(); loadCatFeeds(); loadCookie(); setTimeout(loadRinkTop, 800); }
  if (room === "showroom") { loadCookie(); renderShowPanel(); }
  // 4초 넘게 머물면 "다녀갔어요" 발자취를 남겨요
  clearTimeout(visitTimer);
  visitTimer = setTimeout(() => { if (S.room === room) { leaveFootprint("visit"); maybeNotifyVisit(room); } }, 4000);
  if (room === "yard") { loadEvents(); loadSportBoard(); }
  if (room === "worship") loadThanks();
  if (room === "cafe" || room === "room301" || room === "vision") loadChallenge();
  if (room === "praise") { loadRecs(); loadSongs(); renderJamBar(true); }
  renderEvents();
}
// 같은 방에 그대로 다시 붙기 (폰에서 돌아왔을 때 등)
function rejoinSameRoom() { if (started) api.joinRoom(S.room, meState(), roomHandlers); }

/* ================= 마당 / 비전 / 301호 입력 (상태 메시지) ================= */
function bindStatus(inputSel, postSel, clearSel) {
  if (!$(inputSel)) return;
  const post = () => {
    const v = $(inputSel).value.trim();
    if (!v) { toast("상태 메시지를 적어주세요"); return; }
    if (!checkText(v)) return;
    S.bubble = clip(v, LIMIT.status); S.kind = "status"; S.amens = 0;
    $(inputSel).value = ""; // 올리고 나면 입력칸은 비워요
    refreshMe(); toast("말풍선을 올렸어요");
  };
  $(postSel).onclick = post;
  $(inputSel).addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) post(); });
  $(clearSel).onclick = () => { S.bubble = ""; S.amens = 0; $(inputSel).value = ""; refreshMe(); };
}
bindStatus("#yardInput", "#yardPost", "#yardClear");
bindStatus("#visionInput", "#visionPost", "#visionClear");
bindStatus("#r301Input", "#r301Post", "#r301Clear");
bindStatus("#praiseInput", "#praisePost", "#praiseClear");
bindStatus("#showInput", "#showPost", "#showClear");
// 소파 눕기 (비전 검은 소파, 301호 갈색 소파)
function updateLieBtn() {
  const can = W.canLie(S.seat);
  if (!can) S.lying = false;
  $$(".lie-btn").forEach((b) => {
    b.hidden = !can;
    b.textContent = S.lying ? "🪑 일어나 앉기" : "🛌 눕기";
    b.classList.toggle("on", S.lying);
  });
}
$$(".lie-btn").forEach((b) => b.onclick = () => {
  if (!S.lying && !W.sofaFree(S.seat)) { toast("옆에 다른 사람이 앉아 있어서 누울 수 없어요. 빈 소파에서 누워보세요 🙂"); return; }
  S.lying = !S.lying; updateLieBtn(); refreshMe();
  if (S.lying) toast("소파에 누웠어요. 푹 쉬어요 😌");
});
// 💃 춤추기 (찬양팀 연습실) — 고른 춤은 내 상태에 실려서 모두의 화면에서 같은 박자로 춰요
function danceBpm() { const b = S.room === "praise" ? jamKB().bpm : 112; return Math.max(90, Math.min(140, b < 90 ? b * 1.5 : b)); }
function updateDanceBtns() {
  $$(".dance-btn").forEach((b) => { b.textContent = S.dance ? `💃 ${W.DANCES[S.dance.k].replace(/^\S+\s/, "")} 추는 중 · 바꾸기` : "💃 춤추기"; b.classList.toggle("on", !!S.dance); });
  $$(".dance-stop").forEach((b) => (b.hidden = !S.dance));
}
function startDance(k) {
  if (S.room !== "praise" || !W.DANCES[k]) return;
  closeModal("danceModal");
  if (S.seat) { S.danceKeep = true; W.stand(); S.danceKeep = false; } // 악기 자리·의자에 있으면 일어나서 춰요
  S.dance = { k, t0: Date.now(), bpm: danceBpm() };
  updateDanceBtns(); refreshMe();
  toast(`${W.DANCES[k]} 시작! 다른 친구들에게도 보여요 🎶`);
}
function stopDance() { if (!S.dance) return; S.dance = null; updateDanceBtns(); refreshMe(); }
function openDance() {
  if (S.room !== "praise") return;
  $("#danceGrid").replaceChildren(...Object.entries(W.DANCES).map(([k, name]) => h("button", { class: "dance-pick" + (S.dance && S.dance.k === k ? " on" : ""), onclick: () => startDance(k) },
    h("span", { class: "big", text: name.split(" ")[0] }), h("span", { text: name.replace(/^\S+\s/, "") }))),
    h("button", { class: "dance-pick", onclick: () => { const ks = Object.keys(W.DANCES).filter((x) => !S.dance || x !== S.dance.k); startDance(ks[Math.floor(Math.random() * ks.length)]); } }, h("span", { class: "big", text: "🎲" }), h("span", { text: "아무거나" })));
  $("#danceStopBtn").hidden = !S.dance;
  openModal("danceModal");
}
$$(".dance-btn").forEach((b) => (b.onclick = openDance));
$$(".dance-stop").forEach((b) => (b.onclick = stopDance));
$("#danceStopBtn").onclick = () => { stopDance(); closeModal("danceModal"); };
// 🌿 마당 풀밭에 눕기
function updateGroundBtn() { $$(".ground-btn").forEach((b) => { b.textContent = S.ground ? "🧍 일어나기" : "🌿 풀밭에 눕기"; b.classList.toggle("on", S.ground); }); }
$$(".ground-btn").forEach((b) => (b.onclick = () => {
  if (S.room !== "yard") return;
  if (S.ground) { S.ground = false; updateGroundBtn(); refreshMe(); return; }
  const me = W.actorPos(myId);
  if (S.seat || !me || me.moving) { toast("걸음을 멈추고 잔디 위에서 눌러 주세요 🌿"); return; }
  if (!W.onGrass(me.x, me.z)) { toast("여기는 길이나 운동장이에요. 초록 잔디 위로 가서 눌러 주세요 🌿"); return; }
  S.ground = true; updateGroundBtn(); refreshMe();
  toast("풀밭에 누웠어요. 하늘 한번 올려다봐요 ☁️");
}));
$$("[data-go]").forEach((b) => (b.onclick = () => W.goDoor(b.dataset.go)));
$("#shelfBtn").onclick = () => openShelf();
if ($("#sledBtn")) $("#sledBtn").onclick = () => { if (W.goSled()) toast("놀이터 눈썰매 언덕으로 가는 중이에요 🛷"); };
$$(".stand-btn").forEach((b) => (b.onclick = () => W.stand()));

/* ================= 본당 입력 ================= */
function postPrayerBubble() {
  const v = $("#prayerInput").value.trim();
  if (!v) { toast("기도제목을 적어주세요. 말풍선 없이 앉아 있어도 괜찮아요 🙂"); return; }
  if (!checkText(v)) return;
  S.anon = $("#anonChk").checked;
  S.bubble = clip(v, LIMIT.bubble); S.kind = "prayer"; S.amens = 0;
  refreshMe();
  if ($("#keepChk").checked) addToWall(v, S.anon).then(() => { $("#keepChk").checked = false; });
  $("#prayerInput").value = "";
  leaveFootprint("pray"); mPray();
  toast("말풍선을 올렸어요");
}
$("#prayerPost").onclick = postPrayerBubble;
$("#prayerInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) postPrayerBubble(); });
$("#prayerClear").onclick = () => { S.bubble = ""; S.amens = 0; $("#prayerInput").value = ""; refreshMe(); };
$("#anonChk").onchange = () => { S.anon = $("#anonChk").checked; refreshMe(); };
$("#prayToggle").onclick = () => {
  S.praying = !S.praying;
  $("#prayToggle").classList.toggle("on", S.praying);
  $("#prayToggle").textContent = S.praying ? "🙏 기도중… (그만하기)" : "🙏 기도하기";
  refreshMe();
  if (S.praying) { toast("머리 위에 '기도중'이 표시돼요"); leaveFootprint("pray"); setTimeout(() => { if (S.praying && S.room === "worship") mPray(); }, 20000); } // 🎯 20초 넘게 기도하면 미션
};

/* ================= 성경 읽는 공간 입력 ================= */
function fillBookSel() {
  const opts = () => BOOKS.map(([n], i) => h("option", { value: i, text: n }));
  $("#bookSel").replaceChildren(...opts());
  $("#rdBook").replaceChildren(...opts());
  $("#bookSel").value = S.reading.book;
  fillChapSel();
}
function chapOpts(book) { return Array.from({ length: BOOKS[book][1] }, (_, i) => h("option", { value: i + 1, text: `${i + 1}장` })); }
function fillChapSel() {
  const n = BOOKS[S.reading.book][1];
  if (S.reading.chap > n) S.reading.chap = 1;
  $("#chapSel").replaceChildren(...chapOpts(S.reading.book));
  $("#chapSel").value = S.reading.chap;
}
function setReading(book, chap) {
  S.reading = { book, chap }; store.set("reading", S.reading);
  $("#bookSel").value = book; fillChapSel();
}
$("#bookSel").onchange = () => { S.reading.book = +$("#bookSel").value; S.reading.chap = 1; fillChapSel(); store.set("reading", S.reading); };
$("#chapSel").onchange = () => { S.reading.chap = +$("#chapSel").value; store.set("reading", S.reading); };
$$("#composer-cafe .seg-btn").forEach((b) => b.onclick = () => {
  S.cafeMode = b.dataset.mode;
  $$("#composer-cafe .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
  $("#readFields").hidden = S.cafeMode !== "read";
  $("#statusFields").hidden = S.cafeMode !== "status";
  $("#doneChap").hidden = S.cafeMode !== "read";
});
const chapLabel = (book, chap) => `${BOOKS[book][0]} ${chap}장`;
function readingLabel() { return chapLabel(S.reading.book, S.reading.chap); }
function postCafeBubble() {
  let text;
  if (S.cafeMode === "read") {
    const memo = $("#verseMemo").value.trim();
    if (memo && !checkText(memo)) return;
    text = "📖 " + readingLabel() + (memo ? " · " + clip(memo, LIMIT.bubble) : "");
    S.kind = "read";
  } else {
    const v = $("#statusInput").value.trim();
    if (!v) { toast("상태 메시지를 적어주세요"); return; }
    if (!checkText(v)) return;
    text = clip(v, LIMIT.status); S.kind = "status";
  }
  S.bubble = text; S.amens = 0;
  $("#verseMemo").value = ""; $("#statusInput").value = "";
  refreshMe(); toast("말풍선을 올렸어요");
}
$("#cafePost").onclick = postCafeBubble;
$("#verseMemo").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) postCafeBubble(); });
$("#statusInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) postCafeBubble(); });
$("#cafeClear").onclick = () => { S.bubble = ""; S.amens = 0; $("#verseMemo").value = ""; $("#statusInput").value = ""; refreshMe(); };
function nextChap(book, chap) {
  if (chap < BOOKS[book][1]) return [book, chap + 1];
  if (book < BOOKS.length - 1) return [book + 1, 1];
  return [book, chap];
}
function prevChap(book, chap) {
  if (chap > 1) return [book, chap - 1];
  if (book > 0) return [book - 1, BOOKS[book - 1][1]];
  return [book, chap];
}
// "다 읽었어요": 통독표에 체크 + 발자취에 남기고 다음 장으로
function finishChapter(book, chap) {
  markRead(book, chap, true);
  logRead(book, chap);
  const label = chapLabel(book, chap), [nb, nc] = nextChap(book, chap);
  setReading(nb, nc);
  $("#verseMemo").value = "";
  toast(`${label} 완료! 다음: ${readingLabel()}`);
  if (S.room === "cafe" && S.kind === "read" && S.bubble) { S.bubble = "📖 " + readingLabel(); S.amens = 0; refreshMe(); }
  return [nb, nc];
}
$("#doneChap").onclick = () => finishChapter(S.reading.book, S.reading.chap);

/* ================= 성경 본문 읽기 (개역한글, bible/ 폴더) ================= */
const Bible = {
  cache: new Map(),
  get(b) {
    if (!this.cache.has(b)) {
      const p = fetch(`bible/${b + 1}.json`).then((r) => { if (!r.ok) throw new Error("본문을 불러오지 못했어요"); return r.json(); });
      p.catch(() => this.cache.delete(b));
      this.cache.set(b, p);
    }
    return this.cache.get(b);
  },
};
const RD = { book: 0, chap: 1, timer: null, sec: 0, logged: false };
function openReader(book, chap) {
  RD.book = book; RD.chap = chap;
  openModal("readerModal");
  if (S.room === "cafe" && (!S.bubble || S.kind === "read")) {
    setReading(book, chap);
    S.bubble = "📖 " + chapLabel(book, chap) + " 읽는 중"; S.kind = "read"; S.amens = 0; refreshMe();
  }
  renderReader();
}
async function renderReader() {
  const { book, chap } = RD;
  $("#rdBook").value = book;
  $("#rdChap").replaceChildren(...chapOpts(book)); $("#rdChap").value = chap;
  const body = $("#rdBody");
  body.replaceChildren(h("p", { class: "muted", text: "불러오는 중…" }));
  stopReaderTimer();
  try {
    const data = await Bible.get(book);
    if (RD.book !== book || RD.chap !== chap) return;
    const vs = data.chapters[chap - 1] || [];
    body.replaceChildren(h("h3", { class: "rd-title", text: chapLabel(book, chap) }),
      ...vs.map((t, i) => (t ? h("p", { class: "v" }, h("sup", { text: i + 1 }), t) : null)));
    body.scrollTop = 0;
    startReaderTimer();
  } catch (e) {
    body.replaceChildren(h("p", { class: "muted", text: "본문을 불러오지 못했어요. 인터넷 연결을 확인해 주세요." }));
  }
}
// 화면을 보고 있는 시간이 1분이 넘으면 "읽었어요" 발자취를 자동으로 남겨요 (같은 장은 하루 한 번)
function startReaderTimer() {
  RD.sec = 0; RD.logged = false;
  $("#rdNote").textContent = "1분 넘게 읽으면 발자취에 자동으로 남아요 · 개역한글";
  RD.timer = setInterval(() => {
    if (document.visibilityState !== "visible" || $("#readerModal").hidden) return;
    if (++RD.sec >= 60 && !RD.logged) {
      RD.logged = true; logRead(RD.book, RD.chap);
      $("#rdNote").textContent = `👣 ${chapLabel(RD.book, RD.chap)}을 읽은 발자취를 남겼어요`;
    }
  }, 1000);
}
function stopReaderTimer() { clearInterval(RD.timer); RD.timer = null; }
function goReader(book, chap) { RD.book = book; RD.chap = chap; renderReader(); }
$("#rdBook").onchange = () => goReader(+$("#rdBook").value, 1);
$("#rdChap").onchange = () => goReader(RD.book, +$("#rdChap").value);
$("#rdPrev").onclick = () => goReader(...prevChap(RD.book, RD.chap));
$("#rdNext").onclick = () => goReader(...nextChap(RD.book, RD.chap));
$("#rdDone").onclick = () => { RD.logged = true; const [nb, nc] = finishChapter(RD.book, RD.chap); goReader(nb, nc); };
$("#openReader").onclick = () => openReader(S.reading.book, S.reading.chap);

/* ================= 통독 ================= */
const TOTAL_CHAPS = BOOKS.reduce((s, b) => s + b[1], 0);
function readCount() { return Object.values(S.progress).reduce((s, a) => s + a.length, 0); }
function markRead(book, chap, on) {
  const k = String(book);
  const set = new Set(S.progress[k] || []);
  on ? set.add(chap) : set.delete(chap);
  S.progress[k] = [...set].sort((a, b) => a - b);
  store.set("progress", S.progress);
  renderProgress();
  onMarkRead(book, chap, on);
}
function renderProgress() {
  const n = readCount();
  const pct = TOTAL_CHAPS ? (n / TOTAL_CHAPS) * 100 : 0;
  $("#progressBar").style.width = pct.toFixed(1) + "%";
  $("#progressTxt").textContent = `${TOTAL_CHAPS}장 중 ${n}장 읽음 (${pct.toFixed(1)}%)`;
  $("#planSummary").textContent = `${TOTAL_CHAPS}장 중 ${n}장 읽었어요 · ${pct.toFixed(1)}%`;
}
function renderPlanBooks() {
  $("#planChaps").hidden = true; $("#planBooks").hidden = false;
  $("#planBooks").replaceChildren(...BOOKS.map(([name, n], i) => {
    const r = (S.progress[i] || []).length;
    const b = h("button", { class: "plan-book" + (r === n ? " done" : ""), onclick: () => renderPlanChaps(i) },
      h("div", { class: "fill" }), h("span", { text: name }), h("span", { class: "pct", text: `${r}/${n}` }));
    b.firstChild.style.width = (r / n) * 100 + "%";
    return b;
  }));
}
function renderPlanChaps(i) {
  const [name, n] = BOOKS[i];
  const read = new Set(S.progress[i] || []);
  const box = $("#planChaps");
  $("#planBooks").hidden = true; box.hidden = false;
  box.replaceChildren(
    h("div", { class: "back" }, h("button", { class: "btn ghost sm", text: "← 전체", onclick: renderPlanBooks }), h("b", { text: name }),
      h("button", { class: "btn ghost sm", text: read.size === n ? "모두 해제" : "모두 읽음", onclick: () => { for (let c = 1; c <= n; c++) markRead(i, c, read.size !== n); renderPlanChaps(i); } })),
    ...Array.from({ length: n }, (_, c) => h("button", {
      class: "chap" + (read.has(c + 1) ? " read" : ""), text: c + 1,
      onclick: (e) => { const on = !read.has(c + 1); markRead(i, c + 1, on); on ? read.add(c + 1) : read.delete(c + 1); e.currentTarget.classList.toggle("read", on); },
    })),
  );
}
$("#planBtn").onclick = () => { renderProgress(); renderPlanBooks(); openModal("planModal"); };
$$("[data-open-plan]").forEach((b) => (b.onclick = () => $("#planBtn").click()));

/* ================= 오늘의 말씀 (매일 자동) / 공동 기도제목 ================= */
function todayVerse() {
  if (!VERSES.length) return null;
  const [y, m, d] = nyDay().split("-").map(Number);
  const dayNum = Math.floor(Date.UTC(y, m - 1, d) / 86400000), n = VERSES.length;
  const step = n % 7 ? 7 : 11; // 같은 책 구절이 며칠 연달아 나오지 않게 섞어서 돌려요
  return VERSES[(dayNum * step) % n];
}
let verseDay = "";
function renderVerse() {
  const v = todayVerse(); if (!v) return;
  verseDay = nyDay();
  $$("[data-verse-text]").forEach((e) => (e.textContent = v.text));
  $$("[data-verse-ref]").forEach((e) => (e.textContent = v.ref + " (개역한글)"));
  $$("[data-read-today]").forEach((b) => { b.textContent = `📖 ${BOOKS[v.b - 1][0]} ${v.c}장 전체 읽기`; b.onclick = () => openReader(v.b - 1, v.c); });
}
async function loadGroup() {
  try {
    const list = await api.listGroup();
    const ul = $("#groupList");
    ul.replaceChildren();
    if (!list.length) ul.append(h("li", { class: "empty", text: "아직 올라온 공동 기도제목이 없어요." }));
    const sorted = [...list].sort((a, b) => a.answered - b.answered);
    for (const g of sorted) ul.append(h("li", { class: g.answered ? "answered" : "", text: clip(g.content, 300) + (g.answered ? " — 응답됐어요" : "") }));
    if (isAll()) renderAdminGroup(list);
  } catch (e) { console.warn(e); }
}

/* ================= 방명록 (비전 / 301호, 방마다 따로) ================= */
const gbRoom = () => (GB_ROOMS.includes(S.room) ? S.room : "room301");
const gbErr = {};
async function loadGuestbook(room = gbRoom()) {
  try { S.gb[room] = await api.listGuestbook(room); gbErr[room] = false; }
  catch (e) { console.warn("방명록을 불러오지 못했어요. supabase-update-footprints.sql 실행 여부를 확인해 주세요.", e.message); gbErr[room] = true; }
  renderGuestbook(room);
}
function renderGuestbook(room) {
  const list = S.gb[room] || [];
  W.setGuestbook(room, list);
  const ul = $(`#panel-${room} [data-gb-recent]`);
  if (ul) {
    ul.replaceChildren();
    if (!list.length) ul.append(h("li", { class: "none", text: gbErr[room] ? "방명록을 불러오지 못했어요." : "아직 아무도 안 썼어요. 첫 쪽지를 붙여볼까요?" }));
    for (const g of list.slice(0, 5)) ul.append(h("li", {}, h("span", { class: "t", text: `${g.name || "익명"} · ${g.content}` }), h("small", { text: timeAgo(g.created_at) })));
  }
  if (!$("#gbModal").hidden && room === gbRoom()) renderGbList();
}
function renderGbList() {
  const room = gbRoom(), list = S.gb[room] || [];
  const ul = $("#gbList"), mine = new Set(S.myGb);
  ul.replaceChildren();
  if (!list.length) { ul.append(h("li", { class: "empty-msg", text: "아직 쪽지가 없어요." })); return; }
  for (const g of list) {
    const isMine = mine.has(g.id);
    ul.append(h("li", { class: "gb-item" },
      h("p", { text: g.content }),
      h("div", { class: "who" }, h("span", { text: (g.name || "익명") + (isMine ? " · 나" : "") + " · " + timeAgo(g.created_at) }), h("span", { class: "grow" }),
        isMine ? h("button", { class: "btn ghost sm", text: "삭제", onclick: () => gbDo(() => api.deleteMyGuestbook(g.id), "삭제했어요") }) : null,
        !isMine ? h("button", { class: "btn ghost sm", text: "⚑ 신고", onclick: () => gbDo(() => api.reportGuestbook(g.id), "신고했어요. 3번 쌓이면 가려져요") }) : null,
        isAll() ? h("button", { class: "btn danger sm", text: "관리자 삭제", onclick: () => gbDo(() => api.adminDeleteGuestbook(S.admin, g.id), "삭제했어요") }) : null)));
  }
}
async function gbDo(fn, msg) { try { await fn(); toast(msg); loadGuestbook(); } catch (e) { toast(e.message); } }
function openGuestbook() {
  const nm = ROOM_NAME[gbRoom()];
  $("#gbTitle").textContent = `📝 ${nm} 방명록`;
  $("#gbSub").textContent = `${nm} 벽에 쪽지로 붙어요. 다녀간 인사, 응원 한마디 남겨주세요 (최대 80자).`;
  $("#gbInput").placeholder = gbRoom() === "vision" ? "예: 오늘 비전실 모임 너무 좋았어요 🙌 다음 주에 또 봐요!" : "예: 오늘 301호 너무 아늑했어요 ☕ 다음 주에 또 봐요!";
  openModal("gbModal"); renderGbList(); loadGuestbook(); setTimeout(() => $("#gbInput").focus(), 50);
}
$$(".gb-open").forEach((b) => (b.onclick = openGuestbook));
$("#gbPost").onclick = async () => {
  const v = $("#gbInput").value.trim(), room = gbRoom();
  if (!v) { toast("한마디 적어주세요 🙂"); return; }
  if (!checkText(v)) return;
  try {
    const id = await api.addGuestbook(room, $("#gbAnon").checked ? "" : clip(S.profile?.name, LIMIT.name), clip(v, 80));
    S.myGb.push(Number(id)); store.set("myGb", S.myGb);
    $("#gbInput").value = ""; toast(`${ROOM_NAME[room]} 벽에 쪽지를 붙였어요 📝`);
    loadGuestbook(room);
  } catch (e) { toast(e.message || "붙이지 못했어요. 잠시 후 다시 해주세요"); }
};

/* ================= 간식 들고 다니기 · 먹기 · 주기 ================= */
const CARRY = W.CARRY;
const hasBatchim = (w) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
const eul = (w) => w + (hasBatchim(w) ? "을" : "를");
const carryName = () => (S.carry && CARRY[S.carry] ? eul(CARRY[S.carry].name) : "");
function setCarry(kind, msg) {
  S.carry = kind; refreshMe(); renderCarryBar();
  if (msg) toast(msg);
}
function renderCarryBar() {
  const bar = $("#carryBar");
  if (!S.carry || !CARRY[S.carry]) { bar.hidden = true; return; }
  const c = CARRY[S.carry];
  bar.hidden = false;
  $("#carryWhat").textContent = `${c.emoji} ${c.name} 들고 있어요`;
}
$("#carryEat").onclick = () => {
  if (!S.carry) return;
  const nm = CARRY[S.carry].name;
  S.eatN++; S.carry = null; refreshMe(); renderCarryBar();
  toast(`냠냠 😋 ${nm} 맛있다!`);
};
$("#carryGive").onclick = () => { S.giveMode = true; $("#peoplePop").hidden = false; renderPeopleList(); };
$("#carryDrop").onclick = () => setCarry(null, "내려놓았어요");
function giveTo(p) {
  if (!S.carry) return;
  const kind = S.carry, nm = clip(p.name, LIMIT.name) || "익명 친구";
  api.sendGive(p.id, clip(S.profile?.name, LIMIT.name) || "익명", kind);
  floatAt(p.id, "🎁");
  S.giveMode = false; $("#peoplePop").hidden = true; mAdd("give");
  setCarry(null, `${nm}에게 ${CARRY[kind].emoji} ${eul(CARRY[kind].name)} 줬어요 🎁`);
}
function onGive({ target, from, kind }) {
  if (typeof target !== "string" || !CARRY[kind]) return;
  floatAt(target, "🎁");
  if (target === myId) setCarry(kind, `🎁 ${clip(from, 10) || "익명"}님이 ${CARRY[kind].emoji} ${eul(CARRY[kind].name)} 줬어요!`);
}

/* ================= 북카페 간식 선반 ================= */
const SHELF = ["ramen", "iceame", "icecream", "latte", "tea", "choco"];
function openShelf() {
  $("#shelfList").replaceChildren(...SHELF.map((k) => h("button", { class: "shelf-item", onclick: () => { closeModal("shelfModal"); setCarry(k, `${CARRY[k].emoji} ${eul(CARRY[k].name)} 들었어요. 들고 다니다가 먹거나 친구에게 줄 수 있어요`); } },
    h("span", { class: "em", text: CARRY[k].emoji }), h("span", { text: CARRY[k].name }))));
  openModal("shelfModal");
}

/* ================= 고양이 콘도 · 밥 주기 ================= */
const CAT_FOOD = { dry: ["🥣", "건사료"], wet: ["🥫", "캔사료"], churu: ["🍬", "츄르"], water: ["💧", "물"] };
let catFeeds = [];
async function loadCatFeeds() {
  try { catFeeds = await api.listCatFeeds(); } catch (e) { console.warn("고양이 밥 기록을 불러오지 못했어요 (SQL 실행 여부 확인):", e.message); return; }
  const today = catFeeds.filter((f) => isToday(f.created_at)), last = catFeeds[0];
  W.setCatFeedLog({ today: today.length, last: last ? { name: last.name, kind: last.kind, ago: timeAgo(last.created_at) } : null });
  if (last && Date.now() - new Date(last.created_at).getTime() < 70000) W.catFeed(new Date(last.created_at).getTime());
  if (!$("#catModal").hidden) renderCatFood();
}
// ---- 🐾 고양이 친밀도 · 성격 · 특식 · 30분 산책 (2026-11-18) ----
// CATS 순서: 0 샤샤 · 1 까맹이 · 2 껌딱지 · 3 탐 · 4 브라우니
const CAT_RULE = [
  { need: 20, trait: "밥 많이 주는 사람을 잘 따라가요" },
  { need: 60, pets: 30, trait: "독립적이에요. 밥도 많이, 쓰다듬기도 정성껏 해야 해요 · 산책 중에 가끔 혼자 딴 데 갔다 와요" },
  { with: 0, trait: "샤샤 껌딱지예요. 샤샤를 데려가면 같이 따라와요" },
  { need: 40, days: 3, trait: "낯을 가려요. 최근 7일 중 3일 이상 와서 밥을 줘야 마음을 열어요" },
  { need: 50, days: 5, trait: "낯을 많이 가려요. 최근 7일 중 5일 이상 와서 밥을 줘야 해요" },
];
const TREATS = { salmon: { e: "🐟", name: "연어 큐브", fav: 0 }, catnip: { e: "🌿", name: "캣닢 쿠션", fav: 1 }, yarn: { e: "🧶", name: "털실 공", fav: 2 }, chicken: { e: "🍗", name: "닭가슴살", fav: 3 }, shrimp: { e: "🦐", name: "새우", fav: 4 } };
const TREAT_KEYS = Object.keys(TREATS), CAT_WALK_MIN = 30, CAT_CAP_FROM = "2026-11-19"; // 이날부터 기본 밥은 하루 3번까지만 친밀도에 쳐요
function catStats() {
  const aff = [0, 0, 0, 0, 0], tN = dIdx(nyDay()); let pets = 0, days7 = 0;
  for (const [d, day] of Object.entries(MS.log)) {
    const feed = Number(day.catfeed || 0), base = d < CAT_CAP_FROM ? feed : Math.min(feed, 3);
    for (let i = 0; i < 5; i++) aff[i] += base;
    for (const k of TREAT_KEYS) { const n = Number(day["treat:" + k] || 0); if (!n) continue; for (let i = 0; i < 5; i++) aff[i] += n * (1 + (TREATS[k].fav === i ? 2 : 0)); }
    pets += Number(day.catpet || 0);
    if (feed && tN - dIdx(d) < 7) days7++;
  }
  return { aff, pets, days7 };
}
// 고양이 i가 나를 따라오는지 + 진행도
function catOpen(i, st = catStats()) { // true면 나를 따라와요
  const R = CAT_RULE[i];
  if (R.with != null) return catOpen(R.with, st);
  return st.aff[i] >= R.need && (!R.pets || st.pets >= R.pets) && (!R.days || st.days7 >= R.days);
}
function catBoss(st = catStats()) { return [0, 1, 3, 4].every((i) => catOpen(i, st)); }
// 🎒 간식 가방: 미션 도장(하루 1개) · 7일 연속 출석(2개)으로 받고, 준 만큼 빠져요
function treatBag() {
  const got = Object.fromEntries(TREAT_KEYS.map((k) => [k, 0])), used = { ...got };
  const days = Object.keys(MS.log).sort(); let run = 0, prev = null;
  for (const d of days) {
    const day = MS.log[d];
    if (day.stamp) got[TREAT_KEYS[hash2(dIdx(d) * 3 + 1, tokHash) % 5]]++;
    if (day.visit) { run = prev != null && dIdx(d) - prev === 1 ? run + 1 : 1; prev = dIdx(d); if (run % 7 === 0) { got[TREAT_KEYS[hash2(dIdx(d) * 3 + 2, tokHash) % 5]]++; got[TREAT_KEYS[hash2(dIdx(d) * 3 + 3, tokHash) % 5]]++; } }
    for (const k of TREAT_KEYS) used[k] += Number(day["treat:" + k] || 0);
  }
  return Object.fromEntries(TREAT_KEYS.map((k) => [k, Math.max(0, got[k] - used[k])]));
}
const treatsToday = () => TREAT_KEYS.reduce((a, k) => a + Number((MS.log[nyDay()] || {})["treat:" + k] || 0), 0);
// 지금 산책 중 (내 기기): { cats: [번호], start, until }
let CW = store.get("catWalk", null);
function catWalkOn() { return !!(CW && Date.now() < CW.until && S.room === "yard"); }
function catWalkLook() {
  const on = catWalkOn() && Date.now() >= CW.start;
  return { pet: on ? CW.cats[0] : -1, pets: on ? CW.cats : [], petAt: on ? CW.start : 0, catBoss: catBoss() };
}
function catWalkEnd(msg) { if (!CW) return; CW = null; store.set("catWalk", null); refreshMe(); if (msg) toast(msg); }
// 다른 사람이 데리고 있는 고양이: { 번호: {name, at} }
function catsBusy() {
  const out = {};
  for (const p of S.peers) if (p.id !== myId && Array.isArray(p.pets)) for (const k of p.pets) out[k] = { name: p.name || "친구", at: p.petAt || 0 };
  return out;
}
// 같은 고양이를 두 사람이 데려가면 먼저 산책을 시작한 사람이 이겨요
setInterval(() => {
  if (!CW) return;
  if (Date.now() >= CW.until) return catWalkEnd("🐾 산책 30분이 끝났어요. 고양이가 콘도로 돌아가요");
  if (S.room !== "yard" || Date.now() < CW.start) return;
  if (!CW.shown) { CW.shown = true; refreshMe(); toast(`🐾 ${CW.cats.map((k) => W.CATS[k].name).join(", ")}가 따라와요! (${CAT_WALK_MIN}분)`); }
  const busy = catsBusy(), lost = CW.cats.filter((k) => busy[k] && (busy[k].at < CW.start || (busy[k].at === CW.start && false)));
  if (lost.length) {
    CW.cats = CW.cats.filter((k) => !lost.includes(k)); store.set("catWalk", CW);
    toast(`🐾 ${lost.map((k) => W.CATS[k].name).join(", ")}는 먼저 ${clip(busy[lost[0]].name, 8)}님과 산책 중이었어요`);
    if (!CW.cats.length) catWalkEnd(); else refreshMe();
  }
}, 2000);
const hearts = (a, n) => { const k = Math.max(0, Math.min(5, Math.round((Math.min(a, n) / n) * 5))); return "💛".repeat(k) + "🤍".repeat(5 - k); };
let catPick = new Set();
function renderCatFood() {
  const today = catFeeds.filter((f) => isToday(f.created_at)), st = catStats(), boss = catBoss(st), busy = catsBusy(), bag = treatBag(), tt = treatsToday();
  const cards = W.CATS.map((c, i) => {
    const R = CAT_RULE[i], open = catOpen(i, st), mine = CW && CW.cats.includes(i) && Date.now() < CW.until;
    const b = busy[i], can = (open || (boss && i === 2)) && !b;
    const prog = R.with != null ? (boss ? "👑 대장이라 혼자도 따라와요" : `샤샤와 같이 와요`) :
      [`밥·특식 ${Math.min(st.aff[i], R.need)}/${R.need}`, R.pets ? `쓰다듬기 ${Math.min(st.pets, R.pets)}/${R.pets}` : "", R.days ? `이번 주 ${Math.min(st.days7, R.days)}/${R.days}일` : ""].filter(Boolean).join(" · ");
    const sel = catPick.has(i);
    return h("button", { class: "cat-card" + (sel ? " sel" : "") + (can ? "" : " lock"), disabled: !can || null, onclick: () => {
      if (!boss) { const keep = sel; catPick.clear(); if (!keep) { catPick.add(i); if (i === 0) catPick.add(2); } } else { sel ? catPick.delete(i) : catPick.add(i); }
      renderCatFood(); } },
      h("b", { text: `${sel ? "☑ " : ""}🐱 ${c.name} ${c.sex}` }),
      h("span", { class: "hearts", text: R.with != null ? "" : hearts(st.aff[i], R.need) }),
      h("small", { text: mine ? "🐾 나와 산책 중" : b ? `🐾 ${clip(b.name, 8)}님과 산책 중` : open || (boss && i === 2) ? "✓ 같이 갈 수 있어요" : prog }),
      h("small", { class: "trait", text: R.trait }));
  });
  const feedBtn = (k, em, nm, cnt, treat) => h("button", { class: "shelf-item" + (treat && !cnt ? " empty" : ""), disabled: (treat && (!cnt || tt >= 2)) || null, onclick: () => feedCats(k) },
    h("span", { class: "em", text: em }), h("span", { text: nm }), treat ? h("small", { class: "cnt", text: `${cnt}개` + (TREATS[k] ? ` · ${W.CATS[TREATS[k].fav].name}가 좋아해요` : "") }) : null);
  $("#catBody").replaceChildren(...[
    h("p", { class: "muted", text: `오늘 밥 ${today.length}번 받았어요. 밥을 주면 고양이들이 달려와서 먹고, 고른 고양이와 ${CAT_WALK_MIN}분 산책해요 🐾` }),
    boss ? h("p", { class: "cat-boss", text: "👑 고양이 대장! 산책할 고양이를 원하는 만큼 골라요" }) : null,
    h("div", { class: "board-label", text: `🐾 같이 산책할 고양이 ${boss ? "(여러 마리 가능)" : "(한 마리 · 샤샤는 껌딱지와 함께)"}` }),
    h("div", { class: "cat-cards" }, ...cards),
    CW && Date.now() < CW.until ? h("p", { class: "muted tiny", text: `지금 ${CW.cats.map((k) => W.CATS[k].name).join(", ")}와 산책 중 · ${Math.max(1, Math.ceil((CW.until - Date.now()) / 60000))}분 남았어요` }) : null,
    h("div", { class: "board-label", text: "🥣 기본 밥 (모두 +1 · 하루 3번까지 쳐요)" }),
    h("div", { class: "shelf-list" }, ...Object.entries(CAT_FOOD).map(([k, [em, nm]]) => feedBtn(k, em, nm, 0, false))),
    h("div", { class: "board-label", text: `🎒 특식 (모두 +2 · 좋아하는 고양이 +4 · 하루 2개까지, 오늘 ${tt}/2)` }),
    h("div", { class: "shelf-list" }, ...TREAT_KEYS.map((k) => feedBtn(k, TREATS[k].e, TREATS[k].name, bag[k], true))),
    h("p", { class: "muted tiny", text: "특식은 오늘의 미션 3개를 다 하면 1개, 7일 연속으로 오면 2개 받아요. 고양이를 누르면 쓰다듬기(하루 10번)도 돼요." }),
    h("div", { class: "board-label", style: "margin-top:12px", text: "🐾 최근에 밥 준 사람" }),
    h("ul", { class: "recent-list" }, ...(catFeeds.length ? catFeeds.slice(0, 6).map((f) => { const fd = CAT_FOOD[f.kind] || (TREATS[f.kind] ? [TREATS[f.kind].e, TREATS[f.kind].name] : null); return h("li", {}, h("span", { class: "t", text: `${f.name || "익명"} · ${fd ? fd.join(" ") : f.kind}` }), h("small", { text: timeAgo(f.created_at) })); })
      : [h("li", { class: "none", text: "아직 기록이 없어요." })]))].filter(Boolean));
}
function openCatFood() { if (S.room !== "yard") return; catPick = new Set(CW && Date.now() < CW.until ? CW.cats : []); renderCatFood(); openModal("catModal"); loadCatFeeds(); }
async function feedCats(kind) {
  const name = clip(S.profile?.name, LIMIT.name), treat = TREATS[kind], [em, nm] = treat ? [treat.e, treat.name] : CAT_FOOD[kind];
  if (treat && (treatBag()[kind] < 1 || treatsToday() >= 2)) return toast("🎒 특식은 하루 2개까지예요");
  try { await api.feedCat(kind, name); } catch (e) { toast(e.message); return; }
  closeModal("catModal"); mAdd("catfeed"); if (treat) mAdd("treat:" + kind);
  const spot = W.catFeedSpot(); if (spot) W.moveMe({ x: spot.x, z: spot.z });
  W.catFeed(Date.now());
  api.sendCatFeed(name || "익명", kind);
  S.bubble = `${em} 고양이들 ${eul(nm)} 주는 중 🐾`; S.kind = "status"; S.amens = 0;
  // 🐾 고른 고양이와 산책: 밥을 다 먹으면(70초) 30분 동안 따라와요
  const busy = catsBusy(), boss = catBoss(), picks = [...catPick].filter((k) => !busy[k] && (CAT_RULE[k].with != null ? catOpen(0) || boss : catOpen(k))).slice(0, boss ? 5 : 2);
  if (picks.length) { const start = Date.now() + 70000; CW = { cats: picks, start, until: start + CAT_WALK_MIN * 60000 }; store.set("catWalk", CW); }
  refreshMe();
  if (treat) { const fv = W.CATS[treat.fav]; toast(`${em} ${eul(nm)} 줬어요! ${fv.name}가 엄청 좋아해요 💕 (${fv.name} +4 · 모두 +2)`); }
  else toast(`${em} ${eul(nm)} 줬어요! 고양이들이 달려와요 🐾`);
  if (picks.length) setTimeout(() => toast(`🐾 다 먹으면 ${picks.map((k) => W.CATS[k].name).join(", ")}가 ${CAT_WALK_MIN}분 동안 따라와요`), 2200);
  loadCatFeeds();
}
function onCatFeed({ name, kind }) {
  W.catFeed(Date.now());
  const f = CAT_FOOD[kind] || (TREATS[kind] ? [TREATS[kind].e, TREATS[kind].name] : null); if (f) toast(`🐾 ${clip(name, 10) || "익명"}님이 고양이들에게 ${f[0]} ${eul(f[1])} 줬어요`);
  setTimeout(loadCatFeeds, 1500);
}
function catPetted(i) { if (mAdd("catpet")) { const st = catStats(); if (i === 1 && st.pets <= CAT_RULE[1].pets) toast(`💕 까맹이가 조금 마음을 열었어요 (쓰다듬기 ${st.pets}/${CAT_RULE[1].pets})`); } }

/* ================= 푸드 트럭 (타코야끼 · 붕어빵) ================= */
const TRUCK = {
  tako: { name: "타코야끼", emoji: "🐙", unit: "접시", seat: "TK-0", per: 1, desc: "9구 판에 반죽을 붓고, 문어를 넣고, 하나씩 뒤집어서 동글동글하게 구워요." },
  bungeo: { name: "붕어빵", emoji: "🐟", unit: "개", seat: "BG-0", per: 3, desc: "붕어 틀에 반죽을 붓고, 팥을 넣고, 덮어서 구워요.", note: "💛 붕어빵 수익금은 캄보디아 벧엘 국제학교 아이들 장학금으로 쓰여요." },
};
let FOOD = null;
// 🧍 손님(NPC): 뉴욕 시간 오전 7시 ~ 밤 10시에 와서 사 가요. 남은 게 없으면 줄을 서요(최대 8명)
const FOOD_OPEN = [7, 22];
function nyHourMin(ms) { const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(ms)); return [Number(p.find((x) => x.type === "hour").value) % 24, Number(p.find((x) => x.type === "minute").value)]; }
function foodOpenAt(ms) { const hr = nyHourMin(ms)[0]; return hr >= FOOD_OPEN[0] && hr < FOOD_OPEN[1]; }
function foodRate(kind, hr) { let r = kind === "tako" ? 0.12 : 0.18; if ([12, 13, 18, 19].includes(hr)) r *= 1.6; else if (hr < 9 || hr >= 21) r *= 0.6; return r; }
function foodHash(kind, m) { let h = Math.imul((m | 0) ^ (kind === "tako" ? 0x5bd1e995 : 0x27d4eb2f), 0x9e3779b1); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function foodSim(kind, c, now) { // 데모용: 1분씩 진행 (서버 food_sim과 같은 규칙)
  const MIN = 60000, end = Math.floor(now / MIN) * MIN; let m = Math.max(Math.floor((c.at || now) / MIN) * MIN, end - 2 * 86400000);
  let stock = Math.max(0, c.made - c.taken - (c.sold || 0)), q = c.queue || 0, sold = 0;
  while (m < end) {
    m += MIN; const hr = nyHourMin(m)[0];
    if (hr < FOOD_OPEN[0] || hr >= FOOD_OPEN[1]) { q = 0; continue; }
    if (foodHash(kind, m / MIN) < foodRate(kind, hr)) q = Math.min(8, q + 1);
    if (stock > 0 && q > 0) { const n = Math.min(stock, q); stock -= n; q -= n; sold += n; }
  }
  c.sold = (c.sold || 0) + sold; c.queue = q; c.at = Math.max(c.at || 0, end);
}
const foodLeft = (f) => Math.max(0, f.made - f.taken - (f.sold || 0));
async function loadFood() {
  try { FOOD = await api.foodCounts(); }
  catch (e) { console.warn("트럭 숫자를 불러오지 못했어요 (supabase-update-footprints.sql 실행 여부 확인):", e.message); return; }
  const open = foodOpenAt(Date.now());
  const v = (k) => ({ made: FOOD[k].made, left: foodLeft(FOOD[k]), sold: FOOD[k].sold || 0, queue: open ? FOOD[k].queue || 0 : 0, open });
  W.setTruckCounts({ tako: v("tako"), bungeo: v("bungeo") });
  const q = (k) => (open && FOOD[k].queue ? ` (줄 ${FOOD[k].queue}명)` : "");
  $("#foodLine").textContent = open
    ? `🐙 타코야끼 ${(FOOD.tako.sold || 0).toLocaleString()}접시${q("tako")} · 🐟 붕어빵 ${(FOOD.bungeo.sold || 0).toLocaleString()}개${q("bungeo")} 팔렸어요`
    : `🌙 푸드 트럭은 지금 쉬는 시간이에요 (오전 7시 ~ 밤 10시)`;
  if (!$("#truckModal").hidden && truckOpen) renderTruck(truckOpen);
}
let truckOpen = null;
function openTruck(kind) {
  if (S.room !== "yard") return;
  truckOpen = kind; renderTruck(kind); openModal("truckModal"); loadFood();
}
function renderTruck(kind) {
  const T = TRUCK[kind], f = FOOD && FOOD[kind], left = f ? foodLeft(f) : null, open = foodOpenAt(Date.now()), queue = f && open ? f.queue || 0 : 0;
  $("#truckTitle").textContent = `${T.emoji} ${T.name} 트럭`;
  const busy = !W.seatFree(T.seat) && S.seat !== T.seat;
  $("#truckBody").replaceChildren(...[
    h("div", { class: "truck-stats" },
      h("div", { class: "stat" }, h("b", { text: f ? (f.sold || 0).toLocaleString() : "…" }), h("span", { text: `누적 판매(${T.unit})` })),
      h("div", { class: "stat" }, h("b", { text: f ? f.made.toLocaleString() : "…" }), h("span", { text: `지금까지 만든 것` })),
      h("div", { class: "stat" }, h("b", { text: left == null ? "…" : left }), h("span", { text: "트럭에 남은 것" })),
      h("div", { class: "stat" + (queue ? " hot" : "") }, h("b", { text: open ? `${queue}명` : "쉬는 중" }), h("span", { text: "줄 선 손님" }))),
    h("p", { class: "muted tiny", text: open ? (queue ? `🧍 손님 ${queue}명이 기다리고 있어요! 만들면 줄 선 손님에게 바로 팔려요.` : "손님들이 몇 분마다 와서 사 가요. 다 팔리면 줄을 서요.") + " · 영업 오전 7시 ~ 밤 10시" : "🌙 지금은 쉬는 시간이에요 (영업 오전 7시 ~ 밤 10시). 미리 만들어 두면 아침 손님들이 사 가요." }),
    T.note ? h("p", { class: "truck-note", text: T.note }) : null,
    h("p", { class: "muted", text: T.desc }),
    h("div", { class: "truck-actions" },
      h("button", { class: "btn primary", disabled: busy || null, text: busy ? "👩‍🍳 지금 다른 친구가 만드는 중이에요" : queue ? `👩‍🍳 만들어서 줄 선 손님에게 팔기 (${queue}명 기다려요)` : `👩‍🍳 트럭에 들어가서 ${T.name} 만들기`, onclick: () => startCooking(kind) }),
      h("button", { class: "btn ghost", disabled: left === 0 || null, text: left === 0 ? "🍽 다 나갔어요 · 만들어 주세요!" : `🍽 하나 받아서 먹기${left ? ` (남은 ${left}${T.unit})` : ""}`, onclick: () => takeFood(kind) }))].filter(Boolean));
}
async function takeFood(kind) {
  try {
    const r = await api.foodTake(kind);
    if (r == null || Number(r) < 0) { toast("앗, 방금 다 나갔어요. 직접 만들어 볼까요? 👩‍🍳"); loadFood(); return; }
    closeModal("truckModal");
    setCarry(kind, `${TRUCK[kind].emoji} ${eul(TRUCK[kind].name)} 받았어요! 먹거나 친구에게 줄 수 있어요`);
    loadFood();
  } catch (e) { toast(e.message); }
}
function startCooking(kind) {
  const T = TRUCK[kind], seat = W.room.seats[T.seat];
  if (!seat) return;
  closeModal("truckModal");
  W.moveMe({ x: seat.x, z: seat.z, seat: T.seat });
  S.cooking = kind; S.bubble = `👩‍🍳 ${T.name} 만드는 중!`; S.kind = "status"; S.amens = 0; refreshMe();
  Cook.start(kind);
  openModal("cookModal");
}
function stopCooking() {
  if (!S.cooking) return;
  const T = TRUCK[S.cooking];
  if (S.bubble === `👩‍🍳 ${T.name} 만드는 중!`) { S.bubble = ""; refreshMe(); }
  S.cooking = null; Cook.stop();
  if (S.seat === T.seat) W.stand();
}

// 만들기 미니 게임
const Cook = {
  kind: null, cells: [], timer: null, done: false,
  start(kind) {
    this.kind = kind; this.done = false;
    this.cells = Array.from({ length: kind === "tako" ? 9 : 3 }, () => ({ s: 0, t0: 0 }));
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 120);
    this.render();
  },
  stop() { clearInterval(this.timer); this.timer = null; },
  // 단계별 안내와 굽는 시간
  steps: {
    tako: [["🥣 반죽 붓기"], ["🐙 문어 넣기"], ["굽는 중…", 2200], ["뒤집기!"], ["굽는 중…", 1600], ["✓"]],
    bungeo: [["🥣 반죽 붓기"], ["🫘 팥 넣기"], ["덮고 뒤집기"], ["굽는 중…", 2600], ["꺼내기!"], ["🐟"]],
  },
  tap(i) {
    const c = this.cells[i], st = this.steps[this.kind];
    if (st[c.s][1] || c.s >= st.length - 1) return; // 굽는 중이거나 끝
    c.s++; c.t0 = performance.now(); this.render();
  },
  all(from) { this.cells.forEach((c) => { if (c.s === from) { c.s++; c.t0 = performance.now(); } }); this.render(); },
  tick() {
    const st = this.steps[this.kind]; let changed = false;
    for (const c of this.cells) { const d = st[c.s][1]; if (d && performance.now() - c.t0 >= d) { c.s++; changed = true; } }
    if (changed) this.render(); else this.progress();
  },
  progress() {
    const st = this.steps[this.kind];
    $$("#cookBoard .cell").forEach((el, i) => { const c = this.cells[i], d = st[c.s][1]; const bar = el.querySelector("i"); if (bar) bar.style.width = d ? Math.min(100, ((performance.now() - c.t0) / d) * 100) + "%" : "0"; });
  },
  render() {
    const k = this.kind, st = this.steps[k], T = TRUCK[k], last = st.length - 1;
    const allDone = this.cells.every((c) => c.s === last);
    $("#cookTitle").textContent = `👩‍🍳 ${T.name} 만들기`;
    const fish = (c) => `<svg viewBox="0 0 130 74"><path class="fb" d="M14 37 C 32 6, 86 6, 100 37 C 86 68, 32 68, 14 37 Z M100 37 L124 16 L119 37 L124 58 Z"/><circle class="fe" cx="34" cy="31" r="4"/><path class="fs" d="M55 25 q8 12 0 24 M68 23 q8 14 0 28 M81 26 q7 11 0 22"/>${c.s === 2 || c.s === 3 ? '<circle class="bean" cx="62" cy="37" r="11"/>' : ""}</svg>`;
    $("#cookBoard").className = "cook-board " + k;
    $("#cookBoard").replaceChildren(...this.cells.map((c, i) => {
      const el = h("button", { class: `cell s${c.s}`, onclick: () => this.tap(i) });
      el.innerHTML = (k === "bungeo" ? fish(c) : "<span class='ball'></span>") + `<em>${st[c.s][0]}</em><i></i>`;
      return el;
    }));
    const helpers = [];
    if (this.cells.some((c) => c.s === 0)) helpers.push(h("button", { class: "btn ghost sm", text: "🥣 반죽 한번에 붓기", onclick: () => this.all(0) }));
    if (this.cells.some((c) => c.s === 1)) helpers.push(h("button", { class: "btn ghost sm", text: k === "tako" ? "🐙 문어 한번에 넣기" : "🫘 팥 한번에 넣기", onclick: () => this.all(1) }));
    $("#cookHelp").replaceChildren(...helpers, h("span", { class: "muted tiny", text: k === "tako" ? "노릇해지면 하나씩 눌러서 뒤집어요!" : "다 구워지면 눌러서 꺼내요!" }));
    $("#cookDone").hidden = !allDone || this.done;
    $("#cookDone").textContent = k === "tako" ? "🥢 접시에 담고 소스·가쓰오부시 뿌리기" : `🐟 붕어빵 ${this.cells.length}개 완성!`;
    this.progress();
  },
  async finish() {
    if (this.done) return; this.done = true; $("#cookDone").hidden = true;
    const k = this.kind, T = TRUCK[k];
    const qBefore = FOOD && FOOD[k] && foodOpenAt(Date.now()) ? FOOD[k].queue || 0 : 0;
    try { FOOD = await api.foodMake(k, T.per); } catch (e) { toast(e.message); this.done = false; this.render(); return; }
    mAdd("give"); // 🎯 트럭에서 만들어 두기 = 간식 나누기
    const served = Math.max(0, qBefore - ((FOOD[k] && FOOD[k].queue) || 0));
    if (served) toast(`🧍 줄 서 있던 손님 ${served}명이 ${eul(T.name)} 받아 갔어요! 고마워요 💛`);
    loadFood();
    $("#cookBoard").replaceChildren(h("div", { class: "cook-result" },
      h("div", { class: "big", text: k === "tako" ? "🐙🎉" : "🐟🐟🐟" }),
      h("b", { text: `${T.name} ${T.per}${T.unit} 완성!` }),
      h("p", { text: `지금까지 모두 ${FOOD[k].made.toLocaleString()}${T.unit} 만들었어요 · 누적 판매 ${(FOOD[k].sold || 0).toLocaleString()}${T.unit}` + (FOOD[k].queue && foodOpenAt(Date.now()) ? ` · 아직 손님 ${FOOD[k].queue}명이 기다려요!` : "") + (T.note ? " " + T.note : "") })));
    $("#cookHelp").replaceChildren(
      h("button", { class: "btn primary", text: "🍽 하나 들고 나가기", onclick: async () => { closeModal("cookModal"); await takeFood(k); } }),
      h("button", { class: "btn ghost", text: "🚚 트럭에 두기 (친구들이 받아가요)", onclick: () => { closeModal("cookModal"); toast(`트럭에 두었어요. 친구들이 받아갈 거예요 ${T.emoji}`); } }),
      h("button", { class: "btn ghost", text: "🔁 한 번 더", onclick: () => this.start(k) }));
  },
};
$("#cookDone").onclick = () => Cook.finish();

/* ================= 이번주 공지 (비전 / 301호) ================= */
// 공지: 마당 = 전체 공지(all) · 301호 = 청년 1부(room301) · 비전 = 청년 2부(vision)
const NOTICE_ROOMS = { yard: "all", room301: "room301", vision: "vision" };
async function loadNotices(room = S.room) {
  const key = NOTICE_ROOMS[room]; if (!key) return;
  let list = [];
  try { list = await api.listNotices(key); } catch (e) { console.warn("공지를 불러오지 못했어요:", e.message); }
  const ul = $(`#panel-${room} [data-notice-list]`), badge = $(`#panel-${room} [data-notice-badge]`);
  if (!ul) return;
  ul.replaceChildren();
  $(`#panel-${room} .notice-box`).hidden = room === "yard" && !list.length; // 마당은 전체 공지가 있을 때만
  if (!list.length) ul.append(h("li", { class: "none", text: "이번 주 공지가 아직 없어요." }));
  for (const n of list) ul.append(h("li", {}, h("span", { text: n.content }), h("small", { text: timeAgo(n.created_at) })));
  if (badge) { badge.hidden = !list.length; badge.textContent = `📢 공지 ${list.length}`; }
}
async function loadAdminNotices() {
  try {
    const RN = { all: "📢 전체(마당)", vision: "2부(비전)", room301: "1부(301호)" };
    const list = (await api.listNotices(null)).filter((n) => S.adminRole !== "g1" || n.room === "room301");
    $("#adminNoticeList").replaceChildren(...list.map((n) => h("li", {},
      h("span", { class: "t" }, n.content, h("small", { text: `${RN[n.room] || n.room} · ${timeAgo(n.created_at)}` })),
      h("button", { class: "btn ghost sm", text: "삭제", onclick: () => adminDo(() => api.adminDeleteNotice(S.admin, n.id)).then(() => loadNotices()) }))));
    if (!list.length) $("#adminNoticeList").append(h("li", {}, h("span", { class: "t", text: "올라온 공지가 없어요" })));
  } catch (e) { toast(e.message); }
}
$("#noticeAdd").onclick = async () => {
  const v = $("#noticeInput").value.trim(); if (!v) return;
  await adminDo(() => api.adminAddNotice(S.admin, $("#noticeRoom").value, v));
  $("#noticeInput").value = ""; loadNotices();
};

/* ================= 🏀🎾🏸 건물 뒤 운동장 ================= */
// 농구: 공은 하나. 공을 가진 사람(holder)이 슛하면 모두에게 방송하고, 바닥에 떨어진 공은 먼저 가까이 간 사람이 잡아요.
//       가까이에서 '뺏기'를 누르면 공 가진 사람의 화면이 반반 확률로 결정해서 알려 줘요.
// 테니스·배드민턴: 코트마다 4자리(앞편 2, 뒤편 2). 양쪽에 사람이 있으면 가장 먼저 들어온 기기(id 순)가 랠리를 만들어 방송해요.
//       혼자면(또는 한쪽에만 있으면) '서브' 연습.
const CT = W.COURTS;
const BB = { seq: 0, by: "", holder: null, x: CT.bb.def.x, z: CT.bb.def.z, shot: null };
W.setBB(BB);
const SP = { goals: store.get("bbGoalsDay", { d: "", n: 0 }), stealTry: 0, stealWait: null, lastHolderPos: null,
  score: { tn: [0, 0], bm: [0, 0] }, rallyEnd: { tn: 0, bm: 0 }, seq: { tn: 0, bm: 0 }, serveSide: { tn: 0, bm: 0 }, canRally: { tn: false, bm: false }, serves: 0, barKey: "" };
const GAME_TO = 7;
const myName = () => clip(S.profile?.name, LIMIT.name) || "익명";
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const inRect = (p, [x0, z0, x1, z1], m = 0) => p && p.x > x0 - m && p.x < x1 + m && p.z > z0 - m && p.z < z1 + m;
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
function todayGoals() { if (SP.goals.d !== nyDay()) SP.goals = { d: nyDay(), n: 0 }; return SP.goals.n; }
// ---- 🏀 농구 ----
function bbApply(m) {
  if (!(m.seq > BB.seq || (m.seq === BB.seq && String(m.by) > String(BB.by)))) return false;
  const wasMine = BB.holder === myId, stolenByMe = m.holder === myId && m.by !== myId;
  BB.seq = m.seq; BB.by = m.by; BB.holder = m.holder || null;
  if (m.x != null) { BB.x = m.x; BB.z = m.z; }
  BB.shot = m.shot ? { ...m.shot, at: performance.now() } : null;
  if (m.shot) { W.markShoot(m.shot.by); gameScoreShot(m.shot); }
  if (stolenByMe) { clearTimeout(SP.stealWait); toast("🤚 공을 뺏었어요! 슛해 보세요 🏀"); }
  if (wasMine && m.holder && m.holder !== myId && !m.shot) toast(`😮 ${clip(m.name, 10) || "친구"}님에게 공을 뺏겼어요!`);
  if (wasMine !== (BB.holder === myId)) refreshMe();
  renderSportBar(true);
  return true;
}
// 새 번호는 '내가 적용한 번호'와 '다른 사람 상태에서 본 번호' 중 큰 것 + 1 (번호가 겹쳐서 무시되는 일이 없게)
function bbSend(m) { const msg = { k: "bb", by: myId, name: myName(), seq: Math.max(BB.seq, SP.seenSeq || 0) + 1, ...m }; bbApply(msg); api.sendSport(msg); }
function bbShotBusy() { return BB.shot && performance.now() - BB.shot.at < (BB.shot.dur + 1.0) * 1000; }
function bbChance(p) { const h = CT.bb.hoop, d = Math.hypot(p.x - h.x, p.z - h.z); return { d, p: clampN(0.97 - d * 0.085, 0.2, 0.92) }; }
function bbShoot() {
  const me = W.actorPos(myId); if (BB.holder !== myId || !me) return;
  const { d, p } = bbChance(me), make = Math.random() < p, h = CT.bb.hoop, [x0, z0, x1, z1] = CT.bb.rect;
  let ex, ez;
  if (make) { ex = h.x + rnd(-0.6, 0.6); ez = h.z + rnd(0.9, 1.8); }
  else { const a = rnd(-1.2, 1.2), r = rnd(2, 4.5); ex = h.x + Math.sin(a) * r; ez = h.z + Math.cos(a) * r; }
  ex = clampN(ex, x0 + 0.6, x1 - 0.6); ez = clampN(ez, z0 + 1.2, z1 - 0.6);
  const dur = 0.75 + d * 0.05, three = d > (CT.bb.three || 6) + 0.3;
  bbSend({ holder: null, x: ex, z: ez, shot: { by: myId, fx: me.x, fz: me.z, make, side: Math.random() < 0.5 ? -1 : 1, ex, ez, dur, d, three } });
  setTimeout(() => {
    if (make) {
      todayGoals(); SP.goals.n += three ? 3 : 2; store.set("bbGoalsDay", SP.goals); sportPoints("bb", three ? 3 : 2);
      toast(three ? `🏀 3점슛 성공!! (오늘 ${SP.goals.n}점)` : `🏀 골인! (오늘 ${SP.goals.n}점)`);
      if (!S.bubble || /^🏀/.test(S.bubble)) { S.bubble = `🏀 오늘 ${SP.goals.n}점!`; S.kind = "status"; S.amens = 0; refreshMe(); }
    } else toast(pickOne(["아깝다! 림에 맞았어요 😅", "에어볼… 다시! 💪", "통~ 튕겨 나왔어요 🏀"]));
    renderSportBar(true);
  }, dur * 1000);
}
function bbGoToBall() { if (S.room !== "yard") return; if (BB.holder === myId) { bbShoot(); return; } W.moveMe({ x: BB.x, z: BB.z + 0.4 }); }
function bbDrop() { const me = W.actorPos(myId); if (BB.holder !== myId || !me) return; const [x0, z0, x1, z1] = CT.bb.rect; bbSend({ holder: null, x: clampN(me.x, x0 + 0.5, x1 - 0.5), z: clampN(me.z + 0.3, z0 + 0.5, z1 - 0.5) }); }
function bbSteal() {
  const now = Date.now(); if (now - SP.stealTry < 1200 || !BB.holder || BB.holder === myId) return;
  SP.stealTry = now; W.markShoot(myId);
  const mp = W.actorPos(myId);
  api.sendSport({ k: "steal", from: myId, name: myName(), target: BB.holder, seq: BB.seq, x: mp && mp.x, z: mp && mp.z });
  clearTimeout(SP.stealWait); SP.stealWait = setTimeout(() => toast("앗, 놓쳤어요! 다시 해 보세요 🤚"), 1500);
}
function onSteal(m) {
  if (BB.holder !== myId || m.target !== myId || m.seq !== BB.seq || bbShotBusy()) return;
  // 뺏으려는 사람의 위치: 그 사람이 보낸 자리(내 화면에서는 아직 걸어오는 중일 수 있어서)
  const a = Number.isFinite(m.x) ? { x: m.x, z: m.z } : W.actorPos(m.from), me = W.actorPos(myId);
  if (a && me && Math.hypot(a.x - me.x, a.z - me.z) < 2.6 && Math.random() < 0.5) bbSend({ holder: m.from, x: me.x, z: me.z });
  else api.sendSport({ k: "stealfail", to: m.from, name: myName() });
}
function bbPeers() {
  const fresh = S.peers.filter((p) => p.id !== myId);
  const maxSeq = Math.max(BB.seq, ...fresh.map((p) => Number(p.bbSeq) || 0));
  if (BB.holder && BB.holder !== myId && !S.peers.some((p) => p.id === BB.holder)) { // 공 가진 사람이 나갔어요 → 그 자리에 공을 둬요
    BB.holder = null; if (SP.lastHolderPos) { const [x0, z0, x1, z1] = CT.bb.rect; BB.x = clampN(SP.lastHolderPos.x, x0 + 0.5, x1 - 0.5); BB.z = clampN(SP.lastHolderPos.z, z0 + 0.5, z1 - 0.5); }
  }
  if (!BB.holder && !bbShotBusy()) { const hp = fresh.find((p) => p.bball && (Number(p.bbSeq) || 0) >= BB.seq); if (hp) BB.holder = hp.id; }
  SP.seenSeq = Math.max(SP.seenSeq || 0, maxSeq);
}
// ---- 🎾 테니스 · 🏸 배드민턴 ----
const RK = { tn: "TN-", bm: "BM-" };
const courtOf = (seat) => (CT.tn && seat && seat.startsWith("TN-") ? "tn" : CT.bm && seat && seat.startsWith("BM-") ? "bm" : null);
function courtPlayers(k) { if (!CT[k]) return []; return S.peers.filter((p) => p.seat && p.seat.startsWith(RK[k]) && CT[k].slots[p.seat]).map((p) => ({ id: p.id, name: p.name, slot: p.seat, side: CT[k].slots[p.seat][2] })); }
function joinCourt(k) {
  if (S.room !== "yard") return;
  const C = CT[k];
  if (courtOf(S.seat) === k) { toast(`${C.emoji} 이미 ${C.name}에 있어요`); return; }
  const others = courtPlayers(k).filter((p) => p.id !== myId);
  if (others.length >= 4) { toast(`${C.emoji} ${C.name}은 지금 꽉 찼어요 (최대 4명)`); return; }
  const taken = new Set(others.map((p) => p.slot)), cnt = [0, 0]; others.forEach((p) => cnt[p.side]++);
  const id = Object.keys(C.slots).filter((s) => !taken.has(s)).sort((a, b) => cnt[C.slots[a][2]] - cnt[C.slots[b][2]])[0];
  const [x, z] = C.slots[id];
  W.moveMe({ x, z, seat: id });
  toast(others.length ? `${C.emoji} ${C.name}으로 가는 중! 반대편 친구와 같이 쳐요` : `${C.emoji} ${C.name}으로 가는 중! 도착하면 '서브'를 눌러 보세요`);
}
const rallyBusy = (k) => performance.now() < SP.rallyEnd[k];
function slotXZ(k, slot) { const [x, z] = CT[k].slots[slot]; return { x, z }; }
function courtLabel(k) {
  const C = CT[k], sc = SP.score[k]; if (!C) return;
  W.setCourtLabel(k, SP.canRally[k] || sc[0] || sc[1] ? `${C.emoji} ${C.name} · 앞 ${sc[0]} : ${sc[1]} 뒤` : `${C.emoji} ${C.name} · 눌러서 치기`);
}
function playHits(k, hits) { W.playRally(k, { hits }); const total = hits.reduce((a, h) => a + h.dur, 0); SP.rallyEnd[k] = performance.now() + total * 1000 + 1400; return total; }
function serve() {
  const k = courtOf(S.seat), me = W.actorPos(myId); if (!k || !me || me.seat !== S.seat || me.moving) return;
  if (rallyBusy(k)) return;
  const C = CT[k], [x, z, side] = C.slots[S.seat], half = (C.rect[3] - C.rect[1]) / 2, dir = side ? 1 : -1;
  const ok = Math.random() < 0.72;
  let tx = C.cx + rnd(-0.8, 0.8) * C.halfW, tz = C.net + dir * rnd(1.8, half - 0.6);
  if (!ok) { if (Math.random() < 0.5) tz = C.net + dir * (half + rnd(0.6, 1.6)); else tx = C.cx + (Math.random() < 0.5 ? -1 : 1) * (C.halfW + rnd(0.4, 1.2)); }
  const msg = { k: "serve", court: k, by: myId, name: myName(), ok, hits: [{ by: myId, fx: x, fz: z, tx, tz, dur: C.dur * 1.15, land: true }] };
  onServe(msg); api.sendSport(msg);
}
function onServe(m) {
  const k = m.court; if (!CT[k] || !Array.isArray(m.hits)) return;
  const total = playHits(k, m.hits);
  if (m.by === myId) setTimeout(() => { if (m.ok) SP.serves++; toast(m.ok ? `${CT[k].emoji} 서브 인! 나이스 서브 👍 (${SP.serves}개)` : pickOne(["아웃! 다시 해 볼까요? 🙂", "앗, 네트 밖으로! 한 번 더 💪"])); renderSportBar(true); }, total * 1000);
}
function startRally(k, sides) {
  const C = CT[k]; let side = SP.serveSide[k] || 0;
  if (!sides[side].length) side = 1 - side;
  const n = 2 + Math.floor(Math.random() * 9), hits = [];
  let cur = pickOne(sides[side]), pos = slotXZ(k, cur.slot);
  for (let i = 0; i < n; i++) {
    const rcv = pickOne(sides[1 - side]), rp = slotXZ(k, rcv.slot);
    hits.push({ by: cur.id, fx: pos.x, fz: pos.z, tx: clampN(rp.x + rnd(-0.7, 0.7), C.rect[0], C.rect[2]), tz: rp.z + rnd(-0.5, 0.5), dur: C.dur * rnd(0.9, 1.15) });
    pos = { x: hits[i].tx, z: hits[i].tz }; cur = rcv; side = 1 - side;
  }
  // 마지막 공: 받는 쪽이 놓치면 친 쪽 점수, 아웃이면 받는 쪽 점수
  const last = hits[hits.length - 1], hitter = 1 - side, out = Math.random() < 0.35, half = (C.rect[3] - C.rect[1]) / 2, dir = hitter === 0 ? -1 : 1;
  last.land = true;
  if (out) last.tz = C.net + dir * (half + rnd(0.6, 1.5)); else last.tz = C.net + dir * rnd(1.5, half - 0.5);
  const winner = out ? 1 - hitter : hitter, sc = [...SP.score[k]]; sc[winner]++;
  const done = sc[winner] >= GAME_TO;
  const msg = { k: "rally", court: k, by: myId, seq: SP.seq[k] + 1, hits, winner, out, score: done ? [0, 0] : sc, final: done ? sc : null };
  onRally(msg); api.sendSport(msg);
}
function onRally(m) {
  const k = m.court; if (!CT[k] || !Array.isArray(m.hits)) return;
  SP.seq[k] = Math.max(SP.seq[k], m.seq || 0); SP.serveSide[k] = m.winner;
  const total = playHits(k, m.hits), mine = courtOf(S.seat) === k ? CT[k].slots[S.seat][2] : null;
  setTimeout(() => {
    SP.score[k] = m.score; courtLabel(k);
    if (mine != null && m.winner === mine) { sportPoints(k, 1); if (m.final) sportPoints(k, 3); }
    if (mine != null) {
      if (m.final) toast(m.winner === mine ? `🏆 우리 편 승리! ${m.final[mine]} : ${m.final[1 - mine]}` : `다음 판엔 이겨요! ${m.final[mine]} : ${m.final[1 - mine]} 💪`);
      else toast(m.winner === mine ? (m.out ? "상대가 아웃! 우리 점수 ✨" : "득점! 나이스 샷 👏") : (m.out ? "아웃… 아깝다 😅" : "실점! 다음 공 집중 💪"));
    }
    renderSportBar(true);
  }, total * 1000);
}
function racketTick() {
  for (const k of ["tn", "bm"]) {
    if (!CT[k]) continue; // 2026-11-18: 테니스·배드민턴은 없앴어요
    const pl = courtPlayers(k), sides = [pl.filter((p) => p.side === 0), pl.filter((p) => p.side === 1)];
    const can = !!(sides[0].length && sides[1].length);
    if (can !== SP.canRally[k]) { SP.canRally[k] = can; if (!can && !pl.length) SP.score[k] = [0, 0]; courtLabel(k); }
    if (!can || performance.now() < SP.rallyEnd[k] + 1500) continue;
    const host = pl.map((p) => p.id).sort()[0];
    if (host === myId) startRally(k, sides);
  }
}
// ---- 방송 받기 ----
function onSport(m) {
  if (!m || typeof m !== "object" || S.room !== "yard") return;
  if (m.k === "bb") {
    const ok = bbApply(m);
    if (ok && m.shot && m.by !== myId && m.shot.make) setTimeout(() => { const me = W.actorPos(myId); if (me && inRect(me, CT.bb.rect, 6)) toast(`🏀 ${clip(m.name, 10) || "친구"}님 ${m.shot.three ? "3점슛!" : "골인!"}`); }, m.shot.dur * 1000);
  }
  else if (m.k === "steal") onSteal(m);
  else if (m.k === "stealfail" && m.to === myId) { clearTimeout(SP.stealWait); toast(`🛡 ${clip(m.name, 10) || "친구"}님이 공을 지켰어요! 다시 🤚`); }
  else if (m.k === "serve") onServe(m);
  else if (m.k === "rally") onRally(m);
  else if (m.k === "bbgame") onGame(m);
  else if (m.k === "skstart") onSkStart(m);
  else if (m.k === "clap") { if (S.room === "yard") onClap(m); }
}
// ---- 아래 운동장 막대 ----
function renderSportBar(force) {
  const bar = $("#sportBar"); if (!bar) return;
  const me = S.room === "yard" && W.actorPos(myId);
  let key = "none", build = null, isBB = false;
  const k = me && courtOf(S.seat);
  if (k) {
    const C = CT[k], side = C.slots[S.seat][2], sc = SP.score[k], at = me.seat === S.seat && !me.moving, busy = rallyBusy(k);
    if (SP.canRally[k]) { key = `r|${k}|${sc}|${side}`; build = () => [h("span", { class: "sb-t", text: `${C.emoji} 같이 치는 중 · 앞 ${sc[0]} : ${sc[1]} 뒤 (나: ${side ? "뒤" : "앞"}편, ${GAME_TO}점 내기)` }), h("button", { class: "btn ghost sm", text: "코트에서 나가기", onclick: () => W.stand() })]; }
    else { key = `s|${k}|${at}|${busy}`; build = () => [h("span", { class: "sb-t", text: at ? `${C.emoji} 혼자 서브 연습 · 반대편에 친구가 오면 같이 쳐요` : `${C.emoji} 코트로 가는 중…` }),
      h("button", { class: "btn primary sm", disabled: !at || busy || null, text: k === "tn" ? "🎾 서브!" : "🏸 서브!", onclick: serve }), h("button", { class: "btn ghost sm", text: "나가기", onclick: () => W.stand() })]; }
  } else if (me && inRect(me, CT.bb.rect, 2)) {
    isBB = true;
    const g = todayGoals();
    if (BB.holder === myId) { const c = bbChance(me); key = `h|${Math.round(c.p * 20)}|${g}`; build = () => [h("span", { class: "sb-t", text: `🏀 공을 갖고 있어요 · 오늘 ${g}점` }), h("button", { class: "btn primary sm", text: `🏀 슛! (성공 ${Math.round(c.p * 100)}%)`, onclick: bbShoot }), h("button", { class: "btn ghost sm", text: "내려놓기", onclick: bbDrop })]; }
    else if (BB.holder) {
      const hpeer = S.peers.find((p) => p.id === BB.holder) || {}, who = hpeer.name || "친구";
      const hp = hpeer.pos || W.actorPos(BB.holder), near = hp && Math.hypot(hp.x - me.x, hp.z - me.z) < 1.8; // 그 사람이 알려 준 자리 기준
      key = `o|${near}|${who}|${g}`; build = () => near ? [h("span", { class: "sb-t", text: `🏀 ${clip(who, 8)}님이 드리블 중!` }), h("button", { class: "btn primary sm", text: "🤚 공 뺏기", onclick: bbSteal })]
        : [h("span", { class: "sb-t", text: `🏀 ${clip(who, 8)}님이 공을 갖고 있어요 · 가까이 가서 뺏어 보세요` })];
    } else { key = `l|${g}|${!!bbShotBusy()}`; build = () => [h("span", { class: "sb-t", text: `🏀 농구장 · 오늘 ${g}점` }), h("button", { class: "btn primary sm", text: "🏀 공 잡으러 가기", onclick: bbGoToBall })]; }
  }
  if (build) { // 🏆 랭킹 버튼, 농구 팀전 버튼·점수판
    const base = build, pc = isBB ? bbCourtPeople().length : 0, on = isBB && gameOn();
    key += `|${on}|${pc >= 2}`;
    build = () => [...(on ? [h("span", { class: "sb-game" })] : []), ...base(),
      ...(isBB && !on && pc >= 2 ? [h("button", { class: "btn ghost sm", text: "⚔️ 팀전 3분", onclick: startTeamGame })] : []),
      h("button", { class: "btn ghost sm", text: "🏆", title: "운동장 랭킹", onclick: openSportRank })];
  }
  if (key !== SP.barKey || force) { SP.barKey = key; bar.hidden = !build; if (build) bar.replaceChildren(...build()); }
  const gl = bar.querySelector(".sb-game");
  if (gl) { const t = GAME.teams[myId]; gl.textContent = `⚔️ ${TEAM[0][0]} ${GAME.score[0]} : ${GAME.score[1]} ${TEAM[1][0]} · ${gameLeft()}${t != null ? ` (나: ${TEAM[t][0]})` : ""}`; }
}
function sportTick() {
  if (S.room !== "yard" || !started) return;
  const me = W.actorPos(myId); if (!me) return;
  if (BB.holder && BB.holder !== myId) { const hp = W.actorPos(BB.holder); if (hp) SP.lastHolderPos = hp; }
  // 바닥에 있는 공 가까이 가면 저절로 잡아요
  if (!BB.holder && !bbShotBusy() && Math.hypot(me.x - BB.x, me.z - BB.z) < 0.95) bbSend({ holder: myId, x: BB.x, z: BB.z });
  // 공을 들고 농구장 밖으로 멀리 가면 코트에 두고 와요
  if (BB.holder === myId && !inRect(me, CT.bb.rect, 2.5)) { bbDrop(); toast("공은 농구장에 두고 왔어요 🏀"); }
  racketTick();
  renderSportBar();
}
setInterval(sportTick, 200);
if ($("#courtBtn")) $("#courtBtn").onclick = () => { if (S.room !== "yard") return; W.walkTo(26.3, -6.5); toast("🏀 농구장으로 가는 중이에요"); };

/* ================= 함께하는 기능: 계절 장식 · 밤 모드 · 설교 본문 ================= */
const SITE = { theme: "auto", night: "auto", sermon: null };
function themeTags() {
  const t = SITE.theme || "auto";
  if (t === "auto") return W.autoSeasons();
  if (t === "none") return [];
  return [t, ...(t === "christmas" || t === "newyear" ? ["winter"] : [])];
}
let lastTagKey = "";
function applyThemeNight() {
  const tags = themeTags(), key = tags.join(",");
  W.setSeasons(tags);
  W.setNight(SITE.night === "day" ? 0 : SITE.night === "night" ? 1 : W.autoNight());
  if (key !== lastTagKey) { const had = lastTagKey; lastTagKey = key; if (had && Sound.on && S.room === "yard") Sound.start("yard"); }
}
async function loadSite() {
  try {
    const st = await api.getSettings();
    SITE.theme = typeof st.theme === "string" ? st.theme : "auto";
    SITE.night = typeof st.night === "string" ? st.night : "auto";
    SITE.sermon = st.sermon && st.sermon.book >= 1 && st.sermon.book <= 66 ? st.sermon : null;
  } catch (e) { console.warn("사이트 설정을 불러오지 못했어요 (supabase-update-community.sql 확인):", e.message); }
  applyThemeNight(); renderSermon();
}
const sermonRef = (sm) => `${BOOKS[sm.book - 1][0]} ${sm.chap}${sm.verses ? ":" + sm.verses : "장"}`;
function renderSermon() {
  const sm = SITE.sermon;
  $$("[data-sermon]").forEach((el) => {
    el.hidden = !sm; if (!sm) return;
    el.replaceChildren(h("div", { class: "board-label", text: "📖 이번 주 설교 본문" }),
      h("div", { class: "sm-t" }, h("b", { text: sm.title || "주일 설교" }), h("span", { text: " · " + sermonRef(sm) })),
      h("button", { class: "btn ghost sm", text: "📖 본문 읽기", onclick: () => openReader(sm.book - 1, Math.min(sm.chap, BOOKS[sm.book - 1][1])) }));
  });
}
// 관리자: 설교 본문 · 계절 · 밤
$("#smBook").replaceChildren(...BOOKS.map(([n], i) => h("option", { value: i + 1, text: n })));
function fillSiteAdmin() {
  const sm = SITE.sermon || {};
  $("#smTitle").value = sm.title || ""; $("#smBook").value = sm.book || 43; $("#smChap").value = sm.chap || 1; $("#smVerses").value = sm.verses || "";
  $("#themeSel").value = SITE.theme || "auto"; $("#nightSel").value = SITE.night || "auto";
}
async function setSetting(key, value, msg) { try { await api.adminSetSetting(S.admin, key, value); toast(msg); await loadSite(); } catch (e) { toast(e.message); } }
$("#smSave").onclick = () => {
  const book = +$("#smBook").value, chap = Math.max(1, Math.min(BOOKS[book - 1][1], +$("#smChap").value || 1));
  const title = $("#smTitle").value.trim(); if (title && !checkText(title)) return;
  setSetting("sermon", { title: clip(title, 60), book, chap, verses: clip($("#smVerses").value.trim(), 20), date: nyDay() }, "📖 이번 주 설교 본문을 올렸어요");
};
$("#smClear").onclick = () => setSetting("sermon", null, "설교 본문을 지웠어요");
$("#themeSave").onclick = async () => { await setSetting("theme", $("#themeSel").value, "🎄 계절 장식을 바꿨어요"); await setSetting("night", $("#nightSel").value, "🌙 밤 모드를 바꿨어요"); };

/* ================= 📅 모임 시간표 ================= */
const PLACE = { yard: "🏡 마당", worship: "🙏 본당", cafe: "📖 성경 읽는 공간", vision: "🕊 비전 (2부)", room301: "🛋 301호 · 3Q (1부)", praise: "🎸 찬양팀 연습실", court: "🏀 농구장" };
const placeName = (p) => PLACE[p] || p;
let EVENTS = [];
const gatherSkip = new Set();
const evNow = (e) => Date.now() >= new Date(e.starts_at).getTime() - 15 * 60e3 && Date.now() <= new Date(e.ends_at).getTime();
function evWhen(e, short) {
  const s = new Date(e.starts_at), d = nyDay(s);
  const day = d === nyDay() ? "오늘" : d === nyDay(new Date(Date.now() + 864e5)) ? "내일" : s.toLocaleDateString("ko-KR", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" });
  const tm = s.toLocaleTimeString("ko-KR", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return short ? `${day} ${tm}` : `${day} ${tm} · ${placeName(e.place)}`;
}
async function loadEvents() { try { EVENTS = await api.listEvents(); } catch (e) { return; } renderEvents(); }
function goPlace(p) {
  if (p === "court") { const wait = S.room === "yard" ? 0 : 600; if (S.room !== "yard") joinRoom("yard", S.room); setTimeout(() => W.walkTo(26.3, -6.5), wait); toast("🏀 농구장으로 가는 중이에요"); return; }
  if (ROOMS.includes(p) && p !== S.room) joinRoom(p, S.room);
}
var gatherOpen = false; // 📅 지금 모여요: 처음엔 작은 배지로
function renderEvents() {
  const up = EVENTS.filter((e) => new Date(e.ends_at) > Date.now());
  const ul = $("#schedList");
  ul.replaceChildren(...(up.length ? up.slice(0, 4).map((e) => h("li", { class: evNow(e) ? "now" : "" }, h("span", { class: "t" }, h("b", { text: e.title }), evNow(e) ? h("em", { text: " 지금!" }) : null), h("small", { text: evWhen(e) })))
    : [h("li", { class: "none", text: "예정된 모임이 아직 없어요." })]));
  W.setBoard("schedBoard", up.slice(0, 5).map((e) => ({ l: (evNow(e) ? "🔔 " : "") + e.title, r: evNow(e) ? "지금 모여요!" : evWhen(e, true), hi: evNow(e) })));
  const g = up.find((e) => evNow(e) && !gatherSkip.has(e.id)), bar = $("#gatherBar");
  bar.hidden = !g || !started;
  bar.classList.toggle("compact", !!g && !gatherOpen);
  if (g && !gatherOpen) bar.replaceChildren(h("button", { class: "gather-pill", title: g.title, text: `📅 지금 모여요 · ${clip(g.title, 10)}`, onclick: () => { gatherOpen = true; renderEvents(); } }));
  else if (g) bar.replaceChildren(...[h("span", { text: `📅 지금 모여요! ${g.title} · ${placeName(g.place)}` }),
    (g.place === "court" || ROOMS.includes(g.place)) && !(g.place === S.room) ? h("button", { class: "btn primary sm", text: "함께 가기", onclick: () => goPlace(g.place) }) : null,
    h("button", { class: "btn ghost sm", text: "접기", onclick: () => { gatherOpen = false; renderEvents(); } }),
    h("button", { class: "btn ghost sm", text: "✕", title: "닫기", onclick: () => { gatherSkip.add(g.id); renderEvents(); } })].filter(Boolean));
  if (!$("#schedModal").hidden) renderSchedFull();
  if (isAll()) renderAdminEvents();
}
function renderSchedFull() {
  const up = EVENTS.filter((e) => new Date(e.ends_at) > Date.now());
  $("#schedFull").replaceChildren(...(up.length ? up.map((e) => h("li", { class: evNow(e) ? "now" : "" },
    h("div", {}, h("b", { text: e.title }), evNow(e) ? h("em", { text: " · 지금 모여요!" }) : null),
    h("small", { text: evWhen(e) + (e.memo ? " · " + e.memo : "") }),
    (e.place === "court" || ROOMS.includes(e.place)) ? h("button", { class: "btn ghost sm", text: "그 장소로 가기", onclick: () => { closeModal("schedModal"); goPlace(e.place); } }) : null))
    : [h("li", { class: "none", text: "예정된 모임이 아직 없어요. 관리자가 올리면 여기에 보여요." })]));
}
function openSched() { renderSchedFull(); openModal("schedModal"); loadEvents(); }
function renderAdminEvents() {
  $("#adminEvList").replaceChildren(...EVENTS.map((e) => h("li", {}, h("span", { class: "t" }, e.title, h("small", { text: evWhen(e) })),
    h("button", { class: "btn ghost sm", text: "삭제", onclick: async () => { try { await api.adminDeleteEvent(S.admin, e.id); toast("모임을 지웠어요"); loadEvents(); } catch (er) { toast(er.message); } } }))));
  if (!EVENTS.length) $("#adminEvList").append(h("li", {}, h("span", { class: "t", text: "올라온 모임이 없어요" })));
}
function defaultEvStart() { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`; }
$("#evAdd").onclick = async () => {
  const title = $("#evTitle").value.trim(), start = new Date($("#evStart").value);
  if (!title) { toast("모임 이름을 적어주세요"); return; }
  if (!checkText(title)) return;
  if (isNaN(start)) { toast("시작 시간을 골라주세요"); return; }
  const ev = { title: clip(title, 60), place: $("#evPlace").value, memo: clip($("#evMemo").value.trim(), 120), starts_at: start.toISOString(), ends_at: new Date(start.getTime() + +$("#evLen").value * 60e3).toISOString() };
  try {
    await api.adminAddEvent(S.admin, ev); toast("📅 모임을 올렸어요");
    if ($("#evPush").checked) api.notify({ type: "event", pw: S.admin, title: ev.title, body: `${evWhen(ev)}${ev.memo ? " · " + ev.memo : ""}` });
    $("#evTitle").value = ""; $("#evMemo").value = ""; loadEvents();
  } catch (e) { toast(e.message); }
};

/* ================= 📚 통독 기록 서버 저장 + 함께 통독 챌린지 ================= */
// 서버에 있는 통독표를 이 기기 통독표에 합쳐요 (기기 연결 뒤에도 두 기기가 같아지게)
async function pullReading() {
  if (api.demo) return;
  let rows = []; try { rows = await api.readingMe(); } catch (e) { return; }
  let added = 0;
  for (const [b, c] of rows || []) { const k = String(+b - 1), set = new Set(S.progress[k] || []); if (!set.has(+c)) { set.add(+c); S.progress[k] = [...set].sort((x, y) => x - y); added++; } }
  if (added) { store.set("progress", S.progress); try { renderProgress(); } catch (e) {} }
}
async function syncReading() {
  await pullReading();
  if (api.demo || store.get("readSync1", false)) return;
  const items = []; for (const [b, l] of Object.entries(S.progress)) for (const c of l) items.push([+b + 1, c]);
  try { if (items.length) await api.readingSync(items.slice(0, 1300)); store.set("readSync1", true); } catch (e) { console.warn("통독 기록 올리기:", e.message); }
}
let chTimer = null;
function onMarkRead(book, chap, on) { api.readingMark(book + 1, chap, on).catch((e) => console.warn("통독 기록:", e.message)); clearTimeout(chTimer); chTimer = setTimeout(loadChallenge, 2500); }
// 📚 함께 성경 읽기(단체 통독): 청년 1부(g1) · 청년 2부(g2) · 청년부 전체(all) 챌린지가 동시에 진행될 수 있어요
const CH = { list: [], act: {}, adminSel: new Set() };
const CH_GRPS = ["g1", "g2", "all"];
const chTotal = (c) => c.books.reduce((a, b) => a + BOOKS[b - 1][1], 0);
const mdLabel = (iso) => { const [, m, d] = String(iso).split("-").map(Number); return `${m}/${d}`; };
async function loadChallenge() {
  try { CH.list = (await api.listChallenges()).map((c) => ({ ...c, grp: c.grp || "all" })); } catch (e) { return; }
  const today = nyDay(), act = {};
  for (const g of CH_GRPS) {
    const l = CH.list.filter((c) => c.grp === g);
    const c = l.find((x) => x.starts <= today && x.ends >= today) || l.filter((x) => x.starts > today).sort((a, b) => (a.starts < b.starts ? -1 : 1))[0];
    if (!c) continue;
    let board = []; if (c.starts <= today) { try { board = await api.challengeBoard(c.id); } catch (e) {} }
    act[g] = { c, board };
  }
  CH.act = act;
  renderChallenge();
  if (S.admin) renderAdminCh();
}
function chStats(g) {
  const { c, board } = CH.act[g], total = chTotal(c), p = board.length, sum = board.reduce((a, r) => a + Math.min(Number(r.n), total), 0), me = board.find((r) => r.me);
  return { total, p, sum, goal: total * Math.max(1, p), mine: me ? Number(me.n) : 0 };
}
function chCard(g) {
  const a = CH.act[g]; if (!a) return null;
  const c = a.c, today = nyDay(), tag = `👥 ${GRP_NAME[g]}`;
  if (c.starts > today) return h("div", { class: "challenge-box" }, h("div", { class: "board-label", text: `${tag} · 곧 시작` }), h("b", { text: c.title }), h("p", { class: "tiny-help", text: `${mdLabel(c.starts)}부터 ${mdLabel(c.ends)}까지 · ${chTotal(c)}장` }));
  const st = chStats(g), pct = st.goal ? Math.min(100, (st.sum / st.goal) * 100) : 0, left = Math.round((new Date(c.ends + "T23:59:59") - Date.now()) / 864e5);
  const bar = h("div", { class: "progress" }, h("div", { class: "progress-bar ch" })); bar.firstChild.style.width = pct.toFixed(1) + "%";
  return h("div", { class: "challenge-box" }, h("div", { class: "board-label", text: `${tag} · D-${Math.max(0, left)}` }), h("b", { text: c.title }),
    bar, h("p", { class: "tiny-help", text: `${st.p}명이 함께 ${st.sum}장 읽었어요 (목표 ${st.goal}장) · 나는 ${st.mine}/${st.total}장` }),
    h("button", { class: "btn ghost sm", text: "자세히 · 함께 읽는 사람", onclick: () => openChallenge(g) }));
}
// 성경 읽는 공간: 1부·2부·전체 모두 / 301호: 1부 / 비전: 2부 (전체 챌린지는 양쪽에)
function renderChallenge() {
  const fill = (el, grps) => { if (!el) return; const cards = grps.map(chCard).filter(Boolean); el.replaceChildren(...cards); el.hidden = !cards.length; };
  fill($("#challengeBox"), CH_GRPS);
  const none = $("#challengeNone"); if (none) none.hidden = CH_GRPS.some((g) => CH.act[g]);
  fill($('#panel-room301 [data-ch]'), ["g1", "all"]);
  fill($('#panel-vision [data-ch]'), ["g2", "all"]);
}
function nextUnread(c) { for (const b of c.books) { const read = new Set(S.progress[b - 1] || []); for (let k = 1; k <= BOOKS[b - 1][1]; k++) if (!read.has(k)) return [b - 1, k]; } return [c.books[0] - 1, 1]; }
function openChallenge(g) {
  const a = CH.act[g]; if (!a) return;
  const c = a.c, st = chStats(g);
  $("#chTitle").textContent = `📚 ${GRP_NAME[g]} · ${c.title}`;
  $("#chBody").replaceChildren(
    h("p", { class: "muted", text: `${mdLabel(c.starts)} ~ ${mdLabel(c.ends)} · ${c.books.length}권 ${st.total}장 · 이 기간에 읽은 장만 세요 (본문을 1분 넘게 읽거나 "다 읽었어요" / 통독표 체크)` }),
    h("div", { class: "chips" }, ...c.books.map((b) => { const r = (S.progress[b - 1] || []).length, n = BOOKS[b - 1][1]; return h("span", { class: "chip" + (r >= n ? " done" : ""), text: `${BOOKS[b - 1][0]} ${r}/${n}` }); })),
    h("button", { class: "btn primary", style: "margin:10px 0", text: "📖 이어서 읽기", onclick: () => { closeModal("challengeModal"); openReader(...nextUnread(c)); } }),
    h("ol", { class: "qz-rank" }, ...(a.board.length ? a.board.map((r, i) => h("li", { class: r.me ? "me" : "" }, h("span", { class: "rk", text: Number(r.n) >= st.total ? "🎉" : String(i + 1) }), h("span", { class: "nm", text: (clip(r.name, LIMIT.name) || "익명") + (r.me ? " (나)" : "") }), h("small", { text: `${Math.round(Math.min(1, Number(r.n) / st.total) * 100)}%` }), h("b", { text: `${r.n}장` })))
      : [h("li", { class: "muted", text: "아직 아무도 시작 안 했어요. 첫 장을 읽어 볼까요? 📖" })])));
  openModal("challengeModal");
}
function renderAdminCh() {
  const sel = [...CH.adminSel].sort((a, b) => a - b);
  $("#chPicked").textContent = "고른 책: " + (sel.length ? rangeLabel(sel) + ` (${sel.reduce((a, b) => a + BOOKS[b - 1][1], 0)}장)` : "없음");
  const mine = CH.list.filter((c) => S.adminRole !== "g1" || c.grp === "g1");
  $("#adminChList").replaceChildren(...mine.map((c) => h("li", {}, h("span", { class: "t" }, `[${GRP_NAME[c.grp] || "전체"}] ${c.title}`, h("small", { text: `${mdLabel(c.starts)}~${mdLabel(c.ends)} · ${rangeLabel(c.books)}` })),
    h("button", { class: "btn ghost sm", text: "삭제", onclick: async () => { try { await api.adminDeleteChallenge(S.admin, c.id); toast("챌린지를 지웠어요"); loadChallenge(); } catch (e) { toast(e.message); } } }))));
  if (!mine.length) $("#adminChList").append(h("li", {}, h("span", { class: "t", text: "만든 챌린지가 없어요" })));
}
$$("[data-ch-quick]").forEach((b) => (b.onclick = () => {
  const v = b.dataset.chQuick;
  if (v === "sermon") { if (!SITE.sermon) { toast("먼저 설교 본문을 올려 주세요"); return; } CH.adminSel = new Set([SITE.sermon.book]); }
  else { const [a, z] = v.split("-").map(Number); CH.adminSel = new Set(Array.from({ length: z - a + 1 }, (_, i) => a + i)); }
  renderAdminCh();
}));
function fillChAdmin() { const d = new Date(); $("#chStart").value = nyDay(); $("#chEnd").value = nyDay(new Date(d.getTime() + 29 * 864e5)); renderAdminCh(); }
$("#chAdd").onclick = async () => {
  const title = $("#chNewTitle").value.trim(), books = [...CH.adminSel];
  if (!title) { toast("챌린지 이름을 적어주세요"); return; }
  if (!checkText(title)) return;
  if (!books.length) { toast("읽을 책을 골라주세요"); return; }
  const grp = S.adminRole === "g1" ? "g1" : $("#chGrp").value;
  try { await api.adminAddChallenge(S.admin, { grp, title: clip(title, 60), books, starts: $("#chStart").value, ends: $("#chEnd").value }); toast(`📚 ${GRP_NAME[grp]} 함께 읽기를 만들었어요`); $("#chNewTitle").value = ""; loadChallenge(); }
  catch (e) { toast(e.message); }
};

/* ================= 🌳 감사 나무 (기도 응답 나눔) ================= */
let THX = [];
const myThx = new Set(store.get("myThx", [])), thxAmen = new Set(store.get("thxAmen", []));
async function loadThanks() { try { THX = await api.listTestimonies(); } catch (e) { return; } W.setThanks(THX.length); if (!$("#thanksModal").hidden) renderThanks(); }
function renderThanks() {
  const ul = $("#thanksList");
  ul.replaceChildren(...(THX.length ? THX.map((t) => {
    const mine = myThx.has(t.id), done = thxAmen.has(t.id);
    return h("li", { class: "gb-item thx" }, h("p", { text: "🍎 " + t.content }),
      h("div", { class: "who" }, h("span", { text: (t.name || "익명") + (mine ? " · 나" : "") + " · " + timeAgo(t.created_at) }), h("span", { class: "grow" }),
        h("button", { class: "btn ghost sm" + (done ? " on" : ""), text: `🙌 함께 감사해요 ${t.amen_count}`, onclick: () => thxDo(t, "amen") }),
        mine ? h("button", { class: "btn ghost sm", text: "삭제", onclick: () => thxDo(t, "del") }) : h("button", { class: "btn ghost sm", text: "⚑", title: "신고", onclick: () => thxDo(t, "report") }),
        isAll() ? h("button", { class: "btn danger sm", text: "관리자 삭제", onclick: () => thxDo(t, "admin") }) : null));
  }) : [h("li", { class: "empty-msg", text: "아직 열매가 없어요. 첫 감사 이야기를 나눠 주세요 🌱" })]));
}
async function thxDo(t, what) {
  try {
    if (what === "amen") { if (thxAmen.has(t.id)) { toast("이미 함께 감사했어요 🙌"); return; } t.amen_count = Number(await api.amenTestimony(t.id)) || t.amen_count + 1; thxAmen.add(t.id); store.set("thxAmen", [...thxAmen]); renderThanks(); return; }
    if (what === "del") await api.deleteMyTestimony(t.id);
    if (what === "report") { await api.reportTestimony(t.id); toast("신고했어요. 3번 쌓이면 가려져요"); }
    if (what === "admin") await api.adminDeleteTestimony(S.admin, t.id);
    loadThanks();
  } catch (e) { toast(e.message); }
}
function openThanks() { renderThanks(); openModal("thanksModal"); loadThanks(); }
$$(".thanks-open").forEach((b) => (b.onclick = openThanks));
$("#thanksPost").onclick = async () => {
  const v = $("#thanksInput").value.trim();
  if (!v) { toast("감사한 이야기를 적어주세요 🙂"); return; }
  if (!checkText(v)) return;
  try {
    const id = await api.addTestimony($("#thanksAnon").checked ? "" : clip(S.profile?.name, LIMIT.name), clip(v, 200));
    myThx.add(Number(id)); store.set("myThx", [...myThx]);
    $("#thanksInput").value = ""; toast("🍎 감사 나무에 열매가 하나 달렸어요!"); loadThanks();
  } catch (e) { toast(e.message); }
};

/* ================= 🏆 운동장 점수 · 랭킹 ================= */
let srTimer = null;
function sportPoints(kind, pts) { api.sportAdd(kind, pts).catch((e) => console.warn("운동장 점수:", e.message)); clearTimeout(srTimer); srTimer = setTimeout(loadSportBoard, 3000); }
async function loadSportBoard() {
  let top = []; try { top = await api.sportRanking("week"); } catch (e) { return; }
  W.setBoard("sportBoard", top.slice(0, 5).map((r) => ({ l: `${["🥇", "🥈", "🥉"][r.rank - 1] || r.rank + "."} ${clip(r.name, 8) || "익명"}`, r: `${r.points}점`, hi: r.me })));
}
let SR_PERIOD = "week";
async function loadSportRank() {
  const ol = $("#sportRankList"); ol.replaceChildren(h("li", { class: "muted", text: "불러오는 중…" }));
  let list = []; try { list = await api.sportRanking(SR_PERIOD); } catch (e) { ol.replaceChildren(h("li", { class: "muted", text: "랭킹을 불러오지 못했어요. " + e.message })); return; }
  ol.replaceChildren(...(list.length ? list.map((r) => h("li", { class: r.me ? "me" : "" }, h("span", { class: "rk", text: ["🥇", "🥈", "🥉"][r.rank - 1] || String(r.rank) }), h("span", { class: "nm", text: (clip(r.name, LIMIT.name) || "익명") + (r.me ? " (나)" : "") }), h("small", { text: `🏀${r.bb} · 🎾🏸${r.rk}` }), h("b", { text: `${r.points}점` })))
    : [h("li", { class: "muted", text: "아직 기록이 없어요. 첫 골의 주인공이 되어 보세요! 🏀" })]));
}
function openSportRank() { openModal("sportRankModal"); loadSportRank(); }
$$("[data-sper]").forEach((b) => (b.onclick = () => { SR_PERIOD = b.dataset.sper; $$("[data-sper]").forEach((x) => x.classList.toggle("active", x === b)); loadSportRank(); }));

/* ================= ⚔️ 농구 팀전 (3분) ================= */
const TEAM = [["🔴 빨강", "#e74c3c"], ["🔵 파랑", "#3b82f6"]];
const GAME = { id: null, end: 0, teams: {}, score: [0, 0], dur: 180 };
const gameOn = () => !!GAME.id && performance.now() < GAME.end;
function bbCourtPeople() { return S.peers.filter((p) => (p.id === myId ? W.actorPos(myId) : p.pos) && inRect(p.id === myId ? W.actorPos(myId) : p.pos, CT.bb.rect, 1)); }
function startTeamGame() {
  const pl = shuffle(bbCourtPeople().map((p) => p.id));
  if (pl.length < 2) { toast("농구장에 두 명 이상 있어야 팀전을 할 수 있어요"); return; }
  const teams = {}; pl.forEach((id, i) => (teams[id] = i % 2));
  const msg = { k: "bbgame", id: myId.slice(0, 8) + Date.now(), dur: GAME.dur, teams };
  onGame(msg); api.sendSport(msg);
}
function onGame(m) {
  if (!m.teams || typeof m.teams !== "object") return;
  GAME.id = m.id; GAME.end = performance.now() + (Number(m.dur) || 180) * 1000; GAME.teams = m.teams; GAME.score = [0, 0];
  W.setTeams(Object.fromEntries(Object.entries(m.teams).map(([id, t]) => [id, TEAM[t] ? TEAM[t][1] : null])));
  const mine = m.teams[myId];
  toast(mine != null ? `⚔️ 팀전 시작! 나는 ${TEAM[mine][0]}팀 · 3분 동안 많이 넣는 팀이 이겨요` : "⚔️ 농구 팀전이 시작됐어요! 구경해요 👀");
  updateGameLabel(); renderSportBar(true);
  const id = m.id; setTimeout(() => endGame(id), (Number(m.dur) || 180) * 1000 + 300);
}
function gameScoreShot(sh) {
  if (!gameOn() || GAME.teams[sh.by] == null || !sh.make) return;
  GAME.score[GAME.teams[sh.by]] += sh.three ? 3 : 2; updateGameLabel();
}
function updateGameLabel() { W.setCourtLabel("bb", gameOn() ? `⚔️ ${TEAM[0][0]} ${GAME.score[0]} : ${GAME.score[1]} ${TEAM[1][0]}` : "🏀 농구장 · 공 잡고 슛!"); }
function endGame(id) {
  if (GAME.id !== id) return;
  const [a, b] = GAME.score, mine = GAME.teams[myId], win = a === b ? -1 : a > b ? 0 : 1;
  toast(win < 0 ? `⚔️ 무승부! ${a} : ${b} 😄` : `🏆 ${TEAM[win][0]}팀 승리! ${a} : ${b}`);
  if (mine != null && mine === win) sportPoints("bb", 3);
  GAME.id = null; W.setTeams({}); updateGameLabel(); renderSportBar(true);
}
const gameLeft = () => { const s = Math.max(0, Math.ceil((GAME.end - performance.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/* ================= 🔔 알림 받기 (홈 화면 앱 푸시) ================= */
const PUSH_KEY = CFG.pushPublicKey || "";
const NOTI = store.get("notiPrefs", { visit: true, event: true });
function b64ToU8(b) { const p = "=".repeat((4 - (b.length % 4)) % 4), s = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); }
async function pushSub() { if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null; const reg = await navigator.serviceWorker.ready; return { reg, sub: await reg.pushManager.getSubscription() }; }
async function openNotify() {
  const body = $("#notifyBody"), note = (t) => h("p", { class: "muted", text: t });
  openModal("notifyModal");
  if (api.demo) { body.replaceChildren(note("알림은 Supabase에 연결한 뒤에 쓸 수 있어요. (지금은 데모 모드)")); return; }
  if (!PUSH_KEY) { body.replaceChildren(note("관리자 설정이 아직 안 됐어요. config.js의 pushPublicKey와 Supabase 알림 함수(notify)를 설정하면 쓸 수 있어요.")); return; }
  if (isIOS && !isStandalone()) { body.replaceChildren(note("아이폰은 먼저 홈 화면에 그루터기 앱을 추가하고, 그 앱으로 들어와서 알림을 켜 주세요. (iOS 16.4 이상)"), h("button", { class: "btn primary", text: "📲 홈 화면에 추가하는 방법", onclick: () => { closeModal("notifyModal"); $("#installBtn").click(); } })); return; }
  const st = await pushSub().catch(() => null);
  if (!st) { body.replaceChildren(note("이 브라우저는 알림을 지원하지 않아요. 크롬이나 삼성 인터넷, 또는 홈 화면 앱으로 열어 주세요.")); return; }
  const on = !!st.sub && Notification.permission === "granted";
  const chk = (key, label) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked: NOTI[key] || null, onchange: async (e) => { NOTI[key] = e.target.checked; store.set("notiPrefs", NOTI); if (on) { try { await api.pushSave(st.sub.toJSON(), NOTI.visit, NOTI.event); toast("알림 설정을 바꿨어요"); } catch (er) { toast(er.message); } } } }), " " + label);
  body.replaceChildren(
    h("p", { class: "muted", text: on ? "✅ 이 기기에서 알림을 받고 있어요." : "그루터기에 친구가 오거나 모임이 올라오면 폰으로 알려 드려요." }),
    h("div", { class: "noti-opts" }, chk("visit", "🌱 누가 그루터기에 들어오면 (너무 자주 오지 않게 15분에 한 번까지)"), chk("event", "📅 새 모임이 올라오면")),
    h("div", { class: "modal-actions" }, on ? h("button", { class: "btn ghost", text: "알림 끄기", onclick: pushOff }) : h("button", { class: "btn primary", text: "🔔 알림 켜기", onclick: pushOn })),
    h("p", { class: "muted tiny", text: "카카오톡 알림은 보낼 수 없어요. 폰 알림(크롬·삼성 인터넷·홈 화면 앱)으로 와요." }));
}
async function pushOn() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("알림 허용을 눌러 주세요. 브라우저 설정에서 바꿀 수 있어요"); return; }
    const { reg } = await pushSub();
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(PUSH_KEY) }));
    await api.pushSave(sub.toJSON(), NOTI.visit, NOTI.event);
    toast("🔔 알림을 켰어요!"); openNotify();
  } catch (e) { toast("알림을 켜지 못했어요: " + e.message); }
}
async function pushOff() {
  try { const st = await pushSub(); if (st && st.sub) { await api.pushRemove(st.sub.endpoint).catch(() => {}); await st.sub.unsubscribe(); } toast("알림을 껐어요"); openNotify(); }
  catch (e) { toast(e.message); }
}
$("#notifyBtn").onclick = openNotify;
// 들어오면 (3시간에 한 번) 알림 함수에 "왔어요"를 알려요. 함수가 15분/3시간 간격을 다시 확인해요
function maybeNotifyVisit(room) {
  if (api.demo || !PUSH_KEY) return;
  if (Date.now() - store.get("lastVisitPush", 0) < 3 * 3600e3) return;
  store.set("lastVisitPush", Date.now());
  api.notify({ type: "visit", token, name: clip(S.profile?.name, LIMIT.name), room: ROOM_NAME[room] || "마당" });
}

/* ================= 🧩 성경 퀴즈 (비전 / 301호) ================= */
// 문제는 quiz-bank.js(직접 만든 문제) + 개역한글 본문으로 자동으로 만드는 문제를 섞어요.
// 한 번에 5문제, 채점하면 처음 맞힌 문제만 점수(쉬운 1 · 넌센스 1 · 중간 2 · 하이 3)가 랭킹에 쌓여요.
const QZ_LV = {
  easy: { name: "쉬운 퀴즈", emoji: "🌱", key: "e", desc: "누구나 아는 성경 이야기" },
  fun: { name: "재밌는 넌센스", emoji: "😆", key: "f", desc: "웃으면서 푸는 성경 넌센스" },
  mid: { name: "중간 레벨", emoji: "📘", key: "m", desc: "말씀 빈칸 · 성경 상식" },
  high: { name: "하이 레벨", emoji: "🔥", key: "h", desc: "깊이 있는 말씀과 교리" },
};
const QZ_BANK = window.QUIZ_BANK || [];
const qzHash = (s) => { let x = 5381; for (const ch of s) x = ((x << 5) + x + ch.codePointAt(0)) >>> 0; return x.toString(36); };
QZ_BANK.forEach((q) => (q.id = `q:${q.b}:${q.lv}:${qzHash(q.q)}`));
const QZ = {
  set: { books: [], general: true }, level: store.get("quizLevel", "easy"), round: null, graded: false, busy: false,
  period: "week", top: [], ok: new Set(store.get("quizOk", [])), seen: store.get("quizSeen", []), adminSel: new Set(), loadedAt: 0, grp: "g2",
};
// 퀴즈는 방마다 따로: 301호(3Q) = 청년 1부(g1) · 비전 = 청년 2부(g2). 맞힌 문제 기록도 따로 (2부는 예전 기록 그대로)
const qzGrp = () => (S.room === "room301" ? "g1" : "g2");
const qzOkKey = (g) => (g === "g1" ? "quizOk_g1" : "quizOk");
function qzUseGroup() {
  const g = qzGrp(); if (QZ.grp === g) return;
  QZ.grp = g; QZ.ok = new Set(store.get(qzOkKey(g), [])); QZ.round = null; QZ.loadedAt = 0; QZ.set = { books: [], general: true }; QZ.top = [];
}
const BOOK_GROUPS = [[1, 5, "모세오경(율법서)"], [6, 17, "구약 역사서"], [18, 22, "구약 시가서"], [23, 39, "구약 선지서"], [40, 43, "복음서"], [44, 44, "신약 역사서"], [45, 65, "서신서"], [66, 66, "신약 예언서"]];
const bkName = (b) => BOOKS[b - 1][0];
const eunNeun = (w) => w + (hasBatchim(w) ? "은" : "는");
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickN = (arr, n) => shuffle([...arr]).slice(0, n);
const rnd1 = (arr) => arr[Math.floor(Math.random() * arr.length)];
function qzBooks() { const b = (QZ.set.books || []).map(Number).filter((x) => x >= 1 && x <= 66); return b.length ? b : Array.from({ length: 66 }, (_, i) => i + 1); }
function rangeLabel(books = QZ.set.books) {
  const b = [...new Set((books || []).map(Number))].filter((x) => x >= 1 && x <= 66).sort((x, y) => x - y);
  if (!b.length || b.length === 66) return "성경 66권 전체";
  const same = (s, e) => b.length === e - s + 1 && b[0] === s && b[b.length - 1] === e;
  if (same(1, 39)) return "구약 39권 전체";
  if (same(40, 66)) return "신약 27권 전체";
  const parts = []; let st = b[0], pv = b[0];
  for (const x of [...b.slice(1), null]) { if (x === pv + 1) { pv = x; continue; } parts.push(st === pv ? bkName(st) : `${bkName(st)}~${bkName(pv)}`); st = pv = x; }
  return parts.join(", ");
}
// ---- 본문·목록으로 자동 문제 만들기 ----
const QZ_STOP = new Set(["그러므로", "그리하여", "그러나", "이르되", "가로되", "하니라", "하더라", "있더라", "있느니라", "하였더라", "이르시되", "가라사대", "또한", "그들이", "그들의", "너희가", "너희의", "우리가", "우리의", "내가", "나의", "네가", "너의", "그가", "그의", "저희가", "이것이", "그것이"]);
const QZ_AUTO = {
  group(b) {
    const a = BOOK_GROUPS.find(([s, e]) => b >= s && b <= e)[2];
    return { id: `a:g:${b}`, b, q: `${eunNeun(bkName(b))} 성경의 어느 부분에 속할까요?`, a, w: pickN(BOOK_GROUPS.map((g) => g[2]).filter((x) => x !== a), 3), e: `${eunNeun(bkName(b))} ${a}에 속해요.` };
  },
  next(b) {
    if (b >= 66) return null;
    const pool = [b - 1, b + 2, b + 3, b - 2, b + 4, b - 3].filter((x) => x >= 1 && x <= 66 && x !== b + 1 && x !== b);
    return { id: `a:n:${b}`, b, q: `성경 순서에서 ${bkName(b)} 바로 다음에 나오는 책은?`, a: bkName(b + 1), w: pool.slice(0, 3).map(bkName), e: `${bkName(b)} 다음은 ${bkName(b + 1)}예요.` };
  },
  chaps(b) {
    const n = BOOKS[b - 1][1];
    const w = [...new Set(shuffle([n - 2, n - 1, n + 1, n + 2, n + 3, n + 5, Math.round(n * 1.5), n * 2]).filter((x) => x >= 1 && x !== n))].slice(0, 3);
    return { id: `a:c:${b}`, b, q: `${eunNeun(bkName(b))} 모두 몇 장일까요?`, a: `${n}장`, w: w.map((x) => `${x}장`), e: `${eunNeun(bkName(b))} ${n}장이에요.` };
  },
  async verse(b, showRef) {
    let data; try { data = await Bible.get(b - 1); } catch { return null; }
    for (let t = 0; t < 14; t++) {
      const ci = Math.floor(Math.random() * data.chapters.length), ch = data.chapters[ci], vi = Math.floor(Math.random() * ch.length), text = ch[vi];
      if (!text || text.length < 18 || text.length > 95) continue;
      const words = text.split(/\s+/);
      const cand = words.map((w, i) => [w, i]).filter(([w]) => /^[가-힣]{2,}$/.test(w) && !QZ_STOP.has(w));
      if (!cand.length) continue;
      const [w, wi] = rnd1(cand);
      const pool = [...new Set(ch.join(" ").split(/\s+/))].filter((x) => /^[가-힣]{2,}$/.test(x) && x !== w && !words.includes(x) && Math.abs(x.length - w.length) <= 1);
      if (pool.length < 3) continue;
      const blank = words.map((x, i) => (i === wi ? "(　　　)" : x)).join(" ");
      return { id: `a:v:${b}:${ci + 1}:${vi + 1}:${wi}`, b, r: `${ci + 1}:${vi + 1}`, q: `빈칸에 들어갈 말은?${showRef ? ` (${bkName(b)} ${ci + 1}:${vi + 1})` : ""}\n“${blank}”`, a: w, w: pickN(pool, 3), e: `${bkName(b)} ${ci + 1}:${vi + 1} “${text}”` };
    }
    return null;
  },
  async whichChap(b) {
    const n = BOOKS[b - 1][1]; if (n < 4) return null;
    let data; try { data = await Bible.get(b - 1); } catch { return null; }
    for (let t = 0; t < 10; t++) {
      const ci = Math.floor(Math.random() * n), ch = data.chapters[ci], vi = Math.floor(Math.random() * ch.length), text = ch[vi];
      if (!text || text.length < 20 || text.length > 90) continue;
      const others = pickN(Array.from({ length: n }, (_, i) => i + 1).filter((c) => c !== ci + 1), 3);
      return { id: `a:ch:${b}:${ci + 1}:${vi + 1}`, b, r: `${ci + 1}:${vi + 1}`, q: `다음 말씀은 ${bkName(b)} 몇 장에 있을까요?\n“${text}”`, a: `${ci + 1}장`, w: others.map((c) => `${c}장`), e: `${bkName(b)} ${ci + 1}장 ${vi + 1}절 말씀이에요.` };
    }
    return null;
  },
};
const QZ_AUTO_BY = { easy: ["group", "next"], mid: ["chaps", "verse"], high: ["whichChap", "verse"] };
async function makeAuto(level, books) {
  for (let t = 0; t < 8; t++) {
    const kind = rnd1(QZ_AUTO_BY[level]), b = rnd1(books);
    const q = kind === "verse" ? await QZ_AUTO.verse(b, level === "mid") : await QZ_AUTO[kind](b);
    if (q && !QZ.ok.has(q.id)) return q;
  }
  return null;
}
async function buildRound(level) {
  const key = QZ_LV[level].key, books = qzBooks(), inRange = new Set(books);
  let pool = QZ_BANK.filter((q) => q.lv === key && (inRange.has(q.b) || (q.b === 0 && QZ.set.general !== false)));
  if (level === "fun" && pool.filter((q) => !QZ.ok.has(q.id)).length < 5) pool = pool.concat(QZ_BANK.filter((q) => q.lv === "f" && !pool.includes(q))); // 넌센스는 범위 밖에서도 채워요
  const seen = new Set(QZ.seen);
  const fresh = shuffle(pool.filter((q) => !QZ.ok.has(q.id))).sort((x, y) => seen.has(x.id) - seen.has(y.id));
  const out = fresh.slice(0, level === "fun" ? 5 : 4);
  while (out.length < 5 && level !== "fun") { const a = await makeAuto(level, books); if (!a || out.some((x) => x.id === a.id)) break; out.push(a); }
  if (out.length < 5) out.push(...shuffle(pool.filter((q) => !out.includes(q))).slice(0, 5 - out.length)); // 다 풀었으면 이미 맞힌 문제로 복습
  return shuffle(out).map((q) => ({ ...q, level, opts: shuffle([q.a, ...q.w]), pick: null }));
}
// ---- 화면 ----
async function loadQuizMeta(force) {
  qzUseGroup();
  if (!force && Date.now() - QZ.loadedAt < 8000) return;
  QZ.loadedAt = Date.now();
  const g = QZ.grp;
  try { const st = await api.quizSettings(g); if (g !== QZ.grp) return; QZ.set = { books: (st.books || []).map(Number), general: st.general !== false }; } catch (e) { console.warn("퀴즈 설정을 불러오지 못했어요 (supabase-update-quiz.sql 실행 여부 확인):", e.message); }
  try { const top = await api.quizRanking("week", g); if (g !== QZ.grp) return; QZ.top = top; } catch (e) { QZ.top = []; }
  renderQuizMeta();
}
function renderQuizMeta() {
  const top = (QZ.top || []).filter((r) => r.rank <= 3);
  W.setQuizBoard({ range: rangeLabel(), top, grp: GRP_NAME[QZ.grp] }, QZ.grp === "g1" ? "room301" : "vision");
  $$("[data-quiz-top]").forEach((ol) => ol.replaceChildren(...(top.length ? top.map((r) => h("li", {}, h("span", { text: `${["🥇", "🥈", "🥉"][r.rank - 1] || r.rank + "."} ${clip(r.name, 10) || "익명"}` }), h("b", { text: `${r.points}점` })))
    : [h("li", { class: "none", text: "이번 주 첫 번째 주인공이 되어 보세요 ✨" })])));
  $$("[data-quiz-range]").forEach((el) => (el.textContent = "출제 범위 · " + rangeLabel()));
  if (!$("#quizModal").hidden) $("#qzRange").textContent = "📚 출제 범위 · " + rangeLabel() + (QZ.set.general !== false ? " (+ 교리·성경 일반)" : "");
}
function openQuiz(tab = "play") {
  qzUseGroup();
  $("#qzTitle").textContent = `🧩 성경 퀴즈 · ${GRP_NAME[QZ.grp]}`;
  openModal("quizModal");
  loadQuizMeta(true).then(() => { if (tab === "play" && !QZ.round) renderQuizPlay(); });
  quizTab(tab);
  renderQuizMeta();
}
function quizTab(tab) {
  $$("[data-qtab]").forEach((b) => b.classList.toggle("active", b.dataset.qtab === tab));
  $("#qzPlay").hidden = tab !== "play"; $("#qzRank").hidden = tab !== "rank";
  if (tab === "rank") loadQuizRank(); else renderQuizPlay();
}
$$("[data-qtab]").forEach((b) => (b.onclick = () => quizTab(b.dataset.qtab)));
$$("[data-qper]").forEach((b) => (b.onclick = () => { QZ.period = b.dataset.qper; $$("[data-qper]").forEach((x) => x.classList.toggle("active", x === b)); loadQuizRank(); }));
function renderQuizLevels() {
  $("#qzLevels").replaceChildren(...Object.entries(QZ_LV).map(([k, L]) => h("button", { class: "qz-level" + (QZ.level === k ? " sel" : ""), onclick: () => startQuiz(k) },
    h("span", { class: "em", text: L.emoji }), h("b", { text: L.name }), h("small", { text: `${L.desc} · 맞히면 +${QUIZ_PTS[k]}점` }))));
}
async function startQuiz(level) {
  if (QZ.busy) return;
  QZ.level = level; store.set("quizLevel", level); QZ.busy = true; QZ.graded = false;
  renderQuizLevels();
  $("#qzList").replaceChildren(h("li", { class: "muted", text: "문제를 고르는 중… 📖" })); $("#qzFoot").replaceChildren();
  try { QZ.round = await buildRound(level); } finally { QZ.busy = false; }
  QZ.seen = [...QZ.round.map((q) => q.id), ...QZ.seen.filter((id) => !QZ.round.some((q) => q.id === id))].slice(0, 300); store.set("quizSeen", QZ.seen);
  if (["vision", "room301"].includes(S.room) && (!S.bubble || /^🧩/.test(S.bubble))) { S.bubble = `🧩 ${QZ_LV[level].name} 푸는 중!`; S.kind = "status"; S.amens = 0; refreshMe(); }
  renderQuizPlay();
}
function renderQuizPlay() {
  renderQuizLevels();
  const list = $("#qzList"), foot = $("#qzFoot"), R = QZ.round;
  if (!R) { list.replaceChildren(h("li", { class: "qz-start muted", text: "위에서 레벨을 고르면 5문제가 한꺼번에 나와요. 다 고르고 '채점하기'를 눌러요 🙂" })); foot.replaceChildren(); return; }
  if (!R.length) { list.replaceChildren(h("li", { class: "muted", text: "이 범위에는 아직 문제가 없어요. 관리자에게 범위를 넓혀 달라고 해 주세요." })); foot.replaceChildren(); return; }
  list.replaceChildren(...R.map((q, i) => {
    const opts = q.opts.map((o) => {
      let cls = "qz-opt";
      if (QZ.graded) { if (o === q.a) cls += " right"; else if (o === q.pick) cls += " wrong"; }
      else if (o === q.pick) cls += " sel";
      return h("button", { class: cls, disabled: QZ.graded || null, onclick: () => { q.pick = o; renderQuizPlay(); } }, o);
    });
    const li = h("li", { class: "qz-q" + (QZ.graded ? (q.pick === q.a ? " ok" : " no") : "") },
      h("div", { class: "qz-text" }, h("span", { class: "qz-num", text: `${i + 1}` }), h("span", { text: q.q })),
      h("div", { class: "qz-opts" }, ...opts));
    if (QZ.graded) {
      const right = q.pick === q.a;
      li.append(h("div", { class: "qz-exp" },
        h("b", { text: right ? (q.gain ? `✓ 정답! +${q.gain}점` : QZ.saveErr ? "✓ 정답!" : "✓ 정답! (전에 맞힌 문제)") : `✗ 정답은 “${q.a}”` }),
        q.e ? h("span", { text: " " + q.e }) : null,
        q.b > 0 && q.r ? h("button", { class: "btn ghost sm", text: `📖 ${bkName(q.b)} ${q.r.split(":")[0]}장 본문 보기`, onclick: () => openReader(q.b - 1, +q.r.split(":")[0]) }) : null));
    }
    return li;
  }));
  const done = R.filter((q) => q.pick != null).length;
  if (!QZ.graded) {
    foot.replaceChildren(h("button", { class: "btn primary wide", disabled: done < R.length || null, text: done < R.length ? `채점하기 (${done}/${R.length} 골랐어요)` : "✅ 채점하기", onclick: gradeQuiz }));
  } else {
    const k = R.filter((q) => q.pick === q.a).length, gain = R.reduce((a, q) => a + (q.gain || 0), 0);
    foot.replaceChildren(
      h("div", { class: "qz-score" }, h("b", { text: `${R.length}문제 중 ${k}개 맞혔어요! ${k === R.length ? "🎉" : k >= 3 ? "👏" : "💪"}` }),
        h("span", { text: QZ.saveErr ? ` · 점수를 저장하지 못했어요 (${QZ.saveErr})` : gain ? ` · 랭킹 +${gain}점` : k ? " · 전에 맞힌 문제라 점수는 그대로예요" : "" })),
      h("div", { class: "qz-actions" },
        h("button", { class: "btn primary", text: "➡ 다음 5문제", onclick: () => startQuiz(QZ.level) }),
        h("button", { class: "btn ghost", text: "🏆 랭킹 보기", onclick: () => quizTab("rank") })));
  }
}
async function gradeQuiz() {
  const R = QZ.round; if (!R || QZ.graded || QZ.busy) return;
  QZ.busy = true; QZ.saveErr = "";
  const right = R.filter((q) => q.pick === q.a);
  const items = right.filter((q) => !QZ.ok.has(q.id)).map((q) => ({ id: q.id, level: q.level }));
  let gain = 0;
  try { gain = Number(await api.quizSubmit(clip(S.profile?.name, LIMIT.name), items, QZ.grp)) || 0; items.forEach((it) => QZ.ok.add(it.id)); store.set(qzOkKey(QZ.grp), [...QZ.ok].slice(-3000)); }
  catch (e) { QZ.saveErr = e.message || "인터넷 연결 확인"; }
  // 서버가 돌려준 점수를 처음 맞힌 문제들에 나눠 표시
  let left = gain; for (const q of right) { const p = QUIZ_PTS[q.level]; if (items.some((it) => it.id === q.id) && left >= p) { q.gain = p; left -= p; } }
  QZ.graded = true; QZ.busy = false; mAdd("quiz");
  renderQuizPlay();
  if (["vision", "room301"].includes(S.room) && (!S.bubble || /^🧩/.test(S.bubble))) { S.bubble = `🧩 ${QZ_LV[QZ.level].name} ${right.length}/${R.length} 맞혔어요!`; S.kind = "status"; S.amens = 0; refreshMe(); }
  if (gain) toast(`🧩 +${gain}점! 랭킹에 올라갔어요`);
  loadQuizMeta(true);
}
async function loadQuizRank() {
  const ol = $("#qzRankList");
  ol.replaceChildren(h("li", { class: "muted", text: "불러오는 중…" }));
  let list = [];
  try { list = await api.quizRanking(QZ.period, QZ.grp); } catch (e) { ol.replaceChildren(h("li", { class: "muted", text: "랭킹을 불러오지 못했어요. " + e.message })); return; }
  if (!list.length) { ol.replaceChildren(h("li", { class: "muted", text: QZ.period === "week" ? "이번 주에는 아직 아무도 안 풀었어요. 1등의 기회예요! ✨" : "아직 기록이 없어요." })); return; }
  ol.replaceChildren(...list.map((r) => h("li", { class: r.me ? "me" : "" },
    h("span", { class: "rk", text: ["🥇", "🥈", "🥉"][r.rank - 1] || String(r.rank) }),
    h("span", { class: "nm", text: (clip(r.name, LIMIT.name) || "익명") + (r.me ? " (나)" : "") }),
    h("small", { text: `${r.solved}문제` }), h("b", { text: `${r.points}점` }))));
}
$$(".quiz-open").forEach((b) => (b.onclick = () => openQuiz("play")));
// ---- 관리자: 출제 범위 ----
function renderQuizAdmin() {
  const sel = QZ.adminSel;
  $("#qzAdminNow").textContent = `${GRP_NAME[qzAdminGrp()]} 지금 범위: ${rangeLabel((QZ.adminSet || QZ.set).books)} · 고른 것: ${sel.size ? rangeLabel([...sel]) : "아무것도 안 고르면 66권 전체"}`;
  $("#qzAdminBooks").replaceChildren(...BOOKS.map(([nm], i) => h("button", { class: "chip-btn" + (sel.has(i + 1) ? " sel" : ""), text: nm, onclick: () => { sel.has(i + 1) ? sel.delete(i + 1) : sel.add(i + 1); renderQuizAdmin(); } })));
  $("#qzGeneral").checked = QZ.adminGeneral !== false;
}
// 관리자 퀴즈: 고른 부(1부/2부)의 범위를 따로 불러와요
const qzAdminGrp = () => (S.adminRole === "g1" ? "g1" : $("#qzGrp").value || "g1");
async function openQuizAdmin() {
  const g = qzAdminGrp();
  let st = { books: [], general: true }; try { st = await api.quizSettings(g); } catch (e) {}
  QZ.adminSet = { books: (st.books || []).map(Number), general: st.general !== false };
  QZ.adminSel = new Set(QZ.adminSet.books); QZ.adminGeneral = QZ.adminSet.general;
  renderQuizAdmin();
}
const QZ_QUICK = { all: [], ot: [1, 39], nt: [40, 66], torah: [1, 5], gospel: [40, 43], epistle: [45, 65], none: null };
$$("[data-qz-quick]").forEach((b) => (b.onclick = () => {
  if (b.dataset.qzQuick === "sermon") { if (!SITE.sermon) { toast("먼저 설교 본문을 올려 주세요"); return; } QZ.adminSel = new Set([SITE.sermon.book]); renderQuizAdmin(); return; }
  const r = QZ_QUICK[b.dataset.qzQuick];
  QZ.adminSel = new Set(r && r.length ? Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i) : []);
  renderQuizAdmin();
}));
$("#qzGeneral").onchange = () => (QZ.adminGeneral = $("#qzGeneral").checked);
$("#qzSave").onclick = async () => {
  const books = [...QZ.adminSel].sort((a, b) => a - b);
  const g = qzAdminGrp();
  try { await api.adminSetQuiz(S.admin, g, books, QZ.adminGeneral !== false); toast(`🧩 ${GRP_NAME[g]} 퀴즈 범위를 '${rangeLabel(books)}'(으)로 정했어요`); QZ.round = null; await loadQuizMeta(true); openQuizAdmin(); }
  catch (e) { toast(e.message); }
};
let qzResetArm = 0;
$("#qzReset").onclick = async () => {
  if (Date.now() - qzResetArm > 4000) { qzResetArm = Date.now(); $("#qzReset").textContent = "정말 지울까요? 한 번 더 누르세요"; setTimeout(() => ($("#qzReset").textContent = "랭킹 처음부터 다시"), 4000); return; }
  qzResetArm = 0; $("#qzReset").textContent = "랭킹 처음부터 다시";
  const g = qzAdminGrp();
  try { await api.adminResetQuiz(S.admin, g); toast(`${GRP_NAME[g]} 퀴즈 랭킹을 모두 지웠어요`); loadQuizMeta(true); } catch (e) { toast(e.message); }
};

/* ================= 발자취 (다녀간 흔적) ================= */
// 기도/읽기/방문을 남기면 대시보드와 3D 공간(🌱 씨앗, 📖 펼친 성경)에 오늘 하루 보여요.
// 기도 내용은 저장하지 않고 "기도했어요"만 남아요.
const FPS = { list: [], ok: true, warned: false };
const fpLocal = (() => { const o = store.get("fpLocal", {}), now = Date.now(); for (const k in o) if (now - o[k].t > 86400e3) delete o[k]; return o; })();
async function leaveFootprint(kind, extra = {}) {
  if (!started || S.room === "showroom") return; // 쇼룸은 발자취 방 목록에 없어요 (출석 미션은 따로 기록)
  const p = S.profile || {};
  const f = {
    room: S.room, kind, name: kind === "pray" && S.anon ? "" : clip(p.name, LIMIT.name), color: p.color,
    seat: S.seat, x: S.pos && S.pos.x, z: S.pos && S.pos.z, ...extra,
  };
  // 같은 일을 짧은 시간에 반복하면 다시 보내지 않아요 (서버에서도 한 번 더 걸러요)
  const key = [kind, f.room, f.book || "", f.chap || ""].join("|"), now = Date.now(), win = kind === "read" ? 12 * 3600e3 : 30 * 60e3;
  const prev = fpLocal[key];
  if (prev && now - prev.t < win && prev.seat === f.seat && prev.name === f.name) return;
  fpLocal[key] = { t: now, seat: f.seat, name: f.name }; store.set("fpLocal", fpLocal);
  try { await api.addFootprint(f); loadFootprints(); }
  catch (e) { console.warn("발자취 저장 실패:", e.message); delete fpLocal[key]; }
}
function logRead(book, chap) { mAdd(`read:${book + 1}:${chap}`); leaveFootprint("read", { book: book + 1, chap, detail: chapLabel(book, chap) }); }
async function loadFootprints() {
  try { FPS.list = await api.listFootprints(new Date(Date.now() - 7 * 86400e3).toISOString()); FPS.ok = true; }
  catch (e) {
    FPS.ok = false;
    if (!FPS.warned) { FPS.warned = true; console.warn("발자취를 불러오지 못했어요. Supabase에서 supabase-update-footprints.sql을 실행했는지 확인해 주세요.", e.message); }
  }
  renderFootprintBits();
}
function renderFootprintBits() { renderTodayStrip(); renderPrayedToday(); renderRecentReads(); renderTraces(); if (!$("#dash").hidden) renderDash(); }
const personKey = (f) => (f.name || "익명") + "|" + (f.name ? "" : f.color || "");
const todays = () => FPS.list.filter((f) => isToday(f.created_at));
function renderTodayStrip() {
  const el = $("#todayCount");
  if (!FPS.ok) { el.textContent = "발자취 대시보드 열기"; return; }
  const t = todays(), people = new Set(t.map(personKey)).size;
  const pray = t.filter((f) => f.kind === "pray").length, read = t.filter((f) => f.kind === "read").length;
  el.textContent = people ? `오늘 ${people}명이 다녀갔어요 · 기도 ${pray} · 말씀 ${read}장 →` : "오늘 첫 발자취를 남겨보세요 →";
}
function renderPrayedToday() {
  const box = $("#prayedToday"); box.replaceChildren();
  const t = todays().filter((f) => f.kind === "pray" && f.room === "worship");
  const names = [...new Set(t.filter((f) => f.name).map((f) => f.name))], anon = t.filter((f) => !f.name).length;
  if (!names.length && !anon) { box.append(h("span", { class: "none", text: "아직 없어요. 오늘 첫 기도의 씨앗을 심어주세요 🙏" })); return; }
  names.slice(0, 14).forEach((n) => box.append(h("span", { class: "chip", text: "🌱 " + n })));
  if (anon) box.append(h("span", { class: "chip", text: `🌱 익명 ${anon}명` }));
}
function footLine(f) {
  const who = f.name ? `${f.name}님이` : "누군가";
  if (f.kind === "read") return `${who} ${f.detail || "말씀"}을 읽었어요`;
  if (f.kind === "pray") return `${who} 본당에서 기도했어요`;
  return f.room === "yard" ? `${who} 마당에 들렀어요` : `${who} ${ROOM_NAME[f.room]}에 다녀갔어요`;
}
const FOOT_ICON = { read: "📖", pray: "🙏", visit: "👣" };
function renderRecentReads() {
  const ul = $("#recentReads"); ul.replaceChildren();
  const reads = FPS.list.filter((f) => f.kind === "read").slice(0, 6);
  if (!reads.length) { ul.append(h("li", { class: "none", text: FPS.ok ? "아직 기록이 없어요." : "발자취를 불러오지 못했어요." })); return; }
  for (const f of reads) ul.append(h("li", {}, dot(f.color), h("span", { class: "t", text: `${f.name || "익명"} · ${f.detail}` }), h("small", { text: timeAgo(f.created_at) })));
}
let lastTraceKey = "";
function renderTraces() {
  if (!started) return;
  const list = todays().filter((f) => f.room === S.room && (f.kind === "pray" || f.kind === "read"));
  const key = S.room + "|" + list.map((f) => f.id + f.created_at + f.seat).join(",");
  if (key === lastTraceKey) return;
  lastTraceKey = key;
  W.setTraces(list);
}
// 대시보드
let dashRange = "today";
function renderDash() {
  const since = dashRange === "today" ? null : Date.now() - 7 * 86400e3;
  const list = FPS.list.filter((f) => (since ? new Date(f.created_at).getTime() >= since : isToday(f.created_at)));
  const stats = $("#dashStats"), reads = $("#dashReads"), ul = $("#dashList");
  if (!FPS.ok) {
    stats.replaceChildren(); reads.replaceChildren();
    ul.replaceChildren(h("li", { class: "empty-msg", text: "발자취를 불러오지 못했어요. 관리자는 Supabase에서 supabase-update-footprints.sql을 실행했는지 확인해 주세요." }));
    return;
  }
  const people = new Set(list.map(personKey)).size;
  const card = (n, label) => h("div", { class: "stat" }, h("b", { text: n }), h("span", { text: label }));
  stats.replaceChildren(card(people, "다녀간 사람"), card(list.filter((f) => f.kind === "pray").length, "기도"), card(list.filter((f) => f.kind === "read").length, "읽은 말씀(장)"));
  // 함께 읽은 말씀: 많이 읽은 순. 누르면 그 장을 바로 읽어요
  const agg = new Map();
  for (const f of list) if (f.kind === "read" && f.book) {
    const k = f.book + ":" + f.chap;
    if (!agg.has(k)) agg.set(k, { book: f.book - 1, chap: f.chap, names: [] });
    agg.get(k).names.push(f.name || "익명");
  }
  reads.replaceChildren();
  const sortedReads = [...agg.values()].sort((a, b) => b.names.length - a.names.length).slice(0, 16);
  if (!sortedReads.length) reads.append(h("span", { class: "none", text: "아직 읽은 말씀이 없어요." }));
  for (const r of sortedReads) reads.append(h("button", { class: "chip link", title: r.names.join(", "), onclick: () => openReader(r.book, r.chap) }, `${chapLabel(r.book, r.chap)} · ${r.names.length}명`));
  // 발자취 목록 (같은 사람이 같은 방에서 기도/읽기를 했으면 "다녀갔어요"는 빼고 보여줘요)
  const acts = list.filter((f) => f.kind !== "visit");
  const shown = list.filter((f) => f.kind !== "visit" || !acts.some((a) => personKey(a) === personKey(f) && a.room === f.room && Math.abs(new Date(a.created_at) - new Date(f.created_at)) < 90 * 60e3));
  ul.replaceChildren();
  if (!shown.length) { ul.append(h("li", { class: "empty-msg", text: dashRange === "today" ? "오늘은 아직 발자취가 없어요." : "최근 7일 동안 발자취가 없어요." })); return; }
  let lastDay = "";
  for (const f of shown.slice(0, 200)) {
    const dl = dayLabel(f.created_at);
    if (dashRange !== "today" && dl !== lastDay) { ul.append(h("li", { class: "day", text: dl })); lastDay = dl; }
    ul.append(h("li", { class: "foot " + f.kind },
      h("span", { class: "ic", text: FOOT_ICON[f.kind] || "👣" }), dot(f.color),
      h("span", { class: "t", text: footLine(f) }),
      h("small", { text: clockTime(f.created_at) }),
      isAll() ? h("button", { class: "btn ghost sm", text: "✕", title: "지우기", onclick: () => adminDo(() => api.adminDeleteFootprint(S.admin, f.id)).then(loadFootprints) }) : null));
  }
}
$$("#dash .seg-btn").forEach((b) => b.onclick = () => {
  dashRange = b.dataset.range;
  $$("#dash .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
  renderDash();
});

/* ================= 서랍 (기도 벽 / 발자취) ================= */
function openDrawer(id) { $$(".drawer").forEach((d) => (d.hidden = d.id !== id)); $("#scrim").hidden = false; }
function closeDrawers() { $$(".drawer").forEach((d) => (d.hidden = true)); $("#scrim").hidden = true; }
function openDash() { openDrawer("dash"); renderDash(); loadFootprints(); }
$("#dashBtn").onclick = openDash;
$$("[data-open-dash]").forEach((b) => (b.onclick = openDash));

/* ================= 기도 벽 ================= */
async function addToWall(content, anon) {
  if (!checkText(content)) return false;
  try {
    const id = await api.addPrayer(anon ? "" : clip(S.profile?.name, LIMIT.name), clip(content, LIMIT.wall));
    S.myPrayers.push(Number(id)); store.set("myPrayers", S.myPrayers);
    toast("기도 벽에 남겼어요 📜");
    if (!$("#wall").hidden) loadWall();
    return true;
  } catch (e) { toast(e.message || "남기지 못했어요. 잠시 후 다시 해주세요"); return false; }
}
async function loadWall() {
  try { S.prayers = await api.listPrayers(); renderWall(); }
  catch (e) { $("#wallList").replaceChildren(h("li", { class: "empty-msg", text: "기도 벽을 불러오지 못했어요." })); }
}
function renderWall() {
  const mine = new Set(S.myPrayers);
  let list = S.prayers;
  if (S.wallFilter === "mine") list = list.filter((p) => mine.has(p.id));
  if (S.wallFilter === "answered") list = list.filter((p) => p.answered);
  const ul = $("#wallList");
  ul.replaceChildren();
  if (!list.length) { ul.append(h("li", { class: "empty-msg", text: S.wallFilter === "mine" ? "이 기기에서 남긴 기도제목이 없어요." : "아직 기도제목이 없어요." })); return; }
  for (const p of list) {
    const isMine = mine.has(p.id);
    const amened = S.amened.includes(p.id);
    const row = h("div", { class: "row" },
      h("button", { class: "btn ghost sm" + (amened ? " on" : ""), onclick: () => amenWall(p) }, `🙏 함께 기도 ${p.amen_count}`));
    if (isMine) {
      row.append(h("button", { class: "btn ghost sm", text: p.answered ? "응답 취소" : "응답됐어요 ✨", onclick: () => toggleAnswered(p) }));
      row.append(h("button", { class: "btn ghost sm", text: "삭제", onclick: () => deleteMine(p) }));
    } else {
      row.append(h("span", { class: "grow" }), h("button", { class: "btn ghost sm", text: "⚑ 신고", onclick: () => openReport(p) }));
    }
    ul.append(h("li", { class: "wall-item" + (p.answered ? " answered" : "") },
      h("div", { class: "who" }, h("span", { text: (clip(p.name, LIMIT.name) || "익명") + (isMine ? " · 나" : "") }),
        h("span", {}, p.answered ? h("span", { class: "badge", text: "✨ 응답됐어요 · " }) : null, timeAgo(p.created_at))),
      h("p", { class: "txt", text: clip(p.content, LIMIT.wall) }),
      row));
  }
}
async function amenWall(p) {
  if (S.amened.includes(p.id)) { toast("이미 함께 기도했어요 🙏"); return; }
  try {
    const n = await api.amenPrayer(p.id);
    S.amened.push(p.id); store.set("amened", S.amened);
    p.amen_count = Number(n) || p.amen_count + 1;
    renderWall(); toast("함께 기도했어요 🙏");
  } catch (e) { toast(e.message); }
}
async function toggleAnswered(p) {
  try { await api.setAnswered(p.id, !p.answered); p.answered = !p.answered; renderWall(); if (p.answered) toast("할렐루야! 응답된 기도로 표시했어요 ✨"); }
  catch (e) { toast(e.message); }
}
async function deleteMine(p) {
  try { await api.deleteMyPrayer(p.id); S.prayers = S.prayers.filter((x) => x.id !== p.id); renderWall(); toast("삭제했어요"); }
  catch (e) { toast(e.message); }
}
$("#wallPost").onclick = async () => {
  const v = $("#wallInput").value.trim();
  if (!v) { toast("기도제목을 적어주세요"); return; }
  if (await addToWall(v, $("#wallAnon").checked)) $("#wallInput").value = "";
};
$$("#wall .seg-btn").forEach((b) => b.onclick = () => {
  S.wallFilter = b.dataset.filter;
  $$("#wall .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
  renderWall();
});
$("#wallBtn").onclick = () => { openDrawer("wall"); loadWall(); };
$("#scrim").onclick = closeDrawers;

/* ================= 신고 ================= */
function openReport(p) { S.reportTarget = p; openModal("reportModal"); }
$("#reportSend").onclick = async () => {
  const p = S.reportTarget; if (!p) return;
  const reason = ($("#reasons input:checked") || {}).value || "기타";
  try { await api.reportPrayer(p.id, reason); toast("신고했어요. 확인 후 조치할게요"); closeModal("reportModal"); loadWall(); }
  catch (e) { toast(e.message); }
};

/* ================= 모달 공통 ================= */
function openModal(id) { $("#" + id).hidden = false; }
function closeModal(id) { $("#" + id).hidden = true; if (id === "readerModal") stopReaderTimer(); if (id === "cookModal") stopCooking(); if (id === "cmGameModal") stopCookie(); }
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-close]");
  if (c) { const id = c.dataset.close; id === "wall" || id === "dash" ? closeDrawers() : closeModal(id); }
  if (e.target.classList.contains("modal") && e.target.id !== "entryModal") closeModal(e.target.id);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeDrawers();
  $("#peoplePop").hidden = true;
  ["reportModal", "planModal", "adminModal", "readerModal", "gbModal", "installModal", "truckModal", "shelfModal", "cookModal", "catModal", "quizModal", "songModal", "schedModal", "thanksModal", "challengeModal", "sportRankModal", "notifyModal", "jamPickModal", "cdModal", "recModal", "mapModal", "songsModal", "sheetModal", "songEditModal", "albumModal", "showModal", "cmGameModal", "orderModal", "adModal", "giftModal", "welcomeModal"].forEach(closeModal);
});

/* ================= 관리자 ================= */
// 관리자 역할: all = 전체 관리자 · g1 = 청년 1부 관리자 · praise = 찬양팀 (비밀번호마다 보이는 칸이 달라요)
const isAll = () => S.adminRole === "all";
function applyAdminRole() {
  const r = S.adminRole;
  $("#adminWho").textContent = r ? `🔐 ${ROLE_NAME[r]}(으)로 들어왔어요` : "";
  $$(".adm-sec").forEach((sec) => (sec.hidden = !r || !sec.dataset.roles.split(" ").includes(r)));
  // 1부 관리자는 1부 것만 고를 수 있어요
  const only = r === "g1" ? ["room301", "g1"] : null;
  $$("#noticeRoom option, #chGrp option, #qzGrp option").forEach((o) => (o.hidden = o.disabled = !!only && !only.includes(o.value)));
  if (r === "g1") { $("#noticeRoom").value = "room301"; $("#chGrp").value = "g1"; $("#qzGrp").value = "g1"; }
  else if (!$("#qzGrp").dataset.set) { $("#qzGrp").value = S.room === "vision" ? "g2" : "g1"; $("#noticeRoom").value = S.room === "vision" ? "vision" : S.room === "room301" ? "room301" : "all"; }
}
function openAdminParts() {
  applyAdminRole();
  const r = S.adminRole;
  if (r === "all" || r === "g1") { refreshAdmin(); openQuizAdmin(); openTogetherAdmin(); }
  if (r === "all") { loadOrders(); orderPushState(); renderAdminSummary(S.admin); }
}
$("#adminBtn").onclick = () => {
  $("#adminHint").textContent = api.demo ? "데모 모드 비밀번호: 전체 demo · 1부 demo1 · 찬양팀 demo3" : "";
  $("#adminLogin").hidden = !!S.admin; $("#adminPanel").hidden = !S.admin;
  openModal("adminModal");
  if (S.admin) openAdminParts();
};
$("#adminLoginBtn").onclick = async () => {
  const pw = $("#adminPw").value;
  try {
    const role = await api.adminRole(pw);
    if (role) { S.admin = pw; S.adminRole = role; $("#adminLogin").hidden = true; $("#adminPanel").hidden = false; $("#adminPw").value = ""; openAdminParts(); toast(`🔐 ${ROLE_NAME[role]}(으)로 들어왔어요`); renderAfterRole(); }
    else toast("비밀번호가 틀렸어요");
  } catch (e) { toast(e.message); }
};
$("#adminPw").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#adminLoginBtn").click(); });
$("#adminLogout").onclick = () => { S.admin = null; S.adminRole = null; closeModal("adminModal"); toast("관리자에서 나왔어요"); renderAfterRole(); };
// 관리자로 들어오거나 나가면 관리자 버튼이 있는 목록을 다시 그려요
function renderAfterRole() { if (S.room === "praise") { renderSongList && renderSongList(); } if (!$("#recModal").hidden) renderRecs(); }
$$("[data-pw-role]").forEach((b) => (b.onclick = async () => {
  const role = b.dataset.pwRole, inp = role === "g1" ? $("#pwG1") : $("#pwPraise"), v = inp.value.trim();
  if (v.length < 3) { toast("비밀번호를 3글자 이상으로 적어 주세요"); return; }
  try { await api.adminSetRolePw(S.admin, role, v); inp.value = ""; toast(`🔑 ${ROLE_NAME[role]} 비밀번호를 바꿨어요`); } catch (e) { toast(e.message); }
}));
$("#qzGrp").onchange = () => { $("#qzGrp").dataset.set = "1"; openQuizAdmin(); };
$("#chGrp").onchange = () => renderAdminCh();
function openTogetherAdmin() { if (isAll()) { fillSiteAdmin(); renderAdminEvents(); if (!$("#evStart").value) $("#evStart").value = defaultEvStart(); loadEvents(); } fillChAdmin(); loadChallenge(); }
async function refreshAdmin() { if (isAll()) { loadGroup(); loadReported(); } loadAdminNotices(); }
function renderAdminGroup(list) {
  const ul = $("#adminGroupList");
  ul.replaceChildren(...list.map((g) => h("li", {},
    h("span", { class: "t", text: (g.answered ? "✨ " : "") + g.content }),
    h("button", { class: "btn ghost sm", text: g.answered ? "응답 취소" : "응답됨", onclick: () => adminDo(() => api.adminSetGroupAnswered(S.admin, g.id, !g.answered)) }),
    h("button", { class: "btn ghost sm", text: "삭제", onclick: () => adminDo(() => api.adminDeleteGroup(S.admin, g.id)) }),
  )));
  if (!list.length) ul.append(h("li", {}, h("span", { class: "t", text: "아직 없어요" })));
}
async function loadReported() {
  try {
    const list = await api.adminListReported(S.admin);
    const ul = $("#adminReportList");
    ul.replaceChildren(...list.map((p) => h("li", { class: p.hidden ? "hidden-item" : "" },
      h("span", { class: "t" }, p.content, h("small", { text: `${p.name || "익명"} · 신고 ${p.report_count}회${p.hidden ? " · 가려짐" : ""}` })),
      h("button", { class: "btn ghost sm", text: "복구", onclick: () => adminDo(() => api.adminRestorePrayer(S.admin, p.id)) }),
      h("button", { class: "btn danger sm", text: "삭제", onclick: () => adminDo(() => api.adminDeletePrayer(S.admin, p.id)) }),
    )));
    if (!list.length) ul.append(h("li", {}, h("span", { class: "t", text: "신고된 글이 없어요 🙂" })));
  } catch (e) { toast(e.message); }
}
async function adminDo(fn) {
  try { await fn(); refreshAdmin(); if (!$("#wall").hidden) loadWall(); }
  catch (e) { toast(e.message); if (/비밀번호가 틀렸/.test(e.message)) { S.admin = null; S.adminRole = null; closeModal("adminModal"); } }
}
$("#groupAdd").onclick = async () => {
  const v = $("#groupInput").value.trim();
  if (!v) return;
  await adminDo(() => api.adminAddGroup(S.admin, v));
  $("#groupInput").value = "";
};


/* ================= 배경음 (전부 직접 합성) ================= */
// 마당: 바람·새소리만 (2026-11-12 마당 음악 '크리스마스의 이유'는 뺐어요 → 찬양팀 연습실 CD 선반에서 들을 수 있어요)
const Sound = {
  ctx: null, on: false, master: null, timers: [], srcs: [], songEl: null, songGain: null, songPause: null,
  ensure() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; this.ctx = new AC(); }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return true;
  },
  noiseBuf(kind, sec = 4) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    if (kind === "pink") { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.9; } }
    else if (kind === "brown") { let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } }
    else for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 이음새 부드럽게
    const f = 2000; for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
    return b;
  },
  loop(buf, type, freq, vol, q) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(); this.srcs.push(s);
    return g;
  },
  start(room) {
    this.stop();
    if (!this.ensure()) return;
    const ctx = this.ctx, m = ctx.createGain();
    m.gain.setValueAtTime(0, ctx.currentTime);
    m.gain.linearRampToValueAtTime(room === "worship" ? 0.22 : room === "room301" ? 0.18 : 0.32, ctx.currentTime + 2.5);
    m.connect(ctx.destination); this.master = m;
    if (room === "praise") return; // 연습실은 배경음 없이 (악기 소리·CD가 잘 들리게)
    if (room === "worship" || room === "room301") this.piano(); else if (room === "cafe" || room === "vision" || room === "showroom") this.jazz(); else this.outdoor(1);
  },
  song() {}, // 예전 마당 음원 자리 (지금은 아무것도 안 해요)
  piano() {
    const ctx = this.ctx, m = this.master;
    const delay = ctx.createDelay(); delay.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.38; const wet = ctx.createGain(); wet.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(m);
    const note = (midi, t, dur, vol) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
      o.type = "sine"; o2.type = "triangle";
      const f = 440 * Math.pow(2, (midi - 69) / 12); o.frequency.value = f; o2.frequency.value = f * 2; g2.gain.value = 0.12;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(m); g.connect(delay);
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    };
    const chords = [[60, 64, 67, 72, 67], [57, 60, 64, 69, 64], [53, 57, 60, 65, 60], [55, 59, 62, 67, 62]];
    let i = 0;
    const bar = () => { const t = ctx.currentTime + 0.05, ch = chords[i++ % chords.length]; note(ch[0] - 12, t, 4.2, 0.28); ch.forEach((n, j) => note(n, t + j * 0.62, 3.2, 0.2)); if (i % 2 === 0) note(ch[3] + 12, t + 3.1, 2.2, 0.08); };
    bar(); this.timers.push(setInterval(bar, 3800));
  },
  jazz() {
    // 찬송가 재즈 (저작권 만료 곡): 나 같은 죄인 살리신(재즈 왈츠) → 기뻐하며 경배하세(스윙 발라드)
    const ctx = this.ctx, out = this.master;
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.3; conv.connect(wet); wet.connect(out);
    const bus = ctx.createGain(); bus.connect(out); bus.connect(conv);
    const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const env = (g, t, v, a, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0004, t + d); };
    const rhodes = (m, t, dur, v) => {
      const o = ctx.createOscillator(), md = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = mf(m);
      o.frequency.value = f; md.frequency.value = f;
      mg.gain.setValueAtTime(f * 1.1, t); mg.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.7);
      md.connect(mg); mg.connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0004, t + dur + 0.5);
      o.connect(g); g.connect(bus); o.start(t); md.start(t); o.stop(t + dur + 0.6); md.stop(t + dur + 0.6);
    };
    const vibe = (m, t, dur, v) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), tr = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.frequency.value = mf(m); o2.frequency.value = mf(m) * 4; g2.gain.value = 0.06;
      lfo.frequency.value = 4.5; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(tr.gain); tr.gain.value = 0.85;
      env(g, t, v, 0.006, t > 0 ? Math.max(1.0, dur * 1.5) : 1);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(tr); tr.connect(bus);
      const end = t + Math.max(1.0, dur * 1.5) + 0.1;
      o.start(t); o2.start(t); lfo.start(t); o.stop(end); o2.stop(end); lfo.stop(end);
    };
    const bass = (m, t, dur, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = mf(m); f.type = "lowpass"; f.frequency.value = 520;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.22); g.gain.exponentialRampToValueAtTime(0.0004, t + dur * 0.98);
      o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur);
    };
    const nb = this.noiseBuf("white", 1);
    const hit = (t, v, freq, type, len) => {
      const s = ctx.createBufferSource(); s.buffer = nb;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + len * 0.35); g.gain.exponentialRampToValueAtTime(0.0003, t + len);
      s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.6); s.stop(t + len + 0.02);
    };
    const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const parse = (n) => { const m = /^([A-G])([b#]?)(maj7|m7|7)$/.exec(n); let pc = PC[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0); return { pc: (pc + 12) % 12, q: m[3] }; };
    const voicing = (c) => { const iv = c.q === "maj7" ? [4, 7, 11, 14] : c.q === "m7" ? [3, 7, 10, 14] : [4, 9, 10, 14]; let r = 48 + c.pc; if (r + iv[0] < 53) r += 12; if (r + iv[0] > 62) r -= 12; return iv.map((i) => r + i); };
    const broot = (pc) => { let r = 36 + pc; if (r < 40) r += 12; return r; };

    const TUNES = [
      { // 나 같은 죄인 살리신 (New Britain, 1829) — 3/4 재즈 왈츠, G
        bpm: 104, meter: 3, swing: false, off: 1,
        mel: [[62, 1], [67, 2], [71, .5], [67, .5], [71, 2], [69, 1], [67, 2], [64, 1], [62, 2], [62, 1], [67, 2], [71, .5], [67, .5], [71, 2], [69, 1], [74, 3],
          [74, 2], [71, 1], [74, 2], [71, .5], [67, .5], [71, 2], [69, 1], [67, 2], [64, 1], [62, 2], [62, 1], [67, 2], [71, .5], [67, .5], [71, 2], [69, 1], [67, 3], [67, 2]],
        chords: [["Gmaj7", 3], ["Em7", 3], ["Cmaj7", 3], ["Gmaj7", 3], ["Gmaj7", 3], ["Em7", 1.5], ["A7", 1.5], ["Am7", 3], ["D7", 3],
          ["Bm7", 3], ["Em7", 3], ["Cmaj7", 3], ["Bm7", 1.5], ["E7", 1.5], ["Am7", 3], ["D7", 3], ["Gmaj7", 3], ["Gmaj7", 2]],
      },
      { // 기뻐하며 경배하세 (환희의 송가, 베토벤) — 4/4 스윙 발라드, C
        bpm: 84, meter: 4, swing: true, off: 0,
        mel: [
          [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1], [76, 1.5], [74, .5], [74, 2],
          [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1], [74, 1.5], [72, .5], [72, 2],
          [74, 1], [74, 1], [76, 1], [72, 1], [74, 1], [76, .5], [77, .5], [76, 1], [72, 1], [74, 1], [76, .5], [77, .5], [76, 1], [74, 1], [72, 1], [74, 1], [67, 2],
          [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1], [74, 1.5], [72, .5], [72, 2]],
        chords: [
          ["Cmaj7", 4], ["Dm7", 2], ["G7", 2], ["Cmaj7", 2], ["Am7", 2], ["Dm7", 2], ["G7", 2],
          ["Cmaj7", 4], ["Dm7", 2], ["G7", 2], ["Cmaj7", 2], ["Am7", 2], ["Dm7", 2], ["Cmaj7", 2],
          ["Dm7", 4], ["Em7", 2], ["A7", 2], ["Dm7", 2], ["G7", 2], ["Cmaj7", 2], ["G7", 2],
          ["Cmaj7", 4], ["Dm7", 2], ["G7", 2], ["Em7", 2], ["A7", 2], ["Dm7", 2], ["Cmaj7", 2]],
      },
    ];
    // 곡마다 두 번: 처음은 비브라폰 멜로디, 두 번째는 피아노가 한 옥타브 아래로 부드럽게
    const events = []; let T0 = 0;
    for (const tn of TUNES) for (let ch = 0; ch < 2; ch++) {
      const spb = 60 / tn.bpm, sw = (b) => (tn.swing && Math.abs((b % 1) - 0.5) < 1e-6 ? b + 1 / 6 : b);
      let b = 0;
      for (const [n, d] of tn.mel) { if (n != null) events.push({ t: T0 + sw(b) * spb, k: ch ? "rh" : "vb", m: ch ? n - 12 : n, d: d * spb, v: (ch ? 0.07 : 0.13) * (0.85 + Math.random() * 0.3) }); b += d; }
      const total = b;
      b = tn.off;
      tn.chords.forEach(([name, d], i) => {
        const c = parse(name), nx = parse((tn.chords[i + 1] || tn.chords[0])[0]), r = broot(c.pc), third = c.q === "m7" ? 3 : 4;
        events.push({ t: T0 + b * spb, k: "ch", notes: voicing(c), d: d * spb, v: 0.045 });
        if (tn.meter === 4 && d >= 2) events.push({ t: T0 + (b + 1.5 + 1 / 6) * spb, k: "ch", notes: voicing(c), d: 0.4 * spb, v: 0.03 });
        const walk = tn.meter === 3 ? [0, 7, third] : [0, 7, third, 7];
        for (let k = 0; k < Math.floor(d); k++) {
          let m = r + walk[k % walk.length];
          if (k === Math.floor(d) - 1 && k > 0) { const nr = broot(nx.pc); m = nr + (k % 2 ? -1 : 1); }
          events.push({ t: T0 + (b + k) * spb, k: "bs", m, d: spb * 0.95, v: 0.24 });
        }
        b += d;
      });
      for (let k = 0; k < total; k++) {
        events.push({ t: T0 + k * spb, k: "br", v: 0.014 });
        const beat = k % tn.meter;
        if (tn.meter === 4) { events.push({ t: T0 + k * spb, k: "rd", v: beat % 2 ? 0.022 : 0.014 }); if (beat % 2) events.push({ t: T0 + (k + 2 / 3) * spb, k: "rd", v: 0.012 }); }
        else events.push({ t: T0 + k * spb, k: "rd", v: beat === 0 ? 0.02 : 0.012 });
      }
      T0 += total * spb;
    }
    events.sort((a, b) => a.t - b.t);
    const LOOP = T0;
    let idx = 0, base = ctx.currentTime + 0.3;
    const play = (e, t) => {
      if (e.k === "vb") vibe(e.m, t, e.d, e.v);
      else if (e.k === "rh") rhodes(e.m, t, e.d, e.v);
      else if (e.k === "ch") e.notes.forEach((n, i) => rhodes(n, t + i * 0.012, e.d * 0.9, e.v));
      else if (e.k === "bs") bass(e.m, t, e.d, e.v);
      else if (e.k === "br") hit(t, e.v, 3500, "bandpass", 0.2);
      else if (e.k === "rd") hit(t, e.v, 8000, "highpass", 0.22);
    };
    const tick = () => {
      const horizon = ctx.currentTime + 0.8;
      while (base + events[idx].t < horizon) {
        const t = base + events[idx].t;
        if (t > ctx.currentTime - 0.05) play(events[idx], Math.max(t, ctx.currentTime));
        idx++;
        if (idx >= events.length) { idx = 0; base += LOOP + 1.2; }
      }
    };
    tick(); this.timers.push(setInterval(tick, 150));
  },
  outdoor(f = 1) {
    const ctx = this.ctx;
    const wind = this.loop(this.noiseBuf("pink", 6), "lowpass", 600, 0.35 * f);
    this.timers.push(setInterval(() => { try { wind.gain.setTargetAtTime((0.2 + Math.random() * 0.3) * f, ctx.currentTime, 1.5); } catch {} }, 2500));
    const chirp = () => {
      const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1600;
      for (let k = 0; k < n; k++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + k * 0.13;
        o.type = "sine"; o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * 1.35, tt + 0.07);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.03 * Math.max(0.6, f), tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0003, tt + 0.1);
        o.connect(g); g.connect(this.master); o.start(tt); o.stop(tt + 0.12);
      }
    };
    this.timers.push(setInterval(() => { if (Math.random() < 0.4) chirp(); }, 2200));
  },
  stop() {
    this.timers.forEach(clearInterval); this.timers = [];
    this.srcs.forEach((s) => { try { s.stop(); } catch {} }); this.srcs = [];
    if (this.master) {
      const m = this.master; this.master = null;
      try { m.gain.cancelScheduledValues(this.ctx.currentTime); m.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); } catch {}
      setTimeout(() => { try { m.disconnect(); } catch {} }, 1200);
    }
  },
};
function setSound(on, quiet) {
  Sound.on = on; store.set("soundOff", !on);
  const b = $("#soundBtn"); b.classList.toggle("on", Sound.on); b.firstChild.textContent = Sound.on ? "🔊" : "🔈";
  Sound.on ? Sound.start(S.room) : Sound.stop();
  const msg = { yard: "바람 소리와 새소리를 틀었어요", worship: "잔잔한 피아노를 틀었어요", cafe: "찬송가 재즈를 틀었어요 🎷", vision: "찬송가 재즈를 틀었어요 🎷", room301: "작은 소리로 피아노를 틀었어요 😌", showroom: "쇼룸에 재즈를 틀었어요 🧀🎷", praise: "연습실은 배경음 없이 조용해요 · 악기를 쳐 보세요 🎸" };
  if (!quiet) toast(Sound.on ? msg[S.room] : "배경음을 껐어요");
}
$("#soundBtn").onclick = () => setSound(!Sound.on);
// 폰은 화면을 한 번 눌러야 소리를 낼 수 있어요 → 처음 누르는 순간 배경음을 켜요 (🔈로 끄면 다음부터는 꺼진 채로 시작)
function soundOnFirstTap(e) {
  ["click", "touchend", "keydown"].forEach((t) => document.removeEventListener(t, soundOnFirstTap, true));
  if (Sound.on || store.get("soundOff", false) || (e.target && e.target.closest && e.target.closest("#soundBtn"))) return;
  setSound(true, true);
}
["click", "touchend", "keydown"].forEach((t) => document.addEventListener(t, soundOnFirstTap, true));

/* ----- 🎵 크리스마스의 이유 (마당 포스터) ----- */
// 마당에서는 음악이 나오지 않아요. 포스터를 누르면 커버를 보고, 찬양팀 연습실 CD로 들으러 갈 수 있어요.
function openSong() { openModal("songModal"); }
$("#songPlay").onclick = () => {
  closeModal("songModal");
  const go = () => { const c = W.LR_CDS.find((x) => /크리스마스/.test(x[1])) || W.LR_CDS[0]; playCd(c[0], c[1]); };
  if (S.room !== "praise") { joinRoom("praise", S.room); setTimeout(go, 400); } else go();
};

/* ================= 입장 / 캐릭터 꾸미기 ================= */
const draft = Object.assign({ name: "", color: L.shirts[Math.floor(Math.random() * L.shirts.length)], hair: "short", hairColor: "#2b2220", glasses: "none", gender: "m", item: "none", wear: "none",
  halo: "none", trail: "none", shoulder: "none", apron: "none", pin: "none", badge: "", title: "", pet: -1, petPick: 0 }, S.profile || {});
let preview = null;
function renderPickers() {
  // 🔒 미션으로 받는 것은 받기 전까지 잠겨 있어요 (누르면 받는 방법을 알려 줘요)
  const slotOf = { item: "item", wear: "wear", halo: "halo", trail: "trail", shoulder: "shoulder", apron: "apron", pin: "pin", badge: "badge", title: "title" };
  const chips = (box, list, key) => $(box).replaceChildren(...list.map(([v, label]) => {
    const sk = slotOf[key] && skinFor(slotOf[key], v), lock = !!sk && !skinOpen(sk, skinCtx());
    return h("button", { class: "chip-btn" + (draft[key] === v ? " sel" : "") + (lock ? " locked" : ""), text: (lock ? "🔒 " : "") + label, onclick: () => {
      if (lock) { const sn = sk.season && SEASONS.find((x) => x.id === sk.season); toast(`🔒 ${sk.name}: ${sn ? `${sn.e} ${sn.name} 기간 한정 미션을 다 하면 받아요` : sk.need}`); return; }
      draft[key] = v; renderPickers(); } });
  }));
  const swatch = (box, list, key) => $(box).replaceChildren(...list.map((v) => { const b = h("button", { class: "color" + (draft[key] === v ? " sel" : ""), "aria-label": "색 선택", onclick: () => { draft[key] = v; renderPickers(); } }); b.style.background = v; return b; }));
  chips("#genderPick", L.genders, "gender");
  chips("#itemPick", L.items, "item");
  chips("#wearPick", L.wears, "wear");
  chips("#haloPick", L.halos, "halo");
  chips("#shoulderPick", L.shoulders, "shoulder");
  chips("#apronPick", L.aprons, "apron");
  chips("#pinPick", L.pins, "pin");
  chips("#trailPick", L.trails, "trail");
  chips("#badgePick", [["", "없음"], ["newyear", "🎉 새해"], ["easter", "✝️ He is risen"], ["reform", "📖 5 SOLA"]], "badge");
  chips("#titlePick", [["", "없음"], ["branch", "🌿 가지"], ["fruit", "🍇 열매 맺는"], ["tree", "🌳 큰 나무 (금빛 이름표)"]], "title");
  const petOk = true;
  $("#petPick").replaceChildren(h("span", { class: "muted tiny", text: "🐾 마당 고양이 콘도에서 밥을 주면 고를 수 있어요 (30분 산책)" })); void petOk;
  chips("#hairPick", L.hairs, "hair");
  swatch("#hairColorPick", L.hairColors.map((x) => x[0]), "hairColor");
  chips("#glassesPick", L.glasses, "glasses");
  swatch("#colorPick", L.shirts, "color");
  if (preview) preview.set({ ...draft, costume: giftActive() || "" });
}
function renderMeChip() {
  const p = S.profile || {};
  const d = h("span", { class: "dot" }); d.style.background = p.color || L.shirts[0]; d.style.borderColor = p.hairColor || "#2b2220";
  $("#meChip").replaceChildren(d, h("span", { class: "nm", text: p.name || "익명" }));
}
function openEntry(first) {
  $("#entryTitle").textContent = first ? "퀸장그루터기에 오신 걸 환영해요 🌱" : "내 캐릭터 꾸미기";
  $("#enterBtn").textContent = first ? "마당으로 들어가기" : "저장";
  $("#tourAgainBtn").hidden = !!first;
  $("#nameInput").value = draft.name || "";
  openModal("entryModal");
  if (!preview) { try { preview = W.preview($("#previewCanvas")); } catch (e) { console.warn(e); } }
  renderPickers();
  preview && preview.start();
}
let started = false;
$("#enterBtn").onclick = () => {
  const name = $("#nameInput").value.trim();
  if (name && !checkText(name)) return;
  draft.name = clip(name, LIMIT.name);
  S.profile = { name: draft.name, color: draft.color, hair: draft.hair, hairColor: draft.hairColor, glasses: draft.glasses, gender: draft.gender, item: draft.item, wear: draft.wear,
    halo: draft.halo, trail: draft.trail, shoulder: draft.shoulder, apron: draft.apron, pin: draft.pin, badge: draft.badge || "", title: draft.title || "", pet: Number.isInteger(draft.pet) ? draft.pet : -1, petPick: draft.petPick || 0 };
  store.set("profile", S.profile);
  closeModal("entryModal"); preview && preview.stop();
  renderMeChip();
  if (!started) { started = true; joinRoom("yard", "def"); loadMissions().then(() => setTimeout(() => (NEW_USER && !store.get("tourDone", false) ? startTour(() => { maybeWelcome(); linkPromptCheck(); }) : (maybeWelcome(), linkPromptCheck())), 1200)); } else refreshMe();
};
$("#nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) $("#enterBtn").click(); });
$("#meChip").onclick = () => openEntry(false);
$$(".tab").forEach((t) => t.onclick = () => { if (started && t.dataset.room !== S.room) joinRoom(t.dataset.room, S.room); });

/* ================= 패널 / HUD ================= */
$$(".panel [data-toggle]").forEach((b) => b.onclick = () => b.closest(".panel").classList.toggle("collapsed"));
if (window.innerWidth < 720) $$(".panel").forEach((p) => p.classList.add("collapsed"));
// 🧭 화면 정리 (2026-11-18): 처음 온 날만 게시판을 펼쳐 두고, 다음 날부터는 접힌 채로 시작해요 (▾ 누르면 열려요)
(() => { const fd = store.get("firstDay", null); if (!fd) store.set("firstDay", nyDay()); else if (fd !== nyDay()) $$(".panel").forEach((p) => p.classList.add("collapsed")); })();
$("#zoomIn").onclick = () => W.setDist(W.cam.dist * 0.8);
$("#zoomOut").onclick = () => W.setDist(W.cam.dist * 1.25);
$("#resetView").onclick = () => W.resetView();

/* ================= 폰에서 나갔다 돌아왔을 때 ================= */
// 다른 앱에 갔다 오면 연결이 끊겨 있을 수 있어서, 돌아오는 순간 다시 붙고 발자취도 새로 불러요.
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
  if (!started || S.away) return;
  api.resume(hiddenAt ? Date.now() - hiddenAt : 0);
  api.lobbyResume(hiddenAt ? Date.now() - hiddenAt : 0);
  hiddenAt = 0;
  loadFootprints();
  if (GB_ROOMS.includes(S.room)) loadGuestbook();
  if (nyDay() !== verseDay) renderVerse();
});
window.addEventListener("online", () => { if (started) { api.resume(1e9); api.lobbyResume(1e9); } });
window.addEventListener("pagehide", () => api.leaveRoom());
window.addEventListener("pageshow", (e) => { if (e.persisted) rejoinSameRoom(); });

/* ================= 홈 화면 앱 (PWA) ================= */
// 아이폰: 사파리 공유 버튼 → "홈 화면에 추가" 안내 / 삼성폰·안드로이드: 바로 설치 창
const UA = navigator.userAgent;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps/i.test(UA);
const isSamsung = /SamsungBrowser/i.test(UA);
let installEvt = null;
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("서비스워커 등록 실패", e)));
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; updateInstallBtn(); });
window.addEventListener("appinstalled", () => { installEvt = null; updateInstallBtn(); toast("홈 화면에 그루터기 앱이 생겼어요 🌱"); });
function updateInstallBtn() { $("#installBtn").hidden = isStandalone() || !(installEvt || /Android|iPhone|iPad|iPod/i.test(UA) || isIOS); }
function installSteps() {
  const step = (n, t) => h("li", {}, h("b", { text: n }), h("span", { text: t }));
  if (isInApp) return [h("p", { class: "muted", text: "카카오톡·인스타그램 안에서 열린 화면에서는 설치가 안 돼요. 먼저 브라우저로 열어 주세요." }),
    h("ol", { class: "steps" }, step("1", isIOS ? "오른쪽 아래(또는 위) ⋯ 메뉴 → \"Safari로 열기\"" : "오른쪽 위 ⋮ 메뉴 → \"다른 브라우저로 열기\" (크롬 또는 삼성 인터넷)"),
      step("2", "열린 브라우저에서 다시 📲 앱 설치 버튼을 눌러 주세요"))];
  if (isIOS) return [h("ol", { class: "steps" },
    step("1", "사파리 아래쪽(또는 위쪽)의 공유 버튼 ⬆︎ 을 눌러요"),
    step("2", "목록을 내려서 \"홈 화면에 추가\"를 눌러요"),
    step("3", "오른쪽 위 \"추가\"를 누르면 끝! 홈 화면의 그루터기 아이콘으로 들어와요")),
    h("p", { class: "muted tiny", text: "아이폰은 꼭 사파리에서 해주세요. (iOS 16.4 이상은 크롬에서도 공유 → 홈 화면에 추가가 돼요)" })];
  return [h("ol", { class: "steps" },
    isSamsung ? step("1", "아래쪽 ≡ 메뉴 → \"현재 페이지 추가\" → \"홈 화면\"을 눌러요") : step("1", "오른쪽 위 ⋮ 메뉴 → \"앱 설치\" 또는 \"홈 화면에 추가\"를 눌러요"),
    step("2", "\"설치\"를 누르면 홈 화면과 앱 목록에 그루터기가 생겨요"))];
}
$("#installBtn").onclick = async () => {
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null; updateInstallBtn();
    if (r && r.outcome === "accepted") return;
  }
  $("#installSteps").replaceChildren(...installSteps());
  openModal("installModal");
};
updateInstallBtn();
if (isStandalone()) document.body.classList.add("standalone");

/* ================= 🎸 찬양팀 연습실 (리빙리버) ================= */
// 악기 자리에 서면 아래에 연주판이 나와요. 내 소리는 바로 내 귀에, 같은 방 친구들에게는 실시간 방송("jam")으로 가요.
// 드럼 자동 리듬은 소리 하나하나 보내지 않고 "켰어요(리듬 이름·빠르기)"만 내 상태에 실어요 → 각자 화면에서 같은 리듬이 나와요.
const JA = window.JamAudio;
const JAM_INST = ["lead", "sing", "drums", "key", "key2", "egtr", "bass"];
const INST_EMOJI = { lead: "🎤", sing: "🎙", drums: "🥁", key: "🎹", key2: "🎹", egtr: "🎸", bass: "🎸" };
const clampKey = (k) => ((Math.round(Number(k)) % 12) + 12) % 12 || 0;
const clampBpm = (b) => Math.max(50, Math.min(180, Math.round(Number(b) || 72)));
function jamSeatInfo() { return S.room === "praise" && JA ? W.jamSeat(S.seat) : null; }
function jamInst() { const st = jamSeatInfo(); return st ? st.inst : null; }
function jamLeader() { return S.peers.find((p) => p.id !== myId && p.seat === "WL" && p.jam && p.jam.key != null) || null; }
// 지금 쓰는 키·빠르기: 인도자가 있으면 인도자 것, 없으면 내가 정한 것
function jamKB() {
  const L = jamInst() === "lead" ? null : jamLeader();
  return L ? { key: clampKey(L.jam.key), bpm: clampBpm(L.jam.bpm), by: clip(L.name, LIMIT.name) || "인도자" } : { key: JAM.key, bpm: JAM.bpm, by: null };
}
function jamPresence() {
  const i = jamInst(); if (!i) return null;
  if (i === "lead") return { key: JAM.key, bpm: JAM.bpm, song: JAM.song || null };
  if (i === "drums" && JAM.loop) return { loop: JAM.loop, bpm: jamKB().bpm };
  return null;
}
function jamSeatChanged() {
  const i = jamInst();
  if (i !== "drums" && JAM.loop) { JAM.loop = null; }
  W.keyBlock = !!i;
  if (i && JA) JA.ensure();
}
// 소리 내기 → 내 귀에 바로 + 친구들에게 모아서 0.12초마다 보내요 (서버 한도 아끼기)
function jamTrigger(ev) {
  const i = jamInst(); if (!i || !JA) return;
  JA.play(i, ev); W.jamHit(myId, i);
  if (!(MS.log[nyDay()] || {}).jam) mAdd("jam");
  const now = performance.now();
  if (!JAM.q.length) JAM.qT = now;
  if (JAM.q.length < 24) JAM.q.push({ ...ev, o: Math.round(now - JAM.qT) });
  if (!JAM.flush) JAM.flush = setTimeout(jamFlush, 120);
}
function jamFlush() {
  JAM.flush = null; const e = JAM.q.splice(0); const i = jamInst();
  if (e.length && i) api.sendJam && api.sendJam({ by: myId, i, e });
}
function onJam(m) {
  if (!m || typeof m.by !== "string" || m.by === myId || S.room !== "praise" || !Array.isArray(m.e) || !JA) return;
  const inst = JAM_INST.includes(m.i) ? m.i : null; if (!inst) return;
  W.jamHit(m.by, inst);
  if (JAM.hearOthers) for (const ev of m.e.slice(0, 24)) { if (ev && (ev.k === "d" || ev.k === "n")) JA.play(inst, ev, Math.min(400, Number(ev.o) || 0)); }
  const now = Date.now();
  if (!JAM.lastFloat[m.by] || now - JAM.lastFloat[m.by] > 1600) { JAM.lastFloat[m.by] = now; floatAt(m.by, inst === "drums" ? "🥁" : "🎵"); }
}
// 드럼 자동 리듬: 나와 다른 드러머의 리듬을 각자 화면에서 틀어요
function jamSyncLoops() {
  if (!JA) return;
  const want = new Map();
  if (S.room === "praise") for (const p of S.peers) if (p.seat === "WD" && p.jam && JA.LOOPS[p.jam.loop] && (p.id === myId || JAM.hearOthers)) want.set(p.id, p);
  for (const id of [...JA.loops.keys()]) if (id !== "__metro" && !want.has(id)) JA.setLoop(id, null);
  for (const [id, p] of want) JA.setLoop(id, p.jam.loop, clampBpm(p.jam.bpm));
  if (JAM.metro) JA.setMetro(true, jamKB().bpm);
}
if (JA) JA.onStep = (id) => W.jamHit(id, "drums");
function jamLeave() {
  JAM.loop = null; JAM.metro = false; W.keyBlock = false;
  if (JA) JA.stopAll();
  stopCd();
  $("#jamBar").hidden = true; JAM.barKey = "";
  document.body.classList.remove("jamming");
}
// 지금 연주 중 (게시판)
function renderJamWho() {
  const ul = $("#jamWho"); if (!ul) return;
  const rows = [];
  for (const [sid, st] of Object.entries(W.JAM_SEATS)) { const p = S.peers.find((x) => x.seat === sid); if (p) rows.push(h("li", {}, dot(p.color), h("span", { text: `${st.name} · ${(clip(p.name, LIMIT.name) || "익명") + (p.id === myId ? " (나)" : "")}${p.jam && p.jam.loop ? " · 리듬 " + JA.LOOPS[p.jam.loop]?.name : ""}` }))); }
  ul.replaceChildren(...(rows.length ? rows : [h("li", { class: "none", text: "아직 아무도 없어요. 첫 번째로 연주해 볼까요? 🎶" })]));
}
// 🎸 악기 고르기
function openJamPick() {
  const grid = $("#jamPickGrid");
  grid.replaceChildren(...Object.entries(W.JAM_SEATS).map(([sid, st]) => {
    const p = S.room === "praise" && S.peers.find((x) => x.seat === sid && x.id !== myId);
    const mine = S.room === "praise" && S.seat === sid;
    return h("button", { class: "jam-seat-btn" + (p ? " taken" : "") + (mine ? " mine" : ""), disabled: p ? true : null, onclick: () => goJamSeat(sid) },
      h("b", { text: st.name }), h("small", { text: mine ? "지금 내 자리" : p ? (clip(p.name, LIMIT.name) || "익명") + " 연주 중" : "비어 있어요" }));
  }));
  openModal("jamPickModal");
}
function goJamSeat(sid) {
  closeModal("jamPickModal");
  const go = () => { const st = W.JAM_SEATS[sid]; W.sitNear([sid], { x: st.x, z: st.z }); };
  if (S.room !== "praise") { joinRoom("praise", S.room); setTimeout(go, 700); } else go();
}
$$(".jam-pick").forEach((b) => (b.onclick = openJamPick));

/* ----- 연주판 ----- */
const PIANO_KEYS = "awsedftgyhujkolp;"; // 도(C4)부터 반음씩
const DRUM_PADS = [["kick", "킥", "a"], ["snare", "스네어", "s"], ["hat", "하이햇", "d"], ["ohat", "오픈햇", "f"], ["clap", "박수", "g"], ["tom1", "탐1", "h"], ["tom2", "탐2", "j"], ["ftom", "플로어탐", "k"], ["crash", "크래시", "l"], ["ride", "라이드", ";"]];
const TONES = {
  key: [["piano", "피아노"], ["pad", "패드"], ["organ", "오르간"], ["strings", "스트링"]],
  key2: [["pad", "패드"], ["piano", "피아노"], ["organ", "오르간"], ["strings", "스트링"]],
  egtr: [["drive", "🔥 찌그러진 소리"], ["clean", "💧 맑은 소리"]],
  sing: [["a", "아~"], ["u", "우~"], ["o", "오~"]],
};
const toneOf = (i) => (i === "lead" ? JAM.tone.sing : JAM.tone[i]);
function setTone(i, v) { const k = i === "lead" ? "sing" : i; JAM.tone[k] = v; store.set({ key: "jamToneKey", key2: "jamToneKey2", egtr: "jamToneGtr", sing: "jamVowel" }[k], v); renderJamBar(true); }
function playChord(d) {
  const i = jamInst(); if (!i || i === "drums") return;
  const { key } = jamKB(), midis = JA.chordMidis(key, d, i === "key2" ? "key" : i);
  if (i === "bass") JAM.bassRoot = midis[0];
  jamTrigger({ k: "n", v: midis, s: toneOf(i) });
}
function playNote(m) { const i = jamInst(); if (!i || i === "drums") return; jamTrigger({ k: "n", v: [m], s: toneOf(i) }); }
function playDrum(n) { if (jamInst() !== "drums") return; jamTrigger({ k: "d", v: n }); }
// 노래 멜로디: 그 키의 도레미파솔라시도
function scaleMidi(n) { const { key } = jamKB(), base = key <= 4 ? 60 + key : 48 + key; return base + [0, 2, 4, 5, 7, 9, 11][n % 7] + 12 * Math.floor(n / 7); }
const SOLFA = ["도", "레", "미", "파", "솔", "라", "시", "도"];
const down = (fn) => (e) => { e.preventDefault(); fn(); const b = e.currentTarget; b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 140); };
function renderJamBar(force) {
  const bar = $("#jamBar"), st = jamSeatInfo(), i = st && st.inst;
  W.keyBlock = !!i;
  document.body.classList.toggle("jamming", !!i);
  if (!i) { bar.hidden = true; JAM.barKey = ""; return; }
  const kb = jamKB();
  const sg = jamSong(), L = jamLeader(), leaderPicks = !!(L && L.jam && L.jam.song && i !== "lead");
  const key = [i, S.seat, kb.key, kb.bpm, kb.by, toneOf(i), JAM.loop, JAM.metro, JAM.hearOthers, JAM.min, sg && sg.id, sg && sg.updated_at, JAM.sec, JAM.chordMode, SONGS.list.length, leaderPicks].join("|");
  if (!force && key === JAM.barKey && !bar.hidden) return;
  if (bar.hidden && window.innerWidth < 720) $("#panel-praise").classList.add("collapsed"); // 폰: 연주판이 잘 보이게 게시판은 접어요
  JAM.barKey = key; bar.hidden = false;
  const N = JA.NOTE_NAMES;
  const head = h("div", { class: "jam-head" },
    h("b", { text: st.jamName }),
    h("span", { class: "jam-kb", text: `키 ${N[kb.key]} · ${kb.bpm} BPM` + (kb.by ? ` (인도자 ${kb.by})` : "") }),
    h("span", { class: "grow" }),
    h("button", { class: "btn ghost sm" + (JAM.metro ? " on" : ""), title: "메트로놈 (나만 들려요)", text: "🕐", onclick: () => { JAM.metro = !JAM.metro; JA.setMetro(JAM.metro, kb.bpm); renderJamBar(true); } }),
    h("button", { class: "btn ghost sm" + (JAM.hearOthers ? " on" : ""), title: "친구들 연주 소리", text: JAM.hearOthers ? "👂 친구 소리" : "🔇 친구 소리", onclick: () => { JAM.hearOthers = !JAM.hearOthers; store.set("jamHear", JAM.hearOthers); jamSyncLoops(); renderJamBar(true); } }),
    h("button", { class: "btn ghost sm", text: JAM.min ? "▴ 펼치기" : "▾ 접기", onclick: () => { JAM.min = !JAM.min; renderJamBar(true); } }),
    h("button", { class: "btn ghost sm", text: "일어나기", onclick: () => W.standOrCancel() }));
  // 🎼 곡 고르기 줄 (인도자가 고르면 모두 같은 곡)
  const songSel = h("select", { class: "jam-song", disabled: leaderPicks || null, onchange: (e) => jamPickSong(Number(e.target.value) || null) },
    h("option", { value: "", text: SONGS.list.length ? "🎼 곡 고르기 (안 고르면 숫자 코드)" : "🎼 올라온 곡이 없어요" }),
    ...setlist().map((x) => h("option", { value: x.id, text: `콘티 ${x.set_no}. ${x.title} (${JA.NOTE_NAMES[x.key_root]})` })),
    ...SONGS.list.filter((x) => !x.set_no).map((x) => h("option", { value: x.id, text: `${x.title} (${JA.NOTE_NAMES[x.key_root]})` })));
  songSel.value = sg ? String(sg.id) : "";
  const songRow = h("div", { class: "jam-row jam-songrow" }, songSel,
    leaderPicks ? h("span", { class: "muted tiny", text: "인도자가 고른 곡이에요" }) : null,
    sg ? h("button", { class: "btn ghost sm", text: "🎼 악보", onclick: () => openSheet(sg.id) }) : null);
  const body = h("div", { class: "jam-body" }, songRow);
  const seg = (list, cur, fn) => h("div", { class: "seg jam-seg" }, ...list.map(([v, l]) => h("button", { class: "seg-btn" + (v === cur ? " active" : ""), text: l, onclick: () => fn(v) })));
  const chart = sg && i !== "drums" ? JA.parseChart(sg.chords) : [];
  const useSong = chart.length && JAM.chordMode === "song";
  const songChart = () => {
    const tr = (((kb.key - sg.key_root) % 12) + 12) % 12, tr2 = tr > 6 ? tr - 12 : tr, sec = chart[Math.min(JAM.sec, chart.length - 1)];
    return h("div", { class: "jam-chart" },
      h("div", { class: "seg jam-seg" }, ...chart.map((x, ix) => h("button", { class: "seg-btn" + (ix === Math.min(JAM.sec, chart.length - 1) ? " active" : ""), text: x.name, onclick: () => { JAM.sec = ix; renderJamBar(true); } }))),
      h("div", { class: "jam-bars" }, ...sec.bars.map((bar, bi) => h("div", { class: "jam-barcell" }, h("small", { class: "bar-no", text: String(bi + 1) }),
        ...bar.map((sym) => h("button", { class: "jam-chord sm", onpointerdown: down(() => playSym(sym, tr2)) }, h("b", { text: JA.transposeName(sym, tr2, kb.key) })))))));
  };
  const modeSeg = chart.length ? seg([["song", "🎼 곡 코드"], ["num", "🔢 숫자 코드"]], JAM.chordMode, (v) => { JAM.chordMode = v; renderJamBar(true); }) : null;
  const numRow = () => h("div", { class: "jam-chords" }, ...JA.DEGREES.map((g, d) => h("button", { class: "jam-chord", onpointerdown: down(() => playChord(d)) }, h("b", { text: JA.chordName(kb.key, d) }), h("small", { text: g.n }))));
  const chordRow = () => (useSong ? songChart() : numRow());
  if (modeSeg) body.append(modeSeg);
  if (i === "lead") {
    body.append(
      h("div", { class: "jam-row" }, h("span", { class: "jam-lbl", text: "키" }), h("div", { class: "jam-keys12" }, ...N.map((n, k) => h("button", { class: "seg-btn" + (k === JAM.key ? " active" : ""), text: n, onclick: () => { JAM.key = k; store.set("jamKey", k); refreshMe(); jamSyncLoops(); renderJamBar(true); } })))),
      h("div", { class: "jam-row" }, h("span", { class: "jam-lbl", text: "빠르기" }),
        h("button", { class: "btn ghost sm", text: "−5", onclick: () => setBpm(JAM.bpm - 5) }), h("b", { class: "jam-bpm", text: JAM.bpm + " BPM" }), h("button", { class: "btn ghost sm", text: "+5", onclick: () => setBpm(JAM.bpm + 5) }),
        h("span", { class: "muted tiny", text: "모두의 코드 버튼·리듬이 이 키·빠르기로 바뀌어요" })),
      seg(TONES.sing, toneOf(i), (v) => setTone(i, v)), chordRow(), melodyRow());
  } else if (i === "sing") {
    body.append(seg(TONES.sing, toneOf(i), (v) => setTone(i, v)), h("div", { class: "muted tiny", text: "코드 버튼 = 3성부 화음 · 아래 계이름 = 멜로디 (키보드 A S D F G H J K)" }), chordRow(), melodyRow());
  } else if (i === "drums") {
    body.append(
      h("div", { class: "jam-row" }, h("span", { class: "jam-lbl", text: "자동 리듬" }),
        seg([[null, "끔"], ...Object.entries(JA.LOOPS).map(([k, v]) => [k, v.name])], JAM.loop, (v) => { JAM.loop = v; refreshMe(); jamSyncLoops(); renderJamBar(true); toast(v ? `🥁 ${JA.LOOPS[v].name} 리듬을 켰어요 (${kb.bpm} BPM) · 친구들에게도 들려요` : "리듬을 껐어요"); })),
      h("div", { class: "jam-pads" }, ...DRUM_PADS.map(([n, l, k]) => h("button", { class: "jam-pad pad-" + n, onpointerdown: down(() => playDrum(n)) }, h("b", { text: l }), h("small", { text: k.toUpperCase() })))));
  } else if (i === "key" || i === "key2") {
    body.append(seg(TONES[i], toneOf(i), (v) => setTone(i, v)), chordRow(), pianoRow());
  } else if (i === "egtr") {
    body.append(seg(TONES.egtr, toneOf(i), (v) => setTone(i, v)), h("div", { class: "muted tiny", text: "코드를 누르면 줄을 한 번 긁어요 (키보드 숫자 1~7)" }), chordRow());
  } else if (i === "bass") {
    body.append(h("div", { class: "muted tiny", text: "코드 = 근음 · 5도·8도는 방금 친 코드 기준 (키보드 숫자 1~7, Q · W)" }), chordRow(),
      h("div", { class: "jam-row" }, h("button", { class: "jam-chord", onpointerdown: down(() => bassIv(7)) }, h("b", { text: "5도" }), h("small", { text: "Q" })), h("button", { class: "jam-chord", onpointerdown: down(() => bassIv(12)) }, h("b", { text: "8도" }), h("small", { text: "W" }))));
  }
  body.hidden = JAM.min;
  bar.replaceChildren(head, body);
}
function setBpm(b) { JAM.bpm = clampBpm(b); store.set("jamBpm", JAM.bpm); refreshMe(); jamSyncLoops(); renderJamBar(true); }
function bassIv(iv) { if (jamInst() !== "bass") return; const r = JAM.bassRoot != null ? JAM.bassRoot : JA.chordMidis(jamKB().key, 0, "bass")[0]; playNote(r + iv); }
function melodyRow() { return h("div", { class: "jam-melody" }, ...SOLFA.map((s, n) => h("button", { class: "jam-note", onpointerdown: down(() => playNote(scaleMidi(n))) }, h("b", { text: s }), h("small", { text: "ASDFGHJK"[n] })))); }
function pianoRow() {
  const wrap = h("div", { class: "jam-piano" });
  const whites = [0, 2, 4, 5, 7, 9, 11], names = ["도", "레", "미", "파", "솔", "라", "시"];
  for (let o = 0; o < 2; o++) for (let w = 0; w < 7; w++) {
    const m = 60 + o * 12 + whites[w], idx = m - 60;
    const b = h("button", { class: "pk white", onpointerdown: down(() => playNote(m)) }, h("small", { text: (PIANO_KEYS[idx] || "").toUpperCase() || names[w] }));
    if ([0, 1, 3, 4, 5].includes(w)) b.append(h("span", { class: "pk black", onpointerdown: (e) => { e.stopPropagation(); down(() => playNote(m + 1))(e); } }));
    wrap.append(b);
  }
  return wrap;
}
// 컴퓨터 키보드로 연주
document.addEventListener("keydown", (e) => {
  const i = jamInst(); if (!i || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  if (document.querySelector(".modal:not([hidden]), .drawer:not([hidden])")) return;
  const k = e.key.toLowerCase();
  if (i === "drums") { const p = DRUM_PADS.find((x) => x[2] === k) || (k === " " ? DRUM_PADS[0] : null); if (p) { e.preventDefault(); playDrum(p[0]); } return; }
  if (/^[1-7]$/.test(k)) { e.preventDefault(); playChord(+k - 1); return; }
  if (i === "key" || i === "key2") { const n = PIANO_KEYS.indexOf(k); if (n >= 0) { e.preventDefault(); playNote(60 + n); } return; }
  if (i === "sing" || i === "lead") { const n = "asdfghjk".indexOf(k); if (n >= 0) { e.preventDefault(); playNote(scaleMidi(n)); } return; }
  if (i === "bass") { if (k === "q") bassIv(7); if (k === "w") bassIv(12); }
});
// 폰: 처음 화면을 누를 때 소리 준비
document.addEventListener("pointerdown", () => { if (S.room === "praise" && JA) JA.ensure(); }, { capture: true, passive: true });

/* ----- 💿 리빙리버 CD ----- */
// 유튜브 영상 플레이어로 틀어요 (소리는 나한테만). 연습실을 나가면 꺼져요.
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
function openCd() {
  const cds = W.LR_CDS.map(([id, title, col, sub]) => ({ id, title, col, sub }));
  $("#cdGrid").replaceChildren(
    ...cds.map((c) => h("button", { class: "cd-card", onclick: () => playCd(c.id, c.title) },
      h("span", { class: "cd-disc", style: `background-image:url(${ytThumb(c.id)}); --cd:${c.col}` }), h("b", { text: c.title }), h("small", { text: c.sub || "Living River Worship" }))),
    h("button", { class: "cd-card all", onclick: () => playCd(null, "리빙리버 M/V 전체 이어 듣기", true) }, h("span", { class: "cd-disc all-disc", text: "▶" }), h("b", { text: "전체 이어 듣기" }), h("small", { text: "플레이리스트에 새 곡이 생겨도 같이 나와요" })));
  openModal("cdModal");
}
function playCd(id, title, all, start) {
  if (S.room !== "praise") { toast("찬양팀 연습실에서 들을 수 있어요"); return; }
  const q = "autoplay=1&playsinline=1&rel=0&modestbranding=1" + (start ? "&start=" + Math.floor(start) : "");
  const src = all ? `https://www.youtube-nocookie.com/embed/videoseries?list=${W.LR_PLAYLIST}&${q}` : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${q}`;
  $("#cdFrame").replaceChildren(h("iframe", { src, title, allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin" }));
  $("#cdNow").textContent = title; $("#cdPlayer").hidden = false;
  W.setCdPlaying(true); closeModal("cdModal"); closeModal("recModal");
  // 같은 방 친구들에게 "같이 듣기"가 떠요 (한 곡일 때만. 언제 시작했는지도 같이 보내서 같은 부분부터)
  S.cdShare = all ? null : { v: id, t: clip(title, 30), at: Date.now() - (start || 0) * 1000 };
  if (!S.bubble || /^💿/.test(S.bubble)) { S.bubble = `💿 '${clip(title, 24)}' 듣는 중`; S.kind = "status"; S.amens = 0; }
  refreshMe(); renderCdShare();
  toast("💿 플레이어에서 음악이 나와요 · 안 나오면 영상의 ▶를 눌러 주세요");
}
function stopCd() {
  if ($("#cdPlayer").hidden) return;
  $("#cdFrame").replaceChildren(); $("#cdPlayer").hidden = true; W.setCdPlaying(false);
  S.cdShare = null;
  if (/^💿/.test(S.bubble || "")) S.bubble = "";
  refreshMe();
}
$("#cdClose").onclick = stopCd;
$$(".cd-open").forEach((b) => (b.onclick = openCd));

/* ----- 📝 추천 찬양 ----- */
let RECS = [], REC_SORT = "new";
const myRecs = new Set(store.get("myRecs", [])), recLiked = new Set(store.get("recLiked", []));
const ytId = (url) => { const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(String(url || "")); return m ? m[1] : null; };
async function loadRecs() { try { RECS = await api.listRecs(); } catch (e) { return; } W.setRecBoard(RECS); renderRecRecent(); if (!$("#recModal").hidden) renderRecs(); }
function renderRecRecent() {
  const ul = $("#recRecent"); if (!ul) return;
  ul.replaceChildren(...(RECS.length ? RECS.slice(0, 4).map((r) => h("li", {}, h("span", { text: `🎵 ${r.title}${r.artist ? " · " + r.artist : ""}` }), h("small", { class: "muted", text: ` ${r.name || "익명"} · ${timeAgo(r.created_at)}` })))
    : [h("li", { class: "none", text: "아직 추천이 없어요. 첫 번째로 남겨 볼까요? 🎶" })]));
}
function renderRecs() {
  const list = [...RECS]; if (REC_SORT === "like") list.sort((a, b) => b.like_count - a.like_count || new Date(b.created_at) - new Date(a.created_at));
  $("#recList").replaceChildren(...(list.length ? list.map((r) => {
    const mine = myRecs.has(r.id), done = recLiked.has(r.id), vid = ytId(r.link);
    return h("li", { class: "gb-item rec" },
      h("p", {}, h("b", { text: "🎵 " + r.title }), r.artist ? h("span", { class: "muted", text: " · " + r.artist }) : null),
      r.note ? h("p", { class: "rec-note", text: r.note }) : null,
      h("div", { class: "who" }, h("span", { text: (r.name || "익명") + (mine ? " · 나" : "") + " · " + timeAgo(r.created_at) }), h("span", { class: "grow" }),
        vid ? h("button", { class: "btn ghost sm", text: "▶ 여기서 듣기", onclick: () => playCd(vid, r.title) }) : null,
        h("button", { class: "btn ghost sm" + (done ? " on" : ""), text: `🙌 나도 좋아요 ${r.like_count}`, onclick: () => recDo(r, "like") }),
        mine ? h("button", { class: "btn ghost sm", text: "삭제", onclick: () => recDo(r, "del") }) : h("button", { class: "btn ghost sm", text: "⚑", title: "신고", onclick: () => recDo(r, "report") }),
        isAll() ? h("button", { class: "btn danger sm", text: "관리자 삭제", onclick: () => recDo(r, "admin") }) : null));
  }) : [h("li", { class: "empty-msg", text: "아직 추천이 없어요. 첫 번째로 남겨 주세요 🎶" })]));
}
async function recDo(r, what) {
  try {
    if (what === "like") { if (recLiked.has(r.id)) { toast("이미 눌렀어요 🙌"); return; } r.like_count = Number(await api.likeRec(r.id)) || r.like_count + 1; recLiked.add(r.id); store.set("recLiked", [...recLiked]); renderRecs(); W.setRecBoard(RECS); return; }
    if (what === "del") await api.deleteMyRec(r.id);
    if (what === "report") { await api.reportRec(r.id); toast("신고했어요. 3번 쌓이면 가려져요"); }
    if (what === "admin") await api.adminDeleteRec(S.admin, r.id);
    loadRecs();
  } catch (e) { toast(e.message); }
}
function openRecs() { renderRecs(); openModal("recModal"); loadRecs(); }
$$(".rec-open").forEach((b) => (b.onclick = openRecs));
$$(".rec-sort .seg-btn").forEach((b) => (b.onclick = () => { REC_SORT = b.dataset.sort; $$(".rec-sort .seg-btn").forEach((x) => x.classList.toggle("active", x === b)); renderRecs(); }));
$("#recPost").onclick = async () => {
  const title = $("#recTitle").value.trim(), artist = $("#recArtist").value.trim(), note = $("#recNote").value.trim(), link = $("#recLink").value.trim();
  if (!title) { toast("곡 제목을 적어 주세요 🎵"); return; }
  if (![title, artist, note].every(checkText)) return;
  if (link && !ytId(link)) { toast("링크는 유튜브 주소만 넣을 수 있어요 (youtu.be/… 또는 youtube.com/watch?v=…)"); return; }
  try {
    const id = await api.addRec({ name: $("#recAnon").checked ? "" : clip(S.profile?.name, LIMIT.name), title: clip(title, 40), artist: clip(artist, 30), note: clip(note, 80), link: link ? "https://youtu.be/" + ytId(link) : "" });
    myRecs.add(Number(id)); store.set("myRecs", [...myRecs]);
    ["#recTitle", "#recArtist", "#recNote", "#recLink"].forEach((s) => ($(s).value = ""));
    toast("🎵 추천 찬양을 보드에 붙였어요!"); loadRecs();
  } catch (e) { toast(e.message); }
};

/* ================= 🎼 찬양팀 곡 · 악보 · 콘티 ================= */
// 곡마다: 악보 사진(여러 장) + 코드(구간별) + 유튜브 + 콘티 순서. 올리기·고치기는 찬양팀(또는 전체 관리자) 비밀번호.
const SONGS = { list: [], loadedAt: 0, editId: null, edit: null };
const canSong = () => S.adminRole === "all" || S.adminRole === "praise";
const songById = (id) => SONGS.list.find((x) => x.id === Number(id)) || null;
const setlist = () => SONGS.list.filter((x) => x.set_no).sort((a, b) => a.set_no - b.set_no);
async function loadSongs(force) {
  if (!force && Date.now() - SONGS.loadedAt < 10000) return;
  SONGS.loadedAt = Date.now();
  try { SONGS.list = await api.listSongs(); } catch (e) { console.warn("곡 목록 (supabase-update-groups.sql 실행 여부 확인):", e.message); SONGS.list = SONGS.list || []; }
  renderSetlist(); renderSongList(); if (S.room === "praise") renderJamBar(true);
}
function songMeta(sg) { return `${JA.NOTE_NAMES[sg.key_root]} 키 · ${sg.bpm} BPM · ${sg.sig || "4/4"}${sg.artist ? " · " + sg.artist : ""}`; }
function renderSetlist() {
  const ol = $("#setList"); if (!ol) return;
  const l = setlist();
  ol.replaceChildren(...(l.length ? l.map((sg) => h("li", {}, h("button", { class: "linkish", onclick: () => openSheet(sg.id) }, h("b", { text: sg.title }), h("small", { text: " " + JA.NOTE_NAMES[sg.key_root] + " · " + sg.bpm })),
    sg.sheets && sg.sheets.length ? h("small", { class: "muted", text: ` 📷${sg.sheets.length}` }) : null))
    : [h("li", { class: "none", text: "이번 주 콘티가 아직 없어요. 찬양팀이 곡 악보에서 콘티 순서를 정하면 여기에 나와요." })]));
}
function renderSongList() {
  const ul = $("#songList"); if (!ul) return;
  $("#songsAdminRow").hidden = !canSong(); $("#songsLogin").hidden = canSong();
  const l = [...setlist(), ...SONGS.list.filter((x) => !x.set_no)];
  ul.replaceChildren(...(l.length ? l.map((sg) => h("li", { class: "song-item" },
    h("button", { class: "song-main", onclick: () => openSheet(sg.id) }, h("b", { text: (sg.set_no ? `${sg.set_no}. ` : "") + sg.title }), h("small", { text: songMeta(sg) + (sg.sheets && sg.sheets.length ? ` · 📷 악보 ${sg.sheets.length}장` : " · 악보 사진 없음") })),
    sg.youtube ? h("button", { class: "btn ghost sm", text: "▶", title: "유튜브로 듣기", onclick: () => { closeModal("songsModal"); playCd(sg.youtube, sg.title); } }) : null,
    canSong() ? h("button", { class: "btn ghost sm", text: "고치기", onclick: () => openSongEdit(sg.id) }) : null))
    : [h("li", { class: "empty-msg", text: "아직 올라온 곡이 없어요." })]));
}
function openSongs() { renderSongList(); openModal("songsModal"); loadSongs(true); }
$$(".songs-open").forEach((b) => (b.onclick = openSongs));
$$(".song-admin-open").forEach((b) => (b.onclick = () => { closeModal("adminModal"); openSongs(); }));
// 악보 크게 보기 (사진을 누르면 더 크게 / 다시 누르면 화면 너비)
async function openSheet(id) {
  const sg = songById(id); if (!sg) return;
  $("#sheetTitle").textContent = "🎼 " + sg.title;
  $("#sheetMeta").replaceChildren(...[h("span", { text: songMeta(sg) }),
    sg.youtube ? h("button", { class: "btn ghost sm", text: "▶ 들어보기", onclick: () => { closeModal("sheetModal"); playCd(sg.youtube, sg.title); } }) : null,
    S.room === "praise" ? h("button", { class: "btn primary sm", text: "🎸 이 곡으로 연주하기", onclick: () => { closeModal("sheetModal"); jamPickSong(sg.id); } }) : null,
    canSong() ? h("button", { class: "btn ghost sm", text: "고치기", onclick: () => { closeModal("sheetModal"); openSongEdit(sg.id); } }) : null].filter(Boolean));
  const pages = $("#sheetPages");
  pages.replaceChildren(h("p", { class: "muted", text: sg.sheets && sg.sheets.length ? "악보를 불러오는 중…" : "올라온 악보 사진이 없어요." }));
  renderSheetChords(sg);
  closeModal("songsModal"); openModal("sheetModal");
  if (sg.sheets && sg.sheets.length) {
    try {
      const imgs = await api.getSheets(sg.id);
      pages.replaceChildren(...imgs.map((im) => { const i = h("img", { src: im.data, alt: `${sg.title} 악보 ${im.page}쪽`, class: "sheet-img" }); i.onclick = () => i.classList.toggle("zoom"); return i; }));
    } catch (e) { pages.replaceChildren(h("p", { class: "muted", text: "악보를 불러오지 못했어요. " + e.message })); }
  }
}
// 악보 아래 코드: 누르면 소리가 나요. 악기 자리에 있으면 그 악기로 친구들에게도 들리고, 아니면 피아노 소리로 나만 들어요
let sheetSong = null;
function renderSheetChords(sg) {
  sheetSong = sg;
  const chart = JA.parseChart(sg.chords), box = $("#sheetChart");
  if (!chart.length) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  const i = jamInst(), inJam = i && i !== "drums" && S.room === "praise";
  const js = inJam ? jamSong() : null, key = inJam && js && js.id === sg.id ? jamKB().key : sg.key_root;
  const tr0 = (((key - sg.key_root) % 12) + 12) % 12, tr = tr0 > 6 ? tr0 - 12 : tr0;
  const press = (sym) => {
    if (inJam) return playSym(sym, tr);
    const midis = JA.symMidis(sym, tr, "key"); if (!midis) return;
    JA.ensure(); JA.play("key", { k: "n", v: midis, s: "piano" });
  };
  box.replaceChildren(
    h("div", { class: "sheet-chart-head" }, h("b", { text: "🎹 코드 · 누르면 소리가 나요" }),
      h("span", { class: "muted tiny", text: inJam ? `${W.JAM_SEATS[S.seat] ? W.JAM_SEATS[S.seat].name : "내 악기"} 소리로 친구들에게도 들려요 · ${JA.NOTE_NAMES[key]}키` : `피아노 소리 (나만 들려요) · ${JA.NOTE_NAMES[key]}키 · 악기 자리에 서면 그 악기 소리로 쳐요` })),
    ...chart.map((sec) => h("div", { class: "sheet-chart-row" }, h("b", { class: "chart-sec", text: sec.name }),
      h("div", { class: "sheet-bars" }, ...sec.bars.map((bar, bi) => h("div", { class: "sheet-barcell" }, h("small", { class: "bar-no", text: String(bi + 1) }),
        ...bar.map((sym) => h("button", { class: "sheet-chord", onpointerdown: down(() => press(sym)) }, JA.transposeName(sym, tr, key)))))))));
}
// 곡 올리기 · 고치기
function openSongEdit(id) {
  if (!canSong()) { toast("⚙️ 관리자에서 찬양팀 비밀번호로 들어와 주세요"); return; }
  const sg = id ? songById(id) : null;
  SONGS.editId = sg ? sg.id : null;
  $("#songEditTitle").textContent = sg ? "🎼 곡 고치기" : "🎼 새 곡 올리기";
  $("#sgKey").replaceChildren(...JA.NOTE_NAMES.map((n, k) => h("option", { value: k, text: n + " 키" })));
  $("#sgTitle").value = sg ? sg.title : ""; $("#sgArtist").value = sg ? sg.artist : ""; $("#sgKey").value = sg ? sg.key_root : 7;
  $("#sgBpm").value = sg ? sg.bpm : ""; $("#sgSig").value = sg ? sg.sig : "4/4"; $("#sgSet").value = sg && sg.set_no ? sg.set_no : "";
  $("#sgYt").value = sg && sg.youtube ? "https://youtu.be/" + sg.youtube : ""; $("#sgChords").value = sg ? sg.chords : "";
  $("#sgDelete").hidden = !sg; $("#sgFileMsg").textContent = sg ? "" : "사진은 저장한 다음에도 올릴 수 있어요";
  checkChart(); renderSgSheets();
  closeModal("songsModal"); closeModal("sheetModal"); openModal("songEditModal");
}
function renderSgSheets() {
  const sg = songById(SONGS.editId), box = $("#sgSheets");
  const l = (sg && sg.sheets) || [];
  box.replaceChildren(...(l.length ? l.map((x) => h("span", { class: "sheet-thumb" }, h("b", { text: `${x.page}쪽` }), h("button", { class: "btn ghost sm", text: "지우기", onclick: async () => { try { await api.sheetDelete(S.admin, x.id); toast("사진을 지웠어요"); await loadSongs(true); renderSgSheets(); } catch (e) { toast(e.message); } } })))
    : [h("span", { class: "muted tiny", text: "아직 사진이 없어요" })]));
}
function checkChart() {
  const t = $("#sgChords").value, chart = JA.parseChart(t);
  const bad = t.split(/[\s|]+/).map((x) => x.replace(/^[^:]*:$/, "")).filter((x) => x && !/:$/.test(x) && !JA.parseChord(x));
  $("#sgChordCheck").textContent = !t.trim() ? "코드를 비워 두면 연주판은 숫자 코드(1·2m·3m…)로 나와요." : `구간 ${chart.length}개 · 마디 ${chart.reduce((a, s) => a + s.bars.length, 0)}개` + (bad.length ? ` · ⚠ 못 읽은 글자: ${[...new Set(bad)].slice(0, 6).join(", ")}` : " · ✓ 모두 읽었어요");
}
$("#sgChords").addEventListener("input", checkChart);
async function saveSong() {
  const title = $("#sgTitle").value.trim(); if (!title) { toast("곡 제목을 적어 주세요"); return null; }
  if (!checkText(title)) return null;
  const yt = $("#sgYt").value.trim(); if (yt && !ytId(yt)) { toast("유튜브 주소를 확인해 주세요"); return null; }
  const sg = { id: SONGS.editId, title: clip(title, 60), artist: clip($("#sgArtist").value.trim(), 40), key_root: +$("#sgKey").value, bpm: clampBpm($("#sgBpm").value || 72), sig: clip($("#sgSig").value.trim() || "4/4", 6), set_no: Math.max(0, Math.min(30, +$("#sgSet").value || 0)) || null, youtube: yt ? ytId(yt) : "", chords: clip($("#sgChords").value, 4000) };
  const id = Number(await api.songSave(S.admin, sg)); SONGS.editId = id;
  $("#sgDelete").hidden = false;
  await loadSongs(true);
  return id;
}
$("#sgSave").onclick = async () => { try { if (await saveSong()) { toast("🎼 곡을 저장했어요"); closeModal("songEditModal"); openSongs(); } } catch (e) { toast(e.message); } };
$("#sgDelete").onclick = async () => {
  const sg = songById(SONGS.editId); if (!sg) return;
  if (!confirmTwice("sgDelete", "정말 지울까요? 한 번 더 누르세요")) return;
  try { await api.songDelete(S.admin, sg.id); toast("곡을 지웠어요"); closeModal("songEditModal"); await loadSongs(true); openSongs(); } catch (e) { toast(e.message); }
};
$("#songNew").onclick = () => openSongEdit(null);
$("#songClearSet").onclick = async () => { if (!confirmTwice("songClearSet", "콘티를 비울까요? 한 번 더 누르세요")) return; try { await api.songClearSet(S.admin); toast("콘티를 비웠어요"); loadSongs(true); } catch (e) { toast(e.message); } };
const armed = {};
function confirmTwice(id, msg) { const b = $("#" + id); if (Date.now() - (armed[id] || 0) > 4000) { armed[id] = Date.now(); const old = b.textContent; b.textContent = msg; setTimeout(() => (b.textContent = old), 4000); return false; } armed[id] = 0; return true; }
// 사진: 폰에서 바로 줄여서(긴 쪽 1800px, jpg) 올려요
function shrinkImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1800 / Math.max(img.width, img.height)), w = Math.round(img.width * k), hh = Math.round(img.height * k);
      const c = document.createElement("canvas"); c.width = w; c.height = hh; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, hh); g.drawImage(img, 0, 0, w, hh);
      URL.revokeObjectURL(url);
      let q = 0.82, d = c.toDataURL("image/jpeg", q); while (d.length > 1400000 && q > 0.4) { q -= 0.12; d = c.toDataURL("image/jpeg", q); }
      res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("사진을 열지 못했어요")); };
    img.src = url;
  });
}
$("#sgFile").onchange = async (e) => {
  const files = [...e.target.files].slice(0, 6); e.target.value = "";
  if (!files.length) return;
  try {
    let id = SONGS.editId; if (!id) { id = await saveSong(); if (!id) return; }
    let page = ((songById(id) || {}).sheets || []).length;
    for (const f of files) { page++; $("#sgFileMsg").textContent = `사진 올리는 중… (${page}쪽)`; await api.sheetAdd(S.admin, id, page, await shrinkImage(f)); }
    $("#sgFileMsg").textContent = "✓ 사진을 올렸어요"; await loadSongs(true); renderSgSheets();
  } catch (err) { $("#sgFileMsg").textContent = ""; toast(err.message); }
};
// 연주판에서 곡 고르기: 인도자가 고르면 모두에게, 아니면 나만
function jamPickSong(id) {
  const sg = songById(id);
  JAM.song = sg ? sg.id : null; JAM.sec = 0;
  if (sg && (jamInst() === "lead" || !jamLeader())) { JAM.key = sg.key_root; JAM.bpm = sg.bpm; }
  if (!jamInst()) { openJamPick(); toast("🎸 악기 자리를 고르면 그 곡 코드로 연주할 수 있어요"); }
  refreshMe(); jamSyncLoops(); renderJamBar(true);
}
// 지금 연주하는 곡: 인도자가 고른 곡이 먼저
function jamSong() { const L = jamInst() === "lead" ? null : jamLeader(); const id = L && L.jam && L.jam.song ? L.jam.song : JAM.song; return songById(id); }
function playSym(sym, tr) {
  const i = jamInst(); if (!i || i === "drums") return;
  const midis = JA.symMidis(sym, tr, i === "key2" ? "key" : i); if (!midis) return;
  if (i === "bass") JAM.bassRoot = midis[0];
  jamTrigger({ k: "n", v: midis, s: toneOf(i) });
}

/* ----- 💿 친구가 튼 CD 같이 듣기 ----- */
const cdSkip = new Set();
function renderCdShare() {
  const box = $("#cdShare"); if (!box) return;
  const p = S.room === "praise" && S.peers.find((x) => x.id !== myId && x.cd && /^[\w-]{11}$/.test(x.cd.v || "") && !cdSkip.has(x.id + x.cd.at) && !(S.cdShare && S.cdShare.v === x.cd.v));
  if (!p) { box.hidden = true; return; }
  const key = p.id + p.cd.at; if (box.dataset.key === key && !box.hidden) return;
  box.dataset.key = key; box.hidden = false;
  box.replaceChildren(h("span", { text: `💿 ${clip(p.name, LIMIT.name) || "친구"}님이 '${clip(p.cd.t, 24)}'을(를) 틀었어요` }),
    h("button", { class: "btn primary sm", text: "같이 듣기", onclick: () => { const sec = Math.max(0, Math.round((Date.now() - Number(p.cd.at)) / 1000)); playCd(p.cd.v, p.cd.t, false, sec); box.hidden = true; } }),
    h("button", { class: "icon-btn", text: "✕", onclick: () => { cdSkip.add(key); box.hidden = true; } }));
}

/* ================= 🎯 미션 · 연속 출석 · 배지 · 절기 스킨 · 신앙 앨범 (2026-11-17) ================= */
// 기록 MS.log = { "2026-11-17": { visit: 1, pray: 2, "read:43:3": 1, give: 1, ... } } (뉴욕 날짜)
// 이 기기에 먼저 저장하고(oc_mlog), Supabase(supabase-update-missions.sql)에도 올려요. 들어올 때 서버 기록과 합쳐요.
const MS = { log: store.get("mlog", {}), books: {}, resolve: store.get("mresolve", ""), loaded: false, noServer: false, seen: new Set(store.get("mSeen", [])) };
const dIdx = (d) => Math.floor(Date.parse(d + "T12:00:00Z") / 864e5); // 날짜 → 날 번호 (오늘의 말씀 계산과 같아요)
const dStr = (i) => new Date(i * 864e5).toISOString().slice(0, 10);   // 날 번호 → 날짜
const MCAP = (k) => (/^(visit|stamp|resolve|jam|walk|walkq|campfire)$/.test(k) || /^(read|season|gift):/.test(k) ? 1 : k === "pray" ? 20 : k === "catpet" ? 10 : /^treat:/.test(k) ? 2 : 30);
MS.giftAt = store.get("giftAt", {}); // { "날짜|선물id": 받은 시각(ms) } → 24시간 동안 입어요
function saveMlog() {
  const cut = dIdx(nyDay()) - 800;
  for (const d of Object.keys(MS.log)) if (dIdx(d) < cut) delete MS.log[d];
  store.set("mlog", MS.log);
}
// 한 일 기록하기 (kind: visit · pray · read:책:장 · give · catfeed · quiz · jam · cookie · stamp · resolve · season:이름:연도)
function mAdd(kind, note) {
  if (!started) return false;
  const d = nyDay(), day = MS.log[d] || (MS.log[d] = {}), cur = day[kind] || 0;
  if (cur >= MCAP(kind)) return false;
  day[kind] = cur + 1; saveMlog();
  if (kind === "resolve" && note) { MS.resolve = clip(note, 80); store.set("mresolve", MS.resolve); }
  if (kind.startsWith("gift:")) { MS.giftAt[d + "|" + kind.slice(5)] = Date.now(); store.set("giftAt", MS.giftAt); }
  if (!api.demo && !MS.noServer) api.missionAdd(kind, note).catch((e) => { if (/준비 중/.test(e.message)) { MS.noServer = true; console.warn("미션 기록: Supabase에서 supabase-update-missions.sql을 실행해 주세요"); } else console.warn("미션 기록:", e.message); });
  if (!/^(stamp|season:)/.test(kind)) setTimeout(() => missionCheck(kind), 30);
  return true;
}
// 기도는 10분에 한 번만 셉니다 (기도하기를 껐다 켰다 해도 한 번)
function mPray() { const t = store.get("mPrayAt", 0); if (Date.now() - t < 10 * 60e3) return; store.set("mPrayAt", Date.now()); mAdd("pray"); }
async function loadMissions() {
  try {
    const r = await api.missionMe(); MS.loaded = true;
    for (const [d, k, n, at] of r.log || []) {
      const day = MS.log[d] || (MS.log[d] = {}); day[k] = Math.max(day[k] || 0, n);
      if (k.startsWith("gift:") && at && !MS.giftAt[d + "|" + k.slice(5)]) MS.giftAt[d + "|" + k.slice(5)] = Number(at) * 1000;
    }
    store.set("giftAt", MS.giftAt);
    MS.books = {}; for (const [b, n, at] of r.books || []) MS.books[b] = { n: Number(n), at: at ? new Date(at).getTime() : 0 };
    if (r.resolve) MS.resolve = r.resolve;
    saveMlog();
  } catch (e) { if (/준비 중/.test(e.message)) MS.noServer = true; else console.warn("미션 기록 불러오기:", e.message); }
  missionCheck(); refreshMe(); renderMissionBits();
}

// ---- 오늘의 미션 (모두 같은 미션 3개: 말씀·기도 하나 + 재미 둘) ----
const MISSIONS = {
  pray: { e: "🙏", t: "본당에서 기도하기", how: "본당에서 '🙏 기도하기'를 20초 넘게 하거나, 기도제목 말풍선을 올려요", go: () => goRoom("worship") },
  verse: { e: "📖", t: "오늘의 말씀 장 읽기", how: "오늘의 말씀이 있는 장을 1분 넘게 읽거나 '✓ 다 읽었어요'를 눌러요", go: () => { const v = todayVerse(); if (v) openReader(v.b - 1, v.c); } },
  share: { e: "🍡", t: "간식 나누기", how: "친구에게 간식을 주거나, 푸드 트럭·쇼룸에서 만들어서 두고 와요", go: () => goYard(-30.6, 7.0, "🍢 먹거리 골목") },
  catfeed: { e: "🐾", t: "고양이 밥 주기", how: "마당 왼쪽 고양이 콘도에서 밥을 줘요", go: () => goYard(-19.5, -6.2, "🐱 고양이 콘도", openCatFood) },
  quiz: { e: "🧩", t: "성경 퀴즈 한 판", how: "5문제를 풀고 '채점하기'까지 눌러요", go: () => openQuiz("play") },
  jam: { e: "🎸", t: "연습실에서 연주하기", how: "찬양팀 연습실 악기 자리에 서서 소리를 내 봐요", go: () => goRoom("praise") },
  cookie: { e: "🧀", t: "쫀득쿠키 한 박스 만들기", how: "치즈멜로바이트 쇼룸에서 만들기 게임을 해요", go: () => goShowroom(true) },
};
const FUN = ["share", "catfeed", "quiz", "jam", "cookie"];
function verseOn(d) {
  if (!VERSES.length) return null;
  const n = VERSES.length, step = n % 7 ? 7 : 11; return VERSES[(dIdx(d) * step) % n]; // todayVerse()와 같은 계산
}
function missionsOf(d) {
  const i = dIdx(d), h = hash2(i, 77);
  const a = h % 5, b = (a + 1 + ((h >>> 4) % 4)) % 5;
  return [i % 2 ? "pray" : "verse", FUN[a], FUN[b]];
}
function hash2(a, b) { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return x >>> 0; }
function missionDone(m, d) {
  const day = MS.log[d] || {};
  if (m === "verse") { const v = verseOn(d); return !!(v && day[`read:${v.b}:${v.c}`]); }
  if (m === "share") return !!day.give;
  return !!day[m];
}
const todayMissions = () => missionsOf(nyDay()).map((m) => ({ m, ...MISSIONS[m], done: missionDone(m, nyDay()) }));

// ---- 연속 출석 (일주일에 하루는 '쉼의 날'로 빠져도 이어져요) ----
function streaks() {
  const keys = Object.keys(MS.log).filter((d) => MS.log[d].visit).sort();
  const tN = dIdx(nyDay());
  if (!keys.length) return { cur: 0, best: 0, today: false, rest: false };
  const vis = new Set(keys.map(dIdx));
  let cur = 0, best = 0, lastRest = -999, miss = 0;
  for (let x = dIdx(keys[0]); x <= tN; x++) {
    if (vis.has(x)) { cur++; miss = 0; }
    else if (x === tN) { /* 오늘은 아직 안 왔을 뿐 */ }
    else { miss++; if (miss >= 2 || x - lastRest < 7) { cur = 0; lastRest = -999; } else lastRest = x; }
    best = Math.max(best, cur);
  }
  return { cur, best, today: vis.has(tN), rest: tN - lastRest < 7 && lastRest > 0 };
}

// ---- 합계 · 다 읽은 책 ----
function mTotals() {
  const t = { pray: 0, give: 0, catfeed: 0, quiz: 0, jam: 0, cookie: 0, stamp: 0, visit: 0, lastCat: null }, chaps = new Set(), byYear = {};
  for (const [d, day] of Object.entries(MS.log)) {
    const y = d.slice(0, 4), Y = byYear[y] || (byYear[y] = { visit: 0, pray: 0, read: 0, stamp: 0, cookie: 0, catfeed: 0, quiz: 0, give: 0, jam: 0 });
    for (const [k, n] of Object.entries(day)) {
      if (k.startsWith("read:")) { chaps.add(k); Y.read++; continue; }
      if (k in t) t[k] += n; if (k in Y) Y[k] += n;
    }
    if (day.catfeed && (!t.lastCat || d > t.lastCat)) t.lastCat = d;
  }
  t.chaps = chaps.size; t.byYear = byYear;
  return t;
}
function booksDone() {
  const read = {}; // 책(1~66) → 읽은 장 Set
  for (const [b, l] of Object.entries(S.progress || {})) read[+b + 1] = new Set(l);
  for (const day of Object.values(MS.log)) for (const k of Object.keys(day)) { const m = /^read:(\d+):(\d+)$/.exec(k); if (m) (read[+m[1]] || (read[+m[1]] = new Set())).add(+m[2]); }
  const at = store.get("bookDoneAt", {}), out = [];
  for (let b = 1; b <= 66; b++) {
    const need = BOOKS[b - 1][1], n = Math.max(read[b] ? read[b].size : 0, MS.books[b] ? MS.books[b].n : 0);
    if (n >= need) { if (!at[b]) at[b] = (MS.books[b] && MS.books[b].at) || Date.now(); out.push({ b, name: BOOKS[b - 1][0], at: at[b] }); }
  }
  store.set("bookDoneAt", at);
  return out.sort((x, y) => y.at - x.at);
}

// ---- 절기 (장로교·개혁주의 교회가 지키는 절기) ----
function easterIdx(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return Math.round(Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1) / 864e5);
}
const dayOf = (y, mo, d) => Math.round(Date.UTC(y, mo - 1, d) / 864e5);
const dow = (i) => new Date(i * 864e5).getUTCDay(); // 0 = 주일
function thanksSunday(y) { const n1 = dayOf(y, 11, 1), thu1 = n1 + ((4 - dow(n1) + 7) % 7); return thu1 + 21 - 4; } // 넷째 목요일 바로 앞 주일
const SEASONS = [
  { id: "thanks", e: "🌾", name: "추수감사절", range: (y) => [thanksSunday(y), thanksSunday(y) + 7],
    tasks: [["read:19:100", "📖 시편 100편 읽기", () => openReader(18, 100)], ["pray", "🙏 본당에서 감사 기도", () => goRoom("worship")]], skin: "곡식 바구니 들기" },
  { id: "xmas", e: "⭐", name: "크리스마스", range: (y) => [dayOf(y, 12, 1), dayOf(y, 12, 25)],
    tasks: [["read:23:9", "📖 이사야 9장", () => openReader(22, 9)], ["read:33:5", "📖 미가 5장", () => openReader(32, 5)], ["read:42:1", "📖 누가복음 1장", () => openReader(41, 1)], ["read:42:2", "📖 누가복음 2장", () => openReader(41, 2)]], skin: "머리 위 베들레헴 별" },
  { id: "newyear", e: "🎉", name: "송구영신 · 신년", range: (y) => [dayOf(y - 1, 12, 31), dayOf(y, 1, 7)],
    tasks: [["resolve", "✍️ 새해 다짐 한 줄 쓰기", () => openAlbum("mission")]], skin: "이름표에 🎉 새해 배지" },
  { id: "easter", e: "✝️", name: "고난주간 · 부활절", range: (y) => [easterIdx(y) - 7, easterIdx(y)],
    tasks: [["read:40:26", "📖 마태복음 26장", () => openReader(39, 26)], ["read:40:27", "📖 마태복음 27장", () => openReader(39, 27)], ["read:40:28", "📖 마태복음 28장", () => openReader(39, 28)]], skin: "백합 배지 + 이름표에 'He is risen'" },
  { id: "pentecost", e: "🕊", name: "성령강림절", range: (y) => [easterIdx(y) + 49, easterIdx(y) + 56],
    tasks: [["read:44:2", "📖 사도행전 2장", () => openReader(43, 2)]], skin: "어깨 위 비둘기" },
  { id: "barley", e: "🌿", name: "맥추감사절", range: (y) => { const j1 = dayOf(y, 7, 1), s = j1 + ((7 - dow(j1)) % 7); return [s, s + 7]; },
    tasks: [["read:2:23", "📖 출애굽기 23장", () => openReader(1, 23)], ["pray", "🙏 본당에서 감사 기도", () => goRoom("worship")]], skin: "밀 이삭 모자" },
  { id: "reform", e: "📖", name: "종교개혁주일", range: (y) => { const o31 = dayOf(y, 10, 31), s = o31 - dow(o31); return [s, s + 7]; },
    tasks: [["read:45:1", "📖 로마서 1장 (1:17)", () => openReader(44, 1)], ["quiz", "🧩 성경 퀴즈 한 판", () => openQuiz("play")]], skin: "이름표에 '5 SOLA' 배지 (오직 성경·믿음·은혜·그리스도·하나님께 영광)" },
];
function seasonNow(at = dIdx(nyDay())) {
  const y = +dStr(at).slice(0, 4);
  for (const s of SEASONS) for (const yy of [y, y + 1]) { const [a, b] = s.range(yy); if (at >= a && at <= b) return { ...s, y: yy, a, b }; }
  return null;
}
function seasonNext() {
  const t = dIdx(nyDay()), y = +nyDay().slice(0, 4); let best = null;
  for (const s of SEASONS) for (const yy of [y, y + 1]) { const [a, b] = s.range(yy); if (a > t && (!best || a < best.a)) best = { ...s, y: yy, a, b }; }
  return best;
}
function seasonTaskDone(kind, a, b) {
  const t = Math.min(b, dIdx(nyDay()));
  for (let x = a; x <= t; x++) { const day = MS.log[dStr(x)]; if (day && day[kind]) return true; }
  return false;
}
// 받은 절기 스킨: { thanks: [2026], xmas: [2026, 2027] ... }
function seasonWon() {
  const out = {};
  for (const day of Object.values(MS.log)) for (const k of Object.keys(day)) { const m = /^season:([a-z]+):(\d{4})$/.exec(k); if (m) (out[m[1]] || (out[m[1]] = new Set())).add(+m[2]); }
  for (const k in out) out[k] = [...out[k]].sort();
  return out;
}

// ---- ✨ 특별 스킨 목록 (받는 조건) ----
const SKINS = [
  { slot: "halo", v: "sprout1", e: "🌱", name: "머리 위 새싹 하나", need: "5일 연속 출석", prog: (c) => [c.st.best, 5] },
  { slot: "halo", v: "sprout2", e: "🌱", name: "머리 위 새싹 둘 (로고처럼)", need: "14일 연속 출석", prog: (c) => [c.st.best, 14] },
  { slot: "halo", v: "bud", e: "🌷", name: "꽃봉오리 새싹", need: "30일 연속 출석", prog: (c) => [c.st.best, 30] },
  { slot: "trail", v: "sprout", e: "👣", name: "새싹 발자국", need: "기도 30번 (10분에 한 번씩 세요)", prog: (c) => [c.t.pray, 30] },
  { slot: "item", v: "scroll", e: "📜", name: "두루마리 성경", need: "성경 한 권 다 읽기 (이름표에 최근 다 읽은 책)", prog: (c) => [c.books.length, 1] },
  { slot: "apron", v: "cheese", e: "🧀", name: "치즈 앞치마", need: "쇼룸에서 쫀득쿠키 10박스 만들기", prog: (c) => [c.t.cookie, 10] },
  // ✅ 미션 도장 모으기 (그루터기에서 자라나요 · 사 6:13, 요 15:5)
  { slot: "title", v: "branch", e: "🌿", name: "'가지' 칭호", need: "미션 도장 3개", prog: (c) => [c.t.stamp, 3], stamp: 3 },
  { slot: "halo", v: "rainbow", e: "🌈", name: "언약의 무지개 (창 9:13)", need: "미션 도장 7개", prog: (c) => [c.t.stamp, 7], stamp: 7 },
  { slot: "item", v: "grapes", e: "🍇", name: "포도송이 들기", need: "미션 도장 15개", prog: (c) => [c.t.stamp, 15], stamp: 15 },
  { slot: "title", v: "fruit", e: "🍇", name: "'열매 맺는' 칭호", need: "미션 도장 15개", prog: (c) => [c.t.stamp, 15], stamp: 15 },
  { slot: "title", v: "tree", e: "🌳", name: "'큰 나무' 칭호 + 금빛 이름표", need: "미션 도장 30개", prog: (c) => [c.t.stamp, 30], stamp: 30 },
  { slot: "item", v: "basket", e: "🌾", name: "곡식 바구니", season: "thanks" },
  { slot: "halo", v: "star", e: "⭐", name: "베들레헴 별", season: "xmas" },
  { slot: "badge", v: "newyear", e: "🎉", name: "새해 배지", season: "newyear" },
  { slot: "pin", v: "lily", e: "🤍", name: "부활절 백합 배지", season: "easter" },
  { slot: "badge", v: "easter", e: "✝️", name: "He is risen 이름표", season: "easter" },
  { slot: "shoulder", v: "dove", e: "🕊", name: "어깨 위 비둘기", season: "pentecost" },
  { slot: "wear", v: "wheathat", e: "🌿", name: "밀 이삭 모자", season: "barley" },
  { slot: "badge", v: "reform", e: "📖", name: "5 SOLA 배지", season: "reform" },
];
const TITLE_TXT = { branch: "🌿 가지", fruit: "🍇 열매 맺는", tree: "🌳 큰 나무" };
const BADGE_TXT = { newyear: (y) => `🎉 ${y} 새해`, easter: () => "✝️ He is risen", reform: () => "📖 5 SOLA" };
let mCtx = null;
function skinCtx() { return (mCtx = { st: streaks(), t: mTotals(), books: booksDone(), won: seasonWon() }); }
function skinOpen(sk, c = mCtx || skinCtx()) {
  if (sk.season) return !!(c.won[sk.season] && c.won[sk.season].length);
  const [a, b] = sk.prog(c); return a >= b;
}
const skinFor = (slot, v) => SKINS.find((k) => k.slot === slot && k.v === v);
// 잠긴 아이템인지 (item·wear 고르기에서)
function lockedLook(slot, v) { const sk = skinFor(slot, v); return !!sk && !skinOpen(sk); }
function petActive(c = mCtx || skinCtx()) { return !!c.t.lastCat && dIdx(nyDay()) - dIdx(c.t.lastCat) <= 7; }
// 나에게 보이는 특별 스킨 (받은 것만 실어 보내요)
function mySkins() {
  const p = S.profile || {}, c = mCtx || skinCtx(), ok = (slot, v) => v && v !== "none" && (!skinFor(slot, v) || skinOpen(skinFor(slot, v), c));
  const out = { halo: ok("halo", p.halo) ? p.halo : "none", trail: ok("trail", p.trail) ? p.trail : "none", shoulder: ok("shoulder", p.shoulder) ? p.shoulder : "none",
    apron: ok("apron", p.apron) ? p.apron : "none", pin: ok("pin", p.pin) ? p.pin : "none",
    ...catWalkLook(), // 🐾 산책 중인 고양이 (pet · pets · petAt · catBoss)
    item: lockedLook("item", p.item) ? "none" : p.item, wear: lockedLook("wear", p.wear) ? "none" : p.wear, badge: "", book: "", title: "", costume: giftActive() || "" };
  if (p.title && skinFor("title", p.title) && skinOpen(skinFor("title", p.title), c)) out.title = p.title;
  if (p.badge && skinFor("badge", p.badge) && skinOpen(skinFor("badge", p.badge), c)) { const ys = c.won[p.badge] || []; out.badge = BADGE_TXT[p.badge](ys[ys.length - 1]); }
  if (out.item === "scroll" && c.books.length) out.book = "📜 " + c.books[0].name;
  return out;
}

// ---- 확인: 미션 완료 · 도장 · 절기 · 새로 받은 스킨 ----
function missionCheck(kind) {
  const d = nyDay(), list = todayMissions(), day = MS.log[d] || {};
  if (kind) { const m = list.find((x) => x.done && (x.m === kind || (x.m === "share" && kind === "give") || (x.m === "verse" && /^read:/.test(kind)))); if (m && !store.get("mT" + d + m.m, false)) { store.set("mT" + d + m.m, true); toast(`${m.e} 오늘의 미션 완료: ${m.t} ✓`); } }
  if (list.every((x) => x.done) && !day.stamp) { mAdd("stamp"); setTimeout(() => { toast("🎉 오늘의 미션 3개 다 했어요! 도장 쾅 ✅ 선물 상자가 열렸어요 🎁"); confetti(); openGift(); const tk = TREAT_KEYS[hash2(dIdx(d) * 3 + 1, tokHash) % 5]; setTimeout(() => toast(`🎒 고양이 특식 ${TREATS[tk].e} ${TREATS[tk].name} 1개도 받았어요! 고양이 콘도에서 줘 봐요`), 4500); }, 900); }
  const sn = seasonNow();
  if (sn && sn.tasks.every(([k]) => seasonTaskDone(k, sn.a, sn.b)) && !(seasonWon()[sn.id] || []).includes(sn.y)) {
    mAdd(`season:${sn.id}:${sn.y}`);
    setTimeout(() => { toast(`${sn.e} ${sn.y} ${sn.name} 스킨을 받았어요! '내 그루터기'에서 착용해 보세요`); confetti(); }, 1600);
  }
  // 새로 열린 스킨 알려 주기
  const c = skinCtx();
  for (const sk of SKINS) { const key = sk.slot + ":" + sk.v; if (skinOpen(sk, c) && !MS.seen.has(key)) { MS.seen.add(key); store.set("mSeen", [...MS.seen]); if (MS.loaded || !api.demo) setTimeout(() => toast(`✨ 새 스킨: ${sk.e} ${sk.name}! '내 그루터기'에서 착용해요`), 2400); } }
  renderMissionBits(); refreshSkinsIfChanged();
}
let lastSkinKey = "";
function refreshSkinsIfChanged() { const k = JSON.stringify(mySkins()); if (k !== lastSkinKey) { lastSkinKey = k; if (started) refreshMe(); } }
function confetti() {
  const box = h("div", { class: "confetti" });
  for (let i = 0; i < 40; i++) { const p = h("i"); p.style.left = Math.random() * 100 + "%"; p.style.background = ["#f7c948", "#d9483b", "#7cc24a", "#8fa8d6", "#fff4dc"][i % 5]; p.style.animationDelay = Math.random() * 0.5 + "s"; p.style.transform = `rotate(${Math.random() * 360}deg)`; box.append(p); }
  document.body.append(box); setTimeout(() => box.remove(), 2600);
}

// ---- 화면: 위쪽 버튼 숫자 · 마당 게시판 카드 ----
function renderMissionBits() {
  if (!started) return;
  const list = todayMissions(), left = list.filter((x) => !x.done).length, st = (mCtx && mCtx.st) || streaks();
  const dotEl = $("#albumDot"); dotEl.textContent = left ? left : "✓"; dotEl.classList.toggle("done", !left);
  $$("[data-mission-card]").forEach((box) => {
    box.replaceChildren(...[
      h("div", { class: "mc-head" }, h("b", { text: "🎯 오늘의 미션" }), h("span", { class: "mc-streak", text: st.cur ? `🔥 ${st.cur}일째` : "🔥 오늘부터 시작" })),
      ...list.map((x) => h("button", { class: "mc-row" + (x.done ? " done" : ""), title: x.how, onclick: () => (x.done ? openAlbum("mission") : x.go()) },
        h("span", { class: "mc-chk", text: x.done ? "✓" : x.e }), h("span", { class: "mc-t", text: x.t }), h("small", { text: x.done ? "완료" : "가기 →" }))),
      seasonNow() ? h("button", { class: "mc-season", onclick: () => openAlbum("mission"), text: `${seasonNow().e} ${seasonNow().name} 한정 미션 진행 중 →` }) : null,
      h("button", { class: "mc-album", onclick: () => openAlbum("mission"), text: "🌱 내 그루터기 (배지 · 스킨 · 기록) 열기" })].filter(Boolean));
  });
  if (!$("#albumModal").hidden) renderAlbum();
}
function goRoom(r) { closeModal("albumModal"); if (S.room !== r) joinRoom(r, S.room); else toast(`이미 ${ROOM_NAME[r]}에 있어요`); }
function goYard(x, z, label, then) {
  closeModal("albumModal");
  const go = () => { W.walkTo(x, z); toast(`${label}(으)로 가는 중이에요`); if (then) setTimeout(then, 600); };
  if (S.room !== "yard") { joinRoom("yard", S.room); setTimeout(go, 700); } else go();
}

// ---- 🎁 오늘의 선물: 미션 3개를 다 하면 상자를 열어요 → 하루짜리 꾸미기(약 75%) 또는 ✨ 희귀 성경 인물 착장(약 25%) · 24시간 ----
const GIFT_RARE = 25;
const tokHash = (() => { let x = 0; for (const ch of token) x = (Math.imul(x, 31) + ch.charCodeAt(0)) | 0; return x >>> 0; })();
const COST = () => W.COSTUMES || {};
function giftCollected() { const out = new Map(); for (const [d, day] of Object.entries(MS.log)) for (const k of Object.keys(day)) if (k.startsWith("gift:") && COST()[k.slice(5)]) { const id = k.slice(5); if (!out.has(id) || out.get(id) > d) out.set(id, d); } return out; } // id → 처음 받은 날
function giftOf(d) { const day = MS.log[d] || {}; const k = Object.keys(day).find((x) => x.startsWith("gift:")); return k ? k.slice(5) : null; }
// 하루 한 번, 새로고침해도 같은 결과 (기기 표시 + 날짜로 정해요). 희귀는 아직 못 받은 인물부터
function giftPick(d) {
  const all = Object.entries(COST()), mo = +d.slice(5, 7), hsh = hash2(dIdx(d), tokHash), rare = hsh % 100 < GIFT_RARE;
  let pool = all.filter(([, c]) => !!c.rare === rare && (!c.month || c.month === mo));
  if (rare) { const have = giftCollected(); const fresh = pool.filter(([id]) => !have.has(id)); if (fresh.length) pool = fresh; }
  return pool.length ? pool[(hsh >>> 8) % pool.length][0] : null;
}
// 지금 입고 있는 선물 (받은 때부터 24시간, '벗기'를 누르면 그날은 안 입어요)
function giftActive() {
  const now = Date.now(), off = store.get("giftOff", {});
  for (const [key, at] of Object.entries(MS.giftAt || {})) {
    const [d, id] = key.split("|");
    if (now - at < 24 * 3600e3 && now >= at && COST()[id] && !off[key]) return id;
  }
  return null;
}
function giftKeyActive() { const now = Date.now(); for (const [key, at] of Object.entries(MS.giftAt || {})) if (now - at < 24 * 3600e3) return key; return null; }
function giftLeftText(key) { const ms = 24 * 3600e3 - (Date.now() - (MS.giftAt[key] || 0)); const hh = Math.max(0, Math.floor(ms / 3600e3)), mm = Math.max(0, Math.floor((ms % 3600e3) / 60e3)); return `${hh}시간 ${mm}분 남았어요`; }
function giftCard(id, opts = {}) {
  const c = COST()[id]; if (!c) return null;
  return h("div", { class: "gift-card" + (c.rare ? " rare" : "") },
    h("div", { class: "gc-tag", text: c.rare ? "✨ 희귀 · 성경 인물 착장" : "🎀 하루짜리 꾸미기" }),
    h("div", { class: "gc-em", text: c.e }), h("b", { text: c.name }),
    c.ref ? h("p", { class: "gc-ref", text: `${c.who} · ${c.ref[2]}` }) : null,
    c.ref ? h("button", { class: "btn ghost sm", text: "📖 이 이야기 읽기", onclick: () => { closeModal("giftModal"); closeModal("albumModal"); openReader(c.ref[0] - 1, c.ref[1]); } }) : null,
    opts.left ? h("small", { class: "muted", text: "⏳ " + opts.left }) : null);
}
function openGift() {
  const d = nyDay(), day = MS.log[d] || {}, had = giftOf(d);
  const body = $("#giftBody");
  if (!day.stamp) { body.replaceChildren(h("p", { class: "muted", text: "오늘의 미션 3개를 다 하면 선물 상자를 열 수 있어요 🎁" })); openModal("giftModal"); return; }
  if (had) { const key = d + "|" + had; body.replaceChildren(h("p", { class: "muted", text: "오늘 받은 선물이에요. 받은 때부터 24시간 동안 입어요." }), giftCard(had, { left: giftLeftText(key) }), giftWearBtn(key)); openModal("giftModal"); return; }
  const boxEl = h("button", { class: "gift-box", title: "눌러서 열기", onclick: () => {
    boxEl.classList.add("open"); setTimeout(() => {
      const id = giftPick(d); if (!id) return;
      mAdd(`gift:${id}`); const c = COST()[id];
      body.replaceChildren(h("p", { class: "gift-wow", text: c.rare ? "✨ 와! 희귀 착장이에요!" : "🎉 선물이 나왔어요!" }), giftCard(id, { left: "지금부터 24시간 동안 입어요" }),
        c.rare && !giftCollected().has(id) ? null : h("p", { class: "muted tiny", text: c.rare ? "📖 성경 인물 도감에 추가됐어요 (🌱 내 그루터기 → 🎁 선물·도감)" : "다른 사람 화면에도 보여요 😊" }));
      confetti(); refreshMe(); renderMissionBits();
    }, 650);
  } }, h("span", { text: "🎁" }));
  body.replaceChildren(h("p", { class: "muted", text: "오늘의 미션을 다 했어요! 상자를 눌러서 열어 보세요." }), boxEl, h("p", { class: "muted tiny", text: "하루짜리 꾸미기나, 가끔 ✨ 희귀 성경 인물 착장이 나와요." }));
  openModal("giftModal");
}
function giftWearBtn(key) {
  const off = store.get("giftOff", {});
  return h("button", { class: "btn ghost sm", text: off[key] ? "👕 다시 입기" : "🙅 오늘은 벗기", onclick: () => { const o = store.get("giftOff", {}); o[key] = !o[key]; store.set("giftOff", o); refreshMe(); renderAlbum(); if (!$("#giftModal").hidden) openGift(); } });
}
function giftStatusEl() {
  const d = nyDay(), day = MS.log[d] || {}, key = giftKeyActive();
  if (day.stamp && !giftOf(d)) return h("button", { class: "btn primary wide gift-open", text: "🎁 오늘의 선물 상자 열기", onclick: openGift });
  if (key) return h("div", { class: "gift-now" }, h("span", { text: "🎁 지금 입고 있는 선물: " }), h("b", { text: COST()[key.split("|")[1]]?.name || "" }), h("small", { text: " · " + giftLeftText(key) }));
  return null;
}
function stampNextEl(c) {
  const next = SKINS.filter((k) => k.stamp && c.t.stamp < k.stamp).sort((a, b) => a.stamp - b.stamp)[0];
  if (!next) return h("p", { class: "muted tiny", text: "✅ 도장 보상을 모두 받았어요! 🌳" });
  const left = next.stamp - c.t.stamp;
  return h("div", { class: "stamp-next" }, h("span", { text: `✅ 도장 ${left}개만 더 모으면 ${next.e} ${next.name}` }), h("div", { class: "al-bar" }, h("i", { style: `width:${Math.min(100, (c.t.stamp / next.stamp) * 100)}%` })));
}
// 🎁 선물·도감 탭
function albumGift(c) {
  const have = giftCollected(), rare = Object.entries(COST()).filter(([, x]) => x.rare), common = Object.entries(COST()).filter(([, x]) => !x.rare);
  const key = giftKeyActive();
  const out = [giftStatusEl() || h("p", { class: "muted tiny", text: "오늘의 미션 3개를 다 하면 선물 상자가 열려요. 받은 선물은 24시간 동안 입어요." })];
  if (key) out.push(giftCard(key.split("|")[1], { left: giftLeftText(key) }), giftWearBtn(key));
  out.push(h("div", { class: "board-label", text: `📖 성경 인물 도감 ${rare.filter(([id]) => have.has(id)).length}/${rare.length}` }),
    h("div", { class: "dex" }, ...rare.map(([id, x]) => { const got = have.has(id);
      return h("button", { class: "dex-item" + (got ? " got" : ""), title: got ? `${x.name} · ${x.ref[2]}` : "아직 못 만났어요", onclick: () => { if (got) { closeModal("albumModal"); openReader(x.ref[0] - 1, x.ref[1]); } else toast(`❔ 아직 못 만난 인물이에요. 힌트: ${x.ref[2]}${x.month ? " (12월에만 나와요)" : ""}`); } },
        h("span", { class: "em", text: got ? x.e : "❔" }), h("b", { text: got ? x.who : "???" }), h("small", { text: got ? x.ref[2] : x.month ? "12월 한정" : "" })); })),
    h("p", { class: "muted tiny", text: "받은 인물을 누르면 그 이야기를 읽을 수 있어요. 희귀 착장은 아직 못 만난 인물부터 나와요." }),
    h("div", { class: "board-label", text: "🎀 하루짜리 꾸미기" }),
    h("div", { class: "chips" }, ...common.map(([id, x]) => h("span", { class: "chip" + (have.has(id) ? "" : " dim"), text: `${have.has(id) ? x.e : "❔"} ${x.name}` }))));
  return out;
}

// ---- 🌱 내 그루터기 (신앙 앨범) ----
let albumTab = "mission";
function openAlbum(tab) { if (tab) albumTab = tab; skinCtx(); renderAlbum(); openModal("albumModal"); if (!MS.loaded) loadMissions(); }
$$("[data-atab]").forEach((b) => (b.onclick = () => { albumTab = b.dataset.atab; renderAlbum(); }));
function renderAlbum() {
  $$("[data-atab]").forEach((b) => b.classList.toggle("active", b.dataset.atab === albumTab));
  const c = skinCtx(), body = $("#albumBody");
  const out = ({ mission: albumMission, gift: albumGift, skins: albumSkins, record: albumRecord, card: albumCard, walk: albumWalk }[albumTab] || albumMission)(c);
  if (out && out.then) out.then((x) => body.replaceChildren(...x.filter(Boolean))); else body.replaceChildren(...out);
}
function albumMission(c) {
  const list = todayMissions(), done = list.filter((x) => x.done).length, sn = seasonNow(), nx = seasonNext();
  const out = [
    h("div", { class: "al-streak" },
      h("div", {}, h("b", { text: `🔥 ${c.st.cur}일` }), h("span", { text: "연속 출석" })),
      h("div", {}, h("b", { text: `🏅 ${c.st.best}일` }), h("span", { text: "최고 기록" })),
      h("div", {}, h("b", { text: `✅ ${c.t.stamp}개` }), h("span", { text: "미션 도장" }))),
    h("p", { class: "muted tiny", text: c.st.rest ? "😌 이번 주 '쉼의 날'을 썼어요. 하루는 빠져도 이어져요 (일주일에 한 번)" : "일주일에 하루는 빠져도 연속 출석이 이어져요 ('쉼의 날')." }),
    h("div", { class: "board-label", text: `🎯 오늘의 미션 ${done}/3 ${done === 3 ? "· 도장 쾅! 🎉" : ""}` }),
    h("ul", { class: "al-list" }, ...list.map((x) => h("li", { class: x.done ? "done" : "" }, h("span", { class: "mc-chk", text: x.done ? "✓" : x.e }),
      h("span", { class: "t" }, x.t, h("small", { text: x.how })), x.done ? h("b", { class: "ok", text: "완료" }) : h("button", { class: "btn ghost sm", text: "가기", onclick: () => x.go() })))),
    h("p", { class: "muted tiny", text: "미션은 뉴욕 시간 자정에 바뀌고, 모두에게 같은 미션이 나와요. 3개를 다 하면 🎁 선물 상자가 열려요." }),
    giftStatusEl(),
    stampNextEl(c),
  ].filter(Boolean);
  if (sn) {
    out.push(h("div", { class: "board-label", text: `${sn.e} ${sn.name} 한정 미션 (${dStr(sn.a).slice(5).replace("-", "/")} ~ ${dStr(sn.b).slice(5).replace("-", "/")})` }));
    out.push(h("ul", { class: "al-list season" }, ...sn.tasks.map(([k, t, go]) => { const ok = seasonTaskDone(k, sn.a, sn.b);
      return h("li", { class: ok ? "done" : "" }, h("span", { class: "mc-chk", text: ok ? "✓" : sn.e }), h("span", { class: "t", text: t }), ok ? h("b", { class: "ok", text: "완료" }) : k === "resolve" ? null : h("button", { class: "btn ghost sm", text: "하러 가기", onclick: () => { closeModal("albumModal"); go(); } })); })));
    if (sn.id === "newyear") {
      const inp = h("input", { maxlength: 60, placeholder: "예: 새해엔 매일 시편 한 편 읽기", value: MS.resolve || "" });
      out.push(h("div", { class: "composer-row small" }, inp, h("button", { class: "btn primary sm", text: "✍️ 다짐 남기기", onclick: () => { const v = inp.value.trim(); if (!v) { toast("다짐을 한 줄 적어 주세요"); return; } if (!checkText(v)) return; MS.resolve = v; store.set("mresolve", v); if (!mAdd("resolve", v)) toast("오늘 다짐을 이미 남겼어요 🙂"); else toast("✍️ 새해 다짐을 남겼어요. 나만 볼 수 있어요"); renderAlbum(); } })));
    }
    out.push(h("p", { class: "muted tiny", text: `다 하면 ${sn.y} ${sn.name} 스킨 (${sn.skin})을 받아요. 그때만 받을 수 있고, 받으면 평생 남아요.` }));
  } else if (nx) out.push(h("p", { class: "muted tiny al-next", text: `다음 절기 미션: ${nx.e} ${nx.name} (${dStr(nx.a).slice(5).replace("-", "/")}부터) · 받는 스킨: ${nx.skin}` }));
  return out;
}
function albumSkins(c) {
  const p = S.profile || {};
  const wearing = (sk) => (sk.slot === "pet" ? Number.isInteger(p.pet) && p.pet >= 0 : p[sk.slot] === sk.v);
  const toggle = (sk) => {
    const prof = { ...p }, on = !wearing(sk);
    if (sk.slot === "pet") prof.pet = on ? (Number.isInteger(prof.petPick) ? prof.petPick : 0) : -1;
    else prof[sk.slot] = on ? sk.v : sk.slot === "badge" || sk.slot === "title" ? "" : "none";
    S.profile = prof; store.set("profile", prof); Object.assign(draft, prof); refreshMe(); renderMeChip(); renderAlbum();
    toast(on ? `${sk.e} ${sk.name} 착용!` : `${sk.e} ${sk.name}을(를) 벗었어요`);
  };
  const card = (sk) => {
    const open = skinOpen(sk, c), w = open && wearing(sk), years = sk.season ? c.won[sk.season] || [] : [];
    const sn = sk.season && SEASONS.find((x) => x.id === sk.season);
    let need = sk.need || "", bar = null;
    if (!sk.season && !open) { const [a, b] = sk.prog(c); bar = h("div", { class: "al-bar" }, h("i", { style: `width:${Math.min(100, (a / b) * 100)}%` })); need += ` · ${Math.min(a, b)}/${b}`; }
    if (sn) need = open ? `받은 해: ${years.join(", ")}` : `${sn.e} ${sn.name} 기간에 한정 미션을 다 하면 받아요`;
    return h("div", { class: "al-skin" + (open ? " open" : " locked") + (w ? " on" : "") },
      h("div", { class: "em", text: open ? sk.e : "🔒" }), h("b", { text: sk.name }), h("small", { text: need }), bar,
      open ? h("button", { class: "btn sm " + (w ? "ghost" : "primary"), text: w ? "벗기" : "착용하기", onclick: () => toggle(sk) }) : null);
  };
  const out = [h("p", { class: "muted tiny", text: "받은 스킨은 다른 사람 화면에도 보여요. 캐릭터 꾸미기(위쪽 내 이름)에서도 바꿀 수 있어요." }),
    h("div", { class: "board-label", text: "🎖 활동 스킨 · 받으면 평생" }), h("div", { class: "al-skins" }, ...SKINS.filter((k) => !k.season).map(card))];
  out.push(h("div", { class: "board-label", text: "🐾 고양이 산책" }), h("p", { class: "muted tiny", text: "고양이마다 성격이 달라요. 밥·특식·쓰다듬기로 친해지면, 밥을 줄 때마다 30분 같이 산책해요." }),
    h("button", { class: "btn primary", text: "🐾 고양이들과의 친밀도 보기", onclick: () => { closeModal("albumModal"); openCatFood(); } }));
  if (false) {
    out.push(h("div", { class: "board-label", text: "🐱 나를 따라올 고양이" }),
      h("div", { class: "chips" }, ...W.CATS.map((ct, i) => h("button", { class: "chip-btn" + ((Number.isInteger(p.petPick) ? p.petPick : 0) === i ? " sel" : ""), text: `${ct.name} ${ct.sex}`, onclick: () => { const prof = { ...S.profile, petPick: i }; if (Number.isInteger(prof.pet) && prof.pet >= 0) prof.pet = i; S.profile = prof; store.set("profile", prof); Object.assign(draft, prof); refreshMe(); renderAlbum(); } }))),
      h("p", { class: "muted tiny", text: petActive(c) ? "마당에서만 따라다녀요. 실내에 들어가면 마당에서 기다려요." : "😺 고양이가 콘도에서 쉬는 중이에요. 밥을 주면 다시 따라와요 (마지막 밥 7일 지남)." }));
  }
  out.push(h("div", { class: "board-label", text: "🗓 절기 한정 스킨 · 그때만 받을 수 있어요" }), h("div", { class: "al-skins" }, ...SKINS.filter((k) => k.season).map(card)));
  return out;
}
function albumRecord(c) {
  const t = c.t, tN = dIdx(nyDay()), start = tN - 34 - dow(tN - 34) ; // 5주 달력 (주일부터)
  const cal = h("div", { class: "al-cal" }, ...["주", "월", "화", "수", "목", "금", "토"].map((x) => h("span", { class: "hd", text: x })));
  for (let x = start; x <= tN + (6 - dow(tN)); x++) {
    const d = dStr(x), day = MS.log[d] || {};
    cal.append(h("span", { class: (day.stamp ? "st " : day.visit ? "v " : "") + (x === tN ? "today" : x > tN ? "fut" : ""), title: d, text: day.stamp ? "✅" : day.visit ? "🌱" : String(+d.slice(8)) }));
  }
  return [
    h("div", { class: "board-label", text: "🗓 최근 5주 (🌱 다녀간 날 · ✅ 미션 도장)" }), cal,
    h("div", { class: "al-stats" },
      ...[["🌱", t.visit, "다녀간 날"], ["✅", t.stamp, "미션 도장"], ["🙏", t.pray, "기도 (나만 봐요)"], ["📖", t.chaps, "읽은 장"], ["🐾", t.catfeed, "고양이 밥"], ["🧀", t.cookie, "만든 쿠키 박스"], ["🍡", t.give, "간식 나눔"], ["🧩", t.quiz, "퀴즈 판"]]
        .map(([e, n, l]) => h("div", { class: "stat" }, h("b", { text: `${e} ${Number(n).toLocaleString()}` }), h("span", { text: l })))),
    h("div", { class: "board-label", text: `📚 다 읽은 책 ${c.books.length}권` }),
    c.books.length ? h("div", { class: "chips" }, ...c.books.map((b) => h("span", { class: "chip", text: "📜 " + b.name }))) : h("p", { class: "muted tiny", text: "아직 없어요. 통독표에 체크하거나 본문을 읽으면 쌓여요. 한 권을 다 읽으면 📜 두루마리 성경을 받아요." }),
    MS.resolve ? h("p", { class: "al-resolve", text: `✍️ 나의 새해 다짐: ${MS.resolve}` }) : null,
    h("p", { class: "muted tiny", text: api.demo ? "데모 모드: 이 기기에만 저장돼요." : MS.noServer ? "⚠ 아직 서버 저장 준비 전이라 이 기기에만 저장돼요 (관리자: supabase-update-missions.sql)." : "기록은 서버에도 저장돼요. 같은 기기·같은 브라우저로 들어오면 이어져요." }),
    h("button", { class: "btn ghost wide", text: "📱 기록이 안 보이나요? 다른 기기와 연결해요", onclick: () => { closeModal("albumModal"); openLink(); } }),
  ];
}
// ---- 📸 나의 그루터기 카드 (공유용 그림): 내 캐릭터 + 다녀간 날·말씀·기도·활동 그래프 + 가진 아이템 ----
function albumCard(c) {
  const y = nyDay().slice(0, 4), Y = c.t.byYear[y] || {};
  const v = (k) => Number(Y[k] || 0);
  const act = v("quiz") + v("catfeed") + v("give") + v("jam");
  const rows = [["🌱", "다녀간 날", v("visit"), 100, "#7cc24a"], ["📖", "읽은 말씀 (장)", v("read"), 300, "#3a8fd9"], ["🙏", "기도", v("pray"), 100, "#e8862f"], ["🎯", "활동 (퀴즈·고양이 밥·나눔·연주)", act, 100, "#d9483b"], ["✅", "미션 도장", v("stamp"), 50, "#8e44ad"]];
  // 가진 아이템: 받은 스킨 + 만난 성경 인물
  const owned = SKINS.filter((k) => skinOpen(k, c)).map((k) => k.e + " " + k.name.replace(/\s*\(.*\)$/, ""));
  const dex = [...giftCollected().keys()].map((id) => COST()[id]).filter((x) => x && x.rare).map((x) => x.e + " " + x.who);
  const items = [...owned, ...dex];
  const holder = h("div", { class: "al-card-wrap" }, h("p", { class: "muted", text: "카드를 만드는 중이에요… 🎨" }));
  const look = { ...(S.profile || {}), ...mySkins() }, pal = look.costume === "daniel" || (Number.isInteger(look.pet) && look.pet >= 0);
  setTimeout(async () => {
    let charImg = null;
    try { const url = W.snapshot(look, pal ? 900 : 740, 900); charImg = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; }); } catch (e) { console.warn("캐릭터 사진:", e); }
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350; const g = cv.getContext("2d");
    // 게임 캐릭터 화면처럼: 흰 바탕 없이 밤하늘·숲 그라데이션 + 캐릭터 뒤 스포트라이트
    const grd = g.createLinearGradient(0, 0, 0, 1350); grd.addColorStop(0, "#1d2f52"); grd.addColorStop(0.55, "#2b4d58"); grd.addColorStop(1, "#24452f"); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
    const spot = g.createRadialGradient(380, 560, 40, 380, 560, 520); spot.addColorStop(0, "rgba(255,236,170,.55)"); spot.addColorStop(0.5, "rgba(255,220,140,.16)"); spot.addColorStop(1, "rgba(255,220,140,0)"); g.fillStyle = spot; g.fillRect(0, 0, 1080, 1350);
    let sd = 7; const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 70; i++) { const sx = rnd() * 1080, sy = rnd() * 760, r = 1 + rnd() * 2.6; g.fillStyle = `rgba(255,248,220,${0.25 + rnd() * 0.6})`; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill(); }
    const rr = (x, yy, w, hh, r, col) => { g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(x, yy, w, hh, r) : g.rect(x, yy, w, hh); g.fill(); };
    const rs = (x, yy, w, hh, r, col, lw) => { g.strokeStyle = col; g.lineWidth = lw || 2; g.beginPath(); g.roundRect ? g.roundRect(x, yy, w, hh, r) : g.rect(x, yy, w, hh); g.stroke(); };
    g.textAlign = "left"; g.fillStyle = "#f2d98a"; g.font = "700 30px 'Gowun Dodum', sans-serif"; g.fillText("퀸장그루터기 · " + y + " 나의 그루터기", 56, 76);
    // 발밑 빛나는 받침 (게임 캐릭터 선택 화면 느낌)
    const PX = pal ? 400 : 380, PYd = pal ? 905 : 925, PR = pal ? 340 : 250;
    const ped = g.createRadialGradient(PX, PYd, 10, PX, PYd, PR); ped.addColorStop(0, "rgba(255,240,180,.85)"); ped.addColorStop(0.6, "rgba(160,220,140,.35)"); ped.addColorStop(1, "rgba(160,220,140,0)");
    g.fillStyle = ped; g.beginPath(); g.ellipse(PX, PYd, PR, PR / 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,236,170,.8)"; g.lineWidth = 4; g.beginPath(); g.ellipse(PX, PYd, PR * 0.8, PR * 0.19, 0, 0, Math.PI * 2); g.stroke();
    // 캐릭터 (크게, 메인)
    if (charImg) { g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 30; g.drawImage(charImg, pal ? -40 : 10, pal ? 110 : 100, pal ? 900 : 740, 900); g.restore(); }
    // 레벨 배지 (미션 도장 기준)
    const stampN = Number(c.t.stamp || 0), lv = 1 + Math.floor(stampN / 5);
    rr(56, 106, 150, 64, 32, "rgba(0,0,0,.35)"); rs(56, 106, 150, 64, 32, "#f2c84b", 3);
    g.fillStyle = "#f2c84b"; g.font = "800 38px 'Gowun Dodum', sans-serif"; g.fillText("Lv." + lv, 82, 152);
    // 오른쪽: 아이템 칸 (작게)
    const IX = 790, IW = 250, list2 = items.slice(0, 27), PH = 110 + Math.max(1, Math.ceil(list2.length / 3)) * 92 + (items.length > list2.length ? 40 : 0);
    rr(IX - 18, 100, IW + 36, PH, 30, "rgba(0,0,0,.28)"); rs(IX - 18, 100, IW + 36, PH, 30, "rgba(242,217,138,.45)", 2);
    g.fillStyle = "#f2d98a"; g.font = "700 30px 'Gowun Dodum', sans-serif"; g.fillText(`🎒 아이템 ${items.length}`, IX, 152);
    const slot = 74, gap = 14;
    list2.forEach((it, i) => {
      const col = i % 3, row = Math.floor(i / 3), sx = IX + col * (slot + gap), sy = 180 + row * (slot + 18);
      rr(sx, sy, slot, slot, 16, "rgba(255,255,255,.12)"); rs(sx, sy, slot, slot, 16, "rgba(242,217,138,.55)", 2);
      const e = [...it][0] === "'" ? it : it.split(" ")[0];
      g.textAlign = "center"; g.fillStyle = "#fff"; g.font = "40px sans-serif"; g.fillText(e, sx + slot / 2, sy + 52);
      const nm = it.slice(e.length).trim().replace(/['"]/g, ""); g.fillStyle = "rgba(255,248,225,.85)"; g.font = "15px 'Gowun Dodum', sans-serif"; let nt = nm; while (nt.length > 1 && g.measureText(nt).width > slot + 10) nt = nt.slice(0, -1); g.fillText(nt === nm ? nm : nt.slice(0, -1) + "…", sx + slot / 2, sy + slot + 15);
      g.textAlign = "left";
    });
    if (!list2.length) { g.fillStyle = "rgba(255,248,225,.75)"; g.font = "24px 'Gowun Dodum', sans-serif"; g.fillText("미션으로 모아요 🌱", IX, 210); }
    if (items.length > list2.length) { g.fillStyle = "rgba(255,248,225,.75)"; g.font = "22px 'Gowun Dodum', sans-serif"; g.fillText(`+${items.length - list2.length}개 더`, IX, 100 + PH - 22); }
    // 이름표 (캐릭터 아래)
    const name = S.profile?.name || "익명", ttl = (S.profile && TITLE_TXT[mySkins().title]) || "";
    g.textAlign = "center"; g.fillStyle = "#fff8e4"; g.font = "800 62px 'Gowun Dodum', sans-serif"; g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 12; g.fillText(clip(name, 8), 380, 1052); g.restore();
    if (ttl) { g.font = "700 28px 'Gowun Dodum', sans-serif"; const tw = g.measureText(ttl).width + 44; rr(380 - tw / 2, 1068, tw, 46, 23, mySkins().title === "tree" ? "#f2c84b" : "rgba(255,241,196,.92)"); g.fillStyle = "#6b4510"; g.fillText(ttl, 380, 1100); }
    g.textAlign = "left";
    // 아래: 능력치 바 (게임 스탯처럼)
    const PY = 1130; rr(40, PY, 1000, 190, 26, "rgba(0,0,0,.32)");
    const meta = `🔥 최고 연속 ${c.st.best}일 · 📚 다 읽은 책 ${c.books.length}권 · 📖 성경 인물 ${dex.length}명`;
    g.fillStyle = "#f2d98a"; g.font = "700 24px 'Gowun Dodum', sans-serif"; g.fillText(meta, 64, PY + 36);
    rows.forEach(([e, l, n, goal, col], i) => {
      const cx = 64 + i * 196, yy = PY + 92, BW = 170, w = Math.max(8, Math.min(1, n / goal) * BW);
      g.fillStyle = "#fff8e4"; g.font = "700 24px 'Gowun Dodum', sans-serif"; g.fillText(`${e} ${l.split(" ")[0]}`, cx, yy);
      g.fillStyle = "#fff"; g.font = "800 40px 'Gowun Dodum', sans-serif"; g.fillText(Number(n).toLocaleString(), cx, yy + 46);
      rr(cx, yy + 62, BW, 14, 7, "rgba(255,255,255,.18)"); rr(cx, yy + 62, w, 14, 7, col);
    });
    g.textAlign = "right"; g.fillStyle = "rgba(255,248,225,.6)"; g.font = "20px 'Gowun Batang', serif"; g.fillText("거룩한 씨가 이 땅의 그루터기니라 · 사 6:13", 1030, 1342);
    const url = cv.toDataURL("image/png");
    const share = async () => {
      try { const blob = await (await fetch(url)).blob(), file = new File([blob], `나의그루터기-${y}.png`, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `${y} 나의 그루터기` }); else toast("이 브라우저는 바로 공유가 안 돼요. 저장한 뒤 카톡으로 보내 주세요");
      } catch (e) { if (e.name !== "AbortError") toast("공유하지 못했어요"); }
    };
    holder.replaceChildren(h("img", { class: "al-card", src: url, alt: "나의 그루터기 카드" }),
      h("div", { class: "modal-actions" }, h("a", { class: "btn primary", href: url, download: `나의그루터기-${y}.png`, text: "💾 그림으로 저장" }), h("button", { class: "btn ghost", text: "📤 공유하기", onclick: share })));
  }, 30);
  return [h("p", { class: "muted tiny", text: `${y}년 기록과 지금 내 캐릭터로 만든 카드예요. 저장해서 친구들에게 자랑해요 🌱` }), holder];
}

// ---- 🌱 오늘의 그루터기: 그날 처음 들어올 때 한 번 (미션·말씀 / 공지·모임 / 내 소식 / 광고 한 장) ----
let WC = { pages: [], i: 0 };
async function maybeWelcome() {
  if (store.get("wcDay", "") === nyDay() || !$("#entryModal").hidden) return;
  store.set("wcDay", nyDay());
  const pages = [], v = todayVerse(), list = todayMissions();
  pages.push(() => [h("div", { class: "wc-h", text: "🎯 오늘의 미션" }),
    h("ul", { class: "al-list" }, ...list.map((x) => h("li", { class: x.done ? "done" : "" }, h("span", { class: "mc-chk", text: x.done ? "✓" : x.e }), h("span", { class: "t" }, x.t, h("small", { text: x.how })), x.done ? h("b", { class: "ok", text: "완료" }) : h("button", { class: "btn ghost sm", text: "가기", onclick: () => { closeModal("welcomeModal"); x.go(); } })))),
    h("p", { class: "muted tiny", text: "3개를 다 하면 🎁 선물 상자가 열려요 (가끔 ✨ 성경 인물 착장!)" }),
    v ? h("div", { class: "wc-verse" }, h("p", { text: v.text }), h("small", { text: v.ref + " (개역한글)" })) : null]);
  let notes = [];
  try { notes = (await api.listNotices(null)).slice(0, 3); } catch (e) {}
  const ev = (EVENTS || []).filter((e) => new Date(e.ends_at) > Date.now()).slice(0, 3);
  if (notes.length || ev.length) pages.push(() => [h("div", { class: "wc-h", text: "📢 공지 · 다가오는 모임" }),
    notes.length ? h("ul", { class: "recent-list" }, ...notes.map((n) => h("li", {}, h("span", { class: "t", text: n.content }), h("small", { text: timeAgo(n.created_at) })))) : null,
    ev.length ? h("ul", { class: "recent-list" }, ...ev.map((e) => h("li", {}, h("span", { class: "t", text: "📅 " + e.title }), h("small", { text: new Date(e.starts_at).toLocaleString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }) })))) : null]);
  const c = skinCtx(), st = c.st, nextStreak = [5, 14, 30].find((n) => st.best < n), sn = seasonNow();
  pages.push(() => [h("div", { class: "wc-h", text: "🔥 내 소식" }),
    h("div", { class: "al-streak" }, h("div", {}, h("b", { text: `🔥 ${st.cur}일` }), h("span", { text: "연속 출석" })), h("div", {}, h("b", { text: `✅ ${c.t.stamp}개` }), h("span", { text: "미션 도장" })), h("div", {}, h("b", { text: `🎁 ${giftCollected().size}` }), h("span", { text: "모은 선물" }))),
    nextStreak ? h("p", { class: "wc-tip", text: `🌱 ${nextStreak - st.cur > 0 ? nextStreak - st.cur : 1}일만 더 오면 머리 위 새싹이 ${nextStreak === 5 ? "생겨요" : "자라요"}!` }) : null,
    stampNextEl(c), giftStatusEl(),
    sn ? h("p", { class: "wc-tip", text: `${sn.e} 지금은 ${sn.name} 한정 미션 기간이에요 → 받는 스킨: ${sn.skin}` }) : null]);
  const A = W.AD, showAd = dIdx(nyDay()) % 2 === 0 && A && A.img;
  pages.push(() => showAd
    ? [h("div", { class: "wc-h" }, "🧦 ", A.title, h("span", { class: "ad-tag", text: "광고" })), h("img", { class: "ad-img", src: A.img, alt: A.title }), h("p", { class: "muted", text: A.sub }), h("a", { class: "btn primary wide", href: A.url, target: "_blank", rel: "noopener", text: "🛒 보러 가기" })]
    : [h("div", { class: "wc-h" }, "🧀 Cheese Mellow Bites", h("span", { class: "ad-tag", text: "광고" })), h("img", { class: "show-poster", src: "cheese-mellow-poster.jpg", alt: "치즈멜로바이트" }), h("p", { class: "muted", text: `쫀득한 치즈 쿠키 · 200g $${CM_PRICE.s} · 450g $${CM_PRICE.l} · 수익금은 청년부 음료수 회비 🥤` }),
      h("div", { class: "modal-actions" }, h("button", { class: "btn primary", text: "🛒 주문하기", onclick: () => { closeModal("welcomeModal"); openOrder(); } }), h("button", { class: "btn ghost", text: "🚪 쇼룸 가기", onclick: () => { closeModal("welcomeModal"); goShowroom(false); } }))]);
  WC = { pages, i: 0 }; renderWelcome(); openModal("welcomeModal");
}
function renderWelcome() {
  const p = WC.pages[WC.i]; if (!p) return;
  $("#wcBody").replaceChildren(...p().filter(Boolean));
  $("#wcDots").replaceChildren(...WC.pages.map((_, i) => h("i", { class: i === WC.i ? "on" : "", onclick: () => { WC.i = i; renderWelcome(); } })));
  $("#wcPrev").disabled = WC.i === 0; $("#wcNext").textContent = WC.i === WC.pages.length - 1 ? "✓" : "›";
}
$("#wcPrev").onclick = () => { if (WC.i > 0) { WC.i--; renderWelcome(); } };
$("#wcNext").onclick = () => { if (WC.i < WC.pages.length - 1) { WC.i++; renderWelcome(); } else closeModal("welcomeModal"); };
$("#wcClose").onclick = () => closeModal("welcomeModal");
(() => { let sx = null; const el = $("#wcBody"); el.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true }); el.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) { if (dx < 0) $("#wcNext").click(); else $("#wcPrev").click(); } }); })();

$("#albumBtn").onclick = () => openAlbum();

/* ================= 🧀 치즈멜로바이트 쇼룸 · 쫀득쿠키 만들기 · 주문 (2026-11-17) ================= */
// 가격: 200g 한 박스 $8 · 450g 한 박스 $15 (바꾸면 supabase-update-missions.sql order_add 안의 숫자도 같이)
const CM_PRICE = { s: 8, l: 15 };
const CM_INGR = "Marshmallows, cheese crackers (enriched flour [wheat flour, niacin, reduced iron, vitamin B1 (thiamin mononitrate), vitamin B2 (riboflavin), folic acid], vegetable oil [soybean, palm, canola and/or sunflower with TBHQ for freshness], cheese made with skim milk [skim milk, whey protein, salt, cheese cultures, enzymes, annatto extract color], salt, paprika, yeast, paprika extract color, soy lecithin), cheddar cheese powder, butter (pasteurized cream, natural flavoring), skim milk powder.";
let cookieN = null;
async function loadCookie() {
  try { cookieN = await api.cookieCount(); W.setCookieCount(cookieN); } catch (e) { console.warn("쇼룸 숫자 (supabase-update-missions.sql 실행 여부 확인):", e.message); }
  if (!$("#showModal").hidden) renderShow();
  if (S.room === "showroom") renderShowPanel();
}
// 쇼룸 안으로 (마당에 있으면 문까지 걸어가고, 다른 방이면 바로 들어가요)
function goShowroom(play) {
  closeModal("albumModal"); closeModal("showModal");
  if (S.room === "showroom") { if (play) startCookie(); return; }
  if (S.room === "yard") { W.goDoor("showroom"); toast("🧀 치즈멜로바이트 쇼룸으로 들어가요"); }
  else joinRoom("showroom", S.room);
  if (play) { const t0 = Date.now(), wait = setInterval(() => { if (S.room === "showroom") { clearInterval(wait); setTimeout(startCookie, 600); } else if (Date.now() - t0 > 20000) clearInterval(wait); }, 400); }
}
function renderShowPanel() {
  const box = $("#showPanelBody"); if (!box) return;
  box.replaceChildren(
    h("img", { class: "show-poster", src: "cheese-mellow-poster.jpg", alt: "Cheese Mellow Bites" }),
    h("div", { class: "show-prices" },
      h("button", { class: "pc", onclick: () => openOrder("s") }, h("b", { text: "200g" }), h("span", { class: "won", text: `$${CM_PRICE.s}` }), h("small", { text: "눌러서 주문" })),
      h("button", { class: "pc", onclick: () => openOrder("l") }, h("b", { text: "450g" }), h("span", { class: "won", text: `$${CM_PRICE.l}` }), h("small", { text: "눌러서 주문" }))),
    h("p", { class: "truck-note", text: "🥤 수익금은 청년부 음료수 회비로 쓰여요" }),
    h("p", { class: "tiny-help", text: "왼쪽·뒤쪽 진열장 상자를 누르면 주문, 오른쪽 아일랜드 작업대를 누르면 쫀득쿠키를 만들어 봐요. 가운데 큰 치즈는 그냥 귀여워요 🧀" }),
    h("p", { class: "muted tiny", text: cookieN == null ? "" : `🧀 청년부가 게임에서 만든 박스: ${Number(cookieN).toLocaleString()}개` }),
    h("details", { class: "show-ingr" }, h("summary", { text: "재료 · 알레르기 (Ingredients)" }), h("p", { text: CM_INGR }), h("b", { text: "CONTAINS: WHEAT, MILK AND SOY." })));
}
function openShowroom() { renderShow(); openModal("showModal"); loadCookie(); }
function renderShow() {
  $("#showBody").replaceChildren(
    h("img", { class: "show-poster", src: "cheese-mellow-poster.jpg", alt: "Cheese Mellow Bites 포스터" }),
    h("p", { class: "show-sub", text: "쫀득쫀득 치즈 쿠키 · 마시멜로 + 체다치즈 가루 + 치즈 크래커로 직접 만들어요" }),
    h("div", { class: "show-prices" },
      h("div", { class: "pc" }, h("b", { text: "200g" }), h("span", { class: "won", text: `$${CM_PRICE.s}` }), h("small", { text: "한 박스" })),
      h("div", { class: "pc" }, h("b", { text: "450g" }), h("span", { class: "won", text: `$${CM_PRICE.l}` }), h("small", { text: "한 박스" }))),
    h("p", { class: "truck-note", text: "🥤 수익금은 청년부 음료수 회비로 쓰여요" }),
    h("div", { class: "truck-actions" },
      h("button", { class: "btn primary", text: "🛒 주문하기 (연락처 남기면 연락드려요)", onclick: () => { closeModal("showModal"); openOrder(); } }),
      h("button", { class: "btn ghost", text: S.room === "showroom" ? "🎮 쫀득쿠키 만들어 보기 (게임)" : "🚪 쇼룸 안으로 들어가기", onclick: () => (S.room === "showroom" ? (closeModal("showModal"), startCookie()) : goShowroom(false)) })),
    h("p", { class: "muted tiny", text: cookieN == null ? "" : `🧀 청년부가 게임에서 만든 박스: ${Number(cookieN).toLocaleString()}개` }),
    h("details", { class: "show-ingr" }, h("summary", { text: "재료 · 알레르기 (Ingredients)" }), h("p", { text: CM_INGR }), h("b", { text: "CONTAINS: WHEAT, MILK AND SOY." })));
}

// ---- 🎮 쫀득쿠키 만들기: 녹이기 → 가루 섞기 → 크래커 섞기 → 틀에 넣고 냉동 → 자르기 → 포장 ----
const CG_STEPS = ["🔥 마시멜로 녹이기", "🥛 탈지분유·체다 가루 섞기", "🍘 치즈 크래커 섞기", "🧊 틀에 넣고 냉동", "🔪 자르기", "🎀 포장하기"];
const CG = { step: 0, raf: 0 };
function startCookie() {
  if (S.room !== "showroom") { goShowroom(true); return; }
  const seat = ["CM-0", "CM-1", "CM-2", "CM-3"].find((id) => S.seat === id) || ["CM-0", "CM-1", "CM-2", "CM-3"].find((id) => W.seatFree(id));
  if (seat) { const st = W.room.seats[seat]; W.moveMe({ x: st.x, z: st.z, seat }); }
  S.cookieing = true; S.bubble = "🧀 쫀득쿠키 만드는 중!"; S.kind = "status"; S.amens = 0; refreshMe();
  Object.assign(CG, { step: 0, moving: false, melt: 0, burn: 0, milk: 0, ched: 0, mix: 0, crack: 0, mix2: 0, press: Array(9).fill(false), freeze: 0, freezing: false, cuts: [], err: [], size: "s", ribbon: "#d9483b", tag: true, done: false, t0: performance.now() });
  openModal("cmGameModal"); renderCG();
}
function stopCookie() {
  cancelAnimationFrame(CG.raf); CG.raf = 0; clearInterval(CG.ft);
  if (!S.cookieing) return; S.cookieing = false;
  if (S.bubble === "🧀 쫀득쿠키 만드는 중!") { S.bubble = ""; refreshMe(); }
  if (/^CM-/.test(S.seat || "")) W.stand();
}
// 단계 넘기기: 같은 단계에서 여러 번 불려도 한 번만 넘어가요 (빨리 톡톡 눌러도 단계를 건너뛰지 않게)
function cgNext(from) { if (CG.step !== from || CG.moving) return; CG.moving = true; setTimeout(() => { CG.moving = false; if (CG.step !== from) return; CG.step++; cancelAnimationFrame(CG.raf); CG.raf = 0; renderCG(); }, 450); }
// 동그랗게 문질러 섞기 (손가락·마우스로 원 그리기, 또는 버튼 톡톡)
function mixPad(el, key, onFull) {
  let last = null;
  const ang = (e) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); last = ang(e); });
  el.addEventListener("pointermove", (e) => {
    if (last == null || CG[key] >= 100) return; const a = ang(e); let d = a - last; d = Math.atan2(Math.sin(d), Math.cos(d)); last = a;
    CG[key] = Math.min(100, CG[key] + Math.abs(d) / (Math.PI * 2) * 30);
    el.style.setProperty("--swirl", CG[key] * 7.2 + "deg"); upd();
  });
  const end = () => (last = null); el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  let full = false;
  const upd = () => { const bar = $("#cgMixBar"); if (bar) bar.style.width = CG[key] + "%"; if (CG[key] >= 100 && !full) { full = true; last = null; onFull(); } };
  return () => { if (full) return; CG[key] = Math.min(100, CG[key] + 9); el.style.setProperty("--swirl", CG[key] * 7.2 + "deg"); upd(); };
}
function renderCG() {
  const st = CG.step, board = $("#cmBoard"), help = $("#cmHelp");
  $("#cmSteps").replaceChildren(...CG_STEPS.map((t, i) => h("span", { class: "cg-step" + (i < st ? " ok" : i === st ? " now" : ""), text: (i < st ? "✓ " : `${i + 1}. `) + t.split(" ").slice(1).join(" ") })));
  $("#cmTitle").textContent = st < 6 ? `${CG_STEPS[st]}` : "🎉 완성!";
  help.replaceChildren(); board.className = "cm-board s" + st;
  if (st === 0) { // 녹이기: 바늘이 초록 칸에 있을 때 젓기
    const pot = h("div", { class: "cg-pot" }, ...Array.from({ length: 9 }, (_, i) => h("i", { class: "mm", style: `left:${18 + (i % 3) * 26}%;top:${22 + Math.floor(i / 3) * 22}%` })));
    const gauge = h("div", { class: "cg-gauge" }, h("span", { class: "zone" }), h("b", { id: "cgNeedle" }));
    const melt = h("div", { class: "cg-bar" }, h("i", { id: "cgMelt" }));
    board.replaceChildren(pot, gauge, melt);
    help.replaceChildren(h("button", { class: "btn primary", text: "🥄 저어요!", onclick: () => {
      if (CG.melt >= 100) return;
      const pos = CG.needle || 0, good = Math.abs(pos - 50) < 14;
      if (good) { CG.melt = Math.min(100, CG.melt + 20); floatCG("녹는다~ 🤍"); } else { CG.melt = Math.min(100, CG.melt + 6); CG.burn++; floatCG(pos > 50 ? "앗 뜨거워! 🔥" : "아직 덜 녹았어요"); }
      $("#cgMelt").style.width = CG.melt + "%"; $$(".cg-pot .mm").forEach((m) => (m.style.transform = `scale(${1 - CG.melt / 130})`));
      if (CG.melt >= 100 && CG.step === 0 && !CG.moving) { toast("🤍 마시멜로가 다 녹았어요!"); cgNext(0); }
    } }), h("span", { class: "muted tiny", text: "바늘이 초록 칸에 올 때 누르면 잘 녹아요 (빨간 칸은 너무 뜨거워요)" }));
    const loop = (t) => { CG.needle = 50 + Math.sin(t / 420) * 48; const n = $("#cgNeedle"); if (n) n.style.left = CG.needle + "%"; CG.raf = requestAnimationFrame(loop); };
    CG.raf = requestAnimationFrame(loop);
  } else if (st === 1 || st === 2) { // 가루 / 크래커 넣고 섞기
    const key = st === 1 ? "mix" : "mix2", ready = st === 1 ? CG.milk >= 3 && CG.ched >= 3 : CG.crack >= 6;
    const bowl = h("div", { class: "cg-bowl" + (st === 2 ? " ched" : "") });
    bowl.style.setProperty("--y", st === 1 ? Math.min(1, CG.ched / 3) : 1);
    if (st === 2) for (let i = 0; i < CG.crack * 3; i++) bowl.append(h("i", { class: "cr", style: `left:${15 + ((i * 37) % 70)}%;top:${20 + ((i * 53) % 60)}%;transform:rotate(${i * 40}deg)` }));
    if (st === 1) for (let i = 0; i < CG.milk + CG.ched; i++) bowl.append(h("i", { class: "pw" + (i % 2 ? " c" : ""), style: `left:${25 + ((i * 29) % 50)}%;top:${25 + ((i * 41) % 45)}%` }));
    board.replaceChildren(bowl, h("div", { class: "cg-bar" }, h("i", { id: "cgMixBar", style: `width:${CG[key]}%` })));
    if (!ready) {
      help.replaceChildren(...(st === 1 ? [
        h("button", { class: "btn ghost", text: `🥛 탈지분유 한 스푼 (${CG.milk}/3)`, disabled: CG.milk >= 3 || null, onclick: () => { CG.milk++; renderCG(); } }),
        h("button", { class: "btn ghost", text: `🧀 체다치즈 가루 한 스푼 (${CG.ched}/3)`, disabled: CG.ched >= 3 || null, onclick: () => { CG.ched++; renderCG(); } })]
        : [h("button", { class: "btn ghost", text: `🍘 치즈 크래커 한 줌 넣기 (${CG.crack}/6)`, onclick: () => { CG.crack++; renderCG(); } })]),
        h("span", { class: "muted tiny", text: st === 1 ? "녹인 마시멜로에 가루를 3스푼씩 넣어요" : "크래커를 6줌 넣어요" }));
    } else {
      const tap = mixPad(bowl, key, () => { toast(st === 1 ? "🧀 노랗게 잘 섞였어요!" : "🍘 크래커가 골고루 섞였어요!"); cgNext(st); });
      help.replaceChildren(h("button", { class: "btn primary", text: "🥄 섞기", onclick: tap }), h("span", { class: "muted tiny", text: "그릇 위에서 손가락(마우스)으로 동그라미를 그리면 더 빨리 섞여요" }));
    }
  } else if (st === 3) { // 틀에 넣고 꾹꾹 → 냉동
    const all = CG.press.every(Boolean);
    const mold = h("div", { class: "cg-mold" + (CG.freezing || CG.freeze >= 100 ? " frozen" : "") }, ...CG.press.map((p, i) => h("button", { class: "cell" + (p ? " on" : ""), text: p ? "" : "꾹", onclick: () => { if (CG.freezing) return; CG.press[i] = true; renderCG(); } })));
    board.replaceChildren(mold, h("div", { class: "cg-bar ice" }, h("i", { id: "cgFreeze", style: `width:${CG.freeze}%` })));
    if (!all) help.replaceChildren(h("button", { class: "btn ghost", text: "👐 한번에 꾹꾹 누르기", onclick: () => { CG.press.fill(true); renderCG(); } }), h("span", { class: "muted tiny", text: "네모난 틀에 반죽을 담고 칸마다 꾹꾹 눌러 평평하게 해요" }));
    else if (!CG.freezing) help.replaceChildren(h("button", { class: "btn primary", text: "❄️ 냉동실에 넣기", onclick: () => {
      CG.freezing = true; renderCG();
      CG.ft = setInterval(() => { CG.freeze = Math.min(100, CG.freeze + 4); const f = $("#cgFreeze"); if (f) f.style.width = CG.freeze + "%"; if (CG.freeze >= 100) { clearInterval(CG.ft); toast("🧊 단단하게 굳었어요!"); cgNext(3); } }, 120);
    } }));
    else help.replaceChildren(h("span", { class: "muted", text: "❄️ 꽁꽁 굳히는 중…" }));
  } else if (st === 4) { // 자르기: 움직이는 칼이 점선에 왔을 때
    const vert = CG.cuts.length < 3, guides = [25, 50, 75];
    const blk = h("div", { class: "cg-block" },
      ...guides.map((g) => h("i", { class: "guide " + (vert ? "v" : "h"), style: vert ? `left:${g}%` : `top:${g}%` })),
      ...CG.cuts.map((c, i) => h("i", { class: "cut " + (i < 3 ? "v" : "h"), style: i < 3 ? `left:${c}%` : `top:${c}%` })),
      h("b", { id: "cgKnife", class: "knife " + (vert ? "v" : "h") }));
    board.replaceChildren(blk);
    help.replaceChildren(h("button", { class: "btn primary", text: `🔪 자르기 (${CG.cuts.length}/6)`, onclick: () => {
      if (CG.cuts.length >= 6) return;
      const pos = CG.knife, used = vert ? CG.cuts.slice(0, 3) : CG.cuts.slice(3), left = guides.filter((g) => !used.some((u) => Math.abs(u - g) < 12.5));
      const near = left.reduce((a, g) => (Math.abs(g - pos) < Math.abs(a - pos) ? g : a), left[0] ?? 50), err = Math.abs(near - pos);
      CG.cuts.push(pos); CG.err.push(err); floatCG(err < 3 ? "반듯! ✨" : err < 7 ? "좋아요 👍" : "앗 비뚤 😅");
      if (CG.cuts.length >= 6) { toast("🔪 16조각으로 예쁘게 잘랐어요!"); cgNext(4); } else renderCG();
    } }), h("span", { class: "muted tiny", text: vert ? "칼이 점선 위에 왔을 때 눌러요 (세로 3번)" : "이번엔 가로로 3번!" }));
    const loop = (t) => { CG.knife = 50 + Math.sin(t / 520) * 46; const k = $("#cgKnife"); if (k) { if (vert) k.style.left = CG.knife + "%"; else k.style.top = CG.knife + "%"; } CG.raf = requestAnimationFrame(loop); };
    CG.raf = requestAnimationFrame(loop);
  } else if (st === 5) { // 포장
    const pkg = h("div", { class: "cg-pkg " + CG.size }, h("div", { class: "lid", style: `--rb:${CG.ribbon}` }, h("span", { text: "Cheese Mellow Bites" })), CG.tag ? h("em", { class: "tag", text: "Happy Holidays ✨" }) : null, h("small", { text: CG.size === "s" ? "200g" : "450g" }));
    board.replaceChildren(pkg);
    help.replaceChildren(
      h("div", { class: "chips" }, ...[["s", "📦 200g 박스"], ["l", "📦 450g 큰 박스"]].map(([v, t]) => h("button", { class: "chip-btn" + (CG.size === v ? " sel" : ""), text: t, onclick: () => { CG.size = v; renderCG(); } }))),
      h("div", { class: "chips" }, ...[["#d9483b", "빨강 리본"], ["#f2b632", "골드 리본"], ["#fff4dc", "크림 리본"]].map(([v, t]) => h("button", { class: "chip-btn" + (CG.ribbon === v ? " sel" : ""), text: "🎀 " + t, onclick: () => { CG.ribbon = v; renderCG(); } })),
        h("button", { class: "chip-btn" + (CG.tag ? " sel" : ""), text: "🏷 Happy Holidays 태그", onclick: () => { CG.tag = !CG.tag; renderCG(); } })),
      h("button", { class: "btn primary", text: "🎀 포장 완료!", onclick: cgFinish }));
  } else { // 결과
    const avg = CG.err.reduce((a, b) => a + b, 0) / Math.max(1, CG.err.length), stars = Math.max(1, 3 - (CG.burn >= 3 ? 1 : 0) - (avg > 6 ? 1 : 0));
    board.replaceChildren(h("div", { class: "cook-result" }, h("div", { class: "big", text: "🧀🎁" }), h("b", { text: `${"⭐".repeat(stars)}${"☆".repeat(3 - stars)} 쫀득쿠키 한 박스 완성!` }),
      h("p", { text: (CG.burn >= 3 ? "살짝 탔지만 " : "") + (avg > 6 ? "모양은 개성 있게! " : "반듯하게 잘랐어요! ") + (cookieN != null ? `지금까지 청년부가 ${Number(cookieN).toLocaleString()}박스 만들었어요.` : "") })));
    help.replaceChildren(
      h("button", { class: "btn primary", text: "🧀 하나 들고 나가기", onclick: () => { closeModal("cmGameModal"); setCarry("cheesebite", "🧀 치즈멜로바이트를 들었어요! 먹거나 친구에게 줄 수 있어요"); } }),
      h("button", { class: "btn ghost", text: "🎁 진열장에 두기 (친구들 몫)", onclick: () => { closeModal("cmGameModal"); mAdd("give"); toast("🎁 진열장에 예쁘게 두었어요. 나눔 완료 💛"); } }),
      h("button", { class: "btn ghost", text: "🔁 한 번 더", onclick: startCookie }),
      h("button", { class: "btn ghost", text: "🛒 진짜로 주문하기", onclick: () => { closeModal("cmGameModal"); openOrder(); } }));
  }
}
function floatCG(t) { const b = $("#cmBoard"); if (!b) return; const f = h("div", { class: "cg-float", text: t }); b.append(f); setTimeout(() => f.remove(), 900); }
async function cgFinish() {
  if (CG.done) return; CG.done = true;
  try { cookieN = await api.cookieMake(); W.setCookieCount(cookieN); }
  catch (e) { CG.done = false; toast(e.message); return; }
  mAdd("cookie");
  CG.step = 6; renderCG(); confetti();
}

// ---- 🛒 주문서 ----
const ORD = { s: 1, l: 0, pickup: "church" };
function openOrder(size) {
  const p = S.profile || {};
  if (!$("#ordName").value) $("#ordName").value = p.name || "";
  $("#ordContact").value = $("#ordContact").value || store.get("ordContact", "");
  ORD.s = size === "l" ? 0 : 1; ORD.l = size === "l" ? 1 : 0; renderOrder(); $("#ordForm").hidden = false; $("#ordDone").hidden = true;
  openModal("orderModal");
}
function renderOrder() {
  $("#ordS").textContent = ORD.s; $("#ordL").textContent = ORD.l;
  $("#ordTotal").textContent = `$${ORD.s * CM_PRICE.s + ORD.l * CM_PRICE.l}`;
  $$("[name=ordPickup]").forEach((r) => (r.checked = r.value === ORD.pickup));
}
$$("[data-ord]").forEach((b) => (b.onclick = () => { const [k, d] = b.dataset.ord.split(":"); ORD[k] = Math.max(0, Math.min(20, ORD[k] + Number(d))); renderOrder(); }));
$$("[name=ordPickup]").forEach((r) => (r.onchange = () => (ORD.pickup = r.value)));
$("#ordSend").onclick = async () => {
  const name = $("#ordName").value.trim(), contact = $("#ordContact").value.trim(), memo = $("#ordMemo").value.trim();
  if (!name) { toast("이름을 적어 주세요"); return; }
  if (contact.length < 3) { toast("연락받을 전화번호나 카톡 아이디를 적어 주세요"); return; }
  if (ORD.s + ORD.l < 1) { toast("한 박스 이상 골라 주세요"); return; }
  if (!checkText(name + " " + memo)) return;
  const btn = $("#ordSend"); btn.disabled = true;
  try {
    const id = await api.orderAdd({ name: clip(name, 20), contact: clip(contact, 60), qty_s: ORD.s, qty_l: ORD.l, pickup: ORD.pickup, memo: clip(memo, 200) });
    store.set("ordContact", contact);
    if (!api.demo && id) api.notify({ type: "order", id: Number(id) });
    $("#ordForm").hidden = true; $("#ordDone").hidden = false;
    $("#ordDoneTxt").textContent = `${[ORD.s ? `200g ${ORD.s}박스` : "", ORD.l ? `450g ${ORD.l}박스` : ""].filter(Boolean).join(" · ")} · 합계 $${ORD.s * CM_PRICE.s + ORD.l * CM_PRICE.l}`;
    $("#ordMemo").value = ""; confetti();
  } catch (e) { toast(e.message); }
  btn.disabled = false;
};

// ---- ⚙️ 관리자: 주문 목록 (전체 관리자만) ----
const ORD_ST = { new: ["🆕", "새 주문"], contacted: ["📞", "연락함"], done: ["✅", "완료"], canceled: ["✕", "취소"] };
let ordFilter = "open", ordList = [];
async function loadOrders() {
  if (!isAll()) return;
  try { ordList = await api.adminOrders(S.admin); } catch (e) { $("#adminOrderList").replaceChildren(h("li", {}, h("span", { class: "t", text: e.message }))); return; }
  renderOrders();
}
function renderOrders() {
  const open = ordList.filter((o) => o.status === "new" || o.status === "contacted");
  const sumS = open.reduce((a, o) => a + o.qty_s, 0), sumL = open.reduce((a, o) => a + o.qty_l, 0);
  $("#orderSum").textContent = open.length ? `진행 중 ${open.length}건 · 200g ${sumS}박스 · 450g ${sumL}박스 · $${open.reduce((a, o) => a + o.total, 0)}` : "진행 중인 주문이 없어요";
  $("#orderFilter").replaceChildren(...[["open", "진행 중"], ["all", "전체"]].map(([v, t]) => h("button", { class: "chip-btn" + (ordFilter === v ? " sel" : ""), text: t, onclick: () => { ordFilter = v; renderOrders(); } })),
    h("button", { class: "chip-btn", text: "↻ 새로고침", onclick: loadOrders }));
  const list = ordFilter === "open" ? open : ordList;
  const tel = (c) => { const d = c.replace(/[^\d+]/g, ""); return d.length >= 7 && /^[\d\s+()-]+$/.test(c) ? d : null; };
  $("#adminOrderList").replaceChildren(...(list.length ? list.map((o) => {
    const t = tel(o.contact), [em, stn] = ORD_ST[o.status] || ["", o.status];
    const set = (st) => adminOrderDo(() => api.adminOrderStatus(S.admin, o.id, st));
    return h("li", { class: "order-item st-" + o.status },
      h("div", { class: "oi-top" }, h("b", { text: `${em} ${o.name}` }), h("span", { class: "chip", text: stn }), h("small", { text: timeAgo(o.created_at) })),
      h("div", { class: "oi-qty", text: `${o.qty_s ? `200g × ${o.qty_s}` : ""}${o.qty_s && o.qty_l ? " · " : ""}${o.qty_l ? `450g × ${o.qty_l}` : ""} = $${o.total} · ${o.pickup === "contact" ? "📞 연락해서 정하기" : "⛪ 주일 교회 픽업"}` }),
      h("div", { class: "oi-contact" }, "연락처: ", t ? h("a", { href: "tel:" + t, text: o.contact }) : h("span", { text: o.contact }),
        t ? h("a", { class: "btn ghost sm", href: `sms:${t}`, text: "💬 문자" }) : null,
        h("button", { class: "btn ghost sm", text: "복사", onclick: () => navigator.clipboard && navigator.clipboard.writeText(o.contact).then(() => toast("연락처를 복사했어요")) })),
      o.memo ? h("div", { class: "oi-memo", text: "메모: " + o.memo }) : null,
      h("div", { class: "oi-act" },
        o.status !== "contacted" ? h("button", { class: "btn ghost sm", text: "📞 연락함", onclick: () => set("contacted") }) : null,
        o.status !== "done" ? h("button", { class: "btn primary sm", text: "✅ 완료", onclick: () => set("done") }) : null,
        o.status !== "canceled" ? h("button", { class: "btn ghost sm", text: "취소", onclick: () => set("canceled") }) : h("button", { class: "btn ghost sm", text: "되돌리기", onclick: () => set("new") }),
        h("button", { class: "btn danger sm", text: "삭제", onclick: () => { if (confirmOnce("del" + o.id)) adminOrderDo(() => api.adminOrderDelete(S.admin, o.id)); } })));
  }) : [h("li", {}, h("span", { class: "t", text: ordFilter === "open" ? "진행 중인 주문이 없어요 🙂" : "아직 주문이 없어요" }))]));
}
let confirmKey = "", confirmT = 0;
function confirmOnce(key) { if (confirmKey === key && Date.now() - confirmT < 4000) { confirmKey = ""; return true; } confirmKey = key; confirmT = Date.now(); toast("한 번 더 누르면 지워져요"); return false; }
async function adminOrderDo(fn) { try { await fn(); await loadOrders(); } catch (e) { toast(e.message); } }
// 📱 이 기기로 주문 알림 받기
async function orderPushState(on) {
  const el = $("#orderPushState");
  if (api.demo) { el.textContent = "데모 모드에서는 알림을 쓸 수 없어요"; return; }
  try {
    const st = await pushSub().catch(() => null), ep = st && st.sub ? st.sub.endpoint : null;
    if (on != null && !ep) { toast("먼저 위쪽 🔔 알림을 이 기기에서 켜 주세요"); openNotify(); return; }
    const n = await api.pushOrderSet(S.admin, on == null ? null : ep, on);
    if (on != null) store.set("orderPushOn", !!on);
    const mine = store.get("orderPushOn", false) && !!ep;
    el.textContent = `${mine ? "✅ 이 기기로 받고 있어요" : "이 기기는 안 받아요"} · 받는 기기 ${n}대`;
    $("#orderPushBtn").textContent = mine ? "🔕 이 기기 주문 알림 끄기" : "📱 이 기기로 주문 알림 받기";
    $("#orderPushBtn").onclick = () => orderPushState(!mine);
  } catch (e) { el.textContent = e.message; }
}
$("#orderPushBtn").onclick = () => orderPushState(true);
// 🧦 트리 앞 광고판: 눌러서 확인 → 새 창으로 쇼핑몰 열기
function openAd() {
  const A = W.AD;
  $("#adBody").replaceChildren(A.img ? h("img", { class: "ad-img", src: A.img, alt: A.title }) : null, h("p", { class: "muted", text: A.sub }),
    h("div", { class: "modal-actions" }, h("a", { class: "btn primary", href: A.url, target: "_blank", rel: "noopener", text: "🛒 보러 가기", onclick: () => closeModal("adModal") }), h("button", { class: "btn ghost", text: "닫기", "data-close": "adModal" })),
    h("p", { class: "muted tiny", text: "새 창(탭)에서 열려요. 그루터기는 그대로 있어요." }));
  $("#adTitle").textContent = "🧦 " + A.title;
  openModal("adModal");
}
$$("[data-go-show]").forEach((b) => (b.onclick = () => goShowroom(false)));
$$("[data-order-open]").forEach((b) => (b.onclick = () => openOrder()));
$$("[data-cookie-play]").forEach((b) => (b.onclick = () => startCookie()));

/* ================= ⛸ 그루터기 스케이트장 (2026-11-18) ================= */
// 얼음 위에 서면 아래에 스케이트 막대가 나와요. 🏁 스피드 경주(2바퀴) · 피겨 기술. 서버 저장 없이 실시간 방송("sport" k:"skstart") + 내 상태(skr, fig)만 써요
var SK = { race: null, tick: null, lastSend: 0, best: store.get("skBest", null), barKey: "", prog: null, ptick: null, rankTab: "figure" };
const RACE_LAPS = 2;
function onIceMe() { const a = S.room === "yard" && W.actorPos(myId); return !!a && W.onIce(a.x, a.z); }
function goRink() {
  closeModal("albumModal");
  const go = () => { W.walkTo(W.RINK.cx, W.RINK.cz + W.RINK.b - 2); toast("⛸ 스케이트장으로 가요"); };
  if (S.room !== "yard") { joinRoom("yard", S.room); setTimeout(go, 700); } else go();
}
function skState() { return SK.race ? { t0: SK.race.t0, p: +SK.race.p.toFixed(3), v: +SK.race.v.toFixed(2), lane: SK.race.lane, done: SK.race.done || 0 } : null; }
function skSend(force) { const now = Date.now(); if (!force && now - SK.lastSend < 250) return; SK.lastSend = now; S.peers = S.peers.filter((p) => p.id !== myId).concat(meState()); api.update(meState()); }
// 🏁 경주 시작: 지금 얼음 위에 있는 사람 모두가 참가 (6초 뒤 출발 — 그동안 방법 설명이 떠요)
function skStartRace() {
  if (SK.race) return;
  const ids = S.peers.filter((p) => { const a = W.actorPos(p.id); return a && W.onIce(a.x, a.z) && !p.skr; }).map((p) => p.id).slice(0, 4);
  if (!ids.includes(myId)) ids.unshift(myId);
  const m = { k: "skstart", t0: Date.now() + 6000, ids, by: myId, name: clip(S.profile?.name, LIMIT.name) || "익명" };
  api.sendSport(m); onSkStart(m);
}
function onSkStart(m) {
  if (!Array.isArray(m.ids) || !Number.isFinite(m.t0)) return;
  const lane = m.ids.indexOf(myId);
  if (lane < 0) { if (onIceMe()) toast(`🏁 ${clip(m.name, 10)}님이 스피드 경주를 시작해요! 구경해요 👀`); return; }
  if (SK.race) return;
  if (SK.prog) figAbort("경주가 시작돼서 연기를 멈췄어요");
  S.seat = null; S.dance = null; S.fig = null;
  SK.race = { t0: m.t0, lane: Math.min(3, lane), p: 0, v: 0, foot: null, done: 0, ids: m.ids, ended: false };
  W.raceMe = skState(); W.keyBlock = true;
  skHelpShow(m.t0);
  setTimeout(() => SK.race && toast("출발! ⏪⏩ 왼발·오른발을 번갈아 눌러요 (← → 키도 돼요)"), Math.max(0, m.t0 - Date.now()));
  clearInterval(SK.tick); let last = performance.now();
  SK.tick = setInterval(() => {
    const R = SK.race; if (!R) { clearInterval(SK.tick); return; }
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (Date.now() >= R.t0 && !R.done) {
      R.v *= Math.exp(-0.55 * dt);
      R.p += (R.v * dt) / W.rinkLapLen(R.lane);
      if (R.p >= RACE_LAPS) { R.p = RACE_LAPS; R.done = Date.now(); R.v = 0; const sec = (R.done - R.t0) / 1000; const pb = !SK.best || sec < SK.best; if (pb) { SK.best = sec; store.set("skBest", sec); } toast(`🏁 결승! ${sec.toFixed(2)}초${pb ? " · 🎉 내 최고 기록!" : ""}`); S.bubble = `⛸ ${RACE_LAPS}바퀴 ${sec.toFixed(1)}초!`; S.kind = "status"; S.amens = 0; skSend(true);
        api.rinkScoreAdd("speed", Math.round(sec * 100) / 100, "").then((r) => { if (r && r.new) toast(`🏆 스피드 랭킹 ${r.rank}등!`); loadRinkTop(); }).catch((e) => console.warn("스피드 기록:", e.message)); }
    }
    W.raceMe = skState(); skSend(false); renderSkateBar();
    // 모두 들어오거나 90초가 지나면 결과 발표 후 끝
    const racers = S.peers.filter((p) => R.ids.includes(p.id)), others = racers.filter((p) => p.id !== myId);
    const allDone = R.done && others.every((p) => p.skr && p.skr.t0 === R.t0 && p.skr.done);
    if (!R.ended && R.done && (allDone || Date.now() - R.t0 > 90000 || Date.now() - R.done > 25000)) { R.ended = true; skResults(); }
  }, 50);
  renderSkateBar(true);
}
function skPush(foot) {
  const R = SK.race; if (!R || R.done || Date.now() < R.t0) return;
  R.v = Math.min(12, R.v + (R.foot && R.foot !== foot ? 1.1 : 0.25)); R.foot = foot;
  const b = $(`#skateBar [data-foot="${foot}"]`); if (b) { b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 90); }
}
function skResults() {
  const R = SK.race; if (!R) return;
  const rows = S.peers.filter((p) => R.ids.includes(p.id)).map((p) => { const st = p.id === myId ? skState() : p.skr; return { name: (clip(p.name, LIMIT.name) || "익명") + (p.id === myId ? " (나)" : ""), sec: st && st.t0 === R.t0 && st.done ? (st.done - R.t0) / 1000 : null, p: st ? st.p : 0 }; })
    .sort((a, b) => (a.sec ?? 1e9) - (b.sec ?? 1e9) || b.p - a.p);
  const medal = ["🥇", "🥈", "🥉", "4️⃣"];
  toast("🏁 결과 · " + rows.map((r, i) => `${medal[i] || ""} ${r.name} ${r.sec ? r.sec.toFixed(1) + "초" : "완주 못함"}`).join("  "));
  setTimeout(skEnd, 4000);
}
function skEnd() {
  const R = SK.race; if (!R) return;
  const q = W.rinkRacePos(R.p, R.lane);
  SK.race = null; W.raceMe = null; W.keyBlock = false; clearInterval(SK.tick);
  S.pos = { x: +q.x.toFixed(2), z: +q.z.toFixed(2) }; S.seat = null; W.placeMe(S.pos.x, S.pos.z);
  refreshMe(); renderSkateBar(true);
}
/* ---- 🩰 피겨 연기: 음악 고르기 · 박자 점수 · 관중 박수 · 랭킹 (2026-11-18) ----
   곡은 모두 저작권이 끝난 곡을 사이트가 직접 연주해요 (파일 없음). 박자에 맞춰 기술을 누르면 가산점 */
const FIG_SONGS = [
  { id: "silent", e: "🌙", name: "고요한 밤", feel: "잔잔한 왈츠", style: "68", bpm: 168, pulse: 3, passes: 2, off: 0,
    mel: [[67, 1.5], [69, .5], [67, 1], [64, 3], [67, 1.5], [69, .5], [67, 1], [64, 3], [74, 2], [74, 1], [71, 3], [72, 2], [72, 1], [67, 3],
      [69, 2], [69, 1], [72, 1.5], [71, .5], [69, 1], [67, 1.5], [69, .5], [67, 1], [64, 3], [69, 2], [69, 1], [72, 1.5], [71, .5], [69, 1], [67, 1.5], [69, .5], [67, 1], [64, 3],
      [74, 2], [74, 1], [77, 1.5], [74, .5], [71, 1], [72, 3], [76, 3], [72, 1.5], [67, .5], [64, 1], [67, 1.5], [65, .5], [62, 1], [60, 6]],
    chords: [["C", 6], ["C", 6], ["G7", 6], ["C", 6], ["F", 6], ["C", 6], ["F", 6], ["C", 6], ["G7", 6], ["C", 6], ["C", 3], ["G7", 3], ["C", 6]] },
  { id: "grace", e: "🕊", name: "나 같은 죄인 살리신", feel: "따뜻한 3박자", style: "waltz", bpm: 100, pulse: 1, passes: 2, off: 1,
    mel: [[62, 1], [67, 2], [71, .5], [67, .5], [71, 2], [69, 1], [67, 2], [64, 1], [62, 2], [62, 1], [67, 2], [71, .5], [67, .5], [71, 2], [69, 1], [74, 3],
      [74, 2], [71, 1], [74, 2], [71, .5], [67, .5], [71, 2], [69, 1], [67, 2], [64, 1], [62, 2], [62, 1], [67, 2], [71, .5], [67, .5], [71, 2], [69, 1], [67, 3], [67, 2]],
    chords: [["G", 3], ["Em", 3], ["C", 3], ["G", 3], ["G", 3], ["Em", 1.5], ["A7", 1.5], ["Am", 3], ["D7", 3], ["Bm", 3], ["Em", 3], ["C", 3], ["Bm", 1.5], ["E7", 1.5], ["Am", 3], ["D7", 3], ["G", 3], ["G", 2]] },
  { id: "joy", e: "🎺", name: "기뻐하며 경배하세", feel: "힘찬 4박자 (베토벤)", style: "march", bpm: 112, pulse: 1, passes: 2, off: 0,
    mel: [[76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1], [76, 1.5], [74, .5], [74, 2],
      [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1], [74, 1.5], [72, .5], [72, 2],
      [74, 1], [74, 1], [76, 1], [72, 1], [74, 1], [76, .5], [77, .5], [76, 1], [72, 1], [74, 1], [76, .5], [77, .5], [76, 1], [74, 1], [72, 1], [74, 1], [67, 2],
      [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1], [74, 1.5], [72, .5], [72, 2]],
    chords: [["C", 4], ["Dm", 2], ["G7", 2], ["C", 2], ["Am", 2], ["Dm", 2], ["G7", 2], ["C", 4], ["Dm", 2], ["G7", 2], ["C", 2], ["Am", 2], ["Dm", 2], ["C", 2],
      ["Dm", 4], ["Em", 2], ["A7", 2], ["Dm", 2], ["G7", 2], ["C", 2], ["G7", 2], ["C", 4], ["Dm", 2], ["G7", 2], ["Em", 2], ["A7", 2], ["Dm", 2], ["C", 2]] },
  { id: "jingle", e: "🔔", name: "징글벨", feel: "신나는 썰매 리듬", style: "jingle", bpm: 132, pulse: 1, passes: 2, off: 0,
    mel: [[76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, .5], [76, 4], [77, 1], [77, 1], [77, 1.5], [77, .5], [77, 1], [76, 1], [76, 1], [76, .5], [76, .5],
      [76, 1], [74, 1], [74, 1], [76, 1], [74, 2], [79, 2], [76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, .5], [76, 4],
      [77, 1], [77, 1], [77, 1.5], [77, .5], [77, 1], [76, 1], [76, 1], [76, .5], [76, .5], [79, 1], [79, 1], [77, 1], [74, 1], [72, 4]],
    chords: [["C", 4], ["C", 4], ["C", 4], ["C", 4], ["F", 4], ["C", 4], ["D7", 4], ["G7", 4], ["C", 4], ["C", 4], ["C", 4], ["C", 4], ["F", 4], ["C", 4], ["G7", 4], ["C", 4]] },
];
const FIG_EL = { spin: 1.5, spiral: 1.8, camel: 2.0, layback: 2.4, axel: 3.3, triple: 8.0 }; // 기본 점수
const FIG_MAX_EL = 12;
// 음악 연주기: 곡 하나를 미리 계산한 음표 목록으로 조금씩 앞서 예약해서 틀어요
const SkMusic = {
  cur: null,
  chordNotes(name) {
    const m = /^([A-G])([b#]?)(maj7|m7|m|7)?$/.exec(name) || [, "C", "", ""], PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const pc = (PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12, q = m[3] || "";
    const iv = q === "m" ? [0, 3, 7] : q === "7" ? [0, 4, 7, 10] : q === "maj7" ? [0, 4, 7, 11] : q === "m7" ? [0, 3, 7, 10] : [0, 4, 7];
    return { root: pc, iv };
  },
  events(song) {
    const ev = [], passLen = song.mel.reduce((a, [, d]) => a + d, 0);
    for (let ps = 0; ps < song.passes; ps++) {
      const T0 = ps * passLen; let b = 0;
      for (const [n, d] of song.mel) { ev.push({ u: T0 + b, k: "mel", m: n + (ps === 1 && song.style === "68" ? 12 : 0), d, v: ps ? 0.13 : 0.16 }); b += d; }
      b = song.off;
      for (const [name, d] of song.chords) {
        const c = this.chordNotes(name), bass = 40 + ((c.root + 8) % 12), mid = (k) => 55 + ((c.root + c.iv[k % c.iv.length] + 5) % 12);
        for (let k = 0; k < Math.ceil(d - 1e-6); k++) {
          const u = T0 + b + k;
          if (song.style === "68") { if (k % 3 === 0) ev.push({ u, k: "bass", m: k % 6 === 0 ? bass : bass + 7, d: 2.5, v: 0.2 }); else ev.push({ u, k: "arp", m: mid(k) + 12, d: 1.5, v: 0.05 }); }
          else if (song.style === "waltz") { if (k % 3 === 0) ev.push({ u, k: "bass", m: bass, d: 1, v: 0.22 }); else ev.push({ u, k: "stab", notes: c.iv.slice(0, 3).map((_, j) => mid(j)), d: 0.6, v: 0.04 }); }
          else { if (k % 2 === 0) ev.push({ u, k: "bass", m: k % 4 === 0 ? bass : bass + 7, d: 0.9, v: 0.22 }); else ev.push({ u, k: "stab", notes: c.iv.slice(0, 3).map((_, j) => mid(j)), d: 0.45, v: 0.05 });
            ev.push({ u, k: "tick", v: k % 2 ? 0.05 : 0.03 }); if (song.style === "jingle") ev.push({ u: u + 0.5, k: "bell", v: 0.05 }), ev.push({ u, k: "bell", v: 0.07 }); }
        }
        b += d;
      }
    }
    ev.sort((x, y) => x.u - y.u);
    return { ev, units: passLen * song.passes };
  },
  // song을 틀어요. 돌려주는 값: {t0: 시작(오디오 시각), spu: 한 박 길이(초), dur, end}
  play(song, opts = {}) {
    if (!Sound.ensure()) return null;
    this.stop(true);
    const ctx = Sound.ctx, out = ctx.createGain(), vol = opts.preview ? 0.4 : 0.55;
    out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.25); out.connect(ctx.destination);
    const dl = ctx.createDelay(); dl.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.25; const wet = ctx.createGain(); wet.gain.value = 0.22; dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out);
    const mf = (m) => 440 * Math.pow(2, (m - 69) / 12), nb = Sound.noiseBuf("white", 1);
    const tone = (m, t, dur, v, type, oct) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = mf(m) * (oct || 1); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0006, t + Math.max(0.2, dur)); o.connect(g); g.connect(out); g.connect(dl); o.start(t); o.stop(t + Math.max(0.2, dur) + 0.05); };
    const noise = (t, v, f, len) => { const sN = ctx.createBufferSource(); sN.buffer = nb; const fl = ctx.createBiquadFilter(); fl.type = "highpass"; fl.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0004, t + len); sN.connect(fl); fl.connect(g); g.connect(out); sN.start(t, Math.random() * 0.5); sN.stop(t + len + 0.02); };
    const spu = 60 / song.bpm, { ev, units } = this.events(song), t0 = ctx.currentTime + 0.35, dur = units * spu;
    const playE = (e, t) => {
      if (e.k === "mel") { tone(e.m, t, e.d * spu * 1.1, e.v, "sine"); tone(e.m, t, e.d * spu * 0.6, e.v * 0.35, "triangle", 2); }
      else if (e.k === "bass") tone(e.m, t, e.d * spu, e.v, "triangle");
      else if (e.k === "arp") tone(e.m, t, e.d * spu, e.v, "sine");
      else if (e.k === "stab") e.notes.forEach((n) => tone(n, t, e.d * spu, e.v, "triangle"));
      else if (e.k === "tick") noise(t, e.v, 7000, 0.06);
      else if (e.k === "bell") noise(t, e.v, 9000, 0.12);
    };
    let i = 0; const stopAt = opts.preview ? t0 + opts.preview : t0 + dur;
    const tick = () => { const hz = ctx.currentTime + 0.6; while (i < ev.length && t0 + ev[i].u * spu < hz) { const t = t0 + ev[i].u * spu; if (t < stopAt && t > ctx.currentTime - 0.05) playE(ev[i], Math.max(t, ctx.currentTime)); i++; } };
    tick(); const timer = setInterval(tick, 120);
    // 배경음은 잠깐 작게
    if (Sound.master) { try { Sound.master.gain.setTargetAtTime(0.04, ctx.currentTime, 0.3); } catch (e) {} }
    const cur = { song, t0, spu, dur, end: t0 + dur, out, timer, preview: !!opts.preview };
    cur.endTimer = setTimeout(() => this.stop(), (stopAt - ctx.currentTime + 1.2) * 1000);
    this.cur = cur; return cur;
  },
  stop(quick) {
    const c = this.cur; if (!c) return; this.cur = null;
    clearInterval(c.timer); clearTimeout(c.endTimer);
    const ctx = Sound.ctx; try { c.out.gain.cancelScheduledValues(ctx.currentTime); c.out.gain.setTargetAtTime(0, ctx.currentTime, quick ? 0.05 : 0.4); } catch (e) {}
    setTimeout(() => { try { c.out.disconnect(); } catch (e) {} }, 2000);
    if (Sound.master && Sound.on) { try { Sound.master.gain.setTargetAtTime(S.room === "worship" ? 0.22 : S.room === "room301" ? 0.18 : 0.32, ctx.currentTime, 0.6); } catch (e) {} }
  },
};
// 👏 짝 소리
function clapSound() {
  if (!Sound.ensure()) return; const ctx = Sound.ctx, nb = Sound.noiseBuf("white", 1);
  for (let k = 0; k < 4; k++) { const t = ctx.currentTime + k * 0.17, sN = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); sN.buffer = nb; f.type = "bandpass"; f.frequency.value = 1400 + Math.random() * 500; f.Q.value = 0.8; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09); sN.connect(f); f.connect(g); g.connect(ctx.destination); sN.start(t, Math.random() * 0.5); sN.stop(t + 0.12); }
}
function figOpen() { // 곡 고르기 창
  if (SK.race) return toast("경주가 끝나고 해요");
  if (!onIceMe()) { goRink(); return toast("⛸ 얼음 위에 올라가서 연기해요"); }
  SK.view = "songs"; $("#rinkTitle").textContent = "🩰 피겨 연기 · 음악 고르기";
  const body = $("#rinkBody");
  body.replaceChildren(
    h("div", { class: "fig-rules" },
      h("b", { text: "이렇게 해요" }),
      h("ul", {},
        h("li", { text: "음악이 나오면 아래 기술 버튼을 눌러요. 🎵 박자 불빛이 켜질 때 누르면 Perfect 가산점!" }),
        h("li", { text: "같은 기술은 2번까지만 점수 · 여러 기술을 섞으면 예술 점수 UP" }),
        h("li", { text: "💫 트리플 악셀은 점수가 크지만 넘어질 수도 있어요 (박자에 맞추면 덜 넘어져요)" }),
        h("li", { text: "음악이 끝날 때쯤 🙇 인사로 마무리하면 보너스 · 구경하는 친구들의 👏 박수도 점수가 돼요" }))),
    h("div", { class: "fig-songs" }, ...FIG_SONGS.map((sg) => {
      const sec = Math.round((sg.mel.reduce((a, [, d]) => a + d, 0) * sg.passes * 60) / sg.bpm);
      return h("div", { class: "fig-song" },
        h("span", { class: "e", text: sg.e }), h("div", { class: "t" }, h("b", { text: sg.name }), h("small", { text: `${sg.feel} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` })),
        h("button", { class: "btn ghost sm", text: "▶ 미리 듣기", onclick: () => { SkMusic.play(sg, { preview: 7 }); } }),
        h("button", { class: "btn primary sm", text: "이 곡으로 연기", onclick: () => { SkMusic.stop(true); closeModal("rinkModal"); figStart(sg); } }));
    })),
    h("p", { class: "muted tiny", text: "곡은 모두 저작권이 끝난 찬송·캐럴·클래식이고, 사이트가 직접 연주해요." }));
  openModal("rinkModal");
}
function figStart(song) {
  if (!onIceMe() || SK.race) return;
  S.seat = null; S.fig = null;
  const m = SkMusic.play(song); if (!m) return toast("이 브라우저에서는 소리를 낼 수 없어요");
  SK.prog = { song, m, pulse: m.spu * song.pulse, els: [], counts: {}, falls: 0, claps: 0, clappers: new Set(), tes: 0, done: false, startedAt: Date.now() };
  toast(`🎵 ${song.name} · 박자 불빛에 맞춰 기술을 눌러요!`);
  refreshMe(); renderSkateBar(true);
  clearInterval(SK.ptick);
  SK.ptick = setInterval(() => {
    const P = SK.prog; if (!P || P.done) { clearInterval(SK.ptick); return; }
    if (!onIceMe()) { figAbort("얼음 밖으로 나가서 연기를 멈췄어요"); return; }
    const now = Sound.ctx.currentTime, ph = (now - P.m.t0) / P.pulse, fr = ph - Math.floor(ph);
    const dot = document.querySelector("#skateBar .sk-beat"); if (dot) dot.style.opacity = ph < 0 ? 0.25 : String(Math.max(0.25, 1 - fr * 1.6));
    const t = $("#skateBar .sb-t"); if (t) { const left = Math.max(0, Math.ceil(P.m.end - now)); const tx = `🎵 ${P.song.name} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} · ${(P.tes).toFixed(1)}점`; if (t.textContent !== tx) t.textContent = tx; }
    if (now > P.m.end + 5) figFinish(false); // 인사 없이 끝
  }, 50);
}
function figAbort(msg) { const P = SK.prog; if (!P) return; P.done = true; SK.prog = null; clearInterval(SK.ptick); SkMusic.stop(); if (msg) toast(msg); refreshMe(); renderSkateBar(true); }
function figFeedback(txt, good) { const el = $("#skateBar .sk-fb"); if (!el) return; el.textContent = txt; el.classList.remove("pop", "bad"); void el.offsetWidth; el.classList.add("pop"); if (!good) el.classList.add("bad"); }
function skFigure(k) {
  if (SK.race || !onIceMe()) return;
  const F = W.FIGURES[k], P = SK.prog && !SK.prog.done ? SK.prog : null;
  if (S.fig && W.FIGURES[S.fig.k] && Date.now() - S.fig.t0 < W.FIGURES[S.fig.k].dur * 1000 - 150) { figFeedback("기술이 끝나고 눌러요"); return; }
  if (P && k === "bow") { S.fig = { k, t0: Date.now() }; refreshMe(); figFinish(true); return; }
  let showK = k;
  if (P) {
    if (Sound.ctx.currentTime < P.m.t0) return;
    if (P.els.length >= FIG_MAX_EL) { figFeedback(`기술은 ${FIG_MAX_EL}개까지 · 🙇 인사로 마무리해요`); return; }
    const ph = (Sound.ctx.currentTime - P.m.t0) / P.pulse, off = Math.abs(ph - Math.round(ph)); // 박자에서 벗어난 정도 (0~0.5박)
    const q = off <= 0.09 ? 1 : off <= 0.3 ? 1 - (off - 0.09) / 0.21 : 0;
    const n = (P.counts[k] || 0) + 1; P.counts[k] = n;
    const rep = n === 1 ? 1 : n === 2 ? 0.7 : 0;
    if (k === "triple" && Math.random() > 0.5 + 0.35 * q) { showK = "fall"; P.falls++; P.els.push({ k, pts: 0, q: 0, fall: true }); figFeedback("😵 넘어짐 -1.0"); }
    else {
      const pts = FIG_EL[k] * rep * (1 + 0.5 * q); P.els.push({ k, pts, q }); P.tes += pts;
      figFeedback(rep === 0 ? `${F.name} · 반복이라 0점` : `${q >= 0.8 ? "✨ Perfect" : q > 0.25 ? "👍 Good" : "🎵 박자 놓침"} +${pts.toFixed(1)}`, rep > 0 && q > 0.25);
    }
  } else toast(`${F.name}! (연습 · 점수는 🩰 피겨 연기에서)`);
  S.fig = { k: showK, t0: Date.now() }; refreshMe();
  const D = W.FIGURES[showK].dur;
  setTimeout(() => { if (S.fig && S.fig.t0 && Date.now() - S.fig.t0 >= D * 1000 - 50) { S.fig = null; refreshMe(); } }, D * 1000 + 30);
  if (P) renderSkateBar(true);
}
async function figFinish(bowed) {
  const P = SK.prog; if (!P || P.done) return; P.done = true; clearInterval(SK.ptick);
  const now = Sound.ctx.currentTime, good = P.els.filter((e) => !e.fall);
  const distinct = new Set(good.map((e) => e.k)).size;
  const variety = Math.min(6, distinct) * 2.5, music = good.length ? (good.reduce((a, e) => a + e.q, 0) / good.length) * 10 * Math.min(1, good.length / 6) : 0;
  const finish = bowed ? (now >= P.m.end - 7 ? 5 : 2) : 0, crowd = Math.min(3, P.claps * 0.2), ded = P.falls * 1.0;
  const total = Math.max(0, Math.min(150, Math.round((P.tes + variety + music + finish + crowd - ded) * 10) / 10));
  setTimeout(() => SkMusic.stop(), bowed ? 1500 : 0);
  S.bubble = `🩰 ${P.song.name} · ${total.toFixed(1)}점!`; S.kind = "status"; S.amens = 0; refreshMe(); renderSkateBar(true);
  const row = (l, v, cls) => h("div", { class: "fig-row " + (cls || "") }, h("span", { text: l }), h("b", { text: v }));
  SK.view = "score"; $("#rinkTitle").textContent = "🩰 피겨 연기 점수";
  const res = h("p", { class: "muted", text: "랭킹에 올리는 중…" });
  $("#rinkBody").replaceChildren(
    h("div", { class: "fig-total" }, h("small", { text: `${P.song.e} ${P.song.name}` }), h("b", { text: total.toFixed(1) }), h("span", { text: "점" })),
    row(`⛸ 기술 점수 (기술 ${good.length}개)`, P.tes.toFixed(1)),
    row(`🎨 예술 · 여러 기술 (${distinct}가지)`, variety.toFixed(1)),
    row("🎵 예술 · 박자 맞추기", music.toFixed(1)),
    row(bowed ? (finish === 5 ? "🙇 음악과 함께 마무리" : "🙇 인사 (조금 일찍)") : "🙇 인사 안 함", "+" + finish.toFixed(1)),
    row(`👏 관중 박수 (${P.claps}번)`, "+" + crowd.toFixed(1)),
    P.falls ? row(`😵 넘어짐 ${P.falls}번`, "-" + ded.toFixed(1), "bad") : null,
    res,
    h("div", { class: "modal-actions" }, h("button", { class: "btn primary", text: "🩰 다시 연기", onclick: () => figOpen() }), h("button", { class: "btn ghost", text: "🏆 랭킹 보기", onclick: () => openRinkRank("figure") })));
  openModal("rinkModal");
  SK.prog = null;
  if (total <= 0) { res.textContent = "기술을 몇 개 해야 랭킹에 올라가요 🙂"; return; }
  try { const r = await api.rinkScoreAdd("figure", total, P.song.id); res.textContent = r && r.new ? `🎉 내 최고 점수! 지금 ${r.rank}등이에요` : `내 최고 ${Number(r.best).toFixed(1)}점 · ${r.rank}등`; loadRinkTop(); }
  catch (e) { res.textContent = "랭킹에 올리지 못했어요: " + e.message; }
}
// 👏 박수 (구경하는 사람) — 연기 중인 사람이 있으면 그 사람에게 관중 박수 점수
function rinkPerformer() { const p = S.peers.find((x) => x.id !== myId && x.fpr && W.actorPos(x.id)); return p || null; }
function skClap() {
  const now = Date.now(); if (now - (SK.lastClap || 0) < 1200) return; SK.lastClap = now;
  const perf = rinkPerformer(), m = { k: "clap", by: myId, name: clip(S.profile?.name, LIMIT.name) || "익명", to: perf ? perf.id : null };
  api.sendSport(m); onClap(m);
}
function onClap(m) {
  W.clap(m.by); floatAt(m.by, "👏", m.by === myId ? "나" : m.name);
  if (S.room === "yard" && (nearRinkMe() || onIceMe())) clapSound();
  const P = SK.prog; if (m.to === myId && P && !P.done && m.by !== myId) { P.claps++; P.clappers.add(m.by); if (P.claps <= 15) figFeedback(`👏 ${clip(m.name, 6)}님 박수 +0.2`, true); }
}
function nearRinkMe() { const a = S.room === "yard" && W.actorPos(myId); return !!a && a.x > 32.4 && a.x < 54 && a.z > -44 && a.z < 0.5; }
// 🏆 랭킹
var RINK_TOP = { figure: null, speed: null };
async function loadRinkTop() {
  try { const [f, sp] = await Promise.all([api.rinkTop("figure"), api.rinkTop("speed")]); RINK_TOP = { figure: f || [], speed: sp || [] }; W.setRinkBoard({ figure: RINK_TOP.figure.slice(0, 5), speed: RINK_TOP.speed.slice(0, 5) }); }
  catch (e) { console.warn("스케이트장 랭킹 (supabase-update-missions.sql 실행 여부 확인):", e.message); }
  if (!$("#rinkModal").hidden && SK.view === "rank") renderRinkRank();
}
function openRinkRank(tab) { SK.view = "rank"; SK.rankTab = tab || SK.rankTab || "figure"; $("#rinkTitle").textContent = "🏆 스케이트장 랭킹"; renderRinkRank(); openModal("rinkModal"); loadRinkTop(); }
function renderRinkRank() {
  const tab = SK.rankTab, list = RINK_TOP[tab], songName = (id) => { const sg = FIG_SONGS.find((x) => x.id === id); return sg ? sg.e + " " + sg.name : ""; };
  $("#rinkBody").replaceChildren(
    h("div", { class: "rink-seg" }, ...[["figure", "🩰 피겨 점수"], ["speed", "🏁 스피드 2바퀴"]].map(([k, l]) => h("button", { class: tab === k ? "on" : "", text: l, onclick: () => { SK.rankTab = k; renderRinkRank(); } }))),
    list == null ? h("p", { class: "muted", text: "불러오는 중…" }) : !list.length ? h("p", { class: "muted", text: "아직 기록이 없어요. 첫 기록을 남겨 봐요! ⛸" })
      : h("ol", { class: "rink-rank" }, ...list.map((r, i) => h("li", { class: r.me ? "me" : "" }, h("span", { class: "rk", text: ["🥇", "🥈", "🥉"][i] || String(i + 1) }), h("span", { class: "nm" }, r.name || "익명", tab === "figure" && r.song ? h("small", { text: songName(r.song) }) : null), h("b", { text: tab === "figure" ? Number(r.score).toFixed(1) + "점" : Number(r.score).toFixed(2) + "초" })))),
    h("p", { class: "muted tiny", text: tab === "figure" ? "한 사람당 가장 높은 점수 하나가 올라가요" : "한 사람당 가장 빠른 기록 하나가 올라가요 (혼자 타도 기록돼요)" }),
    onIceMe() ? h("div", { class: "modal-actions" }, h("button", { class: "btn primary", text: tab === "figure" ? "🩰 피겨 연기하기" : "🏁 경주 시작", onclick: () => { closeModal("rinkModal"); tab === "figure" ? figOpen() : skStartRace(); } })) : null);
}
// 🏁 스피드 경주 방법 (출발 전 6초 동안)
function skHelpShow(t0) {
  let el = $("#skHelp"); if (!el) { el = h("div", { id: "skHelp", class: "sk-help" }); document.body.append(el); }
  el.replaceChildren(h("b", { text: "🏁 스피드 경주 방법" }),
    h("div", { class: "sk-help-feet" }, h("span", { text: "⏪ 왼발" }), h("i", { text: "→" }), h("span", { text: "오른발 ⏩" }), h("i", { text: "→" }), h("span", { text: "⏪ 왼발" }), h("i", { text: "…" })),
    h("p", { text: "두 버튼을 번갈아 탁·탁·탁 눌러요. 같은 발만 누르면 거의 안 나가고, 안 누르면 점점 느려져요." }),
    h("p", { class: "muted", text: `${RACE_LAPS}바퀴를 먼저 돌면 이겨요 · 키보드 ← → (A D)도 돼요` }),
    h("div", { class: "sk-help-n", text: "" }));
  el.hidden = false;
  const n = el.querySelector(".sk-help-n");
  clearInterval(SK.helpT);
  SK.helpT = setInterval(() => { const left = Math.ceil((t0 - Date.now()) / 1000); if (left <= 0 || !SK.race) { clearInterval(SK.helpT); el.hidden = true; return; } n.textContent = left <= 3 ? String(left) : "준비…"; }, 100);
}
function renderSkateBar(force) {
  const bar = $("#skateBar"); if (!bar) return;
  const ice = onIceMe(), R = SK.race, P = SK.prog && !SK.prog.done ? SK.prog : null, watch = !ice && !R && nearRinkMe();
  if (!ice && !R && !watch) { if (!bar.hidden) bar.hidden = true; SK.barKey = ""; return; }
  const perf = watch || (ice && !P) ? rinkPerformer() : null;
  const key = R ? `r|${R.done ? "d" : Date.now() < R.t0 ? "w" : "go"}|${Math.floor(R.p * 20)}` : P ? `p|${P.els.length}` : watch ? `w|${perf ? perf.id + perf.fpr : ""}` : `f|${perf ? perf.id : ""}|${SK.best}`;
  const lap = R ? Math.min(RACE_LAPS, Math.floor(R.p) + 1) : 0, sec = R ? Math.max(0, ((R.done || Date.now()) - R.t0) / 1000) : 0;
  const rt = R ? (R.done ? `🏁 결승 ${sec.toFixed(2)}초 · 다른 선수 기다리는 중…` : Date.now() < R.t0 ? "🏁 곧 출발해요! 왼발·오른발 번갈아" : `⛸ ${lap}/${RACE_LAPS}바퀴 · ${sec.toFixed(1)}초`) : "";
  if (!force && key === SK.barKey) { const t = R && bar.querySelector(".sb-t"); if (t && t.textContent !== rt) t.textContent = rt; return; }
  SK.barKey = key; bar.hidden = false;
  const clapBtn = h("button", { class: "btn ghost sm", text: perf ? `👏 ${clip(perf.name, 6) || "친구"}님께 박수` : "👏 박수", onclick: skClap });
  const rankBtn = h("button", { class: "btn ghost sm", text: "🏆 랭킹", onclick: () => openRinkRank() });
  if (R) {
    bar.replaceChildren(...[h("span", { class: "sb-t", text: rt }),
      h("div", { class: "sk-prog" }, h("i", { style: `width:${(R.p / RACE_LAPS) * 100}%` })),
      h("button", { class: "btn primary sk-foot", "data-foot": "L", text: "⏪ 왼발", onpointerdown: (e) => { e.preventDefault(); skPush("L"); } }),
      h("button", { class: "btn primary sk-foot", "data-foot": "R", text: "오른발 ⏩", onpointerdown: (e) => { e.preventDefault(); skPush("R"); } }),
      R.done ? h("button", { class: "btn ghost sm", text: "끝내기", onclick: skEnd }) : null].filter(Boolean));
    return;
  }
  if (P) {
    bar.replaceChildren(h("span", { class: "sb-t", text: `🎵 ${P.song.name}` }), h("i", { class: "sk-beat", title: "박자 불빛 · 밝을 때 누르면 Perfect" }), h("span", { class: "sk-fb" }),
      ...Object.entries(W.FIGURES).filter(([k, F]) => !F.hide && k !== "bow").map(([k, F]) => h("button", { class: "btn primary sm" + ((P.counts[k] || 0) >= 2 ? " used" : ""), text: F.name, title: `기본 ${FIG_EL[k]}점`, onclick: () => skFigure(k) })),
      h("button", { class: "btn ghost sm", text: "🙇 인사로 마무리", onclick: () => skFigure("bow") }),
      h("button", { class: "btn ghost sm", text: "그만", onclick: () => figAbort("연기를 멈췄어요") }));
    return;
  }
  if (watch) {
    bar.replaceChildren(h("span", { class: "sb-t", text: perf ? `👀 ${clip(perf.name, 8) || "친구"}님 연기 중 · 🎵 ${(FIG_SONGS.find((x) => x.id === perf.fpr) || {}).name || ""}` : "👀 스케이트장 구경 중 · 벤치에 앉거나 펜스에 기대 봐요" }), clapBtn, rankBtn);
    return;
  }
  bar.replaceChildren(...[h("span", { class: "sb-t", text: `⛸ 스케이트장${SK.best ? ` · 내 최고 ${SK.best.toFixed(1)}초` : ""}` }),
    h("button", { class: "btn primary sm", text: "🏁 스피드 경주", title: "지금 얼음 위에 있는 친구들과 같이 (최대 4명) · 혼자면 기록 재기", onclick: skStartRace }),
    h("button", { class: "btn primary sm", text: "🩰 피겨 연기 (음악 고르기)", onclick: figOpen }), rankBtn, perf ? clapBtn : null,
    h("span", { class: "sk-sep", text: "연습:" }),
    ...Object.entries(W.FIGURES).filter(([k, F]) => !F.hide && k !== "bow").map(([k, F]) => h("button", { class: "btn ghost sm", text: F.name, onclick: () => skFigure(k) }))].filter(Boolean));
}
document.addEventListener("keydown", (e) => { if (!SK.race || e.repeat) return; if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); skPush("L"); } if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); skPush("R"); } });
setInterval(() => { if (S.room === "yard") renderSkateBar(); else if (!$("#skateBar").hidden) $("#skateBar").hidden = true; }, 400);

/* ================= 🔥 뒷마당 쉼터: 캠프파이어 · 🌿 말씀 산책길 (2026-11-18) ================= */
// ---- 🔥 캠프파이어: 통나무(CF-0~7)에 앉으면 아래 막대 → 🍡 마시멜로 굽기 (노릇할 때 꺼내기) ----
const FIREG = { roast: null, sitAt: 0 };
function fireSeat() { return S.room === "yard" && S.seat && S.seat.startsWith("CF-"); }
function renderFireBar() {
  const bar = $("#fireBar"); if (!bar) return;
  if (!fireSeat()) { if (FIREG.roast) roastStop(true); if (!bar.hidden) bar.hidden = true; FIREG.sitAt = 0; FIREG.key = ""; return; }
  if (!FIREG.sitAt) FIREG.sitAt = Date.now();
  if (Date.now() - FIREG.sitAt > 10000) mAdd("campfire"); // 10초 넘게 앉아 있으면 미션
  const R = FIREG.roast, n = S.peers.filter((p) => p.seat && p.seat.startsWith("CF-")).length;
  const key = R ? "r" : `i|${n}|${S.carry || ""}`;
  if (key === FIREG.key) { if (R) roastDraw(); return; }
  FIREG.key = key; bar.hidden = false;
  if (R) { bar.replaceChildren(h("span", { class: "sb-t", text: "🍡 굽는 중… 노릇노릇할 때 꺼내요!" }), h("div", { class: "roast-bar" }, h("i", { class: "roast-zone" }), h("b", { class: "roast-pin" })), h("button", { class: "btn primary sm", text: "꺼내기!", onclick: roastPull })); roastDraw(); return; }
  bar.replaceChildren(h("span", { class: "sb-t", text: `🔥 캠프파이어 · 둘러앉은 사람 ${n}명` }),
    h("button", { class: "btn primary sm", text: "🍡 마시멜로 굽기", onclick: roastStart }),
    h("button", { class: "btn ghost sm", text: "일어나기", onclick: () => W.stand() }));
}
function roastStart() { FIREG.roast = { t0: Date.now() }; setCarry("marshraw"); FIREG.key = ""; renderFireBar(); }
function roastP() { return FIREG.roast ? (Date.now() - FIREG.roast.t0) / 9000 : 0; } // 0 → 1 (9초면 까맣게)
function roastDraw() { const pin = $("#fireBar .roast-pin"); if (pin) pin.style.left = Math.min(100, roastP() * 100) + "%"; if (roastP() > 1.15) roastPull(); }
function roastPull() {
  const p = roastP(); FIREG.roast = null; FIREG.key = "";
  if (p < 0.45) { setCarry("marshraw"); toast("아직 하얘요! 조금만 더 구워요 🍡 (다시 '굽기')"); }
  else if (p <= 0.78) { setCarry("marsh"); mAdd("marsh"); toast("✨ 노릇노릇 완벽해요! 먹거나 친구에게 줘 봐요 🍡"); S.bubble = "🍡 마시멜로 완벽하게 구웠어요!"; S.kind = "status"; S.amens = 0; refreshMe(); }
  else { setCarry("marshburnt"); toast("앗, 까맣게 탔어요 😅 그래도 냠냠 맛있을걸요?"); }
  renderFireBar();
}
function roastStop() { FIREG.roast = null; if (S.carry === "marshraw") setCarry(null); }
setInterval(() => { if (S.room === "yard" || !$("#fireBar").hidden) renderFireBar(); }, 200);

// ---- 🌿 말씀 산책길: 매일 바뀌는 말씀 7개 → 순서대로 지나가면 표지판이 빛나요 → 출발점으로 돌아오면 오늘의 질문 ----
const WALK_Q = [
  "오늘 말씀 중 마음에 남은 한 구절은? 왜 그런가요?", "요즘 하나님께 가장 감사한 것 한 가지는?", "지금 나를 가장 지치게 하는 것은 무엇인가요? 하나님께 맡겨 볼까요?",
  "오늘 말씀이 이번 주 나에게 해 주는 말은?", "요즘 기도하고 있는 제목 하나를 적어 보세요", "최근에 누군가에게 받은 사랑(도움)이 있다면?",
  "올해 하나님이 나를 자라게 하신 부분은?", "지금 용서하거나 화해하고 싶은 사람이 있나요?", "내가 요즘 붙잡고 있는 걱정 하나와, 그 대신 붙잡을 말씀은?",
  "오늘 하루 중 하나님이 가까이 느껴졌던 순간은?", "이번 주에 작은 친절을 베풀 수 있는 사람은 누구일까요?", "나에게 '쉼'은 무엇인가요? 요즘 잘 쉬고 있나요?",
  "어릴 때 처음 믿음을 갖게 된 기억이 있다면?", "요즘 나의 마음 날씨는? (맑음·흐림·비…) 왜 그런가요?", "하나님께 솔직하게 묻고 싶은 질문이 있다면?",
  "내가 가진 것 중 나눌 수 있는 것은 무엇인가요?", "이번 주 나를 웃게 한 일은?", "지금 기다리고 있는 응답이 있나요? 기다리는 마음은 어떤가요?",
  "오늘 말씀을 한 문장으로 바꿔 말하면?", "요즘 내 삶에서 '그루터기'처럼 남아 있는 소망은?", "1년 뒤의 나에게 하고 싶은 말은?",
  "내가 좋아하는 찬양 한 곡과 그 이유는?", "요즘 나를 위해 기도해 주는 사람은 누구인가요? 그 사람을 위해 한 줄 기도해요", "오늘 내려놓고 싶은 것 하나는?",
  "하나님이 나를 어떻게 보신다고 생각하나요?", "최근에 배운 것(신앙이든 삶이든) 하나는?", "이번 주 꼭 지키고 싶은 작은 약속 하나는?", "지금 이 순간 하나님께 드리고 싶은 한 마디는?",
];
const WALKS = { verses: [], q: "", done: 0, d: "" };
function walkToday() {
  const d = nyDay(); if (WALKS.d === d && WALKS.verses.length) return WALKS;
  const V = window.VERSES || [], N = V.length, base = dIdx(d) * 7;
  const verses = []; for (let i = 0; i < 7 && N; i++) { const v = V[(base + i * 47) % N]; verses.push({ text: v.text, ref: v.ref, b: v.b, c: v.c }); }
  const st = store.get("walkDay", null);
  Object.assign(WALKS, { d, verses, q: WALK_Q[dIdx(d) % WALK_Q.length], done: st && st.d === d ? st.n : 0, asked: st && st.d === d ? !!st.asked : false });
  W.setWalk(verses, WALKS.done);
  return WALKS;
}
function walkSave() { store.set("walkDay", { d: WALKS.d, n: WALKS.done, asked: WALKS.asked }); W.setWalk(null, WALKS.done); }
function walkCardShow(i, note) {
  const c = $("#walkCard"), v = WALKS.verses[i]; if (!v) return;
  c.replaceChildren(h("div", { class: "wk-n", text: `🌿 말씀 산책길 ${i + 1} / 7` }), h("p", { class: "wk-t", text: v.text }), h("div", { class: "wk-r", text: v.ref + " (개역한글)" }),
    note ? h("div", { class: "wk-note", text: note }) : null,
    h("div", { class: "wk-btns" }, h("button", { class: "btn ghost sm", text: "📖 이 장 읽기", onclick: () => { c.hidden = true; openReader(v.b - 1, v.c); } }), h("button", { class: "btn ghost sm", text: "닫기", onclick: () => (c.hidden = true) })));
  c.hidden = false; clearTimeout(WALKS.hideT); WALKS.hideT = setTimeout(() => (c.hidden = true), 14000);
}
function walkTick() {
  if (S.room !== "yard" || !started) return;
  const me = W.actorPos(myId); if (!me) return;
  walkToday();
  const S7 = W.WALK.signs;
  if (WALKS.done < 7) {
    const nx = S7[WALKS.done];
    if (Math.hypot(me.x - nx.path.x, me.z - nx.path.z) < 2.6) {
      WALKS.done++; walkSave();
      walkCardShow(WALKS.done - 1, WALKS.done === 7 ? "🎉 7개를 다 걸었어요! 출발점(아치)으로 돌아가면 오늘의 질문이 기다려요" : `다음 표지판으로 걸어가요 (${WALKS.done}/7)`);
    } else {
      const k = S7.findIndex((sg, i) => i > WALKS.done && Math.hypot(me.x - sg.path.x, me.z - sg.path.z) < 2.2);
      if (k > 0 && WALKS.hintAt !== k) { WALKS.hintAt = k; toast(`🌿 ${WALKS.done + 1}번 표지판부터 순서대로 걸어요 (출발: 아치 → 왼쪽으로)`); }
    }
  } else if (!WALKS.asked && Math.hypot(me.x - W.WALK.start.x, me.z - W.WALK.start.z) < 2.6) {
    WALKS.asked = true; walkSave(); mAdd("walk"); openWalkQ();
  }
}
setInterval(walkTick, 500);
function openWalkQ() {
  const ta = h("textarea", { class: "walk-ta", maxlength: 500, rows: 5, placeholder: "떠오르는 대로 편하게 적어요. 나만 볼 수 있어요 🌿" });
  $("#walkBody").replaceChildren(
    h("p", { class: "walk-q", text: WALKS.q }),
    h("p", { class: "muted tiny", text: "답은 🌱 내 그루터기 → 🌿 산책 노트에 날짜별로 쌓여요. 나만 볼 수 있어요." }), ta,
    h("div", { class: "modal-actions" }, h("button", { class: "btn ghost", text: "다음에", onclick: () => closeModal("walkModal") }),
      h("button", { class: "btn primary", text: "📝 노트에 남기기", onclick: async (e) => {
        const a = ta.value.trim(); if (!a) return toast("한 줄이라도 적어 주세요 🙂"); if (!checkText(a)) return;
        e.target.disabled = true;
        try { await api.walkNoteSave(WALKS.q, a); mAdd("walkq"); closeModal("walkModal"); toast("🌿 산책 노트에 남겼어요"); } catch (er) { toast(er.message); e.target.disabled = false; }
      } })));
  openModal("walkModal");
}
function openWalkInfo(i) {
  walkToday();
  if (i != null) { walkCardShow(i, i < WALKS.done ? "✓ 오늘 지나간 표지판이에요" : i === WALKS.done ? "가까이 걸어가면 지나간 걸로 쳐요" : `${WALKS.done + 1}번부터 순서대로 걸어요`); return; }
  toast(WALKS.done >= 7 ? (WALKS.asked ? "🌿 오늘 산책을 마쳤어요. 내일 새 말씀이 걸려요" : "🌿 출발점 아치로 가면 오늘의 질문이 나와요") : `🌿 말씀 산책길: 아치에서 출발해 표지판 7개를 순서대로 지나가요 (${WALKS.done}/7)`);
  if (WALKS.done === 0) { const s1 = W.WALK.signs[0]; W.walkTo(W.WALK.start.x, W.WALK.start.z - 0.4); setTimeout(() => toast(`첫 표지판은 아치에서 ${s1.path.x < W.WALK.start.x ? "왼쪽" : "오른쪽"}이에요`), 2500); }
}
async function albumWalk() {
  const box = h("div", {}, h("p", { class: "muted", text: "불러오는 중…" }));
  (async () => {
    let list = [];
    try { list = await api.walkNotes(); } catch (e) { box.replaceChildren(h("p", { class: "muted", text: "산책 노트를 불러오지 못했어요: " + e.message })); return; }
    box.replaceChildren(...(list.length ? list.map((n) => h("div", { class: "walk-note" }, h("small", { text: n.day }), h("b", { text: n.q }), h("p", { text: n.a })))
      : [h("p", { class: "muted", text: "아직 없어요. 🔥 뒷마당 쉼터의 🌿 말씀 산책길을 끝까지 걸으면 오늘의 질문이 나와요." }), h("button", { class: "btn primary", text: "🌿 산책길로 가기", onclick: () => { closeModal("albumModal"); goYard(-3, -22.6, "🌿 말씀 산책길"); } })]));
  })();
  return [h("div", { class: "board-label", text: "🌿 산책 노트 · 나만 봐요" }), box];
}

/* ================= 🗺 마당 지도 ================= */
// 마당을 위에서 내려다본 간단한 지도. 누르면 그곳으로 걸어가요 (다른 방에 있으면 먼저 마당으로 나와요).
// 좌표는 3D 마당과 같은 미터 단위(x: 왼쪽→오른쪽, z: 건물 뒤→앞길)
const MAP_POI = [
  { k: "door", to: "praise", x: -8.6, z: -4, e: "🎸", t: "찬양팀", up: 0 },
  { k: "door", to: "worship", x: -3, z: -4, e: "🙏", t: "본당", up: 1 },
  { k: "door", to: "vision", x: 2.4, z: -4, e: "🕊", t: "비전(2부)", up: 0 },
  { k: "door", to: "cafe", x: 9, z: -4, e: "📖", t: "성경 읽기", up: 1 },
  { k: "door", to: "room301", x: 13.4, z: -4, e: "🛋", t: "301호 3Q(1부)", up: 0 },
  { k: "walk", x: 3.4, z: 7.6, e: "🎄", t: "트리", season: "christmas" },
  { k: "walk", x: 7.8, z: 10.2, e: "🧦", t: "광고판", season: "christmas" },
  { k: "walk", x: -8.4, z: 12.2, e: "📅", t: "모임 시간표" },
  { k: "walk", x: -19.5, z: -6.2, e: "🐱", t: "고양이 콘도" },
  { k: "door", to: "showroom", x: -30.6, z: -5.2, e: "🧀", t: "치즈멜로 쇼룸", up: 0 },
  { k: "sled", x: 26.5, z: -32, e: "🛷", t: "눈썰매 · 놀이터" },
  { k: "walk", x: 28.6, z: -21.7, e: "🎠", t: "그네" },
  { k: "walk", x: 43, z: -11.5, e: "⛸", t: "스케이트장" },
  { k: "walk", x: -32.0, z: 6.6, e: "🐙", t: "타코야끼" },
  { k: "walk", x: -29.2, z: 6.6, e: "🐟", t: "붕어빵" },
  { k: "walk", x: 26.3, z: -8.5, e: "🏀", t: "농구장" },
  { k: "walk", x: -3, z: -28.2, e: "🔥", t: "캠프파이어" },
  { k: "walk", x: -3, z: -22.8, e: "🌿", t: "말씀 산책길" },
];
function renderMap() {
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-37 -45 92 68"); svg.setAttribute("class", "map-svg");
  const el = (tag, at, txt) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  el("rect", { x: -37, y: -45, width: 92, height: 68, fill: "#cfe6b8" });
  el("rect", { x: 35, y: -36, width: 16, height: 30, fill: "#e4f4fb", stroke: "#fbfbf7", "stroke-width": 0.5, rx: 3 }); // ⛸ 스케이트장
  el("ellipse", { cx: 43, cy: -21, rx: 5.4, ry: 11.8, fill: "none", stroke: "#d9483b", "stroke-width": 0.2 });
  el("ellipse", { cx: -3, cy: -32.6, rx: 16, ry: 8.6, fill: "none", stroke: "#d9cdb6", "stroke-width": 0.9 }); // 🌿 말씀 산책길
  el("circle", { cx: -3, cy: -31.2, r: 3.4, fill: "#e8d9b8" }); el("circle", { cx: -3, cy: -31.2, r: 0.9, fill: "#ff8a3c" }); // 🔥 캠프파이어
  el("text", { x: -3, y: -43.2, class: "mt", "text-anchor": "middle" }, "🔥 뒷마당 쉼터");
  el("rect", { x: 20.6, y: -19.2, width: 11.4, height: 14.4, fill: "#3f7f63", stroke: "#fff", "stroke-width": 0.25, rx: 0.4 }); // 🏀 농구장
  el("rect", { x: -32.7, y: -1.2, width: 4.2, height: 13, fill: "#e2d6bf" }); // 🍢 골목
  el("text", { x: -30.6, y: 14.8, class: "mt", "text-anchor": "middle" }, "🍢 먹거리 골목");
  el("text", { x: 38, y: -38, class: "mt", "text-anchor": "middle" }, "⛹️ 놀이 동산");
  el("rect", { x: -15, y: -19, width: 30, height: 15, fill: "#b4583f", rx: 0.6 }); // 교회 건물
  el("rect", { x: -14.2, y: -6, width: 3.2, height: 3.2, fill: "#f1eee8" }); // 첨탑
  el("text", { x: 0, y: -11, class: "mt big", "text-anchor": "middle", fill: "#fff" }, "⛪ 교회 건물");
  el("rect", { x: -37, y: 12.6, width: 92, height: 0.9, fill: "#d6d2ca" }); // 보도
  el("rect", { x: -37, y: 13.5, width: 92, height: 9, fill: "#55575c" }); // 앞길
  el("line", { x1: -37, y1: 18, x2: 55, y2: 18, stroke: "#e8c23a", "stroke-width": 0.2, "stroke-dasharray": "2 1.5" });
  el("text", { x: 4, y: 21.2, class: "mt", "text-anchor": "middle", fill: "#fff" }, "🚗 앞길 (차가 다녀요)");
  el("rect", { x: -3.6, y: -4, width: 1.2, height: 16.6, fill: "#e4e0d8" }); el("rect", { x: 8.4, y: -4, width: 1.2, height: 16.6, fill: "#e4e0d8" }); // 길
  el("rect", { x: 20.3, y: -42.9, width: 11.6, height: 22.8, fill: "#e3eef5", rx: 0.6 }); // 놀이터 (눈썰매·그네)
  el("polygon", { points: "22.4,-42.3 30.6,-42.3 30.6,-22.7 22.4,-22.7", fill: "#f7fbfd" }); // 눈썰매 언덕
  el("rect", { x: 19.8, y: 2.8, width: 12.4, height: 4.4, fill: "#e4e0d8" }); // 트럭 앞 보도
  el("rect", { x: -23.5, y: -12, width: 5, height: 4.5, fill: "#c9a46a", rx: 0.4 }); // 고양이 콘도
  el("rect", { x: -34.9, y: -11.8, width: 8.6, height: 10, fill: "#efe4cf", rx: 0.4 }); // 쇼룸 앞 돌 바닥
  el("rect", { x: -33.6, y: -11.6, width: 6, height: 4.4, fill: "#f7c948", stroke: "#d9483b", "stroke-width": 0.35, rx: 0.4 }); // 🧀 쇼룸
  el("rect", { x: -35.7, y: 0.5, width: 2.7, height: 5.2, fill: "#d9483b", rx: 0.4 }); el("rect", { x: -28.2, y: 1.2, width: 2.7, height: 5.2, fill: "#2f4f8a", rx: 0.4 }); // 🚚 트럭 2대
  const me = S.room === "yard" ? W.actorPos(myId) : null;
  // 사람들 (마당에 있을 때)
  if (S.room === "yard") for (const p of S.peers) { const a = W.actorPos(p.id); if (a && p.id !== myId) el("circle", { cx: a.x, cy: a.z, r: 0.7, fill: p.color || "#888", stroke: "#fff", "stroke-width": 0.2 }); }
  for (const poi of MAP_POI) {
    if (poi.season && W.seasons && !W.seasons.has(poi.season)) continue;
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "poi" + (poi.k === "door" ? " door" : "")); g.setAttribute("tabindex", "0");
    const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", poi.x); c.setAttribute("cy", poi.z); c.setAttribute("r", 1.9); g.append(c);
    const e = document.createElementNS(NS, "text"); e.setAttribute("x", poi.x); e.setAttribute("y", poi.z + 0.8); e.setAttribute("text-anchor", "middle"); e.setAttribute("class", "pe"); e.textContent = poi.e; g.append(e);
    const t = document.createElementNS(NS, "text"); t.setAttribute("x", poi.x); t.setAttribute("y", poi.z + (poi.k === "door" ? (poi.up ? -5 : -2.6) : 3.4)); t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "pt"); t.textContent = poi.t; g.append(t);
    g.addEventListener("click", () => mapGo(poi));
    svg.append(g);
  }
  if (me) { el("circle", { cx: me.x, cy: me.z, r: 1.1, fill: "#f0a050", stroke: "#fff", "stroke-width": 0.35 }); el("text", { x: me.x, y: me.z - 1.6, class: "pt me", "text-anchor": "middle" }, "나"); }
  $("#mapWrap").replaceChildren(svg);
}
// 🧭 구역 · ✨ 바로 가기 (2026-11-18): 25m 넘게 먼 곳은 "걸어가기 / 바로 가기"를 골라요. 바로 가기는 그 구역 입구에 반짝 도착한 뒤 걸어가요
const ZONE_LAND = { play: { x: 26, z: 4.6 }, back: { x: -3, z: -22.8 }, food: { x: -30.6, z: 11.6 }, cat: { x: -20.6, z: 0.4 }, front: { x: 0, z: 9.5 } };
function warpTo(zoneId, then) {
  const L = ZONE_LAND[zoneId] || ZONE_LAND.front, a = W.me && W.me();
  W.placeMe(L.x, L.z); S.pos = { x: L.x, z: L.z }; S.seat = null; refreshMe();
  setTimeout(() => { floatAt(myId, "✨", "바로 가기"); if (then) then(); }, 80); void a;
}
function askWarp(target, zoneId, label, walk) {
  const me = S.room === "yard" && W.actorPos(myId), far = me && Math.hypot(me.x - target.x, me.z - target.z) > 25;
  if (!far) { walk(); return; }
  let pop = $("#warpPop"); if (!pop) { pop = h("div", { id: "warpPop", class: "warp-pop" }); document.body.append(pop); }
  pop.replaceChildren(h("b", { text: `${label}까지 멀어요` }),
    h("div", { class: "warp-btns" }, h("button", { class: "btn ghost", text: "🚶 걸어가기", onclick: () => { pop.hidden = true; walk(); } }),
      h("button", { class: "btn primary", text: "✨ 바로 가기", onclick: () => { pop.hidden = true; warpTo(zoneId, walk); } })),
    h("button", { class: "x", text: "✕", onclick: () => (pop.hidden = true) }));
  pop.hidden = false;
}
function zoneGo(id) {
  const L = ZONE_LAND[id] || ZONE_LAND.front, Z = (W.ZONES || []).find((z) => z.id === id), name = Z ? Z.name : "그곳";
  const go = () => { askWarp(L, id, name, () => { W.walkTo(L.x, L.z); toast(`${name}으로 가요`); }); };
  if (S.room !== "yard") { joinRoom("yard", S.room); setTimeout(() => { warpTo(id); toast(`✨ ${name}에 도착했어요`); }, 700); } else go();
}
function renderZoneChip() {
  let el = $("#zoneChip"); if (!el) { el = h("div", { id: "zoneChip", class: "zone-chip" }); $("#viewport").append(el); }
  const me = S.room === "yard" && W.actorPos(myId), z = me && W.zoneOf(me.x, me.z), txt = S.room === "yard" ? (z ? "📍 " + z.name.replace(/^\S+\s/, "") : "") : "📍 " + (ROOM_NAME[S.room] || "");
  if (el.textContent !== txt) { el.textContent = txt; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  el.hidden = !started || !txt;
}
setInterval(renderZoneChip, 700);
function mapGo(poi) {
  closeModal("mapModal");
  if (S.room === "yard" && poi.k !== "sled") { const z = W.zoneOf(poi.x, poi.z), go0 = () => mapGo2(poi); askWarp(poi, z ? z.id : "front", `${poi.e} ${poi.t}`, go0); return; }
  mapGo2(poi);
}
function mapGo2(poi) {
  const go = () => {
    if (poi.k === "door") { W.goDoor(poi.to); toast(`${poi.e} ${poi.t}(으)로 가요`); return; }
    if (poi.k === "sled") { W.goSled(); return; }
    if (poi.k === "show") { W.walkTo(poi.x, poi.z); toast("🧀 치즈멜로바이트 쇼룸으로 가요"); setTimeout(openShowroom, 900); return; }
    W.walkTo(poi.x, poi.z); toast(`${poi.e} ${poi.t}(으)로 가는 중이에요`);
  };
  if (S.room !== "yard") { joinRoom("yard", S.room); setTimeout(go, 700); } else go();
}
function openMap() { renderMap(); openModal("mapModal"); }
$$(".map-open").forEach((b) => (b.onclick = openMap));

/* ================= 🪶 가볍게 보기 (오래된 폰) ================= */
// 그림자 · 반짝이 전구 · 내리는 눈을 끄고 화면 해상도를 낮춰요. 이 기기에 기억해요.
function setLite(on, quiet) {
  store.set("lite", !!on); W.setLite(!!on);
  $("#liteBtn").classList.toggle("on", !!on);
  if (!quiet) toast(on ? "🪶 가볍게 보기를 켰어요 (그림자·전구 반짝임·눈 끔)" : "가볍게 보기를 껐어요");
}
$("#liteBtn").onclick = () => setLite(!store.get("lite", false));

/* ================= 시작 ================= */
document.title = SITE_TITLE;
$("#churchName").textContent = SITE_TITLE;
$("#demoBanner").hidden = !api.demo;
W.init($("#viewport"), $("#overlay"), {
  myId,
  renderOverlay,
  toast,
  onMove(pos, seat) {
    S.pos = pos; S.seat = seat;
    S.needSpread = false;
    S.lying = false; updateLieBtn();
    if (S.dance && !S.danceKeep) { S.dance = null; updateDanceBtns(); } // 걸어가면 춤은 멈춰요
    if (S.ground) { S.ground = false; updateGroundBtn(); }
    $$(".stand-btn").forEach((b) => (b.hidden = !seat));
    if (S.room === "praise") jamSeatChanged();
    S.peers = S.peers.filter((p) => p.id !== myId).concat(meState());
    api.update(meState());
    if (S.room === "praise") { renderJamBar(); renderJamWho(); }
  },
  onDoor(to) { joinRoom(to, S.room); },
  onAction(a) {
    if (a === "guestbook") openGuestbook();
    if (a === "sled") W.goSled();
    if (a === "cafeShelf") openShelf();
    if (a.startsWith("truck:")) openTruck(a.slice(6));
    if (a.startsWith("cat:")) { const i = +a.slice(4), c = W.petCat(i); if (c) { toast(`${c.name} ${c.sex || ""} · ${CAT_RULE[i].trait}: 냐옹~ 🐾`); catPetted(i); } }
    if (a === "catfood") openCatFood();
    if (a === "showroom") openShowroom();
    if (a === "buy:s" || a === "buy:l") openOrder(a.slice(4));
    if (a === "cookie") startCookie();
    if (a === "rink") { if (onIceMe()) toast("⛸ 아래 막대에서 🏁 경주나 🩰 피겨 연기를 해 봐요!"); else goRink(); }
    if (a === "rinkrank") openRinkRank();
    if (a === "walk") openWalkInfo();
    if (a.startsWith("walksign:")) openWalkInfo(+a.slice(9));
    if (a === "campfire") { if (S.room === "yard") { const free = Array.from({ length: 8 }, (_, k) => "CF-" + k).filter((id) => W.seatFree(id)); if (free.length) W.sitNear(free, W.FIRE); else toast("🔥 통나무가 꽉 찼어요!"); } }
    if (a.startsWith("zone:")) zoneGo(a.slice(5));
    if (a.startsWith("pet:")) { const [pid, pk] = a.slice(4).split(":"), pi = W.petOf(pid, pk != null ? +pk : null); if (pi && pi.i === 99) toast(`🦁 다니엘의 사자예요. 사자들의 입을 봉하셨어요 (다니엘 6:22)`); else if (pi) { W.petCat(pi.i); const c = W.CATS[pi.i]; toast(`🐱 ${c.name}${pi.owner ? `가 ${clip(pi.owner, 10)}님과` : "가 누군가와"} 산책 중이에요 💕`); catPetted(pi.i); } }
    if (a === "court:bb" || a === "ball:bb") bbGoToBall();
    if (a === "schedule") openSched();
    if (a === "thanks") openThanks();
    if (a === "sportrank") openSportRank();
    if (a === "court:tn") joinCourt("tn");
    if (a === "court:bm") joinCourt("bm");
    if (a === "quiz") openQuiz("play");
    if (a === "song") openSong();
    if (a === "ad") openAd();
    if (a === "cd") openCd();
    if (a === "rec") openRecs();
  },
  onEatSeen(id, kind) { floatAt(id, "😋"); },
  onSled(lane) {
    // 언덕 아래 도착 → 출발! (다른 사람 화면에서도 같이 보여요)
    S.sled = { n: Date.now(), lane }; S.seat = null; S.pos = W.sledEnd(lane);
    toast("슝~ 🛷");
    refreshMe();
  },
});
if (store.get("lite", false)) setLite(true, true); // 🪶 가볍게 보기
$("#loading").hidden = true;
renderVerse();
fillBookSel();
renderProgress();
loadGroup();
setInterval(loadGroup, 30000);
setInterval(() => { if (!$("#wall").hidden) loadWall(); }, 20000);
setInterval(() => { if (document.visibilityState === "visible") { loadFootprints(); if (NOTICE_ROOMS[S.room]) loadNotices(); if (GB_ROOMS.includes(S.room)) { loadGuestbook(); loadQuizMeta(); } } }, 30000);
setInterval(() => { if (document.visibilityState === "visible" && S.room === "yard") loadCatFeeds(); }, 15000);
setInterval(() => { if (document.visibilityState === "visible" && S.room === "yard") loadFood(); }, 8000); // 트럭 손님 줄이 움직이게 8초마다
setInterval(() => { if (nyDay() !== verseDay) renderVerse(); }, 10 * 60e3);
renderMeChip();
// 함께하는 기능: 설정(계절·밤·설교) · 모임 · 감사 나무 열매 · 통독 기록
applyThemeNight(); loadSite(); loadEvents(); loadThanks(); syncReading();
setInterval(applyThemeNight, 60e3);
setInterval(loadSite, 5 * 60e3);
setInterval(renderEvents, 30e3);
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  loadEvents();
  if (S.room === "yard") loadSportBoard();
  if (S.room === "worship") loadThanks();
  if (["cafe", "room301", "vision"].includes(S.room)) loadChallenge();
}, 60e3);
renderMeChip();
setInterval(() => { if (document.visibilityState === "visible" && S.room === "yard") loadCookie(); }, 30e3);
setInterval(() => { if (started) { missionCheck(); renderMissionBits(); } }, 60e3); // 자정이 지나면 새 미션
/* ================= 🧑 한 사람 = 한 캐릭터 (기기를 연결하면 2026-11-18) ================= */
// 같은 사람(같은 기기 번호 token)의 기기 두 개가 동시에 들어오면, 나중에 들어온(지금 쓰는) 기기가 '나'가 되고
// 먼저 있던 기기는 "📱 다른 기기에서 들어왔어요" 화면으로 바뀌어요. 다른 사람 화면·사람 목록에도 한 명만 보여요.
// 서로 알아볼 때는 token 대신 바꾼 값(SHA-256 앞 16자리, S.who)만 보내요 (token은 내 기록 열쇠라 보내지 않아요)
S.act = Date.now(); S.who = "";
(async () => { try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("qpc-who:" + token)); S.who = [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join(""); } catch (e) { S.who = "w" + tokHash.toString(16); } if (started) { refreshMe(); lobbyKey = ""; lobbyUpdate(); } })();
// 같은 사람이면 가장 최근에 '나'가 된 기기 하나만 남겨요
function oneEach(list) {
  const best = new Map(), out = [];
  for (const p of list) { if (!p.who) { out.push(p); continue; } const b = best.get(p.who); if (!b || (p.act || 0) > (b.act || 0)) best.set(p.who, p); }
  return out.concat([...best.values()]);
}
function checkTakeover(list) {
  if (!S.who || S.away || !started) return;
  const newer = list.find((p) => p.id !== myId && p.who === S.who && (p.act || 0) > S.act);
  if (newer) goAway(newer.room);
}
function goAway(room) {
  S.away = true;
  try { api.leaveRoom(); } catch (e) {} try { api.lobbyLeave(); } catch (e) {}
  if (typeof SkMusic !== "undefined") SkMusic.stop(true);
  let el = $("#awayScreen");
  if (!el) { el = h("div", { id: "awayScreen", class: "away-screen" }); document.body.append(el); }
  el.replaceChildren(h("div", { class: "away-card" }, h("div", { class: "away-e", text: "📱" }), h("b", { text: "다른 기기에서 들어왔어요" }),
    h("p", { text: `지금은 다른 기기에서 ${ROOM_NAME[room] || "그루터기"}에 있어요. 한 사람은 한 곳에만 보여요.` }),
    h("button", { class: "btn primary wide", text: "여기서 계속하기", onclick: comeBack })));
  el.hidden = false;
}
function comeBack() {
  S.away = false; S.act = Date.now(); $("#awayScreen").hidden = true;
  lobbyKey = ""; joinRoom(S.room, S.room); lobbyUpdate(); loadMissions(); pullReading(); profilePull();
  toast("📱 이 기기에서 계속해요");
}
// ---- 캐릭터 · 이름도 서버에 (마지막으로 바꾼 모습이 모든 기기에 똑같이) ----
const PROF_KEYS = ["name", "color", "hair", "hairColor", "glasses", "gender", "item", "wear", "halo", "trail", "shoulder", "apron", "pin", "badge", "title", "pet", "petPick"];
const profCore = (p) => JSON.stringify(PROF_KEYS.map((k) => (p || {})[k] ?? null));
let profSent = store.get("profSent", "");
async function profilePull() {
  if (api.demo || !S.profile) return;
  let r = null; try { r = await api.profileMe(); } catch (e) { return; }
  if (!r || !r.profile) { profilePush(true); return; }
  const at = Number(r.at) || 0;
  if (at > (S.profile.upd || 0) && profCore(r.profile) !== profCore(S.profile)) {
    const np = { ...S.profile }; for (const k of PROF_KEYS) if (k in r.profile) np[k] = r.profile[k];
    np.upd = at; S.profile = np; store.set("profile", np); profSent = profCore(np); store.set("profSent", profSent);
    try { Object.assign(draft, np); } catch (e) {}
    renderMeChip(); refreshMe();
  }
}
async function profilePush(force) {
  if (api.demo || !S.profile || S.away) return;
  const core = profCore(S.profile); if (!force && core === profSent) return;
  if (core !== profSent) { S.profile.upd = Date.now(); store.set("profile", S.profile); }
  const pr = {}; for (const k of PROF_KEYS) pr[k] = S.profile[k] ?? null;
  try { await api.profileSave(pr); profSent = core; store.set("profSent", core); } catch (e) { if (!/준비 중/.test(e.message)) console.warn("캐릭터 저장:", e.message); }
}
setInterval(() => { if (started) profilePush(); }, 5000);

/* ================= 🧭 사이트 전체 보완 (2026-11-18) ================= */
// ---- 1) 처음 온 사람 안내 투어 (한 번만, 건너뛸 수 있어요 · 내 캐릭터 → "사용 안내 다시 보기") ----
const TOUR = [
  { sel: "#viewport", t: "👋 반가워요!", d: "바닥을 누르면 그곳으로 걸어가요. 화면을 끌면 둘러볼 수 있고, 두 손가락(또는 휠)으로 가까이·멀리 볼 수 있어요." },
  { sel: ".tabs", t: "🚪 방 옮기기", d: "의자·벤치를 누르면 앉고, 문을 누르면 그 방으로 들어가요. 위 탭을 눌러도 바로 가요." },
  { sel: "#composer-yard input", t: "💬 말풍선", d: "아래 칸에 지금 상태를 쓰면 내 머리 위에 말풍선으로 보여요. 친구 말풍선을 누르면 반응도 할 수 있어요." },
  { sel: "#albumBtn", t: "🎯 오늘의 미션", d: "매일 미션 3개를 하면 🎁 선물 상자가 열려요(가끔 ✨ 성경 인물 착장!). 🌱 내 그루터기에서 모은 것과 기록을 봐요." },
  { sel: ".hud-btn.map-open", t: "🗺 지도", d: "어디에 뭐가 있는지 지도에서 보고, 누르면 그곳으로 바로 가요." },
  { sel: "#meChip", t: "📱 폰·컴퓨터 같이 쓰기", d: "폰과 컴퓨터를 둘 다 쓰면 내 캐릭터(여기) → '📱 다른 기기와 연결'로 기록을 합칠 수 있어요. 안내는 여기서 다시 볼 수 있어요." },
];
let TOURS = null;
function startTour(after) {
  TOURS = { i: 0, after };
  let box = $("#tourBox"); if (!box) { box = h("div", { id: "tourBox", class: "tour" }); document.body.append(box, h("div", { id: "tourRing", class: "tour-ring" })); }
  renderTour();
}
function endTour() { store.set("tourDone", true); const a = TOURS && TOURS.after; TOURS = null; $("#tourBox").hidden = true; $("#tourRing").hidden = true; if (a) setTimeout(a, 400); }
function renderTour() {
  const st = TOUR[TOURS.i], box = $("#tourBox"), ring = $("#tourRing"), el = document.querySelector(st.sel);
  box.hidden = false;
  box.replaceChildren(h("div", { class: "tour-n", text: `${TOURS.i + 1} / ${TOUR.length}` }), h("b", { text: st.t }), h("p", { text: st.d }),
    h("div", { class: "tour-btns" }, h("button", { class: "btn ghost sm", text: "건너뛰기", onclick: endTour }),
      h("button", { class: "btn primary sm", text: TOURS.i === TOUR.length - 1 ? "시작해요 🌱" : "다음 →", onclick: () => { if (TOURS.i < TOUR.length - 1) { TOURS.i++; renderTour(); } else endTour(); } })));
  const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
  if (r && st.sel !== "#viewport") {
    ring.hidden = false; Object.assign(ring.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
    const below = r.top < window.innerHeight / 2, bw = Math.min(320, window.innerWidth - 24);
    Object.assign(box.style, { left: Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + "px", top: below ? r.bottom + 14 + "px" : "auto", bottom: below ? "auto" : window.innerHeight - r.top + 14 + "px", transform: "none" });
  } else { ring.hidden = true; Object.assign(box.style, { left: "50%", top: "40%", bottom: "auto", transform: "translate(-50%,-50%)" }); }
}
window.addEventListener("resize", () => { if (TOURS) renderTour(); });

// ---- 2) 혼자 있을 때: 이 방에 남은 흔적 ----
const ROOM_FP = { yard: "yard", worship: "worship", cafe: "cafe", vision: "vision", room301: "room301", praise: "praise" };
function renderAlone() {
  let el = $("#aloneCard");
  const others = S.peers.filter((p) => p.id !== myId), fr = ROOM_FP[S.room];
  if (!started || others.length || !fr || !FPS.ok || TOURS) { if (el) el.hidden = true; return; }
  const mine = clip(S.profile?.name, LIMIT.name) || "";
  const list = FPS.list.filter((f) => f.room === fr && (f.name || "") !== mine).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const t = FPS.list.filter((f) => f.room === fr && isToday(f.created_at)), pray = t.filter((f) => f.kind === "pray").length, read = t.filter((f) => f.kind === "read").length;
  if (!el) { el = h("div", { id: "aloneCard", class: "alone-card" }); $("#viewport").append(el); }
  const last = list[0];
  const key = [S.room, last && last.id, pray, read].join("|"); if (el.dataset.key === key && !el.hidden) return; el.dataset.key = key;
  el.replaceChildren(...[h("b", { text: "🌱 지금은 나 혼자 있어요" }),
    h("span", { text: last ? `마지막으로 ${last.name || "익명"}님이 ${timeAgo(last.created_at)} ${last.kind === "pray" ? "기도하고 갔어요" : last.kind === "read" ? "말씀 읽고 갔어요" : "다녀갔어요"}` : "이 방의 첫 발자취를 남겨 봐요" }),
    pray || read ? h("span", { text: `오늘 이 방: ${pray ? `🙏 기도 ${pray}` : ""}${pray && read ? " · " : ""}${read ? `📖 말씀 ${read}장` : ""}` }) : null,
    h("button", { class: "btn ghost sm", text: "👣 발자취 보기", onclick: () => $("#dashBtn").click() }),
    h("button", { class: "x", text: "✕", title: "닫기", onclick: () => { el.hidden = true; el.dataset.closed = S.room; } })].filter(Boolean));
  el.hidden = el.dataset.closed === S.room;
}
setInterval(renderAlone, 3000);

// ---- 3) 서버(Supabase)가 잠들었거나 연결이 안 될 때 안내 ----
async function serverCheck() {
  if (!CFG.supabaseUrl || !CFG.supabaseKey) return; // 키가 없으면 원래 데모 모드
  let ok = !!window.supabase;
  if (ok) {
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/rest/v1/site_settings?select=key&limit=1", { headers: { apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey }, signal: ctl.signal });
      clearTimeout(tm); ok = r.status < 500;
    } catch (e) { ok = false; }
  }
  let b = $("#serverBanner");
  if (ok) { if (b) b.hidden = true; return; }
  if (!b) { b = h("div", { id: "serverBanner", class: "server-banner" }); document.body.prepend(b); }
  b.replaceChildren(h("b", { text: "⚠️ 지금 서버에 연결이 안 돼요" }), h("span", { text: window.supabase ? " 서버가 잠들어 있거나 인터넷이 불안정해요. 잠시 뒤 새로고침해 주세요. 계속되면 관리자에게 알려 주세요 (관리자: Supabase 대시보드에서 프로젝트 Restore)." : " 연결 도구를 불러오지 못했어요. 인터넷을 확인하고 새로고침해 주세요." }),
    h("button", { class: "btn ghost sm", text: "새로고침", onclick: () => location.reload() }));
  b.hidden = false;
}
serverCheck();

// ---- 4) 느린 폰이면 🪶 가볍게 보기를 알아서 켜요 (한 번만) ----
(function autoLite() {
  if (store.get("lite", false) || store.get("autoLiteDone", false)) return;
  let n = 0, t0 = 0, slow = 0;
  const step = (t) => {
    if (document.visibilityState !== "visible" || !started) { t0 = 0; n = 0; requestAnimationFrame(step); return; }
    if (!t0) t0 = t; n++;
    const dt = t - t0;
    if (dt > 4000) { const fps = (n * 1000) / dt; slow = fps < 22 ? slow + 1 : 0; t0 = t; n = 0;
      if (slow >= 2) { store.set("autoLiteDone", true); setLite(true, true); toast("🪶 화면이 느려서 가볍게 보기를 켰어요 (오른쪽 위 🪶로 끌 수 있어요)"); return; }
      if (performance.now() > 40000) { store.set("autoLiteDone", true); return; } }
    requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), 6000);
})();

// ---- 5) 📱 기기 연결 코드 ----
// 화면: 처음엔 큰 버튼 두 개 → 누른 쪽만 보여요
//  📤 "이 기기 기록을 보내기" = 코드 만들기 (원래 쓰던 기기) → 다른 기기에서 넣으면 이 기기도 저절로 새로고침
//  📥 "다른 기기 기록 가져오기" = 코드 넣기 (새 기기) → 합친 뒤 새로고침
let LINKT = null;
function openLink(intro) { clearInterval(LINKT); renderLink("home", intro); openModal("linkModal"); }
function renderLink(step, intro) {
  const body = $("#linkBody"); clearInterval(LINKT);
  const back = h("button", { class: "btn ghost sm", text: "← 처음으로", onclick: () => renderLink("home") });
  if (step === "home") {
    body.replaceChildren(...[
      intro ? h("p", { class: "link-intro", text: intro }) : null,
      h("p", { class: "muted", text: "폰과 컴퓨터(또는 아이폰 홈 화면 앱과 사파리)는 기록이 따로 쌓여요. 한 번 연결하면 두 기기가 같은 사람이 되고, 미션·통독·랭킹 기록이 합쳐져요." }),
      h("button", { class: "link-big", onclick: () => renderLink("send") }, h("b", { text: "📤 이 기기에서 코드 만들기" }), h("span", { text: "기록이 많은, 원래 쓰던 기기에서 눌러요" })),
      h("button", { class: "link-big", onclick: () => renderLink("get") }, h("b", { text: "📥 다른 기기의 코드 넣기" }), h("span", { text: "새 기기(기록이 없는 쪽)에서 눌러요" })),
      h("p", { class: "muted tiny", text: "순서: ① 원래 기기에서 📤 → 6자리 숫자가 나와요 ② 새 기기에서 📥 → 그 숫자를 넣어요. 끝나면 두 기기 모두 저절로 새로 불러와요." }),
      api.demo ? h("p", { class: "muted tiny", text: "데모 모드에서는 같은 브라우저 안에서만 흉내 내요." }) : null].filter(Boolean));
    return;
  }
  if (step === "send") {
    const box = h("div", { class: "link-code" }, h("small", { text: "코드를 만드는 중…" }));
    body.replaceChildren(h("div", { class: "link-step" }, h("b", { text: "📤 이 기기에서 코드 만들기" }), box,
      h("p", { class: "muted tiny", text: "다른 기기에서 📥 '다른 기기의 코드 넣기'를 누르고 이 숫자를 넣어 주세요. 이 창은 열어 두세요 — 연결되면 이 기기도 저절로 새로 불러와요." })),
      h("p", { class: "muted tiny", text: "🔒 코드는 10분만 쓸 수 있어요. 다른 사람에게 알려 주지 마세요." }), back);
    (async () => {
      let code;
      try { code = String(await api.deviceCodeMake()); } catch (e) { box.replaceChildren(h("small", { text: "코드를 만들지 못했어요: " + e.message })); return; }
      const until = Date.now() + 600e3;
      const draw = (msg) => { const left = Math.max(0, Math.ceil((until - Date.now()) / 1000)); box.replaceChildren(h("b", { text: code.replace(/(\d{3})(\d{3})/, "$1 $2") }), h("small", { text: msg || (left ? `다른 기기에서 넣어 주세요 · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} 남음` : "시간이 지났어요. ← 처음으로 가서 다시 만들어요") })); return left; };
      draw(); let n = 0;
      LINKT = setInterval(async () => {
        if ($("#linkModal").hidden) { clearInterval(LINKT); return; }
        if (!draw()) { clearInterval(LINKT); return; }
        if (++n % 3) return; // 3초마다 연결됐는지 물어봐요
        try { const st = await api.deviceCodeStatus(code); if (st === "used") { clearInterval(LINKT); draw("✅ 연결됐어요! 합친 기록을 다시 불러올게요"); toast("📱 연결됐어요! 합친 기록을 불러와요"); localStorage.removeItem("oc_mlog"); setTimeout(() => location.reload(), 1600); } } catch (e) {}
      }, 1000);
    })();
    return;
  }
  // 📥 코드 넣기
  const inp = h("input", { class: "link-input", inputmode: "numeric", maxlength: 7, placeholder: "123 456", autocomplete: "off" });
  const warn = h("p", { class: "link-warn", hidden: true, text: "이 기기의 기록이 코드를 만든 기기와 합쳐지고, 앞으로 두 기기는 같은 사람으로 기록돼요. 한 번 더 누르면 연결해요." });
  let armed = false;
  const go = h("button", { class: "btn primary", text: "연결하기", onclick: async () => {
    const code = inp.value.replace(/\D/g, "");
    if (code.length !== 6) return toast("6자리 숫자를 넣어 주세요");
    if (!armed) { armed = true; go.textContent = "정말 연결할게요"; warn.hidden = false; return; }
    go.disabled = true;
    try {
      const r = await api.deviceLink(code);
      if (r && r.error) throw new Error(r.error);
      if (!r || !r.token) throw new Error("연결하지 못했어요");
      store.set("token", r.token); store.set("readSync1", false); localStorage.removeItem("oc_mlog");
      if (S.profile) { S.profile.upd = 0; if (r.name && !S.profile.name) S.profile.name = r.name; store.set("profile", S.profile); } store.set("profSent", ""); // 원래 기기의 캐릭터가 이 기기에도 오게
      toast("📱 연결됐어요! 합친 기록을 다시 불러올게요"); setTimeout(() => location.reload(), 1500);
    } catch (e) { toast(e.message); go.disabled = false; armed = false; go.textContent = "연결하기"; warn.hidden = true; }
  } });
  body.replaceChildren(h("div", { class: "link-step" }, h("b", { text: "📥 다른 기기의 코드 넣기" }), h("p", { class: "muted tiny", text: "원래 쓰던 기기에서 📤로 만든 6자리 숫자를 넣어요" }), h("div", { class: "link-row" }, inp, go), warn), back);
  setTimeout(() => inp.focus(), 50);
}
async function linkPromptCheck() {
  if (store.get("linkAsked", false) || api.demo) return;
  const few = Object.keys(MS.log || {}).length <= 1;
  if (!few) { store.set("linkAsked", true); return; }
  const standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  let intro = null;
  if (standalone) intro = "📱 사파리나 다른 기기에서 쓰던 기록이 있나요? 연결하면 미션·통독 기록이 이어져요.";
  else if (S.profile?.name) { try { if (await api.nameKnown(clip(S.profile.name, LIMIT.name))) intro = `혹시 다른 기기에서 쓰던 ${clip(S.profile.name, LIMIT.name)}님이세요? 원래 기기에서 코드를 만들면 기록을 합칠 수 있어요.`; } catch (e) {} }
  if (!intro) return;
  store.set("linkAsked", true);
  setTimeout(() => { if (!$("#welcomeModal").hidden) { const iv = setInterval(() => { if ($("#welcomeModal").hidden) { clearInterval(iv); openLink(intro); } }, 800); } else openLink(intro); }, 600);
}
$("#linkBtn").onclick = () => { closeModal("entryModal"); preview && preview.stop(); openLink(); };
$("#tourAgainBtn").onclick = () => { closeModal("entryModal"); preview && preview.stop(); startTour(); };

// ---- 6) 관리자 요약판 ----
async function renderAdminSummary(pw) {
  const box = $("#adminSummary"); if (!box) return;
  box.replaceChildren(h("p", { class: "muted tiny", text: "이번 주 숫자를 불러오는 중…" }));
  try {
    const d = await api.adminSummary(pw); if (!d) { box.replaceChildren(); return; }
    const cell = (e, n, l, warn) => h("div", { class: "sum-cell" + (warn && n ? " warn" : "") }, h("b", { text: `${e} ${n == null ? "-" : Number(n).toLocaleString()}` }), h("span", { text: l }));
    box.replaceChildren(h("div", { class: "board-label", text: "📊 이번 주 한눈에 (최근 7일)" }),
      h("div", { class: "sum-grid" }, cell("👥", d.visitors7, "다녀간 사람"), cell("🌱", d.today, "오늘 다녀간 사람"), cell("🙏", d.prayers7, "기도"), cell("📖", d.reads7, "읽은 장"),
        cell("✅", d.stamps7, "미션 다 한 날"), cell("🧀", d.orders_new, "새 주문 (확인 전)", true), cell("🛒", d.orders_week, "이번 주 주문"), cell("🚩", d.reports, "신고된 방명록", true),
        cell("📅", d.events_next, "2주 안 모임"), cell("🗓", d.members30, "30일 동안 온 사람")));
  } catch (e) { box.replaceChildren(h("p", { class: "muted tiny", text: "요약을 불러오지 못했어요: " + e.message })); }
}

if (S.profile) { started = true; joinRoom("yard", "def"); profilePull(); loadMissions().then(() => setTimeout(() => { maybeWelcome(); linkPromptCheck(); }, 1200)); } else { W.setRoom("yard"); $$(".panel").forEach((p) => (p.hidden = p.dataset.room !== "yard")); openEntry(true); }
loadFootprints();

})();
