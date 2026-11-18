/* =====================================================================
   퀸즈 장로교회 · 3D 월드 (마당 / 본당 / 성경 읽는 공간)
   three.js r149 (lib/three.min.js) 사용
   * 코드 안의 방 이름은 그대로예요: worship = 본당(기도하는 공간), cafe = 성경 읽는 공간
   ===================================================================== */
(function () {
"use strict";
const T = window.THREE;

/* ---------------- 캐릭터 옵션 ---------------- */
const LOOK = {
  hairs: [["short", "짧은 머리"], ["bob", "단발"], ["long", "긴 머리"], ["pony", "포니테일"], ["bun", "똥머리"], ["curly", "뽀글 파마"], ["bobperm", "단발 파마"], ["longperm", "긴머리 파마"]],
  hairColors: [["#2b2220", "검정"], ["#5a3a26", "진갈색"], ["#9a6a3a", "밝은 갈색"], ["#d9b46a", "금발"]],
  glasses: [["none", "없음"], ["round", "동그란 안경"], ["square", "네모 안경"], ["sun", "🕶 선글라스"]],
  shirts: ["#e8a87c", "#85b8a0", "#8fa8d6", "#d69ac2", "#e6c86e", "#b39ddb", "#f08a8a", "#7fb3c9"],
  genders: [["m", "남자"], ["f", "여자"]],
  // 손에 드는 것 (교회에서 자주 보이는 것들)
  // 🔒 scroll(두루마리 성경) · basket(곡식 바구니)은 미션으로 받는 특별 아이템이에요 (app.js 🎯 미션)
  items: [["none", "없음"], ["guitar", "🎸 기타"], ["tambourine", "🪘 탬버린"], ["coffee", "☕ 커피"], ["bible", "📖 성경책"], ["mic", "🎤 마이크"], ["scroll", "📜 두루마리 성경"], ["basket", "🌾 곡식 바구니"], ["grapes", "🍇 포도송이"]],
  // 착용 (머리·목) · 🔒 wheathat(밀 이삭 모자)은 맥추감사절 스킨
  wears: [["none", "없음"], ["santa", "🎅 산타 모자"], ["beanie", "🧶 털모자"], ["scarf", "🧣 목도리"], ["antlers", "🦌 루돌프 머리띠"], ["wheathat", "🌿 밀 이삭 모자"]],
  // ✨ 특별 스킨 (전부 미션으로 받아요)
  halos: [["none", "없음"], ["sprout1", "🌱 새싹 하나"], ["sprout2", "🌱🌱 새싹 둘"], ["bud", "🌷 꽃봉오리 새싹"], ["star", "⭐ 베들레헴 별"], ["rainbow", "🌈 언약의 무지개"]],
  shoulders: [["none", "없음"], ["dove", "🕊 비둘기"]],
  aprons: [["none", "없음"], ["cheese", "🧀 치즈 앞치마"]],
  pins: [["none", "없음"], ["lily", "🤍 백합 배지"]],
  trails: [["none", "없음"], ["sprout", "🌱 새싹 발자국"]],
};
const pick = (v, list, d) => (list.includes(v) ? v : d);
function safeLook(p) {
  return {
    hair: pick(p.hair, LOOK.hairs.map((x) => x[0]), "short"),
    hairColor: pick(p.hairColor, LOOK.hairColors.map((x) => x[0]), "#2b2220"),
    glasses: pick(p.glasses, LOOK.glasses.map((x) => x[0]), "none"),
    color: pick(p.color, LOOK.shirts, LOOK.shirts[0]),
    gender: pick(p.gender, LOOK.genders.map((x) => x[0]), "m"),
    item: pick(p.item, LOOK.items.map((x) => x[0]), "none"),
    wear: pick(p.wear, LOOK.wears.map((x) => x[0]), "none"),
    halo: pick(p.halo, LOOK.halos.map((x) => x[0]), "none"),
    shoulder: pick(p.shoulder, LOOK.shoulders.map((x) => x[0]), "none"),
    apron: pick(p.apron, LOOK.aprons.map((x) => x[0]), "none"),
    pin: pick(p.pin, LOOK.pins.map((x) => x[0]), "none"),
    trail: pick(p.trail, LOOK.trails.map((x) => x[0]), "none"),
    pet: Number.isInteger(p.pet) && p.pet >= 0 && p.pet < 5 ? p.pet : -1, // 🐱 따라다니는 고양이 (CATS 번호, 카드 그림용)
    pets: Array.isArray(p.pets) ? [...new Set(p.pets.filter((k) => Number.isInteger(k) && k >= 0 && k < 5))].slice(0, 5) : Number.isInteger(p.pet) && p.pet >= 0 && p.pet < 5 ? [p.pet] : [], // 🐾 산책 중인 고양이들 (2026-11-18)
    catBoss: !!p.catBoss, // 👑 고양이 대장 (까맹이도 딴 데 안 가요)
    costume: typeof p.costume === "string" && COSTUMES[p.costume] ? p.costume : "", // 🎁 오늘의 선물 (24시간)
  };
}
// 모양이 바뀌면 캐릭터를 다시 만들어요 (trail·pet은 몸에 붙는 게 아니라서 빼요)
const lookKeyOf = (l) => [l.hair, l.hairColor, l.glasses, l.color, l.gender, l.item, l.wear, l.halo, l.shoulder, l.apron, l.pin, l.costume].join("|");

/* ---------------- 재료 / 텍스처 ---------------- */
const matCache = new Map();
function M(color, rough = 0.8, extra) {
  const key = color + "|" + rough + "|" + (extra ? JSON.stringify(extra) : "");
  if (!matCache.has(key)) matCache.set(key, new T.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra || {})));
  return matCache.get(key);
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function woodTex(base, rep, dark) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 200;
      while (x < w) {
        const len = 140 + rnd() * 160;
        const l = 0.88 + rnd() * 0.22;
        g.fillStyle = `rgba(${dark ? "60,35,20" : "120,80,40"},${(1 - l) * 0.9 + 0.04})`;
        g.fillRect(x, r * h / rows, len, h / rows);
        g.fillStyle = "rgba(60,35,15,.35)";
        g.fillRect(x, r * h / rows, 2, h / rows);
        x += len;
      }
      g.fillStyle = "rgba(60,35,15,.3)"; g.fillRect(0, r * h / rows, w, 2);
    }
  }, rep);
}
function brickTex(rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#d9cbb8"; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 48;
    for (let r = 0; r < h / bh; r++) {
      for (let x = (r % 2) * -bw / 2; x < w; x += bw) {
        const v = 0.85 + rnd() * 0.25;
        g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(72 * v)},${Math.round(52 * v)})`;
        g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      }
    }
  }, rep);
}
function grassTex(rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#7fae5a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = rnd() < 0.5 ? "rgba(70,120,50,.35)" : "rgba(160,200,110,.35)"; g.fillRect(rnd() * w, rnd() * h, 2, 3); }
  }, rep);
}
function ceilingTex(rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f4f2ee"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#cfcac2"; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = "rgba(0,0,0,.04)"; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }, rep);
}
function textTex(lines, opt = {}) {
  const w = opt.w || 512, h = opt.h || 256;
  return canvasTex(w, h, (g) => {
    g.fillStyle = opt.bg || "#2f4a3a"; g.fillRect(0, 0, w, h);
    if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
    g.fillStyle = opt.fg || "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach(([txt, size, y, color]) => { g.font = `700 ${size}px "Gowun Batang", "Apple SD Gothic Neo", serif`; g.fillStyle = color || opt.fg || "#fff"; g.fillText(txt, w / 2, y); });
  });
}

/* ---------------- 도형 도우미 ---------------- */
function box(parent, w, h, d, mat, x, y, z, o = {}) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  if (o.ry) m.rotation.y = o.ry;
  parent.add(m); return m;
}
function plane(parent, w, h, mat, x, y, z, rx = 0, ry = 0) {
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true;
  parent.add(m); return m;
}
function cyl(parent, rt, rb, h, mat, x, y, z, seg = 16) {
  const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

/* ---------------- 캐릭터 ---------------- */
const SKIN = "#f6d7bd";
function makeCharacter(lookIn) {
  const look = safeLook(lookIn || {});
  const g = new T.Group();
  const shirt = M(look.color, 0.75);
  const skin = M(SKIN, 0.65);
  const hairM = M(look.hairColor, 0.55, { side: T.DoubleSide });
  const dark = M("#2a2522", 0.4);
  const pants = M("#3d4a5c", 0.8);
  const shoe = M("#4b3a30", 0.7);

  const legGeo = new T.CylinderGeometry(0.078, 0.07, 0.32, 10); legGeo.translate(0, -0.16, 0);
  const legL = new T.Mesh(legGeo, pants); legL.position.set(-0.1, 0.34, 0);
  const legR = new T.Mesh(legGeo, pants); legR.position.set(0.1, 0.34, 0);
  for (const L of [legL, legR]) { const s = new T.Mesh(new T.BoxGeometry(0.13, 0.07, 0.2), shoe); s.position.set(0, -0.32, 0.03); L.add(s); L.castShadow = true; g.add(L); }

  const body = new T.Mesh(new T.CylinderGeometry(0.19, 0.25, 0.44, 16), shirt);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const collar = new T.Mesh(new T.TorusGeometry(0.15, 0.03, 6, 16), M("#ffffff", 0.7));
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.77; g.add(collar);

  const armGeo = new T.CapsuleGeometry(0.058, 0.2, 4, 8); armGeo.translate(0, -0.13, 0);
  const armL = new T.Mesh(armGeo, shirt); armL.position.set(-0.235, 0.73, 0); armL.rotation.z = 0.18;
  const armR = new T.Mesh(armGeo, shirt); armR.position.set(0.235, 0.73, 0); armR.rotation.z = -0.18;
  for (const A of [armL, armR]) { const hnd = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), skin); hnd.position.y = -0.3; A.add(hnd); A.castShadow = true; g.add(A); }

  const head = new T.Group(); head.position.y = 1.03; g.add(head);
  const skull = new T.Mesh(new T.SphereGeometry(0.3, 28, 20), skin); skull.castShadow = true; head.add(skull);
  const eyesOpen = new T.Group(), eyesClosed = new T.Group();
  for (const sx of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(0.036, 10, 8), dark); e.position.set(0.1 * sx, 0.0, 0.275); eyesOpen.add(e);
    const hl = new T.Mesh(new T.SphereGeometry(0.011, 6, 6), M("#ffffff", 0.3)); hl.position.set(0.1 * sx + 0.012, 0.014, 0.305); eyesOpen.add(hl);
    const c = new T.Mesh(new T.TorusGeometry(0.035, 0.008, 4, 10, Math.PI), dark); c.position.set(0.1 * sx, 0.005, 0.282); c.rotation.z = Math.PI; eyesClosed.add(c);
    const bl = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), M("#f5a8a0", 0.8)); bl.scale.set(1, 0.55, 0.3); bl.position.set(0.17 * sx, -0.075, 0.245); head.add(bl);
  }
  eyesClosed.visible = false; head.add(eyesOpen, eyesClosed);
  const mouth = new T.Mesh(new T.TorusGeometry(0.035, 0.008, 4, 10, Math.PI), dark); mouth.position.set(0, -0.095, 0.287); mouth.rotation.z = Math.PI; head.add(mouth);

  // 머리카락
  // 모자(산타 모자·털모자)를 쓰면 모자 안에 들어갈 윗머리는 만들지 않아요 → 머리카락이 모자를 뚫고 나오지 않게
  const hat = look.wear === "santa" || look.wear === "beanie" || look.wear === "wheathat" || (COSTUMES[look.costume] && COSTUMES[look.costume].hat);
  const HAT_TS = Math.PI * 0.36; // 이 각도(위에서부터)보다 위쪽 머리는 모자 속
  const sph = (r, ps, pl, ts, tl) => {
    if (hat && ts < HAT_TS) { const end = ts + tl; ts = HAT_TS; tl = end - HAT_TS; if (tl <= 0.01) return new T.Group(); }
    return new T.Mesh(new T.SphereGeometry(r, 26, 16, ps, pl, ts, tl), hairM);
  };
  const addCap = () => head.add(sph(0.318, 0, Math.PI * 2, 0, Math.PI * 0.43));
  const style = look.hair;
  if (style === "curly") {
    const n = 46, ga = Math.PI * (3 - Math.sqrt(5));
    const geo = new T.SphereGeometry(0.088, 10, 8);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.25, r = Math.sqrt(Math.max(0, 1 - y * y)), th = ga * i;
      const p = new T.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(0.3);
      if (p.y < -0.17) continue;
      if (p.z > 0.12 && p.y < 0.13) continue;
      if (hat && p.y > 0.09) continue; // 모자 속
      const m = new T.Mesh(geo, hairM); m.position.copy(p); head.add(m);
    }
  } else {
    if (style !== "bobperm" && style !== "longperm") addCap(); // 파마는 앞머리 없이 (아래에서 따로 만들어요)
    if (style === "short" || style === "pony" || style === "bun") head.add(sph(0.322, Math.PI, Math.PI, 0, Math.PI * 0.62));
    if (style === "bob" || style === "long") head.add(sph(0.335, Math.PI * 0.82, Math.PI * 1.36, 0, Math.PI * 0.66));
    if (style === "long") {
      const back = new T.Mesh(new T.CylinderGeometry(0.33, 0.29, 0.5, 20, 1, true, Math.PI * 0.4, Math.PI * 1.2), hairM);
      back.position.set(0, -0.3, -0.02); head.add(back);
    }
    if (style === "pony") {
      const knot = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), hairM); knot.position.set(0, 0.06, -0.31); head.add(knot);
      const tail = new T.Mesh(new T.CapsuleGeometry(0.08, 0.26, 4, 10), hairM); tail.position.set(0, -0.14, -0.38); tail.rotation.x = 0.35; head.add(tail);
    }
    if (style === "bun") { const bun = new T.Mesh(new T.SphereGeometry(0.13, 14, 12), hairM); if (hat) bun.position.set(0, -0.02, -0.33); else bun.position.set(0, 0.32, -0.07); head.add(bun); } // 모자를 쓰면 뒤로 낮게 묶어요
    // 파마: 옆·뒤로 동글동글한 컬. 단발 파마는 턱까지, 긴머리 파마는 어깨 아래까지
    // 앞머리 없이 이마를 드러내요 (윗머리는 이마 위에서 끝나고, 옆·뒤만 내려와요)
    if (style === "bobperm" || style === "longperm") {
      const geo = new T.SphereGeometry(0.075, 10, 8), rows = style === "bobperm" ? 3 : 6;
      head.add(sph(0.326, 0, Math.PI * 2, 0, Math.PI * 0.33)); // 윗머리 (이마는 비워요 → 앞머리 없음)
      head.add(sph(0.33, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.6)); // 옆·뒷머리 (귀 옆까지)
      for (let k = 0; k < rows; k++) {
        const y = 0.06 - k * 0.11, rad = 0.31 + Math.min(k, 3) * 0.018 + (k > 3 ? 0.02 : 0), n = 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (k % 2) * 0.22, x = Math.sin(a) * rad, z = Math.cos(a) * rad;
          if (z > 0.1 && y > -0.3) continue; // 얼굴 앞은 비워요
          if (z > 0.02 && y <= -0.3) continue; // 아래쪽은 뒤·옆으로만 늘어져요
          const m = new T.Mesh(geo, hairM); m.position.set(x, y, z - (k > 2 ? 0.04 : 0)); head.add(m);
        }
      }
    }
  }
  // 안경
  if (look.glasses === "sun") {
    const fm = M("#111", 0.25), lens = M("#141418", 0.08, { metalness: 0.6 });
    for (const sx of [-1, 1]) {
      const l = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.02, 20), lens); l.rotation.x = Math.PI / 2; l.scale.set(1.12, 1, 0.85); l.position.set(0.1 * sx, 0.0, 0.3); head.add(l);
      const arm = new T.Mesh(new T.BoxGeometry(0.014, 0.014, 0.22), fm); arm.position.set(0.185 * sx, 0.02, 0.2); head.add(arm);
      const shine = new T.Mesh(new T.CircleGeometry(0.018, 8), M("#ffffff", 0.2, { transparent: true, opacity: 0.6 })); shine.position.set(0.1 * sx - 0.03, 0.03, 0.312); head.add(shine);
    }
    const br = new T.Mesh(new T.BoxGeometry(0.05, 0.014, 0.014), fm); br.position.set(0, 0.02, 0.31); head.add(br);
  } else if (look.glasses !== "none") {
    const fm = M("#222", 0.3);
    const ring = look.glasses === "round" ? new T.TorusGeometry(0.072, 0.012, 8, 22) : new T.TorusGeometry(0.08, 0.012, 6, 4);
    for (const sx of [-1, 1]) {
      const r = new T.Mesh(ring, fm); r.position.set(0.1 * sx, 0.0, 0.3); if (look.glasses === "square") r.rotation.z = Math.PI / 4; head.add(r);
      const arm = new T.Mesh(new T.BoxGeometry(0.012, 0.012, 0.22), fm); arm.position.set(0.175 * sx, 0.01, 0.2); head.add(arm);
    }
    const br = new T.Mesh(new T.BoxGeometry(0.06, 0.012, 0.012), fm); br.position.set(0, 0.01, 0.305); head.add(br);
  }
  // 여자: 원피스 치마 + 속눈썹
  if (look.gender === "f") {
    const skirt = new T.Mesh(new T.CylinderGeometry(0.23, 0.33, 0.27, 18, 1, true), M(look.color, 0.75, { side: T.DoubleSide }));
    skirt.position.y = 0.3; skirt.castShadow = true; g.add(skirt);
    for (const sx of [-1, 1]) { const lash = new T.Mesh(new T.BoxGeometry(0.035, 0.008, 0.01), dark); lash.position.set(0.13 * sx, 0.03, 0.283); lash.rotation.z = sx * 0.5; eyesOpen.add(lash); }
  }
  const C = COSTUMES[look.costume];
  if (!(C && C.hat)) addWear(head, g, look.wear, look.color);
  // 🎁 오늘의 선물이 손에 드는 것이면 그날은 원래 들던 것 대신 그걸 들어요
  const inHandC = (obj) => { obj.position.add(new T.Vector3(0, -0.33, 0.04)); armR.add(obj); };
  const inHandL = (obj) => { obj.position.add(new T.Vector3(0, -0.33, 0.04)); armL.add(obj); }; // 왼손 (두 손에 하나씩 들 때)
  const hold = C && C.hand ? C.make({ head, g, armL, armR, inHand: inHandC, inHandL, look }) : addItem(g, armL, armR, look.item);
  if (C && !C.hand) C.make({ head, g, armL, armR, inHand: inHandC, inHandL, look });
  const sp = addSpecial(head, g, look);
  return { group: g, legL, legR, armL, armR, head, body, eyesOpen, eyesClosed, hold, halo: sp.halo, haloStar: sp.star, dove: sp.dove };
}
/* ---------------- 🎁 오늘의 선물: 하루짜리 꾸미기 · 희귀 성경 인물 착장 (2026-11-18) ---------------- */
// make({ head, g, armL, armR, inHand }) 로 몸에 붙여요. hand: 손에 드는 것(그날은 원래 들던 것 대신) · hat: 머리 위를 덮음
// ref: [책(1~66), 장, "표시"] · month: 그 달에만 나와요(12 = 성탄)
const COSTUMES = (() => {
  const C = {}, add = (id, o) => (C[id] = o);
  const robe = (g, col, opt = {}) => { // 무릎까지 오는 겉옷
    const m = opt.map ? new T.MeshStandardMaterial({ map: opt.map, roughness: 0.8, side: T.DoubleSide }) : M(col, 0.85, { side: T.DoubleSide });
    const top = new T.Mesh(new T.CylinderGeometry(0.205, 0.265, 0.46, 16, 1, true), m); top.position.y = 0.55; g.add(top);
    const low = new T.Mesh(new T.CylinderGeometry(0.265, 0.33, 0.36, 16, 1, true), m); low.position.y = 0.17; g.add(low);
    return m;
  };
  const cape = (g, col, map) => { const c = new T.Mesh(new T.CylinderGeometry(0.22, 0.36, 0.72, 16, 1, true, Math.PI * 0.62, Math.PI * 0.76), map ? new T.MeshStandardMaterial({ map, roughness: 0.85, side: T.DoubleSide }) : M(col, 0.85, { side: T.DoubleSide })); c.position.y = 0.48; g.add(c); return c; };
  const staff = (col = "#7a5230", h = 1.25) => { const s = new T.Group(); cyl(s, 0.018, 0.022, h, M(col, 0.7), 0, h / 2 - 0.25, 0, 6); return s; };
  const crown = (head, col = "#f2c84b", gem = "#c0392b") => {
    const gm = M(col, 0.25, { metalness: 0.7 }), c = new T.Group(); c.position.y = 0.27; head.add(c);
    cyl(c, 0.2, 0.22, 0.09, gm, 0, 0.0, 0, 18);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, sp = new T.Mesh(new T.ConeGeometry(0.035, 0.09, 4), gm); sp.position.set(Math.sin(a) * 0.2, 0.08, Math.cos(a) * 0.2); c.add(sp); }
    const j = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), M(gem, 0.2)); j.position.set(0, 0.0, 0.215); c.add(j);
  };
  const stripes = canvasTex(64, 256, (x, w, h) => { const cs = ["#d9483b", "#f2b632", "#3a8fd9", "#4f9a5a", "#8e44ad", "#e8862f", "#f6e7c8"]; for (let i = 0; i < 16; i++) { x.fillStyle = cs[i % cs.length]; x.fillRect(0, (i * h) / 16, w, h / 16 + 1); } }, [6, 1]);
  const starsTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = "#1f2f5c"; x.fillRect(0, 0, w, h); x.fillStyle = "#fff6c8"; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc((i * 53) % w, (i * 37) % h, 1.5 + (i % 3), 0, 7); x.fill(); } }, [3, 2]);

  // ---- 하루짜리 꾸미기 (자주 나와요) ----
  add("flower", { name: "꽃 화관", e: "🌸", hat: false, make: ({ head }) => { for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, f = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), M(k % 3 ? "#f7b6c8" : "#fff6e8", 0.6)); f.position.set(Math.sin(a) * 0.3, 0.2, Math.cos(a) * 0.3); head.add(f); if (k % 2) { const l = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), M("#6fae4a", 0.6)); l.scale.set(1.4, 0.4, 0.8); l.position.set(Math.sin(a + 0.2) * 0.31, 0.18, Math.cos(a + 0.2) * 0.31); head.add(l); } } } });
  add("rainbowscarf", { name: "무지개 목도리", e: "🌈", make: ({ g }) => { ["#e74c3c", "#f39c12", "#f1c40f", "#2ecc71", "#3498db"].forEach((c, i) => { const r = new T.Mesh(new T.TorusGeometry(0.165, 0.028, 6, 20), M(c, 0.9)); r.rotation.x = Math.PI / 2; r.position.y = 0.74 + i * 0.026; g.add(r); }); const t = box(g, 0.1, 0.3, 0.04, M("#3498db", 0.9), 0.09, 0.62, 0.2); t.rotation.z = 0.12; } });
  add("balloon", { name: "풍선 들기", e: "🎈", hand: true, make: ({ inHand }) => { const b = new T.Group(); cyl(b, 0.003, 0.003, 0.9, M("#ffffff", 0.6), 0, 0.45, 0, 3); const bl = new T.Mesh(new T.SphereGeometry(0.16, 14, 12), M(["#e74c3c", "#3498db", "#f1c40f", "#e84393"][Math.floor(Math.random() * 4)], 0.25)); bl.scale.set(1, 1.18, 1); bl.position.y = 1.0; b.add(bl); inHand(b); return "one"; } });
  add("sparkle", { name: "반짝이 별 안경", e: "✨", make: ({ head }) => { const gm = M("#f2c84b", 0.25, { metalness: 0.7, emissive: "#b8860b", emissiveIntensity: 0.3 }); for (const sx of [-1, 1]) { const st = new T.Mesh(new T.ExtrudeGeometry(starShape(0.085, 0.04), { depth: 0.015, bevelEnabled: false }), gm); st.position.set(0.1 * sx, 0, 0.29); head.add(st); } box(head, 0.06, 0.014, 0.014, gm, 0, 0.01, 0.3); } });
  add("earmuff", { name: "털 귀마개", e: "🎧", make: ({ head }) => { const fm = M("#f7d6e0", 0.95); for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), fm); e.position.set(0.31 * sx, 0.0, 0); head.add(e); } const band = new T.Mesh(new T.TorusGeometry(0.32, 0.018, 6, 24, Math.PI), M("#d98ca8", 0.6)); band.rotation.y = Math.PI / 2; head.add(band); } });
  add("ribbon", { name: "큰 리본 머리띠", e: "🎀", make: ({ head }) => { const rm = M("#e84393", 0.6); for (const sx of [-1, 1]) { const w = new T.Mesh(new T.ConeGeometry(0.09, 0.16, 4), rm); w.rotation.z = (Math.PI / 2) * sx; w.position.set(0.09 * sx, 0.33, 0.06); head.add(w); } const k = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), rm); k.position.set(0, 0.33, 0.06); head.add(k); } });

  // ---- ✨ 희귀: 성경 인물 착장 ----
  const R = (id, o) => add(id, Object.assign({ rare: true }, o));
  R("joseph", { name: "요셉의 채색옷", who: "요셉", e: "🌈", ref: [1, 37, "창세기 37:3"], make: ({ g }) => { robe(g, null, { map: stripes }); } });
  R("david", { name: "다윗의 물매와 돌", who: "다윗", e: "🪨", ref: [9, 17, "사무엘상 17:40"], hand: true, make: ({ g, inHand }) => { robe(g, "#c9a978"); const sl = new T.Group(); const st = new T.Mesh(new T.TorusGeometry(0.08, 0.008, 4, 12, Math.PI), M("#7a5230", 0.7)); st.rotation.z = Math.PI; sl.add(st); const p = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), M("#9a9a9a", 0.8)); p.position.y = -0.08; sl.add(p); inHand(sl); const bag = box(g, 0.14, 0.12, 0.06, M("#8a5a2e", 0.8), -0.2, 0.42, 0.22); void bag; for (let k = 0; k < 5; k++) { const s2 = new T.Mesh(new T.SphereGeometry(0.022, 6, 5), M("#b0b0a8", 0.8)); s2.position.set(-0.24 + k * 0.022, 0.49, 0.25); g.add(s2); } return "one"; } });
  R("moses", { name: "모세의 지팡이와 돌판", who: "모세", e: "📜", ref: [2, 34, "출애굽기 34:29"], hand: true, make: ({ g, inHand, inHandL }) => { robe(g, "#a0522d"); const sf = staff("#6b4a2a", 1.5); inHand(sf); const tb = new T.Group(); tb.position.set(0, 0.02, 0.06); tb.scale.setScalar(0.8); inHandL(tb); for (const sx of [-1, 1]) { const t = box(tb, 0.13, 0.2, 0.03, M("#a9a39a", 0.9), 0.07 * sx, 0, 0); const top = new T.Mesh(new T.CylinderGeometry(0.065, 0.065, 0.03, 12, 1, false, 0, Math.PI), M("#a9a39a", 0.9)); top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.set(0.07 * sx, 0.1, 0); tb.add(top); void t; } return "pair"; } });
  R("noah", { name: "노아의 비둘기", who: "노아", e: "🕊", ref: [1, 8, "창세기 8:11"], hand: true, make: ({ inHand, g }) => { robe(g, "#8a7a5a"); const d = new T.Group(); const w = M("#fbfbf7", 0.7); const b = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), w); b.scale.set(0.8, 0.75, 1.3); d.add(b); const hd = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), w); hd.position.set(0, 0.05, 0.06); d.add(hd); const lf = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), M("#5f9e3a", 0.6)); lf.scale.set(0.5, 0.25, 1.4); lf.position.set(0, 0.04, 0.12); d.add(lf); d.position.y = 0.08; inHand(d); return "one"; } });
  R("miriam", { name: "미리암의 소고", who: "미리암", e: "🪘", ref: [2, 15, "출애굽기 15:20"], hand: true, make: ({ inHand }) => { const t = new T.Group(); t.rotation.x = Math.PI / 2; t.add(new T.Mesh(new T.TorusGeometry(0.11, 0.02, 8, 20), M("#c9893f", 0.5))); t.add(new T.Mesh(new T.CircleGeometry(0.11, 20), M("#f4ead2", 0.8, { side: T.DoubleSide }))); ["#e74c3c", "#f1c40f", "#3498db"].forEach((c, i) => { const r = box(t, 0.02, 0.006, 0.28, M(c, 0.8), -0.05 + i * 0.05, 0, 0.2, { cast: false }); void r; }); t.position.set(0, -0.03, 0.06); inHand(t); return "one"; } });
  R("ruth", { name: "룻의 보리 이삭", who: "룻", e: "🌾", ref: [8, 2, "룻기 2:17"], hand: true, make: ({ inHand }) => { const b = new T.Group(); for (let k = 0; k < 7; k++) { const st = new T.Group(); st.rotation.z = -0.3 + k * 0.1; b.add(st); cyl(st, 0.004, 0.004, 0.3, M("#c9a64a", 0.8), 0, 0.12, 0, 4); const ear = new T.Mesh(new T.SphereGeometry(0.018, 6, 5), M("#d9b45a", 0.7)); ear.scale.set(0.7, 2.6, 0.7); ear.position.y = 0.3; st.add(ear); } cyl(b, 0.03, 0.03, 0.03, M("#8a5a2e", 0.8), 0, 0.02, 0, 8); inHand(b); return "one"; } });
  R("esther", { name: "에스더의 왕후 관", who: "에스더", e: "👑", ref: [17, 2, "에스더 2:17"], hat: true, make: ({ head, g }) => { crown(head); cape(g, "#6c3483"); } });
  R("peter", { name: "베드로의 그물과 물고기", who: "베드로", e: "🐟", ref: [40, 4, "마태복음 4:18"], hand: true, make: ({ g, inHand }) => { const net = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 0.5, 12, 4, true, Math.PI * 0.7, Math.PI * 0.8), new T.MeshStandardMaterial({ color: "#c8b88a", wireframe: true })); net.position.y = 0.55; g.add(net); const f = new T.Group(); const bd = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), M("#7fa6c0", 0.4, { metalness: 0.3 })); bd.scale.set(0.5, 1, 2); f.add(bd); const tl = new T.Mesh(new T.ConeGeometry(0.05, 0.06, 4), M("#7fa6c0", 0.4)); tl.rotation.x = Math.PI / 2; tl.position.z = -0.14; f.add(tl); f.rotation.x = -1.2; inHand(f); return "one"; } });
  R("paul", { name: "바울의 편지", who: "바울", e: "✉️", ref: [45, 1, "로마서 1:1"], hand: true, make: ({ g, inHand }) => { robe(g, "#5a6b8a"); const l = new T.Group(); box(l, 0.16, 0.2, 0.01, M("#f4ead2", 0.85), 0, 0, 0); for (let k = 0; k < 5; k++) box(l, 0.12, 0.006, 0.002, M("#7a6a5a", 0.8), 0, 0.06 - k * 0.03, 0.007, { cast: false }); l.rotation.set(0.25, 0, 0.15); l.position.z = 0.07; inHand(l); const bag = box(g, 0.16, 0.16, 0.07, M("#7a5230", 0.8), 0.22, 0.4, 0.06); void bag; const str = new T.Mesh(new T.TorusGeometry(0.28, 0.01, 4, 20, Math.PI), M("#6b4a2a", 0.8)); str.rotation.set(0, 0, -0.6); str.position.set(0.05, 0.62, 0.0); g.add(str); return "one"; } });
  R("daniel", { name: "다니엘과 사자", who: "다니엘", e: "🦁", ref: [27, 6, "다니엘 6:22"], make: ({ g }) => { robe(g, "#3d6b8a"); } });
  R("abraham", { name: "아브라함의 별 망토", who: "아브라함", e: "✨", ref: [1, 15, "창세기 15:5"], hand: true, make: ({ g, inHand }) => { cape(g, null, starsTex); inHand(staff("#7a5230", 1.35)); return "one"; } });
  R("elijah", { name: "엘리야의 겉옷과 까마귀", who: "엘리야", e: "🐦‍⬛", ref: [11, 17, "열왕기상 17:6"], make: ({ g }) => { cape(g, "#6b5a3a"); const rv = new T.Group(); rv.position.set(0.27, 0.9, 0.0); g.add(rv); const bm = M("#1d1d22", 0.4); const b = new T.Mesh(new T.SphereGeometry(0.065, 10, 8), bm); b.scale.set(0.8, 0.75, 1.3); rv.add(b); const hd = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), bm); hd.position.set(0, 0.06, 0.07); rv.add(hd); const bk = new T.Mesh(new T.ConeGeometry(0.014, 0.05, 6), M("#3a3a3a", 0.5)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.055, 0.12); rv.add(bk); const br = box(rv, 0.05, 0.03, 0.03, M("#d9b45a", 0.8), 0, 0.045, 0.15); void br; } });
  R("jonah", { name: "요나의 큰 물고기 모자", who: "요나", e: "🐋", ref: [32, 1, "요나 1:17"], hat: true, make: ({ head }) => { const fm = M("#5f8fb5", 0.5); const f = new T.Group(); f.position.y = 0.2; head.add(f); const b = new T.Mesh(new T.SphereGeometry(0.34, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), fm); f.add(b); const tl = new T.Mesh(new T.ConeGeometry(0.16, 0.24, 4), fm); tl.rotation.x = -Math.PI / 2; tl.scale.set(1.6, 1, 0.3); tl.position.set(0, 0.12, -0.42); f.add(tl); for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), M("#ffffff", 0.4)); e.position.set(0.17 * sx, 0.2, 0.22); f.add(e); const p = new T.Mesh(new T.SphereGeometry(0.022, 6, 5), M("#1a1a1a", 0.3)); p.position.set(0.17 * sx, 0.2, 0.26); f.add(p); } const sp = cyl(f, 0.012, 0.03, 0.18, M("#bfe3f5", 0.3, { transparent: true, opacity: 0.8 }), 0, 0.42, -0.1, 6); void sp; } });
  R("joshua", { name: "여호수아의 나팔", who: "여호수아", e: "📯", ref: [6, 6, "여호수아 6:20"], hand: true, make: ({ inHand }) => { const h = new T.Group(); const hn = new T.Mesh(new T.TorusGeometry(0.14, 0.025, 6, 16, Math.PI * 0.9), M("#d9c39a", 0.6)); h.add(hn); const bell = new T.Mesh(new T.ConeGeometry(0.05, 0.08, 10, 1, true), M("#d9c39a", 0.6, { side: T.DoubleSide })); bell.position.set(0.14, 0.02, 0); bell.rotation.z = -Math.PI / 2; h.add(bell); h.rotation.x = -0.6; inHand(h); return "one"; } });
  R("samuel", { name: "어린 사무엘의 세마포 에봇", who: "사무엘", e: "🤍", ref: [9, 2, "사무엘상 2:18"], make: ({ g }) => { const v = new T.Mesh(new T.CylinderGeometry(0.205, 0.25, 0.42, 16, 1, true, -Math.PI * 0.42, Math.PI * 0.84), M("#f6f1e4", 0.9, { side: T.DoubleSide })); v.position.y = 0.5; g.add(v); const belt = new T.Mesh(new T.TorusGeometry(0.235, 0.015, 4, 20), M("#c9a64a", 0.6)); belt.rotation.x = Math.PI / 2; belt.position.y = 0.42; g.add(belt); } });
  R("deborah", { name: "드보라의 종려나무 가지", who: "드보라", e: "🌴", ref: [7, 4, "사사기 4:5"], hand: true, make: ({ inHand }) => { const p = new T.Group(); cyl(p, 0.008, 0.01, 0.55, M("#6b8a3a", 0.7), 0, 0.27, 0, 5); for (let k = 0; k < 9; k++) for (const sx of [-1, 1]) { const lf = new T.Mesh(new T.BoxGeometry(0.16, 0.012, 0.03), M("#4f9a3a", 0.6)); lf.position.set(0.07 * sx, 0.3 + k * 0.03, 0); lf.rotation.z = sx * (0.5 - k * 0.03); p.add(lf); } inHand(p); return "one"; } });
  R("johnbaptist", { name: "세례 요한의 낙타털 옷", who: "세례 요한", e: "🐫", ref: [40, 3, "마태복음 3:4"], make: ({ g }) => { const fur = M("#a07a4a", 1.0, { side: T.DoubleSide }); const v = new T.Mesh(new T.CylinderGeometry(0.215, 0.29, 0.62, 12, 3, true), fur); v.position.y = 0.42; g.add(v); for (let k = 0; k < 18; k++) { const t = new T.Mesh(new T.SphereGeometry(0.04, 6, 5), fur); const a = k * 0.9; t.position.set(Math.sin(a) * 0.26, 0.2 + (k % 6) * 0.08, Math.cos(a) * 0.26); g.add(t); } const belt = new T.Mesh(new T.TorusGeometry(0.245, 0.02, 4, 20), M("#4a3020", 0.6)); belt.rotation.x = Math.PI / 2; belt.position.y = 0.4; g.add(belt); } });
  R("nehemiah", { name: "느헤미야의 성벽 돌", who: "느헤미야", e: "🧱", ref: [16, 2, "느헤미야 2:18"], hand: true, make: ({ inHand, g }) => { robe(g, "#7a6a5a"); const b = new T.Group(); box(b, 0.16, 0.09, 0.1, M("#b9a88a", 0.9), 0, 0, 0); box(b, 0.16, 0.09, 0.1, M("#a89878", 0.9), 0.03, 0.095, 0); b.position.z = 0.06; inHand(b); return "one"; } });
  R("jacob", { name: "야곱의 사닥다리", who: "야곱", e: "🪜", ref: [1, 28, "창세기 28:12"], hand: true, make: ({ g, inHand }) => { robe(g, "#8a6a4a"); const l = new T.Group(); l.position.set(0.02, 0.22, 0.04); l.rotation.y = 0.5; const wm = M("#b98a5a", 0.7); for (const sx of [-1, 1]) box(l, 0.022, 0.85, 0.022, wm, 0.08 * sx, 0, 0); for (let k = 0; k < 6; k++) box(l, 0.16, 0.018, 0.018, wm, 0, -0.36 + k * 0.14, 0); inHand(l); return "one"; } });
  R("rebekah", { name: "리브가의 물 항아리", who: "리브가", e: "🏺", ref: [1, 24, "창세기 24:15"], hand: true, make: ({ g, inHand }) => { robe(g, "#d9a05b"); const j = new T.Group(); j.position.set(0, -0.06, 0.07); j.scale.setScalar(0.75); const jm = M("#c97a4a", 0.7); const b = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), jm); b.scale.y = 1.2; j.add(b); cyl(j, 0.05, 0.07, 0.08, jm, 0, 0.15, 0, 12); const hd = new T.Mesh(new T.TorusGeometry(0.05, 0.012, 5, 10), jm); hd.position.set(0, 0.2, 0); j.add(hd); inHand(j); return "one"; } });
  R("aaron", { name: "아론의 싹 난 지팡이", who: "아론", e: "🌸", ref: [4, 17, "민수기 17:8"], hand: true, make: ({ g, inHand }) => { robe(g, "#3a5a8a"); const sf = staff("#7a5230", 1.35); for (let k = 0; k < 9; k++) { const fl = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), M(k % 3 ? "#fbe3ea" : "#ffffff", 0.6)); fl.position.set(Math.sin(k * 2.1) * 0.04, 0.55 + k * 0.05, Math.cos(k * 2.1) * 0.04); sf.add(fl); const lf = new T.Mesh(new T.SphereGeometry(0.022, 6, 5), M("#6fae4a", 0.6)); lf.scale.set(1.5, 0.4, 0.8); lf.position.set(Math.cos(k * 1.7) * 0.05, 0.57 + k * 0.05, Math.sin(k * 1.7) * 0.05); sf.add(lf); } inHand(sf); return "one"; } });
  R("lydia", { name: "루디아의 자주 옷감", who: "루디아", e: "🟣", ref: [44, 16, "사도행전 16:14"], hand: true, make: ({ g, inHand }) => { const pm = M("#7b2d8b", 0.6, { side: T.DoubleSide }); const sash = new T.Mesh(new T.TorusGeometry(0.3, 0.06, 6, 24, Math.PI * 1.1), pm); sash.rotation.set(0, Math.PI / 2, 0.75); sash.position.set(0, 0.56, 0); sash.scale.set(1, 1, 0.8); g.add(sash); const rl = new T.Group(); const roll = cyl(rl, 0.05, 0.05, 0.26, pm, 0, 0, 0, 12); roll.rotation.x = Math.PI / 2; rl.position.set(0, -0.02, 0.08); inHand(rl); return "one"; } });
  R("samson", { name: "삼손의 일곱 가닥 머리", who: "삼손", e: "💪", ref: [7, 16, "사사기 16:13"], make: ({ head, look }) => { const hm = M(look.hairColor || "#2b2220", 0.55); for (let k = 0; k < 7; k++) { const a = Math.PI * (0.55 + (k / 6) * 0.9), br = new T.Mesh(new T.CapsuleGeometry(0.03, 0.42, 4, 6), hm); br.position.set(Math.sin(a) * 0.27, -0.26, Math.cos(a) * 0.27); head.add(br); } } });
  R("gideon", { name: "기드온의 빈 항아리", who: "기드온", e: "🏺", ref: [7, 7, "사사기 7:16"], hand: true, make: ({ inHand, g }) => { robe(g, "#6b7a4a"); const j = new T.Group(); const jm = M("#b5703f", 0.8); const b = new T.Mesh(new T.SphereGeometry(0.08, 12, 10), jm); b.scale.y = 1.2; j.add(b); cyl(j, 0.04, 0.05, 0.05, jm, 0, 0.1, 0, 10); j.position.z = 0.05; inHand(j); return "one"; } });
  R("shepherd", { name: "베들레헴 목자", who: "목자들", e: "🐑", ref: [42, 2, "누가복음 2:8"], month: 12, hand: true, make: ({ g, head, inHand, inHandL }) => { robe(g, "#9a8a6a"); const hood = new T.Mesh(new T.SphereGeometry(0.335, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M("#c9b48a", 0.9, { side: T.DoubleSide })); head.add(hood); const sf = new T.Group(); cyl(sf, 0.018, 0.02, 1.3, M("#7a5230", 0.7), 0, 0.4, 0, 6); const hk = new T.Mesh(new T.TorusGeometry(0.08, 0.018, 5, 12, Math.PI), M("#7a5230", 0.7)); hk.position.set(0.08, 1.05, 0); sf.add(hk); inHand(sf); const lamb = new T.Group(); lamb.position.set(0.04, 0.02, 0.1); lamb.rotation.y = Math.PI / 2; lamb.scale.setScalar(0.85); inHandL(lamb); const wool = M("#f7f5ee", 1); const b = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), wool); b.scale.set(1.3, 0.9, 0.9); lamb.add(b); const hd = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), M("#3a3330", 0.6)); hd.position.set(0.14, 0.03, 0.02); lamb.add(hd); return "pair"; } });
  R("magi", { name: "동방박사의 예물", who: "동방박사", e: "🎁", ref: [40, 2, "마태복음 2:11"], month: 12, hat: true, hand: true, make: ({ g, head, inHand }) => { cape(g, "#8e44ad"); const tb = new T.Mesh(new T.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), M("#f6e7c8", 0.8)); tb.scale.y = 1.25; head.add(tb); const jw = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), M("#c0392b", 0.2)); jw.position.set(0, 0.25, 0.3); head.add(jw); const ch = new T.Group(); box(ch, 0.18, 0.12, 0.12, M("#c99a2e", 0.3, { metalness: 0.7 }), 0, 0, 0); box(ch, 0.19, 0.03, 0.13, M("#8a5a2e", 0.6), 0, 0.07, 0); ch.position.z = 0.07; inHand(ch); return "one"; } });
  return C;
})();
function makeLion() { // 🦁 다니엘과 함께 다니는 사자 (단 6:22 · 하루짜리 착장)
  const l = makeCat({ name: "사자", base: "#d9a24a", chest: "#f0d49a", size: 2.3, eyes: "#3a2a10", nose: "#4a3020" });
  const mane = new T.Mesh(new T.TorusGeometry(0.11, 0.06, 8, 16), M("#8a5222", 0.95)); mane.position.set(0, 0, -0.02); l.head.add(mane);
  const back = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), M("#8a5222", 0.95)); back.position.set(0, 0, -0.05); back.scale.set(1, 1, 0.5); l.head.add(back);
  return l;
}

/* ---------------- ✨ 특별 스킨 (미션으로 받아요) ---------------- */
// 머리 위 새싹(연속 출석) · 베들레헴 별(크리스마스) · 어깨 비둘기(성령강림절) · 치즈 앞치마(쫀득쿠키 10박스) · 백합 배지(부활절)
const SPROUT_Y = { none: 0.27, santa: 0.5, beanie: 0.43, wheathat: 0.4, antlers: 0.3, scarf: 0.27 };
function makeSprout(n, bud) {
  const g = new T.Group(), stemM = M("#5f9e3a", 0.6), leafM = M("#7cc24a", 0.55, { side: T.DoubleSide });
  const one = (x, lean) => {
    const s = new T.Group(); s.position.x = x; s.rotation.z = lean; g.add(s);
    const stem = new T.Mesh(new T.CylinderGeometry(0.012, 0.016, 0.16, 6), stemM); stem.position.y = 0.08; s.add(stem);
    for (const sx of [-1, 1]) {
      const lf = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), leafM); lf.scale.set(1, 0.32, 0.55);
      lf.position.set(0.055 * sx, 0.17, 0); lf.rotation.z = sx * 0.45; s.add(lf);
    }
    if (bud) {
      const b = new T.Mesh(new T.SphereGeometry(0.04, 12, 10), M("#f58fb0", 0.5)); b.scale.set(0.85, 1.25, 0.85); b.position.y = 0.23; s.add(b);
      for (let k = 0; k < 3; k++) { const sep = new T.Mesh(new T.ConeGeometry(0.02, 0.05, 5), stemM); sep.position.set(Math.cos(k * 2.1) * 0.02, 0.2, Math.sin(k * 2.1) * 0.02); s.add(sep); }
    }
    return s;
  };
  if (n === 2) { one(-0.05, 0.28); one(0.05, -0.28); } else one(0, 0);
  return g;
}
function makeStar() {
  const g = new T.Group();
  const geo = new T.ExtrudeGeometry(starShape(0.13, 0.055), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1 });
  geo.center();
  const st = new T.Mesh(geo, M("#ffd54a", 0.3, { metalness: 0.5, emissive: "#ffb300", emissiveIntensity: 0.55 })); g.add(st);
  // 은은한 빛 (늘 카메라를 보는 동그란 빛)
  if (!makeStar.glowTex) makeStar.glowTex = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,170,.9)"); gr.addColorStop(1, "rgba(255,240,170,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const glow = new T.Sprite(new T.SpriteMaterial({ map: makeStar.glowTex, transparent: true, depthWrite: false, opacity: 0.75 })); glow.scale.set(0.55, 0.55, 1); g.add(glow);
  return g;
}
function makeRainbow() { // 🌈 언약의 무지개 (창 9:13)
  const g = new T.Group(), cols = ["#e74c3c", "#f39c12", "#f1c40f", "#2ecc71", "#3498db", "#8e44ad"];
  cols.forEach((c, i) => { const r = new T.Mesh(new T.TorusGeometry(0.3 - i * 0.035, 0.018, 6, 28, Math.PI), M(c, 0.5, { emissive: c, emissiveIntensity: 0.25 })); g.add(r); });
  for (const sx of [-1, 1]) { const cl = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), M("#ffffff", 0.9)); cl.scale.set(1.4, 0.8, 1); cl.position.set(0.27 * sx, 0.0, 0); g.add(cl); }
  g.scale.setScalar(0.9);
  return g;
}
function makeDove() {
  const g = new T.Group(), w = M("#fbfbf7", 0.7), wd = M("#e9e9e2", 0.75);
  const body = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), w); body.scale.set(0.8, 0.75, 1.3); g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), w); head.position.set(0, 0.06, 0.07); g.add(head);
  const beak = new T.Mesh(new T.ConeGeometry(0.012, 0.03, 6), M("#f0a040", 0.5)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.055, 0.115); g.add(beak);
  for (const sx of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(0.007, 6, 5), M("#222", 0.3)); e.position.set(0.026 * sx, 0.07, 0.095); g.add(e);
    const wing = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), wd); wing.scale.set(0.25, 0.6, 1.25); wing.position.set(0.05 * sx, 0.01, -0.01); wing.rotation.z = sx * 0.2; g.add(wing);
  }
  const tail = new T.Mesh(new T.BoxGeometry(0.07, 0.012, 0.08), wd); tail.position.set(0, 0.0, -0.11); tail.rotation.x = 0.3; g.add(tail);
  return g;
}
function addSpecial(head, g, look) {
  const out = { halo: null, star: false, dove: null };
  if (look.halo !== "none") {
    const star = look.halo === "star";
    const hg = star ? makeStar() : look.halo === "rainbow" ? makeRainbow() : makeSprout(look.halo === "sprout2" ? 2 : 1, look.halo === "bud");
    hg.position.y = star ? 0.78 : (SPROUT_Y[look.wear] != null ? SPROUT_Y[look.wear] : 0.27);
    if (!star) hg.scale.setScalar(1.35);
    head.add(hg); out.halo = hg; out.star = star; hg.userData.baseY = hg.position.y;
  }
  if (look.shoulder === "dove") {
    const d = makeDove(); d.position.set(-0.3, 0.9, 0.02); d.rotation.y = 0.5; d.scale.setScalar(1.25); g.add(d); out.dove = d;
  }
  if (look.apron === "cheese") {
    const yel = M("#f6c33b", 0.6), ap = new T.Group(); ap.position.set(0, 0.5, 0.226); ap.rotation.x = -0.136; g.add(ap);
    box(ap, 0.3, 0.4, 0.016, yel, 0, 0, 0, { cast: false });
    box(ap, 0.16, 0.08, 0.02, M("#e8a91f", 0.6), 0, -0.07, 0.006, { cast: false }); // 주머니
    for (const [hx, hy, r] of [[-0.08, 0.1, 0.026], [0.07, 0.13, 0.018], [0.09, -0.02, 0.022], [-0.06, -0.14, 0.02], [0.03, 0.03, 0.012]]) {
      const hc = new T.Mesh(new T.CircleGeometry(r, 12), M("#d99a16", 0.7)); hc.position.set(hx, hy, 0.0095); ap.add(hc);
    }
    const strap = new T.Mesh(new T.TorusGeometry(0.15, 0.012, 4, 16, Math.PI), M("#e8a91f", 0.6)); strap.position.set(0, 0.84, 0.03); strap.rotation.x = -0.25; g.add(strap);
    const tie = new T.Mesh(new T.TorusGeometry(0.2, 0.01, 4, 20), M("#e8a91f", 0.6)); tie.rotation.x = Math.PI / 2; tie.position.y = 0.6; tie.scale.set(1.08, 1.12, 1); g.add(tie);
  }
  if (look.pin === "lily") {
    const pin = new T.Group(); pin.position.set(-0.1, 0.68, 0.215); g.add(pin);
    const pw = M("#ffffff", 0.45, { emissive: "#ffffff", emissiveIntensity: 0.12 });
    for (let k = 0; k < 5; k++) { const pt = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), pw); pt.scale.set(0.55, 1.3, 0.4); const a = k * Math.PI * 2 / 5; pt.position.set(Math.sin(a) * 0.022, Math.cos(a) * 0.022, 0.006); pt.rotation.z = -a; pin.add(pt); }
    const c = new T.Mesh(new T.SphereGeometry(0.01, 8, 6), M("#f2c84b", 0.4)); c.position.z = 0.014; pin.add(c);
    const lf = new T.Mesh(new T.SphereGeometry(0.02, 8, 6), M("#4f8f3a", 0.6)); lf.scale.set(0.5, 1.4, 0.3); lf.position.set(0.02, -0.035, 0); lf.rotation.z = -0.6; pin.add(lf);
  }
  return out;
}
// 착용 아이템
function addWear(head, g, wear, shirtCol) {
  const white = M("#fbfbf7", 0.9), red = M("#d0312d", 0.7);
  if (wear === "santa") {
    const cone = new T.Mesh(new T.ConeGeometry(0.32, 0.48, 18), red); cone.position.set(0, 0.43, -0.03); cone.rotation.x = -0.35; cone.rotation.z = 0.15; head.add(cone);
    const cap = new T.Mesh(new T.SphereGeometry(0.325, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), red); cap.position.y = 0.01; head.add(cap); // 머리 윗부분을 덮어요
    const brim = new T.Mesh(new T.TorusGeometry(0.315, 0.062, 8, 24), white); brim.rotation.x = Math.PI / 2 - 0.12; brim.position.set(0, 0.2, 0); head.add(brim);
    const pom = new T.Mesh(new T.SphereGeometry(0.065, 10, 8), white); pom.position.set(0.06, 0.6, -0.2); head.add(pom);
  } else if (wear === "beanie") {
    const knit = M("#2f6b4f", 0.95), cap = new T.Mesh(new T.SphereGeometry(0.345, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), knit);
    cap.position.y = 0.02; head.add(cap);
    const band = new T.Mesh(new T.TorusGeometry(0.33, 0.05, 8, 24), M("#e9e2d2", 0.95)); band.rotation.x = Math.PI / 2; band.position.y = 0.1; head.add(band);
    const pom = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), M("#d0312d", 0.95)); pom.position.y = 0.38; head.add(pom);
  } else if (wear === "scarf") {
    const sc = M("#c0392b", 0.9), ring = new T.Mesh(new T.TorusGeometry(0.16, 0.06, 8, 20), sc); ring.rotation.x = Math.PI / 2; ring.position.y = 0.79; g.add(ring);
    const tail = new T.Mesh(new T.BoxGeometry(0.1, 0.26, 0.04), sc); tail.position.set(0.09, 0.66, 0.2); tail.rotation.z = 0.12; g.add(tail);
    for (let k = 0; k < 3; k++) { const st = new T.Mesh(new T.BoxGeometry(0.104, 0.018, 0.045), white); st.position.set(0.09 + 0.012 * k, 0.6 + k * 0.07, 0.2); st.rotation.z = 0.12; g.add(st); }
  } else if (wear === "wheathat") { // 🌿 맥추감사절: 밀짚모자 + 밀 이삭
    const straw = M("#e2c27a", 0.95), band = M("#5f8f3a", 0.7);
    const brim = new T.Mesh(new T.CylinderGeometry(0.47, 0.49, 0.025, 28), straw); brim.position.y = 0.2; head.add(brim);
    const crown = new T.Mesh(new T.CylinderGeometry(0.25, 0.31, 0.2, 24), straw); crown.position.y = 0.31; head.add(crown);
    const top = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.02, 24), M("#d6b468", 0.95)); top.position.y = 0.415; head.add(top);
    const rb = new T.Mesh(new T.CylinderGeometry(0.315, 0.315, 0.05, 24, 1, true), band); rb.position.y = 0.245; head.add(rb);
    const gold = M("#d9a93a", 0.7);
    for (let k = 0; k < 3; k++) {
      const st = new T.Group(); st.position.set(0.24 + k * 0.03, 0.27, 0.12 - k * 0.07); st.rotation.z = -0.5 - k * 0.12; head.add(st);
      cyl(st, 0.006, 0.006, 0.22, M("#b89a4a", 0.8), 0, 0.11, 0, 4);
      for (let j = 0; j < 5; j++) for (const sx of [-1, 1]) { const gr = new T.Mesh(new T.SphereGeometry(0.014, 6, 5), gold); gr.scale.set(0.7, 1.4, 0.7); gr.position.set(0.012 * sx, 0.17 + j * 0.022, 0); gr.rotation.z = sx * 0.4; st.add(gr); }
    }
  } else if (wear === "antlers") {
    const br = M("#7a4a28", 0.7), band = new T.Mesh(new T.TorusGeometry(0.31, 0.018, 6, 20, Math.PI), M("#3a2a20", 0.6));
    band.rotation.y = Math.PI / 2; band.position.y = 0.02; head.add(band);
    for (const sx of [-1, 1]) {
      const a = new T.Group(); a.position.set(0.17 * sx, 0.28, 0); a.rotation.z = -0.35 * sx; head.add(a);
      cyl(a, 0.02, 0.025, 0.24, br, 0, 0.12, 0, 6);
      const b1 = cyl(a, 0.015, 0.018, 0.12, br, 0.05 * sx, 0.16, 0, 6); b1.rotation.z = -0.8 * sx;
      const b2 = cyl(a, 0.015, 0.018, 0.1, br, -0.04 * sx, 0.2, 0, 6); b2.rotation.z = 0.8 * sx;
    }
    const nose = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), M("#e0242a", 0.3, { emissive: "#a01010", emissiveIntensity: 0.4 })); nose.position.set(0, -0.04, 0.3); head.add(nose);
  }
}
// 손에 드는 아이템. 반환값: 팔 자세 ("one" 오른손 / "both" 기타 / null)
function addItem(g, armL, armR, item) {
  const inHand = (obj) => { obj.position.add(new T.Vector3(0, -0.33, 0.04)); armR.add(obj); };
  if (item === "guitar") {
    const gt = new T.Group(); gt.position.set(-0.02, 0.5, 0.27); gt.rotation.z = 0.55; g.add(gt);
    const wood = M("#c98a46", 0.5), dk = M("#3b2618", 0.5);
    const b1 = new T.Mesh(new T.SphereGeometry(0.15, 16, 12), wood); b1.scale.set(1, 0.95, 0.32); b1.position.set(-0.05, 0, 0); gt.add(b1);
    const b2 = new T.Mesh(new T.SphereGeometry(0.115, 16, 12), wood); b2.scale.set(1, 0.95, 0.32); b2.position.set(0.12, 0, 0); gt.add(b2);
    const hole = new T.Mesh(new T.CircleGeometry(0.045, 14), dk); hole.position.set(0.04, 0, 0.05); gt.add(hole);
    box(gt, 0.42, 0.045, 0.03, dk, 0.42, 0, 0.01); box(gt, 0.1, 0.07, 0.03, dk, 0.67, 0, 0.01);
    const strap = new T.Mesh(new T.TorusGeometry(0.27, 0.012, 4, 20, Math.PI), M("#3a3a3a", 0.6)); strap.position.set(0.1, 0.05, -0.12); strap.rotation.z = -0.1; gt.add(strap);
    return "both";
  }
  if (item === "tambourine") {
    const t = new T.Group(); t.rotation.x = Math.PI / 2;
    t.add(new T.Mesh(new T.TorusGeometry(0.1, 0.018, 8, 20), M("#c9893f", 0.5)));
    const skin = new T.Mesh(new T.CircleGeometry(0.1, 20), M("#f4ead2", 0.8, { side: T.DoubleSide })); t.add(skin);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, j = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.012, 10), M("#e8c24a", 0.3, { metalness: 0.7 })); j.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0); j.rotation.x = Math.PI / 2; t.add(j); }
    t.position.set(0, -0.03, 0.06); inHand(t); return "one";
  }
  if (item === "coffee") {
    const c = new T.Group();
    cyl(c, 0.05, 0.04, 0.14, M("#fbfbf7", 0.6), 0, 0, 0, 14);
    cyl(c, 0.053, 0.047, 0.05, M("#a8774a", 0.9), 0, 0.005, 0, 14);
    cyl(c, 0.055, 0.055, 0.02, M("#ffffff", 0.5), 0, 0.08, 0, 14);
    c.position.set(0, 0.02, 0.05); inHand(c); return "one";
  }
  if (item === "bible") {
    const b = new T.Group(); b.rotation.set(0.25, 0, 0.2);
    box(b, 0.16, 0.22, 0.045, M("#1c1a1a", 0.5), 0, 0, 0);
    box(b, 0.15, 0.21, 0.04, M("#f2ead8", 0.8), 0.006, 0, 0, { cast: false });
    box(b, 0.012, 0.09, 0.003, M("#d9b45a", 0.3, { metalness: 0.6 }), 0, 0.02, 0.024, { cast: false });
    box(b, 0.05, 0.012, 0.003, M("#d9b45a", 0.3, { metalness: 0.6 }), 0, 0.04, 0.024, { cast: false });
    b.position.set(0, 0.0, 0.07); inHand(b); return "one";
  }
  if (item === "scroll") { // 📜 두루마리 성경 (성경 한 권 다 읽으면)
    const sc = new T.Group(); sc.rotation.set(0.25, 0, 0.12);
    const rod = M("#7a4a28", 0.5), paper = M("#f1e2bd", 0.85, { side: T.DoubleSide });
    box(sc, 0.17, 0.22, 0.006, paper, 0, 0, 0, { cast: false });
    for (let k = 0; k < 6; k++) box(sc, 0.12, 0.007, 0.002, M("#8a6a4a", 0.8), 0, 0.075 - k * 0.03, 0.005, { cast: false });
    for (const sx of [-1, 1]) {
      cyl(sc, 0.022, 0.022, 0.22, paper, 0.09 * sx, 0, 0, 10);
      cyl(sc, 0.009, 0.009, 0.32, rod, 0.09 * sx, 0, 0, 6);
      for (const sy of [-1, 1]) { const k = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), rod); k.position.set(0.09 * sx, 0.165 * sy, 0); sc.add(k); }
    }
    sc.position.set(0, 0.0, 0.08); inHand(sc); return "one";
  }
  if (item === "basket") { // 🌾 추수감사절 곡식 바구니
    const b = new T.Group(), wick = M("#b07a3a", 0.9), wickD = M("#8a5a28", 0.9);
    cyl(b, 0.11, 0.08, 0.1, wick, 0, 0, 0, 14);
    for (let k = 0; k < 3; k++) { const r = new T.Mesh(new T.TorusGeometry(0.1 - k * 0.01, 0.006, 4, 16), wickD); r.rotation.x = Math.PI / 2; r.position.y = 0.04 - k * 0.035; b.add(r); }
    const hd = new T.Mesh(new T.TorusGeometry(0.1, 0.008, 4, 16, Math.PI), wickD); hd.position.y = 0.05; b.add(hd);
    for (const [x, z, col] of [[-0.04, 0.02, "#d9483b"], [0.035, -0.02, "#e8862f"], [0.0, 0.045, "#c0392b"]]) { const f = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), M(col, 0.5)); f.position.set(x, 0.065, z); b.add(f); }
    for (let k = 0; k < 4; k++) { const st = cyl(b, 0.004, 0.004, 0.16, M("#c99a3a", 0.8), -0.05 + k * 0.03, 0.12, -0.04, 4); st.rotation.z = -0.3 + k * 0.2; const ear = new T.Mesh(new T.SphereGeometry(0.014, 6, 5), M("#d9a93a", 0.7)); ear.scale.set(0.7, 2.2, 0.7); ear.position.set(-0.05 + k * 0.03 + Math.sin(-0.3 + k * 0.2) * -0.08, 0.2, -0.04); b.add(ear); }
    b.position.set(0, -0.06, 0.04); inHand(b); return "one";
  }
  if (item === "grapes") { // 🍇 포도송이 (미션 도장 15개 · 요 15:5)
    const gr = new T.Group(), pm = M("#6c3483", 0.35);
    let k = 0; for (let row = 0; row < 5; row++) for (let i = 0; i <= 4 - row; i++) { const b = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), pm); b.position.set((i - (4 - row) / 2) * 0.05, -row * 0.045, (k++ % 2) * 0.02); gr.add(b); }
    const lf = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), M("#4f8f3a", 0.6, { side: T.DoubleSide })); lf.scale.set(1.2, 0.2, 0.9); lf.position.set(0.05, 0.05, 0); gr.add(lf);
    cyl(gr, 0.006, 0.006, 0.06, M("#6b4a2a", 0.7), 0, 0.05, 0, 5);
    gr.position.set(0, 0.0, 0.07); inHand(gr); return "one";
  }
  if (item === "mic") {
    const m = new T.Group(); m.rotation.x = -0.9;
    cyl(m, 0.02, 0.015, 0.16, M("#1b1b1b", 0.4), 0, 0, 0, 10);
    const head = new T.Mesh(new T.SphereGeometry(0.04, 12, 10), M("#9a9a9a", 0.3, { metalness: 0.6 })); head.position.y = 0.1; m.add(head);
    m.position.set(0, 0.03, 0.05); inHand(m); return "one";
  }
  return null;
}
function poseCharacter(c, st, t) {
  // st: { walking, seated, praying, lying }
  const w = st.walking, sit = st.seated && !st.lying, pr = st.praying;
  c.eyesOpen.visible = !pr && !st.lying; c.eyesClosed.visible = pr || !!st.lying;
  if (st.lying) {
    c.legL.rotation.x = 0; c.legR.rotation.x = 0;
    c.armL.rotation.set(0, 0, 0.12); c.armR.rotation.set(0, 0, -0.12);
    c.head.rotation.x = 0; c.body.position.y = 0.55 + Math.sin(t * 1.3) * 0.006;
    return;
  }
  const sw = w ? Math.sin(t * 11) : 0;
  c.legL.rotation.x = sit ? -Math.PI / 2 : sw * 0.6;
  c.legR.rotation.x = sit ? -Math.PI / 2 : -sw * 0.6;
  if (pr) {
    c.armL.rotation.set(-1.15, 0, 0.62); c.armR.rotation.set(-1.15, 0, -0.62);
    c.head.rotation.x = 0.2;
  } else {
    c.armL.rotation.set(-sw * 0.6, 0, 0.18); c.armR.rotation.set(sw * 0.6, 0, -0.18);
    c.head.rotation.x = sit ? 0.05 : 0;
    // 아이템을 들고 있으면 팔을 앞으로
    if (c.hold === "both") { c.armL.rotation.set(-0.95, 0, 0.35); c.armR.rotation.set(-0.7 + Math.sin(t * 7) * (st.walking ? 0 : 0.12), 0, -0.45); }
    else if (c.hold === "one") c.armR.rotation.set(-0.75 + sw * 0.15, 0, -0.12);
    else if (c.hold === "pair") { c.armR.rotation.set(-0.75 + sw * 0.15, 0, -0.12); c.armL.rotation.set(-0.75 - sw * 0.15, 0, 0.12); } // 두 손에 하나씩
    // 왼손 간식: 들고 있으면 앞으로, 먹을 때는 입으로 냠냠
    if (c.carry) { if (c.eating) c.armL.rotation.set(-2.35 + Math.sin(t * 16) * 0.12, 0, -0.6); else c.armL.rotation.set(-0.85 + sw * 0.15, 0, 0.12); }
  }
  c.body.position.y = 0.55 + (w ? Math.abs(Math.sin(t * 11)) * 0.03 : Math.sin(t * 2) * 0.006);
}

/* ---------------- 흔적 표시 (다녀간 자리) ---------------- */
// 기도하고 간 자리: 씨앗 하나 (그루터기에 남는 거룩한 씨, 사 6:13) / 말씀 읽고 간 자리: 펼쳐진 성경책
function makeSeed() {
  const g = new T.Group();
  // 은은한 빛 원 (멀리서도 자리가 보이게)
  const halo = new T.Mesh(new T.CircleGeometry(0.075, 20), new T.MeshBasicMaterial({ color: "#fff1c8", transparent: true, opacity: 0.55, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.004; g.add(halo);
  // 씨앗: 아몬드 모양 갈색 알갱이 + 가운데 옅은 줄
  const seed = new T.Mesh(new T.SphereGeometry(0.03, 14, 10), M("#8a5a2e", 0.45, { emissive: "#3a2410", emissiveIntensity: 0.25 }));
  seed.scale.set(0.8, 0.62, 1.35); seed.position.y = 0.019; seed.rotation.y = 0.5; seed.castShadow = true; g.add(seed);
  const line = new T.Mesh(new T.TorusGeometry(0.03, 0.0035, 4, 16, Math.PI), M("#c79a62", 0.5));
  line.scale.set(0.8, 1, 1.35); line.rotation.set(Math.PI / 2, 0, 0.5 + Math.PI / 2); line.position.y = 0.033; g.add(line);
  return g;
}
function makeOpenBook() {
  const g = new T.Group();
  box(g, 0.3, 0.012, 0.2, M("#5a2e22", 0.6), 0, 0.006, 0, { cast: false });
  for (const s of [-1, 1]) { const p = box(g, 0.14, 0.014, 0.18, M("#f7f2e4", 0.8), s * 0.072, 0.02, 0, { cast: false }); p.rotation.z = -s * 0.1; }
  box(g, 0.012, 0.004, 0.14, M("#b8322e", 0.6), 0.02, 0.03, 0.08, { cast: false });
  return g;
}

/* ---------------- 크리스마스 장식 (촛불 없음) ---------------- */
// 반짝이는 전구: 색깔마다 재료를 따로 만들고, 매 프레임 밝기를 바꿔서 반짝이게 해요 (room.tw 목록)
const BULB_COLS = ["#ff3b3b", "#ffd23b", "#3bdc6a", "#4aa3ff", "#fff1c4", "#ff7ad9"];
function bulbs(parent, pts, tw, r = 0.035, cols = BULB_COLS) {
  const geo = new T.SphereGeometry(r, 8, 6), groups = cols.map(() => []);
  pts.forEach((p, i) => groups[(i * 7 + (i >> 2)) % cols.length].push(p));
  groups.forEach((list, ci) => {
    if (!list.length) return;
    const mat = new T.MeshStandardMaterial({ color: cols[ci], emissive: cols[ci], emissiveIntensity: 1, roughness: 0.4 });
    const inst = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4();
    list.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); });
    inst.castShadow = false; parent.add(inst);
    tw.push({ mat, base: 1.1, phase: ci * 1.7 + Math.random(), speed: 2.2 + (ci % 3) * 0.9 });
  });
}
// a → b 사이에 처지게 늘어진 전구 줄
function lightString(parent, tw, a, b, n, sag = 0.2) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t]); }
  const wire = new T.Line(new T.BufferGeometry().setFromPoints(pts.map((p) => new T.Vector3(...p))), new T.LineBasicMaterial({ color: "#2a3a2a" }));
  parent.add(wire); bulbs(parent, pts, tw);
}
// 여러 구간 이어진 전구 줄 (구간마다 처짐)
function lightRun(parent, tw, pts, per = 8, sag = 0.15) { for (let i = 0; i < pts.length - 1; i++) lightString(parent, tw, pts[i], pts[i + 1], per, sag); }
function starShape(R, r) {
  const sh = new T.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  return sh;
}
// 크리스마스 트리: 층층이 원뿔 + 장식 공 + 나선 전구 + 꼭대기 별 + 선물 상자
function makeXmasTree(h, tw, opt = {}) {
  const g = new T.Group(), R = h * 0.36, green = M("#1f6b3a", 0.85), green2 = M("#2a7d45", 0.85);
  cyl(g, h * 0.035, h * 0.045, h * 0.14, M("#6b4a32"), 0, h * 0.07, 0, 8);
  const layers = 4;
  for (let k = 0; k < layers; k++) {
    const lh = h * 0.36, rr = R * (1 - k * 0.2), y = h * 0.12 + k * h * 0.18;
    const c = new T.Mesh(new T.ConeGeometry(rr, lh, 20), k % 2 ? green2 : green); c.position.y = y + lh / 2; c.castShadow = true; g.add(c);
  }
  const top = h * 0.12 + (layers - 1) * h * 0.18 + h * 0.36;
  // 나선형 전구
  const pts = [], N = Math.round(h * 34), turns = 5.5;
  for (let i = 0; i < N; i++) {
    const t = i / N, y = h * 0.14 + t * (top - h * 0.18), rad = R * (1 - t) * 0.98 + 0.03, a = t * turns * Math.PI * 2;
    pts.push([Math.cos(a) * rad, y, Math.sin(a) * rad]);
  }
  bulbs(g, pts, tw, Math.max(0.025, h * 0.008));
  // 장식 공
  const ballCols = ["#c0392b", "#d4a017", "#c0392b", "#f2f2f2", "#2e5fa8"];
  for (let i = 0; i < Math.round(h * 9); i++) {
    const t = 0.05 + Math.random() * 0.8, y = h * 0.14 + t * (top - h * 0.2), rad = R * (1 - t) * 0.95, a = Math.random() * Math.PI * 2;
    const b = new T.Mesh(new T.SphereGeometry(h * 0.018, 10, 8), M(ballCols[i % ballCols.length], 0.25, { metalness: 0.4 }));
    b.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); g.add(b);
  }
  // 꼭대기 별 (베들레헴의 별)
  const starMat = new T.MeshStandardMaterial({ color: "#ffd84a", emissive: "#ffcc33", emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.3 });
  const star = new T.Mesh(new T.ExtrudeGeometry(starShape(h * 0.06, h * 0.025), { depth: h * 0.015, bevelEnabled: false }), starMat);
  star.position.set(0, top + h * 0.03, -h * 0.0075); g.add(star);
  tw.push({ mat: starMat, base: 1.3, phase: 0, speed: 1.6, soft: true });
  // 선물 상자
  if (opt.gifts !== false) {
    const gc = [["#c0392b", "#f1c40f"], ["#2e7d4f", "#e74c3c"], ["#2e5fa8", "#ecf0f1"], ["#f5f0e6", "#c0392b"], ["#8e44ad", "#f1c40f"]];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1 + 0.3, d = R * 0.75 + (i % 2) * 0.15, sz = h * (0.05 + (i % 3) * 0.015), [c1, c2] = gc[i % gc.length];
      const gift = new T.Group(); gift.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); gift.rotation.y = a; g.add(gift);
      box(gift, sz * 1.3, sz, sz * 1.1, M(c1, 0.6), 0, sz / 2, 0);
      box(gift, sz * 1.32, sz * 1.02, sz * 0.18, M(c2, 0.5), 0, sz / 2, 0, { cast: false });
      box(gift, sz * 0.18, sz * 1.02, sz * 1.12, M(c2, 0.5), 0, sz / 2, 0, { cast: false });
    }
  }
  g.userData.radius = R;
  return g;
}
// 리스 (초록 고리 + 빨간 리본 + 작은 열매)
function makeWreath(r = 0.32) {
  const g = new T.Group();
  g.add(new T.Mesh(new T.TorusGeometry(r, r * 0.28, 8, 24), M("#1f6b3a", 0.9)));
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, b = new T.Mesh(new T.SphereGeometry(r * 0.08, 6, 5), M("#d0312d", 0.4)); b.position.set(Math.cos(a) * r, Math.sin(a) * r, r * 0.22); g.add(b); }
  const bow = M("#c0392b", 0.5);
  for (const sx of [-1, 1]) { const w = new T.Mesh(new T.SphereGeometry(r * 0.22, 8, 6), bow); w.scale.set(1.3, 0.8, 0.5); w.position.set(sx * r * 0.22, -r * 0.95, r * 0.25); g.add(w); }
  return g;
}
// 반짝임 업데이트 (매 프레임)
function twinkle(tw, t) {
  for (const x of tw) {
    const v = Math.sin(t * x.speed + x.phase);
    x.mat.emissiveIntensity = x.soft ? x.base * (0.75 + 0.25 * v) : x.base * (v > -0.2 ? 0.55 + 0.45 * v : 0.12);
  }
}
// 내리는 눈
/* ---------------- 계절 장식 표시 (크리스마스 · 새해 · 부활절 · 여름 수련회 · 겨울 눈) ---------------- */
// 장식을 만들기 전/후 장면을 비교해서 새로 생긴 것에 계절 이름표를 붙여요 → 날짜에 따라 보였다 숨겼다 해요
let SEASONAL = [];
function decoBegin(s) { const set = new Set(); s.traverse((o) => set.add(o)); return set; }
function decoEnd(s, before, tag) { s.traverse((o) => { if (!before.has(o) && o.parent && before.has(o.parent)) { o.userData.season = tag; SEASONAL.push(o); } }); }
function banner3D(parent, text, w, h, bg, x, y, z, ry = 0, fg = "#fff8e6", size = 64) {
  const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: textTex([[text, size, 70, fg]], { w: Math.round(140 * w / h), h: 140, bg, border: "#e2c06a" }), side: T.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
}
function makeLily(scale = 1) { // 흰 백합 화분 (부활절)
  const g = new T.Group();
  cyl(g, 0.2, 0.15, 0.3, M("#d9cbb0", 0.8), 0, 0.15, 0, 12);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6, st = cyl(g, 0.015, 0.015, 0.7, M("#4a8a3a", 0.8), Math.cos(a) * 0.06, 0.6, Math.sin(a) * 0.06, 5); st.rotation.z = Math.cos(a) * 0.15;
    const fl = new T.Mesh(new T.ConeGeometry(0.1, 0.22, 6, 1, true), M("#ffffff", 0.6, { side: T.DoubleSide, emissive: "#fff8e8", emissiveIntensity: 0.15 }));
    fl.position.set(Math.cos(a) * 0.12, 0.98, Math.sin(a) * 0.12); fl.rotation.x = Math.PI + 0.5 * Math.sin(a); fl.rotation.z = 0.5 * Math.cos(a); g.add(fl);
    const pist = new T.Mesh(new T.SphereGeometry(0.02, 6, 5), M("#f2c84b", 0.6)); pist.position.copy(fl.position); g.add(pist);
  }
  g.scale.setScalar(scale); return g;
}
function makeSunflower(h = 1.3) {
  const g = new T.Group();
  cyl(g, 0.025, 0.03, h, M("#4a8a3a", 0.8), 0, h / 2, 0, 6);
  const head = new T.Group(); head.position.y = h; head.rotation.x = -0.35; g.add(head);
  for (let k = 0; k < 12; k++) { const p = new T.Mesh(new T.SphereGeometry(0.07, 6, 5), M("#f5c518", 0.7)); p.scale.set(0.5, 1.4, 0.2); const a = k / 12 * Math.PI * 2; p.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0); p.rotation.z = a - Math.PI / 2; head.add(p); }
  const c = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), M("#5a3a1a", 0.9)); c.scale.z = 0.4; head.add(c);
  return g;
}
function makeParasol(col) {
  const g = new T.Group();
  cyl(g, 0.03, 0.03, 2.2, M("#ddd", 0.5), 0, 1.1, 0, 6);
  const top = new T.Mesh(new T.ConeGeometry(1.2, 0.45, 8), new T.MeshStandardMaterial({ map: stripeTex(col, "#ffffff"), roughness: 0.8 })); top.position.y = 2.25; top.castShadow = true; g.add(top);
  return g;
}
function seasonYear() { const d = new Date(); return d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear(); }

function makeSnow(scene, b) {
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = b.x0 + Math.random() * (b.x1 - b.x0); pos[i * 3 + 1] = Math.random() * b.h; pos[i * 3 + 2] = b.z0 + Math.random() * (b.z1 - b.z0); }
  const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  const pts = new T.Points(geo, new T.PointsMaterial({ color: "#ffffff", size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(pts);
  return (dt, t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      a[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.12);
      a[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.15;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] += b.h;
    }
    geo.attributes.position.needsUpdate = true;
  };
}
// 눈썰매 언덕 높이 (z: 앞뒤 위치) — 뒤쪽이 높고 앞으로 내려와요
// 놀이터는 2026-11-13부터 건물 뒤 배드민턴장 오른쪽에 있어요 (예전 자리보다 PG_DZ만큼 뒤)
const PG_DZ = -25.3;
const HILL = { x0: 22.4, x1: 30.6, zTop: -14.5 + PG_DZ, zBack: -17.2 + PG_DZ, zFoot: -4.2 + PG_DZ, h: 3.0, lanes: [24.6, 28.4], endZ: 2.6 + PG_DZ };
function hillH(z) {
  if (z <= HILL.zTop) return HILL.h;
  if (z >= HILL.zFoot) return 0;
  return HILL.h * (0.5 + 0.5 * Math.cos(Math.PI * (z - HILL.zTop) / (HILL.zFoot - HILL.zTop)));
}
function makeSled(col = "#d0312d") {
  const g = new T.Group(), red = M(col, 0.5), metal = M("#c9c9c9", 0.3, { metalness: 0.7 });
  box(g, 0.5, 0.05, 0.95, red, 0, 0.13, 0);
  const nose = box(g, 0.5, 0.05, 0.22, red, 0, 0.19, 0.53); nose.rotation.x = -0.6;
  for (const sx of [-0.22, 0.22]) { box(g, 0.035, 0.035, 1.05, metal, sx, 0.03, 0.02); for (const z of [-0.3, 0.3]) box(g, 0.03, 0.1, 0.03, metal, sx, 0.08, z); }
  return g;
}

/* ---------------- 푸드 트럭 (타코야끼 / 붕어빵) ---------------- */
// 트럭 간판에 이름과 숫자(만든 개수·남은 개수)를 그려요
function truckSignTex(o, v) {
  v = v || {};
  return canvasTex(640, 220, (g, w, h) => {
    g.fillStyle = o.signBg; g.fillRect(0, 0, w, h);
    g.strokeStyle = o.accent; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = "center"; g.fillStyle = "#fff";
    g.font = "700 64px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(o.title, w / 2, 82);
    g.font = "700 34px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillStyle = o.accent;
    g.fillText(v.sold == null ? "…" : `누적 판매 ${v.sold.toLocaleString()}${o.unit}`, w / 2, 140);
    g.font = "28px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillStyle = "#fff";
    g.fillText(v.left == null ? "" : !v.open ? "🌙 쉬는 시간 · 오전 7시에 열어요" : v.queue ? `🧍 손님 ${v.queue}명 기다려요 · 만들어 주세요!` : v.left > 0 ? `${v.left}${o.unit} 남았어요 · 하나 받아가세요!` : "다 팔렸어요! 만들어 주세요 🙏", w / 2, 190);
  });
}
// 트럭 옆 판매 현황판
function truckBoardTex(o, v) {
  v = v || {};
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h);
    g.fillStyle = o.signBg; g.fillRect(0, 0, w, 78);
    g.textAlign = "center"; g.fillStyle = "#fff"; g.font = "700 40px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText(`📈 ${o.title.replace(/^\S+\s/, "")} 판매 현황`, w / 2, 54);
    g.fillStyle = "#6b5a4a"; g.font = "28px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("누적 판매", w / 2, 122);
    g.fillStyle = o.signBg; g.font = "700 84px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText(v.sold == null ? "…" : `${v.sold.toLocaleString()}${o.unit}`, w / 2, 206);
    g.font = "700 32px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillStyle = v.queue ? "#c0392b" : "#3d6b4a";
    g.fillText(!v.open ? "🌙 지금은 쉬는 시간" : v.queue ? `🧍 줄 선 손님 ${v.queue}명` : "🙂 줄 없음 · 바로 살 수 있어요", w / 2, 268);
    g.fillStyle = "#6b5a4a"; g.font = "26px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText(v.left == null ? "" : `트럭에 남은 것 ${v.left}${o.unit}`, w / 2, 314);
    g.fillText("영업 오전 7시 ~ 밤 10시", w / 2, 356);
  });
}
function bannerTex(text, bg, fg) {
  return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 46px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function stripeTex(a, b) { return canvasTex(128, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, h); } }); }
/* ---- 🧍 트럭 손님(NPC) 움직임 ----
   서버가 알려 준 '줄 선 손님 수(queue)'와 '누적 판매(sold)'만 보고 각자 화면에서 움직여요.
   판매가 늘면 맨 앞 손님이 음식을 들고 떠나고(줄이 없으면 지나가던 손님이 사 감), 뒤 손님들이 앞으로 와요. */
// 손님은 앞 보도(길가)에서 와서 → 사고 → 다시 보도를 따라 왼쪽으로 걸어가요 (오른쪽은 산울타리)
// 2026-11-18: 트럭이 쇼룸 옆 '먹거리·가게 골목'으로 옮겨서, 손님은 앞 보도(x -24 ~ -18)에서 골목으로 들어왔다가 다시 보도로 나가요
function truckEntry(o) { if (o && o.lane) return { x: -24 + Math.random() * 6, z: 12.7 + Math.random() * 0.4 }; return { x: 9 + Math.random() * 7, z: 12.7 + Math.random() * 0.4 }; }
function truckExit(o, n, side) {
  if (o.lane) return [{ x: o.lane.x + (Math.random() - 0.5) * 1.4, z: n.z + 0.6 }, { x: o.lane.x + (Math.random() - 0.5) * 1.2, z: 11.0 + Math.random() * 0.6 }, { x: -23 + Math.random() * 4, z: 12.9 }, { x: -12 + Math.random() * 6, z: 12.9 }];
  return [{ x: n.x + side * 1.3, z: Math.max(n.z, o.cz + 2.4) + 0.5 }, { x: Math.min(o.cx, 21) - 2.5 - Math.random() * 2, z: 10.6 + Math.random() }, { x: 4 + Math.random() * 6, z: 12.9 }];
}
function truckCustomers(tr, v) {
  const o = tr.opts, free = () => tr.npcs.find((n) => n.state === "off");
  const sold = v.sold || 0, want = v.open ? Math.min(8, v.queue || 0) : 0;
  let delta = tr.lastSold == null ? 0 : Math.max(0, sold - tr.lastSold); tr.lastSold = sold;
  const leave = (n, withFood) => {
    n.state = "leave"; n.slot = -1;
    const side = n.x < o.cx - 0.3 ? -1 : 1;
    n.path = truckExit(o, n, side);
    if (withFood && !n.carry) { n.carry = makeCarry(o.kind); n.ch.armL.add(n.carry); n.ch.carry = true; }
  };
  // 산 사람: 줄 맨 앞부터 떠나요. 줄이 짧으면 '지나가던 손님'이 와서 사 가요 (한 번에 최대 3명만 보여요)
  delta = Math.min(delta, 3 + tr.queue.length);
  while (delta > 0 && tr.queue.length) { leave(tr.queue.shift(), true); delta--; }
  for (let k = 0; k < Math.min(delta, 3); k++) {
    const n = free(); if (!n) break;
    const s0 = tr.slot(0), st = truckEntry(o); n.state = "walkin"; n.x = st.x; n.z = st.z + k * 0.3; n.path = [{ x: s0.x + (k % 2 ? 0.5 : -0.5), z: s0.z + 0.5 + k * 0.5 }]; n.outer.visible = true;
  }
  // 줄 길이를 서버 숫자에 맞춰요 (문 닫으면 다들 집에 가요)
  while (tr.queue.length > want) leave(tr.queue.pop(), false);
  while (tr.queue.length < want) {
    const n = free(); if (!n) break;
    const st = truckEntry(o); n.state = "queue"; n.x = st.x; n.z = st.z; n.outer.visible = true; n.path = null; tr.queue.push(n);
  }
  tr.queue.forEach((n, i) => (n.slot = i));
}
function updateTruckNpcs(trucks, dt, t) {
  for (const tr of Object.values(trucks)) for (const n of tr.npcs) {
    if (n.state === "off") continue;
    let tx, tz;
    if (n.state === "queue") { const p = tr.slot(n.slot); tx = p.x; tz = p.z; }
    else if (n.path && n.path.length) { tx = n.path[0].x; tz = n.path[0].z; }
    else tx = n.x, tz = n.z;
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), sp = 1.35 * dt;
    let walking = false;
    if (d > 0.04) { const k = Math.min(1, sp / d); n.x += dx * k; n.z += dz * k; walking = true; n.outer.rotation.y = Math.atan2(dx, dz); }
    else if (n.state === "queue") { const w = tr.window; n.outer.rotation.y = w ? Math.atan2(w.x - n.x, w.z - n.z) : Math.PI; } // 트럭 창 쪽을 봐요
    else if (n.path && n.path.length) {
      n.path.shift();
      if (!n.path.length && n.state === "walkin") { n.state = "leave"; n.carry = makeCarry(tr.opts.kind); n.ch.armL.add(n.carry); n.ch.carry = true; n.path = truckExit(tr.opts, n, n.x < tr.opts.cx - 0.3 ? -1 : 1); }
      else if (!n.path.length && n.state === "leave") { n.state = "off"; n.outer.visible = false; n.outer.position.y = -50; if (n.carry) { n.ch.armL.remove(n.carry); n.carry = null; n.ch.carry = false; } continue; }
    }
    n.outer.position.set(n.x, 0, n.z);
    poseCharacter(n.ch, { walking }, t + n.ph); n.ch.body.rotation.z = 0;
    if (!walking && n.state === "queue") n.ch.body.rotation.z = Math.sin(t * 1.3 + n.ph) * 0.025; // 기다리며 살짝 흔들흔들
  }
}
// o: { cx, cz, kind, body, trim, accent, signBg, title, unit, seatId, banner }
// o.ry: 트럭이 도는 각도 (0 = 창이 앞(+z)을 봄). o.lane: 손님이 다니는 골목 {x} · o.board: 판매 현황판 자리 {x, z, ry}
function buildTruck(s, seats, obs, clickables, labels, o) {
  const ry = o.ry || 0, cR = Math.cos(ry), sR = Math.sin(ry);
  const P = (lx, lz) => ({ x: o.cx + lx * cR + lz * sR, z: o.cz - lx * sR + lz * cR }); // 트럭 안 좌표 → 마당 좌표
  const obsBox = (lx0, lz0, lx1, lz1) => { const ps = [P(lx0, lz0), P(lx1, lz0), P(lx0, lz1), P(lx1, lz1)]; obs.push([Math.min(...ps.map((p) => p.x)), Math.min(...ps.map((p) => p.z)), Math.max(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.z))]); };
  const g = new T.Group(); g.position.set(o.cx, 0, o.cz); g.rotation.y = ry; s.add(g);
  const body = M(o.body, 0.45), trim = M(o.trim, 0.5), dark = M("#2a2a2a", 0.6), inner = M("#f3efe6", 0.8);
  const L0 = -2.1, L1 = 1.5, D = 1.1, F = 0.55, TOP = 2.75;
  // 짐칸: 바닥, 뒷벽, 양 끝, 지붕, 앞면(창 아래·위)
  box(g, L1 - L0, 0.12, D * 2, trim, (L0 + L1) / 2, F - 0.06, 0);
  box(g, L1 - L0, TOP - F, 0.08, body, (L0 + L1) / 2, (TOP + F) / 2, -D);
  box(g, 0.08, TOP - F, D * 2, body, L0, (TOP + F) / 2, 0);
  box(g, 0.08, TOP - F, D * 2, body, L1, (TOP + F) / 2, 0);
  box(g, L1 - L0 + 0.1, 0.1, D * 2 + 0.1, trim, (L0 + L1) / 2, TOP + 0.05, 0);
  box(g, L1 - L0, 0.72, 0.08, body, (L0 + L1) / 2, F + 0.36, D);
  box(g, L1 - L0, 0.42, 0.08, body, (L0 + L1) / 2, TOP - 0.21, D);
  box(g, 0.25, 1.1, 0.08, body, L0 + 0.12, 1.82, D); box(g, 0.25, 1.1, 0.08, body, L1 - 0.12, 1.82, D);
  box(g, L1 - L0 - 0.1, 0.06, 0.4, M("#c9a27a", 0.6), (L0 + L1) / 2, F + 0.74, D + 0.14); // 앞 판매대
  // 안쪽: 벽 색, 굽는 판, 김
  box(g, L1 - L0 - 0.2, 1.4, 0.02, inner, (L0 + L1) / 2, 1.6, -D + 0.05, { cast: false });
  box(g, 1.6, 0.85, 0.55, M("#9a9a9a", 0.4, { metalness: 0.5 }), -0.6, F + 0.42, -D + 0.35);
  const plate = new T.Group(); plate.position.set(-0.6, F + 0.86, -D + 0.35); g.add(plate);
  box(plate, 1.4, 0.05, 0.45, dark, 0, 0, 0);
  if (o.kind === "tako") { for (let i = 0; i < 9; i++) { const b = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), M("#c98a3c", 0.6)); b.position.set(-0.5 + (i % 5) * 0.25, 0.04, -0.08 + Math.floor(i / 5) * 0.17); plate.add(b); } }
  else { for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), M("#d9a050", 0.6)); f.scale.set(1.6, 0.35, 0.8); f.position.set(-0.45 + i * 0.45, 0.04, 0); plate.add(f); } }
  // 운전석
  box(g, 1.25, 1.55, D * 2 - 0.1, body, L1 + 0.65, F + 0.78, 0);
  box(g, 0.05, 0.6, D * 2 - 0.4, M("#3a4b5c", 0.2, { metalness: 0.4 }), L1 + 1.28, F + 1.15, 0, { cast: false });
  box(g, 1.0, 0.55, 0.05, M("#3a4b5c", 0.2, { metalness: 0.4 }), L1 + 0.6, F + 1.15, D - 0.04, { cast: false });
  box(g, 0.1, 0.15, 0.3, M("#fff6cc", 0.3, { emissive: "#fff2b0", emissiveIntensity: 0.8 }), L1 + 1.3, F + 0.3, 0.7, { cast: false });
  box(g, 0.1, 0.15, 0.3, M("#fff6cc", 0.3, { emissive: "#fff2b0", emissiveIntensity: 0.8 }), L1 + 1.3, F + 0.3, -0.7, { cast: false });
  for (const wx of [L0 + 0.7, L1 + 0.65]) for (const wz of [-D + 0.05, D - 0.05]) { const w = cyl(g, 0.34, 0.34, 0.24, M("#1e1e1e"), wx, 0.34, wz, 14); w.rotation.x = Math.PI / 2; }
  // 차양 (줄무늬)
  const aw = new T.Mesh(new T.PlaneGeometry(L1 - L0 + 0.2, 0.95), new T.MeshStandardMaterial({ map: stripeTex(o.accent, "#ffffff"), side: T.DoubleSide, roughness: 0.8 }));
  aw.position.set((L0 + L1) / 2, TOP - 0.15, D + 0.42); aw.rotation.x = -Math.PI / 2 + 0.45; g.add(aw);
  // 지붕 간판 (숫자가 바뀌어요)
  const signMat = new T.MeshBasicMaterial({ map: truckSignTex(o, null) });
  const sign = new T.Mesh(new T.PlaneGeometry(3.3, 1.13), signMat); sign.position.set((L0 + L1) / 2, TOP + 0.72, 0.15); g.add(sign);
  box(g, 3.35, 1.18, 0.06, M(o.trim, 0.5), (L0 + L1) / 2, TOP + 0.72, 0.11);
  if (o.banner) {
    const bn = new T.Mesh(new T.PlaneGeometry(L1 - L0 - 0.1, 0.4), new T.MeshBasicMaterial({ map: bannerTex(o.banner, o.accent, o.signBg) }));
    bn.position.set((L0 + L1) / 2, F + 0.32, D + 0.05); g.add(bn);
  }
  if (o.kind === "bungeo") { // 옆면에 큰 붕어
    const fish = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), M("#e0a24a", 0.6)); fish.scale.set(1.7, 1, 0.15); fish.position.set(L0 - 0.06, 1.7, 0); fish.rotation.y = Math.PI / 2; g.add(fish);
    const tail = new T.Mesh(new T.ConeGeometry(0.25, 0.35, 3), M("#e0a24a", 0.6)); tail.rotation.set(0, 0, Math.PI / 2); tail.position.set(L0 - 0.06, 1.7, -0.62); tail.scale.set(1, 1, 0.2); g.add(tail);
  } else { // 옆면에 문어
    const oc = new T.Mesh(new T.SphereGeometry(0.28, 14, 10), M("#e25b4a", 0.6)); oc.scale.set(0.2, 1, 1); oc.position.set(L0 - 0.06, 1.85, 0); g.add(oc);
    for (let k = 0; k < 5; k++) { const leg = new T.Mesh(new T.CapsuleGeometry(0.05, 0.25, 4, 6), M("#e25b4a", 0.6)); leg.position.set(L0 - 0.06, 1.48, -0.24 + k * 0.12); leg.rotation.x = (k - 2) * 0.3; g.add(leg); }
  }
  g.traverse((m) => (m.userData.action = "truck:" + o.kind)); clickables.push(g);
  obsBox(L0 - 0.15, -D - 0.1, L1 + 1.4, D + 0.4);
  // 안에 서는 자리 (만드는 사람). stand: 앉지 않고 서 있어요
  const st0 = P(-0.6, -0.35), ap0 = P(L0 - 0.5, -0.35);
  seats[o.seatId] = { x: st0.x, z: st0.z, rot: ry, h: F, stand: true, ax: ap0.x, az: ap0.z };
  const lp = P(-0.3, 0); labels.push({ x: lp.x, y: TOP + 1.55, z: lp.z, html: o.label, action: "truck:" + o.kind });
  // 📈 판매 현황판
  const boardMat = new T.MeshBasicMaterial({ map: truckBoardTex(o, null) });
  const bpos = o.board || { ...P(1.9, 2.5), ry };
  const bd = new T.Group(); bd.position.set(bpos.x, 0, bpos.z); bd.rotation.y = bpos.ry || 0; s.add(bd);
  const bp = new T.Mesh(new T.PlaneGeometry(1.3, 0.975), boardMat); bp.position.y = 1.35; bd.add(bp);
  box(bd, 1.38, 1.05, 0.05, M(o.trim, 0.5), 0, 1.35, -0.035);
  for (const sx of [-0.55, 0.55]) cyl(bd, 0.035, 0.035, 0.85, M("#5a4636", 0.6), sx, 0.42, -0.04, 6);
  bd.traverse((m) => (m.userData.action = "truck:" + o.kind)); clickables.push(bd);
  { const sw = Math.abs(Math.sin(bpos.ry || 0)) > 0.5; obs.push(sw ? [bpos.x - 0.2, bpos.z - 0.75, bpos.x + 0.2, bpos.z + 0.75] : [bpos.x - 0.75, bpos.z - 0.2, bpos.x + 0.75, bpos.z + 0.2]); }
  // 🧍 손님(NPC) — 미리 12명 만들어 두고 필요할 때만 보여요
  const npcs = [];
  for (let i = 0; i < 12; i++) {
    const r = (k) => (hash32(i * 7 + k, o.kind === "tako" ? 11 : 23) % 1000) / 1000;
    const look = { gender: r(1) < 0.5 ? "m" : "f", hair: LOOK.hairs[Math.floor(r(2) * LOOK.hairs.length)][0], hairColor: LOOK.hairColors[Math.floor(r(3) * 3)][0],
      color: LOOK.shirts[Math.floor(r(4) * LOOK.shirts.length)], glasses: r(5) < 0.25 ? "round" : "none", wear: r(6) < 0.25 ? "beanie" : r(6) < 0.4 ? "scarf" : "none" };
    const ch = makeCharacter(look), outer = new T.Group(); outer.add(ch.group); outer.visible = false; outer.position.set(o.cx, -50, o.cz + 9); s.add(outer);
    outer.traverse((m) => (m.userData.action = "truck:" + o.kind)); clickables.push(outer);
    npcs.push({ ch, outer, state: "off", x: o.cx, z: o.cz + 9, tx: 0, tz: 0, slot: -1, ph: r(7) * 6, carry: null });
  }
  // 줄 서는 자리: 창 앞 첫 자리에서 o.queueDir(기본: 창에서 멀어지는 쪽)으로 0.72m씩
  const q0 = P(-0.3, 2.05), qd = o.queueDir || { x: sR, z: cR }, win = P(-0.3, D);
  return { signMat, boardMat, opts: o, npcs, queue: [], lastSold: null, window: win,
    slot: (i) => ({ x: q0.x + qd.x * (i ? 0.45 + i * 0.72 : 0) + (i % 2 ? 0.12 : -0.12) * Math.abs(qd.z), z: q0.z + qd.z * (i ? 0.45 + i * 0.72 : 0) + (i % 2 ? 0.12 : -0.12) * Math.abs(qd.x) }) };
}


/* ---------------- 🧀 치즈멜로바이트 쇼룸 (고양이 콘도 왼쪽, 2026-11-17) ---------------- */
// 치즈 조각 지붕 · 치즈 구멍 동그란 창 · 빨간 줄무늬 차양 · 문 앞 풍선 아치. 안에는 쿠키 만드는 자리 CM-0 · CM-1
const SHOW = { x: -30.6, z: -9.4 };
function showBoardTex(n) {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = "#2c3a33"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b8864a"; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22);
    g.textAlign = "center"; g.fillStyle = "#ffd54a";
    g.font = "italic 700 50px Georgia, 'Times New Roman', serif"; g.fillText("Cheese Mellow", w / 2, 92); g.fillText("Bites", w / 2, 150);
    g.fillStyle = "#fff6e0"; g.font = "700 34px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText("치즈멜로바이트 🧀", w / 2, 212);
    g.font = "700 40px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillStyle = "#ffffff";
    g.fillText("200g  $8", w / 2, 292); g.fillText("450g  $15", w / 2, 346);
    g.fillStyle = "#ffd54a"; g.font = "700 32px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText(n == null ? "…" : `청년부가 만든 박스 ${Number(n).toLocaleString()}개`, w / 2, 430);
    g.fillStyle = "#cfe3d6"; g.font = "26px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText("수익금은 청년부 음료수 회비로 🥤", w / 2, 500); g.fillText("눌러서 주문 · 만들기 게임", w / 2, 556);
  });
}
function signScriptTex() {
  return canvasTex(768, 160, (g, w, h) => {
    g.fillStyle = "#fff4dc"; g.beginPath(); g.roundRect ? g.roundRect(6, 6, w - 12, h - 12, 60) : g.rect(6, 6, w - 12, h - 12); g.fill();
    g.strokeStyle = "#d9483b"; g.lineWidth = 8; g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#c62f26";
    g.font = "italic 700 78px Georgia, 'Times New Roman', serif"; g.fillText("Cheese Mellow Bites", w / 2, h / 2 + 4);
  });
}
function checkerTex() { return canvasTex(128, 128, (g, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#f6efe2" : "#d9483b"; g.fillRect(i * 32, j * 32, 32, 32); } }, [6, 5]); }
function makeBalloon(col, r = 0.2) {
  const b = new T.Mesh(new T.SphereGeometry(r, 14, 12), M(col, 0.25, { metalness: 0.05 })); b.scale.set(1, 1.15, 1); b.castShadow = true;
  const knot = new T.Mesh(new T.ConeGeometry(0.03, 0.05, 6), M(col, 0.4)); knot.position.y = -r * 1.15 - 0.01; knot.rotation.x = Math.PI; b.add(knot);
  return b;
}
function buildShowroom(s, seats, obs, clickables, labels, doors) {
  const X = SHOW.x, Z = SHOW.z, g = new T.Group(); g.position.set(X, 0, Z); s.add(g);
  const W2 = 3, D2 = 2.2, H = 2.7;
  const cream = M("#fff1cf", 0.85), red = M("#d9483b", 0.55), white = M("#fbfbf7", 0.6), cheese = M("#f7c948", 0.6), cheeseD = M("#e0a92a", 0.7);
  const glass = new T.MeshStandardMaterial({ color: "#cfe8f5", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
  // 바닥 (빨강·크림 체크) + 벽
  box(g, W2 * 2 - 0.1, 0.06, D2 * 2 - 0.1, new T.MeshStandardMaterial({ map: checkerTex(), roughness: 0.7 }), 0, 0.03, 0, { cast: false });
  box(g, W2 * 2, H, 0.12, cream, 0, H / 2, -D2);
  for (const sx of [-1, 1]) box(g, 0.12, H, D2 * 2, cream, W2 * sx, H / 2, 0);
  box(g, W2 * 2 + 0.1, 0.22, D2 * 2 + 0.1, red, 0, 0.11, 0, { cast: false }); // 아래 띠
  // 앞면: 기둥 · 창 아래 · 창 위 · 문
  for (const sx of [-1, 1]) {
    box(g, 0.8, H, 0.14, cream, (W2 - 0.4) * sx, H / 2, D2);
    box(g, 1.5, 0.7, 0.14, cream, 1.45 * sx, 0.35, D2);
    const gl = box(g, 1.5, 1.3, 0.04, glass, 1.45 * sx, 1.35, D2, { cast: false }); gl.renderOrder = 2;
    box(g, 1.56, 0.07, 0.18, white, 1.45 * sx, 0.72, D2 + 0.02); box(g, 1.56, 0.07, 0.18, white, 1.45 * sx, 2.0, D2 + 0.02);
    box(g, 0.06, 1.3, 0.16, white, 1.45 * sx, 1.35, D2 + 0.02);
    // 화분 (노란 꽃)
    box(g, 1.3, 0.28, 0.32, M("#c9a46a", 0.8), 1.45 * sx, 0.5, D2 + 0.26);
    for (let k = 0; k < 6; k++) { const f = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), M(k % 2 ? "#ffd54a" : "#fff6e0", 0.6)); f.position.set(1.45 * sx - 0.5 + k * 0.2, 0.7, D2 + 0.28); g.add(f); }
  }
  box(g, 6, 0.6, 0.14, cream, 0, H - 0.3, D2);
  // 문 (빨간 문 + 동그란 창)
  box(g, 1.3, 2.1, 0.08, red, 0, 1.05, D2 + 0.02);
  const dw = new T.Mesh(new T.CircleGeometry(0.22, 20), glass); dw.position.set(0, 1.55, D2 + 0.07); g.add(dw);
  const dwf = new T.Mesh(new T.TorusGeometry(0.22, 0.03, 6, 20), white); dwf.position.set(0, 1.55, D2 + 0.07); g.add(dwf);
  const knob = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), M("#f2c84b", 0.3, { metalness: 0.7 })); knob.position.set(0.45, 1.0, D2 + 0.1); g.add(knob);
  // 치즈 조각 지붕 (앞에서 보면 세모, 구멍 뚫린 치즈)
  const tri = new T.Shape(); tri.moveTo(-3.35, 0); tri.lineTo(3.35, 0); tri.lineTo(0, 1.95); tri.closePath();
  const roof = new T.Mesh(new T.ExtrudeGeometry(tri, { depth: 4.9, bevelEnabled: false }), cheese); roof.position.set(0, H, -2.45); roof.castShadow = true; g.add(roof);
  const slope = Math.atan2(1.95, 3.35);
  for (const sx of [-1, 1]) for (const [f, zz, r] of [[0.25, -1.4, 0.3], [0.55, 0.6, 0.22], [0.35, 1.7, 0.18], [0.7, -0.5, 0.15], [0.15, 0.2, 0.2]]) {
    const hd = new T.Mesh(new T.CylinderGeometry(r, r, 0.04, 18), cheeseD);
    hd.position.set(sx * 3.35 * (1 - f), H + 1.95 * f + 0.005, zz); hd.rotation.z = -sx * slope; g.add(hd);
  }
  // 앞 세모 면: 간판 + 동그란 치즈 구멍 창
  const sign = new T.Mesh(new T.PlaneGeometry(3.4, 0.7), new T.MeshBasicMaterial({ map: signScriptTex(), transparent: true })); sign.position.set(0, H + 0.42, 2.47); g.add(sign);
  for (const [cx, cy, r] of [[0, H + 1.38, 0.27], [-0.82, H + 0.98, 0.17], [0.82, H + 0.98, 0.17]]) {
    const w = new T.Mesh(new T.CircleGeometry(r, 20), M("#7a4a22", 0.6, { emissive: "#ffcf6a", emissiveIntensity: 0.35 })); w.position.set(cx, cy, 2.46); g.add(w);
    const fr = new T.Mesh(new T.TorusGeometry(r, 0.035, 6, 20), cheeseD); fr.position.set(cx, cy, 2.47); g.add(fr);
  }
  // 빨간·크림 줄무늬 차양
  const aw = new T.Mesh(new T.PlaneGeometry(5.6, 0.9), new T.MeshStandardMaterial({ map: stripeTex("#d9483b", "#fff4dc"), side: T.DoubleSide, roughness: 0.8 }));
  aw.position.set(0, H - 0.2, D2 + 0.4); aw.rotation.x = -Math.PI / 2 + 0.5; g.add(aw);
  for (let k = 0; k < 14; k++) { const sc = new T.Mesh(new T.CircleGeometry(0.2, 12, 0, Math.PI), M(k % 2 ? "#fff4dc" : "#d9483b", 0.8, { side: T.DoubleSide })); sc.rotation.z = Math.PI; sc.position.set(-2.6 + k * 0.4, H - 0.6, D2 + 0.78); g.add(sc); }
  // 안: 판매대 · 진열 상자 · 냄비 · 네모 틀
  box(g, 4.4, 0.95, 0.55, M("#c98a46", 0.6), -0.2, 0.48, -1.2);
  box(g, 4.5, 0.06, 0.62, cream, -0.2, 0.98, -1.2);
  const pot = cyl(g, 0.2, 0.17, 0.2, M("#9aa0a6", 0.3, { metalness: 0.6 }), -1.6, 1.11, -1.25, 16); void pot;
  cyl(g, 0.17, 0.17, 0.02, M("#fff8ec", 0.5), -1.6, 1.2, -1.25, 16);
  box(g, 0.5, 0.07, 0.4, M("#b0b4b8", 0.3, { metalness: 0.6 }), 0.2, 1.05, -1.2); box(g, 0.44, 0.04, 0.34, cheese, 0.2, 1.09, -1.2);
  const boxM = M("#c62f26", 0.55), ribbon = M("#ffd54a", 0.5);
  const giftBox = (px, py, pz, sz) => { box(g, sz, sz * 0.6, sz, boxM, px, py + sz * 0.3, pz); box(g, sz + 0.01, sz * 0.6 + 0.01, 0.04, ribbon, px, py + sz * 0.3, pz, { cast: false }); box(g, 0.04, sz * 0.6 + 0.01, sz + 0.01, ribbon, px, py + sz * 0.3, pz, { cast: false }); };
  for (const [px, pz, sz] of [[1.1, -1.25, 0.32], [1.45, -1.2, 0.26], [1.8, -1.25, 0.32], [1.3, -1.2, 0.26]]) giftBox(px, 1.01, pz, sz);
  for (const sx of [-1, 1]) { // 창가 진열대
    box(g, 1.3, 0.5, 0.45, white, 1.45 * sx, 0.25, D2 - 0.4);
    giftBox(1.45 * sx - 0.35, 0.5, D2 - 0.4, 0.34); giftBox(1.45 * sx + 0.1, 0.5, D2 - 0.4, 0.26); giftBox(1.45 * sx + 0.45, 0.5, D2 - 0.42, 0.3);
  }
  // 천장 등 (따뜻한 빛)
  for (const sx of [-1.2, 1.2]) { const lp = new T.Mesh(new T.SphereGeometry(0.14, 12, 10), M("#fff3c4", 0.3, { emissive: "#ffd27a", emissiveIntensity: 0.9 })); lp.position.set(sx, H - 0.35, 0); g.add(lp); cyl(g, 0.01, 0.01, 0.3, M("#333", 0.5), sx, H - 0.15, 0, 4); }
  doorMark(g, "showroom"); clickables.push(g); // 집을 누르면 문으로 걸어가서 안으로 들어가요 (2026-11-18)
  obs.push([X - W2 - 0.15, Z - D2 - 0.15, X + W2 + 0.15, Z + D2 + 0.5]);
  doors.push({ x: X, z: Z + D2 + 0.85, to: "showroom" });
  labels.push({ x: X, y: H + 2.55, z: Z, html: "🧀 치즈멜로바이트 쇼룸 · 들어가기", to: "showroom" });
  // 문 앞 마당 (돌 바닥)
  box(s, 8.6, 0.03, 6.2, M("#e8dcc6", 0.95), X, 0.015, Z + D2 + 3.15, { cast: false });
  for (let i = 0; i < 7; i++) { const c = new T.Mesh(new T.CircleGeometry(0.34, 10), M("#d8cdb8", 0.95)); c.rotation.x = -Math.PI / 2; c.position.set(-22.6 - i * 0.62, 0.022, -2.3 - i * 0.12); s.add(c); }
  // 🎈 풍선 아치 (빨강 · 노랑 · 크림)
  const cols = ["#d9483b", "#ffcf3a", "#fff4dc"], AZ = Z + D2 + 2.3, R = 2.15, balloons = [];
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI, bx = X + Math.cos(a) * R, by = 0.25 + Math.sin(a) * 2.7;
    for (const dz of [-0.13, 0.13]) { const b = makeBalloon(cols[(i + (dz > 0 ? 1 : 0)) % 3], 0.19); b.position.set(bx + (dz > 0 ? 0.06 : -0.06), by, AZ + dz); s.add(b); }
  }
  for (const sx of [-1, 1]) {
    obs.push([X + R * sx - 0.3, AZ - 0.3, X + R * sx + 0.3, AZ + 0.3]);
    for (let k = 0; k < 3; k++) { // 둥실둥실 떠 있는 풍선 다발
      const b = makeBalloon(cols[(k + (sx > 0 ? 1 : 0)) % 3], 0.24), base = { x: X + (R + 0.55) * sx + (k - 1) * 0.22, y: 2.9 + k * 0.28, z: AZ + 0.35 + (k % 2) * 0.2 };
      b.position.set(base.x, base.y, base.z); s.add(b);
      const str = cyl(s, 0.004, 0.004, base.y - 0.5, M("#ffffff", 0.6), (base.x + X + (R + 0.3) * sx) / 2, (base.y + 0.5) / 2, base.z, 3); str.rotation.z = (base.x - (X + (R + 0.3) * sx)) / base.y * -1;
      balloons.push({ b, str, base, ph: k * 1.7 + (sx > 0 ? 0.8 : 0) });
    }
    cyl(s, 0.06, 0.08, 0.5, M("#bdbdbd", 0.5), X + (R + 0.3) * sx, 0.25, AZ + 0.45, 8); // 풍선 무게추
  }
  // 칠판 (가격 · 만든 박스 수) + 포스터 이젤
  const boardMat = new T.MeshBasicMaterial({ map: showBoardTex(null) });
  const bd = new T.Group(); bd.position.set(X - 3.9, 0, Z + D2 + 1.2); bd.rotation.y = 0.35; s.add(bd);
  const bp = new T.Mesh(new T.PlaneGeometry(1.1, 1.375), boardMat); bp.position.set(0, 0.93, 0.035); bd.add(bp); // 기울이면 윗부분이 틀 속으로 들어가 잘려 보여서 똑바로 (2026-11-18)
  box(bd, 1.2, 1.48, 0.05, M("#8a5a2e", 0.7), 0, 0.93, 0); box(bd, 0.06, 1.7, 0.06, M("#8a5a2e", 0.7), -0.5, 0.85, -0.25); box(bd, 0.06, 1.7, 0.06, M("#8a5a2e", 0.7), 0.5, 0.85, -0.25);
  bd.traverse((m) => (m.userData.action = "showroom")); clickables.push(bd);
  obs.push([X - 4.6, Z + D2 + 0.6, X - 3.2, Z + D2 + 1.6]);
  const ez = new T.Group(); ez.position.set(X + 3.9, 0, Z + D2 + 1.2); ez.rotation.y = -0.35; s.add(ez);
  const pmat = new T.MeshBasicMaterial({ color: "#ffffff" });
  new T.TextureLoader().load("cheese-mellow-poster.jpg", (tx) => { tx.encoding = T.sRGBEncoding; pmat.map = tx; pmat.needsUpdate = true; });
  const pp = new T.Mesh(new T.PlaneGeometry(1.3, 1.18), pmat); pp.position.set(0, 1.35, 0.05); ez.add(pp);
  box(ez, 1.42, 1.3, 0.06, M("#d9483b", 0.5), 0, 1.35, 0);
  for (const sx of [-0.45, 0.45]) { const lg = box(ez, 0.06, 1.9, 0.06, M("#8a5a2e", 0.7), sx, 0.9, -0.1); lg.rotation.z = sx > 0 ? -0.08 : 0.08; }
  box(ez, 0.06, 1.9, 0.06, M("#8a5a2e", 0.7), 0, 0.85, -0.45).rotation.x = -0.3;
  ez.traverse((m) => (m.userData.action = "showroom")); clickables.push(ez);
  obs.push([X + 3.2, Z + D2 + 0.6, X + 4.6, Z + D2 + 1.6]);
  const update = (t) => { for (const f of balloons) { const dy = Math.sin(t * 1.3 + f.ph) * 0.08, dx = Math.sin(t * 0.9 + f.ph) * 0.05; f.b.position.set(f.base.x + dx, f.base.y + dy, f.base.z); f.b.rotation.z = dx * 0.6; } };
  return { boardMat, update };
}

/* ---------------- 손에 드는 간식 (왼손) ---------------- */
const CARRY = {
  tako: { name: "타코야끼", emoji: "🐙" }, bungeo: { name: "붕어빵", emoji: "🐟" },
  ramen: { name: "라면", emoji: "🍜" }, iceame: { name: "아이스 아메리카노", emoji: "🧊" }, icecream: { name: "아이스크림", emoji: "🍦" },
  latte: { name: "라떼", emoji: "☕" }, tea: { name: "따뜻한 차", emoji: "🍵" }, choco: { name: "핫초코", emoji: "🍫" },
  cheesebite: { name: "치즈멜로바이트", emoji: "🧀" },
  marshraw: { name: "마시멜로 꼬치", emoji: "🍡" }, marsh: { name: "노릇노릇 구운 마시멜로", emoji: "🍡" }, marshburnt: { name: "까맣게 탄 마시멜로", emoji: "🍢" },
};
function makeCarry(kind) {
  const g = new T.Group();
  if (kind === "tako") {
    box(g, 0.2, 0.03, 0.12, M("#c9a27a", 0.8), 0, 0, 0);
    for (let i = 0; i < 6; i++) { const b = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), M("#c9883c", 0.6)); b.position.set(-0.065 + (i % 3) * 0.065, 0.035, -0.03 + Math.floor(i / 3) * 0.06); g.add(b);
      const sauce = new T.Mesh(new T.SphereGeometry(0.031, 8, 6, 0, Math.PI * 2, 0, 1), M("#4a2a18", 0.4)); sauce.position.copy(b.position); g.add(sauce); }
    cyl(g, 0.003, 0.003, 0.14, M("#e8d2a0", 0.7), 0.05, 0.08, 0, 4);
  } else if (kind === "bungeo") {
    const f = new T.Mesh(new T.SphereGeometry(0.07, 12, 8), M("#d9963f", 0.6)); f.scale.set(0.35, 1, 1.6); g.add(f);
    const tl = new T.Mesh(new T.ConeGeometry(0.06, 0.07, 3), M("#d9963f", 0.6)); tl.rotation.x = -Math.PI / 2; tl.position.z = -0.13; tl.scale.set(0.3, 1, 1); g.add(tl);
    box(g, 0.05, 0.1, 0.1, M("#f4ead2", 0.9), 0, -0.05, 0.03);
    g.rotation.x = -0.6;
  } else if (kind === "ramen") {
    cyl(g, 0.07, 0.055, 0.12, M("#ffffff", 0.6), 0, 0, 0, 14); cyl(g, 0.072, 0.072, 0.03, M("#d0312d", 0.6), 0, 0.03, 0, 14);
    cyl(g, 0.064, 0.064, 0.01, M("#e8c46a", 0.7), 0, 0.058, 0, 14);
    for (const dx of [-0.01, 0.01]) { const st = cyl(g, 0.004, 0.004, 0.18, M("#8a5a2e", 0.6), dx, 0.12, 0, 4); st.rotation.z = 0.3; }
  } else if (kind === "iceame" || kind === "latte") {
    const ice = kind === "iceame";
    const cup = cyl(g, 0.05, 0.04, 0.15, ice ? new T.MeshStandardMaterial({ color: "#e8f4ff", transparent: true, opacity: 0.45, roughness: 0.1 }) : M("#fbfbf7", 0.6), 0, 0, 0, 14);
    if (ice) { cyl(g, 0.044, 0.036, 0.12, M("#3b2316", 0.4), 0, -0.01, 0, 12); for (let i = 0; i < 3; i++) box(g, 0.025, 0.025, 0.025, M("#dff0ff", 0.1, { transparent: true, opacity: 0.8 }), -0.015 + i * 0.015, 0.045, 0.01 * i, { cast: false }); }
    else { cyl(g, 0.053, 0.047, 0.05, M("#8a5a3a", 0.9), 0, 0.005, 0, 14); }
    cyl(g, 0.053, 0.053, 0.015, M(ice ? "#e8f4ff" : "#ffffff", 0.4, ice ? { transparent: true, opacity: 0.6 } : undefined), 0, 0.08, 0, 14);
    const straw = cyl(g, 0.006, 0.006, 0.12, M(ice ? "#2e7d4f" : "#ffffff", 0.5), 0.015, 0.13, 0, 6); straw.rotation.z = 0.15; void cup;
  } else if (kind === "icecream") {
    const cone = new T.Mesh(new T.ConeGeometry(0.045, 0.13, 12), M("#d9a45a", 0.7)); cone.rotation.x = Math.PI; g.add(cone);
    const s1 = new T.Mesh(new T.SphereGeometry(0.05, 12, 10), M("#fff4f8", 0.6)); s1.position.y = 0.075; g.add(s1);
    const s2 = new T.Mesh(new T.SphereGeometry(0.042, 12, 10), M("#f7b6c8", 0.6)); s2.position.y = 0.13; g.add(s2);
  } else if (kind === "tea" || kind === "choco") {
    cyl(g, 0.05, 0.045, 0.1, M(kind === "tea" ? "#7fb3a0" : "#e9e2d2", 0.5), 0, 0, 0, 14);
    cyl(g, 0.045, 0.045, 0.01, M(kind === "tea" ? "#b8863a" : "#5a3420", 0.5), 0, 0.046, 0, 14);
    const handle = new T.Mesh(new T.TorusGeometry(0.03, 0.008, 6, 12), M(kind === "tea" ? "#7fb3a0" : "#e9e2d2", 0.5)); handle.position.x = 0.055; g.add(handle);
    if (kind === "tea") { cyl(g, 0.002, 0.002, 0.08, M("#ffffff", 0.6), -0.02, 0.06, 0, 4); box(g, 0.025, 0.03, 0.004, M("#f2c84b", 0.6), -0.03, 0.03, 0.052, { cast: false }); }
  }
  if (kind === "cheesebite") { // 🧀 빨간 상자에 노란 쫀득 큐브
    box(g, 0.17, 0.06, 0.13, M("#c62f26", 0.55), 0, 0, 0);
    box(g, 0.175, 0.01, 0.02, M("#ffd54a", 0.5), 0, 0.03, 0, { cast: false });
    for (let i = 0; i < 4; i++) { const c = box(g, 0.05, 0.045, 0.05, M("#f2b632", 0.7), -0.045 + (i % 2) * 0.09, 0.05, -0.03 + Math.floor(i / 2) * 0.06); c.rotation.y = i * 0.4; }
  }
  if (kind === "marshraw" || kind === "marsh" || kind === "marshburnt") { // 🍡 캠프파이어 마시멜로 꼬치 (길쭉하게 앞으로)
    const st = cyl(g, 0.006, 0.006, 0.42, M("#9a7448", 0.7), 0, 0, 0.18, 5); st.rotation.x = Math.PI / 2 - 0.5;
    const col = kind === "marsh" ? "#e0a24a" : kind === "marshburnt" ? "#2a1d16" : "#fbf7ee";
    for (let i = 0; i < 2; i++) { const m = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.045, 10), M(col, 0.7)); m.rotation.x = Math.PI / 2 - 0.5; m.position.set(0, 0.075 + i * 0.03, 0.3 + i * 0.05); g.add(m); }
  }
  g.position.set(0, -0.36, 0.07); g.scale.setScalar(1.45); // 멀리서도 보이게 조금 크게
  return g;
}

/* ---------------- 길고양이 5마리 ---------------- */
// 교회 마당 길고양이들 (이름·무늬·크기는 여기서 바꿀 수 있어요). size: 몸 크기, slim: 늘씬한 몸
const CATS = [
  { name: "샤샤", sex: "♂", desc: "검정 큰 고양이", base: "#1d1b1b", chest: "#1d1b1b", size: 1.55, eyes: "#e8c23a", nose: "#3a3030" },
  { name: "까맹이", sex: "♀", desc: "알애미 딸 · 뒤태가 엄마를 쏙 닮았어요", base: "#222020", chest: "#222020", size: 1.25, eyes: "#a8d24a", nose: "#3a3030" },
  { name: "껌딱지", sex: "♀", desc: "검정 작은 고양이", base: "#252222", chest: "#252222", size: 0.95, eyes: "#e8c23a", nose: "#3a3030" },
  { name: "탐", sex: "♂", desc: "늘씬한 회색빛 고등어", base: "#7c7f82", stripes: "#3f4245", chest: "#e6e6e2", size: 1.3, slim: true, eyes: "#9cc23a" },
  { name: "브라우니", sex: "♂", desc: "늘씬한 갈색빛 고등어", base: "#7a5534", stripes: "#3e2a18", chest: "#eee0cb", size: 1.3, slim: true, eyes: "#d9b23a" },
];
function makeCat(c) {
  const g = new T.Group(), base = M(c.base, 0.85), chest = M(c.chest, 0.85), pink = M("#f2a7b0", 0.6), dark = M("#1a1a1a", 0.3);
  const body = new T.Mesh(new T.SphereGeometry(0.15, 14, 10), base); body.scale.set(c.slim ? 0.86 : 1, c.slim ? 0.8 : 0.85, c.slim ? 1.85 : 1.65); body.position.y = 0.24; body.castShadow = true; g.add(body);
  const ch = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), chest); ch.scale.set(1, 1, 0.8); ch.position.set(0, 0.22, 0.17); g.add(ch);
  (c.patch || []).forEach(([col], i) => { const p = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), M(col, 0.85)); p.scale.set(1.05, 0.7, 1.1); p.position.set(i ? -0.06 : 0.05, 0.31, i ? 0.08 : -0.12); g.add(p); });
  if (c.stripes) for (let k = 0; k < 3; k++) { const st = new T.Mesh(new T.TorusGeometry(0.135, 0.012, 4, 16, Math.PI), M(c.stripes, 0.8)); st.position.set(0, 0.24, -0.15 + k * 0.1); st.scale.set(1.03, 0.9, 1); g.add(st); }
  const head = new T.Group(); head.position.set(0, 0.38, 0.25); g.add(head);
  head.add(new T.Mesh(new T.SphereGeometry(0.12, 14, 12), base));
  const muzzle = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), chest); muzzle.scale.set(1.2, 0.8, 0.8); muzzle.position.set(0, -0.04, 0.08); head.add(muzzle);
  for (const sx of [-1, 1]) {
    const ear = new T.Mesh(new T.ConeGeometry(0.045, 0.08, 4), base); ear.position.set(0.065 * sx, 0.1, 0); ear.rotation.z = -0.25 * sx; head.add(ear);
    const ein = new T.Mesh(new T.ConeGeometry(0.025, 0.05, 4), pink); ein.position.set(0.065 * sx, 0.1, 0.012); ein.rotation.z = -0.25 * sx; head.add(ein);
    const eye = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), M(c.eyes || "#3a5a2a", 0.2)); eye.position.set(0.045 * sx, 0.015, 0.1); head.add(eye);
    const pup = new T.Mesh(new T.SphereGeometry(0.009, 6, 5), dark); pup.position.set(0.045 * sx, 0.015, 0.115); head.add(pup);
  }
  const nose = new T.Mesh(new T.SphereGeometry(0.012, 6, 5), c.nose ? M(c.nose, 0.4) : pink); nose.position.set(0, -0.02, 0.125); head.add(nose);
  const legs = [];
  for (const [lx, lz] of [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]]) {
    const geo = new T.CylinderGeometry(0.032, 0.03, 0.18, 8); geo.translate(0, -0.09, 0);
    const leg = new T.Mesh(geo, base); leg.position.set(lx, 0.18, lz); g.add(leg);
    const paw = new T.Mesh(new T.SphereGeometry(0.034, 8, 6), M(c.paws || c.base, 0.85)); paw.position.y = -0.18; paw.scale.y = 0.6; leg.add(paw);
    legs.push(leg);
  }
  const tail = new T.Group(); tail.position.set(0, 0.3, -0.24); g.add(tail);
  let prev = tail;
  for (let k = 0; k < 5; k++) { const seg = new T.Group(); seg.position.set(0, k ? 0.07 : 0, 0); seg.rotation.x = -0.35; prev.add(seg); const sm = new T.Mesh(new T.CylinderGeometry(0.022, 0.026, 0.08, 6), k === 4 && c.stripes ? M(c.stripes, 0.8) : base); sm.position.y = 0.035; seg.add(sm); prev = seg; }
  g.scale.setScalar(c.size || 1.25);
  return { group: g, head, legs, tail, body };
}
// 고양이 자세 (걷기 · 앉기 · 먹기 · 쓰다듬기) — 길고양이와 따라다니는 고양이가 같이 써요
function catPose(c, walking, eating, t, petting, i) {
  const sw = walking ? Math.sin(t * 9 + i) * 0.5 : 0;
  c.legs[0].rotation.x = sw; c.legs[3].rotation.x = sw; c.legs[1].rotation.x = -sw; c.legs[2].rotation.x = -sw;
  const sit = !walking && !eating;
  if (sit) { c.legs[2].rotation.x = 1.1; c.legs[3].rotation.x = 1.1; }
  c.body.rotation.x = sit ? -0.3 : eating ? 0.12 : 0; c.body.position.y = sit ? 0.21 : 0.24 + Math.abs(sw) * 0.02;
  c.head.rotation.x = eating ? 0.75 + Math.sin(t * 8 + i) * 0.12 : petting ? -0.45 : sit ? -0.1 + Math.sin(t * 0.5 + i) * 0.08 : 0.05;
  c.head.rotation.z = petting ? Math.sin(t * 6) * 0.15 : 0;
  c.tail.rotation.z = Math.sin(t * (petting ? 6 : 2) + i) * 0.45;
}
// 밥 준 기록 판: { today, last: { name, kind, ago } }
const FEED_NAME = { dry: "🥣 건사료", wet: "🥫 캔사료", churu: "🍬 츄르", water: "💧 물" };
function feedLogTex(info) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#2f3b33"; g.fillRect(0, 0, w, h); g.strokeStyle = "#a8865a"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.fillStyle = "#fff"; g.textAlign = "center";
    g.font = "700 40px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("🐾 오늘 밥 " + (info ? info.today + "번" : "…"), w / 2, 78);
    g.font = "30px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillStyle = "#f3e7c4";
    if (info && info.last) { g.fillText(`마지막: ${info.last.name || "익명"} · ${FEED_NAME[info.last.kind] || ""}`, w / 2, 140); g.fillText(info.last.ago, w / 2, 190); }
    else g.fillText(info ? "오늘 첫 밥을 주세요!" : "", w / 2, 150);
  });
}
// 고양이 산책: 모두의 화면에서 같은 자리에 있도록 "지금 시각"으로 위치를 정해요
function hash32(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }

/* ---------------- 길찾기 (격자 A*) ---------------- */
class Grid {
  constructor(b, obs, cell, pad) {
    this.b = b; this.c = cell;
    this.w = Math.ceil((b.x1 - b.x0) / cell); this.h = Math.ceil((b.z1 - b.z0) / cell);
    this.block = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = b.x0 + (i + 0.5) * cell, z = b.z0 + (j + 0.5) * cell;
      const wp = Math.max(pad, 0.42); // 벽(방 끝)에서는 몸이 벽 밖으로 삐져나오지 않게 더 떨어져요
      let bl = x < b.x0 + wp || x > b.x1 - wp || z < b.z0 + wp || z > b.z1 - wp;
      if (!bl) for (const o of obs) { if (x > o[0] - pad && x < o[2] + pad && z > o[1] - pad && z < o[3] + pad) { bl = true; break; } }
      this.block[j * this.w + i] = bl ? 1 : 0;
    }
  }
  cellOf(x, z) { return [Math.floor((x - this.b.x0) / this.c), Math.floor((z - this.b.z0) / this.c)]; }
  ok(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.block[j * this.w + i]; }
  free(x, z) { const [i, j] = this.cellOf(x, z); return this.ok(i, j); }
  center(i, j) { return { x: this.b.x0 + (i + 0.5) * this.c, z: this.b.z0 + (j + 0.5) * this.c }; }
  nearest(x, z) {
    let [i0, j0] = this.cellOf(x, z);
    if (this.ok(i0, j0)) return { x, z };
    for (let r = 1; r < 40; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (this.ok(i0 + di, j0 + dj)) return this.center(i0 + di, j0 + dj);
    }
    return { x, z };
  }
  los(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / (this.c * 0.4));
    for (let k = 1; k < n; k++) { const t = k / n; if (!this.free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
    return true;
  }
  find(from, to) {
    const s = this.nearest(from.x, from.z), e = this.nearest(to.x, to.z);
    if (this.los(s, e)) return [e];
    const [si, sj] = this.cellOf(s.x, s.z), [ei, ej] = this.cellOf(e.x, e.z);
    const W = this.w, N = W * this.h, gS = new Float32Array(N).fill(Infinity), par = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; const push = (f, id) => { heap.push([f, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const hfn = (i, j) => { const dx = Math.abs(i - ei), dy = Math.abs(j - ej); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const st = sj * W + si, en = ej * W + ei; gS[st] = 0; push(hfn(si, sj), st);
    let found = false, it = 0, best = st, bestH = hfn(si, sj);
    while (heap.length && it++ < N * 8) {
      const [, id] = pop(); if (closed[id]) continue; closed[id] = 1;
      if (id === en) { found = true; break; }
      { const hh = hfn(id % W, (id / W) | 0); if (hh < bestH) { bestH = hh; best = id; } }
      const i = id % W, j = (id / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj; if (!this.ok(ni, nj)) continue;
        if (di && dj && (!this.ok(i + di, j) || !this.ok(i, j + dj))) continue;
        const nid = nj * W + ni, ng = gS[id] + (di && dj ? 1.414 : 1);
        if (ng < gS[nid]) { gS[nid] = ng; par[nid] = id; push(ng + hfn(ni, nj), nid); }
      }
    }
    // 길이 없으면 (예전엔 벽을 뚫고 직진했어요) → 갈 수 있는 가장 가까운 곳까지만 가요
    const goalId = found ? en : best;
    if (goalId === st) return [s];
    const cells = []; for (let id = goalId; id !== -1 && id !== st; id = par[id]) cells.push(this.center(id % W, (id / W) | 0));
    cells.reverse(); if (found) cells[cells.length - 1] = e;
    const out = []; let cur = s;
    for (let k = 0; k < cells.length; k++) {
      const nxt = cells[k + 1];
      if (!nxt || !this.los(cur, nxt)) { out.push(cells[k]); cur = cells[k]; }
    }
    return out;
  }
}

/* ---------------- 방 만들기 ---------------- */
function addLights(scene, o) {
  scene.add(new T.HemisphereLight(o.sky, o.ground, o.hemi));
  const d = new T.DirectionalLight(o.sun || "#fff4e0", o.sunI);
  d.position.set(...o.sunPos); d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  const sc = d.shadow.camera; sc.left = -o.ext; sc.right = o.ext; sc.top = o.ext; sc.bottom = -o.ext; sc.near = 1; sc.far = 120;
  d.shadow.bias = -0.0006; d.shadow.normalBias = 0.02;
  d.target.position.set(...(o.target || [0, 0, 0])); scene.add(d, d.target);
  if (o.amb) scene.add(new T.AmbientLight("#ffffff", o.amb));
}

function seatGroupMark(obj, ids) { obj.traverse((m) => { m.userData.seats = ids; }); }
function doorMark(obj, to) { obj.traverse((m) => { m.userData.door = to; }); }

/* ---------------- 🏀 농구장 (2026-11-18: 건물 뒤에서 눈썰매장 앞으로 옮김 · 테니스·배드민턴은 없앰) ---------------- */
const COURTS = {
  bb: { name: "농구장", emoji: "🏀", rect: [20.6, -19.2, 32.0, -4.8], hoop: { x: 26.3, z: -17.5 }, rimY: 3.05, def: { x: 26.3, z: -10.5 }, three: 5.6 },
};
function courtLines(g, rects, y, col = "#ffffff", w = 0.06) {
  const m = M(col, 0.6);
  for (const [x0, z0, x1, z1] of rects) { // 사각형 테두리
    box(g, x1 - x0, 0.006, w, m, (x0 + x1) / 2, y, z0, { cast: false }); box(g, x1 - x0, 0.006, w, m, (x0 + x1) / 2, y, z1, { cast: false });
    box(g, w, 0.006, z1 - z0, m, x0, y, (z0 + z1) / 2, { cast: false }); box(g, w, 0.006, z1 - z0, m, x1, y, (z0 + z1) / 2, { cast: false });
  }
}
function hline(g, x0, x1, z, y, col = "#ffffff") { box(g, x1 - x0, 0.006, 0.06, M(col, 0.6), (x0 + x1) / 2, y, z, { cast: false }); }
function vline(g, x, z0, z1, y, col = "#ffffff") { box(g, 0.06, 0.006, z1 - z0, M(col, 0.6), x, y, (z0 + z1) / 2, { cast: false }); }
function makeNet(g, cx, z, halfW, h, obs) {
  const post = M("#2d3436", 0.5);
  for (const sx of [-1, 1]) cyl(g, 0.04, 0.04, h + 0.05, post, cx + sx * (halfW + 0.3), (h + 0.05) / 2, z, 8);
  const tex = canvasTex(256, 64, (c, w, hh) => { c.clearRect(0, 0, w, hh); c.strokeStyle = "rgba(30,30,30,.85)"; c.lineWidth = 2; for (let x = 0; x <= w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, hh); c.stroke(); } for (let y = 0; y <= hh; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  tex.wrapS = T.RepeatWrapping; tex.repeat.set(halfW, 1);
  const net = new T.Mesh(new T.PlaneGeometry(halfW * 2 + 0.6, h * 0.75), new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, depthWrite: false }));
  net.position.set(cx, h * 0.625, z); g.add(net);
  box(g, halfW * 2 + 0.6, 0.06, 0.03, M("#ffffff", 0.6), cx, h, z, { cast: false });
  obs.push([cx - halfW - 0.45, z - 0.12, cx + halfW + 0.45, z + 0.12]);
}
function makeRacket(kind) {
  const g = new T.Group(), bad = kind === "bm";
  cyl(g, 0.016, 0.016, bad ? 0.26 : 0.2, M("#222", 0.5), 0, 0.1, 0, 6);
  const head = new T.Mesh(new T.TorusGeometry(bad ? 0.09 : 0.12, 0.012, 6, 18), M(bad ? "#d63031" : "#0984e3", 0.4));
  head.scale.set(1, bad ? 1.25 : 1.3, 1); head.position.y = bad ? 0.36 : 0.34; g.add(head);
  const str = new T.Mesh(new T.CircleGeometry(bad ? 0.085 : 0.115, 16), new T.MeshBasicMaterial({ color: "#f5f5f5", transparent: true, opacity: 0.45, side: T.DoubleSide }));
  str.scale.y = bad ? 1.25 : 1.3; str.position.y = head.position.y; g.add(str);
  g.rotation.x = Math.PI / 2; g.position.set(0, -0.33, 0.05);
  return g;
}
function makeSportBall(kind) {
  if (kind === "bm") { // 셔틀콕: 코르크(공) + 흰 깃털(원뿔)
    const g = new T.Group();
    const cork = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), M("#f4f1ea", 0.6)); g.add(cork);
    const sk = new T.Mesh(new T.ConeGeometry(0.06, 0.11, 12, 1, true), M("#ffffff", 0.7, { side: T.DoubleSide })); sk.rotation.x = Math.PI; sk.position.y = 0.07; g.add(sk);
    g.scale.setScalar(1.6); return g;
  }
  if (kind === "tn") { const b = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), M("#d4ec3a", 0.6, { emissive: "#6a7a10", emissiveIntensity: 0.25 })); b.castShadow = true; return b; }
  const g = new T.Group(); // 농구공
  const b = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), M("#e0782c", 0.6)); b.castShadow = true; g.add(b);
  for (const r of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) { const l = new T.Mesh(new T.TorusGeometry(0.131, 0.006, 4, 24), M("#3a2016", 0.6)); l.rotation.set(...r); g.add(l); }
  return g;
}
function buildCourts(s, seats, obs, clickables, labels) {
  const g = new T.Group(); s.add(g);
  const Y = 0.025, B = COURTS.bb, [bx0, bz0, bx1, bz1] = B.rect;
  /* 🏀 농구장 (하프 코트) — 골대는 눈썰매장 쪽, 앞길 쪽에서 들어와요 */
  box(g, bx1 - bx0 + 0.8, 0.02, bz1 - bz0 + 0.8, M("#6f7377", 0.95), (bx0 + bx1) / 2, Y - 0.004, (bz0 + bz1) / 2, { cast: false });
  box(g, bx1 - bx0, 0.02, bz1 - bz0, M("#3f7f63", 0.85), (bx0 + bx1) / 2, Y, (bz0 + bz1) / 2, { cast: false });
  box(g, 4.9, 0.022, 5.8, M("#b5523b", 0.85), B.hoop.x, Y + 0.002, bz0 + 0.6 + 2.9, { cast: false });
  courtLines(g, [[bx0 + 0.3, bz0 + 0.3, bx1 - 0.3, bz1 - 0.3], [B.hoop.x - 2.45, bz0 + 0.6, B.hoop.x + 2.45, bz0 + 6.4]], Y + 0.015);
  const arc = new T.Mesh(new T.RingGeometry(B.three, B.three + 0.07, 48, 1, 0, Math.PI), M("#ffffff", 0.6, { side: T.DoubleSide })); arc.rotation.x = -Math.PI / 2; arc.rotation.z = Math.PI; arc.position.set(B.hoop.x, Y + 0.016, B.hoop.z + 0.2); g.add(arc);
  const ft = new T.Mesh(new T.RingGeometry(1.75, 1.82, 32), M("#ffffff", 0.6, { side: T.DoubleSide })); ft.rotation.x = -Math.PI / 2; ft.position.set(B.hoop.x, Y + 0.016, bz0 + 6.4); g.add(ft);
  // 골대: 기둥 + 백보드 + 림 + 그물
  const hoopG = new T.Group(); g.add(hoopG);
  cyl(hoopG, 0.1, 0.12, 3.6, M("#2d3436", 0.5), B.hoop.x, 1.8, bz0 + 0.1, 10);
  box(hoopG, 0.12, 0.12, 0.9, M("#2d3436", 0.5), B.hoop.x, 3.5, bz0 + 0.5);
  box(hoopG, 1.8, 1.05, 0.05, M("#ffffff", 0.3, { transparent: true, opacity: 0.92 }), B.hoop.x, 3.45, B.hoop.z - 0.38);
  box(hoopG, 0.6, 0.45, 0.06, M("#d63031", 0.5), B.hoop.x, 3.3, B.hoop.z - 0.37, { cast: false });
  box(hoopG, 0.5, 0.35, 0.065, M("#ffffff", 0.5), B.hoop.x, 3.3, B.hoop.z - 0.37, { cast: false });
  const rim = new T.Mesh(new T.TorusGeometry(0.23, 0.018, 8, 24), M("#e17055", 0.4)); rim.rotation.x = Math.PI / 2; rim.position.set(B.hoop.x, B.rimY, B.hoop.z); hoopG.add(rim);
  const net = new T.Mesh(new T.CylinderGeometry(0.23, 0.15, 0.42, 14, 1, true), new T.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.8 })); net.position.set(B.hoop.x, B.rimY - 0.21, B.hoop.z); hoopG.add(net);
  hoopG.traverse((m) => (m.userData.action = "court:bb")); clickables.push(hoopG);
  obs.push([B.hoop.x - 0.25, bz0, B.hoop.x + 0.25, bz0 + 0.4]);
  labels.push({ x: B.hoop.x, y: 4.55, z: B.hoop.z - 0.3, html: "🏀 농구장 · 공 잡고 슛!", action: "court:bb", court: "bb" });
  // 가로등 + 구경 벤치 (코트 앞, 골대 쪽을 봐요)
  for (const [x, z] of [[bx0 - 0.4, bz0 + 0.4], [bx1 + 0.2, bz0 + 0.4], [bx1 + 0.2, bz1 - 0.2]]) {
    cyl(g, 0.07, 0.09, 3.6, M("#2e3135", 0.5), x, 1.8, z, 8);
    const bulb = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), M("#fff4d0", 0.4, { emissive: "#ffe9a8", emissiveIntensity: 0.9 })); bulb.position.set(x, 3.7, z); g.add(bulb);
    obs.push([x - 0.2, z - 0.2, x + 0.2, z + 0.2]);
  }
  [[24.0, bz1 + 1.3, Math.PI, "BN0"], [28.6, bz1 + 1.3, Math.PI, "BN1"]].forEach(([x, z, ry, id]) => {
    const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    box(b, 1.8, 0.07, 0.5, M("#a0703f", 0.8), 0, 0.45, 0); box(b, 1.8, 0.35, 0.06, M("#a0703f", 0.8), 0, 0.72, -0.24);
    for (const lx of [-0.8, 0.8]) box(b, 0.07, 0.45, 0.5, M("#3a3a3a", 0.5), lx, 0.22, 0);
    const ids = [];
    for (const k of [-0.42, 0.42]) { const sid = `${id}-${ids.length}`, c = Math.cos(ry), sn = Math.sin(ry), sx = x + k * c, sz = z - k * sn; seats[sid] = { x: sx, z: sz, rot: ry, h: 0.47, ax: sx + Math.sin(ry) * 0.75, az: sz + Math.cos(ry) * 0.75 }; ids.push(sid); }
    seatGroupMark(b, ids); clickables.push(b);
    obs.push([x - 0.95, z - 0.3, x + 0.95, z + 0.3]);
  });
  // 공 (농구공만 보여요. 테니스공·셔틀콕은 예전 코드가 찾지 않게 숨겨 둔 채로만)
  const balls = { bb: makeSportBall("bb"), tn: makeSportBall("tn"), bm: makeSportBall("bm") };
  balls.bb.position.set(B.def.x, 0.13, B.def.z); balls.tn.visible = false; balls.bm.visible = false;
  g.add(balls.bb);
  balls.bb.traverse((m) => (m.userData.action = "ball:bb")); clickables.push(balls.bb);
  // 🏆 농구 이번 주 랭킹 게시판 (코트 앞 왼쪽, 앞길에서 보이게)
  const sportBoard = addBoard(g, 21.4, -2.6, 0.25, 2.0, "🏆 농구 이번 주 랭킹", { bg: "#1f3550", frame: "#f2c84b", empty: "첫 골의 주인공은?", foot: "골 2·3점 · 팀전 승리 3점" }, "sportrank", labels, clickables, "🏆 농구 랭킹");
  obs.push([20.4, -2.9, 22.4, -2.3]);
  return { balls, net, sportBoard };
}

/* ---------------- 🧭 마당 구역 5개 (2026-11-18) ---------------- */
const ZONES = [
  { id: "play", name: "⛹️ 놀이 동산", x: 38, z: -18, test: (x, z) => x > 19.6 },
  { id: "back", name: "🔥 뒷마당 쉼터", x: -3, z: -31, test: (x, z) => z < -19.6 },
  { id: "food", name: "🍢 먹거리·가게 골목", x: -30.6, z: 1.5, test: (x, z) => x < -24.2 && z > -16 },
  { id: "cat", name: "🐱 고양이 쉼터", x: -20.5, z: -8.5, test: (x, z) => x < -15.4 && z < -1 },
  { id: "front", name: "⛪ 교회 앞마당", x: 0, z: 6, test: () => true },
];
function zoneAt(x, z) { return ZONES.find((zz) => zz.test(x, z)); }
function zoneArch(s, obs, x, z, ry, w, text, bg) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g);
  const post = M("#6b4a2e", 0.7);
  for (const sx of [-w / 2, w / 2]) { cyl(g, 0.09, 0.11, 3.0, post, sx, 1.5, 0, 8); const c = Math.cos(ry), sn = Math.sin(ry); obs.push([x + sx * c - 0.18, z - sx * sn - 0.18, x + sx * c + 0.18, z - sx * sn + 0.18]); }
  box(g, w + 0.4, 0.16, 0.16, post, 0, 3.0, 0);
  const sm = new T.MeshBasicMaterial({ map: textTex([[text, 46, 52]], { w: 560, h: 100, bg, border: "#fff4dc" }) });
  for (const back of [0, 1]) { const sg = new T.Mesh(new T.PlaneGeometry(Math.min(w, 3.6), 0.62), sm); sg.position.set(0, 2.6, back ? -0.02 : 0.02); sg.rotation.y = back ? Math.PI : 0; g.add(sg); } // 앞뒤 모두 글자가 바로 보여요
  for (let k = 0; k < 7; k++) { const f = new T.Mesh(new T.ConeGeometry(0.11, 0.24, 3), M(["#d9483b", "#f2c84b", "#3a8fd9", "#4f9a5a"][k % 4], 0.7)); f.rotation.x = Math.PI; f.position.set(-w / 2 + (k + 0.5) * (w / 7), 2.82, 0.05); g.add(f); }
  return g;
}

/* ---------------- 🔥 뒷마당 쉼터: 캠프파이어 + 🌿 말씀 산책길 (2026-11-18, 예전 운동장 자리) ---------------- */
// 2026-11-18 오후: 사용자 그림대로 — 건물 뒤 오른쪽에서 시작하는 꼬불꼬불 산책길 → 호수 옆 → 끝 팻말,
//                  왼쪽에 캠프파이어, 맨 왼쪽에 청음회 잔디밭
const FIRE = { x: -12.5, z: -29, r: 2.5 };
const LISTEN = { x: -17.6, z: -38.6 };
const LAKE = { x: 8.6, z: -39.6, rx: 5.4, rz: 3.5 };
const WALK = (() => {
  const ctrl = [[13.5, -23.0], [12.6, -26], [11.4, -31.2], [9.4, -33.0], [7.6, -31], [7.0, -26.2], [5.4, -24.2], [3.6, -26], [2.9, -31.2], [1.2, -33.2], [-0.6, -31.2],
    [-1.5, -26.5], [-3.3, -24.4], [-5.2, -26.4], [-5.8, -31.8], [-5.4, -37.2], [-4.6, -41.0]];
  const curve = new T.CatmullRomCurve3(ctrl.map(([x, z]) => new T.Vector3(x, 0, z)), false, "catmullrom", 0.4);
  const L = curve.getLength(), at = (u) => { const p = curve.getPointAt(u), t = curve.getTangentAt(u); return { x: p.x, z: p.z, tx: t.x, tz: t.z }; };
  const n = 7, signs = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / (n + 1), p = at(u), side = i % 2 ? 1 : -1, nx = -p.tz * side, nz = p.tx * side; // 길 옆으로 1.1m
    signs.push({ x: p.x + nx * 1.1, z: p.z + nz * 1.1, path: { x: p.x, z: p.z }, ry: Math.atan2(-nx, -nz) });
  }
  const st = at(0), en = at(1);
  return { n, curve, L, at, signs, start: { x: st.x, z: st.z }, end: { x: en.x, z: en.z } };
})();
function walkSignTex(v, i, done) {
  return canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = done ? "#fff6d6" : "#f6efe0"; g.fillRect(0, 0, w, h);
    g.strokeStyle = done ? "#e0a92a" : "#8a6a44"; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = "center";
    if (done && v) { // 지나간 팻말: 말씀이 보여요
      g.fillStyle = "#6b8a63"; g.font = "700 30px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(`🌿 ${i + 1} / ${WALK.n} ✓`, w / 2, 52);
      g.fillStyle = "#3a2e22"; g.font = "30px 'Gowun Batang', 'Apple SD Gothic Neo', serif";
      const lines = []; let cur = "";
      for (const ch of v.text) { if (g.measureText(cur + ch).width > w - 70) { lines.push(cur); cur = ch; } else cur += ch; }
      if (cur) lines.push(cur);
      const shown = lines.slice(0, 6); if (lines.length > 6) shown[5] = shown[5].slice(0, -1) + "…";
      shown.forEach((l, k) => g.fillText(l, w / 2, 104 + k * 40));
      g.fillStyle = "#8a6a44"; g.font = "700 26px 'Gowun Dodum', sans-serif"; g.fillText(v.ref, w / 2, h - 30);
    } else { // 아직: 번호만 크게 (앞에 서면 말씀이 펼쳐져요)
      g.fillStyle = "#6b8a63"; g.font = "700 120px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(String(i + 1), w / 2, 190);
      g.fillStyle = "#8a6a44"; g.font = "700 30px 'Gowun Dodum', sans-serif"; g.fillText("🌿 앞에 서면 말씀이 펼쳐져요", w / 2, 280);
    }
  });
}
// 🎶 청음회 안내판 (제목 · 주최 · 시간 · 지금 곡 · 다음 곡)
function listenBoardTex(info) {
  return canvasTex(900, 540, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#1b1f3a"); grd.addColorStop(1, "#2f2a4f"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,248,220,${0.2 + ((i * 37) % 10) / 14})`; g.beginPath(); g.arc((i * 151) % w, (i * 83) % 200, 1 + (i % 3), 0, 7); g.fill(); }
    g.strokeStyle = "#f2d98a"; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = "center"; g.fillStyle = "#f2d98a"; g.font = "700 34px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("🎶 한밤의 청음회", w / 2, 70);
    const I = info || {};
    if (!I.title) { g.fillStyle = "#fff8e4"; g.font = "36px 'Gowun Dodum', sans-serif"; g.fillText(I.loading ? "불러오는 중…" : "아직 예정된 청음회가 없어요", w / 2, 250); g.fillStyle = "#cfc8ee"; g.font = "28px 'Gowun Dodum', sans-serif"; g.fillText("눌러서 예약해요 · 찬양 30분을 함께 들어요", w / 2, 310); return; }
    g.fillStyle = "#ffffff"; g.font = "700 54px 'Gowun Dodum', sans-serif"; let t = I.title; while (t.length > 1 && g.measureText(t).width > w - 80) t = t.slice(0, -1); g.fillText(t, w / 2, 160);
    g.fillStyle = "#cfc8ee"; g.font = "30px 'Gowun Dodum', sans-serif"; g.fillText(`주최 ${I.host || "익명"} · ${I.when || ""}`, w / 2, 212);
    if (I.now) { g.fillStyle = "#f2d98a"; g.font = "700 32px 'Gowun Dodum', sans-serif"; g.fillText("▶ 지금", w / 2, 290); g.fillStyle = "#fff"; g.font = "36px 'Gowun Dodum', sans-serif"; let n = I.now; while (n.length > 1 && g.measureText(n).width > w - 80) n = n.slice(0, -1); g.fillText(n, w / 2, 340); }
    else { g.fillStyle = "#fff8e4"; g.font = "34px 'Gowun Dodum', sans-serif"; g.fillText(I.state || "", w / 2, 320); }
    if (I.next) { g.fillStyle = "#cfc8ee"; g.font = "28px 'Gowun Dodum', sans-serif"; let n = "다음 · " + I.next; while (n.length > 1 && g.measureText(n).width > w - 80) n = n.slice(0, -1); g.fillText(n, w / 2, 400); }
    g.fillStyle = "#9a93c8"; g.font = "24px 'Gowun Dodum', sans-serif"; g.fillText("돗자리에 앉아서 함께 들어요 · 눌러서 자세히", w / 2, h - 34);
  });
}
function buildBackyard(s, seats, obs, clickables, labels) {
  const g = new T.Group(); s.add(g);
  const path = M("#c9b590", 0.95), stone = M("#9a958c", 0.9), log = M("#7a5234", 0.85), logEnd = M("#c9a273", 0.8);
  // 건물 양옆 길 + 산책길 입구로 가는 짧은 길
  box(g, 3.2, 0.03, 26, M("#d6d2ca", 0.95), -17.6, 0.014, -6.5, { cast: false });
  box(g, 3.0, 0.03, 4, M("#d6d2ca", 0.95), 17.8, 0.014, -19.5, { cast: false });
  box(g, 4.4, 0.025, 1.8, path, 15.4, 0.013, -21.9, { cast: false });
  // 🌿 꼬불꼬불 산책길 (돌길)
  const N = Math.round(WALK.L / 0.6);
  for (let i = 0; i <= N; i++) { const p = WALK.at(i / N); const c = new T.Mesh(new T.CircleGeometry(0.44 + (i % 3) * 0.04, 10), path); c.rotation.x = -Math.PI / 2; c.rotation.z = i; c.position.set(p.x, 0.02, p.z); c.receiveShadow = true; g.add(c); }
  for (let k = 0; k < 70; k++) { const p = WALK.at(k / 70), r = k % 2 ? 1.05 : -1.05; const f = new T.Mesh(new T.SphereGeometry(0.06, 6, 5), M(["#f2b6c8", "#ffe08a", "#ffffff", "#c9a8ff"][k % 4], 0.7)); f.position.set(p.x - p.tz * r, 0.12, p.z + p.tx * r); g.add(f); }
  // 시작 아치 (+ 안내판: 누르면 사용 설명)
  const S0 = WALK.start, arch = new T.Group(); arch.position.set(S0.x, 0, S0.z + 0.3); g.add(arch);
  for (const sx of [-1.3, 1.3]) { cyl(arch, 0.08, 0.1, 2.6, log, sx, 1.3, 0, 8); obs.push([S0.x + sx - 0.15, S0.z + 0.15, S0.x + sx + 0.15, S0.z + 0.45]); }
  box(arch, 3.0, 0.14, 0.14, log, 0, 2.6, 0);
  const apm = new T.MeshBasicMaterial({ map: textTex([["🌿 말씀 산책길 · 시작", 42, 52]], { w: 520, h: 100, bg: "#4f7a4a", border: "#e8d9b0" }) });
  for (const back of [0, 1]) { const ap = new T.Mesh(new T.PlaneGeometry(2.7, 0.52), apm); ap.position.set(0, 2.25, back ? -0.08 : 0.08); ap.rotation.y = back ? Math.PI : 0; arch.add(ap); }
  for (let k = 0; k < 10; k++) { const v = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), M(k % 3 ? "#5f9e4a" : "#f2b6c8", 0.7)); v.position.set(-1.3 + (k % 5) * 0.65, 2.75 + (k % 2) * 0.08, 0.05); arch.add(v); }
  const guide = new T.Group(); guide.position.set(S0.x + 2.2, 0, S0.z + 0.6); guide.rotation.y = -0.5; g.add(guide);
  cyl(guide, 0.05, 0.05, 1.2, log, 0, 0.6, 0, 6); box(guide, 1.0, 0.7, 0.05, M("#f6efe0", 0.8), 0, 1.4, 0.02);
  const gp = new T.Mesh(new T.PlaneGeometry(0.95, 0.65), new T.MeshBasicMaterial({ map: textTex([["📜 사용 설명", 40, 50], ["눌러 보세요", 30, 100]], { w: 300, h: 150, bg: "#f6efe0", fg: "#4f7a4a" }) })); gp.position.set(0, 1.4, 0.05); guide.add(gp);
  obs.push([S0.x + 2.0, S0.z + 0.4, S0.x + 2.4, S0.z + 0.8]);
  arch.traverse((m) => (m.userData.action = "walk")); guide.traverse((m) => (m.userData.action = "walkhelp")); clickables.push(arch, guide);
  labels.push({ x: S0.x, y: 3.3, z: S0.z, html: "🌿 말씀 산책길 · 여기서 시작", action: "walk" });
  // 팻말 7개 (앞에 서야 말씀이 펼쳐져요)
  const signs = WALK.signs.map((sp, i) => {
    const sg = new T.Group(); sg.position.set(sp.x, 0, sp.z); sg.rotation.y = sp.ry; g.add(sg);
    cyl(sg, 0.06, 0.07, 1.25, log, 0, 0.62, -0.04, 8);
    const frame = M("#8a6a44", 0.7), mat = new T.MeshBasicMaterial({ map: walkSignTex(null, i, false) });
    box(sg, 1.28, 0.92, 0.06, frame, 0, 1.55, -0.04);
    const pl = new T.Mesh(new T.PlaneGeometry(1.2, 0.84), mat); pl.position.set(0, 1.55, 0.0); sg.add(pl);
    const glow = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), M("#ffe9a8", 0.3, { emissive: "#ffd36a", emissiveIntensity: 0 })); glow.position.set(0, 2.1, 0); sg.add(glow);
    sg.traverse((m) => (m.userData.action = "walksign:" + i)); clickables.push(sg);
    obs.push([sp.x - 0.2, sp.z - 0.2, sp.x + 0.2, sp.z + 0.2]);
    return { mat, frame, glow, i };
  });
  // 🏁 끝 팻말
  const E0 = WALK.end, endG = new T.Group(); endG.position.set(E0.x - 0.9, 0, E0.z - 0.4); endG.rotation.y = 0.5; g.add(endG);
  cyl(endG, 0.07, 0.08, 1.9, log, 0, 0.95, 0, 8);
  const ep = new T.Mesh(new T.PlaneGeometry(1.3, 0.6), new T.MeshBasicMaterial({ map: textTex([["🏁 끝", 52, 58], ["오늘의 질문", 28, 100]], { w: 300, h: 140, bg: "#7a3a24", border: "#ffe08a" }) }));
  ep.position.set(0, 1.75, 0.05); endG.add(ep); box(endG, 1.36, 0.66, 0.05, M("#5a3a24", 0.7), 0, 1.75, 0);
  endG.traverse((m) => (m.userData.action = "walkend")); clickables.push(endG);
  obs.push([E0.x - 1.1, E0.z - 0.6, E0.x - 0.7, E0.z - 0.2]);
  labels.push({ x: E0.x - 0.9, y: 2.6, z: E0.z - 0.4, html: "🏁 산책길 끝", action: "walkend" });
  // 💧 호수 + 오리 + 호숫가 벤치
  const L = LAKE, water = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshStandardMaterial({ color: "#5aa6c9", roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(L.rx, L.rz, 1); water.position.set(L.x, 0.03, L.z); g.add(water);
  const rim = new T.Mesh(new T.RingGeometry(1, 1.12, 40), M("#8f8a7a", 0.9)); rim.rotation.x = -Math.PI / 2; rim.scale.set(L.rx, L.rz, 1); rim.position.set(L.x, 0.035, L.z); g.add(rim);
  for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, st = new T.Mesh(new T.DodecahedronGeometry(0.22 + (k % 3) * 0.06, 0), stone); st.position.set(L.x + Math.cos(a) * L.rx * 1.08, 0.08, L.z + Math.sin(a) * L.rz * 1.1); st.rotation.set(k, k * 2, 0); g.add(st); }
  for (let k = 0; k < 9; k++) { const a = Math.PI * 0.95 + k * 0.12, rx = L.x + Math.cos(a) * L.rx * 0.93, rz = L.z + Math.sin(a) * L.rz * 0.93; for (let j = 0; j < 3; j++) cyl(g, 0.012, 0.012, 0.7 + j * 0.15, M("#6f8f3a", 0.8), rx + j * 0.05, 0.4, rz + j * 0.04, 4); }
  const pads = []; for (let k = 0; k < 5; k++) { const lp = new T.Mesh(new T.CircleGeometry(0.28, 10, 0.3, Math.PI * 1.8), M("#4f9a4a", 0.8)); lp.rotation.x = -Math.PI / 2; lp.position.set(L.x - 2 + k * 1.1, 0.04, L.z + ((k * 7) % 3 - 1) * 0.9); g.add(lp); pads.push(lp); }
  for (let zz = L.z - L.rz; zz <= L.z + L.rz; zz += 1.2) { const hw = L.rx * Math.sqrt(Math.max(0, 1 - ((zz - L.z) / L.rz) ** 2)); obs.push([L.x - hw - 0.3, zz - 0.6, L.x + hw + 0.3, zz + 0.6]); }
  const duckM = M("#fbfbf7", 0.6), bill = M("#f0a030", 0.5), ducks = [];
  for (let k = 0; k < 3; k++) {
    const d = new T.Group(); g.add(d);
    const b = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), k === 2 ? M("#8a6a4a", 0.7) : duckM); b.scale.set(0.9, 0.7, 1.3); b.position.y = 0.1; d.add(b);
    const hd = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), k === 2 ? M("#2f6a3a", 0.5) : duckM); hd.position.set(0, 0.26, 0.15); d.add(hd);
    const bk = new T.Mesh(new T.ConeGeometry(0.035, 0.09, 6), bill); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.25, 0.26); d.add(bk);
    ducks.push({ d, r: 0.45 + k * 0.17, sp: 0.18 + k * 0.05, ph: k * 2.1 });
  }
  labels.push({ x: L.x, y: 1.8, z: L.z, html: "💧 그루터기 호수" });
  // 호숫가 벤치 2개 (호수 동쪽, 호수를 바라봐요) — 자리 LB0-0/1 · LB1-0/1
  [[L.x + L.rx + 1.6, L.z + 1.2, -Math.PI / 2, "LB0"], [L.x + L.rx + 1.6, L.z - 1.6, -Math.PI / 2, "LB1"]].forEach(([x, z, ry, id]) => {
    const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    box(b, 1.8, 0.07, 0.5, M("#a0703f", 0.8), 0, 0.45, 0); box(b, 1.8, 0.35, 0.06, M("#a0703f", 0.8), 0, 0.72, -0.24);
    for (const lx of [-0.8, 0.8]) box(b, 0.07, 0.45, 0.5, M("#3a3a3a", 0.5), lx, 0.22, 0);
    const ids = []; for (const k of [-0.42, 0.42]) { const sid = `${id}-${ids.length}`, c = Math.cos(ry), sn = Math.sin(ry), sx = x + k * c, sz = z - k * sn; seats[sid] = { x: sx, z: sz, rot: ry, h: 0.47, ax: sx + Math.sin(ry) * 0.75, az: sz + Math.cos(ry) * 0.75 }; ids.push(sid); }
    seatGroupMark(b, ids); clickables.push(b); obs.push([x - 0.3, z - 0.95, x + 0.3, z + 0.95]);
  });
  labels.push({ x: L.x + L.rx + 1.6, y: 1.5, z: L.z - 0.2, html: "🪑 호숫가 벤치 · 🪨 물수제비" });
  // 🔥 캠프파이어 (왼쪽): 돌 둘레 + 장작 + 불꽃 + 불빛 + 통나무 의자 8개 (CF-0~7)
  const F = FIRE;
  const pit = new T.Mesh(new T.CircleGeometry(4.2, 28), M("#8f8068", 0.95)); pit.rotation.x = -Math.PI / 2; pit.position.set(F.x, 0.018, F.z); pit.receiveShadow = true; g.add(pit);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, st = new T.Mesh(new T.DodecahedronGeometry(0.17, 0), stone); st.position.set(F.x + Math.sin(a) * 0.62, 0.1, F.z + Math.cos(a) * 0.62); st.rotation.set(k, k * 2, 0); g.add(st); }
  for (let k = 0; k < 4; k++) { const lg = cyl(g, 0.06, 0.07, 0.8, log, F.x, 0.12, F.z, 8); lg.rotation.set(Math.PI / 2 - 0.35, (k / 4) * Math.PI, 0); }
  const flames = [], fm = (c, o) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  [["#ff5a14", 0.92, 0.34, 1.0], ["#ff9a1e", 0.9, 0.24, 0.8], ["#ffe36a", 0.9, 0.13, 0.5]].forEach(([c, o, r, hh], k) => {
    for (let j = 0; j < (k === 2 ? 1 : 3); j++) { const f = new T.Mesh(new T.ConeGeometry(r, hh, 10, 1, true), fm(c, o)); const a = j * 2.1; f.position.set(F.x + (k === 2 ? 0 : Math.sin(a) * 0.12), 0.2 + hh / 2, F.z + (k === 2 ? 0 : Math.cos(a) * 0.12)); f.userData = { base: hh, ph: k * 1.3 + j * 0.9 }; g.add(f); flames.push(f); }
  });
  const light = new T.PointLight("#ff9a3c", 1.2, 11, 1.6); light.position.set(F.x, 1.2, F.z); g.add(light);
  const sparkN = 26, sp = new Float32Array(sparkN * 3), sparkGeo = new T.BufferGeometry();
  for (let i = 0; i < sparkN; i++) { sp[i * 3] = F.x; sp[i * 3 + 1] = Math.random() * 2.5; sp[i * 3 + 2] = F.z; }
  sparkGeo.setAttribute("position", new T.BufferAttribute(sp, 3));
  g.add(new T.Points(sparkGeo, new T.PointsMaterial({ color: "#ffcf6a", size: 0.06, transparent: true, opacity: 0.85, depthWrite: false })));
  obs.push([F.x - 0.75, F.z - 0.75, F.x + 0.75, F.z + 0.75]);
  pit.userData.action = "campfire"; clickables.push(pit);
  labels.push({ x: F.x, y: 2.4, z: F.z, html: "🔥 캠프파이어 · 통나무에 앉아요", action: "campfire" });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = F.x + Math.sin(a) * F.r, z = F.z + Math.cos(a) * F.r, id = "CF-" + k;
    const lg = new T.Group(); lg.position.set(x, 0, z); lg.rotation.y = a + Math.PI / 2; g.add(lg);
    const body = cyl(lg, 0.2, 0.2, 0.95, log, 0, 0.2, 0, 12); body.rotation.z = Math.PI / 2;
    for (const sx of [-0.48, 0.48]) { const e = new T.Mesh(new T.CircleGeometry(0.19, 12), logEnd); e.position.set(sx, 0.2, 0); e.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; lg.add(e); }
    seats[id] = { x, z, rot: a + Math.PI, h: 0.4, ax: x + Math.sin(a) * 0.7, az: z + Math.cos(a) * 0.7, fire: true };
    seatGroupMark(lg, [id]); clickables.push(lg);
    obs.push([x - 0.32, z - 0.32, x + 0.32, z + 0.32]);
  }
  // 🎶 청음회 잔디밭 (맨 왼쪽): 돗자리 + 가운데 큰 안내판 + 스피커 + 전구
  const Lc = LISTEN;
  const lawn = new T.Mesh(new T.CircleGeometry(6.2, 36), M("#7fbf5a", 0.95)); lawn.rotation.x = -Math.PI / 2; lawn.scale.set(1.05, 0.85, 1); lawn.position.set(Lc.x, 0.016, Lc.z); lawn.receiveShadow = true; g.add(lawn);
  const bdG = new T.Group(); bdG.position.set(Lc.x, 0, Lc.z + 4.6); bdG.rotation.y = Math.PI; g.add(bdG); // 건물 쪽에 서서 뒷마당 안쪽을 봐요 (카메라에서 잘 보이게)
  for (const sx of [-2.1, 2.1]) cyl(bdG, 0.08, 0.08, 3.6, M("#2e2a3a", 0.5), sx, 1.8, 0, 8);
  box(bdG, 4.3, 2.65, 0.12, M("#2e2a3a", 0.5), 0, 2.15, -0.05);
  const listenMat = new T.MeshBasicMaterial({ map: listenBoardTex({ loading: true }) });
  const bp = new T.Mesh(new T.PlaneGeometry(4.1, 2.46), listenMat); bp.position.set(0, 2.15, 0.02); bdG.add(bp);
  for (const sx of [-2.7, 2.7]) { box(bdG, 0.5, 0.9, 0.45, M("#222", 0.6), sx, 0.45, 0.2); const cone = new T.Mesh(new T.CircleGeometry(0.15, 14), M("#555", 0.4)); cone.position.set(sx, 0.55, 0.43); bdG.add(cone); }
  bdG.traverse((m) => (m.userData.action = "listen")); clickables.push(bdG);
  obs.push([Lc.x - 3.1, Lc.z + 4.2, Lc.x + 3.1, Lc.z + 5.0]);
  labels.push({ x: Lc.x, y: 4.0, z: Lc.z + 4.6, html: "🎶 한밤의 청음회 · 눌러서 예약·듣기", action: "listen" });
  const matCols = [["#d9483b", "#fff4dc"], ["#3a8fd9", "#ffffff"], ["#f2c84b", "#fff6e0"], ["#4f9a5a", "#f3f8ee"], ["#8e44ad", "#f6eefc"], ["#e8862f", "#fff1e0"]];
  const mats = [[-3.2, -1.6], [0, -1.9], [3.2, -1.6], [-3.4, 1.1], [0, 0.9], [3.4, 1.1]];
  mats.forEach(([dx, dz], mi) => {
    const x = Lc.x + dx, z = Lc.z + dz, [c1, c2] = matCols[mi];
    const mt = new T.Mesh(new T.PlaneGeometry(2.2, 1.6), new T.MeshStandardMaterial({ map: stripeTex(c1, c2), roughness: 0.9 })); mt.rotation.x = -Math.PI / 2; mt.position.set(x, 0.03, z); mt.receiveShadow = true; g.add(mt);
    const rot = Math.atan2(Lc.x - x, (Lc.z + 4.6) - z), ids = [];
    for (const k of [-0.5, 0.5]) { const sid = `LS${mi}-${ids.length}`, c = Math.cos(rot), sn = Math.sin(rot), sx = x + k * c, sz = z - k * sn; seats[sid] = { x: sx, z: sz, rot, h: 0.36, ax: sx - Math.sin(rot) * 0.9, az: sz - Math.cos(rot) * 0.9, listen: true }; ids.push(sid); }
    mt.userData.seats = ids; clickables.push(mt);
  });
  for (let k = 0; k <= 12; k++) { const a = Math.PI * 1.1 + (k / 12) * Math.PI * 0.8; const x = Lc.x + Math.cos(a) * 6.4, z = Lc.z + Math.sin(a) * 5.4 + 0.6; if (k % 4 === 0) { cyl(g, 0.04, 0.05, 2.6, M("#3a3a3a", 0.5), x, 1.3, z, 6); obs.push([x - 0.1, z - 0.1, x + 0.1, z + 0.1]); } }
  { const twk2 = []; const run = []; for (let k = 0; k <= 12; k += 4) { const a = Math.PI * 1.1 + (k / 12) * Math.PI * 0.8; run.push([Lc.x + Math.cos(a) * 6.4, 2.6, Lc.z + Math.sin(a) * 5.4 + 0.6]); } lightRun(g, twk2, run, 10, 0.25); }
  // 가로등 · 덤불
  for (const u of [0.06, 0.24, 0.42, 0.6, 0.78, 0.95]) { const p = WALK.at(u), x = p.x + p.tz * 1.7, z = p.z - p.tx * 1.7;
    cyl(g, 0.06, 0.08, 2.8, M("#2e3135", 0.5), x, 1.4, z, 8); const bulb = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), M("#fff4d0", 0.4, { emissive: "#ffe9a8", emissiveIntensity: 0.9 })); bulb.position.set(x, 2.9, z); g.add(bulb); obs.push([x - 0.18, z - 0.18, x + 0.18, z + 0.18]); }
  const bush = (x, z, sc, col) => { const b = new T.Mesh(new T.IcosahedronGeometry(0.6, 1), M(col || "#4f8a4a", 0.95)); b.position.set(x, 0.42 * sc, z); b.scale.setScalar(sc); b.castShadow = true; g.add(b); obs.push([x - 0.55 * sc, z - 0.55 * sc, x + 0.55 * sc, z + 0.55 * sc]); };
  [[17.2, -43], [17.6, -30], [-23, -24], [-8, -43], [0, -43.2], [-9, -24.3], [16.8, -36]].forEach(([x, z], i) => bush(x, z, 0.9 + (i % 3) * 0.25, i % 2 ? "#3f7a45" : "#5a9a50"));
  const update = (dt, t) => {
    for (const f of flames) { const u = f.userData, k = 0.75 + 0.25 * Math.sin(t * 9 + u.ph) + 0.12 * Math.sin(t * 23 + u.ph * 3); f.scale.set(1, k, 1); f.position.y = 0.2 + (u.base * k) / 2; f.rotation.y = t * 0.6 + u.ph; }
    light.intensity = 1.1 + Math.sin(t * 13) * 0.18 + Math.sin(t * 31) * 0.1;
    const a = sparkGeo.attributes.position.array;
    for (let i = 0; i < sparkN; i++) { a[i * 3 + 1] += dt * (0.7 + (i % 4) * 0.25); a[i * 3] += Math.sin(t * 2 + i) * dt * 0.2; if (a[i * 3 + 1] > 2.8) { a[i * 3] = F.x + (Math.random() - 0.5) * 0.4; a[i * 3 + 1] = 0.3; a[i * 3 + 2] = F.z + (Math.random() - 0.5) * 0.4; } }
    sparkGeo.attributes.position.needsUpdate = true;
    for (const sgn of signs) if (sgn.on) sgn.glow.material.emissiveIntensity = 0.9 + Math.sin(t * 3 + sgn.i) * 0.3;
    for (const D of ducks) { const a2 = t * D.sp + D.ph, x = L.x + Math.cos(a2) * L.rx * D.r, z = L.z + Math.sin(a2) * L.rz * D.r; D.d.position.set(x, 0.02 + Math.sin(t * 2 + D.ph) * 0.015, z); D.d.rotation.y = -a2; }
    water.material.color.setHSL(0.55, 0.45, 0.56 + Math.sin(t * 0.8) * 0.02);
  };
  // 🪨 물수제비: 돌이 물 위를 통통 튀고, 튈 때마다 물결 동그라미
  const skips = [], ripples = [], stoneM = M("#8d8a84", 0.6), ripM = new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, depthWrite: false });
  const inLake = (x, z) => ((x - L.x) / L.rx) ** 2 + ((z - L.z) / L.rz) ** 2 < 0.93;
  const ripple = (x, z, big) => { const m = new T.Mesh(new T.RingGeometry(0.12, 0.17, 24), ripM.clone()); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); g.add(m); ripples.push({ m, t0: performance.now(), big }); };
  const skip = (fx, fz, ang, n) => {
    const pts = [{ x: fx, z: fz, y: 1.0 }]; let x = fx, z = fz, step = 1.9;
    const dx = Math.sin(ang), dz = Math.cos(ang);
    // 물가에서 물 안쪽까지 날아가요
    for (let k = 0; k < 40 && !inLake(x, z); k++) { x += dx * 0.25; z += dz * 0.25; }
    x += dx * 0.6; z += dz * 0.6; pts.push({ x, z, y: 0.05, hop: true });
    for (let i = 0; i < n; i++) { x += dx * step; z += dz * step; step = Math.max(0.45, step * 0.82); if (!inLake(x, z)) break; pts.push({ x, z, y: 0.05, hop: true }); }
    const st = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), stoneM); st.scale.set(1, 0.45, 1); st.position.set(fx, 1, fz); g.add(st);
    skips.push({ st, pts, i: 0, u: 0, t: performance.now() });
    return pts.length - 2; // 실제로 튄 횟수
  };
  const skipFrame = (dt) => {
    for (let k = skips.length - 1; k >= 0; k--) {
      const S = skips[k], a = S.pts[S.i], b = S.pts[S.i + 1];
      if (!b) { ripple(a.x, a.z, true); g.remove(S.st); skips.splice(k, 1); continue; }
      const len = Math.hypot(b.x - a.x, b.z - a.z), dur = S.i === 0 ? 0.45 : Math.max(0.12, len * 0.16);
      S.u += dt / dur; const u = Math.min(1, S.u), hgt = S.i === 0 ? 0.6 : 0.12 + len * 0.18;
      S.st.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * hgt, a.z + (b.z - a.z) * u); S.st.rotation.y += dt * 20;
      if (S.u >= 1) { S.u = 0; S.i++; ripple(b.x, b.z, false); }
    }
    const now = performance.now();
    for (let k = ripples.length - 1; k >= 0; k--) { const R = ripples[k], e = (now - R.t0) / 1000, life = R.big ? 2.2 : 1.4; if (e > life) { g.remove(R.m); R.m.geometry.dispose(); R.m.material.dispose(); ripples.splice(k, 1); continue; } const sc = 1 + e * (R.big ? 7 : 5); R.m.scale.set(sc, sc, 1); R.m.material.opacity = 0.7 * (1 - e / life); }
  };
  const upd0 = update;
  return { signs, update: (dt, t) => { upd0(dt, t); skipFrame(dt); }, verses: null, done: -1, listenMat, skip };
}

/* ---------------- 게시판 그림 (모임 시간표 · 운동장 랭킹) ---------------- */
function boardTex(title, rows, opt = {}) {
  const W = 760, H = 480;
  return canvasTex(W, H, (g) => {
    g.fillStyle = opt.bg || "#2f4a3a"; g.fillRect(0, 0, W, H);
    g.strokeStyle = opt.frame || "#b8864e"; g.lineWidth = 20; g.strokeRect(10, 10, W - 20, H - 20);
    g.textAlign = "center"; g.fillStyle = "#fff7d6"; g.font = "700 46px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(title, W / 2, 76);
    g.font = "30px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    if (!rows.length) { g.fillStyle = "#d9f0e2"; g.fillText(opt.empty || "아직 없어요", W / 2, H / 2 + 20); }
    rows.slice(0, 5).forEach((r, i) => {
      const y = 140 + i * 66;
      if (r.hi) { g.fillStyle = "rgba(255,224,138,.22)"; g.fillRect(34, y - 40, W - 68, 58); }
      g.textAlign = "left"; g.fillStyle = r.hi ? "#ffe08a" : "#ffffff"; g.fillText(String(r.l).slice(0, 18), 52, y);
      g.textAlign = "right"; g.fillStyle = "#c7e6d3"; g.fillText(String(r.r || "").slice(0, 16), W - 52, y);
    });
    if (opt.foot) { g.textAlign = "center"; g.fillStyle = "#c7e6d3"; g.font = "24px 'Gowun Dodum', sans-serif"; g.fillText(opt.foot, W / 2, H - 30); }
  });
}
function addBoard(s, x, z, ry, w, title, opt, action, labels, clickables, label) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g);
  for (const lx of [-w / 2 + 0.1, w / 2 - 0.1]) cyl(g, 0.05, 0.05, 1.3, M("#5a4636", 0.7), lx, 0.65, -0.04, 6);
  const mat = new T.MeshBasicMaterial({ map: boardTex(title, [], opt) });
  const m = new T.Mesh(new T.PlaneGeometry(w, w * 480 / 760), mat); m.position.set(0, 1.3 + w * 0.31, 0); g.add(m);
  box(g, w + 0.12, w * 480 / 760 + 0.12, 0.06, M("#5a4636", 0.7), 0, 1.3 + w * 0.31, -0.05);
  g.traverse((o) => (o.userData.action = action)); clickables.push(g);
  labels.push({ x, y: 1.5 + w * 0.65, z, html: label, action });
  return { mat, title, opt };
}
/* ---------------- 🌳 감사 나무 (본당 뒤쪽): 응답 이야기마다 열매가 하나씩 ---------------- */
function makeThanksTree() {
  const g = new T.Group();
  cyl(g, 0.16, 0.26, 1.9, M("#7a5232", 0.85), 0, 0.95, 0, 10);
  for (const [a, y, l] of [[0.6, 1.4, 0.8], [-0.7, 1.6, 0.7], [2.3, 1.5, 0.7]]) { const b = cyl(g, 0.06, 0.09, l, M("#7a5232", 0.85), Math.cos(a) * 0.25, y, Math.sin(a) * 0.25, 6); b.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
  const leaves = [[0, 2.45, 0, 0.95], [0.6, 2.1, 0.3, 0.7], [-0.6, 2.15, -0.2, 0.72], [0.2, 2.2, -0.6, 0.66], [-0.2, 2.0, 0.6, 0.66]];
  for (const [x, y, z, r] of leaves) { const m = new T.Mesh(new T.IcosahedronGeometry(r, 1), M("#4f8f4a", 0.9)); m.position.set(x, y, z); m.castShadow = true; g.add(m); }
  const fruits = new T.Group(); g.add(fruits);
  const cols = ["#f2c84b", "#e8613c", "#f39c12", "#e84a5f", "#ffd36b"], geo = new T.SphereGeometry(0.075, 10, 8);
  for (let i = 0; i < 80; i++) { // 잎 덩어리 겉면에 골고루
    const L = leaves[i % leaves.length], u = (i * 0.618034) % 1, v = ((i * 0.381966) % 1) * 0.85 + 0.05, th = u * Math.PI * 2, ph = Math.acos(1 - 2 * v * 0.8);
    const f = new T.Mesh(geo, M(cols[i % cols.length], 0.5, { emissive: cols[i % cols.length], emissiveIntensity: 0.15 }));
    f.position.set(L[0] + Math.sin(ph) * Math.cos(th) * L[3] * 1.02, L[1] + Math.cos(ph) * L[3] * 0.9, L[2] + Math.sin(ph) * Math.sin(th) * L[3] * 1.02);
    f.visible = false; fruits.add(f);
  }
  g.userData.fruits = fruits;
  return g;
}
/* ----- 마당 계절 장식 (부활절 빈 무덤 · 새해 아치 · 여름 수련회) ----- */
function yardSeasonDeco(s, labels, Z1) {
  let deco = decoBegin(s);
  // ✝️ 부활절: 큰 트리 자리에 빈 무덤 + 굴려 놓은 돌 + 백합
  const tomb = new T.Group(); tomb.position.set(4.6, 0, 6.3); s.add(tomb);
  const rock = new T.Mesh(new T.SphereGeometry(2.0, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M("#9a8f80", 1)); rock.scale.set(1, 0.95, 0.9); rock.castShadow = true; tomb.add(rock);
  const hole = new T.Mesh(new T.CircleGeometry(0.62, 24), M("#1e1a16", 1)); hole.position.set(0, 0.68, 1.68); hole.rotation.x = -0.25; tomb.add(hole);
  const stone = cyl(tomb, 0.85, 0.85, 0.28, M("#b3a998", 0.95), 1.75, 0.85, 1.55, 24); stone.rotation.set(Math.PI / 2, 0, 0.35);
  for (const [x, z] of [[-2.2, 1.9], [-1.4, 2.4], [2.6, 2.6], [3.1, 1.6], [-2.6, 0.6]]) { const l = makeLily(1.2); l.position.set(x, 0, z); tomb.add(l); }
  const eb = new T.Group(); eb.position.set(4.6, 0, 9.4); s.add(eb);
  for (const x of [-1.7, 1.7]) cyl(eb, 0.06, 0.06, 2.4, M("#7a5a3a", 0.8), x, 1.2, 0, 6);
  banner3D(eb, "그가 살아나셨느니라 · 마태복음 28:6", 3.6, 0.62, "#f6f1e2", 0, 2.1, 0.04, 0, "#7a5a14", 52);
  labels.push({ x: 4.6, y: 4.4, z: 6.3, html: "✝️ 부활하신 주님 · 할렐루야!", deco: true, season: "easter" });
  decoEnd(s, deco, "easter");
  // 🎉 새해: 정문 길 위 아치
  deco = decoBegin(s);
  const arch = new T.Group(); arch.position.set(-3, 0, 11.4); s.add(arch);
  for (const x of [-2.1, 2.1]) cyl(arch, 0.09, 0.09, 3.4, M("#c9a24a", 0.4, { metalness: 0.4 }), x, 1.7, 0, 8);
  banner3D(arch, `🎉 ${seasonYear()} 새해 복 많이 받으세요`, 4.2, 0.7, "#1f3b6b", 0, 3.2, 0, 0, "#ffe08a", 54);
  banner3D(arch, "하나님이 주신 새해, 함께 걸어요", 3.6, 0.42, "#2c4f8a", 0, 2.6, 0.01, 0, "#ffffff", 46);
  decoEnd(s, deco, "newyear");
  // 🌊 여름 수련회: 아치 + 파라솔 + 해바라기
  deco = decoBegin(s);
  const sarch = new T.Group(); sarch.position.set(-3, 0, 11.4); s.add(sarch);
  for (const x of [-2.1, 2.1]) cyl(sarch, 0.09, 0.09, 3.4, M("#2a7f8f", 0.5), x, 1.7, 0, 8);
  banner3D(sarch, "🌊 그루터기 여름 수련회 · 함께 떠나요!", 4.2, 0.7, "#2a7f8f", 0, 3.2, 0, 0, "#ffffff", 50);
  [[-10.5, 4.2, "#e74c3c"], [-15.5, 7.0, "#2e86de"]].forEach(([x, z, c]) => { const p = makeParasol(c); p.position.set(x, 0, z); s.add(p); });
  for (let i = 0; i < 6; i++) { const f = makeSunflower(1.1 + (i % 3) * 0.15); f.position.set(10.8 + i * 0.7, 0, 11.7); s.add(f); }
  labels.push({ x: -3, y: 4.1, z: 11.4, html: "🌊 여름 수련회", deco: true, season: "summer" });
  decoEnd(s, deco, "summer");
}
/* ----- 마당 밤 모드 준비: 해·하늘 빛, 가로등 불빛, 별 ----- */
function yardNight(s) {
  const n = { pts: [], lampMats: [] };
  s.traverse((o) => {
    if (o.isHemisphereLight) n.hemi = o; else if (o.isDirectionalLight) n.sun = o; else if (o.isAmbientLight) n.amb = o;
    if (o.material && o.material.emissive && o.material.emissive.getHex() === 0xffe9a8 && !n.lampMats.includes(o.material)) n.lampMats.push(o.material);
  });
  n.base = { hemi: n.hemi.intensity, sun: n.sun.intensity, amb: n.amb ? n.amb.intensity : 0, lamp: 0.9, sky: n.hemi.color.clone(), ground: n.hemi.groundColor.clone() };
  n.nightSky = new T.Color("#5a6aa8"); n.nightGround = new T.Color("#1c1e2c");
  for (const [x, y, z] of [[-2, 5, 4], [4.6, 6, 9.5], [-12, 5, 8], [16, 5, 6], [26, 5, -2], [-2, 6, -31], [38.5, 5, 11]]) {
    const L = new T.PointLight("#ffcf8a", 0, 15, 2); L.position.set(x, y, z); s.add(L); n.pts.push(L);
  }
  const g = new T.BufferGeometry(), N = 500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, e = 0.12 + rnd() * 1.3, r = 90; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  g.setAttribute("position", new T.BufferAttribute(pos, 3));
  n.stars = new T.Points(g, new T.PointsMaterial({ color: "#ffffff", size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  n.stars.visible = false; s.add(n.stars);
  n.dayBg = new T.Color("#bcdcf2"); n.nightBg = new T.Color("#0d1630"); n.dayFog = new T.Color("#cfe5f5"); n.nightFog = new T.Color("#141d38");
  return n;
}
function snowOn() { return !World.seasons || World.seasons.has("winter"); }
// 날짜로 정하는 계절 (뉴욕 날짜): 크리스마스 11/1~12/31, 새해 1월, 겨울 눈 11/15~2월, 부활절 종려주일~부활절 2주 뒤, 여름 수련회 6/15~8/31
function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}
function nyParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: (+p.hour % 24) + +p.minute / 60 };
}
function autoSeasons(date = new Date()) {
  const { y, mo, d } = nyParts(date), t = Date.UTC(y, mo - 1, d), out = [];
  if (mo >= 11) out.push("christmas");
  if (mo === 1) out.push("newyear");
  if ((mo === 11 && d >= 15) || mo === 12 || mo <= 2) out.push("winter");
  const e = easterDate(y); if (t >= e - 7 * 864e5 && t <= e + 14 * 864e5) out.push("easter");
  if ((mo === 6 && d >= 15) || mo === 7 || mo === 8) out.push("summer");
  return out;
}
// 밤 정도 0(낮)~1(밤): 달마다 뉴욕 해 지는/뜨는 시간에 맞춰 천천히 바뀌어요
const NY_SUN = { set: [16.9, 17.5, 19.0, 19.6, 20.1, 20.5, 20.4, 19.9, 19.1, 18.3, 16.7, 16.5], rise: [7.2, 6.9, 7.1, 6.4, 5.8, 5.4, 5.6, 6.1, 6.6, 7.1, 6.6, 7.1] };
function autoNight(date = new Date()) {
  const { mo, h } = nyParts(date), set = NY_SUN.set[mo - 1], rise = NY_SUN.rise[mo - 1];
  if (h >= set + 0.75 || h <= rise - 0.5) return 1;
  if (h > set - 0.5) return (h - (set - 0.5)) / 1.25;
  if (h < rise + 0.75) return 1 - (h - (rise - 0.5)) / 1.25;
  return 0;
}

/* ---------------- 🚗 앞길을 달리는 차들 ---------------- */
// 가까운 차선(z 15.6)은 오른쪽(+x)으로, 먼 차선(z 20.4)은 왼쪽(-x)으로 달려요. 차선마다 속도가 같아서 서로 부딪히지 않아요.
// 길 끝(±ROAD_END)을 지나면 반대쪽 끝에서 다시 나와요 (안개 너머라서 안 보여요).
const ROAD_END = 66;
const CAR_LANES = [
  { z: 15.6, dir: 1, speed: 7.2, cols: ["#3b4a63", "#c9ccd1", "#8a2f2f", "#e9e9e9"], gaps: [0, 0.24, 0.47, 0.73] },
  { z: 20.4, dir: -1, speed: 6.1, cols: ["#2f3338", "#4a6b8a", "#d9b24a", "#e9e9e9"], gaps: [0.1, 0.36, 0.58, 0.85] },
];
function makeCar(colHex, kind) {
  const g = new T.Group(), col = M(colHex, 0.4, { metalness: 0.3 }), glass = M("#2a3542", 0.15, { metalness: 0.5 });
  const long = kind === "van";
  box(g, long ? 4.8 : 4.2, 0.8, 1.8, col, 0, 0.6, 0);
  if (long) { box(g, 3.6, 0.85, 1.7, col, -0.4, 1.4, 0); box(g, 3.4, 0.55, 1.72, glass, -0.4, 1.45, 0, { cast: false }); }
  else { box(g, 2.4, 0.65, 1.6, col, -0.2, 1.3, 0); box(g, 2.2, 0.5, 1.62, glass, -0.2, 1.3, 0, { cast: false }); }
  const front = long ? 2.41 : 2.11;
  for (const wz of [-0.6, 0.6]) {
    box(g, 0.04, 0.16, 0.34, M("#fff6d8", 0.3, { emissive: "#fff1c0", emissiveIntensity: 0.9 }), front, 0.72, wz, { cast: false }); // 앞 불
    box(g, 0.04, 0.14, 0.3, M("#c0392b", 0.4, { emissive: "#ff2a2a", emissiveIntensity: 0.7 }), -front, 0.74, wz, { cast: false }); // 뒤 불
  }
  const wheels = [];
  const wx = long ? 1.6 : 1.4;
  for (const x of [-wx, wx]) for (const wz of [-0.9, 0.9]) {
    const w = new T.Group(); w.position.set(x, 0.34, wz); g.add(w);
    const tire = cyl(w, 0.34, 0.34, 0.24, M("#1e1e1e"), 0, 0, 0, 14); tire.rotation.x = Math.PI / 2;
    const hub = box(w, 0.36, 0.08, 0.25, M("#9a9a9a", 0.4, { metalness: 0.5 }), 0, 0, 0, { cast: false }); // 굴러가는 게 보이게 바퀴살 하나
    wheels.push(w);
  }
  return { g, wheels };
}
function makeRoadCars(s) {
  const list = [];
  CAR_LANES.forEach((L, li) => L.cols.forEach((c, i) => {
    const car = makeCar(c, (li + i) % 3 === 2 ? "van" : "car");
    car.g.rotation.y = L.dir > 0 ? 0 : Math.PI;
    s.add(car.g);
    list.push({ ...car, lane: L, off: L.gaps[i] * ROAD_END * 2 });
  }));
  updateRoadCars(list, 0);
  return list;
}
function updateRoadCars(list, dt) {
  const now = Date.now() / 1000, span = ROAD_END * 2;
  for (const c of list) {
    const d = ((now * c.lane.speed + c.off) % span + span) % span; // 0 ~ span
    c.g.position.set(c.lane.dir > 0 ? -ROAD_END + d : ROAD_END - d, 0, c.lane.z);
    const spin = (now * c.lane.speed) / 0.34; // 바퀴가 길에 맞춰 굴러가요
    for (const w of c.wheels) w.rotation.z = -spin;
  }
}

/* ===== 마당 (교회 외관) ===== */
/* ---------------- 🧦 마당 광고판 (트리 앞) ---------------- */
// ★ 광고를 바꾸려면 여기만 고치면 돼요. img: 사이트 폴더에 넣은 광고 그림 파일 이름(정사각형 추천, 없으면 아래 글자로 그린 광고판)
const AD = {
  label: "🧦 히즈핑거 연말 양말",
  title: "히즈핑거 연말 양말",
  sub: "A box for everyone you love · 한 박스 $17.99 · $49 이상 미국 무료 배송",
  url: "https://hisfingermall.com",
  img: "ad-banner.jpg", // 광고 그림 파일 (비우면 글자로 그린 광고판)
  ratio: 9 / 16,        // 그림 가로 ÷ 세로 (지금 그림 576×1024)
};
function adBannerTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#1f5a3d"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#c0392b"; g.fillRect(0, 0, w, 92); g.fillRect(0, h - 70, w, 70);
    for (let i = 0; i < 26; i++) { g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc((i * 97) % w, 110 + ((i * 53) % 290), 3 + (i % 3), 0, 7); g.fill(); }
    g.textAlign = "center"; g.fillStyle = "#fff6e0";
    g.font = "700 34px Georgia, serif"; g.fillText("Hisfinger Holiday Market", w / 2, 58);
    // 양말 두 짝
    const sock = (x, y, col, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.moveTo(-34, -90); g.lineTo(34, -90); g.lineTo(34, 30); g.quadraticCurveTo(34, 60, 70, 62); g.quadraticCurveTo(100, 66, 96, 92); g.quadraticCurveTo(92, 112, 60, 110); g.lineTo(-10, 106); g.quadraticCurveTo(-34, 104, -34, 76); g.closePath(); g.fill();
      g.fillStyle = "#fff6e0"; g.fillRect(-38, -104, 76, 26); for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? "#fff6e0" : "#ffd54a"; g.fillRect(-34, -60 + k * 26, 68, 10); } g.restore(); };
    sock(190, 250, "#d9483b", -0.12); sock(318, 262, "#e8c23a", 0.1);
    g.fillStyle = "#ffffff"; g.font = "700 50px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("🧦 " + AD.title, w / 2, 410);
    g.fillStyle = "#ffd54a"; g.font = "700 30px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(AD.sub, w / 2, 452);
    g.fillStyle = "#fff6e0"; g.font = "700 28px Georgia, serif"; g.fillText(AD.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), w / 2, h - 26);
  });
}
/* ---------------- ⛸ 그루터기 스케이트장 (산울타리 오른쪽, 2026-11-18) ----------------
   얼음판 x 35~51 · z -36~-6, 경주 트랙은 타원(가운데 cx, cz · 반지름 a, b). 왼쪽 산울타리 출입구(z -14~-9)로 들어가요 */
const RINK = { x0: 35, x1: 51, z0: -36, z1: -6, cx: 43, cz: -21, a: 5.4, b: 11.8, gate: [-12.2, -9.4] };
function rinkLapLen(lane = 0) { const a = RINK.a + lane * 0.7, b = RINK.b + lane * 0.7, hh = ((a - b) ** 2) / ((a + b) ** 2); return Math.PI * (a + b) * (1 + (3 * hh) / (10 + Math.sqrt(4 - 3 * hh))); }
// 경주 위치: p = 지난 바퀴 수 (0에서 출발, 2면 결승). 출발선은 앞쪽(카메라 쪽) 가운데, 반시계 방향
function rinkRacePos(p, lane = 0) {
  const a = RINK.a + lane * 0.7, b = RINK.b + lane * 0.7, th = Math.PI / 2 - p * Math.PI * 2;
  const x = RINK.cx + a * Math.cos(th), z = RINK.cz + b * Math.sin(th);
  const dx = a * Math.sin(th), dz = -b * Math.cos(th); // 진행 방향 (th가 줄어드는 쪽)
  return { x, z, yaw: Math.atan2(dx, dz) };
}
function onIce(x, z) { return x > RINK.x0 + 0.35 && x < RINK.x1 - 0.35 && z > RINK.z0 + 0.35 && z < RINK.z1 - 0.35; }
// 🏆 스케이트장 랭킹판 (피겨 점수 TOP 5 · 스피드 기록 TOP 5)
function rinkBoardTex(d) {
  return canvasTex(768, 560, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#1d3f5c"); grd.addColorStop(1, "#2a5f7e"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#cfe9f5"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.textAlign = "center"; g.fillStyle = "#ffffff"; g.font = "700 46px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(d && d.week ? "🏆 이번 주 스케이트장 랭킹" : "🏆 스케이트장 랭킹", w / 2, 70);
    const col = (x, title, rows, fmt) => {
      g.textAlign = "left"; g.fillStyle = "#ffd54a"; g.font = "700 32px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(title, x, 132);
      g.font = "28px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
      if (!rows || !rows.length) { g.fillStyle = "rgba(255,255,255,.7)"; g.fillText(d ? "첫 기록을 남겨요!" : "불러오는 중…", x, 186); return; }
      rows.slice(0, 5).forEach((r, i) => {
        const y = 188 + i * 62; g.fillStyle = ["#ffd54a", "#e3e8ee", "#e8a86a", "#cfe9f5", "#cfe9f5"][i];
        g.font = "700 30px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(["🥇", "🥈", "🥉", "4", "5"][i], x, y);
        g.fillStyle = "#ffffff"; g.font = "28px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; let nm = String(r.name || "익명"); while (nm.length > 1 && g.measureText(nm).width > 150) nm = nm.slice(0, -1); g.fillText(nm, x + 48, y);
        g.textAlign = "right"; g.fillStyle = "#ffd54a"; g.font = "700 30px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText(fmt(r), x + 320, y); g.textAlign = "left";
      });
    };
    col(42, "🩰 피겨 점수", d && d.figure, (r) => Number(r.score).toFixed(1) + "점");
    col(410, "🏁 스피드 2바퀴", d && d.speed, (r) => Number(r.score).toFixed(2) + "초");
    g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 + 4, 110); g.lineTo(w / 2 + 4, h - 60); g.stroke();
    g.textAlign = "center"; g.fillStyle = "#cfe9f5"; g.font = "24px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("눌러서 전체 랭킹 보기", w / 2, h - 28);
  });
}
function buildRink(s, obs, clickables, labels, seats) {
  const { x0, x1, z0, z1, cx, cz } = RINK, W2 = (x1 - x0) / 2, L2 = (z1 - z0) / 2, R = 3.2;
  const shape = new T.Shape();
  shape.moveTo(-W2 + R, -L2); shape.lineTo(W2 - R, -L2); shape.quadraticCurveTo(W2, -L2, W2, -L2 + R); shape.lineTo(W2, L2 - R); shape.quadraticCurveTo(W2, L2, W2 - R, L2);
  shape.lineTo(-W2 + R, L2); shape.quadraticCurveTo(-W2, L2, -W2, L2 - R); shape.lineTo(-W2, -L2 + R); shape.quadraticCurveTo(-W2, -L2, -W2 + R, -L2);
  const iceTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#e4f4fb"; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); const x = rnd() * w, y = rnd() * h, a = rnd() * 6; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40, x + Math.cos(a + 0.4) * 90, y + Math.sin(a + 0.4) * 90); g.stroke(); } }, [3, 5]);
  const ice = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshStandardMaterial({ map: iceTex, roughness: 0.08, metalness: 0.15, color: "#ffffff" }));
  ice.rotation.x = -Math.PI / 2; ice.position.set(cx, 0.035, cz); ice.receiveShadow = true; s.add(ice);
  // 경주 트랙 선 (빨강·파랑 타원) + 출발선(체크무늬)
  for (const [lane, col] of [[-0.5, "#d9483b"], [2.6, "#3a8fd9"]]) {
    const a = RINK.a + lane * 0.7, b = RINK.b + lane * 0.7, pts = [];
    for (let i = 0; i <= 96; i++) { const th = (i / 96) * Math.PI * 2; pts.push(new T.Vector2(a * Math.cos(th), b * Math.sin(th))); }
    const ln = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p.x, 0, p.y)), true), 96, 0.035, 4, true), M(col, 0.5)); ln.position.set(cx, 0.045, cz); s.add(ln);
  }
  const chk = canvasTex(256, 32, (g, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? "#222" : "#fff"; g.fillRect(i * 16, j * 16, 16, 16); } });
  const start = new T.Mesh(new T.PlaneGeometry(2.8, 0.35), new T.MeshBasicMaterial({ map: chk })); start.rotation.x = -Math.PI / 2; start.position.set(cx, 0.05, cz + RINK.b + 1.0); s.add(start);
  const logo = new T.Mesh(new T.CircleGeometry(1.6, 32), new T.MeshBasicMaterial({ map: textTex([["⛸", 150, 120], ["그루터기", 56, 210]], { w: 300, h: 300, bg: "#cfe9f5", fg: "#3a6f8f" }), transparent: true, opacity: 0.85 })); logo.rotation.x = -Math.PI / 2; logo.position.set(cx, 0.042, cz); s.add(logo);
  // 둘레 펜스 (흰 벽 + 빨간 손잡이), 왼쪽에 출입구
  const boardM = M("#fbfbf7", 0.5), railM = M("#d9483b", 0.5), pts = shape.getSpacedPoints(120);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2, X = cx + mx, Z = cz + mz;
    if (a.x < -W2 + 0.2 && b.x < -W2 + 0.2 && Z > RINK.gate[0] && Z < RINK.gate[1]) continue; // 출입구
    const len = Math.hypot(b.x - a.x, b.y - a.y) + 0.02, ry = Math.atan2(b.x - a.x, b.y - a.y);
    box(s, 0.1, 0.85, len, boardM, X, 0.43, Z, { ry }); box(s, 0.16, 0.06, len, railM, X, 0.88, Z, { ry, cast: false });
    obs.push([X - 0.18, Z - 0.18, X + 0.18, Z + 0.18]);
  }
  // 출입구 아치 + 간판
  const gz = (RINK.gate[0] + RINK.gate[1]) / 2, gx = x0 - 0.1;
  for (const z of RINK.gate) cyl(s, 0.07, 0.07, 3.0, M("#3a6f8f", 0.5), gx, 1.5, z, 8);
  const gs = new T.Mesh(new T.PlaneGeometry(3.4, 0.7), new T.MeshBasicMaterial({ map: textTex([["⛸ 그루터기 스케이트장", 46, 54]], { w: 520, h: 108, bg: "#3a6f8f", border: "#cfe9f5" }), side: T.DoubleSide }));
  gs.position.set(gx, 3.0, gz); gs.rotation.y = -Math.PI / 2; s.add(gs);
  // 출입구 앞 길 (산울타리 틈 → 얼음판)
  box(s, x0 - 32.0, 0.03, RINK.gate[1] - RINK.gate[0] + 0.6, M("#d6d2ca", 0.95), (32.0 + x0) / 2, 0.016, gz, { cast: false });
  // 가로등 4개 + 둘레 전구 줄
  for (const [x, z] of [[x0 - 0.8, z0 - 0.8], [x1 + 0.8, z0 - 0.8], [x0 - 0.8, z1 + 0.8], [x1 + 0.8, z1 + 0.8]]) { cyl(s, 0.07, 0.09, 4.2, M("#3a3a3a", 0.5), x, 2.1, z, 8); const lp = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), M("#fff3c4", 0.3, { emissive: "#ffe6a0", emissiveIntensity: 1 })); lp.position.set(x, 4.3, z); s.add(lp); obs.push([x - 0.2, z - 0.2, x + 0.2, z + 0.2]); }
  // 벤치 + 스케이트 신발 선반 (출입구 옆)
  // 구경 벤치 (앉을 수 있어요, 자리 RB{번}-{0|1}). 얼음판 쪽(+x)을 봐요
  const bench = (x, z, ry, b) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g);
    box(g, 1.8, 0.08, 0.45, M("#8a5a34", 0.7), 0, 0.45, 0); box(g, 1.8, 0.32, 0.06, M("#8a5a34", 0.7), 0, 0.72, -0.22);
    for (const sx of [-0.75, 0.75]) box(g, 0.08, 0.45, 0.4, M("#3a3a3a", 0.5), sx, 0.22, 0);
    const ids = [];
    for (const k of [-0.42, 0.42]) { const id = `RB${b}-${k < 0 ? 0 : 1}`, c = Math.cos(ry), sn = Math.sin(ry), sx = x + k * c, sz = z - k * sn; seats[id] = { x: sx, z: sz, rot: ry, h: 0.47, ax: sx + Math.sin(ry) * 0.75, az: sz + Math.cos(ry) * 0.75, rink: true }; ids.push(id); }
    seatGroupMark(g, ids); clickables.push(g);
    const hw = Math.abs(Math.cos(ry)) * 0.95 + Math.abs(Math.sin(ry)) * 0.3, hd = Math.abs(Math.sin(ry)) * 0.95 + Math.abs(Math.cos(ry)) * 0.3;
    obs.push([x - hw, z - hd, x + hw, z + hd]);
  };
  bench(33.6, -16.5, Math.PI / 2, 0); bench(33.6, -5.0, Math.PI / 2, 1); bench(33.6, -24.5, Math.PI / 2, 2); bench(52.7, -21, -Math.PI / 2, 3);
  // 🙌 펜스에 기대어 구경하는 자리 (자리 RL-{번}, 서서 팔을 펜스에 올려요). 펜스를 누르면 그 자리로 가요
  const leanM = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const leans = [[x0 - 0.5, -30, Math.PI / 2], [x0 - 0.5, -27.5, Math.PI / 2], [x0 - 0.5, -21, Math.PI / 2], [x0 - 0.5, -19, Math.PI / 2],
    [39.5, z1 + 0.5, Math.PI], [42, z1 + 0.5, Math.PI], [44.5, z1 + 0.5, Math.PI], [47, z1 + 0.5, Math.PI],
    [x1 + 0.5, -29, -Math.PI / 2], [x1 + 0.5, -25, -Math.PI / 2], [x1 + 0.5, -17, -Math.PI / 2], [x1 + 0.5, -13, -Math.PI / 2]];
  leans.forEach(([x, z, rot], i) => {
    const id = "RL-" + i; seats[id] = { x, z, rot, h: 0, stand: true, lean: true, ax: x - Math.sin(rot) * 0.6, az: z - Math.cos(rot) * 0.6, rink: true };
    const hit = new T.Mesh(new T.BoxGeometry(1.3, 1.1, 0.5), leanM); hit.position.set(x + Math.sin(rot) * 0.45, 0.55, z + Math.cos(rot) * 0.45); hit.rotation.y = rot; s.add(hit);
    seatGroupMark(hit, [id]); clickables.push(hit);
  });
  const rack = new T.Group(); rack.position.set(33.7, 0, -7.6); s.add(rack);
  for (const y of [0.2, 0.6, 1.0]) box(rack, 0.45, 0.04, 1.4, M("#c98a46", 0.6), 0, y, 0);
  for (let k = 0; k < 6; k++) { const sk = new T.Group(); sk.position.set(0, 0.24 + Math.floor(k / 3) * 0.4, -0.45 + (k % 3) * 0.45); rack.add(sk); box(sk, 0.14, 0.12, 0.26, M(k % 2 ? "#fbfbf7" : "#2a2a2a", 0.5), 0, 0.06, 0); box(sk, 0.02, 0.03, 0.32, M("#c0c4c8", 0.2, { metalness: 0.8 }), 0, -0.01, 0); }
  obs.push([33.3, -8.4, 34.1, -6.8]);
  // 주변 눈 무더기
  for (let i = 0; i < 12; i++) { const m = new T.Mesh(new T.SphereGeometry(0.5 + rnd() * 0.5, 10, 8), M("#f6f9fb", 0.95)); m.scale.y = 0.4; m.position.set(i % 2 ? x1 + 1.2 : x0 - 1.4, 0.05, z0 + 2 + i * 2.4); s.add(m); }
  const clickG = new T.Group(); s.add(clickG); clickG.add(gs); clickG.add(logo);
  gs.userData.action = "rink"; logo.userData.action = "rink"; clickables.push(gs);
  labels.push({ x: cx, y: 2.2, z: cz + RINK.b + 1.0, html: "🏁 출발선 · 경주는 얼음 위에서 '🏁 경주 시작'", action: "rink" });
  labels.push({ x: gx, y: 3.6, z: gz, html: "⛸ 그루터기 스케이트장", action: "rink" });
  // 🏆 랭킹판 (얼음판 앞 왼쪽, 출입구 옆) — 누르면 전체 랭킹
  const rb = new T.Group(); rb.position.set(37.6, 0, -3.6); s.add(rb);
  for (const sx of [-1.75, 1.75]) cyl(rb, 0.07, 0.07, 3.3, M("#3a6f8f", 0.5), sx, 1.65, 0, 8);
  box(rb, 3.7, 2.7, 0.1, M("#cfe9f5", 0.5), 0, 1.95, -0.05);
  const boardMat = new T.MeshBasicMaterial({ map: rinkBoardTex(null) });
  const bm = new T.Mesh(new T.PlaneGeometry(3.5, 2.55), boardMat); bm.position.set(0, 1.95, 0.01); rb.add(bm);
  rb.traverse((m) => (m.userData.action = "rinkrank")); clickables.push(rb);
  obs.push([37.6 - 1.9, -3.9, 37.6 + 1.9, -3.3]);
  labels.push({ x: 37.6, y: 3.6, z: -3.6, html: "🏆 스케이트장 랭킹", action: "rinkrank" });
  return { boardMat };
}

function buildYard() {
  const s = new T.Scene();
  s.background = new T.Color("#bcdcf2");
  s.fog = new T.Fog("#cfe5f5", 45, 95);
  addLights(s, { sky: "#e8f4ff", ground: "#8a7a5a", hemi: 0.75, sunI: 0.95, sunPos: [-18, 30, 22], ext: 30, amb: 0.08 });
  const seats = {}, obs = [], clickables = [], doors = [], labels = [];

  const grass = plane(s, 140, 100, new T.MeshStandardMaterial({ map: grassTex([30, 22]), roughness: 1 }), 0, 0, 0, -Math.PI / 2);
  grass.receiveShadow = true;
  // 보도, 진입로, 도로
  const conc = M("#d6d2ca", 0.95), asph = M("#55575c", 0.95);
  box(s, 44, 0.04, 3.4, conc, 0, 0.02, -2.4, { cast: false });
  box(s, 2.6, 0.04, 14.5, conc, -3, 0.021, 5, { cast: false });
  box(s, 2.0, 0.04, 14.5, conc, 9, 0.021, 5, { cast: false });
  box(s, 120, 0.03, 9, asph, 0, 0.015, 18, { cast: false });
  box(s, 120, 0.035, 0.18, M("#e8c23a", 0.8), 0, 0.03, 18, { cast: false });
  box(s, 120, 0.1, 0.3, conc, 0, 0.05, 13.45, { cast: false });
  box(s, 120, 0.04, 1.6, conc, 0, 0.02, 12.6, { cast: false });

  // 교회 건물 (붉은 벽돌, 긴 박공지붕)
  const bld = new T.Group(); s.add(bld);
  const brick = new T.MeshStandardMaterial({ map: brickTex([10, 3]), roughness: 0.95 });
  const brickSide = new T.MeshStandardMaterial({ map: brickTex([5, 3]), roughness: 0.95 });
  const X0 = -15, X1 = 15, Z0 = -19, Z1 = -4, WH = 7;
  box(bld, X1 - X0, WH, Z1 - Z0, [brickSide, brickSide, M("#8a4a36"), M("#8a4a36"), brick, brick], 0, WH / 2, (Z0 + Z1) / 2);
  // 지붕
  const roofM = M("#5b4a44", 0.9), ridgeY = 11.2, depth = Z1 - Z0;
  const slope = Math.atan2(ridgeY - WH, depth / 2), slopeLen = Math.hypot(ridgeY - WH, depth / 2) + 0.8;
  for (const sgn of [1, -1]) {
    const r = box(bld, X1 - X0 + 1, 0.22, slopeLen, roofM, 0, (WH + ridgeY) / 2, (Z0 + Z1) / 2 + sgn * depth / 4);
    r.rotation.x = sgn * slope;
  }
  const gableShape = new T.Shape(); gableShape.moveTo(-depth / 2, 0); gableShape.lineTo(depth / 2, 0); gableShape.lineTo(0, ridgeY - WH); gableShape.closePath();
  for (const gx of [X0 + 0.01, X1 - 0.01]) {
    const gm = new T.Mesh(new T.ShapeGeometry(gableShape), M("#93503a", 0.95)); gm.material.side = T.DoubleSide;
    gm.position.set(gx, WH, (Z0 + Z1) / 2); gm.rotation.y = Math.PI / 2; bld.add(gm);
  }
  box(bld, X1 - X0, 0.35, 0.4, M("#e9e4da"), 0, WH + 0.1, Z1 + 0.05); // 처마 장식
  // 창문
  const glass = M("#2f3d4a", 0.25, { metalness: 0.3 }), frame = M("#f2efe8", 0.6);
  for (let x = -13; x <= 13.5; x += 2.2) {
    for (const [y, hgt] of [[1.9, 1.7], [4.9, 1.9]]) {
      if (y < 3 && ((x > -9.8 && x < -7.4) || (x > -5.4 && x < -0.6) || (x > 7.6 && x < 10.4) || (x > 1.4 && x < 3.4) || x > 12.4)) continue;
      if (x < -10.5) continue;
      box(bld, 1.3, hgt + 0.16, 0.08, frame, x, y, Z1 + 0.03, { cast: false });
      box(bld, 1.1, hgt, 0.1, glass, x, y, Z1 + 0.05, { cast: false });
      box(bld, 0.06, hgt, 0.12, frame, x, y, Z1 + 0.06, { cast: false });
    }
  }
  // 정문 (회색 캐노피 + 계단 + 유리문) → 본당
  const ent = new T.Group(); bld.add(ent);
  const gray = M("#8d9196", 0.6);
  box(ent, 4.6, 0.3, 3.2, gray, -3, 3.1, Z1 + 1.5);
  for (const px of [-5.1, -0.9]) cyl(ent, 0.09, 0.09, 3.0, M("#6e7277", 0.5), px, 1.5, Z1 + 2.9, 10);
  for (let k = 0; k < 3; k++) box(ent, 3.6, 0.16, 0.5, conc, -3, 0.08 + k * 0.16, Z1 + 1.5 - k * 0.42);
  const door = new T.Group(); ent.add(door);
  box(door, 2.6, 2.7, 0.12, M("#4a4f55", 0.4), -3, 1.83, Z1 + 0.08);
  box(door, 1.1, 2.4, 0.14, M("#2e3a46", 0.2, { metalness: 0.4 }), -3.6, 1.8, Z1 + 0.1);
  box(door, 1.1, 2.4, 0.14, M("#2e3a46", 0.2, { metalness: 0.4 }), -2.4, 1.8, Z1 + 0.1);
  doorMark(door, "worship"); clickables.push(door);
  const signW = new T.Mesh(new T.PlaneGeometry(4.2, 0.6), new T.MeshBasicMaterial({ map: textTex([["퀸즈 장로교회", 72, 64]], { w: 640, h: 128, bg: "#3b4046" }) }));
  signW.position.set(-3, 3.45, Z1 + 3.11); ent.add(signW);
  for (const px of [-5.5, -0.5]) { cyl(ent, 0.32, 0.26, 0.55, M("#9a8a7a"), px, 0.28, Z1 + 3.3, 12); const bush = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), M("#4f8a4a", 0.9)); bush.position.set(px, 0.85, Z1 + 3.3); bush.castShadow = true; ent.add(bush); }
  doors.push({ x: -3, z: -2.2, to: "worship" });
  labels.push({ x: -3, y: 4.3, z: Z1 + 2.4, html: "🙏 본당 입구 · 기도하는 공간", to: "worship" });
  obs.push([-5.3, Z1 + 2.7, -4.9, Z1 + 3.1], [-1.1, Z1 + 2.7, -0.7, Z1 + 3.1], [-5.9, Z1 + 2.9, -5.1, Z1 + 3.7], [-0.9, Z1 + 2.9, -0.1, Z1 + 3.7]);

  // 성경 읽는 공간 문
  const cdoor = new T.Group(); bld.add(cdoor);
  box(cdoor, 2.2, 2.6, 0.12, M("#5a4636", 0.5), 9, 1.32, Z1 + 0.08);
  box(cdoor, 1.6, 2.3, 0.14, M("#e9d9b8", 0.4, { emissive: "#7a5a2a", emissiveIntensity: 0.35 }), 9, 1.2, Z1 + 0.1);
  box(cdoor, 2.8, 0.12, 1.2, M("#2f5e4e", 0.6), 9, 2.9, Z1 + 0.6);
  const csign = new T.Mesh(new T.PlaneGeometry(2.6, 0.55), new T.MeshBasicMaterial({ map: textTex([["성경 읽는 공간", 56, 64]], { w: 560, h: 118, bg: "#2f5e4e" }) }));
  csign.position.set(9, 3.35, Z1 + 0.08); cdoor.add(csign);
  doorMark(cdoor, "cafe"); clickables.push(cdoor);
  doors.push({ x: 9, z: -2.4, to: "cafe" });
  labels.push({ x: 9, y: 3.9, z: Z1 + 0.6, html: "📖 성경 읽는 공간 입구", to: "cafe" });

  // 비전실 문 / 301호 문 (교육관 쪽 작은 문)
  const smallDoor = (x, to, title, bg, label) => {
    const g = new T.Group(); bld.add(g);
    box(g, 1.7, 2.5, 0.12, M("#4a4f55", 0.5), x, 1.27, Z1 + 0.08);
    box(g, 1.2, 2.2, 0.14, M("#e9e2d2", 0.4, { emissive: "#6a5a3a", emissiveIntensity: 0.25 }), x, 1.15, Z1 + 0.1);
    const sg = new T.Mesh(new T.PlaneGeometry(1.7, 0.42), new T.MeshBasicMaterial({ map: textTex([[title, 54, 52]], { w: 400, h: 100, bg }) }));
    sg.position.set(x, 2.78, Z1 + 0.09); g.add(sg);
    doorMark(g, to); clickables.push(g);
    doors.push({ x, z: -2.3, to });
    labels.push({ x, y: 3.35, z: Z1 + 0.4, html: label, to });
  };
  smallDoor(2.4, "vision", "비전", "#2e4f45", "🕊 비전 · 청년 2부");
  smallDoor(13.4, "room301", "301호 3Q", "#7a4a2e", "🛋 301호 · 3Q · 청년 1부");
  smallDoor(-8.6, "praise", "찬양팀", "#1f4e79", "🎸 찬양팀 연습실 · 리빙리버");

  // 흰 첨탑 + 십자가
  const tw = new T.Group(); s.add(tw);
  const white = M("#f1eee8", 0.7), louver = M("#6c6a66", 0.8);
  const TX = -12.6, TZ = -4.4;
  box(tw, 3.2, 13, 3.2, white, TX, 6.5, TZ);
  for (const [dx, dz, ry] of [[0, 1.61, 0], [1.61, 0, Math.PI / 2], [-1.61, 0, Math.PI / 2]]) {
    for (let k = 0; k < 4; k++) box(tw, 1.6, 0.12, 0.05, louver, TX + dx, 10.6 + k * 0.35, TZ + dz, { ry, cast: false });
  }
  box(tw, 3.6, 0.35, 3.6, white, TX, 13.1, TZ);
  const spire = new T.Mesh(new T.ConeGeometry(2.3, 6.5, 4), white); spire.position.set(TX, 16.5, TZ); spire.rotation.y = Math.PI / 4; spire.castShadow = true; tw.add(spire);
  box(tw, 0.22, 2.4, 0.22, white, TX, 20.8, TZ);
  box(tw, 1.3, 0.22, 0.22, white, TX, 21.3, TZ);
  obs.push([TX - 1.6, TZ - 1.6, TX + 1.6, TZ + 1.6]);

  // 단풍 나무들 (11월!)
  const leafCols = ["#e08a3c", "#d9603b", "#e8b64a", "#9ab55a", "#c9773f"];
  const trees = [[-17, 4], [-11, 9.5], [-6.5, 2.5], [2.5, 9.8], [5.5, 2.2], [14, 8.5], [17.5, 2.5], [-15.5, 11]];
  trees.forEach(([x, z], i) => {
    cyl(s, 0.16, 0.24, 2.2, M("#6b4a32"), x, 1.1, z, 8);
    for (let k = 0; k < 3; k++) {
      const c = new T.Mesh(new T.IcosahedronGeometry(1.1 - k * 0.15, 1), M(leafCols[(i + k) % leafCols.length], 0.95));
      c.position.set(x + (k - 1) * 0.5, 2.6 + k * 0.45 + (k === 1 ? 0.3 : 0), z + (k % 2 ? 0.3 : -0.2)); c.castShadow = true; s.add(c);
    }
    obs.push([x - 0.35, z - 0.35, x + 0.35, z + 0.35]);
  });
  // 낙엽
  const leafGeo = new T.CircleGeometry(0.09, 5);
  for (let i = 0; i < 160; i++) {
    const l = new T.Mesh(leafGeo, M(leafCols[i % leafCols.length], 1, { side: T.DoubleSide }));
    l.rotation.x = -Math.PI / 2; l.rotation.z = rnd() * 6; l.position.set(-19 + rnd() * 38, 0.03, -0.5 + rnd() * 13); s.add(l);
  }
  // 벤치
  const benches = [[-8.5, 6.6, 0], [0.8, 6.6, 0], [13.2, 4.2, -Math.PI / 2]];
  benches.forEach(([x, z, ry], b) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g);
    const wood = M("#a0703f", 0.8), iron = M("#3a3a3a", 0.5);
    box(g, 1.8, 0.07, 0.5, wood, 0, 0.45, 0);
    box(g, 1.8, 0.35, 0.06, wood, 0, 0.72, -0.24);
    for (const lx of [-0.8, 0.8]) box(g, 0.07, 0.45, 0.5, iron, lx, 0.22, 0);
    const ids = [];
    for (const k of [-0.42, 0.42]) {
      const id = `B${b}-${k < 0 ? 0 : 1}`, c = Math.cos(ry), sn = Math.sin(ry);
      const sx = x + k * c, sz = z - k * sn;
      seats[id] = { x: sx, z: sz, rot: ry, h: 0.47, ax: sx + Math.sin(ry) * 0.75, az: sz + Math.cos(ry) * 0.75 };
      ids.push(id);
    }
    seatGroupMark(g, ids); clickables.push(g);
    const hw = Math.abs(Math.cos(ry)) * 0.9 + Math.abs(Math.sin(ry)) * 0.25, hd = Math.abs(Math.sin(ry)) * 0.9 + Math.abs(Math.cos(ry)) * 0.25;
    obs.push([x - hw, z - hd, x + hw, z + hd]);
  });
  // 가로등
  for (const [x, z] of [[-6, 0], [5, 0], [-14, 12], [14, 12]]) {
    cyl(s, 0.07, 0.09, 3.4, M("#2e3135", 0.5), x, 1.7, z, 8);
    const bulb = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), M("#fff4d0", 0.4, { emissive: "#ffe9a8", emissiveIntensity: 0.9 })); bulb.position.set(x, 3.5, z); s.add(bulb);
    obs.push([x - 0.2, z - 0.2, x + 0.2, z + 0.2]);
  }
  // 잔디 위 교회 간판
  const sign = new T.Group(); sign.position.set(-13, 0, 12.2); s.add(sign);
  box(sign, 4.4, 0.5, 0.6, M("#b8b2a6", 0.9), 0, 0.25, 0);
  const sg = new T.Mesh(new T.PlaneGeometry(4.0, 1.3), new T.MeshStandardMaterial({ map: textTex([["퀸즈 장로교회", 66, 88], ["The Korean American Presbyterian Church of Queens", 22, 168, "#e9dcc0"]], { w: 640, h: 220, bg: "#3f2c22", border: "#c9a46a" }) }));
  sg.position.set(0, 1.25, 0.31); sign.add(sg);
  box(sign, 4.2, 1.5, 0.5, M("#3f2c22", 0.8), 0, 1.25, 0.04);
  obs.push([-15.3, 11.8, -10.7, 12.6]);
  // 화단
  for (const [x, z] of [[-11.2, -0.9], [3, -0.9], [13, -0.9]]) {
    box(s, 3.2, 0.3, 0.8, M("#8a6a4a"), x, 0.15, z);
    for (let k = 0; k < 7; k++) { const f = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), M(["#e45b6a", "#f1c24a", "#f08ab0", "#ffffff"][k % 4], 0.8)); f.position.set(x - 1.3 + k * 0.43, 0.42, z); s.add(f); }
    obs.push([x - 1.6, z - 0.4, x + 1.6, z + 0.4]);
  }
  // 길 위를 달리는 차들 — 위치를 "지금 시각"으로 계산해서 모두의 화면에서 같은 자리에 보여요 (서버 필요 없음)
  const cars = makeRoadCars(s);
  // (2026-11-18) 길 건너편 집들은 없앴어요 — 길 너머가 탁 트여 보여요
  /* ----- 크리스마스 ----- */
  const twk = [];
  let deco = decoBegin(s);
  // 큰 크리스마스 트리 (마당 가운데 잔디)
  const bigTree = makeXmasTree(6.6, twk); bigTree.position.set(4.6, 0, 6.3); s.add(bigTree);
  obs.push([4.6 - 1.9, 6.3 - 1.9, 4.6 + 1.9, 6.3 + 1.9]);
  const ring = new T.Mesh(new T.CircleGeometry(2.6, 32), M("#f4f6f8", 1)); ring.rotation.x = -Math.PI / 2; ring.position.set(4.6, 0.02, 6.3); ring.receiveShadow = true; s.add(ring);
  labels.push({ x: 4.6, y: 7.6, z: 6.3, html: "🎄 메리 크리스마스!", deco: true, season: "christmas" });
  // 🧦 광고판 (2026-11-17: 예전 '크리스마스의 이유' 포스터 자리 → 히즈핑거 연말 양말 광고). 내용·링크는 위쪽 AD에서 바꿔요
  {
    const PX = 6.9, PZ = 9.5, g = new T.Group(); g.position.set(PX, 0, PZ); g.rotation.y = -0.45; s.add(g);
    const wood = M("#8a5a34", 0.7), frameM = M("#c0392b", 0.6);
    // 액자 크기: 광고 그림 비율(AD.ratio = 가로/세로)에 맞춰요. 세로 사진(9:16)이면 세로로 긴 액자
    const AH = AD.img ? 2.4 : 1.8, AW = AD.img ? AH * (AD.ratio || 1) : 1.8, AY = 0.95 + AH / 2;
    for (const lx of [-(AW / 2 + 0.12), AW / 2 + 0.12]) box(g, 0.1, AY + AH / 2 + 0.1, 0.1, wood, lx, (AY + AH / 2 + 0.1) / 2, -0.05);
    box(g, 0.1, 2.7, 0.1, wood, 0, 1.35, -0.75).rotation.x = -0.35; // 뒷다리
    box(g, AW + 0.18, AH + 0.18, 0.08, frameM, 0, AY, 0.02);
    const tex = adBannerTex();
    const artM = new T.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.18 });
    // 광고 사진 파일(AD.img)이 있으면 그걸로 바꿔요 (없으면 위에서 그린 광고판 그대로)
    if (AD.img) new T.TextureLoader().load(AD.img, (t2) => { t2.encoding = T.sRGBEncoding; t2.anisotropy = 4; artM.map = t2; artM.emissiveMap = t2; artM.needsUpdate = true; }, undefined, () => {});
    const art = new T.Mesh(new T.PlaneGeometry(AW, AH), artM);
    art.position.set(0, AY, 0.07); g.add(art);
    box(g, AW + 0.18, 0.08, 0.3, wood, 0, AY - AH / 2 - 0.1, 0.12); // 받침
    const plate = new T.Mesh(new T.PlaneGeometry(1.7, 0.32), new T.MeshBasicMaterial({ map: textTex([["🧦 눌러서 보러 가기 →", 40, 40]], { w: 640, h: 80, bg: "#0f6b45" }) }));
    plate.position.set(0, 0.6, 0.12); g.add(plate);
    g.traverse((m) => (m.userData.action = "ad")); clickables.push(g);
    obs.push([PX - 1.0, PZ - 0.9, PX + 1.0, PZ + 0.5]);
    labels.push({ x: PX, y: AY + AH / 2 + 0.45, z: PZ, html: AD.label, action: "ad", season: "christmas" });
  }
  // 처마 전구 줄 + 정문 캐노피 전구
  const eave = []; for (let x = -15; x <= 15.01; x += 2.5) eave.push([x, 7.05, Z1 + 0.3]);
  lightRun(s, twk, eave, 9, 0.3);
  lightRun(s, twk, [[-5.3, 3.0, Z1 + 3.15], [-0.7, 3.0, Z1 + 3.15]], 12, 0.12);
  // 문마다 리스
  for (const [x, y] of [[-3, 2.95], [9, 2.55], [2.4, 2.3], [13.4, 2.3]]) { const w = makeWreath(x === -3 ? 0.36 : 0.26); w.position.set(x, y, Z1 + 0.2); s.add(w); }
  decoEnd(s, deco, "christmas");
  deco = decoBegin(s);
  // 지붕 위 눈 (겨울)
  const snowM = M("#f7f9fb", 0.9);
  for (const sgn of [1, -1]) { const r = box(bld, X1 - X0 + 1.1, 0.12, slopeLen, snowM, 0, (WH + ridgeY) / 2 + 0.14, (Z0 + Z1) / 2 + sgn * depth / 4, { cast: false }); r.rotation.x = sgn * slope; }
  box(s, 3.7, 0.12, 3.7, snowM, -12.6, 13.33, -4.4, { cast: false });
  // 잔디 위 눈 조각
  for (let i = 0; i < 26; i++) { const c = new T.Mesh(new T.CircleGeometry(0.4 + rnd() * 0.9, 14), snowM); c.rotation.x = -Math.PI / 2; c.position.set(-19 + rnd() * 36, 0.015, 0.5 + rnd() * 11.5); c.scale.set(1, 0.6 + rnd() * 0.6, 1); s.add(c); }
  decoEnd(s, deco, "winter");
  yardSeasonDeco(s, labels, Z1);
  // 📅 모임 시간표 게시판 (정문 길 왼쪽 잔디)
  const schedBoard = addBoard(s, -8.4, 10.9, 0.25, 2.4, "📅 그루터기 모임 시간표", { empty: "다음 모임을 기다리는 중이에요", foot: "눌러서 전체 일정 보기" }, "schedule", labels, clickables, "📅 모임 시간표");
  obs.push([-9.7, 10.6, -7.1, 11.2]);

  /* ----- 놀이터 (건물 뒤 배드민턴장 오른쪽): 눈썰매 언덕, 썰매, 눈사람, 그네, 울타리 ----- */
  const DZ = PG_DZ;
  const pg = new T.Group(); s.add(pg);
  box(pg, 12, 0.03, 23.5, M("#f3f6f9", 0.95), 26.2, 0.015, -5.6 + DZ, { cast: false });
  // 언덕 (위가 평평하고 앞으로 부드럽게 내려와요)
  const HW = HILL.x1 - HILL.x0, HD = HILL.zFoot - HILL.zBack, hg = new T.PlaneGeometry(HW, HD, 8, 40);
  hg.rotateX(-Math.PI / 2);
  const hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const z = hp.getZ(i) + (HILL.zBack + HILL.zFoot) / 2; hp.setY(i, hillH(z)); }
  hg.computeVertexNormals();
  const hill = new T.Mesh(hg, M("#e4edf6", 0.9)); hill.position.set((HILL.x0 + HILL.x1) / 2, 0, (HILL.zBack + HILL.zFoot) / 2); hill.receiveShadow = true; pg.add(hill);
  const side = new T.Shape(); side.moveTo(HILL.zBack, 0); for (let k = 0; k <= 30; k++) { const z = HILL.zBack + (HILL.zFoot - HILL.zBack) * k / 30; side.lineTo(z, hillH(z)); } side.lineTo(HILL.zFoot, 0);
  for (const x of [HILL.x0, HILL.x1]) { const sm = new T.Mesh(new T.ShapeGeometry(side), M("#e6edf3", 0.9, { side: T.DoubleSide })); sm.rotation.y = -Math.PI / 2; sm.position.x = x; pg.add(sm); }
  box(pg, HW, HILL.h, 0.1, M("#e6edf3", 0.9), (HILL.x0 + HILL.x1) / 2, HILL.h / 2, HILL.zBack);
  // 썰매 길 (얼음빛)
  for (const lx of HILL.lanes) {
    const lg = new T.PlaneGeometry(1.1, HD + 6, 1, 46); lg.rotateX(-Math.PI / 2);
    const lp = lg.attributes.position; for (let i = 0; i < lp.count; i++) { const z = lp.getZ(i) + (HILL.zBack + HILL.zFoot + 6) / 2; lp.setY(i, hillH(z) + 0.02); }
    const lane = new T.Mesh(lg, new T.MeshStandardMaterial({ color: "#bcd9f2", roughness: 0.3 })); lane.position.set(lx, 0, (HILL.zBack + HILL.zFoot + 6) / 2); pg.add(lane);
  }
  // 왼쪽 계단 (올라가는 길)
  for (let k = 0; k < 10; k++) { const z = HILL.zFoot - 0.4 - k * 0.95, y = hillH(z); box(pg, 0.8, Math.max(0.1, y), 0.95, M("#c9a27a", 0.8), HILL.x0 - 0.45, Math.max(0.1, y) / 2, z); }
  // 썰매 (눌러서 타기)
  [[HILL.lanes[0] - 1.3, 3.4 + DZ, "#d0312d"], [HILL.lanes[1] + 1.3, 3.4 + DZ, "#2e6fd0"]].forEach(([x, z, c]) => {
    const sl = makeSled(c); sl.position.set(x, 0, z); sl.rotation.y = 0.3; pg.add(sl);
    sl.traverse((m) => (m.userData.action = "sled")); clickables.push(sl);
  });
  labels.push({ x: 26.5, y: HILL.h + 1.6, z: HILL.zTop - 1, html: "🛷 눈썰매 타기", action: "sled" });
  // 눈사람
  const sm = new T.Group(); sm.position.set(21.4, 0, 1.6 + DZ); pg.add(sm);
  const snowB = M("#ffffff", 0.8);
  [[0.5, 0.45], [0.36, 1.1], [0.26, 1.6]].forEach(([r, y]) => { const b = new T.Mesh(new T.SphereGeometry(r, 18, 14), snowB); b.position.y = y; b.castShadow = true; sm.add(b); });
  for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), M("#111", 0.4)); e.position.set(0.09 * sx, 1.67, 0.23); sm.add(e); }
  const carrot = new T.Mesh(new T.ConeGeometry(0.05, 0.25, 8), M("#f08a24", 0.6)); carrot.rotation.x = Math.PI / 2; carrot.position.set(0, 1.6, 0.36); sm.add(carrot);
  const scarf = new T.Mesh(new T.TorusGeometry(0.27, 0.06, 8, 20), M("#2e7d4f", 0.8)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.38; sm.add(scarf);
  cyl(sm, 0.2, 0.2, 0.25, M("#1d1d1d", 0.5), 0, 1.93, 0, 16); cyl(sm, 0.3, 0.3, 0.03, M("#1d1d1d", 0.5), 0, 1.81, 0, 16);
  obs.push([20.8, 1.0 + DZ, 22.0, 2.2 + DZ]);
  // 그네 2개 (앉을 수 있어요)
  const sw = new T.Group(); sw.position.set(28.6, 0, 1.6 + DZ); pg.add(sw);
  const pipe = M("#d35400", 0.5);
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.5, 0.5]) { const leg = cyl(sw, 0.05, 0.05, 2.5, pipe, sx, 1.2, sz * 0.9, 8); leg.rotation.x = sz * 0.35; }
  const bar = cyl(sw, 0.05, 0.05, 3.0, pipe, 0, 2.38, 0, 8); bar.rotation.z = Math.PI / 2;
  const swIds = [], swings = [];
  [-0.6, 0.6].forEach((x, i) => {
    // 그네 한 개 = 위 막대에 매달린 '흔들리는 묶음' (줄 2개 + 앉는 판). 누가 앉으면 앞뒤로 흔들려요
    const pv = new T.Group(); pv.position.set(x, 2.38, 0); sw.add(pv);
    for (const dx of [-0.2, 0.2]) cyl(pv, 0.01, 0.01, 1.85, M("#666", 0.4), dx, -0.93, 0, 4);
    box(pv, 0.5, 0.05, 0.25, M("#2c3e50", 0.6), 0, -1.88, 0);
    const id = `SW-${i}`; seats[id] = { x: 28.6 + x, z: 1.6 + DZ, rot: 0, h: 0.52, ax: 28.6 + x, az: 2.4 + DZ, swing: i }; swIds.push(id);
    swings.push({ pv, id, amp: 0, ang: 0, L: 1.88 });
  });
  seatGroupMark(sw, swIds); clickables.push(sw);
  obs.push([27.1, 1.1 + DZ, 30.1, 2.1 + DZ]);
  // 울타리 + 간판
  const fenceM = M("#f2efe8", 0.7);
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 0.5), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) { const t = i / n; box(pg, 0.08, 0.8, 0.08, fenceM, x0 + (x1 - x0) * t, 0.4, z0 + (z1 - z0) * t, { cast: false }); }
    for (const y of [0.3, 0.65]) box(pg, 0.04, 0.06, len, fenceM, (x0 + x1) / 2, y, (z0 + z1) / 2, { ry, cast: false });
    obs.push([Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1]);
  };
  fence(31.9, -17.6 + DZ, 31.9, 5.2 + DZ); fence(23.6, 5.2 + DZ, 31.9, 5.2 + DZ); fence(20.3, -17.6 + DZ, 31.9, -17.6 + DZ);
  const pgs = new T.Mesh(new T.PlaneGeometry(2.2, 0.6), new T.MeshBasicMaterial({ map: textTex([["그루터기 놀이터 🛷", 48, 60]], { w: 440, h: 120, bg: "#2e6b4f" }) }));
  pgs.position.set(22.4, 1.55, 5.25 + DZ); pg.add(pgs);
  for (const sx of [21.4, 23.4]) cyl(pg, 0.04, 0.04, 1.3, M("#5a4636"), sx, 0.65, 5.2 + DZ, 6);
  // 언덕(올라갈 수 없는 곳) + 건물 뒤쪽은 못 가요
  obs.push([HILL.x0 - 0.9, HILL.zBack - 0.3, HILL.x1 + 0.1, HILL.zFoot + 0.15]);
  obs.push([-15.3, -19, 15.3, -3.95]);
  // 오른쪽 끝은 산울타리 (예전 트럭 자리는 없앴어요)
  // 2026-11-18: 산울타리 가운데(z -12.2 ~ -9.4)에 ⛸ 스케이트장 가는 출입구를 뚫었어요. 마당 오른쪽 끝은 x 53.6 산울타리
  const hedge = (x, z) => { const b = new T.Mesh(new T.IcosahedronGeometry(0.55, 1), M("#3f7a45", 0.95)); b.position.set(x, 0.45, z); b.scale.set(0.8, 0.85, 1); b.castShadow = true; s.add(b); };
  for (let z = -43.8; z <= 12.3; z += 0.9) if (z < RINK.gate[0] - 0.4 || z > RINK.gate[1] + 0.4) hedge(32.6, z);
  obs.push([32.0, -45, 34, RINK.gate[0] - 0.3], [32.0, RINK.gate[1] + 0.3, 34, 13.4]);
  for (let z = -43.8; z <= 12.3; z += 0.9) hedge(53.6, z);
  for (let x = 33.5; x <= 53; x += 0.9) hedge(x, -43.8);
  obs.push([53.0, -45, 55, 13.4], [32, -45, 55, -43.2]);
  const rink = buildRink(s, obs, clickables, labels, seats);
  // 🧭 구역 입구 아치 + 멀리서 보이는 구역 이름 (가까이 가면 자세한 이름표로 바뀌어요)
  zoneArch(s, obs, 26.0, 3.0, 0, 5.0, "⛹️ 놀이 동산", "#2e6b4f");
  zoneArch(s, obs, -20.6, -1.3, 0, 2.6, "🐱 고양이 쉼터", "#8a5a34");
  zoneArch(s, obs, -17.6, -20.6, 0, 3.0, "🔥 뒷마당 쉼터", "#7a3a24");
  zoneArch(s, obs, 17.8, -21.6, 0, 3.0, "🔥 뒷마당 쉼터", "#7a3a24");
  for (const zz of ZONES) labels.push({ x: zz.x, y: 6.5, z: zz.z, html: zz.name, zone: zz.id, action: "zone:" + zz.id });
  box(s, 12.6, 0.04, 4.6, M("#d6d2ca", 0.95), 26.0, 0.02, 5.0, { cast: false }); // 트럭 앞 보도
  box(s, 2.6, 0.03, 23.5, M("#d6d2ca", 0.95), 19.0, 0.014, -8.6, { cast: false }); // 트럭 옆 → 놀이터 가는 길
  deco = decoBegin(s);
  const snowFx = makeSnow(s, { x0: -38, x1: 55, z0: -45, z1: 16, h: 14 });
  decoEnd(s, deco, "winter");
  const night = yardNight(s);

  /* ----- 고양이 콘도 + 밥 주는 곳 (교회 건물 왼쪽) ----- */
  const CX = -21, CZ = -9.7, cd = new T.Group(); s.add(cd);
  const wood = M("#c9a06a", 0.75), woodD = M("#9a7448", 0.75), sisal = M("#d8bf8a", 0.95), hole = M("#2a1f18", 0.9), cushion = M("#b9c2cc", 0.95);
  box(cd, 3.4, 0.12, 2.1, woodD, CX, 0.06, CZ);
  // 아래층 집 (동그란 문)
  box(cd, 1.15, 0.95, 1.05, wood, CX - 1.1, 0.6, CZ);
  const d1 = new T.Mesh(new T.CircleGeometry(0.24, 20), hole); d1.position.set(CX - 1.1, 0.55, CZ + 0.53); cd.add(d1);
  box(cd, 1.25, 0.06, 1.15, woodD, CX - 1.1, 1.1, CZ); // 위 판 (쉬는 자리)
  // 기둥 (스크래쳐 줄 감은 기둥)
  for (const [px, pz] of [[CX + 0.45, CZ + 0.35], [CX + 1.4, CZ + 0.35], [CX + 0.45, CZ - 0.4], [CX + 1.4, CZ - 0.4]]) {
    cyl(cd, 0.09, 0.09, 1.25, sisal, px, 0.75, pz, 10);
    for (let k = 0; k < 6; k++) { const r = new T.Mesh(new T.TorusGeometry(0.092, 0.012, 4, 12), M("#bfa36e", 0.95)); r.rotation.x = Math.PI / 2; r.position.set(px, 0.3 + k * 0.17, pz); cd.add(r); }
  }
  // 위층 집 + 지붕
  box(cd, 1.15, 0.8, 0.95, wood, CX + 0.92, 1.78, CZ);
  const d2 = new T.Mesh(new T.CircleGeometry(0.2, 20), hole); d2.position.set(CX + 0.92, 1.72, CZ + 0.48); cd.add(d2);
  for (const sg of [-1, 1]) { const rf = box(cd, 0.7, 0.06, 1.1, M("#7a4a2e", 0.7), CX + 0.92 + sg * 0.3, 2.33, CZ); rf.rotation.z = -sg * 0.6; }
  // 꼭대기 방석
  cyl(cd, 0.07, 0.07, 1.0, sisal, CX - 1.1, 1.62, CZ - 0.2, 8);
  cyl(cd, 0.5, 0.5, 0.07, woodD, CX - 1.1, 2.15, CZ - 0.2, 20);
  const cu = new T.Mesh(new T.TorusGeometry(0.36, 0.11, 8, 20), cushion); cu.rotation.x = Math.PI / 2; cu.position.set(CX - 1.1, 2.24, CZ - 0.2); cd.add(cu);
  cyl(cd, 0.33, 0.33, 0.05, M("#d6dde4", 0.95), CX - 1.1, 2.2, CZ - 0.2, 18);
  // 사다리
  for (let k = 0; k < 4; k++) box(cd, 0.35, 0.04, 0.12, woodD, CX - 0.3, 0.3 + k * 0.26, CZ + 0.62 - k * 0.04);
  // 간판
  const cs = new T.Mesh(new T.PlaneGeometry(2.4, 0.5), new T.MeshBasicMaterial({ map: textTex([["🐾 그루터기 고양이 콘도", 46, 52]], { w: 520, h: 108, bg: "#5a3a24", border: "#e2c06a" }) }));
  cs.position.set(CX, 2.85, CZ - 0.45); cd.add(cs);
  for (const sx of [-1.15, 1.15]) cyl(cd, 0.04, 0.04, 1.0, woodD, CX + sx, 2.5, CZ - 0.47, 6);
  obs.push([CX - 1.75, CZ - 1.1, CX + 1.75, CZ + 1.1]);
  // 밥 주는 곳: 매트 + 그릇 (건사료·캔사료·물) + 선반 (사료 봉지·캔·츄르)
  const st = new T.Group(); s.add(st);
  box(st, 3.0, 0.02, 1.0, M("#d9b98f", 0.9), CX, 0.012, CZ + 2.45, { cast: false });
  const bowl = (x, col, fill) => {
    const b = new T.Group(); b.position.set(x, 0, CZ + 2.45); st.add(b);
    cyl(b, 0.16, 0.12, 0.08, M(col, 0.4), 0, 0.04, 0, 18);
    cyl(b, 0.135, 0.135, 0.01, M("#2a2a2a", 0.6), 0, 0.075, 0, 18);
    if (fill === "dry") for (let i = 0; i < 14; i++) { const k = new T.Mesh(new T.SphereGeometry(0.02, 6, 5), M(i % 2 ? "#8a5a2e" : "#a8743e", 0.8)); k.position.set(Math.cos(i * 2.4) * 0.07 * Math.sqrt(i / 14), 0.09, Math.sin(i * 2.4) * 0.07 * Math.sqrt(i / 14)); b.add(k); }
    if (fill === "wet") { const m = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), M("#b97a6a", 0.7)); m.scale.y = 0.35; m.position.y = 0.08; b.add(m); }
    if (fill === "water") cyl(b, 0.13, 0.13, 0.012, new T.MeshStandardMaterial({ color: "#8fc8f0", transparent: true, opacity: 0.8, roughness: 0.1 }), 0, 0.078, 0, 18);
    return b;
  };
  bowl(CX - 0.95, "#e57373", "dry"); bowl(CX - 0.32, "#f2c84b", "wet"); bowl(CX + 0.32, "#81c784", "dry"); bowl(CX + 0.95, "#64b5f6", "water");
  const rack = new T.Group(); rack.position.set(CX - 2.15, 0, CZ + 2.3); st.add(rack);
  for (const y of [0.05, 0.45, 0.85]) box(rack, 0.7, 0.04, 0.4, woodD, 0, y, 0);
  for (const sx of [-0.33, 0.33]) box(rack, 0.04, 0.9, 0.4, woodD, sx, 0.45, 0);
  const label = (txt, bg) => new T.MeshBasicMaterial({ map: textTex([[txt, 64, 70]], { w: 256, h: 140, bg }) });
  const bag = box(rack, 0.3, 0.36, 0.14, M("#a0522d", 0.7), -0.12, 0.25, 0); const bl = new T.Mesh(new T.PlaneGeometry(0.26, 0.14), label("건사료", "#7a3a1a")); bl.position.set(-0.12, 0.27, 0.072); rack.add(bl); void bag;
  for (let i = 0; i < 3; i++) { cyl(rack, 0.05, 0.05, 0.07, M("#c0c4c8", 0.3, { metalness: 0.6 }), 0.16 + (i % 2) * 0.1, 0.11 + Math.floor(i / 2) * 0.07, 0.03, 12); cyl(rack, 0.051, 0.051, 0.035, M("#d0312d", 0.6), 0.16 + (i % 2) * 0.1, 0.11 + Math.floor(i / 2) * 0.07, 0.03, 12); }
  box(rack, 0.34, 0.16, 0.12, M("#f6a6c1", 0.6), 0, 0.55, 0);
  const cl = new T.Mesh(new T.PlaneGeometry(0.3, 0.13), label("츄르", "#e0608e")); cl.position.set(0, 0.56, 0.062); rack.add(cl);
  for (let i = 0; i < 4; i++) box(rack, 0.03, 0.18, 0.015, M(["#f6a6c1", "#ffd36b", "#9fd6a8", "#f6a6c1"][i], 0.6), -0.2 + i * 0.05, 0.98, 0, { cast: false });
  box(rack, 0.26, 0.16, 0.14, M("#3a6ea5", 0.6), 0.15, 0.95, 0);
  obs.push([CX - 2.55, CZ + 2.05, CX - 1.75, CZ + 2.55]);
  // 밥 준 기록 판 (오늘 몇 번, 마지막에 누가)
  const feedMat = new T.MeshBasicMaterial({ map: feedLogTex(null) });
  const fb = new T.Mesh(new T.PlaneGeometry(1.5, 0.75), feedMat); fb.position.set(CX + 2.45, 1.05, CZ + 2.3); fb.rotation.y = -0.35; s.add(fb);
  cyl(s, 0.04, 0.04, 0.7, woodD, CX + 2.45, 0.35, CZ + 2.3, 6);
  st.traverse((m) => (m.userData.action = "catfood")); cd.traverse((m) => (m.userData.action = "catfood")); fb.userData.action = "catfood";
  clickables.push(st, cd, fb);
  labels.push({ x: CX, y: 3.45, z: CZ, html: "🐾 고양이 콘도 · 밥 주기", action: "catfood" });
  // 앞마당에서 콘도로 가는 징검돌
  for (let i = 0; i < 6; i++) { const c = new T.Mesh(new T.CircleGeometry(0.32, 10), M("#c8c2b8", 0.95)); c.rotation.x = -Math.PI / 2; c.position.set(-16.6 - i * 0.75, 0.025, -3.2 - i * 0.55); s.add(c); }
  const FEED_SPOTS = [[CX - 0.95, CZ + 3.05], [CX - 0.32, CZ + 3.1], [CX + 0.32, CZ + 3.1], [CX + 0.95, CZ + 3.05], [CX + 0.0, CZ + 3.75]];

  /* ----- 🧀 치즈멜로바이트 쇼룸 (고양이 콘도 왼쪽) + 왼쪽 끝 산울타리 ----- */
  const showroom = buildShowroom(s, seats, obs, clickables, labels, doors);
  for (let z = -43.8; z <= 12.3; z += 0.9) { const b = new T.Mesh(new T.IcosahedronGeometry(0.55, 1), M("#3f7a45", 0.95)); b.position.set(-36.6, 0.45, z); b.scale.set(0.8, 0.85, 1); b.castShadow = true; s.add(b); }
  obs.push([-38.5, -45, -36.0, 13.4]);

  /* ----- 🍢 먹거리·가게 골목: 쇼룸 앞 골목 양쪽에 푸드 트럭 2대가 마주 봐요 (2026-11-18, 예전엔 건물 오른쪽 앞) ----- */
  const LANE = { x: SHOW.x, z0: -1.2, z1: 11.6 };
  const trucks = {
    tako: buildTruck(s, seats, obs, clickables, labels, { cx: -34.5, cz: 3.4, ry: Math.PI / 2, lane: LANE, queueDir: { x: 0, z: 1 }, board: { x: -34.6, z: 11.2, ry: 0 }, kind: "tako", body: "#d9483b", trim: "#f4efe6", accent: "#ffcf4a", signBg: "#b5352b",
      title: "🐙 타코야끼", unit: "접시", seatId: "TK-0", banner: "따끈따끈 타코야끼 · 만들어서 나눠 먹어요 🐙", label: "🐙 타코야끼 트럭" }),
    bungeo: buildTruck(s, seats, obs, clickables, labels, { cx: -26.7, cz: 3.4, ry: -Math.PI / 2, lane: LANE, queueDir: { x: 0, z: 1 }, board: { x: -26.6, z: 11.2, ry: 0 }, kind: "bungeo", body: "#2f4f8a", trim: "#f4efe6", accent: "#ffd25a", signBg: "#23396a",
      title: "🐟 붕어빵", unit: "개", seatId: "BG-0", banner: "수익금은 캄보디아 벧엘 국제학교 아이들 장학금으로 💛", label: "🐟 붕어빵 트럭 · 장학금 💛" }),
  };
  // 골목 바닥 · 전구 줄 · 피크닉 테이블 (사 먹고 앉는 자리 PT{0|1}-{0~3})
  box(s, 4.2, 0.03, 13.2, M("#e2d6bf", 0.95), LANE.x, 0.016, (LANE.z0 + LANE.z1) / 2, { cast: false });
  for (let k = 0; k < 14; k++) { const t = box(s, 0.5, 0.032, 0.5, M(k % 2 ? "#d4c4a6" : "#e9dcc2", 0.95), LANE.x + (k % 2 ? 1.2 : -1.2), 0.017, LANE.z0 + 0.6 + k * 0.92, { cast: false }); t.rotation.y = 0.785; }
  const lanePoles = [[-33.0, -0.6], [-28.2, -0.6], [-33.0, 5.4], [-28.2, 5.4], [-33.0, 10.8], [-28.2, 10.8]];
  for (const [x, z] of lanePoles) { cyl(s, 0.05, 0.06, 3.4, M("#3a3a3a", 0.5), x, 1.7, z, 6); obs.push([x - 0.12, z - 0.12, x + 0.12, z + 0.12]); }
  lightRun(s, twk, [[-33.0, 3.3, -0.6], [-28.2, 3.3, 5.4], [-33.0, 3.3, 10.8]], 22, 0.11);
  lightRun(s, twk, [[-28.2, 3.3, -0.6], [-33.0, 3.3, 5.4], [-28.2, 3.3, 10.8]], 22, 0.11);
  const gate = new T.Mesh(new T.PlaneGeometry(4.6, 0.62), new T.MeshBasicMaterial({ map: textTex([["🍢 먹거리·가게 골목", 44, 50]], { w: 520, h: 100, bg: "#b5352b", border: "#ffd25a" }), side: T.DoubleSide }));
  gate.position.set(LANE.x, 3.05, 10.8); s.add(gate);
  [[-35.0, 7.6, "PT0"], [-26.2, 7.6, "PT1"]].forEach(([x, z, id]) => {
    const tg = new T.Group(); tg.position.set(x, 0, z); s.add(tg);
    const wd = M("#b98a5a", 0.7);
    box(tg, 0.8, 0.06, 1.6, wd, 0, 0.74, 0); for (const sz of [-0.6, 0.6]) box(tg, 0.7, 0.72, 0.06, wd, 0, 0.36, sz);
    for (const sx of [-0.62, 0.62]) box(tg, 0.3, 0.05, 1.6, wd, sx, 0.44, 0);
    const umb = new T.Mesh(new T.ConeGeometry(1.1, 0.4, 10, 1, true), new T.MeshStandardMaterial({ map: stripeTex("#d9483b", "#fff4dc"), side: T.DoubleSide, roughness: 0.8 })); umb.position.set(0, 2.3, 0); tg.add(umb); cyl(tg, 0.025, 0.025, 2.2, M("#ddd", 0.5), 0, 1.15, 0, 6);
    const ids = [];
    for (const [sx, sz] of [[-0.62, -0.4], [-0.62, 0.4], [0.62, -0.4], [0.62, 0.4]]) { const sid = `${id}-${ids.length}`, rot = sx < 0 ? Math.PI / 2 : -Math.PI / 2; seats[sid] = { x: x + sx, z: z + sz, rot, h: 0.46, ax: x + sx * 1.9, az: z + sz }; ids.push(sid); }
    seatGroupMark(tg, ids); clickables.push(tg);
    obs.push([x - 0.8, z - 0.85, x + 0.8, z + 0.85]);
  });


  /* ----- 길고양이 5마리 ----- */
  const catPts = [[-19, -6.2], [-23.5, -6.8], [-24.5, -11], [-18, -13.5], [-17.6, -2.8], [-24, -3.5], [-22, -14.5],
    [-17.5, 7], [-14, 3], [-12.5, 7.5], [-9, 3.5], [-8, 9.5], [-5, 6], [-15, 9.5], [-10.5, 5.5],
    [-0.5, 3], [1, 10.5], [0, 1.5], [7.5, 10.8], [8, 3], [1.5, 4.5], [7.8, 7], [-1, 11.5],
    [11, 3], [12, 9], [15.5, 5], [18.5, 10], [16, 1], [19, 6.5], [11.5, 11.5],
    [-8, -2.2], [5, -2.3], [16, -2.5], [-1, -2.2], [12, -2.2], [19, 11.8], [21, 11.5], [25.5, 11.2]];
  const cats = CATS.map((c, i) => { const m = makeCat(c); s.add(m.group); m.group.traverse((o) => (o.userData.action = "cat:" + i)); clickables.push(m.group); return Object.assign(m, { i, def: c, blocks: {}, yaw: 0, petUntil: 0 }); });
  let catGrid = null, pts = [];
  const SEG = 15, BLK = 32;
  const block = (cat, A) => { // A부터 32칸 동안 고양이가 갈 곳 (모두 같은 계산)
    if (cat.blocks[A]) return cat.blocks[A];
    const out = [], n = pts.length; let prev = pts[hash32(cat.i + 11, A) % n];
    out.push(prev);
    for (let j = A + 1; j < A + BLK; j++) {
      let next = prev; const st = hash32(cat.i + 11, j) % n;
      for (let q = 0; q < n; q++) { const c = pts[(st + q) % n]; if (c === prev) continue; if (Math.hypot(c[0] - prev[0], c[1] - prev[1]) < 11 && catGrid.los({ x: prev[0], z: prev[1] }, { x: c[0], z: c[1] })) { next = c; break; } }
      out.push(next); prev = next;
    }
    const keys = Object.keys(cat.blocks); if (keys.length > 4) delete cat.blocks[keys[0]];
    return (cat.blocks[A] = out);
  };
  const wp = (cat, k) => { const A = k - (((k % BLK) + BLK) % BLK); return block(cat, A)[k - A]; };
  const state = { feedUntil: 0 };
  const updateCats = (dt, t) => {
    if (!catGrid || !pts.length) return;
    const nowMs = Date.now(), now = nowMs / 1000, pnow = performance.now(), feeding = nowMs < state.feedUntil;
    for (const c of cats) {
      // 평소: 시각으로 정해진 자리 (모두 같은 화면)
      const local = now + c.i * 3.7, k = Math.floor(local / SEG), f = local - k * SEG;
      const a = wp(c, k - 1), b = wp(c, k), d = Math.hypot(b[0] - a[0], b[1] - a[1]), walkT = Math.min(SEG - 3, d / 0.7);
      let x, z, walking = false, eating = false, yaw = c.yaw;
      if (f < walkT && d > 0.05) { const u = f / walkT; x = a[0] + (b[0] - a[0]) * u; z = a[1] + (b[1] - a[1]) * u; walking = true; yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); }
      else { x = b[0]; z = b[1]; }
      // 누가 밥을 주면: 밥그릇 앞으로 뛰어와서 먹고, 끝나면 원래 자리로 돌아가요
      if (!c.cur) c.cur = { x, z };
      let tx = x, tz = z;
      if (feeding) { tx = FEED_SPOTS[c.i][0]; tz = FEED_SPOTS[c.i][1]; }
      if (feeding || c.away) {
        let gx = tx, gz = tz;
        const crossing = (c.cur.x > -15.8) !== (gx > -15.8) && Math.min(c.cur.z, gz) < -3.4; // 건물 모서리를 돌아가요
        if (crossing) { gx = -16.4; gz = -3.1; }
        const dx = gx - c.cur.x, dz = gz - c.cur.z, dd = Math.hypot(dx, dz);
        if (dd > 0.06) { const step = Math.min(dd, dt * 1.7); c.cur.x += dx / dd * step; c.cur.z += dz / dd * step; walking = true; yaw = Math.atan2(dx, dz); c.away = true; }
        else if (!crossing) {
          if (feeding) { walking = false; eating = true; yaw = Math.PI; }
          else { c.away = false; }
        }
        x = c.cur.x; z = c.cur.z;
      } else { c.cur.x = x; c.cur.z = z; }
      c.yaw = yaw;
      const petting = pnow < c.petUntil;
      c.group.position.set(x, 0, z); c.group.rotation.y = c.yaw + (walking || eating ? 0 : Math.sin(c.i * 2.1) * 0.6);
      catPose(c, walking, eating, t, petting, c.i);
      c.pos = { x, z };
    }
  };
  const initCats = (grid) => { catGrid = grid; pts = catPts.filter(([x, z]) => grid.free(x, z)); };

  const courts = buildCourts(s, seats, obs, clickables, labels);
  const backyard = buildBackyard(s, seats, obs, clickables, labels);
  return { scene: s, seats, obs, clickables, doors, labels, tw: twk, trucks, cats, swings, courts, backyard, schedBoard, showroom, rink, sportBoard: courts.sportBoard, initCats, catState: state, feedMat, feedSpot: { x: CX + 2.0, z: CZ + 3.6 },
    update: (dt, t) => { if (snowOn() && !World.lite) snowFx(dt, t); updateCats(dt, t); updateRoadCars(cars, dt); updateTruckNpcs(trucks, dt, t); showroom.update(t); backyard.update(dt, t); }, night, bounds: { x0: -36, x1: 54, z0: -44.5, z1: 13.3 }, cell: 0.3, pad: 0.24,
    cam: { pitch: 0.66, dist: 15, min: 6, max: 26, yawLimit: 1.6 },
    spawn: { worship: { x: -3, z: -1.6 }, cafe: { x: 9, z: -1.6 }, vision: { x: 2.4, z: -1.7 }, room301: { x: 14.2, z: -1.8 }, praise: { x: -8.6, z: -1.8 }, showroom: { x: SHOW.x, z: SHOW.z + 3.6 }, def: { x: 0, z: 9.5 } },
    spread: { def: [3.2, 1.6], showroom: [1.2, 0.5], worship: [1.4, 0.6], cafe: [1.2, 0.6], vision: [0.9, 0.4], room301: [0.8, 0.4], praise: [0.9, 0.35] } };
}

/* ===== 본당 (기도하는 공간, 내부) ===== */
function buildWorship() {
  const s = new T.Scene();
  s.background = new T.Color("#4a3d33");
  addLights(s, { sky: "#fff6e8", ground: "#6b4a30", hemi: 0.8, sunI: 0.55, sunPos: [6, 18, 8], ext: 18, amb: 0.12 });
  const pl = new T.PointLight("#ffe2b0", 0.6, 30); pl.position.set(0, 7, -9); s.add(pl);
  const seats = {}, obs = [], clickables = [], doors = [], labels = [];
  const HX = 9, Z0 = -14, Z1 = 12, WALL = 4.6, RIDGE = 10;
  const inner = (m) => { m.side = T.FrontSide; return m; };

  plane(s, HX * 2, Z1 - Z0, new T.MeshStandardMaterial({ map: woodTex("#b8875a", [5, 12]), roughness: 0.85 }), 0, 0, (Z0 + Z1) / 2, -Math.PI / 2);
  plane(s, 300, 300, M("#6e5a48", 1), 0, -0.03, 0, -Math.PI / 2);
  plane(s, HX * 2 + 6, 16, M("#9c8f80", 0.95), 0, -0.01, Z1 + 8, -Math.PI / 2);
  const carpet = M("#a3302e", 0.95);
  box(s, 2.0, 0.02, Z1 - (-9.6), carpet, 0, 0.012, (Z1 - 9.6) / 2, { cast: false });
  box(s, 18, 0.02, 1.2, carpet, 0, 0.013, -9.2, { cast: false });
  // 벽 (안쪽 면만 보이게)
  const wallM = inner(new T.MeshStandardMaterial({ color: "#f5f0e6", roughness: 0.95 }));
  plane(s, Z1 - Z0, WALL, wallM, -HX, WALL / 2, (Z0 + Z1) / 2, 0, Math.PI / 2);
  plane(s, Z1 - Z0, WALL, wallM, HX, WALL / 2, (Z0 + Z1) / 2, 0, -Math.PI / 2);
  plane(s, HX * 2, WALL, wallM, 0, WALL / 2, Z1, 0, Math.PI);
  const front = new T.Shape(); front.moveTo(-HX, 0); front.lineTo(HX, 0); front.lineTo(HX, WALL); front.lineTo(0, RIDGE); front.lineTo(-HX, WALL); front.closePath();
  const fw = new T.Mesh(new T.ShapeGeometry(front), wallM); fw.position.set(0, 0, Z0); fw.receiveShadow = true; s.add(fw);
  const backG = new T.Shape(); backG.moveTo(-HX, WALL); backG.lineTo(HX, WALL); backG.lineTo(0, RIDGE); backG.closePath();
  const bw = new T.Mesh(new T.ShapeGeometry(backG), wallM); bw.position.set(0, 0, Z1); bw.rotation.y = Math.PI; s.add(bw);
  // 나무 박공 천장 + 짙은 들보
  const roofLen = Math.hypot(HX, RIDGE - WALL), ang = Math.atan2(RIDGE - WALL, HX);
  const roofTex = woodTex("#a7774c", [2, 8]); roofTex.rotation = Math.PI / 2;
  const roofM = new T.MeshStandardMaterial({ map: roofTex, roughness: 0.85 });
  for (const sg of [-1, 1]) {
    const r = new T.Mesh(new T.PlaneGeometry(roofLen, Z1 - Z0), roofM);
    r.position.set(sg * HX / 2, (WALL + RIDGE) / 2, (Z0 + Z1) / 2);
    r.rotation.order = "ZXY"; r.rotation.set(Math.PI / 2, 0, -sg * ang); s.add(r);
  }
  const beamM = M("#4a2f1e", 0.7);
  for (let z = Z0 + 1.5; z < Z1; z += 2.6) {
    for (const sg of [-1, 1]) {
      const b = box(s, roofLen, 0.3, 0.26, beamM, sg * HX / 2, (WALL + RIDGE) / 2 - 0.2, z, { cast: false });
      b.rotation.z = -sg * ang;
      box(s, 0.32, WALL, 0.3, beamM, sg * (HX - 0.16), WALL / 2, z, { cast: false });
      const spot = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 0.22, 10), M("#222", 0.5)); spot.position.set(sg * 3.4, WALL + (RIDGE - WALL) * (1 - 3.4 / HX) - 0.45, z); s.add(spot);
      const glow = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), M("#fff7dd", 0.3, { emissive: "#fff2c4", emissiveIntensity: 1 })); glow.position.copy(spot.position).add(new T.Vector3(0, -0.13, 0)); s.add(glow);
    }
    box(s, 9.5, 0.22, 0.2, beamM, 0, 7.3, z, { cast: false });
  }
  box(s, 0.3, 0.35, Z1 - Z0, beamM, 0, RIDGE - 0.2, (Z0 + Z1) / 2, { cast: false });
  // 옆벽 창문 (밝은 간유리)
  const win = M("#fffaf0", 0.4, { emissive: "#fff3d6", emissiveIntensity: 0.55 });
  for (let z = Z0 + 2.8; z < Z1 - 1; z += 2.6) for (const sg of [-1, 1]) box(s, 0.05, 2.2, 0.9, win, sg * (HX - 0.03), 2.5, z, { cast: false });
  // 강단 (무대)
  const stageM = new T.MeshStandardMaterial({ map: woodTex("#9b6b42", [4, 1]), roughness: 0.8 });
  box(s, HX * 2, 0.6, 4.2, stageM, 0, 0.3, Z0 + 2.1);
  box(s, 4, 0.3, 0.6, stageM, 0, 0.15, Z0 + 4.5);
  box(s, 18, 0.02, 4.0, M("#8e2a29", 0.95), 0, 0.611, Z0 + 2.0, { cast: false });
  // 검은 십자가
  const crossM = M("#1f1b18", 0.5);
  box(s, 0.34, 2.8, 0.16, crossM, 0, 4.4, Z0 + 0.1);
  box(s, 1.7, 0.34, 0.16, crossM, 0, 5.0, Z0 + 0.1);
  const halo = new T.Mesh(new T.CircleGeometry(2.3, 40), new T.MeshBasicMaterial({ color: "#fff3d0", transparent: true, opacity: 0.4 })); halo.position.set(0, 4.6, Z0 + 0.02); s.add(halo);
  // 강대상
  const pul = new T.Group(); pul.position.set(0, 0.6, Z0 + 3.2); s.add(pul);
  box(pul, 1.3, 1.15, 0.75, M("#9a6a40", 0.7), 0, 0.58, 0);
  box(pul, 1.45, 0.08, 0.9, M("#b9875a", 0.6), 0, 1.18, 0);
  box(pul, 0.08, 0.5, 0.02, M("#e6c88a", 0.5), 0, 0.6, 0.38, { cast: false });
  box(pul, 0.32, 0.08, 0.02, M("#e6c88a", 0.5), 0, 0.7, 0.38, { cast: false });
  // 피아노
  const pia = new T.Group(); pia.position.set(-6.2, 0.6, Z0 + 2.2); pia.rotation.y = 0.5; s.add(pia);
  box(pia, 1.6, 1.1, 0.7, M("#151515", 0.25), 0, 0.55, 0); box(pia, 1.5, 0.05, 0.3, M("#f4f4f4", 0.4), 0, 0.78, 0.45);
  // 성찬상 + 꽃
  box(s, 2.4, 0.85, 0.9, M("#8f5f38", 0.7), 0, 0.43, -8.3);
  box(s, 2.5, 0.04, 1.0, M("#fbf8f0", 0.6), 0, 0.87, -8.3);
  const flower = (x, z, y = 0.6) => {
    cyl(s, 0.22, 0.17, 0.35, M("#c7b08a"), x, y + 0.18, z, 10);
    for (let k = 0; k < 7; k++) { const f = new T.Mesh(new T.SphereGeometry(0.15, 8, 6), M(k % 3 ? "#d8323a" : "#3f7d3a", 0.8)); f.position.set(x + Math.cos(k) * 0.18, y + 0.5 + (k % 2) * 0.12, z + Math.sin(k) * 0.18); s.add(f); }
  };
  [-7.5, -4.5, -2.2, 2.2, 4.5, 7.5].forEach((x) => flower(x, Z0 + 3.85));
  obs.push([-HX, Z0, HX, Z0 + 4.25], [-1.25, -8.8, 1.25, -7.8]);
  // 장의자
  const pewWood = M("#9b6337", 0.65), pewDark = M("#7a4a28", 0.7);
  const ROWS = 9, PEW = 6;
  for (let r = 0; r < ROWS; r++) {
    const zc = -6.4 + r * 1.6;
    for (const side of ["L", "R"]) {
      const x0 = side === "L" ? -7.9 : 1.25, x1 = side === "L" ? -1.25 : 7.9, cx = (x0 + x1) / 2, w = x1 - x0;
      const g = new T.Group(); g.position.set(cx, 0, zc); s.add(g);
      box(g, w, 0.08, 0.46, pewWood, 0, 0.45, -0.02);
      box(g, w, 0.62, 0.07, pewWood, 0, 0.78, 0.24);
      box(g, w + 0.06, 0.07, 0.12, pewDark, 0, 1.11, 0.24);
      box(g, w, 0.4, 0.05, pewDark, 0, 0.22, 0.2);
      for (const ex of [-w / 2, w / 2]) box(g, 0.08, 1.08, 0.58, pewDark, ex, 0.54, 0.02);
      const ids = [];
      for (let i = 0; i < PEW; i++) {
        const id = `P${side}${r}-${i}`, sx = x0 + (i + 0.5) * w / PEW;
        seats[id] = { x: sx, z: zc - 0.02, rot: Math.PI, h: 0.49, ax: sx, az: zc - 0.8 };
        ids.push(id);
      }
      seatGroupMark(g, ids); clickables.push(g);
      obs.push([x0 - 0.05, zc - 0.28, x1 + 0.05, zc + 0.3]);
    }
  }
  /* 크리스마스: 강단 옆 트리, 벽 따라 전구 줄, 십자가 위 현수막, 강단 포인세티아 (촛불 없음) */
  const tw = [];
  let deco = decoBegin(s);
  const wt = makeXmasTree(3.0, tw); wt.position.set(7.3, 0.6, Z0 + 1.6); s.add(wt);
  const wt2 = makeXmasTree(2.7, tw); wt2.position.set(-7.95, 0.6, Z0 + 0.95); s.add(wt2);
  for (const sg of [-1, 1]) { const run = []; for (let z = Z0 + 1.5; z <= Z1 - 1; z += 2.6) run.push([sg * (HX - 0.12), 4.05, z]); lightRun(s, tw, run, 8, 0.28); }
  const banner = new T.Mesh(new T.PlaneGeometry(5.6, 0.9), new T.MeshBasicMaterial({ map: textTex([["기쁘다 구주 오셨네", 64, 72, "#fff6dc"]], { w: 700, h: 140, bg: "#7a1f22", border: "#e2c06a" }) }));
  banner.position.set(0, 7.0, Z0 + 0.04); s.add(banner);
  lightString(s, tw, [-2.9, 7.5, Z0 + 0.08], [2.9, 7.5, Z0 + 0.08], 16, 0.12);
  for (const x of [-5.6, -3.4, 3.4, 5.6]) {
    const pt = new T.Group(); pt.position.set(x, 0.6, Z0 + 4.0); s.add(pt);
    cyl(pt, 0.16, 0.12, 0.26, M("#c9a24a", 0.4, { metalness: 0.4 }), 0, 0.13, 0, 12);
    for (let k = 0; k < 8; k++) { const l = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), M(k < 6 ? "#d42a2a" : "#2f7a3a", 0.7)); l.scale.set(1.3, 0.35, 0.7); const a = k * 0.8; l.position.set(Math.cos(a) * 0.15, 0.33 + (k % 2) * 0.05, Math.sin(a) * 0.15); l.rotation.y = -a; pt.add(l); }
  }
  for (const sg of [-1, 1]) { const w = makeWreath(0.4); w.position.set(sg * (HX - 0.04), 3.0, Z1 - 3.0); w.rotation.y = -sg * Math.PI / 2; s.add(w); }
  decoEnd(s, deco, "christmas");
  // 🌳 감사 나무 (뒤쪽 왼쪽): 기도 응답 이야기마다 열매가 달려요
  const thanks = makeThanksTree(); thanks.position.set(-7.2, 0, 9.9); s.add(thanks);
  thanks.traverse((o) => (o.userData.action = "thanks")); clickables.push(thanks);
  obs.push([-8.2, 8.9, -6.2, 10.9]);
  labels.push({ x: -7.2, y: 3.75, z: 9.9, html: "🌳 감사 나무 · 응답 나눔", action: "thanks" });
  /* 부활절 · 새해 · 여름 수련회 장식 */
  deco = decoBegin(s);
  for (const x of [-7.2, -5.2, -3.2, 3.2, 5.2, 7.2]) { const l = makeLily(1.1); l.position.set(x, 0.6, Z0 + 3.9); s.add(l); }
  banner3D(s, "주님이 다시 사셨네 · 할렐루야", 5.8, 0.9, "#f6f1e2", 0, 7.0, Z0 + 0.04, 0, "#7a5a14", 56);
  decoEnd(s, deco, "easter");
  deco = decoBegin(s);
  banner3D(s, `${seasonYear()} 새해에도 주님과 함께 ✨`, 5.8, 0.9, "#1f3b6b", 0, 7.0, Z0 + 0.04, 0, "#fff6dc", 54);
  decoEnd(s, deco, "newyear");
  deco = decoBegin(s);
  banner3D(s, "그루터기 여름 수련회 · 주님과 함께 걷는 여름", 6.4, 0.9, "#2a7f8f", 0, 7.0, Z0 + 0.04, 0, "#ffffff", 50);
  decoEnd(s, deco, "summer");

  // 뒷문
  const door = new T.Group(); s.add(door);
  box(door, 2.6, 2.8, 0.14, M("#6b4528", 0.6), 0, 1.4, Z1 - 0.06);
  for (const dx of [-0.62, 0.62]) box(door, 1.12, 2.55, 0.16, M("#8a5a34", 0.6), dx, 1.3, Z1 - 0.07);
  doorMark(door, "yard"); clickables.push(door);
  doors.push({ x: 0, z: Z1 - 0.9, to: "yard" });
  labels.push({ x: 0, y: 3.2, z: Z1 - 0.2, html: "🚪 마당으로", to: "yard" });
  const wallHide = [{ g: door, nx: 0, nz: -1, d: -Z1 }];
  return { scene: s, seats, obs, clickables, doors, labels, wallHide, tw, thanks, bounds: { x0: -HX, x1: HX, z0: Z0, z1: Z1 }, cell: 0.25, pad: 0.22,
    cam: { pitch: 0.26, dist: 10, min: 3.5, max: 18, lookY: 2.4, inside: { hx: HX - 0.5, z0: Z0 + 0.6, z1: Z1 - 0.4, wall: WALL, ridge: RIDGE } },
    spawn: { def: { x: 0, z: Z1 - 1.7 } }, spread: { def: [1.6, 0.7] } };
}

/* ===== 성경 읽는 공간 (내부, 북카페 모양) ===== */
function buildCafe() {
  const s = new T.Scene();
  s.background = new T.Color("#4a3d33");
  addLights(s, { sky: "#ffffff", ground: "#9a8670", hemi: 0.85, sunI: 0.45, sunPos: [4, 14, 6], ext: 13, amb: 0.18 });
  const seats = {}, obs = [], clickables = [], doors = [], labels = [], wallHide = [];
  const HX = 9, HZ = 8, CH = 3.2;
  plane(s, HX * 2, HZ * 2, new T.MeshStandardMaterial({ map: woodTex("#d9b98f", [5, 8]), roughness: 0.8 }), 0, 0, 0, -Math.PI / 2);
  plane(s, 300, 300, M("#6e5a48", 1), 0, -0.03, 0, -Math.PI / 2);
  const wallM = new T.MeshStandardMaterial({ color: "#ecebe6", roughness: 0.95 });
  const mkWall = (w, x, z, ry, nx, nz) => { const g = new T.Group(); s.add(g); plane(g, w, CH, wallM, x, CH / 2, z, 0, ry); wallHide.push({ g, nx, nz, d: nx * x + nz * z }); return g; };
  const wBack = mkWall(HX * 2, 0, -HZ, 0, 0, 1);
  const wLeft = mkWall(HZ * 2, -HX, 0, Math.PI / 2, 1, 0);
  const wRight = mkWall(HZ * 2, HX, 0, -Math.PI / 2, -1, 0);
  const wFront = mkWall(HX * 2, 0, HZ, Math.PI, 0, -1);
  // 천장 (카메라가 아래로 내려오면 보임)
  const ceil = new T.Group(); s.add(ceil);
  plane(ceil, HX * 2, HZ * 2, new T.MeshStandardMaterial({ map: ceilingTex([12, 10]), roughness: 1 }), 0, CH, 0, Math.PI / 2);
  for (let x = -7.5; x <= 7.5; x += 2.5) for (let z = -6.5; z <= 6.5; z += 2.6) { const l = new T.Mesh(new T.CircleGeometry(0.14, 16), new T.MeshBasicMaterial({ color: "#fffbe8" })); l.position.set(x, CH - 0.01, z); l.rotation.x = Math.PI / 2; ceil.add(l); }
  const fans = [];
  for (const [fx, fz] of [[-3.5, -2], [2, -4]]) {
    const f = new T.Group(); f.position.set(fx, CH - 0.45, fz); ceil.add(f);
    cyl(f, 0.03, 0.03, 0.4, M("#6b5a4a"), 0, 0.2, 0, 6); cyl(f, 0.16, 0.16, 0.12, M("#6b5a4a"), 0, 0, 0, 12);
    for (let k = 0; k < 5; k++) { const b = box(f, 0.9, 0.02, 0.16, M("#5b4636", 0.6), 0.5, 0, 0, { cast: false }); const p = new T.Group(); p.rotation.y = k * Math.PI * 2 / 5; p.add(b); f.add(p); }
    fans.push(f);
  }
  // 책장 (뒤쪽 + 왼쪽 벽)
  const shelfM = M("#d4a774", 0.7);
  const bookGeo = new T.BoxGeometry(1, 1, 1);
  const bookCols = ["#e8e2d4", "#cfd8e3", "#d9c7a4", "#9fb7c9", "#c98b6b", "#7d9a7a", "#e4d1a0", "#b9a3c4", "#f1ece1", "#6f8aa8", "#c45a4a", "#d8b46a"];
  const books = []; // [x, y, z, w, h, d]
  const shelfRun = (g, x0, x1, z, ry, along) => {
    // along: 'x' (뒷벽) | 'z' (옆벽)
    const len = x1 - x0, units = Math.round(len / 1.05);
    for (let u = 0; u < units; u++) {
      const c = x0 + (u + 0.5) * (len / units), uw = len / units;
      const px = along === "x" ? c : z, pz = along === "x" ? z : c;
      const sg = box(g, along === "x" ? uw - 0.04 : 0.42, 2.5, along === "x" ? 0.42 : uw - 0.04, shelfM, px, 1.25, pz);
      sg.material = shelfM;
      for (let lv = 0; lv < 5; lv++) {
        const y0 = 0.12 + lv * 0.48;
        let p = -uw / 2 + 0.06;
        while (p < uw / 2 - 0.1) {
          const bw = 0.04 + rnd() * 0.05, bh = 0.26 + rnd() * 0.14;
          if (rnd() < 0.06) { p += 0.08; continue; }
          books.push(along === "x" ? [c + p + bw / 2, y0 + bh / 2 + 0.02, z + (z < 0 ? 0.12 : -0.12), bw, bh, 0.22] : [z + (z < 0 ? 0.12 : -0.12), y0 + bh / 2 + 0.02, c + p + bw / 2, 0.22, bh, bw]);
          p += bw + 0.004;
        }
      }
    }
  };
  shelfRun(wBack, -8.8, 3.2, -HZ + 0.22, 0, "x");
  shelfRun(wLeft, -6.0, 5.6, -HX + 0.22, 0, "z");
  // 칸막이 판(가로 선반) — 책 앞에서 보이도록 얇은 판
  for (let lv = 0; lv <= 5; lv++) {
    box(wBack, 12.0, 0.04, 0.44, shelfM, -2.8, 0.1 + lv * 0.48, -HZ + 0.24, { cast: false });
    box(wLeft, 0.44, 0.04, 11.6, shelfM, -HX + 0.24, 0.1 + lv * 0.48, -0.2, { cast: false });
  }
  // 책장 몸체 박스가 책을 가리지 않도록 몸체는 뒤쪽 얇은 판으로 교체
  wBack.children.concat(wLeft.children).forEach((m) => { if (m.geometry && m.geometry.parameters && m.geometry.parameters.height === 2.5) { const p = m.geometry.parameters; if (p.depth === 0.42) { m.scale.z = 0.12; m.position.z = -HZ + 0.03; } else { m.scale.x = 0.12; m.position.x = -HX + 0.03; } } });
  const inst = new T.InstancedMesh(bookGeo, new T.MeshStandardMaterial({ roughness: 0.8 }), books.length);
  const mtx = new T.Matrix4(), col = new T.Color();
  books.forEach((b, i) => { mtx.compose(new T.Vector3(b[0], b[1], b[2]), new T.Quaternion(), new T.Vector3(b[3], b[4], b[5])); inst.setMatrixAt(i, mtx); inst.setColorAt(i, col.set(bookCols[(i * 7 + (i >> 3)) % bookCols.length])); });
  inst.castShadow = false; inst.receiveShadow = true;
  const instBack = inst; s.add(instBack);
  obs.push([-8.9, -HZ, 3.3, -HZ + 0.5], [-HX, -6.1, -HX + 0.5, 5.7]);
  // 긴 책상 + 흰 의자
  const topM = M("#e8dcc8", 0.6), legM = M("#d9c3a0", 0.6), chairM = M("#f4f4f2", 0.5);
  const tables = [[-4.6, -4.6], [-4.6, -1.4], [-4.6, 1.8], [0.4, -4.6], [0.4, -1.4]];
  tables.forEach(([tx, tz], t) => {
    const g = new T.Group(); g.position.set(tx, 0, tz); s.add(g);
    box(g, 3.2, 0.06, 0.95, topM, 0, 0.76, 0);
    for (const lx of [-1.45, 1.45]) for (const lz of [-0.38, 0.38]) box(g, 0.07, 0.74, 0.07, legM, lx, 0.37, lz);
    obs.push([tx - 1.65, tz - 0.5, tx + 1.65, tz + 0.5]);
    [-1, 0, 1].forEach((cxo, ci) => {
      for (const sd of [-1, 1]) {
        const cx = tx + cxo, cz = tz + sd * 0.78, rot = sd < 0 ? 0 : Math.PI;
        const ch = new T.Group(); ch.position.set(cx, 0, cz); ch.rotation.y = rot; s.add(ch);
        box(ch, 0.44, 0.05, 0.42, chairM, 0, 0.45, 0);
        box(ch, 0.44, 0.42, 0.05, chairM, 0, 0.7, -0.2);
        for (const lx of [-0.19, 0.19]) for (const lz of [-0.18, 0.18]) box(ch, 0.035, 0.45, 0.035, M("#cfcfcf", 0.4), lx, 0.22, lz);
        const id = `T${t}-${ci * 2 + (sd < 0 ? 0 : 1)}`;
        seats[id] = { x: cx, z: cz, rot, h: 0.47, ax: cx, az: cz + sd * 0.62 };
        seatGroupMark(ch, [id]); clickables.push(ch);
      }
    });
  });
  // 라운지: 회색 소파 + 암체어 + 원목 테이블 + 꽃
  const sofaM = M("#9aa3ad", 0.95), sofaD = M("#86909b", 0.95);
  const sofa = new T.Group(); sofa.position.set(3.4, 0, 5.6); sofa.rotation.y = Math.PI; s.add(sofa);
  box(sofa, 3.0, 0.4, 0.9, sofaM, 0, 0.22, 0); box(sofa, 3.0, 0.55, 0.22, sofaD, 0, 0.62, -0.38); for (const ax of [-1.45, 1.45]) box(sofa, 0.22, 0.6, 0.9, sofaD, ax, 0.3, 0);
  for (const cx of [-0.95, 0, 0.95]) box(sofa, 0.9, 0.12, 0.7, sofaM, cx, 0.47, 0.05);
  const pil = new T.Mesh(new T.BoxGeometry(0.5, 0.42, 0.14), M("#f3f1ec")); pil.position.set(-0.8, 0.72, -0.2); pil.rotation.z = 0.2; sofa.add(pil);
  const sofaIds = [];
  [-0.95, 0, 0.95].forEach((o, i) => { const id = `S-${i}`, x = 3.4 - o; seats[id] = { x, z: 5.55, rot: Math.PI, h: 0.5, ax: x, az: 4.75 }; sofaIds.push(id); });
  seatGroupMark(sofa, sofaIds); clickables.push(sofa);
  obs.push([1.85, 5.1, 4.95, 6.1]);
  [[1.0, 3.7, Math.PI / 2, "A-0", 1.75], [5.8, 3.7, -Math.PI / 2, "A-1", 5.05]].forEach(([x, z, ry, id, ax]) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g);
    const am = M("#6f747a", 0.95);
    box(g, 0.9, 0.42, 0.85, am, 0, 0.22, 0); box(g, 0.9, 0.6, 0.2, am, 0, 0.62, -0.34); for (const ex of [-0.42, 0.42]) box(g, 0.16, 0.55, 0.85, am, ex, 0.3, 0);
    seats[id] = { x, z, rot: ry, h: 0.48, ax, az: z };
    seatGroupMark(g, [id]); clickables.push(g);
    obs.push([x - 0.45, z - 0.45, x + 0.45, z + 0.45]);
  });
  box(s, 1.8, 0.42, 1.0, M("#a8977e", 0.8), 3.4, 0.21, 3.7);
  cyl(s, 0.09, 0.07, 0.2, M("#e8eef0", 0.2, { transparent: true, opacity: 0.7 }), 3.2, 0.52, 3.6, 10);
  for (let k = 0; k < 9; k++) { const f = new T.Mesh(new T.SphereGeometry(0.05, 6, 5), M(["#e8c45a", "#f2efe6", "#c9a0d0"][k % 3])); f.position.set(3.2 + Math.cos(k) * 0.12, 0.72 + (k % 3) * 0.05, 3.6 + Math.sin(k) * 0.12); s.add(f); }
  box(s, 0.25, 0.14, 0.14, M("#2a2a2a"), 3.75, 0.49, 3.8);
  obs.push([2.45, 3.15, 4.35, 4.25]);
  // 카페 카운터 (오른쪽)
  const ctr = new T.Group(); s.add(ctr);
  box(ctr, 0.9, 1.05, 8.5, M("#f4f1ea", 0.7), 7.6, 0.53, -3.2);
  box(ctr, 1.0, 0.06, 8.6, M("#9b6b42", 0.6), 7.6, 1.08, -3.2);
  for (let k = 0; k < 4; k++) box(ctr, 0.45, 0.6, 0.4, M(k % 2 ? "#2a2a2a" : "#c0c4c8", 0.35, { metalness: 0.4 }), 7.7, 1.41, -6.4 + k * 0.6);
  const snack = ["#e45b4a", "#f2c84b", "#4a8ad8", "#7ac46a", "#f08a3c", "#c45ad0"];
  for (let k = 0; k < 18; k++) box(ctr, 0.22, 0.18 + rnd() * 0.12, 0.2, M(snack[k % 6], 0.7), 7.4 + (k % 2) * 0.3, 1.2, -2.6 + Math.floor(k / 2) * 0.32);
  const menuTex = textTex([["MENU", 54, 40], ["아메리카노 · 라떼", 30, 105], ["유자차 · 레몬에이드", 30, 150], ["생과일 주스", 30, 195]], { w: 512, h: 256, bg: "#1d4f9c" });
  const juiceTex = textTex([["FRUIT JUICE", 50, 90], ["🍊 🍓 🍍", 60, 175]], { w: 512, h: 256, bg: "#2b63b8" });
  for (const [z, tx] of [[-5.6, menuTex], [-3.7, juiceTex]]) { const m = new T.Mesh(new T.PlaneGeometry(1.7, 0.9), new T.MeshBasicMaterial({ map: tx })); m.position.set(HX - 0.03, 2.2, z); m.rotation.y = -Math.PI / 2; wRight.add(m); }
  box(ctr, 0.9, 0.85, 1.9, M("#f6f8fa", 0.4), 6.2, 0.43, 0.6);
  box(ctr, 0.8, 0.04, 1.8, M("#bfe3ff", 0.2, { emissive: "#6fb8ff", emissiveIntensity: 0.6 }), 6.2, 0.87, 0.6, { cast: false });
  box(ctr, 0.7, 1.9, 0.7, M("#e9edf0", 0.3), 8.4, 0.95, 1.6);
  box(ctr, 0.02, 1.6, 0.55, M("#cfe8ff", 0.1, { emissive: "#9ad0ff", emissiveIntensity: 0.35 }), 8.04, 1.0, 1.6, { cast: false });
  obs.push([7.1, -7.5, HX, 1.1], [5.7, -0.4, 6.7, 1.6], [8.0, 1.2, HX, 2.0]);
  ctr.traverse((m) => (m.userData.action = "cafeShelf")); clickables.push(ctr);
  labels.push({ x: 7.4, y: 2.25, z: -1.6, html: "🍜 간식 선반 · 카운터", action: "cafeShelf" });
  // 화분
  for (const [x, z] of [[-8.3, -7.3], [-8.3, 6.8], [8.2, 7.2], [3.8, -7.4]]) {
    cyl(s, 0.28, 0.22, 0.5, M("#e9e4da"), x, 0.25, z, 12);
    for (let k = 0; k < 4; k++) { const l = new T.Mesh(new T.IcosahedronGeometry(0.35, 1), M("#4e8a4a", 0.9)); l.position.set(x + (k % 2 - 0.5) * 0.25, 0.8 + k * 0.22, z + (k > 1 ? 0.12 : -0.12)); l.castShadow = true; s.add(l); }
    obs.push([x - 0.35, z - 0.35, x + 0.35, z + 0.35]);
  }
  // 펜던트 조명 (라운지 위)
  const pend = new T.Group(); pend.position.set(3.4, CH, 3.7); ceil.add(pend);
  cyl(pend, 0.01, 0.01, 1.1, M("#222"), 0, -0.55, 0, 4);
  const shade = new T.Mesh(new T.ConeGeometry(0.42, 0.32, 20, 1, true), M("#2e3a40", 0.5, { side: T.DoubleSide })); shade.position.y = -1.2; pend.add(shade);
  const bulb = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), M("#fff", 0.2, { emissive: "#fff2c0", emissiveIntensity: 1 })); bulb.position.y = -1.3; pend.add(bulb);
  // 문
  const door = new T.Group(); wFront.add(door);
  box(door, 1.9, 2.4, 0.1, M("#5a4636", 0.5), -6, 1.2, HZ - 0.05);
  box(door, 1.4, 2.1, 0.12, M("#e9d9b8", 0.4, { emissive: "#7a5a2a", emissiveIntensity: 0.25 }), -6, 1.1, HZ - 0.06);
  doorMark(door, "yard"); clickables.push(door);
  doors.push({ x: -6, z: HZ - 0.8, to: "yard" });
  labels.push({ x: -6, y: 2.9, z: HZ - 0.2, html: "🚪 마당으로", to: "yard" });
  // 러그
  box(s, 5.6, 0.015, 3.6, M("#c9b9a2", 1), 3.4, 0.01, 4.4, { cast: false });
  /* 크리스마스: 라운지 옆 트리, 책장 위 전구 줄, 문 리스 */
  const tw = [];
  const deco = decoBegin(s);
  const ct = makeXmasTree(2.5, tw); ct.position.set(7.0, 0, 4.9); s.add(ct);
  obs.push([6.1, 4.0, 7.9, 5.8]);
  lightRun(wBack, tw, [[-8.8, 2.62, -HZ + 0.3], [-5.8, 2.62, -HZ + 0.3], [-2.8, 2.62, -HZ + 0.3], [0.2, 2.62, -HZ + 0.3], [3.2, 2.62, -HZ + 0.3]], 9, 0.12);
  lightRun(wLeft, tw, [[-HX + 0.3, 2.62, -6], [-HX + 0.3, 2.62, -3], [-HX + 0.3, 2.62, 0], [-HX + 0.3, 2.62, 3], [-HX + 0.3, 2.62, 5.6]], 9, 0.12);
  const cw = makeWreath(0.3); cw.position.set(-6, 2.6, HZ - 0.08); cw.rotation.y = Math.PI; wFront.add(cw);
  decoEnd(s, deco, "christmas");
  return { scene: s, seats, obs, clickables, doors, labels, wallHide, ceil, fans, books: instBack, tw,
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ }, cell: 0.25, pad: 0.22,
    cam: { pitch: 0.82, dist: 11, min: 4, max: 18 }, spawn: { def: { x: -5, z: HZ - 2.4 } }, spread: { def: [1.4, 0.8] } };
}

/* ---------------- 실내 공용 도우미 (비전 / 301호) ---------------- */
// 블록 벽 (페인트 칠한 시멘트 블록)
function blockTex(color, rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(0,0,0,.13)"; g.lineWidth = 3;
    const bh = 32, bw = 128;
    for (let r = 0; r < h / bh; r++) {
      g.beginPath(); g.moveTo(0, r * bh); g.lineTo(w, r * bh); g.stroke();
      for (let x = (r % 2) * bw / 2; x < w; x += bw) { g.beginPath(); g.moveTo(x, r * bh); g.lineTo(x, r * bh + bh); g.stroke(); }
    }
  }, rep);
}
function blindTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = "#c99a5e"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 9) { g.fillStyle = "rgba(255,240,210,.35)"; g.fillRect(0, y, w, 3); g.fillStyle = "rgba(90,60,30,.35)"; g.fillRect(0, y + 7, w, 2); }
  });
}
// 사방 벽 + 바닥 + 천장(석고 타일, 형광등). 카메라 쪽 벽은 자동으로 숨겨요.
function roomShell(s, o) {
  const { HX, HZ, CH } = o, wallHide = [];
  plane(s, HX * 2, HZ * 2, new T.MeshStandardMaterial({ map: o.floorTex, roughness: 0.8 }), 0, 0, 0, -Math.PI / 2);
  plane(s, 300, 300, M("#5e5048", 1), 0, -0.03, 0, -Math.PI / 2);
  const mk = (w, mat, x, z, ry, nx, nz) => { const g = new T.Group(); s.add(g); plane(g, w, CH, mat, x, CH / 2, z, 0, ry); wallHide.push({ g, nx, nz, d: nx * x + nz * z }); return g; };
  const walls = {
    back: mk(HX * 2, o.back, 0, -HZ, 0, 0, 1),
    left: mk(HZ * 2, o.left, -HX, 0, Math.PI / 2, 1, 0),
    right: mk(HZ * 2, o.right, HX, 0, -Math.PI / 2, -1, 0),
    front: mk(HX * 2, o.front, 0, HZ, Math.PI, 0, -1),
  };
  // 걸레받이
  box(walls.back, HX * 2, 0.1, 0.03, M("#3a3330", 0.7), 0, 0.05, -HZ + 0.02, { cast: false });
  box(walls.left, 0.03, 0.1, HZ * 2, M("#3a3330", 0.7), -HX + 0.02, 0.05, 0, { cast: false });
  box(walls.right, 0.03, 0.1, HZ * 2, M("#3a3330", 0.7), HX - 0.02, 0.05, 0, { cast: false });
  const ceil = new T.Group(); s.add(ceil);
  plane(ceil, HX * 2, HZ * 2, new T.MeshStandardMaterial({ map: ceilingTex([HX * 1.6, HZ * 1.6]), roughness: 1 }), 0, CH, 0, Math.PI / 2);
  for (const [x, z, w, d] of o.lights) {
    const l = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: "#fbfdff" })); l.position.set(x, CH - 0.01, z); l.rotation.x = Math.PI / 2; ceil.add(l);
  }
  return { walls, wallHide, ceil };
}
// 원목 사다리 의자 (방향 rot: 앉았을 때 바라보는 쪽)
function ladderChair(s, x, z, rot, wood, seatCol) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; s.add(g);
  box(g, 0.44, 0.05, 0.42, seatCol || wood, 0, 0.45, 0);
  for (const lx of [-0.19, 0.19]) { box(g, 0.04, 0.45, 0.04, wood, lx, 0.22, 0.18); box(g, 0.04, 0.95, 0.04, wood, lx, 0.47, -0.19); }
  for (const y of [0.68, 0.8, 0.92]) box(g, 0.4, 0.05, 0.025, wood, 0, y, -0.19);
  return g;
}
// 테이블 + 둘레 의자. alongZ면 길이 방향이 앞뒤
function tableSet(s, seats, clickables, obs, id, cx, cz, len, wid, alongZ, topM, legM, chairs) {
  const g = new T.Group(); g.position.set(cx, 0, cz); if (alongZ) g.rotation.y = Math.PI / 2; s.add(g);
  box(g, len, 0.06, wid, topM, 0, 0.75, 0);
  for (const lx of [-len / 2 + 0.06, len / 2 - 0.06]) for (const lz of [-wid / 2 + 0.06, wid / 2 - 0.06]) box(g, 0.07, 0.73, 0.07, legM, lx, 0.365, lz);
  const hl = alongZ ? wid / 2 : len / 2, hd = alongZ ? len / 2 : wid / 2;
  obs.push([cx - hl - 0.05, cz - hd - 0.05, cx + hl + 0.05, cz + hd + 0.05]);
  chairs.forEach(([off, side, wood, seatCol], i) => {
    // side -1: 테이블 한쪽, +1: 반대쪽. off: 길이 방향 위치
    let x, z, rot;
    if (!alongZ) { x = cx + off; z = cz + side * (wid / 2 + 0.33); rot = side < 0 ? 0 : Math.PI; }
    else { x = cx + side * (wid / 2 + 0.33); z = cz + off; rot = side < 0 ? Math.PI / 2 : -Math.PI / 2; }
    const ch = ladderChair(s, x, z, rot, wood, seatCol);
    const sid = `${id}-${i}`, fx = Math.sin(rot), fz = Math.cos(rot);
    seats[sid] = { x, z, rot, h: 0.47, ax: x - fx * 0.62, az: z - fz * 0.62 };
    seatGroupMark(ch, [sid]); clickables.push(ch);
  });
}
// 긴 소파 (방향 rot: 앉았을 때 바라보는 쪽). lie: 누울 수 있는 소파
function sofaSet(s, seats, clickables, obs, id, cx, cz, rot, len, n, mat, darkMat, opt = {}) {
  const g = new T.Group(); g.position.set(cx, 0, cz); g.rotation.y = rot; s.add(g);
  const d = opt.depth || 0.88, sh = opt.seatH || 0.44;
  box(g, len, sh - 0.12, d, mat, 0, (sh - 0.12) / 2 + 0.1, 0);
  box(g, len, 0.12, d - 0.2, mat, 0, sh - 0.06, 0.08);
  const back = box(g, len, 0.6, 0.2, darkMat || mat, 0, sh + 0.25, -d / 2 + 0.12); back.rotation.x = opt.recline ? -0.18 : 0;
  if (opt.arms) for (const ax of [-len / 2 + 0.1, len / 2 - 0.1]) box(g, 0.2, 0.62, d, darkMat || mat, ax, 0.31, 0);
  if (opt.tufts) for (let i = 0; i < Math.floor(len / 0.18); i++) for (const y of [sh + 0.12, sh + 0.32]) { const b = new T.Mesh(new T.SphereGeometry(0.018, 6, 4), M("#0c0c0c", 0.4)); b.position.set(-len / 2 + 0.15 + i * 0.18 + (y > sh + 0.2 ? 0.09 : 0), y, -d / 2 + 0.235); g.add(b); }
  if (opt.lines) for (let i = 1; i < 3; i++) box(g, len - 0.04, 0.012, 0.012, darkMat, 0, sh + 0.05 + i * 0.17, -d / 2 + 0.225, { cast: false });
  for (const lx of [-len / 2 + 0.12, len / 2 - 0.12]) for (const lz of [-d / 2 + 0.1, d / 2 - 0.1]) box(g, 0.05, 0.12, 0.05, M("#1a1a1a", 0.4), lx, 0.05, lz, { cast: false });
  const ids = [], fx = Math.sin(rot), fz = Math.cos(rot), lx = Math.cos(rot), lz = -Math.sin(rot);
  const usable = len - (opt.arms ? 0.4 : 0.1);
  for (let i = 0; i < n; i++) {
    const o = -usable / 2 + (i + 0.5) * usable / n, sid = `${id}-${i}`;
    const x = cx + lx * o + fx * 0.06, z = cz + lz * o + fz * 0.06;
    seats[sid] = { x, z, rot, h: sh, ax: x + fx * 0.8, az: z + fz * 0.8 };
    if (opt.lie) seats[sid].lie = { x: cx + fx * 0.08, z: cz + fz * 0.08, rot, h: sh, len: usable };
    ids.push(sid);
  }
  seatGroupMark(g, ids); clickables.push(g);
  const hw = Math.abs(lx) * len / 2 + Math.abs(fx) * d / 2, hd = Math.abs(lz) * len / 2 + Math.abs(fz) * d / 2;
  obs.push([cx - hw, cz - hd, cx + hw, cz + hd]);
  return g;
}
function addDoor(wallGroup, x, z, ry, labels, doors, clickables, color) {
  const door = new T.Group(); wallGroup.add(door);
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; door.add(g);
  box(g, 1.3, 2.3, 0.08, M(color || "#7a5a3c", 0.6), 0, 1.15, 0);
  box(g, 0.06, 0.06, 0.1, M("#c9c2b0", 0.3, { metalness: 0.6 }), 0.5, 1.05, 0.05, { cast: false });
  doorMark(door, "yard"); clickables.push(door);
  return door;
}

/* ===== 비전 (사진 참고: 블라인드 창 5개, 초록 블록 벽, 원목 테이블, 벤치, 검은 가죽 소파, 큐브 선반) ===== */
function buildVision() {
  const s = new T.Scene();
  s.background = new T.Color("#3d3833");
  addLights(s, { sky: "#ffffff", ground: "#8a7058", hemi: 0.85, sunI: 0.5, sunPos: [-3, 12, -8], ext: 12, amb: 0.16, target: [0, 0, 0] });
  const seats = {}, obs = [], clickables = [], doors = [], labels = [];
  const HX = 7.5, HZ = 4.8, CH = 3.0;
  const white = new T.MeshStandardMaterial({ map: blockTex("#ecebe5", [5, 3]), roughness: 0.95 });
  const green = new T.MeshStandardMaterial({ map: blockTex("#1f4a3e", [3, 3]), roughness: 0.9 });
  const beige = new T.MeshStandardMaterial({ color: "#e4ded2", roughness: 0.95 });
  const { walls, wallHide, ceil } = roomShell(s, { HX, HZ, CH, floorTex: woodTex("#a5734a", [6, 4], true), back: white, left: green, right: beige, front: green,
    lights: [[-4.5, -1.5, 1.2, 0.6], [-1, 1, 1.2, 0.6], [2.5, -1.8, 1.2, 0.6], [5, 1.5, 1.2, 0.6], [-4.5, 2.6, 1.2, 0.6]] });
  // 창문 5개 (나무 블라인드)
  const bt = blindTex();
  for (const x of [-5.6, -3.3, -1.0, 1.3, 3.5]) {
    const w = walls.back;
    box(w, 1.6, 1.7, 0.06, M("#f3f1ea", 0.6), x, 1.75, -HZ + 0.03, { cast: false });
    box(w, 1.4, 0.5, 0.05, M("#40566a", 0.2, { emissive: "#9fb8cc", emissiveIntensity: 0.35 }), x, 1.15, -HZ + 0.06, { cast: false });
    box(w, 1.44, 1.05, 0.04, new T.MeshStandardMaterial({ map: bt, roughness: 0.8 }), x, 1.95, -HZ + 0.09, { cast: false });
    box(w, 1.5, 0.05, 0.12, M("#2a2a2a", 0.5), x, 0.9, -HZ + 0.07, { cast: false });
    box(w, 1.7, 0.06, 0.16, M("#ecebe5", 0.8), x, 0.86, -HZ + 0.08, { cast: false });
  }
  // 창가 벤치 (원목 + 빨강)
  const pine = M("#d4a565", 0.65), pineDark = M("#b9884c", 0.7), red = M("#d0302e", 0.55);
  [[-3.9, 1.8, pine, "VB0"], [-1.7, 1.4, red, "VB1"]].forEach(([x, len, mat, id]) => {
    const g = new T.Group(); g.position.set(x, 0, -HZ + 0.32); s.add(g);
    box(g, len, 0.05, 0.36, mat, 0, 0.42, 0);
    for (const lx of [-len / 2 + 0.1, len / 2 - 0.1]) box(g, 0.06, 0.4, 0.32, mat, lx, 0.2, 0);
    box(g, len - 0.2, 0.05, 0.05, mat, 0, 0.12, 0);
    const ids = [];
    for (const k of [-len / 4, len / 4]) { const sid = `${id}-${ids.length}`; seats[sid] = { x: x + k, z: -HZ + 0.32, rot: 0, h: 0.44, ax: x + k, az: -HZ + 1.0 }; ids.push(sid); }
    seatGroupMark(g, ids); clickables.push(g);
    obs.push([x - len / 2, -HZ, x + len / 2, -HZ + 0.52]);
  });
  // 검은 가죽 소파 (초록 벽 앞) + 빨간 사이드 테이블 + 노란 보드게임판
  sofaSet(s, seats, clickables, obs, "VS", -HX + 0.48, -1.3, Math.PI / 2, 2.3, 3, M("#1b1716", 0.35), M("#141110", 0.35), { arms: true, tufts: true, seatH: 0.46, lie: true });
  box(s, 0.55, 0.45, 0.55, red, -HX + 0.5, 0.23, 0.6);
  obs.push([-HX, 0.3, -HX + 0.8, 0.9]);
  const boardTex = canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = "#f2e23a"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffffff"; g.lineWidth = 26; g.lineCap = "round"; g.beginPath(); g.moveTo(30, 30);
    for (let r = 0; r < 5; r++) { const y = 40 + r * 60; g.lineTo(r % 2 ? 30 : 226, y); g.lineTo(r % 2 ? 30 : 226, y + 60); }
    g.stroke(); g.strokeStyle = "#3a7bd5"; g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 12; i++) { g.fillStyle = "#fff8b0"; g.font = "18px serif"; g.fillText("✦", rnd() * w, rnd() * h); }
  });
  void boardTex;
  // 🌱 4주 습관 챌린지 벽 게시판 (예전 노란 보드게임판 자리) — 누르면 내 습관을 정하고 체크해요
  const habitMat = new T.MeshBasicMaterial({ map: habitBoardTex(null) });
  box(walls.left, 0.05, 1.62, 2.12, M("#6b4a2a", 0.6), -HX + 0.03, 1.6, 1.7);
  const hb = new T.Mesh(new T.PlaneGeometry(2.0, 1.5), habitMat);
  hb.position.set(-HX + 0.07, 1.6, 1.7); hb.rotation.y = Math.PI / 2; walls.left.add(hb);
  hb.userData.action = "habit"; clickables.push(hb);
  labels.push({ x: -HX + 0.3, y: 2.6, z: 1.7, html: "🌱 4주 습관 챌린지", action: "habit" });
  // 원목 테이블들 + 사다리 의자, 진회색 테이블
  const dark = M("#3a3330", 0.5), darkSeat = M("#5a524c", 0.8), maroon = M("#5a2228", 0.6);
  tableSet(s, seats, clickables, obs, "VT0", -1.6, -1.9, 2.0, 0.9, false, pine, pineDark,
    [[-0.5, -1, pineDark], [0.5, -1, maroon], [-0.5, 1, pineDark], [0.5, 1, pineDark]]);
  tableSet(s, seats, clickables, obs, "VT1", 1.0, 1.0, 2.8, 0.95, true, pine, pineDark,
    [[-0.9, 1, pineDark, darkSeat], [0, 1, pineDark, darkSeat], [0.9, 1, pineDark, darkSeat], [-0.6, -1, pineDark], [0.6, -1, pineDark]]);
  tableSet(s, seats, clickables, obs, "VT2", 3.4, -1.9, 1.9, 0.9, false, M("#4a4542", 0.6), dark,
    [[-0.5, -1, dark, darkSeat], [0.5, -1, dark, darkSeat], [0, 1, dark, darkSeat]]);
  // 큐브 선반 + 흰 수납장 (오른쪽 벽)
  const kal = M("#c9b89c", 0.7);
  for (const zc of [-3.6, -2.0]) {
    const g = new T.Group(); g.position.set(HX - 0.22, 0, zc); walls.right.add(g);
    box(g, 0.4, 1.55, 1.55, kal, 0, 0.78, 0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      box(g, 0.02, 0.33, 0.33, M("#7a6a55", 0.9), -0.18, 0.2 + i * 0.37, -0.56 + j * 0.37, { cast: false });
      if (rnd() < 0.45) box(g, 0.28, 0.12 + rnd() * 0.15, 0.2, M(["#e8e2d4", "#c45a4a", "#f1f1f1", "#7d9a7a", "#3b3b3b"][(i + j) % 5], 0.7), -0.04, 0.12 + i * 0.37, -0.56 + j * 0.37, { cast: false });
    }
  }
  for (const zc of [-4.1, -3.15, -2.2, -1.25]) {
    box(walls.right, 0.38, 0.75, 0.92, M("#f6f6f3", 0.5), HX - 0.2, 2.45, zc);
    box(walls.right, 0.01, 0.1, 0.02, M("#b8b8b8", 0.3), HX - 0.4, 2.2, zc + 0.35, { cast: false });
  }
  box(walls.right, 0.4, 0.15, 0.6, M("#c9a46a", 0.8), HX - 0.25, 2.9, -3.6);
  obs.push([HX - 0.45, -4.4, HX, -1.2]);
  /* 크리스마스: 앞 왼쪽 구석 트리, 창 위 전구 줄, 초록 벽 리스 */
  const tw = [];
  const deco = decoBegin(s);
  const vt = makeXmasTree(2.5, tw); vt.position.set(-6.6, 0, 3.8); s.add(vt);
  obs.push([-7.5, 2.9, -5.7, 4.7]);
  const wrun = []; for (let x = -6.6; x <= 4.4; x += 2.2) wrun.push([x, 2.75, -HZ + 0.12]);
  lightRun(walls.back, tw, wrun, 9, 0.18);
  const vw = makeWreath(0.38); vw.position.set(-HX + 0.06, 1.95, -1.3); vw.rotation.y = Math.PI / 2; walls.left.add(vw);
  decoEnd(s, deco, "christmas");
  // 방명록 보드 (뒷벽 오른쪽, 창문 옆) — 누르면 방명록을 쓸 수 있어요
  const gbMat = new T.MeshStandardMaterial({ map: guestbookTex([], "비전"), roughness: 0.85 });
  const gb = new T.Mesh(new T.PlaneGeometry(2.4, 1.08), gbMat);
  gb.position.set(5.65, 1.8, -HZ + 0.03); walls.back.add(gb);
  gb.userData.action = "guestbook"; clickables.push(gb);
  labels.push({ x: 5.65, y: 2.55, z: -HZ + 0.2, html: "📝 방명록 쓰기", action: "guestbook" });
  // 🧩 성경 퀴즈 보드 (오른쪽 베이지 벽, 수납장 앞쪽) — 누르면 퀴즈를 풀어요
  const quizMat = addQuizBoard(walls.right, labels, clickables, HX - 0.03, 1.65, 1.6, -Math.PI / 2, 2.3);
  // 문 (앞쪽 벽)
  addDoor(walls.front, 4.6, HZ - 0.04, Math.PI, labels, doors, clickables);
  doors.push({ x: 4.6, z: HZ - 0.8, to: "yard" });
  labels.push({ x: 4.6, y: 2.7, z: HZ - 0.2, html: "🚪 마당으로", to: "yard" });
  return { scene: s, seats, obs, clickables, doors, labels, wallHide, ceil, gbMat, quizMat, habitMat, tw,
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ }, cell: 0.25, pad: 0.22, ceilY: CH,
    cam: { pitch: 0.8, dist: 12.5, min: 4, max: 20 }, spawn: { def: { x: 4.6, z: HZ - 1.4 } }, spread: { def: [1.2, 0.5] } };
}
// 🌱 습관 챌린지 게시판 그림: [{name, goal, emoji, n(체크 수), day, today, me}]
function habitBoardTex(rows) {
  return canvasTex(800, 600, (g, w, h) => {
    g.fillStyle = "#f4ead2"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(160,120,70,${0.05 + (i % 5) * 0.01})`; g.beginPath(); g.arc((i * 137) % w, (i * 71) % h, 2 + (i % 4), 0, 7); g.fill(); }
    g.fillStyle = "#4f7a4a"; g.fillRect(0, 0, w, 78);
    g.textAlign = "center"; g.fillStyle = "#fff"; g.font = "700 40px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("🌱 4주 습관 챌린지", w / 2, 54);
    const R = (rows || []).slice(0, 7);
    if (!rows) { g.fillStyle = "#6b5a3a"; g.font = "30px 'Gowun Dodum', sans-serif"; g.fillText("불러오는 중…", w / 2, 300); return; }
    if (!R.length) { g.fillStyle = "#6b5a3a"; g.font = "32px 'Gowun Dodum', sans-serif"; g.fillText("아직 아무도 없어요", w / 2, 260); g.font = "26px 'Gowun Dodum', sans-serif"; g.fillText("눌러서 첫 습관을 시작해요 · 28일 동안 함께!", w / 2, 310); return; }
    R.forEach((r, i) => {
      const y = 100 + i * 70;
      g.fillStyle = r.me ? "rgba(224,169,42,.22)" : i % 2 ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.6)"; g.fillRect(20, y, w - 40, 62);
      g.textAlign = "left"; g.fillStyle = "#3a2e22"; g.font = "34px sans-serif"; g.fillText(r.emoji || "🌱", 32, y + 44);
      g.font = "700 24px 'Gowun Dodum', sans-serif"; let nm = r.name || "익명"; if (nm.length > 6) nm = nm.slice(0, 6) + "…"; g.fillText(nm, 80, y + 26);
      g.font = "22px 'Gowun Dodum', sans-serif"; g.fillStyle = "#6b5a3a"; let gl = r.goal || ""; while (gl.length > 1 && g.measureText(gl).width > 260) gl = gl.slice(0, -1); g.fillText(gl, 80, y + 52);
      // 28칸 (4주)
      for (let k = 0; k < 28; k++) { const cx = 372 + (k % 14) * 22, cy = y + 10 + Math.floor(k / 14) * 24; g.fillStyle = k < r.n ? "#6fae55" : k <= r.day ? "#e6dcc4" : "#f2ecdc"; g.fillRect(cx, cy, 18, 18); }
      g.textAlign = "right"; g.fillStyle = r.today ? "#4f7a4a" : "#a08a64"; g.font = "700 22px 'Gowun Dodum', sans-serif"; g.fillText(r.today ? `✓ ${r.n}/28` : `${r.n}/28`, w - 30, y + 40);
    });
  });
}

/* ===== 301호 · 3Q (청년 1부 방: 갈색 소파 2개, 흰 테이블, 긴 책상, 방명록 벽) ===== */
function guestbookTex(list, title) {
  const W = 1024, H = 460;
  return canvasTex(W, H, (g) => {
    g.fillStyle = "#c79a62"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(120,80,40,.25)" : "rgba(240,210,160,.25)"; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    g.strokeStyle = "#7a5530"; g.lineWidth = 16; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = "#3d2a18"; g.font = "700 36px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.textAlign = "center";
    g.fillText(`📝 ${title || "301호"} 방명록 · 눌러서 한마디 남기기`, W / 2, 54);
    const cols = ["#fff3a0", "#ffd3dc", "#c9efd2", "#cfe2ff", "#ffe2b8"];
    const items = (list || []).slice(0, 10);
    if (!items.length) { g.font = "28px 'Gowun Dodum', sans-serif"; g.fillText("아직 아무도 안 썼어요. 첫 번째로 남겨볼까요?", W / 2, H / 2 + 20); }
    items.forEach((it, i) => {
      const cx = 110 + (i % 5) * 201, cy = 165 + Math.floor(i / 5) * 175;
      g.save(); g.translate(cx, cy); g.rotate(((it.id || i) * 37 % 9 - 4) * 0.012);
      g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(-78, -66, 164, 150);
      g.fillStyle = cols[Math.abs(it.id || i) % cols.length]; g.fillRect(-82, -72, 164, 150);
      g.fillStyle = "#d33"; g.beginPath(); g.arc(0, -64, 7, 0, 7); g.fill();
      g.fillStyle = "#33281e"; g.textAlign = "left"; g.font = "22px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
      const text = String(it.content || ""), lines = [];
      let cur = "";
      for (const ch of text) { if (g.measureText(cur + ch).width > 144) { lines.push(cur); cur = ch; if (lines.length >= 4) break; } else cur += ch; }
      if (lines.length < 4 && cur) lines.push(cur);
      if (lines.length === 4 && text.length > lines.join("").length) lines[3] = lines[3].slice(0, -1) + "…";
      lines.forEach((ln, k) => g.fillText(ln, -70, -30 + k * 27));
      g.font = "18px 'Gowun Dodum', sans-serif"; g.fillStyle = "#6a5440"; g.textAlign = "right";
      g.fillText("- " + (it.name || "익명"), 72, 66);
      g.restore();
    });
  });
}
// 🧩 성경 퀴즈 보드 (비전 / 301호): 출제 범위 + 이번 주 랭킹 1~3등
function quizBoardTex(info) {
  const W = 800, H = 460, d = info || {};
  return canvasTex(W, H, (g) => {
    g.fillStyle = "#1f4a3e"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(Math.random() * W, Math.random() * H, 3, 2); }
    g.strokeStyle = "#b8864e"; g.lineWidth = 22; g.strokeRect(11, 11, W - 22, H - 22);
    g.textAlign = "center"; g.fillStyle = "#fff7d6";
    g.font = "700 50px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillText("🧩 성경 퀴즈" + (d.grp ? " · " + d.grp : ""), W / 2, 82);
    g.font = "26px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillStyle = "#d9f0e2";
    const range = String(d.range || "성경 66권 전체");
    g.fillText("출제 범위 · " + (range.length > 26 ? range.slice(0, 25) + "…" : range), W / 2, 128);
    g.fillStyle = "#ffe08a"; g.font = "700 30px 'Gowun Dodum', sans-serif"; g.fillText("🏆 이번 주 랭킹", W / 2, 192);
    const top = (d.top || []).slice(0, 3), medal = ["🥇", "🥈", "🥉"];
    g.font = "32px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif"; g.fillStyle = "#ffffff";
    if (!top.length) g.fillText("아직 아무도 안 풀었어요. 1등의 기회! ✨", W / 2, 262);
    top.forEach((r, i) => {
      const nm = String(r.name || "익명").slice(0, 10);
      g.textAlign = "left"; g.fillText(`${medal[i]}  ${nm}`, 190, 252 + i * 52);
      g.textAlign = "right"; g.fillText(`${r.points}점`, W - 190, 252 + i * 52);
    });
    g.textAlign = "center"; g.fillStyle = "#c7e6d3"; g.font = "24px 'Gowun Dodum', sans-serif";
    g.fillText("눌러서 5문제씩 풀어요 · 쉬운 / 넌센스 / 중간 / 하이", W / 2, H - 42);
  });
}
function addQuizBoard(wall, labels, clickables, x, y, z, ry, w) {
  const mat = new T.MeshStandardMaterial({ map: quizBoardTex(), roughness: 0.85, emissive: "#ffffff", emissiveIntensity: 0.08 });
  mat.emissiveMap = mat.map;
  const m = new T.Mesh(new T.PlaneGeometry(w, w * 460 / 800), mat);
  m.position.set(x, y, z); m.rotation.y = ry; wall.add(m);
  m.userData.action = "quiz"; clickables.push(m);
  const lx = x + Math.sin(ry) * 0.2, lz = z + Math.cos(ry) * 0.2;
  labels.push({ x: lx, y: y + w * 0.29 + 0.25, z: lz, html: "🧩 성경 퀴즈 풀기", action: "quiz" });
  return mat;
}
function buildRoom301() {
  const s = new T.Scene();
  s.background = new T.Color("#3d3833");
  addLights(s, { sky: "#ffffff", ground: "#8a8278", hemi: 0.9, sunI: 0.45, sunPos: [3, 12, 6], ext: 10, amb: 0.2 });
  const seats = {}, obs = [], clickables = [], doors = [], labels = [];
  const HX = 4.6, HZ = 4.0, CH = 3.0;
  const wallM = new T.MeshStandardMaterial({ color: "#eceae4", roughness: 0.95 });
  const { walls, wallHide, ceil } = roomShell(s, { HX, HZ, CH, floorTex: woodTex("#a9a49c", [4, 6]), back: wallM, left: wallM, right: wallM, front: wallM,
    lights: [[-1.8, -1, 1.3, 0.7], [2.4, 1.6, 1.3, 0.7]] });
  const white = M("#f7f7f4", 0.5), brown = M("#8e5532", 0.45), brownD = M("#7a4628", 0.45), blk = M("#1e1e1e", 0.4);
  // 창문(롤 블라인드) + 벽걸이 에어컨
  box(walls.back, 1.25, 1.5, 0.05, M("#f4f4f0", 0.7), -1.0, 1.95, -HZ + 0.04, { cast: false });
  box(walls.back, 1.35, 0.08, 0.1, M("#dcdcd6", 0.6), -1.0, 2.72, -HZ + 0.06, { cast: false });
  box(s, 1.25, 0.45, 0.3, M("#e9e6dd", 0.6), -1.0, 0.75, -HZ + 0.16);
  for (let i = 0; i < 6; i++) box(s, 1.1, 0.015, 0.01, M("#9a978e", 0.6), -1.0, 0.62 + i * 0.05, -HZ + 0.32, { cast: false });
  obs.push([-1.65, -HZ, -0.35, -HZ + 0.35]);
  // 긴 흰 책상 + 물건들 + TGIF 액자
  box(s, 2.3, 0.05, 0.62, white, -3.35, 0.76, -HZ + 0.33);
  for (const lx of [-4.4, -2.3]) for (const lz of [-HZ + 0.1, -HZ + 0.58]) box(s, 0.04, 0.74, 0.04, M("#9a9a9a", 0.4), lx, 0.37, lz);
  box(s, 0.5, 0.28, 0.35, M("#dfe6ea", 0.2, { transparent: true, opacity: 0.75 }), -3.9, 0.93, -HZ + 0.32);
  box(s, 0.38, 0.3, 0.3, M("#b98a5a", 0.9), -3.35, 0.94, -HZ + 0.3);
  box(s, 0.3, 0.36, 0.2, M("#c8a87a", 0.9), -2.6, 0.97, -HZ + 0.3);
  const tgif = new T.Mesh(new T.PlaneGeometry(0.55, 0.7), new T.MeshStandardMaterial({ map: textTex([["TGIF.", 92, 140]], { w: 300, h: 380, bg: "#fbfbf8", fg: "#1c1c1c", border: "#e5e5e0" }) }));
  tgif.position.set(-2.7, 1.13, -HZ + 0.16); tgif.rotation.x = -0.12; s.add(tgif);
  box(s, 0.6, 0.55, 0.45, M("#a87c50", 0.9), -3.0, 0.28, -HZ + 0.35); // 책상 밑 상자
  obs.push([-HX, -HZ, -2.15, -HZ + 0.7]);
  // 기타 케이스
  const gc = new T.Mesh(new T.CapsuleGeometry(0.17, 0.75, 4, 10), blk); gc.position.set(-0.1, 0.55, -HZ + 0.22); gc.rotation.z = 0.12; gc.castShadow = true; s.add(gc);
  // 갈색 가죽 소파 2개 (누울 수 있어요)
  sofaSet(s, seats, clickables, obs, "SA", 1.15, -HZ + 0.5, 0, 2.1, 2, brown, brownD, { lie: true, lines: true, recline: true, seatH: 0.42 });
  sofaSet(s, seats, clickables, obs, "SB", HX - 0.5, 0.35, -Math.PI / 2, 2.3, 2, brown, brownD, { lie: true, lines: true, recline: true, seatH: 0.42 });
  // 흰 커피 테이블 (아래 선반)
  const ct = new T.Group(); ct.position.set(1.6, 0, -1.2); ct.rotation.y = 0.15; s.add(ct);
  box(ct, 1.25, 0.05, 0.7, white, 0, 0.47, 0); box(ct, 1.15, 0.03, 0.6, white, 0, 0.14, 0);
  for (const lx of [-0.58, 0.58]) box(ct, 0.08, 0.47, 0.68, white, lx, 0.235, 0);
  obs.push([0.9, -1.65, 2.3, -0.75]);
  // 매달린 일자 조명
  box(ceil, 1.4, 0.06, 0.1, blk, 1.5, 2.35, -1.2);
  box(ceil, 1.3, 0.01, 0.06, M("#ffffff", 0.3, { emissive: "#fff8e8", emissiveIntensity: 1 }), 1.5, 2.315, -1.2, { cast: false });
  for (const dx of [-0.6, 0.6]) cyl(ceil, 0.004, 0.004, 0.65, M("#888", 0.4), 1.5 + dx, 2.68, -1.2, 4);
  // 흰 의자 2개
  [[-2.7, -2.3, 0.5, "C-0"], [-3.7, -1.0, 1.2, "C-1"]].forEach(([x, z, rot, id]) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; s.add(g);
    box(g, 0.44, 0.04, 0.42, white, 0, 0.45, 0); box(g, 0.44, 0.38, 0.03, white, 0, 0.72, -0.2); g.children[1].rotation.x = -0.1;
    for (const lx of [-0.19, 0.19]) for (const lz of [-0.17, 0.17]) { const l = box(g, 0.03, 0.46, 0.03, white, lx, 0.22, lz); l.rotation.x = lz > 0 ? 0.08 : -0.08; }
    const fx = Math.sin(rot), fz = Math.cos(rot);
    seats[id] = { x, z, rot, h: 0.46, ax: x + fx * 0.6, az: z + fz * 0.6 };
    seatGroupMark(g, [id]); clickables.push(g);
    obs.push([x - 0.26, z - 0.26, x + 0.26, z + 0.26]);
  });
  // 동그란 사이드 테이블 + 스탠드, 옷걸이, 플로어 램프
  cyl(s, 0.28, 0.28, 0.03, white, -HX + 0.45, 0.6, 2.1, 20); cyl(s, 0.02, 0.02, 0.6, white, -HX + 0.45, 0.3, 2.1, 6);
  cyl(s, 0.2, 0.2, 0.02, white, -HX + 0.45, 0.25, 2.1, 16);
  cyl(s, 0.015, 0.015, 0.32, blk, -HX + 0.5, 0.78, 2.05, 6);
  cyl(s, 0.09, 0.12, 0.18, M("#ffffff", 0.4, { emissive: "#fff3d0", emissiveIntensity: 0.5 }), -HX + 0.5, 0.98, 2.05, 14);
  obs.push([-HX, 1.75, -HX + 0.8, 2.45]);
  const rack = new T.Group(); rack.position.set(-HX + 0.4, 0, 3.35); s.add(rack);
  cyl(rack, 0.025, 0.025, 1.8, blk, 0, 0.9, 0, 6); cyl(rack, 0.22, 0.25, 0.03, blk, 0, 0.02, 0, 12);
  for (let k = 0; k < 4; k++) { const hk = box(rack, 0.2, 0.02, 0.02, blk, Math.cos(k * 1.57) * 0.09, 1.7, Math.sin(k * 1.57) * 0.09, { cast: false }); hk.rotation.y = -k * 1.57; hk.rotation.z = 0.5; }
  obs.push([-HX, 3.1, -HX + 0.65, 3.6]);
  cyl(s, 0.015, 0.015, 1.5, blk, HX - 0.35, 0.75, 2.9, 6); cyl(s, 0.18, 0.2, 0.02, blk, HX - 0.35, 0.01, 2.9, 12);
  cyl(s, 0.2, 0.22, 0.32, M("#ffffff", 0.4, { emissive: "#fff3d0", emissiveIntensity: 0.6 }), HX - 0.35, 1.6, 2.9, 16);
  obs.push([HX - 0.6, 2.65, HX, 3.15]);
  // 오른쪽 벽 포스터 (수련회, 옛 종이)
  const poster = new T.Mesh(new T.PlaneGeometry(0.9, 1.25), new T.MeshStandardMaterial({ map: textTex([["청년부", 40, 60, "#333"], ["가을 수련회", 52, 120, "#2f4a3a"], ["🍐", 120, 250], ["함께 모여 예배해요", 28, 360, "#555"]], { w: 360, h: 500, bg: "#f6f5ef", fg: "#333" }) }));
  poster.position.set(HX - 0.02, 1.95, -1.5); poster.rotation.y = -Math.PI / 2; walls.right.add(poster);
  const oldp = new T.Mesh(new T.PlaneGeometry(0.85, 0.85), new T.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#d9b98f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(120,70,30,.25)"; g.fillRect((i % 3) * 85 + 6, Math.floor(i / 3) * 128 + 6, 76, 116); g.fillStyle = "rgba(60,30,10,.4)"; for (let l = 0; l < 8; l++) g.fillRect((i % 3) * 85 + 12, Math.floor(i / 3) * 128 + 20 + l * 12, 60, 2); }
  }) }));
  oldp.position.set(HX - 0.02, 1.95, -0.3); oldp.rotation.y = -Math.PI / 2; walls.right.add(oldp);
  // 방명록 보드 (정면 벽, 책상 위) — 누르면 방명록을 쓸 수 있어요
  const gbMat = new T.MeshStandardMaterial({ map: guestbookTex([], "301호 3Q"), roughness: 0.85 });
  const gb = new T.Mesh(new T.PlaneGeometry(2.6, 1.17), gbMat);
  gb.position.set(-3.15, 2.17, -HZ + 0.03); walls.back.add(gb);
  gb.userData.action = "guestbook"; clickables.push(gb);
  labels.push({ x: -3.15, y: 2.95, z: -HZ + 0.2, html: "📝 방명록 쓰기", action: "guestbook" });
  // 🧩 성경 퀴즈 보드 (왼쪽 벽, 흰 의자 옆)
  const quizMat = addQuizBoard(walls.left, labels, clickables, -HX + 0.03, 1.7, -0.3, Math.PI / 2, 1.9);
  /* 크리스마스: 오른쪽 뒤 구석 작은 트리, 벽 위 전구 줄, 양말 장식 */
  const tw = [];
  const deco = decoBegin(s);
  const rt = makeXmasTree(1.9, tw); rt.position.set(3.85, 0, -3.35); s.add(rt);
  obs.push([3.2, -HZ, HX, -2.7]);
  lightRun(walls.back, tw, [[-HX + 0.1, 2.82, -HZ + 0.1], [-2.3, 2.82, -HZ + 0.1], [0, 2.82, -HZ + 0.1], [2.3, 2.82, -HZ + 0.1], [HX - 0.1, 2.82, -HZ + 0.1]], 9, 0.14);
  lightRun(walls.right, tw, [[HX - 0.1, 2.82, -HZ + 0.1], [HX - 0.1, 2.82, -1.4], [HX - 0.1, 2.82, 1.2], [HX - 0.1, 2.82, HZ - 0.1]], 9, 0.14);
  ["#c0392b", "#2e7d4f", "#c0392b"].forEach((c, i) => {
    const st = new T.Group(); st.position.set(HX - 0.06, 1.25, 1.55 + i * 0.45); st.rotation.y = -Math.PI / 2; walls.right.add(st);
    box(st, 0.16, 0.26, 0.05, M(c, 0.8), 0, 0, 0); box(st, 0.22, 0.09, 0.055, M(c, 0.8), 0.05, -0.15, 0); box(st, 0.18, 0.06, 0.06, M("#fbfbf7", 0.9), 0, 0.14, 0);
  });
  decoEnd(s, deco, "christmas");
  // 문 (앞쪽 벽)
  addDoor(walls.front, 2.6, HZ - 0.04, Math.PI, labels, doors, clickables, "#6e6a64");
  doors.push({ x: 2.6, z: HZ - 0.8, to: "yard" });
  labels.push({ x: 2.6, y: 2.7, z: HZ - 0.2, html: "🚪 마당으로", to: "yard" });
  return { scene: s, seats, obs, clickables, doors, labels, wallHide, ceil, ceilY: CH, gbMat, quizMat, tw,
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ }, cell: 0.2, pad: 0.2,
    cam: { pitch: 0.85, dist: 9.5, min: 3.5, max: 15 }, spawn: { def: { x: 2.6, z: HZ - 1.3 } }, spread: { def: [0.9, 0.5] } };
}

/* ===== 🧀 치즈멜로바이트 쇼룸 (안으로 들어가는 방, 2026-11-18) =====
   가운데 큰 세모 치즈 모형이 천천히 돌고, 왼쪽·뒤쪽 벽은 진열장(누르면 주문), 오른쪽은 아일랜드 작업대(만들기 게임) */
function buildShowroomRoom() {
  const s = new T.Scene();
  s.background = new T.Color("#3d3330");
  addLights(s, { sky: "#fff8ec", ground: "#8a6a50", hemi: 0.95, sunI: 0.5, sunPos: [4, 12, 8], ext: 12, amb: 0.2 });
  const seats = {}, obs = [], clickables = [], doors = [], labels = [];
  const HX = 6.0, HZ = 5.0, CH = 3.6;
  const cream = new T.MeshStandardMaterial({ color: "#fff1cf", roughness: 0.95 });
  const { walls, wallHide, ceil } = roomShell(s, { HX, HZ, CH, floorTex: checkerTex(), back: cream, left: cream, right: cream, front: cream, lights: [] });
  const red = M("#d9483b", 0.55), wood = M("#c98a46", 0.6), woodD = M("#8a5a2e", 0.7), white = M("#fbfbf7", 0.6), cheese = M("#f7c948", 0.55), cheeseD = M("#e0a92a", 0.7);
  // 벽 아래 빨간 띠 + 뒷벽 간판
  for (const [w, x, z, ry] of [[HX * 2, 0, -HZ + 0.02, 0], [HZ * 2, -HX + 0.02, 0, Math.PI / 2], [HZ * 2, HX - 0.02, 0, -Math.PI / 2]]) { const b = box(w === HX * 2 ? walls.back : ry > 0 ? walls.left : walls.right, w, 0.5, 0.02, red, x, 0.25, z, { cast: false }); b.rotation.y = ry; }
  const sign = new T.Mesh(new T.PlaneGeometry(4.2, 0.88), new T.MeshBasicMaterial({ map: signScriptTex(), transparent: true })); sign.position.set(0, 3.0, -HZ + 0.03); walls.back.add(sign);
  // 🧀 가운데: 사람보다 훨씬 큰 세모 치즈 모형 (천천히 돌아요)
  const ped = cyl(s, 1.25, 1.35, 0.45, M("#fbfbf7", 0.5), 0, 0.225, 0, 32); void ped;
  cyl(s, 1.27, 1.27, 0.06, red, 0, 0.46, 0, 32);
  const spin = new T.Group(); spin.position.set(0, 0.49, 0); s.add(spin);
  const tri = new T.Shape(); tri.moveTo(-1.0, 0); tri.lineTo(1.25, 0); tri.lineTo(-1.0, 2.4); tri.closePath();
  const wedgeGeo = new T.ExtrudeGeometry(tri, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); wedgeGeo.translate(-0.1, 0, -0.6);
  const wedge = new T.Mesh(wedgeGeo, cheese); wedge.castShadow = true; spin.add(wedge);
  const holeM = M("#d99a16", 0.8);
  for (const [x, y, r] of [[-0.6, 0.5, 0.18], [-0.3, 1.2, 0.12], [-0.75, 1.7, 0.1], [0.2, 0.35, 0.14], [0.55, 0.25, 0.09], [-0.45, 0.95, 0.07]]) for (const sz of [-1, 1]) {
    const hh = new T.Mesh(new T.CircleGeometry(r, 16), holeM); hh.position.set(x, y, sz * 0.645); if (sz < 0) hh.rotation.y = Math.PI; spin.add(hh);
  }
  const slope = Math.atan2(2.4, 2.25);
  for (const [f, z, r] of [[0.3, 0.2, 0.16], [0.6, -0.3, 0.12], [0.5, 0.35, 0.08], [0.15, -0.35, 0.1]]) { const hh = new T.Mesh(new T.CircleGeometry(r, 16), holeM); hh.position.set(1.15 - f * 2.25 + 0.03, f * 2.4 + 0.03, z); hh.rotation.set(0, Math.PI / 2, 0); hh.rotateX(-(Math.PI / 2 - slope)); spin.add(hh); }
  for (let k = 0; k < 10; k++) { const sp = new T.Mesh(new T.OctahedronGeometry(0.05), M("#fff6c8", 0.3, { emissive: "#ffe08a", emissiveIntensity: 0.8 })); sp.position.set(Math.cos(k * 0.63) * 1.6, 0.8 + (k % 4) * 0.5, Math.sin(k * 0.63) * 1.6); spin.add(sp); }
  spin.traverse((m) => (m.userData.action = "showroom")); clickables.push(spin);
  obs.push([-1.4, -1.4, 1.4, 1.4]);
  labels.push({ x: 0, y: 3.35, z: 0, html: "🧀 Cheese Mellow Bites", action: "showroom" });
  // 🛒 진열장 (왼쪽 벽 · 뒤쪽 벽) — 상자를 누르면 그 크기로 주문서가 열려요
  const ribbon = M("#ffd54a", 0.5), boxM = M("#c62f26", 0.55);
  const gift = (parent, x, y, z, w, h, d, act) => {
    const g = new T.Group(); g.position.set(x, y, z); parent.add(g);
    box(g, w, h, d, boxM, 0, h / 2, 0); box(g, w + 0.01, h + 0.01, 0.035, ribbon, 0, h / 2, 0, { cast: false }); box(g, 0.035, h + 0.01, d + 0.01, ribbon, 0, h / 2, 0, { cast: false });
    const bow = new T.Mesh(new T.TorusGeometry(0.035, 0.012, 5, 10), ribbon); bow.position.y = h + 0.02; g.add(bow);
    g.traverse((m) => (m.userData.action = act)); clickables.push(g); return g;
  };
  const shelf = (x, z, ry, len, act, sz, label) => {
    const sh = new T.Group(); sh.position.set(x, 0, z); sh.rotation.y = ry; s.add(sh);
    for (const sx of [-len / 2, len / 2]) box(sh, 0.06, 2.3, 0.5, wood, sx, 1.15, 0);
    box(sh, len, 2.3, 0.04, woodD, 0, 1.15, -0.23);
    for (const y of [0.3, 0.9, 1.5, 2.1]) box(sh, len, 0.05, 0.5, wood, 0, y, 0);
    const [w, h] = sz === "l" ? [0.34, 0.2] : [0.24, 0.14];
    for (const y of [0.33, 0.93, 1.53]) { const n = Math.floor((len - 0.2) / (w + 0.1)); for (let i = 0; i < n; i++) gift(sh, -len / 2 + 0.15 + w / 2 + i * (w + 0.1), y, 0.02, w, h, w * 0.8, act); }
    const tag = new T.Mesh(new T.PlaneGeometry(len * 0.8, 0.32), new T.MeshBasicMaterial({ map: textTex([[label, 44, 46]], { w: 640, h: 96, bg: "#c62f26", fg: "#fff6e0" }) })); tag.position.set(0, 2.45, 0.05); sh.add(tag);
    tag.userData.action = act; clickables.push(tag);
  };
  shelf(-HX + 0.3, -1.4, Math.PI / 2, 3.2, "buy:s", "s", "🛒 200g · $8 · 눌러서 주문");
  shelf(-HX + 0.3, 2.3, Math.PI / 2, 2.6, "buy:l", "l", "🛒 450g · $15 · 눌러서 주문");
  shelf(-2.6, -HZ + 0.3, 0, 3.0, "buy:s", "s", "🛒 200g · $8");
  shelf(2.6, -HZ + 0.3, 0, 3.0, "buy:l", "l", "🛒 450g · $15");
  obs.push([-HX, -3.1, -HX + 0.6, 3.7], [-4.2, -HZ, 4.2, -HZ + 0.6]);
  labels.push({ x: -HX + 0.5, y: 2.95, z: 0.4, html: "🛒 진열장 · 상자를 누르면 주문", action: "buy:s" });
  // 포스터 (뒷벽 가운데)
  const pmat = new T.MeshBasicMaterial({ color: "#ffffff" });
  new T.TextureLoader().load("cheese-mellow-poster.jpg", (tx) => { tx.encoding = T.sRGBEncoding; pmat.map = tx; pmat.needsUpdate = true; });
  const pp = new T.Mesh(new T.PlaneGeometry(1.25, 1.14), pmat); pp.position.set(0, 1.65, -HZ + 0.04); walls.back.add(pp);
  box(walls.back, 1.37, 1.26, 0.03, red, 0, 1.65, -HZ + 0.02, { cast: false });
  // 🧑‍🍳 아일랜드 작업대 (오른쪽) — 여기서 쫀득쿠키를 만들어 봐요
  const IX = 3.7, IZ = 0.6, isl = new T.Group(); isl.position.set(IX, 0, IZ); s.add(isl);
  box(isl, 1.2, 0.9, 3.0, white, 0, 0.45, 0); box(isl, 1.35, 0.06, 3.15, M("#e9e2d4", 0.4), 0, 0.93, 0);
  box(isl, 1.21, 0.12, 3.01, red, 0, 0.82, 0, { cast: false });
  const pot = cyl(isl, 0.17, 0.15, 0.18, M("#9aa0a6", 0.3, { metalness: 0.6 }), 0, 1.05, -1.0, 16); void pot; cyl(isl, 0.15, 0.15, 0.02, M("#fff8ec", 0.5), 0, 1.13, -1.0, 16);
  cyl(isl, 0.2, 0.2, 0.02, M("#333", 0.5), 0, 0.97, -1.0, 16);
  const bowl = new T.Mesh(new T.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M("#d7dde2", 0.3, { side: T.DoubleSide })); bowl.position.set(0, 1.16, -0.3); isl.add(bowl);
  cyl(isl, 0.17, 0.17, 0.02, cheese, 0, 1.06, -0.3, 16);
  box(isl, 0.45, 0.06, 0.35, M("#b0b4b8", 0.3, { metalness: 0.6 }), 0, 0.99, 0.35); box(isl, 0.4, 0.04, 0.3, cheese, 0, 1.03, 0.35);
  box(isl, 0.5, 0.03, 0.35, M("#c9a06a", 0.6), 0, 0.975, 1.0); for (let k = 0; k < 6; k++) box(isl, 0.06, 0.05, 0.06, cheese, -0.15 + (k % 3) * 0.12, 1.02, 0.92 + Math.floor(k / 3) * 0.12);
  for (const [z, c] of [[-0.65, "#fffdf5"], [-0.55, "#f29a1a"]]) { const jar = cyl(isl, 0.06, 0.06, 0.16, M("#e6eef2", 0.2, { transparent: true, opacity: 0.6 }), 0.35, 1.04, z, 12); void jar; cyl(isl, 0.055, 0.055, 0.1, M(c, 0.8), 0.35, 1.01, z, 12); }
  isl.traverse((m) => (m.userData.action = "cookie")); clickables.push(isl);
  obs.push([IX - 0.7, IZ - 1.6, IX + 0.7, IZ + 1.6]);
  // 서서 만드는 자리 4개 (작업대 양쪽)
  [["CM-0", IX - 1.05, IZ - 0.75, Math.PI / 2], ["CM-1", IX - 1.05, IZ + 0.75, Math.PI / 2], ["CM-2", IX + 1.05, IZ - 0.75, -Math.PI / 2], ["CM-3", IX + 1.05, IZ + 0.75, -Math.PI / 2]].forEach(([id, x, z, rot]) => {
    seats[id] = { x, z, rot, h: 0, stand: true, ax: x + (rot > 0 ? -0.4 : 0.4), az: z };
  });
  labels.push({ x: IX, y: 2.2, z: IZ, html: "🧑‍🍳 아일랜드 작업대 · 쫀득쿠키 만들어 보기", action: "cookie" });
  // 매달린 등 · 풍선
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2], [IX, IZ]]) { cyl(s, 0.006, 0.006, 0.7, M("#333", 0.5), x, CH - 0.35, z, 4); const lp = new T.Mesh(new T.ConeGeometry(0.22, 0.22, 16, 1, true), M("#d9483b", 0.5, { side: T.DoubleSide })); lp.position.set(x, CH - 0.8, z); s.add(lp); const bulb = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), M("#fff3c4", 0.3, { emissive: "#ffd27a", emissiveIntensity: 1 })); bulb.position.set(x, CH - 0.88, z); s.add(bulb); }
  const bl = new T.PointLight("#ffd9a0", 0.6, 12); bl.position.set(0, CH - 0.6, 0); s.add(bl);
  ["#d9483b", "#ffcf3a", "#fff4dc"].forEach((c, i) => { for (const [x, z] of [[-HX + 0.6, HZ - 0.6], [HX - 0.6, -HZ + 0.6]]) { const b = makeBalloon(c, 0.22); b.position.set(x + (i - 1) * 0.25, 2.4 + (i % 2) * 0.3, z); s.add(b); } });
  // 문 (앞쪽 벽 왼쪽) → 마당
  addDoor(walls.front, -3.6, HZ - 0.04, Math.PI, labels, doors, clickables, "#d9483b");
  doors.push({ x: -3.6, z: HZ - 0.8, to: "yard" });
  labels.push({ x: -3.6, y: 2.7, z: HZ - 0.2, html: "🚪 마당으로", to: "yard" });
  return { scene: s, seats, obs, clickables, doors, labels, wallHide, ceil, ceilY: CH,
    update: (dt) => { spin.rotation.y += dt * 0.35; },
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ }, cell: 0.25, pad: 0.22,
    cam: { pitch: 0.75, dist: 11, min: 4, max: 17 }, spawn: { def: { x: -3.6, z: HZ - 1.3 } }, spread: { def: [1.0, 0.5] } };
}

/* ===== 🎸 찬양팀 연습실 (리빙리버) ===== */
// 리빙리버 찬양 음원 (유튜브 플레이리스트 "M/V"). 새 곡이 생기면 여기에 한 줄 넣어요: [유튜브 영상 id, 제목, CD 색]
const LR_PLAYLIST = "PLF7bMvUfnGHlKEl44DJ0WsCyICkzzTPgZ";
const LR_CDS = [ // 영상 번호는 2026-11-13 유튜브 재생목록·영상 제목과 하나씩 대조해서 고쳤어요 (예전엔 한 칸씩 밀려 있었어요)
  ["M3DA7cETYHE", "크리스마스의 이유", "#c0392b", "2024"],
  ["0JThlYsWVIA", "기쁨으로 드리기 원하네", "#e0a526", "헌금송 2024"],
  ["1TuNaapRnmw", "당신 때문에", "#d96a9a", "축복송"],
  ["yYgK3b2kZ2k", "나의 길", "#2e8c84", ""],
  ["RbN6g77echo", "좋으신 하나님", "#3a6fd1", ""],
  ["JZBxtnOKMsk", "선하신 목자", "#4f8a4a", ""],
];
// 연주 자리: 리더 1 · 싱어 5 · 드럼 · 일렉 · 베이스 · 메인 건반 · 세컨 건반
// inst: lead | sing | drums | key | key2 | egtr | bass
// 💃 춤 목록 (app.js 춤 고르기 창과 같은 이름)
// ⛸ 피겨 기술 (이름 · 몇 초 동안)
const FIGURES = {
  spin: { name: "🌀 스핀", dur: 2.6 }, axel: { name: "🦘 악셀 점프", dur: 1.8 }, triple: { name: "💫 트리플 악셀", dur: 2.1 },
  spiral: { name: "🦢 스파이럴", dur: 2.6 }, camel: { name: "🐫 카멜 스핀", dur: 2.6 }, layback: { name: "🙆 레이백 스핀", dur: 2.6 }, bow: { name: "🙇 인사", dur: 1.6 },
  fall: { name: "😵 엉덩방아", dur: 2.4, hide: true }, // 트리플 악셀 실패 (버튼에는 안 보여요)
};
const DANCES = {
  disco: "🕺 디스코", robot: "🤖 로봇 춤", penguin: "🐧 펭귄 뒤뚱", jump: "🦘 신나게 점프", spin: "🌀 빙글빙글",
  praise: "🙌 찬양 율동", wave: "🌊 웨이브", cancan: "🦵 발차기 춤", chicken: "🐔 닭 춤", shuffle: "👟 셔플 스텝",
};
// 🌿 마당에서 잔디가 아닌 곳 (보도·길·운동장·놀이터 눈밭): [x0, z0, x1, z1]
const NOT_GRASS = [[-22, -4.1, 22, -0.7], [-4.3, -2.3, -1.7, 12.3], [8, -2.3, 10, 12.3], [-80, 11.8, 80, 30], [-19.2, -19.6, -16, 6.5], [16.3, -21.6, 19.3, -17.4],
  [17.7, -20.4, 20.3, 3.2], [19.7, 2.6, 32.4, 7.4], [-34.9, -11.8, -26.3, -1.8], [-36, -1.2, -24.5, 12.2], [32, -37, 52, -5], [20.2, -19.6, 32.4, -4.4], [-16.8, -33.4, -8.2, -24.6], [20.1, -43, 32.3, -19.1], [-15.4, -19.2, 15.4, -3.9]];
const JAM_SEATS = {
  WL: { x: 0, z: -0.95, rot: 0, inst: "lead", name: "🎤 인도자" },
  "WS-0": { x: -4.4, z: -1.35, rot: 0.25, inst: "sing", name: "🎙 싱어 1" },
  "WS-1": { x: -2.9, z: -1.25, rot: 0.15, inst: "sing", name: "🎙 싱어 2" },
  "WS-2": { x: -1.45, z: -1.15, rot: 0.08, inst: "sing", name: "🎙 싱어 3" },
  "WS-3": { x: 1.45, z: -1.15, rot: -0.08, inst: "sing", name: "🎙 싱어 4" },
  "WS-4": { x: 2.9, z: -1.25, rot: -0.15, inst: "sing", name: "🎙 싱어 5" },
  WD: { x: 0, z: -4.95, rot: 0, inst: "drums", name: "🥁 드럼", sit: 0.56 },
  "WK-0": { x: -3.3, z: -4.1, rot: 0.2, inst: "key", name: "🎹 메인 건반" },
  "WK-1": { x: -5.5, z: -3.0, rot: 0.5, inst: "key2", name: "🎹 세컨 건반" },
  WG: { x: 3.1, z: -3.9, rot: -0.2, inst: "egtr", name: "🎸 일렉 기타" },
  WB: { x: 5.3, z: -3.0, rot: -0.45, inst: "bass", name: "🎸 베이스" },
};
function cdLabelTex(title, col, sub) {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "#f4f6f8"); gr.addColorStop(0.18, "#d9dde2"); gr.addColorStop(0.2, col); gr.addColorStop(1, col);
    g.fillStyle = "#0000"; g.clearRect(0, 0, w, h);
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, 7); g.fillStyle = gr; g.fill();
    // 무지개빛 반사
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6 - i * 14, -0.6 + i * 0.1, 0.3 + i * 0.1); g.strokeStyle = `hsla(${i * 50},90%,80%,.35)`; g.lineWidth = 5; g.stroke(); }
    g.beginPath(); g.arc(w / 2, h / 2, 16, 0, 7); g.fillStyle = "#222"; g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 22px 'Gowun Dodum', sans-serif";
    g.fillText(String(title).slice(0, 10), w / 2, h / 2 + 62);
    if (sub) { g.font = "15px 'Gowun Dodum', sans-serif"; g.fillText(sub, w / 2, h / 2 + 86); }
    g.font = "700 14px sans-serif"; g.fillText("LIVING RIVER", w / 2, h / 2 - 50);
  });
}
function cdSpineTex(title, col) {
  return canvasTex(64, 512, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, 0, 8, h);
    g.save(); g.translate(w / 2 + 8, h / 2); g.rotate(Math.PI / 2);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 30px 'Gowun Dodum', sans-serif"; g.fillText(String(title).slice(0, 12), 0, 0);
    g.restore();
  });
}
// 📝 추천찬양 보드: 최근 추천 8개를 쪽지처럼
function recBoardTex(list) {
  const W = 1024, H = 640;
  return canvasTex(W, H, (g) => {
    g.fillStyle = "#1d3557"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1200; i++) { g.fillStyle = "rgba(255,255,255,.03)"; g.fillRect(Math.random() * W, Math.random() * H, 3, 2); }
    g.strokeStyle = "#c9a46a"; g.lineWidth = 18; g.strokeRect(9, 9, W - 18, H - 18);
    g.fillStyle = "#fff7d6"; g.textAlign = "center"; g.font = "700 44px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
    g.fillText("🎵 청년들의 추천 찬양", W / 2, 66);
    g.font = "24px 'Gowun Dodum', sans-serif"; g.fillStyle = "#cfe0f5"; g.fillText("눌러서 나만의 추천 찬양을 남겨 주세요", W / 2, 104);
    const items = (list || []).slice(0, 8), cols = ["#fff3a0", "#ffd3dc", "#c9efd2", "#cfe2ff", "#ffe2b8"];
    if (!items.length) { g.font = "30px 'Gowun Dodum', sans-serif"; g.fillStyle = "#fff"; g.fillText("아직 추천이 없어요. 첫 번째로 남겨 볼까요? 🎶", W / 2, H / 2 + 30); }
    items.forEach((it, i) => {
      const cx = 135 + (i % 4) * 251, cy = 222 + Math.floor(i / 4) * 214;
      g.save(); g.translate(cx, cy); g.rotate(((it.id || i) * 37 % 9 - 4) * 0.012);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(-100, -80, 208, 180);
      g.fillStyle = cols[Math.abs(it.id || i) % cols.length]; g.fillRect(-104, -86, 208, 180);
      g.fillStyle = "#d33"; g.beginPath(); g.arc(0, -78, 8, 0, 7); g.fill();
      g.fillStyle = "#1f2a44"; g.textAlign = "left"; g.font = "700 25px 'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif";
      const fit = (txt, maxW, maxL, font) => { g.font = font; const out = []; let cur = ""; for (const ch of String(txt || "")) { if (g.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; if (out.length >= maxL) break; } else cur += ch; } if (out.length < maxL && cur) out.push(cur); return out.slice(0, maxL); };
      const t = fit("🎵 " + it.title, 186, 2, "700 25px 'Gowun Dodum', sans-serif");
      t.forEach((ln, k) => g.fillText(ln, -92, -44 + k * 30));
      g.fillStyle = "#4a3c2e"; const m = fit(it.note || it.artist || "", 186, 2, "20px 'Gowun Dodum', sans-serif");
      m.forEach((ln, k) => g.fillText(ln, -92, -44 + t.length * 30 + 6 + k * 25));
      g.font = "18px 'Gowun Dodum', sans-serif"; g.fillStyle = "#6a5440"; g.textAlign = "right";
      g.fillText(`- ${it.name || "익명"}${it.like_count ? "  🙌" + it.like_count : ""}`, 94, 82);
      g.restore();
    });
  });
}
// 연주하는 사람이 드는 일렉 기타 / 베이스
function makeEGuitar(kind) {
  const bass = kind === "bass", gt = new T.Group();
  gt.position.set(-0.02, 0.48, 0.27); gt.rotation.z = 0.5;
  const body = M(bass ? "#1c1c1c" : "#c0392b", 0.35, { metalness: 0.1 }), pick = M(bass ? "#e9e2d2" : "#f4f4f2", 0.5), neck = M("#c9955a", 0.5), head = M("#2a1c12", 0.5);
  const b1 = new T.Mesh(new T.SphereGeometry(0.14, 16, 12), body); b1.scale.set(1.05, 0.9, 0.24); b1.position.set(-0.06, 0, 0); gt.add(b1);
  const b2 = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), body); b2.scale.set(1, 1.2, 0.24); b2.position.set(0.08, 0.02, 0); gt.add(b2);
  const pg = new T.Mesh(new T.CircleGeometry(0.07, 14), pick); pg.position.set(0.0, -0.03, 0.036); gt.add(pg);
  const L = bass ? 0.62 : 0.48;
  box(gt, L, 0.04, 0.025, neck, 0.13 + L / 2, 0, 0.012); box(gt, 0.11, 0.065, 0.025, head, 0.17 + L, 0, 0.012);
  for (let k = 0; k < (bass ? 4 : 6); k++) box(gt, L + 0.2, 0.003, 0.003, M("#dcdcdc", 0.3, { metalness: 0.8 }), 0.06 + L / 2, -0.015 + k * (bass ? 0.01 : 0.006), 0.03, { cast: false });
  const strap = new T.Mesh(new T.TorusGeometry(0.27, 0.012, 4, 20, Math.PI), M("#3a3a3a", 0.6)); strap.position.set(0.1, 0.05, -0.12); strap.rotation.z = -0.1; gt.add(strap);
  return gt;
}
function makeKeyboard(len, col) {
  const g = new T.Group(), blk = M("#151515", 0.35), white = M("#f6f6f2", 0.4);
  for (const sx of [-1, 1]) { const leg = box(g, 0.04, 0.95, 0.04, M("#2a2a2a", 0.4), sx * 0.3, 0.42, 0); leg.rotation.z = sx * 0.55; } // X 스탠드
  box(g, len, 0.09, 0.34, M(col || "#1d1d1d", 0.35), 0, 0.88, 0);
  const n = Math.round(len / 0.035);
  box(g, len - 0.12, 0.02, 0.15, white, 0, 0.93, 0.07, { cast: false });
  for (let i = 0; i < n - 4; i++) { if ([1, 2, 4, 5, 6].includes(i % 7)) box(g, 0.018, 0.022, 0.09, blk, -len / 2 + 0.08 + i * 0.035, 0.945, 0.03, { cast: false }); }
  for (let i = 0; i < n - 3; i++) box(g, 0.002, 0.021, 0.15, M("#bbb", 0.5), -len / 2 + 0.075 + i * 0.035, 0.931, 0.07, { cast: false });
  box(g, 0.3, 0.02, 0.1, M("#333", 0.4, { emissive: "#3aa0ff", emissiveIntensity: 0.6 }), -len / 2 + 0.3, 0.935, -0.1, { cast: false }); // 화면
  return g;
}
function makeMicStand(h = 1.42) {
  const g = new T.Group(), m = M("#1b1b1b", 0.4);
  for (let k = 0; k < 3; k++) { const l = box(g, 0.3, 0.02, 0.02, m, 0, 0.03, 0); l.rotation.y = k * 2.1; l.position.set(Math.cos(k * 2.1) * 0.13, 0.03, -Math.sin(k * 2.1) * 0.13); l.rotation.y = -k * 2.1; }
  cyl(g, 0.012, 0.012, h, m, 0, h / 2, 0, 6);
  const boom = cyl(g, 0.01, 0.01, 0.32, m, 0, h, -0.1, 6); boom.rotation.x = -1.1;
  cyl(g, 0.02, 0.015, 0.14, m, 0, h + 0.06, -0.24, 8).rotation.x = 1.0;
  const head = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), M("#9a9a9a", 0.3, { metalness: 0.6 })); head.position.set(0, h + 0.1, -0.31); g.add(head);
  return g;
}
function buildPraise() {
  const s = new T.Scene();
  s.background = new T.Color("#1a1d26");
  addLights(s, { sky: "#e8eeff", ground: "#5a4e48", hemi: 0.85, sunI: 0.5, sunPos: [3, 12, 7], ext: 12, amb: 0.18 });
  const seats = {}, obs = [], clickables = [], doors = [], labels = [];
  const HX = 7.5, HZ = 6, CH = 3.8;
  const navy = new T.MeshStandardMaterial({ color: "#26334a", roughness: 0.95 }), wallM = new T.MeshStandardMaterial({ color: "#e7e4de", roughness: 0.95 });
  const { walls, wallHide, ceil } = roomShell(s, { HX, HZ, CH, floorTex: woodTex("#8a6a4c", [5, 6]), back: navy, left: wallM, right: wallM, front: wallM,
    lights: [[-4, 2.5, 1.2, 0.6], [0, 2.5, 1.2, 0.6], [4, 2.5, 1.2, 0.6], [-3, 4.6, 1.2, 0.6], [3, 4.6, 1.2, 0.6]] });
  // 무대 카펫 (악기·마이크 자리)
  const rug = box(s, 14.2, 0.025, 6.0, M("#353a46", 1), 0, 0.012, -2.95, { cast: false }); rug.receiveShadow = true;
  box(s, 14.2, 0.03, 0.08, M("#c9a46a", 0.6), 0, 0.016, 0.05, { cast: false });
  // 뒷벽: 흡음 패널 + 이름판 + 말씀 (시 33:3)
  for (let i = 0; i < 7; i++) box(walls.back, 1.6, 1.5, 0.08, M(i % 2 ? "#2f3d57" : "#34445f", 1), -6 + i * 2, 1.25, -HZ + 0.05, { cast: false });
  const logo = new T.Mesh(new T.PlaneGeometry(6.4, 1.15), new T.MeshBasicMaterial({ map: canvasTex(1280, 230, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#1b5e8c"); gr.addColorStop(0.5, "#2e8c84"); gr.addColorStop(1, "#1b5e8c");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= w; x += 10) g.lineTo(x, 170 + k * 18 + Math.sin(x / 60 + k) * 8); g.stroke(); } // 강물 물결
    g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "700 96px 'Gowun Dodum', sans-serif"; g.fillText("Living River Worship", w / 2, 108);
    g.font = "34px 'Gowun Dodum', sans-serif"; g.fillText("퀸즈 장로교회 청년부 찬양팀 · 리빙리버", w / 2, 156);
  }) }));
  logo.position.set(0, 2.95, -HZ + 0.06); walls.back.add(logo);
  const verse = new T.Mesh(new T.PlaneGeometry(2.6, 0.62), new T.MeshBasicMaterial({ map: textTex([["새 노래로 그를 노래하며", 40, 42], ["즐거운 소리로 공교히 연주할지어다", 40, 92], ["시편 33:3", 28, 136, "#c9a46a"]], { w: 760, h: 170, bg: "#f7f1e3", fg: "#2b2b2b" }) }));
  verse.position.set(HX - 0.02, 2.55, -2.6); verse.rotation.y = -Math.PI / 2; walls.right.add(verse);
  // 천장 조명 트러스 + 무대 조명(파 캔)
  box(ceil, 13, 0.12, 0.12, M("#2a2a2a", 0.5), 0, 3.4, -2.2);
  const parCols = ["#ff6b6b", "#ffd166", "#4cc9f0", "#b388ff", "#06d6a0", "#ff9f1c"];
  parCols.forEach((c, i) => {
    const x = -5.5 + i * 2.2, g = new T.Group(); g.position.set(x, 3.3, -2.2); g.rotation.x = 0.7; ceil.add(g);
    cyl(g, 0.11, 0.13, 0.26, M("#151515", 0.5), 0, -0.1, 0, 12);
    const lens = new T.Mesh(new T.CircleGeometry(0.1, 14), M(c, 0.3, { emissive: c, emissiveIntensity: 1.2 })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.235; g.add(lens);
  });
  for (const [x, c] of [[-3.5, "#7aa2ff"], [3.5, "#ffb37a"]]) { const p = new T.PointLight(c, 0.55, 9); p.position.set(x, 3.0, -2.6); s.add(p); }

  // ── 악기 ──
  const metal = M("#c9ccd1", 0.25, { metalness: 0.7 }), blackM = M("#151515", 0.4), cymM = M("#d8b45a", 0.25, { metalness: 0.8 });
  // 🥁 드럼 세트 (연주자는 뒤 의자에 앉아서 앞을 봐요)
  const kit = new T.Group(); kit.position.set(0, 0, -4.2); s.add(kit);
  const shell = M("#7a1f2b", 0.35, { metalness: 0.2 }), skin = M("#f2efe6", 0.7);
  const drum = (r, h, x, y, z, rx = 0) => { const d = new T.Group(); d.position.set(x, y, z); d.rotation.x = rx; kit.add(d); cyl(d, r, r, h, shell, 0, 0, 0, 20); cyl(d, r * 1.01, r * 1.01, 0.012, skin, 0, h / 2, 0, 20); return d; };
  const kick = drum(0.3, 0.38, 0, 0.32, 0.1, Math.PI / 2); // 베이스 드럼 (앞으로 누움)
  const kickLogo = new T.Mesh(new T.CircleGeometry(0.29, 24), new T.MeshBasicMaterial({ map: textTex([["LR", 120, 128]], { w: 256, h: 256, bg: "#f2efe6", fg: "#1b5e8c" }) })); kickLogo.position.set(0, 0.32, 0.3); kit.add(kickLogo);
  drum(0.17, 0.14, -0.45, 0.62, -0.35);          // 스네어
  drum(0.13, 0.17, -0.18, 0.82, -0.05, -0.3);   // 탐 1
  drum(0.14, 0.18, 0.2, 0.82, -0.05, -0.3);     // 탐 2
  drum(0.2, 0.4, 0.58, 0.32, -0.4);             // 플로어 탐
  for (const [x, z, hgt, r] of [[-0.75, -0.45, 0.92, 0.17], [-0.7, 0.15, 1.35, 0.23], [0.82, 0.05, 1.2, 0.25]]) { // 하이햇 · 크래시 · 라이드
    cyl(kit, 0.012, 0.012, hgt, metal, x, hgt / 2, z, 6);
    const c = cyl(kit, r, 0.01, 0.02, cymM, x, hgt + 0.02, z, 22); c.rotation.x = 0.12;
    if (r < 0.2) cyl(kit, r, r, 0.015, cymM, x, hgt - 0.03, z, 22);
  }
  // 드럼 의자
  cyl(s, 0.19, 0.19, 0.08, blackM, 0, 0.52, -4.95, 16); cyl(s, 0.025, 0.03, 0.48, metal, 0, 0.24, -4.95, 8);
  obs.push([-1.15, -4.65, 1.15, -3.6]);
  // 🎹 건반 2대
  const placeFront = (sid, obj, dist) => { const st = JAM_SEATS[sid]; obj.position.set(st.x + Math.sin(st.rot) * dist, 0, st.z + Math.cos(st.rot) * dist); obj.rotation.y = st.rot; s.add(obj); return obj; };
  // 비스듬히 놓인 건반은 길이 방향으로 작은 상자 여러 개로 막아요 (연주자 자리는 비워 두게)
  const lineObs = (o, len, rot) => { const cx = Math.cos(rot), cz = -Math.sin(rot); for (let k = -2; k <= 2; k++) { const x = o.position.x + cx * len * k / 4.4, z = o.position.z + cz * len * k / 4.4; obs.push([x - 0.12, z - 0.12, x + 0.12, z + 0.12]); } };
  const k0 = placeFront("WK-0", makeKeyboard(1.3, "#202020"), 0.55); lineObs(k0, 1.3, JAM_SEATS["WK-0"].rot);
  const k1 = placeFront("WK-1", makeKeyboard(1.05, "#7a1f1f"), 0.55); lineObs(k1, 1.05, JAM_SEATS["WK-1"].rot);
  const name = (sid) => JAM_SEATS[sid].name;
  // 🔊 앰프 (기타 / 베이스)
  const amp = (x, z, w, hgt, ry) => { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g); box(g, w, hgt, 0.36, M("#1a1a1a", 0.6), 0, hgt / 2, 0); box(g, w - 0.08, hgt * 0.62, 0.02, M("#3a3a3a", 1), 0, hgt * 0.4, 0.18, { cast: false }); box(g, w - 0.06, hgt * 0.16, 0.02, M("#d9c8a0", 0.5), 0, hgt * 0.86, 0.18, { cast: false }); obs.push([x - w / 2 - 0.05, z - 0.25, x + w / 2 + 0.05, z + 0.25]); return g; };
  amp(3.6, -5.4, 0.62, 0.62, -0.2);
  amp(6.35, -4.3, 0.7, 1.05, -0.5);
  // 기타 스탠드 (아무도 없을 때만 보여요)
  const idleGtr = {};
  for (const [sid, kind, dx, dz] of [["WG", "egtr", 0.75, -0.35], ["WB", "bass", 0.7, -0.45]]) {
    const st = JAM_SEATS[sid], g = new T.Group(); g.position.set(st.x + dx, 0, st.z + dz); s.add(g);
    for (const sx of [-1, 1]) { const l = box(g, 0.02, 0.5, 0.02, blackM, sx * 0.1, 0.22, 0); l.rotation.z = sx * 0.3; }
    const gt = makeEGuitar(kind); gt.position.set(0, 0.62, 0.02); gt.rotation.set(0, 0, Math.PI / 2 - 0.12); g.add(gt);
    idleGtr[sid] = gt;
  }
  // 🎤 마이크 스탠드 (리더 + 싱어 5)
  for (const sid of ["WL", "WS-0", "WS-1", "WS-2", "WS-3", "WS-4"]) {
    const st = JAM_SEATS[sid], m = makeMicStand(sid === "WL" ? 1.45 : 1.38);
    m.position.set(st.x + Math.sin(st.rot) * 0.5, 0, st.z + Math.cos(st.rot) * 0.5); m.rotation.y = st.rot + Math.PI; s.add(m);
    obs.push([m.position.x - 0.09, m.position.z - 0.09, m.position.x + 0.09, m.position.z + 0.09]);
  }
  // 인도자 앞 모니터 스피커 + 보면대
  for (const x of [-0.7, 0.7]) { const w = box(s, 0.6, 0.32, 0.4, M("#1c1c1c", 0.6), x, 0.16, 0.25, { ry: 0 }); w.rotation.x = -0.35; obs.push([x - 0.32, 0.05, x + 0.32, 0.45]); }
  { const g = new T.Group(); g.position.set(-0.75, 0, -0.75); g.rotation.y = 0.5; s.add(g); cyl(g, 0.012, 0.012, 1.0, blackM, 0, 0.5, 0, 6); const sh = box(g, 0.44, 0.3, 0.02, blackM, 0, 1.08, 0); sh.rotation.x = -0.45; obs.push([-0.9, -0.9, -0.6, -0.6]); }
  // 자리 (서서 연주하는 자리는 stand, 드럼만 앉아요)
  const seatMesh = {};
  for (const [sid, st] of Object.entries(JAM_SEATS)) {
    seats[sid] = { x: st.x, z: st.z, rot: st.rot, h: st.sit || 0, stand: !st.sit, ax: st.x, az: st.z, inst: st.inst, jamName: st.name };
    // 자리 표시 (바닥 동그라미) — 누르면 그 자리로 가요
    const mark = new T.Mesh(new T.RingGeometry(0.22, 0.3, 24), new T.MeshBasicMaterial({ color: st.inst === "lead" ? "#ffd166" : "#9ad1ff", transparent: true, opacity: 0.55 }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(st.x, 0.03, st.z); s.add(mark); seatMesh[sid] = mark;
    const hit = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 1.6, 10), new T.MeshBasicMaterial({ visible: false })); hit.position.set(st.x, 0.8, st.z); s.add(hit);
    seatGroupMark(hit, [sid]); clickables.push(hit);
    labels.push({ x: st.x, y: st.inst === "drums" ? 1.9 : 2.05, z: st.z, html: st.name, seat: sid, jam: true });
  }
  // 드럼·건반은 악기를 눌러도 그 자리로 가요
  seatGroupMark(kit, ["WD"]); clickables.push(kit);
  seatGroupMark(k0, ["WK-0"]); clickables.push(k0);
  seatGroupMark(k1, ["WK-1"]); clickables.push(k1);
  seatGroupMark(idleGtr.WG.parent, ["WG"]); clickables.push(idleGtr.WG.parent);
  seatGroupMark(idleGtr.WB.parent, ["WB"]); clickables.push(idleGtr.WB.parent);

  // ── 💿 리빙리버 CD 코너 (오른쪽 벽) ──
  const shelf = new T.Group(); shelf.position.set(HX - 0.16, 0, 2.2); shelf.rotation.y = -Math.PI / 2; s.add(shelf);
  const woodM = M("#8a5a34", 0.7);
  for (const y of [1.25, 1.75]) box(shelf, 2.3, 0.04, 0.26, woodM, 0, y, 0);
  LR_CDS.forEach(([, title, col], i) => {
    const row = i < 4 ? 0 : 1, k = row ? i - 4 : i;
    const c = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.04), [M(col, 0.5), M(col, 0.5), M(col, 0.5), M(col, 0.5), new T.MeshStandardMaterial({ map: cdLabelTex(title, col), roughness: 0.4 }), M("#222", 0.5)]);
    c.position.set(-0.85 + k * 0.56, (row ? 1.77 : 1.27) + 0.21, 0.04); c.rotation.x = -0.12; shelf.add(c);
  });
  const play = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.04), [M("#1b5e8c"), M("#1b5e8c"), M("#1b5e8c"), M("#1b5e8c"), new T.MeshStandardMaterial({ map: textTex([["▶", 120, 110], ["전체", 52, 200]], { w: 256, h: 256, bg: "#1b5e8c" }) }), M("#222")]);
  play.position.set(-0.85 + 2 * 0.56 + 0.28, 1.98, 0.04); shelf.add(play);
  const player = new T.Group(); player.position.set(HX - 0.55, 0, 4.0); s.add(player);
  box(player, 0.8, 0.72, 0.6, woodM, 0, 0.36, 0);
  box(player, 0.7, 0.14, 0.5, M("#2b2b2b", 0.4), 0, 0.79, 0);
  for (const sz of [-0.42, 0.42]) { box(player, 0.3, 0.42, 0.3, M("#1e1e1e", 0.5), 0.1, 0.93, sz * 1.15); cyl(player, 0.1, 0.1, 0.02, M("#555", 0.6), -0.06, 0.95, sz * 1.15, 14).rotation.z = Math.PI / 2; }
  const disc = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.01, 32), [M("#ddd", 0.2, { metalness: 0.8 }), new T.MeshStandardMaterial({ map: cdLabelTex("리빙리버", "#2e8c84"), roughness: 0.3, metalness: 0.3 }), M("#ddd")]);
  disc.position.set(0, 0.875, 0); player.add(disc);
  shelf.traverse((m) => (m.userData.action = "cd")); player.traverse((m) => (m.userData.action = "cd"));
  clickables.push(shelf, player);
  obs.push([HX - 0.35, 1.0, HX, 3.4], [HX - 0.95, 3.4, HX, 4.6]);
  labels.push({ x: HX - 0.4, y: 2.55, z: 2.6, html: "💿 리빙리버 CD · 눌러서 듣기", action: "cd" });
  // 듣는 의자 4개 (무대를 바라봐요)
  [[-2.1, 3.4], [-0.7, 3.5], [0.7, 3.5], [2.1, 3.4]].forEach(([x, z], i) => {
    const id = `PC-${i}`, rot = Math.PI + (x > 0 ? 0.08 : -0.08) * (Math.abs(x) > 1 ? 1 : 0);
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; s.add(g);
    const chairM = M("#2f3d57", 0.6);
    box(g, 0.46, 0.06, 0.44, chairM, 0, 0.45, 0); box(g, 0.46, 0.42, 0.05, chairM, 0, 0.72, -0.21);
    for (const lx of [-0.2, 0.2]) for (const lz of [-0.18, 0.18]) box(g, 0.03, 0.45, 0.03, metal, lx, 0.22, lz);
    seats[id] = { x, z, rot, h: 0.47, ax: x + Math.sin(rot) * 0.6, az: z + Math.cos(rot) * 0.6 };
    seatGroupMark(g, [id]); clickables.push(g);
    obs.push([x - 0.27, z - 0.27, x + 0.27, z + 0.27]);
  });
  // ── 📝 추천찬양 보드 (왼쪽 벽) ──
  const recMat = new T.MeshStandardMaterial({ map: recBoardTex([]), roughness: 0.85, emissive: "#ffffff", emissiveIntensity: 0.1 });
  recMat.emissiveMap = recMat.map;
  const rb = new T.Mesh(new T.PlaneGeometry(3.1, 1.94), recMat); rb.position.set(-HX + 0.03, 1.9, 2.4); rb.rotation.y = Math.PI / 2; walls.left.add(rb);
  rb.userData.action = "rec"; clickables.push(rb);
  labels.push({ x: -HX + 0.3, y: 3.15, z: 2.4, html: "📝 추천 찬양 남기기", action: "rec" });
  // ── 크리스마스: 왼쪽 구석 트리, 뒷벽 전구 줄 ──
  const tw = [];
  const deco = decoBegin(s);
  const xt = makeXmasTree(2.0, tw); xt.position.set(-6.75, 0, -0.25); s.add(xt);
  obs.push([-HX, -0.95, -6.05, 0.45]);
  lightRun(walls.back, tw, [[-HX + 0.1, 3.6, -HZ + 0.1], [-3.5, 3.6, -HZ + 0.1], [0, 3.6, -HZ + 0.1], [3.5, 3.6, -HZ + 0.1], [HX - 0.1, 3.6, -HZ + 0.1]], 10, 0.16);
  decoEnd(s, deco, "christmas");
  // 문 (앞쪽 벽, 왼쪽)
  addDoor(walls.front, -5.0, HZ - 0.04, Math.PI, labels, doors, clickables, "#1f4e79");
  doors.push({ x: -5.0, z: HZ - 0.8, to: "yard" });
  labels.push({ x: -5.0, y: 2.7, z: HZ - 0.2, html: "🚪 마당으로", to: "yard" });
  return { scene: s, seats, obs, clickables, doors, labels, wallHide, ceil, ceilY: CH, tw, recMat, disc, idleGtr, seatMarks: seatMesh,
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ }, cell: 0.2, pad: 0.2,
    cam: { pitch: 0.8, dist: 12, min: 4, max: 18 }, spawn: { def: { x: -5.0, z: HZ - 1.3 } }, spread: { def: [0.9, 0.45] } };
}

/* ---------------- 월드 ---------------- */
// 누운 자세 회전: 몸(위쪽) → 소파 길이 방향, 얼굴(앞쪽) → 하늘
const LIE_Q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0, 0, 1), new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0)));
const World = {
  ver: "2026-11-18k", // 🔖 app.js의 WORLD_VER와 같아야 해요 (다르면 화면 위에 '파일이 덜 올라갔어요' 안내)
  LOOK, safeLook, makeCharacter, poseCharacter,
  renderer: null, camera: null, rooms: {}, room: null, roomName: null,
  actors: new Map(), hooks: null, el: null, overlay: null,
  cam: { yaw: 0, pitch: 0.5, dist: 12, target: new T.Vector3() },
  keys: new Set(),
  traceGroup: null, traceLabels: [],
  focusId: null, focusUntil: 0,

  init(el, overlay, hooks) {
    this.el = el; this.overlay = overlay; this.hooks = hooks;
    const r = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputEncoding = T.sRGBEncoding;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    el.prepend(r.domElement);
    this.renderer = r;
    this.camera = new T.PerspectiveCamera(50, 1, 0.1, 200);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(el); // 위 줄 높이가 바뀌어도 화면을 꽉 채워요
    this.bindInput();
    this.clock = new T.Clock();
    const loop = () => { this.frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  resize() {
    const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + "px"; this.renderer.domElement.style.height = h + "px";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  },
  getRoom(name) {
    if (!this.rooms[name]) {
      SEASONAL = [];
      const b = ({ yard: buildYard, worship: buildWorship, cafe: buildCafe, vision: buildVision, room301: buildRoom301, praise: buildPraise, showroom: buildShowroomRoom }[name] || buildYard)();
      b.grid = new Grid(b.bounds, b.obs, b.cell, b.pad);
      if (b.initCats) b.initCats(b.grid);
      b.labelEls = [];
      this.rooms[name] = b;
      if (b.quizMat && this.quizInfo[name]) { this.rooms[name] = b; this.setQuizBoard(this.quizInfo[name], name); }
      b.seasonal = SEASONAL; SEASONAL = [];
      if (name === "yard") for (const k of ["schedBoard", "sportBoard"]) if (this.boards[k]) { this.rooms[name] = b; this.setBoard(k, this.boards[k]); }
      if (name === "worship") { this.rooms[name] = b; this.setThanks(this.thanksN); }
      if (name === "yard" && this.cookieN != null) { this.rooms[name] = b; this.setCookieCount(this.cookieN); }
      if (name === "yard" && this.rinkTop) { this.rooms[name] = b; this.setRinkBoard(this.rinkTop); }
      if (name === "yard" && this.walkVerses) { this.rooms[name] = b; this.setWalk(); }
      if (name === "yard" && this.listenInfo) { this.rooms[name] = b; this.setListenBoard(this.listenInfo); }
      if (name === "vision" && this.habitRows) { this.rooms[name] = b; this.setHabitBoard(this.habitRows); }
      if (name === "praise" && this.recList.length) { this.rooms[name] = b; this.setRecBoard(this.recList); }
      this.applySeasons(b); if (b.night) this.applyNight(b);
    }
    return this.rooms[name];
  },
  setRoom(name) {
    for (const a of this.actors.values()) this.removeActor(a);
    this.actors.clear();
    for (const f of this.trail) f.g.parent && f.g.parent.remove(f.g); this.trail = [];
    this.clearTraces();
    this.room = this.getRoom(name); this.roomName = name;
    this.overlay.querySelectorAll(".door-label, .cat-label").forEach((e) => e.remove());
    this.catLabels = (this.room.cats || []).map((c) => { const e = document.createElement("div"); e.className = "cat-label"; e.textContent = "🐱 " + c.def.name + " " + (c.def.sex || ""); this.overlay.append(e); return { c, el: e }; });
    this.room.labelEls = this.room.labels.map((l) => { const e = document.createElement("button"); e.className = "door-label" + (l.zone ? " zone-label" : ""); e.textContent = l.html; if (l.to) e.onclick = () => this.goDoor(l.to); if (l.action) e.onclick = () => this.hooks.onAction && this.hooks.onAction(l.action); if (l.seat) { e.classList.add("jam-label"); e.onclick = () => { const st = this.room.seats[l.seat]; this.sitNear([l.seat], { x: st.x, z: st.z }); }; } this.overlay.append(e); return { ...l, el: e }; });
    const c = this.room.cam;
    this.cam.yaw = 0; this.cam.pitch = c.pitch; this.cam.dist = c.dist; this.camInit = false; this.camCenter = 0; this.camTurn = false;
    this.focusId = null;
  },
  // 들어올 때 서는 자리: 문 앞에서 넓게 퍼지고, 이미 서 있는 사람과 겹치지 않게
  spawnFor(name, from, avoid) {
    const r = this.getRoom(name), key = from && r.spawn[from] ? from : "def", sp = r.spawn[key];
    const [sx, sz] = (r.spread && (r.spread[key] || r.spread.def)) || [1, 0.6];
    const others = (avoid || []).filter((p) => p && isFinite(p.x) && isFinite(p.z));
    let best = null, bestD = -1;
    for (let k = 0; k < 14; k++) {
      const p = r.grid.nearest(sp.x + (Math.random() - 0.5) * 2 * sx, sp.z + (Math.random() - 0.5) * 2 * sz);
      const d = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - p.x, o.z - p.z))) : 99;
      if (d > bestD) { best = p; bestD = d; }
      if (d > 0.9) break;
    }
    return { x: +best.x.toFixed(2), z: +best.z.toFixed(2) };
  },
  roomPositions() { return [...this.actors.values()].map((a) => ({ x: a.pos.x, z: a.pos.z })); },

  /* ----- 사람 ----- */
  validPos(p) {
    const r = this.room, sp = p.seat && r.seats[p.seat];
    if (sp) return { x: sp.x, z: sp.z, seat: p.seat };
    const x = Number(p.pos && p.pos.x), z = Number(p.pos && p.pos.z);
    if (!isFinite(x) || !isFinite(z)) { const d = r.spawn.def; return { x: d.x, z: d.z, seat: null }; }
    const b = r.bounds, cx = Math.max(b.x0, Math.min(b.x1, x)), cz = Math.max(b.z0, Math.min(b.z1, z));
    if (r.grid && !r.grid.free(cx, cz)) { const q = r.grid.nearest(cx, cz); return { x: q.x, z: q.z, seat: null }; }
    return { x: cx, z: cz, seat: null };
  },
  makeActor(p, pos) {
    const look = safeLook(p), key = lookKeyOf(look);
    const ch = makeCharacter(look);
    const outer = new T.Group(); outer.add(ch.group);
    outer.position.set(pos.x, 0, pos.z);
    this.room.scene.add(outer);
    const ov = document.createElement("div"); ov.className = "ov"; ov.dataset.id = p.id; this.overlay.append(ov);
    const ring = new T.Mesh(new T.RingGeometry(0.32, 0.4, 28), new T.MeshBasicMaterial({ color: "#f0a050", transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = p.id === this.hooks.myId; outer.add(ring);
    return { id: p.id, ch, outer, ring, look, lookKey: key, sledN: p.sled && p.sled.n, eatN: p.eatN, carryKind: null, carryMesh: null, ov, pos: { x: pos.x, z: pos.z }, seat: pos.seat, goal: { ...pos }, path: [], yaw: pos.seat ? this.room.seats[pos.seat].rot : 0, data: p, arrivedSeat: pos.seat };
  },
  removeActor(a) { a.outer.parent && a.outer.parent.remove(a.outer); a.ov.remove(); this.dropPet(a); },
  /* ----- 🐱 따라다니는 고양이 (마당에서만) ----- */
  // 2026-11-18: 고양이 여러 마리 (a.pets: 번호 → 고양이). 99 = 🦁 다니엘의 사자 (어느 방이든)
  dropPet(a, keepReturn) {
    if (a.pets) for (const m of a.pets.values()) {
      if (keepReturn && m.k !== 99 && this.roomName === "yard") { m.returnT = performance.now(); (this.returning = this.returning || []).push(m); } // 콘도로 걸어서 돌아가요
      else m.group.parent && m.group.parent.remove(m.group);
    }
    a.pets = new Map(); a.pet = null; a.petKey = "";
  },
  syncPet(a, look) {
    const want = look.costume === "daniel" ? [99] : [];
    if (this.roomName === "yard") for (const k of look.pets || []) if (CATS[k]) want.push(k);
    const key = want.join(",");
    if (a.petKey === key && a.pets) return;
    if (!a.pets) a.pets = new Map();
    for (const [k, m] of [...a.pets]) if (!want.includes(k)) { // 산책이 끝난 고양이는 콘도로 돌아가요
      a.pets.delete(k);
      if (k !== 99 && this.roomName === "yard") { m.returnT = performance.now(); (this.returning = this.returning || []).push(m); } else m.group.parent && m.group.parent.remove(m.group);
    }
    const o = a.outer.position;
    for (const k of want) if (!a.pets.has(k)) {
      const m = k === 99 ? makeLion() : makeCat(CATS[k]); if (k !== 99) m.group.scale.multiplyScalar(0.9);
      m.group.traverse((x) => (x.userData.action = "pet:" + a.id + ":" + k)); this.room.clickables.push(m.group);
      const c = k !== 99 && this.room.cats && this.room.cats[k] && this.room.cats[k].pos; // 마당에 있던 그 고양이 자리에서 출발
      m.x = c ? c.x : o.x - 0.6; m.z = c ? c.z : o.z + 0.4; m.yaw = 0; m.petUntil = 0; m.k = k; m.slot = a.pets.size;
      m.nextWander = performance.now() + 50000 + Math.random() * 70000;
      m.group.position.set(m.x, 0, m.z); this.room.scene.add(m.group); a.pets.set(k, m);
    }
    let j = 0; for (const m of a.pets.values()) m.slot = j++;
    a.pet = a.pets.values().next().value || null; a.petKey = key;
  },
  petFrame(a, dt, t) {
    const o = a.outer.position, yaw = a.outer.rotation.y, now = performance.now();
    const SL = [[0.75, 0.45], [0.75, -0.45], [1.35, 0], [1.35, 0.85], [1.35, -0.85], [1.9, 0.4]];
    for (const P of a.pets.values()) {
      const [bk, sd] = SL[P.slot % SL.length];
      let tx = o.x - Math.sin(yaw) * bk + Math.cos(yaw) * sd, tz = o.z - Math.cos(yaw) * bk - Math.sin(yaw) * sd;
      // 🐈‍⬛ 까맹이는 독립적이라 가끔 혼자 딴 데 갔다가 돌아와요 (👑 대장이면 안 그래요)
      if (P.k === 1 && !(a.look && a.look.catBoss)) {
        if (!P.wander && now > P.nextWander) { const ang = Math.random() * Math.PI * 2; P.wander = { x: o.x + Math.cos(ang) * 4, z: o.z + Math.sin(ang) * 4, until: now + 14000 }; }
        if (P.wander) { if (now > P.wander.until) { P.wander = null; P.nextWander = now + 60000 + Math.random() * 90000; } else { tx = P.wander.x; tz = P.wander.z; } }
      }
      let dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz), walking = false;
      if (d > 14) { P.x = tx; P.z = tz; d = 0; } // 너무 멀어지면 (썰매 등) 옆으로 쏙
      if (d > 0.3) { const sp = Math.min(d, dt * Math.min(6.5, 1.2 + d * 2.2)); P.x += dx / d * sp; P.z += dz / d * sp; P.yaw = Math.atan2(dx, dz); walking = true; }
      else { let dY = yaw - P.yaw; dY = Math.atan2(Math.sin(dY), Math.cos(dY)); P.yaw += dY * Math.min(1, dt * 3); }
      P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.yaw;
      catPose(P, walking, false, t, now < P.petUntil, P.k);
      P.pos = { x: P.x, z: P.z };
    }
  },
  // 산책이 끝난 고양이: 콘도(-21, -9.7)로 걸어가서 사라지면 마당의 원래 고양이가 다시 보여요
  returnFrame(dt, t) {
    if (!this.returning || !this.returning.length) return;
    this.returning = this.returning.filter((P) => {
      const dx = -21 - P.x, dz = -8.2 - P.z, d = Math.hypot(dx, dz);
      if (d < 0.6 || performance.now() - P.returnT > 30000 || this.roomName !== "yard") { P.group.parent && P.group.parent.remove(P.group); return false; }
      const sp = Math.min(d, dt * 2.2); P.x += dx / d * sp; P.z += dz / d * sp; P.yaw = Math.atan2(dx, dz);
      P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.yaw; catPose(P, true, false, t, false, P.k); P.pos = { x: P.x, z: P.z };
      return true;
    });
  },
  /* ----- 🌱 새싹 발자국 (기도 30번) ----- */
  trailFrame(a, walking, dt) {
    if (!walking || a.look.trail !== "sprout" || a.lyingNow) { a.trailAt = null; return; }
    const o = a.outer.position;
    if (!a.trailAt) { a.trailAt = { x: o.x, z: o.z, n: 0 }; return; }
    if (Math.hypot(o.x - a.trailAt.x, o.z - a.trailAt.z) < 0.55) return;
    a.trailAt = { x: o.x, z: o.z, n: a.trailAt.n + 1 };
    if (this.trail.length > 70) { const old = this.trail.shift(); old.g.parent && old.g.parent.remove(old.g); }
    const g = makeSprout(a.trailAt.n % 3 === 0 ? 2 : 1, false), yaw = a.outer.rotation.y, side = a.trailAt.n % 2 ? 0.1 : -0.1;
    g.position.set(o.x + Math.cos(yaw) * side, 0.0, o.z - Math.sin(yaw) * side); g.rotation.y = Math.random() * 6; g.scale.setScalar(0.01);
    this.room.scene.add(g); this.trail.push({ g, t0: performance.now() });
  },
  trailUpdate() {
    if (!this.trail.length) return;
    const now = performance.now();
    this.trail = this.trail.filter((f) => {
      const e = (now - f.t0) / 1000;
      if (e > 2.8) { f.g.parent && f.g.parent.remove(f.g); return false; }
      const sc = e < 0.35 ? e / 0.35 : e > 2.2 ? Math.max(0.01, (2.8 - e) / 0.6) : 1;
      f.g.scale.setScalar(0.85 * sc); return true;
    });
  },
  trail: [],
  planPath(fromPos, fromSeat, to) {
    const r = this.room, pts = [];
    let start = fromPos;
    if (fromSeat && r.seats[fromSeat]) { const s = r.seats[fromSeat]; start = { x: s.ax, z: s.az }; pts.push(start); }
    const goalSeat = to.seat && r.seats[to.seat];
    const goal = goalSeat ? { x: goalSeat.ax, z: goalSeat.az } : { x: to.x, z: to.z };
    pts.push(...r.grid.find(start, goal));
    if (goalSeat) pts.push({ x: goalSeat.x, z: goalSeat.z, seat: to.seat });
    return pts;
  },
  sync(peers) {
    if (!this.room) return;
    const seen = new Set();
    for (const p of peers) {
      seen.add(p.id);
      const tgt = this.validPos(p);
      let a = this.actors.get(p.id);
      const look = safeLook(p), key = lookKeyOf(look);
      if (a && a.lookKey !== key) { const keep = a; this.removeActor(a); a = this.makeActor(p, { x: keep.pos.x, z: keep.pos.z, seat: keep.seat }); a.path = keep.path; a.goal = keep.goal; a.yaw = keep.yaw; this.actors.set(p.id, a); this.setCarry(a, p.carry); }
      if (!a) { a = this.makeActor(p, tgt); this.actors.set(p.id, a); this.setCarry(a, p.carry); }
      else if (p.sled && p.sled.n !== a.sledN && this.roomName === "yard") {
        // 눈썰매 시작: 언덕을 올라가서 → 썰매 타고 → 내려와요 (모두의 화면에서 같은 장면)
        a.sledN = p.sled.n; a.path = []; a.seat = null;
        a.sledAnim = { t0: performance.now(), lane: HILL.lanes[p.sled.lane % HILL.lanes.length], from: { x: a.pos.x, z: a.pos.z } };
      }
      else if (!a.sledAnim && (Math.hypot(a.goal.x - tgt.x, a.goal.z - tgt.z) > 0.01 || a.goal.seat !== tgt.seat)) {
        if (p.id !== this.hooks.myId) { a.path = this.planPath(a.pos, a.seat, tgt); a.seat = null; }
      }
      a.goal = tgt; a.data = p; a.look = look;
      this.syncPet(a, look);
      // 간식: 먹기 시작하면 1.5초 냠냠한 뒤 사라져요
      if (p.eatN != null && p.eatN !== a.eatN) { const was = a.eatN; a.eatN = p.eatN; if (was != null && a.carryKind) { a.eatAnim = { t0: performance.now() }; this.hooks.onEatSeen && this.hooks.onEatSeen(p.id, a.carryKind); } }
      if (!a.eatAnim && (p.carry || null) !== a.carryKind) this.setCarry(a, p.carry || null);
      this.hooks.renderOverlay(a.ov, p, p.id === this.hooks.myId);
    }
    for (const [id, a] of this.actors) if (!seen.has(id)) { this.removeActor(a); this.actors.delete(id); }
  },
  me() { return this.actors.get(this.hooks.myId); },
  setCarry(a, kind) {
    kind = kind && CARRY[kind] ? kind : null;
    if (a.carryMesh) { a.carryMesh.parent && a.carryMesh.parent.remove(a.carryMesh); a.carryMesh = null; }
    if (kind) { a.carryMesh = makeCarry(kind); a.ch.armL.add(a.carryMesh); }
    a.carryKind = kind; a.ch.carry = !!kind;
  },
  CARRY,
  // 트럭 간판 숫자 바꾸기 { tako: { made, left }, bungeo: {...} }
  setTruckCounts(c) {
    const r = this.rooms.yard; if (!r || !r.trucks) return;
    for (const k of Object.keys(r.trucks)) {
      const v = c[k]; if (!v) continue; const tr = r.trucks[k], key = [v.made, v.left, v.sold, v.queue, v.open].join("|");
      truckCustomers(tr, v);
      if (tr.key === key) continue; tr.key = key;
      const old = tr.signMat.map; tr.signMat.map = truckSignTex(tr.opts, v); tr.signMat.needsUpdate = true; old && old.dispose();
      const ob = tr.boardMat.map; tr.boardMat.map = truckBoardTex(tr.opts, v); tr.boardMat.needsUpdate = true; ob && ob.dispose();
    }
  },
  // 고양이 쓰다듬기: 하트 💕 + 고개 들기
  petCat(i) {
    let c = this.room && this.room.cats && this.room.cats[i]; if (!c || !c.pos) return null;
    for (const a of this.actors.values()) if (a.pets && a.pets.has(i)) { c = a.pets.get(i); break; } // 누구를 따라다니는 중이면 그 고양이를
    if (!c.pos) return null;
    c.petUntil = performance.now() + 2500;
    const v = new T.Vector3(c.pos.x, 0.9, c.pos.z).project(this.camera), rect = this.renderer.domElement.getBoundingClientRect();
    const f = document.createElement("div"); f.className = "floater"; f.textContent = "💕";
    f.style.left = rect.left + (v.x * 0.5 + 0.5) * rect.width + "px"; f.style.top = rect.top + (-v.y * 0.5 + 0.5) * rect.height + "px";
    document.body.append(f); setTimeout(() => f.remove(), 1700);
    return c.def || CATS[i];
  },
  // 따라다니는 고양이를 누르면: 그 고양이 번호와 주인 이름
  petOf(id, k) { const a = this.actors.get(id); if (!a || !a.pets || !a.pets.size) return null; const m = k != null && a.pets.has(k) ? a.pets.get(k) : a.pet; return m ? { i: m.k, owner: a.data && a.data.name } : null; },
  seatFree(id) { return !this.occupied().has(id); },
  // 고양이 밥: atMs(밥 준 시각)부터 70초 동안 고양이들이 밥그릇으로 와서 먹어요
  catFeed(atMs) { const r = this.rooms.yard; if (r && r.catState) r.catState.feedUntil = Math.max(r.catState.feedUntil, atMs + 70000); },
  setCatFeedLog(info) {
    const r = this.rooms.yard; if (!r || !r.feedMat) return;
    const key = JSON.stringify(info); if (r.feedKey === key) return; r.feedKey = key;
    const old = r.feedMat.map; r.feedMat.map = feedLogTex(info); r.feedMat.needsUpdate = true; old && old.dispose();
  },
  catFeedSpot() { const r = this.rooms.yard; return r && r.feedSpot; },
  // 🧀 쇼룸 칠판: 청년부가 만든 박스 수
  setCookieCount(n) {
    this.cookieN = n; const r = this.rooms.yard; if (!r || !r.showroom) return;
    if (r.showroom.key === n) return; r.showroom.key = n;
    const old = r.showroom.boardMat.map; r.showroom.boardMat.map = showBoardTex(n); r.showroom.boardMat.needsUpdate = true; old && old.dispose();
  },
  // 👏 박수 동작 (1.6초)
  clap(id) { const a = this.actors && this.actors.get ? this.actors.get(id) : null; if (a) a.clapUntil = performance.now() + 1600; },
  // 내 자리가 스케이트장 구경 자리(벤치·펜스)인지
  rinkSeat(seat) { return !!(this.roomName === "yard" && this.room && seat && this.room.seats[seat] && this.room.seats[seat].rink); },
  // 🌿 말씀 산책길: 오늘의 말씀 7개 · 몇 번째까지 지났는지 (done = 지난 표지판 수)
  setWalk(verses, done) {
    if (verses) this.walkVerses = verses; if (done != null) this.walkDone = done;
    const r = this.rooms.yard; if (!r || !r.backyard) return;
    const B = r.backyard, vs = this.walkVerses || [], dn = this.walkDone || 0, key = JSON.stringify([vs.map((v) => v.ref), dn]);
    if (B.key === key) return; B.key = key;
    for (const sg of B.signs) { const done = sg.i < dn, old = sg.mat.map; sg.mat.map = walkSignTex(vs[sg.i], sg.i, done); sg.mat.needsUpdate = true; old && old.dispose(); sg.on = done; sg.glow.material.emissiveIntensity = done ? 1 : 0; sg.frame.color.set(done ? "#e0a92a" : "#8a6a44"); }
  },
  setHabitBoard(rows) { this.habitRows = rows; const r = this.rooms.vision; if (!r || !r.habitMat) return; const key = JSON.stringify(rows); if (r.hkey === key) return; r.hkey = key; const old = r.habitMat.map; r.habitMat.map = habitBoardTex(rows); r.habitMat.needsUpdate = true; old && old.dispose(); },
  // 🪨 물수제비 던지기 (모두의 화면에서 같은 돌): 던진 사람 위치·방향·튈 횟수
  skipStone(id, x, z, ang, n) { const r = this.rooms.yard; if (!r || !r.backyard || this.roomName !== "yard") return 0; this.prank(id, "push"); return r.backyard.skip(x, z, ang, n); },
  lakeShore(x, z) { const e = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz); return e > 0.95 && e < 1.75; },
  camYaw() { return this.cam ? this.cam.yaw : 0; },
  FIRE, WALK, ZONES, LISTEN, LAKE,
  // 🎶 청음회 안내판
  setListenBoard(info) { this.listenInfo = info; const r = this.rooms.yard; if (!r || !r.backyard) return; const key = JSON.stringify(info); if (r.backyard.lkey === key) return; r.backyard.lkey = key; const m = r.backyard.listenMat, old = m.map; m.map = listenBoardTex(info); m.needsUpdate = true; old && old.dispose(); },
  // 지금 내가 있는 구역 (마당)
  zoneOf(x, z) { const zz = zoneAt(x, z); return zz ? { id: zz.id, name: zz.name, x: zz.x, z: zz.z } : null; },
  // 🏆 스케이트장 랭킹판 바꾸기 ({figure:[{name,score}], speed:[...]})
  setRinkBoard(d) {
    this.rinkTop = d; const r = this.rooms.yard; if (!r || !r.rink) return;
    const key = JSON.stringify(d); if (r.rink.key === key) return; r.rink.key = key;
    const old = r.rink.boardMat.map; r.rink.boardMat.map = rinkBoardTex(d); r.rink.boardMat.needsUpdate = true; old && old.dispose();
  },
  SHOW, AD, COSTUMES, RINK, FIGURES, onIce, rinkRacePos, rinkLapLen, raceMe: null,
  // 경주가 끝나면 내 캐릭터를 그 자리에 세워요
  placeMe(x, z) { const a = this.me(); if (!a) return; a.pos.x = x; a.pos.z = z; a.path = []; a.goal = { x, z, seat: null }; a.seat = null; },
  CATS,
  canLie(seat) { return !!(this.room && seat && this.room.seats[seat] && this.room.seats[seat].lie); },
  // 그 소파에 나 말고 아무도 없을 때만 누울 수 있어요
  sofaFree(seat) {
    if (!this.canLie(seat)) return false;
    const pre = seat.split("-")[0] + "-", occ = this.occupied();
    return !Object.keys(this.room.seats).some((id) => id.startsWith(pre) && occ.has(id));
  },
  // 301호 방명록 보드 다시 그리기
  setGuestbook(room, list) {
    const r = this.rooms[room]; if (!r || !r.gbMat) return;
    const old = r.gbMat.map; r.gbMat.map = guestbookTex(list, room === "vision" ? "비전" : "301호 3Q"); r.gbMat.needsUpdate = true; old && old.dispose();
  },
  /* ----- 게시판 · 감사 나무 · 팀 색 ----- */
  boards: {}, thanksN: 0, teams: {},
  setBoard(key, rows) { // key: schedBoard | sportBoard (마당)
    this.boards[key] = rows; const r = this.rooms.yard, b = r && r[key]; if (!b) return;
    const old = b.mat.map; b.mat.map = boardTex(b.title, rows, b.opt); b.mat.needsUpdate = true; old && old.dispose();
  },
  setThanks(n) { this.thanksN = n; const r = this.rooms.worship; if (r && r.thanks) r.thanks.userData.fruits.children.forEach((f, i) => (f.visible = i < n)); },
  setTeams(map) { this.teams = map || {}; },
  /* ----- 계절 · 밤 ----- */
  seasons: new Set(autoSeasons()), nightK: autoNight(), autoSeasons, autoNight,
  setSeasons(tags) { this.seasons = new Set(tags); for (const r of Object.values(this.rooms)) this.applySeasons(r); },
  applySeasons(r) { if (!r.seasonal || !this.seasons) return; for (const o of r.seasonal) o.visible = this.seasons.has(o.userData.season); if (this.lite) r.scene.traverse((o) => { if (o.isPoints) o.visible = false; }); },
  setNight(k) { this.nightK = Math.max(0, Math.min(1, k)); const r = this.rooms.yard; if (r) this.applyNight(r); },
  applyNight(r) {
    const n = r.night, k = this.nightK; if (!n) return;
    r.scene.background.copy(n.dayBg).lerp(n.nightBg, k); r.scene.fog.color.copy(n.dayFog).lerp(n.nightFog, k);
    n.hemi.intensity = n.base.hemi * (1 - 0.6 * k); n.sun.intensity = n.base.sun * (1 - 0.9 * k); if (n.amb) n.amb.intensity = n.base.amb * (1 - 0.5 * k);
    n.hemi.color.copy(n.base.sky).lerp(n.nightSky, k); n.hemi.groundColor.copy(n.base.ground).lerp(n.nightGround, k);
    n.sun.color.set(k > 0.5 ? "#9fb4ff" : "#fff4e0");
    for (const L of n.pts) L.intensity = 0.75 * Math.max(0, k * 1.4 - 0.4);
    for (const m of n.lampMats) m.emissiveIntensity = n.base.lamp + 1.4 * k;
    n.stars.visible = k > 0.35; n.stars.material.opacity = Math.max(0, (k - 0.35) / 0.65);
  },
  /* ----- 🏀🎾🏸 운동장 (공 움직임은 app.js가 정해 주고, 여기서는 그리기만 해요) ----- */
  COURTS,
  bb: null, rally: {},
  setBB(st) { this.bb = st; },
  playRally(k, R) { R.t0 = performance.now(); R.hitIdx = -1; this.rally[k] = R; },
  actorPos(id) { const a = this.actors.get(id); return a ? { x: a.pos.x, z: a.pos.z, seat: a.seat, moving: a.path.length > 0 || !!a.kbWalking } : null; },
  markShoot(id) { const a = this.actors.get(id); if (a) a.shootT = performance.now(); },
  setCourtLabel(k, text) {
    const r = this.rooms.yard; if (!r) return;
    for (const l of r.labels) if (l.court === k) l.html = text;
    for (const l of r.labelEls || []) if (l.court === k) l.el.textContent = text;
  },
  swingFrame(r, dt) {
    const now = Date.now() / 1000;
    r.swings.forEach((sw, i) => {
      let occ = false;
      for (const a of this.actors.values()) if (a.seat === sw.id && !a.path.length) { occ = true; break; }
      sw.amp += ((occ ? 0.6 : 0) - sw.amp) * Math.min(1, dt * (occ ? 0.7 : 1.2));
      sw.ang = sw.amp * Math.sin(now * 2.3 + i * 1.7); // 시각으로 정해서 모두의 화면에서 거의 같이 흔들려요
      sw.pv.rotation.x = sw.ang;
    });
  },
  sportPose(a, seated, walking, t) {
    const now = performance.now(), court = seated && !walking && seated.court;
    if ((court || null) !== (a.racketKind || null)) {
      if (a.racket) { a.racket.parent && a.racket.parent.remove(a.racket); a.racket = null; }
      a.racketKind = court || null;
      if (court) { a.racket = makeRacket(court); a.ch.armR.add(a.racket); }
    }
    if (a.racket) {
      const sw = a.swingT ? (now - a.swingT) / 420 : 9;
      if (sw < 1) a.ch.armR.rotation.set(-2.5 + sw * 2.9, 0, -0.9 + sw * 0.6);
      else a.ch.armR.rotation.set(-1.1 + Math.sin(t * 2) * 0.05, 0, -0.35);
    }
    const bb = this.bb;
    if (bb && bb.holder === a.id && !bb.shot) {
      a.ch.armR.rotation.set(-0.55 + Math.abs(Math.sin(t * 7.5)) * 0.45, 0, -0.15);
    }
    if (a.shootT && now - a.shootT < 600) { const k = (now - a.shootT) / 600; a.ch.armR.rotation.set(-3.0 + k * 0.6, 0, -0.2); a.ch.armL.rotation.set(-3.0 + k * 0.6, 0, 0.2); }
  },
  /* ----- 🎸 찬양팀 연습실 ----- */
  LR_CDS, LR_PLAYLIST, JAM_SEATS, DANCES,
  onGrass(x, z) { return !NOT_GRASS.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1); },
  jamSeat(seat) { const r = this.room, st = r && seat && r.seats[seat]; return st && st.inst ? st : null; },
  // 누가 소리를 냈어요 → 그 사람이 잠깐 연주하는 몸짓을 해요
  jamHit(id, inst) { const a = this.actors.get(id); if (a) { a.jamT = performance.now(); a.jamHits = (a.jamHits || 0) + 1; } },
  /* 💃 춤추기 (찬양팀 연습실): 내 상태 dance = { k: 춤 이름, t0: 시작 시각(Date.now), bpm }
     시작 시각과 빠르기로 계산해서 모두의 화면에서 같은 박자로 춰요 */
  /* ----- ⛸ 스케이트: 얼음 위에서는 스케이트 날이 생기고, 미끄러지듯 걸어요 · 피겨 기술 ----- */
  skatePose(a, seated, walking, t, nowMs) {
    const ice = this.roomName === "yard" && !seated && !a.lyingNow && onIce(a.pos.x, a.pos.z);
    if (ice && !a.skates) {
      a.skates = [];
      for (const L of [a.ch.legL, a.ch.legR]) { const sk = new T.Group(); sk.position.set(0, -0.36, 0.03); L.add(sk); box(sk, 0.14, 0.05, 0.22, M("#fbfbf7", 0.5), 0, 0.0, 0); box(sk, 0.015, 0.05, 0.3, M("#c9d1d8", 0.15, { metalness: 0.9 }), 0, -0.05, 0.01); a.skates.push(sk); }
    }
    if (a.skates) for (const sk of a.skates) sk.visible = ice;
    const g = a.ch.group;
    if (!ice) { if (a.skating) { a.skating = false; g.rotation.x = 0; g.position.y = 0; } return; }
    a.skating = true;
    const fig = a.data && a.data.fig, fe = fig && FIGURES[fig.k] ? (nowMs - fig.t0) / 1000 : 99;
    if (fe >= 0 && fe < FIGURES[fig && fig.k ? fig.k : "spin"]?.dur) { this.figurePose(a, fig.k, fe, t); return; }
    g.position.y = 0;
    if (walking) { // 양발을 번갈아 옆으로 밀며 앞으로 숙여요
      const ph = Math.sin(t * 5 + a.id.charCodeAt(0));
      a.ch.legL.rotation.set(0.15, 0, Math.max(0, ph) * 0.45); a.ch.legR.rotation.set(0.15, 0, -Math.max(0, -ph) * 0.45);
      a.ch.armL.rotation.set(ph * 0.6, 0, 0.35); a.ch.armR.rotation.set(-ph * 0.6, 0, -0.35);
      g.rotation.x = a.racing ? 0.42 : 0.22;
    } else g.rotation.x = 0;
  },
  figurePose(a, k, e, t) {
    const g = a.ch.group, F = FIGURES[k], u = e / F.dur, L = a.ch.legL, R = a.ch.legR, AL = a.ch.armL, AR = a.ch.armR;
    g.rotation.x = 0; g.position.y = 0;
    const turn = (n, from, to) => { if (e > from && e < to) a.outer.rotation.y += ((n * Math.PI * 2) / (to - from)) * Math.min(0.05, this.clock ? 0.016 : 0.016); };
    if (k === "spin") { a.outer.rotation.y = a.yaw + e * 9; AL.rotation.set(-3.0, 0, 0.2); AR.rotation.set(-3.0, 0, -0.2); L.rotation.set(0, 0, 0); R.rotation.set(-0.9, 0, 0.3); }
    else if (k === "camel") { a.outer.rotation.y = a.yaw + e * 7; g.rotation.x = 1.1; R.rotation.set(-1.4, 0, 0); L.rotation.set(0, 0, 0); AL.rotation.set(0, 0, 1.4); AR.rotation.set(0, 0, -1.4); }
    else if (k === "layback") { a.outer.rotation.y = a.yaw + e * 5; g.rotation.x = -0.55; AL.rotation.set(-2.6, 0, 0.5); AR.rotation.set(-2.6, 0, -0.5); R.rotation.set(-0.6, 0, 0.2); }
    else if (k === "spiral") { a.outer.rotation.y = a.yaw; g.rotation.x = 0.9 * Math.min(1, e * 2); R.rotation.set(-1.7 * Math.min(1, e * 2), 0, 0); AL.rotation.set(-0.3, 0, 1.3); AR.rotation.set(-0.3, 0, -1.3); g.position.y = 0; }
    else if (k === "axel" || k === "triple") { // 점프: 뛰어올라 돌고 착지
      const air = k === "triple" ? 0.9 : 0.7, h = k === "triple" ? 0.85 : 0.6, n = k === "triple" ? 3.5 : 1.5, s0 = 0.35;
      if (e < s0) { g.rotation.x = 0.3; L.rotation.set(-0.5, 0, 0); R.rotation.set(-0.5, 0, 0); }
      else if (e < s0 + air) { const q = (e - s0) / air; g.position.y = 4 * h * q * (1 - q); a.outer.rotation.y = a.yaw + q * n * Math.PI * 2; AL.rotation.set(-0.3, 0, -0.2); AR.rotation.set(-0.3, 0, 0.2); L.rotation.set(0, 0, 0.1); R.rotation.set(-0.3, 0, -0.1); }
      else { a.outer.rotation.y = a.yaw + n * Math.PI * 2; R.rotation.set(-1.1, 0, 0); AL.rotation.set(0, 0, 1.3); AR.rotation.set(0, 0, -1.3); }
    } else if (k === "fall") { // 뛰어올랐다가 엉덩방아 → 일어나기
      if (e < 0.3) { g.rotation.x = 0.3; L.rotation.set(-0.5, 0, 0); R.rotation.set(-0.5, 0, 0); }
      else if (e < 0.85) { const q = (e - 0.3) / 0.55; g.position.y = 2.4 * q * (1 - q); a.outer.rotation.y = a.yaw + q * Math.PI * 3; }
      else if (e < 1.9) { const q = Math.min(1, (e - 0.85) * 5); a.outer.rotation.y = a.yaw + Math.PI * 3; g.position.y = -0.3 * q; g.rotation.x = -0.35 * q; L.rotation.set(-1.45 * q, 0, 0.15); R.rotation.set(-1.45 * q, 0, -0.15); AL.rotation.set(-0.6, 0, 0.9); AR.rotation.set(-0.6, 0, -0.9); }
      else { const q = 1 - (e - 1.9) / 0.5; a.outer.rotation.y = a.yaw + Math.PI * 3; g.position.y = -0.3 * q; g.rotation.x = -0.35 * q; L.rotation.set(-1.45 * q, 0, 0); R.rotation.set(-1.45 * q, 0, 0); }
    } else if (k === "bow") { a.outer.rotation.y = a.yaw; g.rotation.x = 0.6 * Math.sin(Math.min(1, u) * Math.PI); AL.rotation.set(0, 0, 0.9); AR.rotation.set(-0.5, 0, -0.2); R.rotation.set(0.3, 0, 0); }
    void turn; void t;
  },
  /* 🤪 장난: poke(어깨 툭 맞음) · push(툭 치는 쪽) · trip(다리 걸려 넘어짐) · sweep(다리 거는 쪽) */
  prank(id, k) { const a = this.actors && this.actors.get ? this.actors.get(id) : null; if (a) a.prank = { k, t0: performance.now() }; },
  prankPose(a, t) {
    const P = a.prank; if (!P) return;
    const e = (performance.now() - P.t0) / 1000, c = a.ch, g = c.group;
    const dur = { poke: 1.0, push: 0.6, trip: 2.2, sweep: 0.7 }[P.k] || 1;
    if (e > dur) { a.prank = null; g.rotation.x = 0; g.rotation.z = 0; g.position.y = 0; g.position.z = 0; c.head.rotation.set(0, 0, 0); c.body.rotation.set(0, 0, 0); return; }
    if (P.k === "poke") { // 화들짝! 깡충 + 고개 휙
      const q = Math.min(1, e * 6); g.position.y = e < 0.3 ? Math.sin(e / 0.3 * Math.PI) * 0.18 : 0;
      c.head.rotation.y = (e < 0.5 ? 1 : Math.max(0, 1 - (e - 0.5) * 2)) * 0.9 * q; c.body.rotation.z = Math.sin(e * 30) * 0.06 * (1 - e);
      c.armL.rotation.set(-0.4, 0, 0.6 * q); c.armR.rotation.set(-0.4, 0, -0.6 * q);
    } else if (P.k === "push") { const q = Math.sin(Math.min(1, e / 0.6) * Math.PI); c.armR.rotation.set(-1.5 * q, 0, -0.1); c.body.rotation.y = -0.25 * q; }
    else if (P.k === "sweep") { const q = Math.sin(Math.min(1, e / 0.7) * Math.PI); c.legR.rotation.set(-0.2, 0, -0.9 * q); g.rotation.z = 0.12 * q; c.armL.rotation.set(0, 0, 0.6 * q); }
    else if (P.k === "trip") { // 휘청 → 뒤로 벌러덩 → 툭툭 털고 일어나기 (땅 위에 눕도록)
      let f;
      if (e < 0.3) f = Math.sin(e / 0.3 * Math.PI / 2) * 0.25 + Math.sin(e * 40) * 0.04;
      else if (e < 0.65) f = 0.25 + (e - 0.3) / 0.35 * 1.3;
      else if (e < 1.5) f = 1.55;
      else f = 1.55 * (1 - (e - 1.5) / 0.7);
      const ar = Math.min(1, f / 1.55);
      g.rotation.x = -f; g.position.y = 0.16 * ar; g.position.z = -0.1 * ar;
      c.armL.rotation.set(-2.6 * ar, 0, 0.6 * ar); c.armR.rotation.set(-2.6 * ar, 0, -0.6 * ar);
      c.legL.rotation.x = -0.7 * ar; c.legR.rotation.x = -0.35 * ar; c.head.rotation.x = 0.35 * ar;
    }
  },
  dancePose(a, seated, walking, t) {
    const D = a.data.dance, c = a.ch, on = D && DANCES[D.k] && !seated && !walking && this.roomName !== "worship" && !a.skating;
    if (!on) {
      if (a.danced) { a.danced = false; c.body.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0); c.group.rotation.set(0, 0, 0); c.group.position.set(0, 0, 0); }
      return;
    }
    a.danced = true;
    const tt = Math.max(0, (Date.now() - (D.t0 || 0)) / 1000), bpm = Math.max(70, Math.min(160, D.bpm || 112));
    const b = tt * bpm / 60, ph = b * Math.PI, s1 = Math.sin(ph), s2 = Math.sin(ph * 2), up = Math.abs(s1), even = Math.floor(b) % 2 === 0;
    c.body.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0); c.group.rotation.set(0, 0, 0); c.group.position.set(0, 0, 0);
    c.legL.rotation.set(0, 0, 0); c.legR.rotation.set(0, 0, 0);
    const k = D.k;
    if (k === "disco") { // 🕺 손가락으로 하늘 찌르고 땅 찌르고
      c.armR.rotation.set(even ? -2.75 : -0.35, 0, even ? -0.55 : -0.75);
      c.armL.rotation.set(0.15, 0, 0.75 + up * 0.15);
      c.body.rotation.z = Math.sin(ph) * 0.12; c.head.rotation.z = -Math.sin(ph) * 0.1;
      c.legL.rotation.x = Math.max(0, s1) * 0.35; c.legR.rotation.x = Math.max(0, -s1) * 0.35;
      c.group.position.y = up * 0.05;
    } else if (k === "robot") { // 🤖 뚝뚝 끊어지는 로봇
      const q = Math.floor(b * 2) % 4, P = [[-1.57, 0.2, -1.57, -0.2], [-1.57, 1.57, 0, -1.57], [0, 1.57, -1.57, -1.57], [-2.9, 0.3, 0, -0.2]][q];
      c.armL.rotation.set(P[0], 0, P[1] * 0.6 + 0.1); c.armR.rotation.set(P[2], 0, -P[3] * -0.6 - 0.1);
      c.head.rotation.y = [0.5, 0, -0.5, 0][q]; c.body.rotation.y = [0, 0.3, 0, -0.3][q];
      c.group.position.y = q % 2 ? 0.03 : 0;
    } else if (k === "penguin") { // 🐧 뒤뚱뒤뚱 + 손 파닥파닥
      c.group.rotation.z = s1 * 0.2;
      c.armL.rotation.set(0, 0, 0.35 + Math.abs(Math.sin(tt * 14)) * 0.35); c.armR.rotation.set(0, 0, -0.35 - Math.abs(Math.sin(tt * 14 + 1)) * 0.35);
      c.legL.rotation.z = Math.max(0, s1) * 0.25; c.legR.rotation.z = -Math.max(0, -s1) * 0.25;
      c.head.rotation.z = -s1 * 0.15; c.group.position.y = up * 0.04;
    } else if (k === "jump") { // 🦘 박자마다 점프, 뛸 때 만세
      const j = Math.max(0, Math.sin(ph)); c.group.position.y = j * j * 0.5;
      c.armL.rotation.set(-2.6 * j - 0.2, 0, 0.35 + j * 0.3); c.armR.rotation.set(-2.6 * j - 0.2, 0, -0.35 - j * 0.3);
      c.legL.rotation.x = c.legR.rotation.x = -j * 0.35; c.head.rotation.x = -j * 0.2;
    } else if (k === "spin") { // 🌀 팔 벌리고 빙글빙글
      c.group.rotation.y = tt * 4.5;
      c.armL.rotation.set(-0.2, 0, 1.4 + s2 * 0.15); c.armR.rotation.set(-0.2, 0, -1.4 - s2 * 0.15);
      c.head.rotation.z = 0.15; c.group.position.y = Math.abs(s2) * 0.04;
    } else if (k === "praise") { // 🙌 찬양 율동: 박수 짝짝 + 옆으로 스텝, 2박마다 손 흔들기
      const wave = Math.floor(b / 4) % 2 === 1;
      if (wave) { c.armL.rotation.set(-2.7, 0, 0.35 + Math.sin(tt * 6) * 0.35); c.armR.rotation.set(-2.7, 0, -0.35 - Math.sin(tt * 6) * 0.35); }
      else { const cl = Math.abs(Math.cos(ph)); c.armL.rotation.set(-1.3, 0, 0.12 + cl * 0.5); c.armR.rotation.set(-1.3, 0, -0.12 - cl * 0.5); }
      c.group.position.x = Math.sin(ph / 2) * 0.22; c.body.rotation.z = Math.sin(ph / 2) * 0.08;
      c.legL.rotation.z = Math.max(0, Math.sin(ph / 2)) * 0.2; c.legR.rotation.z = -Math.max(0, -Math.sin(ph / 2)) * 0.2;
      c.group.position.y = up * 0.04; c.head.rotation.x = -0.1;
    } else if (k === "wave") { // 🌊 팔로 물결
      c.armL.rotation.set(Math.sin(tt * 5) * 0.4, 0, 1.35 + Math.sin(tt * 5) * 0.35); c.armR.rotation.set(Math.sin(tt * 5 + 1.8) * 0.4, 0, -1.35 - Math.sin(tt * 5 + 1.8) * 0.35);
      c.body.rotation.z = Math.sin(tt * 5 + 0.9) * 0.1; c.head.rotation.z = Math.sin(tt * 5 + 2.4) * 0.15;
      c.group.position.y = Math.abs(Math.sin(tt * 5)) * 0.03;
    } else if (k === "cancan") { // 🦵 번갈아 발차기 + 깡충
      const kick = Math.max(0, s1); c.legL.rotation.x = even ? -kick * 1.3 : 0; c.legR.rotation.x = even ? 0 : -kick * 1.3;
      c.armL.rotation.set(-0.3, 0, 1.0); c.armR.rotation.set(-0.3, 0, -1.0);
      c.group.position.y = kick * 0.12; c.body.rotation.x = -kick * 0.1;
    } else if (k === "chicken") { // 🐔 팔꿈치 퍼덕퍼덕 + 고개 쭉쭉
      const f = Math.abs(Math.sin(tt * 9));
      c.armL.rotation.set(0.25, 0, 0.45 + f * 0.8); c.armR.rotation.set(0.25, 0, -0.45 - f * 0.8);
      c.head.rotation.x = Math.sin(ph * 2) * 0.35; c.body.rotation.x = 0.18;
      c.legL.rotation.x = Math.max(0, s1) * 0.45; c.legR.rotation.x = Math.max(0, -s1) * 0.45; c.group.position.y = up * 0.03;
    } else if (k === "shuffle") { // 👟 셔플: 다리 번갈아 미끄러지듯 + 팔 앞뒤
      c.legL.rotation.x = s2 * 0.6; c.legR.rotation.x = -s2 * 0.6; c.legL.rotation.z = Math.max(0, s1) * 0.2; c.legR.rotation.z = -Math.max(0, -s1) * 0.2;
      c.armL.rotation.set(-s2 * 0.9 - 0.3, 0, 0.3); c.armR.rotation.set(s2 * 0.9 - 0.3, 0, -0.3);
      c.group.position.x = Math.sin(ph / 2) * 0.18; c.group.position.y = Math.abs(s2) * 0.07; c.body.rotation.y = s1 * 0.2;
    }
  },
  jamPose(a, seated, walking, t) {
    const st = seated && !walking && seated.inst ? seated : null, inst = st ? st.inst : null;
    const gkind = inst === "egtr" || inst === "bass" ? inst : null;
    if (gkind !== (a.egKind || null)) {
      if (a.eg) { a.eg.parent && a.eg.parent.remove(a.eg); a.eg = null; }
      a.egKind = gkind;
      if (gkind) { a.eg = makeEGuitar(gkind); a.ch.group.add(a.eg); }
    }
    if (!inst) { if (a.jamSway) { a.jamSway = false; a.ch.group.rotation.z = 0; } return; }
    const playing = a.jamT && performance.now() - a.jamT < 450, c = a.ch;
    const k = playing ? 1 : 0;
    if (inst === "drums") {
      c.armL.rotation.set(-0.95 - k * Math.abs(Math.sin(t * 15)) * 0.55, 0, 0.32);
      c.armR.rotation.set(-0.95 - k * Math.abs(Math.sin(t * 15 + 1.6)) * 0.55, 0, -0.32);
      c.head.rotation.x = 0.08 + k * Math.sin(t * 7.5) * 0.08;
    } else if (inst === "key" || inst === "key2") {
      c.armL.rotation.set(-1.0 - k * Math.abs(Math.sin(t * 11)) * 0.12, 0, 0.28);
      c.armR.rotation.set(-1.0 - k * Math.abs(Math.sin(t * 11 + 2)) * 0.12, 0, -0.28);
      c.head.rotation.x = 0.18 + k * Math.sin(t * 5) * 0.05;
    } else if (gkind) {
      c.armL.rotation.set(-0.95, 0, 0.35);
      c.armR.rotation.set(-0.7 + (playing ? Math.sin(t * 16) * 0.28 : 0), 0, -0.45);
      c.head.rotation.x = 0.12 + k * Math.sin(t * 6) * 0.06;
    } else { // 리더 · 싱어: 마이크 앞에서 노래, 부를 때는 살짝 흔들흔들
      c.armR.rotation.set(-1.25, 0, -0.05);
      if (playing && inst === "lead") c.armL.rotation.set(-2.4 + Math.sin(t * 3) * 0.15, 0, 0.25); // 인도자는 한 손 들고
      c.head.rotation.x = -0.05;
    }
    c.group.rotation.z = playing ? Math.sin(t * 3.2) * 0.05 : 0; a.jamSway = true;
  },
  praiseFrame(r, dt) {
    const taken = new Set();
    for (const a of this.actors.values()) if (a.seat && !a.path.length && r.seats[a.seat] && r.seats[a.seat].inst) taken.add(a.seat);
    r.jamTaken = taken;
    for (const [sid, g] of Object.entries(r.idleGtr)) g.visible = !taken.has(sid);
    for (const [sid, m] of Object.entries(r.seatMarks)) m.visible = !taken.has(sid);
    if (this.cdOn) r.disc.rotation.y += dt * 9;
  },
  setCdPlaying(on) { this.cdOn = !!on; },
  // 🗺 지도에서 누른 곳으로 걸어가기
  walkTo(x, z) { if (!this.room) return; const p = this.room.grid.nearest(x, z); this.tapMark(p.x, p.z); this.moveMe({ x: p.x, z: p.z }); },
  // 🪶 가볍게 보기: 그림자 끄기 · 해상도 낮추기 · 전구 반짝임/눈 멈추기
  lite: false,
  setLite(on) {
    this.lite = on; const r = this.renderer; if (!r) return;
    r.setPixelRatio(on ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    r.shadowMap.enabled = !on;
    for (const room of Object.values(this.rooms)) room.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); if (o.isPoints) o.visible = !on; });
    this.resize();
  },
  recList: [],
  setRecBoard(list) { this.recList = list || []; const r = this.rooms.praise; if (!r || !r.recMat) return; const old = r.recMat.map; r.recMat.map = recBoardTex(this.recList); r.recMat.emissiveMap = r.recMat.map; r.recMat.needsUpdate = true; old && old.dispose(); },
  sportFrame(r, t) {
    const now = performance.now(), balls = r.courts.balls, B = COURTS.bb;
    // 🏀 농구공
    const st = this.bb, ball = balls.bb;
    if (st) {
      const sh = st.shot, el = sh ? (now - sh.at) / 1000 : 99;
      if (sh && el < sh.dur + 1.0) {
        const hx = B.hoop.x + (sh.make ? 0 : sh.side * 0.32), hz = B.hoop.z + (sh.make ? 0 : 0.12), hy = B.rimY + 0.12;
        if (el < sh.dur) { const u = el / sh.dur; ball.position.set(sh.fx + (hx - sh.fx) * u, 2.1 + (hy - 2.1) * u + (1.2 + sh.d * 0.12) * 4 * u * (1 - u), sh.fz + (hz - sh.fz) * u); }
        else {
          const e = el - sh.dur;
          if (sh.make && e < 0.3) ball.position.set(B.hoop.x, B.rimY - e * 7, B.hoop.z);
          else { const e0 = sh.make ? 0.3 : 0, u = Math.min(1, (e - e0) / (1.0 - e0)), y0 = sh.make ? 0.9 : hy;
            ball.position.set(hx + (sh.ex - hx) * u, Math.max(0.13, y0 * (1 - u) + Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * 1.1), hz + (sh.ez - hz) * u); }
        }
        ball.rotation.x += 0.2;
      } else {
        const h = st.holder && this.actors.get(st.holder);
        if (h) { const yw = h.outer.rotation.y; ball.position.set(h.pos.x + Math.sin(yw) * 0.32 + Math.cos(yw) * 0.18, 0.13 + Math.abs(Math.sin(t * 7.5)) * 0.55, h.pos.z + Math.cos(yw) * 0.32 - Math.sin(yw) * 0.18); }
        else { ball.position.x += (st.x - ball.position.x) * 0.2; ball.position.z += (st.z - ball.position.z) * 0.2; ball.position.y = 0.13; }
      }
    }
    // 🎾 테니스공 · 🏸 셔틀콕
    for (const k of ["tn", "bm"]) {
      const R = this.rally[k], b = balls[k];
      if (!R || !COURTS[k]) { b.visible = false; continue; }
      let el = (now - R.t0) / 1000, i = 0;
      while (i < R.hits.length && el > R.hits[i].dur) { el -= R.hits[i].dur; i++; }
      if (i >= R.hits.length) { // 다 끝나면 땅에 잠깐 있다가 사라져요
        const L = R.hits[R.hits.length - 1]; b.visible = el < 1.4; b.position.set(L.tx, k === "bm" ? 0.05 : 0.07, L.tz);
        if (k === "bm") b.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), new T.Vector3(0.3, -0.2, 1).normalize());
        if (el > 1.4) this.rally[k] = null; continue;
      }
      const H = R.hits[i], u = el / H.dur, C = COURTS[k];
      if (R.hitIdx !== i) { R.hitIdx = i; const a = H.by && this.actors.get(H.by); if (a) a.swingT = now; }
      b.visible = true;
      const y1 = H.land ? 0.06 : 1.05, prev = b.position.clone();
      let y;
      if (k === "tn" && !H.land) y = u < 0.72 ? 1.05 * (1 - u / 0.72) + 1.1 * Math.sin(Math.PI * u / 0.72) : 0.06 + 0.99 * ((u - 0.72) / 0.28) + 0.5 * Math.sin(Math.PI * (u - 0.72) / 0.28);
      else y = 1.05 + (y1 - 1.05) * u + C.ballH * 4 * u * (1 - u);
      b.position.set(H.fx + (H.tx - H.fx) * u, Math.max(0.05, y), H.fz + (H.tz - H.fz) * u);
      if (k === "bm") { const v = b.position.clone().sub(prev); if (v.lengthSq() > 1e-6) b.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), v.normalize()); }
      else b.rotation.x += 0.3;
    }
  },
  // 🧩 퀴즈 보드 다시 그리기 (비전 / 301호)
  // 퀴즈 보드: 301호(1부)와 비전(2부)이 따로
  quizInfo: {},
  setQuizBoard(info, room) {
    for (const rm of room ? [room] : ["vision", "room301"]) {
      this.quizInfo[rm] = info;
      const r = this.rooms[rm]; if (!r || !r.quizMat) continue;
      const old = r.quizMat.map; r.quizMat.map = quizBoardTex(info); r.quizMat.emissiveMap = r.quizMat.map; r.quizMat.needsUpdate = true; old && old.dispose();
    }
  },
  // 사람 찾기: 몇 초 동안 카메라가 그 사람을 비추고 발밑에 파란 고리를 보여줘요
  focus(id) {
    const a = this.actors.get(id); if (!a) return false;
    this.focusId = id; this.focusUntil = performance.now() + 5000;
    a.ring.material.color.set(id === this.hooks.myId ? "#f0a050" : "#4a90e2");
    return true;
  },

  /* ----- 다녀간 흔적 ----- */
  clearTraces() {
    if (this.traceGroup && this.traceGroup.parent) this.traceGroup.parent.remove(this.traceGroup);
    this.traceGroup = null;
    this.traceLabels.forEach((l) => l.el.remove()); this.traceLabels = [];
  },
  tracePoint(t) {
    const r = this.room, s = t.seat && r.seats[t.seat];
    if (s) {
      const fx = Math.sin(s.rot), fz = Math.cos(s.rot);
      if (t.kind === "pray" && /^P/.test(t.seat)) return { x: s.x - fx * 0.26, y: 1.15, z: s.z - fz * 0.26 }; // 장의자 등받이 위
      if (t.kind === "read" && /^T/.test(t.seat)) return { x: s.x + fx * 0.42, y: 0.8, z: s.z + fz * 0.42 }; // 책상 위
      return { x: s.x, y: s.h + 0.02, z: s.z };
    }
    if (t.kind === "pray" && isFinite(t.pos_x) && isFinite(t.pos_z) && t.pos_x !== null) return { x: t.pos_x, y: r.roomName === "worship" && t.pos_z < -9.7 ? 0.62 : 0.01, z: t.pos_z };
    return null;
  },
  setTraces(list) {
    this.clearTraces();
    if (!this.room) return;
    const g = new T.Group(); this.room.scene.add(g); this.traceGroup = g;
    const spots = new Map();
    for (const t of list) {
      if (t.kind !== "pray" && t.kind !== "read") continue;
      const p = this.tracePoint(t); if (!p) continue;
      const k = t.kind + "|" + p.x.toFixed(1) + "|" + p.z.toFixed(1);
      if (!spots.has(k)) spots.set(k, { p, kind: t.kind, items: [] });
      spots.get(k).items.push(t);
    }
    let i = 0;
    for (const sp of spots.values()) {
      if (i++ > 40) break;
      const m = sp.kind === "pray" ? makeSeed() : makeOpenBook();
      if (sp.kind === "pray") m.scale.setScalar(1.35);
      m.position.set(sp.p.x, sp.p.y, sp.p.z); m.rotation.y = (i * 1.7) % 6.28;
      g.add(m);
      const first = sp.items[0], nm = first.name || "익명", more = sp.items.length > 1 ? ` 외 ${sp.items.length - 1}명` : "";
      const el = document.createElement("div"); el.className = "trace-label " + sp.kind;
      el.textContent = (sp.kind === "pray" ? "🌱 " : "📖 ") + nm + more + (sp.kind === "read" && first.detail ? " · " + first.detail : "");
      this.overlay.append(el);
      this.traceLabels.push({ x: sp.p.x, y: sp.p.y + 0.2, z: sp.p.z, el });
    }
  },

  /* ----- 이동 명령 ----- */
  occupied() {
    const s = new Set();
    for (const a of this.actors.values()) {
      if (a.id === this.hooks.myId || !a.data.seat) continue;
      s.add(a.data.seat);
      // 누워 있는 사람이 있으면 그 소파 전체가 차 있어요
      if (a.data.lying && this.canLie(a.data.seat)) { const pre = a.data.seat.split("-")[0] + "-"; for (const id in this.room.seats) if (id.startsWith(pre)) s.add(id); }
    }
    return s;
  },
  stopMe() { const a = this.me(); if (a && !a.seat) { a.path = []; a.pendingDoor = null; } },
  moveMe(target, door) {
    const a = this.me(); if (!a) return;
    if (a.sledAnim) { this.hooks.toast("썰매 타는 중이에요! 🛷"); return; }
    a.pendingSled = null;
    a.path = this.planPath(a.pos, a.seat, target);
    a.seat = null; a.pendingDoor = door || null;
    a.goal = { x: target.x, z: target.z, seat: target.seat || null };
    this.hooks.onMove({ x: +target.x.toFixed(2), z: +target.z.toFixed(2) }, target.seat || null);
  },
  sitNear(ids, point) {
    const occ = this.occupied(); let best = null, bd = 1e9;
    for (const id of ids) { if (occ.has(id)) continue; const s = this.room.seats[id]; const d = Math.hypot(s.x - point.x, s.z - point.z); if (d < bd) { bd = d; best = id; } }
    if (!best) { this.hooks.toast("자리가 다 찼어요"); return; }
    const s = this.room.seats[best];
    this.moveMe({ x: s.x, z: s.z, seat: best });
  },
  // 자리로 걸어가는 중이면 멈추고, 앉아(서) 있으면 일어나요
  standOrCancel() { const a = this.me(); if (!a) return; if (a.seat) this.stand(); else this.moveMe({ x: a.pos.x, z: a.pos.z }); },
  stand() {
    const a = this.me(); if (!a || !a.seat) return;
    const s = this.room.seats[a.seat];
    this.moveMe({ x: s.ax, z: s.az });
  },
  // 눈썰매: 언덕 아래로 걸어가서 도착하면 출발
  goSled() {
    if (this.roomName !== "yard") return false;
    const a = this.me(); if (!a) return false;
    const busy = new Set([...this.actors.values()].filter((x) => x.sledAnim).map((x) => x.sledAnim.lane));
    let lane = HILL.lanes.findIndex((l) => !busy.has(l)); if (lane < 0) lane = Math.floor(Math.random() * HILL.lanes.length);
    this.moveMe({ x: HILL.lanes[lane], z: HILL.zFoot + 0.7 });
    a.pendingSled = lane;
    return true;
  },
  sledEnd(lane) { return { x: HILL.lanes[lane % HILL.lanes.length], z: HILL.endZ }; },
  goDoor(to) {
    const d = this.room.doors.find((x) => x.to === to); if (!d) return;
    this.moveMe({ x: d.x, z: d.z }, to);
  },

  /* ----- 입력 ----- */
  bindInput() {
    const c = this.renderer.domElement;
    const pts = new Map(); let down = null, pinch = null;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: this.cam.yaw, pitch: this.cam.pitch, moved: false };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.cam.dist }; down && (down.moved = true); }
    });
    c.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.setDist(pinch.dist * pinch.d / Math.max(20, d)); return; }
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) down.moved = true;
      if (down.moved) { this.camTurn = false; this.cam.yaw = down.yaw - dx * 0.006; this.cam.pitch = down.pitch + dy * 0.004; this.clampCam(); this.focusId = null; }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (down && pts.size === 0) { if (!down.moved && performance.now() - down.t < 600) this.tap(e.clientX, e.clientY); down = null; }
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.setDist(this.cam.dist * (1 + Math.sign(e.deltaY) * 0.1)); }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
      if (document.querySelector(".modal:not([hidden]), .drawer:not([hidden])")) return;
      if (this.keyBlock) return; // 찬양팀 연습실에서 악기를 치는 동안에는 키보드 글자로 연주해요 (걷지 않아요)
      const k = e.key.toLowerCase(); if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { this.keys.add(k); e.preventDefault(); }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
  },
  setDist(d) { const c = this.room.cam; this.cam.dist = Math.max(Math.min(c.min, 1.8), Math.min(c.max, d)); },
  clampCam() {
    const c = this.room.cam;
    // 2026-11-18: 마음대로 빙 돌려 보기 (내 앞모습도) · 아래로는 땅 밑으로 안 내려가게(아래 카메라 높이에서 막아요)
    this.cam.pitch = Math.max(-0.45, Math.min(1.35, this.cam.pitch)); void c;
  },
  resetView() { const c = this.room.cam; this.cam.yaw = this.camCenter || 0; this.cam.pitch = c.pitch; this.cam.dist = c.dist; this.focusId = null; },
  tap(cx, cy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.room.clickables, true).filter((h) => h.object.visible && this.visibleChain(h.object));
    const floorHit = new T.Vector3(); const hasFloor = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), floorHit);
    this.focusId = null;
    if (hits.length && (!hasFloor || hits[0].distance <= ray.ray.origin.distanceTo(floorHit) + 0.05)) {
      const o = hits[0].object.userData;
      if (o.action) return this.hooks.onAction && this.hooks.onAction(o.action);
      if (o.door) return this.goDoor(o.door);
      if (o.seats) return this.sitNear(o.seats, hits[0].point);
    }
    if (!hasFloor) return;
    const near = this.room.doors.find((d) => Math.hypot(d.x - floorHit.x, d.z - floorHit.z) < 1.3);
    if (near) return this.goDoor(near.to);
    const g = this.room.grid, p = g.nearest(floorHit.x, floorHit.z);
    this.tapMark(p.x, p.z);
    this.moveMe({ x: p.x, z: p.z });
  },
  visibleChain(o) { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; },
  tapMark(x, z) {
    const m = new T.Mesh(new T.RingGeometry(0.15, 0.24, 24), new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); this.room.scene.add(m);
    const t0 = performance.now(), sc = this.room.scene;
    const anim = () => { const k = (performance.now() - t0) / 600; if (k >= 1) { sc.remove(m); return; } m.scale.setScalar(1 + k * 1.6); m.material.opacity = 0.9 * (1 - k); requestAnimationFrame(anim); };
    anim();
  },

  /* ----- 프레임 ----- */
  frame() {
    if (!this.room) { this.renderer.render(new T.Scene(), this.camera); return; }
    const dt = Math.min(0.12, this.clock.getDelta()), t = this.clock.elapsedTime;
    const r = this.room, myId = this.hooks.myId;
    if (r.tw && !this.lite) twinkle(r.tw, t);
    if (r.update) r.update(dt, t);
    // 키보드 이동
    const me = this.me();
    if (me && this.keys.size && !me.sledAnim) {
      let fx = 0, fz = 0;
      if (this.keys.has("w") || this.keys.has("arrowup")) fz -= 1;
      if (this.keys.has("s") || this.keys.has("arrowdown")) fz += 1;
      if (this.keys.has("a") || this.keys.has("arrowleft")) fx -= 1;
      if (this.keys.has("d") || this.keys.has("arrowright")) fx += 1;
      if (fx || fz) {
        this.focusId = null;
        if (me.seat) { this.stand(); }
        else {
          const cy = Math.cos(this.cam.yaw), sy = Math.sin(this.cam.yaw), l = Math.hypot(fx, fz);
          const dx = (fx * cy + fz * sy) / l, dz = (-fx * sy + fz * cy) / l, sp = 2.6 * dt;
          me.path = []; me.pendingDoor = null;
          let nx = me.pos.x, nz = me.pos.z;
          const nStep = Math.max(1, Math.ceil(sp / (r.cell * 0.5)));
          for (let k = 0; k < nStep; k++) { // 조금씩 나눠서 확인 (화면이 버벅여도 벽을 건너뛰지 않게)
            const st = sp / nStep, tx = nx + dx * st, tz = nz + dz * st;
            if (r.grid.free(tx, tz)) { nx = tx; nz = tz; } else if (r.grid.free(tx, nz)) nx = tx; else if (r.grid.free(nx, tz)) nz = tz; else break;
          }
          me.pos.x = nx; me.pos.z = nz; me.yaw = Math.atan2(dx, dz); me.kbWalking = true;
          me.goal = { x: nx, z: nz, seat: null };
          // 걷는 중 위치는 1초에 한 번만 보내요 (여럿이 동시에 걸을 때 서버 한도를 넘지 않게)
          const now = performance.now();
          if (!me.lastSend || now - me.lastSend > 1000) { me.lastSend = now; this.hooks.onMove({ x: +nx.toFixed(2), z: +nz.toFixed(2) }, null); }
          for (const d of r.doors) if (Math.hypot(d.x - nx, d.z - nz) < 0.6) { this.keys.clear(); this.hooks.onDoor(d.to); return; }
        }
      }
    } else if (me && me.kbWalking) { me.kbWalking = false; me.lastSend = 0; this.hooks.onMove({ x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2) }, null); }

    // 사람들 움직이기
    const nowMs = Date.now();
    for (const a of this.actors.values()) {
      if (a.sledAnim) { this.animSled(a, t); continue; }
      // ⛸ 스피드 스케이팅 경주 중이면 트랙 위 자리로 (나는 raceMe, 친구는 받은 상태로 부드럽게 따라가요)
      const rs = this.roomName === "yard" ? (a.id === myId ? this.raceMe : a.data && a.data.skr) : null;
      a.racing = false;
      if (rs && Number.isFinite(rs.p) && nowMs >= rs.t0 - 6000) {
        let p = rs.p;
        if (a.id !== myId) { if (a.raceT0 !== rs.t0) { a.raceT0 = rs.t0; a.raceP = rs.p; } const v = rs.done ? 0 : Math.max(0, (rs.v || 0)) / rinkLapLen(rs.lane || 0); a.raceP += v * dt; a.raceP += (rs.p - a.raceP) * Math.min(1, dt * 3); p = Math.min(2, a.raceP); }
        const q = rinkRacePos(Math.min(2, p), rs.lane || 0);
        a.pos.x = q.x; a.pos.z = q.z; a.yaw = q.yaw; a.path = []; a.seat = null; a.goal = { x: q.x, z: q.z, seat: null };
        a.racing = nowMs >= rs.t0 && !rs.done;
      }
      let walking = !!a.kbWalking || a.racing;
      if (a.path.length) {
        const tg = a.path[0], dx = tg.x - a.pos.x, dz = tg.z - a.pos.z, d = Math.hypot(dx, dz);
        // 멀리 갈 때는 뛰어가요 (남은 거리 8m 넘으면 2배 빠르게)
        let left = d; for (let k = 1; k < a.path.length; k++) left += Math.hypot(a.path[k].x - a.path[k - 1].x, a.path[k].z - a.path[k - 1].z);
        const sp = (left > 8 ? 5 : 2.4) * (this.roomName === "yard" && onIce(a.pos.x, a.pos.z) ? 1.45 : 1) * dt; // 얼음 위에서는 미끄러지듯 빨라요
        // 안전장치: 다음 걸음이 벽·물건 안이면 (의자에 앉는 마지막 한 걸음은 빼고) 길을 다시 찾거나 멈춰요
        if (!tg.seat && r.grid && r.grid.free(a.pos.x, a.pos.z)) {
          const k = Math.min(1, sp / Math.max(d, 1e-6)), px = a.pos.x + dx * k, pz = a.pos.z + dz * k;
          if (!r.grid.free(px, pz) && !(tg.door || a.pendingDoor && a.path.length === 1)) {
            const now = performance.now();
            if (!a.replanT || now - a.replanT > 600) { a.replanT = now; a.path = this.planPath(a.pos, null, a.goal || tg); }
            else a.path = [];
            continue;
          }
        }
        if (d <= sp) {
          a.pos.x = tg.x; a.pos.z = tg.z; a.path.shift();
          if (tg.seat) a.seat = tg.seat;
          if (!a.path.length && a.id === myId && a.pendingDoor) { const to = a.pendingDoor; a.pendingDoor = null; this.hooks.onDoor(to); return; }
          if (!a.path.length && a.id === myId && a.pendingSled != null) { const l = a.pendingSled; a.pendingSled = null; this.hooks.onSled && this.hooks.onSled(l); }
        } else { a.pos.x += dx / d * sp; a.pos.z += dz / d * sp; a.yaw = Math.atan2(dx, dz); }
        walking = a.path.length > 0 || d > sp;
      }
      const seated = !walking && a.seat && r.seats[a.seat];
      const standSeat = seated && seated.stand; // 트럭 안처럼 서 있는 자리
      const praying = !!a.data.praying && !walking;
      if (a.eatAnim && performance.now() - a.eatAnim.t0 > 1500) { a.eatAnim = null; this.setCarry(a, a.data.carry || null); }
      a.ch.eating = !!a.eatAnim;
      const lie = seated && a.data.lying && seated.lie;
      const glie = !lie && !seated && !walking && !!a.data.ground && this.roomName === "yard"; // 🌿 풀밭에 눕기
      let targetYaw = a.yaw;
      if (seated) targetYaw = r.seats[a.seat].rot;
      const cur = a.outer.rotation.y; let dY = targetYaw - cur; dY = Math.atan2(Math.sin(dY), Math.cos(dY));
      a.outer.rotation.y = cur + dY * Math.min(1, dt * 10);
      if (lie) {
        // 눕기: 소파 길이 방향으로 몸을 눕히고 얼굴은 위로
        a.outer.position.set(lie.x, 0, lie.z);
        a.ch.group.quaternion.copy(LIE_Q);
        a.ch.group.position.set(-0.68, lie.h + 0.27, 0);
      } else if (glie) {
        // 풀밭: 바라보던 방향으로 잔디에 벌러덩
        a.outer.position.set(a.pos.x, 0, a.pos.z);
        a.ch.group.quaternion.copy(LIE_Q);
        a.ch.group.position.set(-0.68, 0.17, 0);
      } else {
        a.outer.position.set(a.pos.x, seated ? (standSeat ? seated.h : seated.h - 0.34) : 0, a.pos.z);
        if (a.ch.group.position.x !== 0) { a.ch.group.quaternion.identity(); a.ch.group.position.set(0, 0, 0); }
      }
      a.lyingNow = !!lie || glie;
      // 그네: 앉아 있으면 그네와 같이 앞뒤로 흔들려요
      const swing = seated && seated.swing != null && r.swings && r.swings[seated.swing];
      if (swing) { a.outer.position.y += swing.L * (1 - Math.cos(swing.ang)); a.outer.position.z -= swing.L * Math.sin(swing.ang); a.outer.rotation.x = swing.ang; }
      else if (a.outer.rotation.x) a.outer.rotation.x = 0;
      poseCharacter(a.ch, { walking, seated: !!seated && !standSeat, praying, lying: !!lie || glie }, t + (a.id.charCodeAt(0) % 7));
      if (glie) { // 두 손은 머리 뒤로, 한쪽 무릎은 세우고 느긋하게
        a.ch.armL.rotation.set(-2.75, 0, 0.6); a.ch.armR.rotation.set(-2.75, 0, -0.6);
        a.ch.legR.rotation.x = -0.45 + Math.sin(t * 0.8 + a.id.charCodeAt(0)) * 0.04;
      }
      if (swing) { a.ch.armL.rotation.set(-2.6, 0, 0.15); a.ch.armR.rotation.set(-2.6, 0, -0.15); a.ch.legL.rotation.x = a.ch.legR.rotation.x = -Math.PI / 2 - swing.ang * 0.9; }
      this.sportPose(a, seated, walking, t);
      this.jamPose(a, seated, walking, t);
      this.dancePose(a, seated, walking, t);
      this.skatePose(a, seated, walking, t, nowMs);
      // 🙌 펜스에 기대기: 몸을 살짝 숙이고 두 팔을 펜스 위에
      const leanNow = !!(seated && seated.lean);
      if (leanNow) { a.ch.group.rotation.x = 0.3; a.ch.armL.rotation.set(-1.35, 0, 0.3); a.ch.armR.rotation.set(-1.35, 0, -0.3); a.leaning = true; }
      else if (a.leaning) { a.leaning = false; if (!a.skating) a.ch.group.rotation.x = 0; }
      // 👏 박수: 두 손을 앞에서 짝짝
      if (a.clapUntil && performance.now() < a.clapUntil) { const c = Math.sin(t * 22) * 0.28; a.ch.armL.rotation.set(-1.35, 0, -0.3 + c); a.ch.armR.rotation.set(-1.35, 0, 0.3 - c); }
      this.prankPose(a, t);
      // ✨ 특별 스킨 움직임: 별은 둥실둥실 돌고, 새싹은 살랑살랑, 비둘기는 고개 까딱
      if (a.ch.halo) { const hb = a.ch.halo; if (a.ch.haloStar) { hb.rotation.y = t * 1.4; hb.position.y = hb.userData.baseY + Math.sin(t * 2.2) * 0.04; } else hb.rotation.z = Math.sin(t * 2.4 + a.id.charCodeAt(0)) * 0.12; }
      if (a.ch.dove) a.ch.dove.rotation.x = Math.sin(t * 3 + 1) * 0.08;
      this.trailFrame(a, walking, dt);
      if (a.pets && a.pets.size) this.petFrame(a, dt, t);
      const focused = this.focusId === a.id && performance.now() < this.focusUntil;
      const team = this.roomName === "yard" && this.teams[a.id];
      a.ring.visible = (a.id === myId && !seated) || focused || !!team;
      if (team && !focused) a.ring.material.color.set(team); else if (!focused && a.ring.userData.team !== team) a.ring.material.color.set("#f0a050");
      a.ring.userData.team = team;
      if (focused) a.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
      else if (a.ring.scale.x !== 1) { a.ring.scale.setScalar(1); a.ring.material.color.set("#f0a050"); }
    }

    this.returnFrame(dt, t);
    if (r.cats) { const fol = new Set(); for (const a of this.actors.values()) if (a.pets) for (const k of a.pets.keys()) fol.add(k); for (const m of this.returning || []) fol.add(m.k); for (const c of r.cats) c.group.visible = !fol.has(c.i); }
    this.trailUpdate();
    if (r.swings) this.swingFrame(r, dt);
    if (r.idleGtr) this.praiseFrame(r, dt);
    if (r.courts) this.sportFrame(r, t);
    // 건물 뒤(운동장)에 가면 카메라가 반대편에서 건물 쪽을 보도록 천천히 돌아요
    if (this.roomName === "yard" && me) {
      const zone = me.pos.z < -19.6 && me.pos.x < 19.6 ? Math.PI : 0; // 놀이터(배드민턴장 오른쪽)는 앞에서 보듯 그대로
      if (zone !== this.camCenter) { this.camCenter = zone; this.camTurn = true; }
    }
    if (this.camTurn) { let d = (this.camCenter || 0) - this.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 0.01) this.camTurn = false; else this.cam.yaw += d * Math.min(1, dt * 3); }
    // 카메라 (사람 찾기 중이면 그 사람을, 아니면 나를 따라가요)
    const c = r.cam, ly = c.lookY || 1.0;
    let follow = me;
    if (this.focusId) { const f = this.actors.get(this.focusId); if (f && performance.now() < this.focusUntil) follow = f; else this.focusId = null; }
    const tgtPos = follow ? new T.Vector3(follow.pos.x, ly, follow.pos.z) : new T.Vector3(0, ly, 0);
    if (!this.camInit) { this.cam.target.copy(tgtPos); this.camInit = true; } else this.cam.target.lerp(tgtPos, Math.min(1, dt * 4));
    const cp = Math.cos(this.cam.pitch), cam = this.camera;
    let px = this.cam.target.x + Math.sin(this.cam.yaw) * cp * this.cam.dist;
    let py = this.cam.target.y + Math.sin(this.cam.pitch) * this.cam.dist;
    let pz = this.cam.target.z + Math.cos(this.cam.yaw) * cp * this.cam.dist;
    if (c.inside) {
      const ins = c.inside;
      px = Math.max(-ins.hx, Math.min(ins.hx, px)); pz = Math.max(ins.z0, pz);
      if (pz < ins.z1 + 0.4) { const roofY = ins.wall + (ins.ridge - ins.wall) * (1 - Math.abs(px) / (ins.hx + 0.5)) - 0.6; py = Math.min(py, roofY); }
    }
    py = Math.max(py, 0.3); // 땅 밑으로는 안 내려가요
    cam.position.set(px, py, pz); cam.lookAt(this.cam.target);
    // 카메라 쪽 벽 숨기기 / 천장
    if (r.wallHide) for (const w of r.wallHide) w.g.visible = (w.nx * px + w.nz * pz) > w.d - 0.01;
    if (r.ceil) r.ceil.visible = py < (r.ceilY || 3.2) - 0.05;
    if (r.books && r.wallHide) { const back = r.wallHide[0], left = r.wallHide[1]; r.books.visible = back.g.visible || left.g.visible; }
    if (r.fans) r.fans.forEach((f) => (f.rotation.y += dt * 2.2));

    this.renderer.render(r.scene, cam);

    // 말풍선 / 이름 위치
    const v = new T.Vector3();
    for (const a of this.actors.values()) {
      const op = a.outer.position;
      v.set(op.x, op.y + (a.lyingNow ? 1.05 : a.ch.halo && !a.lyingNow ? (a.ch.haloStar ? 2.0 : 1.72) : 1.45), op.z).project(cam);
      const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.3;
      a.ov.style.display = vis ? "" : "none";
      if (!vis) continue;
      const sx = (v.x * 0.5 + 0.5) * this.w, sy = (-v.y * 0.5 + 0.5) * this.h;
      a.ov.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
      const dist = cam.position.distanceTo(op);
      a.ov.style.zIndex = a.id === myId ? 9000 : Math.round(5000 - dist * 50);
      a.ov.style.opacity = dist > 30 ? 0.5 : 1;
      // 🧭 마당에서 먼 사람(16m 넘게)은 이름표를 작은 점으로
      const meP = this.me(), far = this.roomName === "yard" && meP && a.id !== myId && Math.hypot(a.pos.x - meP.pos.x, a.pos.z - meP.pos.z) > 16;
      if (far !== !!a.ovFar) { a.ovFar = far; a.ov.classList.toggle("far", far); }
    }
    const behind = this.roomName === "yard" && this.camCenter === Math.PI; // 건물 뒤(뒷마당)에 있을 때
    const meA = this.me(), yard = this.roomName === "yard";
    for (const l of r.labelEls) {
      v.set(l.x, l.y, l.z).project(cam);
      // 🧭 마당: 가까운 곳(18m 안)은 자세한 이름표, 먼 곳은 구역 이름만
      const dd = yard && meA ? Math.hypot(l.x - meA.pos.x, l.z - meA.pos.z) : 0;
      const lodOk = !yard || !meA ? !l.zone : l.zone ? dd > 18 && !(meA && zoneAt(meA.pos.x, meA.pos.z).id === l.zone) : dd < 18;
      const sideOk = lodOk && (this.roomName !== "yard" || l.x > 19.6 || (l.z < -19.5) === behind) && (!l.season || !this.seasons || this.seasons.has(l.season)); // 건물 너머·다른 계절 이름표는 숨겨요
      const vis = sideOk && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && !(l.jam && r.jamTaken && r.jamTaken.has(l.seat));
      l.el.style.display = vis ? "" : "none";
      if (vis) l.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px) translate(-50%, -100%)`;
    }
    this.catLabelFrame(cam, v);
    // 흔적 이름표: 가까이 있을 때만 보여요
    for (const l of this.traceLabels) {
      const d = cam.position.distanceTo(new T.Vector3(l.x, l.y, l.z));
      v.set(l.x, l.y, l.z).project(cam);
      const vis = d < 13 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.display = vis ? "" : "none";
      if (vis) { l.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px) translate(-50%, -100%)`; l.el.style.opacity = d < 8 ? 0.95 : 0.6; }
    }
  },

  catLabelFrame(cam, v) {
    for (const l of this.catLabels || []) {
      const c = l.c; if (!c.pos || !c.group.visible) { l.el.style.display = "none"; continue; }
      const P = new T.Vector3(c.pos.x, 0.82, c.pos.z), d = cam.position.distanceTo(P); v.copy(P).project(cam);
      const vis = d < 16 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.display = vis ? "" : "none";
      if (vis) l.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px) translate(-50%, -100%)`;
    }
  },

  /* ----- 눈썰매 장면 ----- */
  animSled(a, t) {
    const A = a.sledAnim, el = (performance.now() - A.t0) / 1000, L = A.lane, o = a.outer;
    const CLIMB = 2.6, TURN = 0.5, SLIDE = 3.0, STAND = 0.5;
    let walking = false, seated = false;
    if (!A.sled) { A.sled = makeSled(L < 26 ? "#d0312d" : "#2e6fd0"); A.sled.visible = false; o.add(A.sled); A.sled.position.y = 0.18; }
    if (el < CLIMB) { // 언덕 걸어 올라가기
      const u = el / CLIMB, x = A.from.x + (L - A.from.x) * Math.min(1, u * 3), z = A.from.z + (HILL.zTop + 0.3 - A.from.z) * u;
      a.pos.x = x; a.pos.z = z; o.position.set(x, hillH(z), z); o.rotation.set(0, Math.PI, 0); walking = true;
    } else if (el < CLIMB + TURN) { // 썰매에 앉기
      const z = HILL.zTop + 0.3; a.pos.x = L; a.pos.z = z;
      o.position.set(L, hillH(z) - 0.18, z); o.rotation.set(0, 0, 0); seated = true; A.sled.visible = true;
    } else if (el < CLIMB + TURN + SLIDE) { // 슝~ 내려오기
      const u = (el - CLIMB - TURN) / SLIDE, k = u * u * (3 - 2 * u), z = HILL.zTop + 0.3 + (HILL.endZ - HILL.zTop - 0.3) * k;
      const dh = (hillH(z + 0.05) - hillH(z - 0.05)) / 0.1;
      a.pos.x = L; a.pos.z = z; o.position.set(L, hillH(z) - 0.18, z); o.rotation.set(-Math.atan(dh), 0, 0); seated = true; A.sled.visible = true;
    } else if (el < CLIMB + TURN + SLIDE + STAND) { // 일어나기
      a.pos.x = L; a.pos.z = HILL.endZ; o.position.set(L, -0.18, HILL.endZ); o.rotation.set(0, 0, 0); seated = true;
    } else { // 끝
      o.remove(A.sled); a.sledAnim = null; o.rotation.set(0, 0, 0);
      a.pos = { x: L, z: HILL.endZ }; o.position.set(L, 0, HILL.endZ); a.seat = null;
      if (Math.hypot(a.goal.x - a.pos.x, a.goal.z - a.pos.z) > 0.05) a.path = this.planPath(a.pos, null, a.goal);
      return;
    }
    a.ch.group.quaternion.identity(); a.ch.group.position.set(0, 0, 0); a.lyingNow = false;
    a.ring.visible = false;
    poseCharacter(a.ch, { walking, seated, praying: false }, t * 1.4);
    if (seated && el > CLIMB + TURN) { a.ch.armL.rotation.set(-2.6, 0, 0.3); a.ch.armR.rotation.set(-2.6, 0, -0.3); } // 만세!
  },

  /* ----- 📸 캐릭터 사진 (올해 카드용, 투명 배경 PNG) ----- */
  snapshot(look, w = 600, h = 800) {
    if (!this._snapR) { const cv = document.createElement("canvas"); this._snapR = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); this._snapR.outputEncoding = T.sRGBEncoding; }
    const r = this._snapR; r.setPixelRatio(1); r.setSize(w, h, false);
    const sc = new T.Scene(); sc.add(new T.HemisphereLight("#ffffff", "#c8b8a0", 1.05));
    const dl = new T.DirectionalLight("#ffffff", 0.65); dl.position.set(2, 4, 5); sc.add(dl);
    const cam = new T.PerspectiveCamera(28, w / h, 0.1, 20); const pal = look.costume === "daniel" || (Number.isInteger(look.pet) && look.pet >= 0); cam.position.set(pal ? 0.9 : 0.6, 1.05, pal ? 5.0 : 4.3); cam.lookAt(pal ? 0.5 : 0, 0.85, 0);
    const ch = makeCharacter(look); poseCharacter(ch, {}, 0.3); ch.group.rotation.y = 0.22; sc.add(ch.group);
    if (look.costume === "daniel") { const l = makeLion(); l.group.position.set(1.05, 0, -0.35); l.group.rotation.y = -0.55; catPose(l, false, false, 0, false, 0); sc.add(l.group); }
    else if (Number.isInteger(look.pet) && look.pet >= 0 && CATS[look.pet]) { const c = makeCat(CATS[look.pet]); c.group.position.set(0.7, 0, 0.3); c.group.rotation.y = -0.5; catPose(c, false, false, 0, false, 0); sc.add(c.group); }
    r.setClearColor(0x000000, 0); r.render(sc, cam);
    return r.domElement.toDataURL("image/png");
  },

  /* ----- 캐릭터 미리보기 (입장 화면) ----- */
  preview(canvas) {
    const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputEncoding = T.sRGBEncoding;
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight("#ffffff", "#c8b8a0", 1.0));
    const dl = new T.DirectionalLight("#ffffff", 0.6); dl.position.set(2, 4, 5); sc.add(dl);
    const cam = new T.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 20); cam.position.set(0, 1.15, 3.7); cam.lookAt(0, 0.95, 0); // 머리 위 새싹·별까지 보이게
    let ch = null, running = false, ang = 0.4;
    const loop = () => { if (!running) return; ang += 0.012; if (ch) ch.group.rotation.y = Math.sin(ang) * 0.8; r.render(sc, cam); requestAnimationFrame(loop); };
    return {
      set(look) { if (ch) sc.remove(ch.group); ch = makeCharacter(look); poseCharacter(ch, {}, 0); sc.add(ch.group); },
      start() { if (!running) { running = true; r.setSize(canvas.clientWidth || 180, canvas.clientHeight || 200, false); loop(); } },
      stop() { running = false; },
    };
  },
};
window.World = World;
})();
