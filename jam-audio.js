/* =====================================================================
   🎸 찬양팀 연습실 · 합주 소리 (전부 브라우저에서 직접 만든 소리예요, 음원 파일 없음)
   - 드럼: 킥 · 스네어 · 하이햇 · 오픈햇 · 탐 1·2 · 플로어 탐 · 크래시 · 라이드 · 박수
   - 건반: 피아노 / 패드 / 오르간 / 스트링 (메인 건반 = 피아노가 기본, 세컨 건반 = 패드가 기본)
   - 일렉 기타(찌그러진 소리·맑은 소리), 베이스, 노래(아~ / 우~ 화음)
   - 메트로놈, 드럼 자동 리듬(8비트 · 16비트 · 발라드 · 셔플)
   app.js가 window.JamAudio를 써요.
   ===================================================================== */
(() => {
"use strict";
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// 코드 버튼: 1 · 2m · 3m · 4 · 5 · 6m · ♭7 (숫자 코드, 찬양팀에서 많이 쓰는 방식)
const DEGREES = [
  { n: "1", semi: 0, q: "" }, { n: "2m", semi: 2, q: "m" }, { n: "3m", semi: 4, q: "m" }, { n: "4", semi: 5, q: "" },
  { n: "5", semi: 7, q: "" }, { n: "6m", semi: 9, q: "m" }, { n: "♭7", semi: 10, q: "" },
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const chordName = (key, d) => NOTE_NAMES[(key + DEGREES[d].semi) % 12] + DEGREES[d].q;
// 코드 구성음 (근음 기준 반음 수)
const triad = (q) => (q === "m" ? [0, 3, 7] : [0, 4, 7]);
function chordMidis(key, d, inst) {
  const g = DEGREES[d], root = (key + g.semi) % 12, iv = triad(g.q);
  if (inst === "bass") return [28 + ((root + 8) % 12)]; // E1~D#2 근처 근음 하나
  if (inst === "egtr") { const r = 40 + ((root + 8) % 12); return [r, r + 7, r + 12, r + 12 + iv[1], r + 19]; } // 파워 코드 + 3도
  if (inst === "sing" || inst === "lead") { const r = 55 + ((root + 5) % 12); return [r, r + iv[1], r + iv[2]]; } // 3성부 화음
  const r = 48 + root; // 건반: 왼손 근음 + 오른손 화음 (가운데 도 근처로 모아서)
  const top = iv.map((x) => { let m = 60 + ((root + x) % 12); if (m > 68) m -= 12; return m; }).sort((a, b) => a - b);
  return [r - 12 < 36 ? r : r - 12, ...top];
}
/* ----- 🎼 악보 코드 글자 읽기: A2, E/G#, F#m7, Bsus4, C#m7, F#7, Bm, E7, Gmaj7, Ddim, Caug, Asus2, Cadd9 … ----- */
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const notePc = (s) => { const m = /^([A-G])([#b]?)/.exec(s || ""); return m ? (PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12 : null; };
function parseChord(sym) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(String(sym || "").trim());
  if (!m) return null;
  const root = notePc(m[1]), q = m[2] || "", bass = m[3] ? notePc(m[3]) : null;
  let iv;
  const minor = /^m(?!aj)/.test(q) || /^min/.test(q);
  if (/sus4|sus(?!2)/.test(q)) iv = [0, 5, 7]; else if (/sus2/.test(q)) iv = [0, 2, 7];
  else if (/dim|°/.test(q)) iv = [0, 3, 6]; else if (/aug|\+/.test(q)) iv = [0, 4, 8];
  else iv = minor ? [0, 3, 7] : [0, 4, 7];
  if (/maj7|M7|Δ/.test(q)) iv.push(11); else if (/7|9|11|13/.test(q) && !/add/.test(q)) iv.push(/dim7/.test(q) ? 9 : 10);
  if (/(^|[^a-z])6/.test(q)) iv.push(9);
  if (/add9|add2|(^|m)2$|(^|maj|m)9/.test(q)) iv.push(14);
  return { root, iv, bass, q };
}
// 키를 옮겼을 때 코드 이름 (예: E2 → +2 → F#2)
function transposeName(sym, tr, keyPc) {
  if (!tr) return sym;
  const useFlat = [5, 10, 3, 8, 1].includes(keyPc); // F · Bb · Eb · Ab · Db 키는 ♭으로
  return String(sym).replace(/([A-G][#b]?)/g, (n) => { const pc = notePc(n); return pc == null ? n : (useFlat ? FLAT : SHARP)[(pc + tr + 120) % 12]; });
}
// 악기별 소리 (근음 + 화음): inst = key | egtr | bass | sing
function symMidis(sym, tr, inst) {
  const c = parseChord(sym); if (!c) return null;
  const root = (c.root + tr + 120) % 12, bass = c.bass == null ? root : (c.bass + tr + 120) % 12;
  const ivs = [...new Set(c.iv.map((x) => x % 12))];
  if (inst === "bass") return [28 + ((bass + 8) % 12)];
  if (inst === "egtr") { const r = 40 + ((root + 8) % 12); const out = [bass !== root ? 40 + ((bass + 8) % 12) : r]; for (const x of c.iv.slice(0, 4)) out.push(r + 12 + x); return [...new Set(out)].slice(0, 6); }
  if (inst === "sing" || inst === "lead") { const r = 55 + ((root + 5) % 12); return ivs.slice(0, 3).map((x) => r + x); }
  const top = ivs.map((x) => { let m = 60 + ((root + x) % 12); if (m > 70) m -= 12; return m; }).sort((a, b) => a - b);
  return [36 + ((bass + 12 - 0) % 12) + (bass < 4 ? 12 : 0), ...top];
}
// 코드표 글자 → [{ name: "V", bars: [["A2"], ["E/G#"], ["F#m7", "Bsus4"]] }, …]
function parseChart(text) {
  const out = [];
  for (const line of String(text || "").split(/\n/)) {
    const t = line.trim(); if (!t) continue;
    const m = /^([^:|]{1,8}):\s*(.*)$/.exec(t);
    const name = m ? m[1].trim() : (out.length ? out[out.length - 1].name : "곡");
    const bars = (m ? m[2] : t).split("|").map((b) => b.trim().split(/\s+/).filter((x) => parseChord(x))).filter((b) => b.length);
    if (!bars.length) continue;
    const last = out[out.length - 1];
    if (!m && last) last.bars.push(...bars); else out.push({ name, bars });
  }
  return out;
}
const DRUMS = ["kick", "snare", "hat", "ohat", "tom1", "tom2", "ftom", "crash", "ride", "clap"];
// 자동 리듬 (16칸 = 한 마디, 16분음표)
const LOOPS = {
  "8beat": { name: "8비트", kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  "16beat": { name: "16비트", kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  ballad: { name: "발라드", kick: [0, 10], snare: [8], hat: [0, 4, 8, 12], ride: [] },
  shuffle: { name: "셔플", kick: [0, 8], snare: [4, 12], hat: [0, 3, 4, 7, 8, 11, 12, 15] },
};

const A = {
  NOTE_NAMES, DEGREES, DRUMS, LOOPS, chordName, chordMidis, parseChord, parseChart, symMidis, transposeName,
  ctx: null, out: null, rev: null, noise: null, vol: 0.9,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
      this.out = ctx.createGain(); this.out.gain.value = this.vol; this.out.connect(comp);
      // 작은 방 울림 (리버브)
      const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      const conv = ctx.createConvolver(); conv.buffer = ir; this.rev = ctx.createGain(); this.rev.gain.value = 0.22; this.rev.connect(conv); conv.connect(this.out);
      const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
      const dist = ctx.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6) * 0.9; } dist.curve = curve; dist.oversample = "2x"; this.distCurve = curve;
      setTimeout(() => this.loadVoices(), 0); // 녹음 목소리 미리 받기
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return true;
  },
  setVolume(v) { this.vol = v; if (this.out) this.out.gain.value = v; },
  // 공통: 소리 → (볼륨) → 출력 + 리버브
  bus(vol, wet = 0.3) {
    const g = this.ctx.createGain(); g.gain.value = vol; g.connect(this.out);
    if (wet) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.rev); }
    return g;
  },
  osc(type, f, t, dur, dest, env) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    const [a, peak, rel] = env || [0.005, 1, dur];
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, rel));
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + rel + 0.05);
    return o;
  },
  noiseHit(t, dur, type, freq, q, vol, dest) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  /* ----- 🥁 드럼 ----- */
  drum(name, t, vel = 1) {
    const ctx = this.ctx, d = this.bus(0.9 * vel, name === "kick" ? 0.05 : 0.18);
    if (name === "kick") { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(1.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.5); this.noiseHit(t, 0.02, "lowpass", 3000, 0, 0.3, d); }
    else if (name === "snare") { this.osc("triangle", 190, t, 0.12, d, [0.001, 0.6, 0.13]); this.noiseHit(t, 0.22, "highpass", 1400, 0, 0.75, d); }
    else if (name === "clap") { for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.012, 0.09 + k * 0.03, "bandpass", 1200, 1.2, 0.8, d); }
    else if (name === "hat") this.noiseHit(t, 0.05, "highpass", 7500, 0, 0.45, d);
    else if (name === "ohat") this.noiseHit(t, 0.38, "highpass", 6500, 0, 0.4, d);
    else if (name === "crash") { this.noiseHit(t, 1.8, "highpass", 4200, 0, 0.55, d); this.noiseHit(t, 0.9, "bandpass", 8000, 0.8, 0.3, d); }
    else if (name === "ride") { this.noiseHit(t, 0.7, "bandpass", 9000, 2, 0.35, d); this.osc("sine", 3150, t, 0.6, d, [0.001, 0.05, 0.6]); }
    else { const f = { tom1: 210, tom2: 160, ftom: 105 }[name] || 160; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.55); this.noiseHit(t, 0.04, "bandpass", f * 4, 1, 0.2, d); }
  },
  /* ----- 🎹 건반 ----- */
  keys(midis, t, tone = "piano", vel = 1) {
    const ctx = this.ctx;
    for (const m of midis) {
      const f = mtof(m);
      if (tone === "piano") {
        const d = this.bus(0.24 * vel / Math.sqrt(midis.length * 0.6 + 0.4), 0.3), dur = 2.2 - Math.min(1.2, (m - 48) * 0.02);
        this.osc("triangle", f, t, dur, d, [0.004, 1, dur]); this.osc("sine", f * 2, t, dur * 0.6, d, [0.004, 0.35, dur * 0.6]); this.osc("sine", f * 3, t, 0.4, d, [0.002, 0.12, 0.4]);
      } else if (tone === "organ") {
        const d = this.bus(0.12 * vel / Math.sqrt(midis.length * 0.6 + 0.4), 0.25);
        for (const [h, a] of [[1, 1], [2, 0.6], [3, 0.35], [4, 0.25]]) this.osc("sine", f * h, t, 1.5, d, [0.02, a, 1.5]);
      } else { // pad · strings: 부드럽게 퍼지는 소리
        const d = this.bus((tone === "strings" ? 0.07 : 0.08) * vel / Math.sqrt(midis.length * 0.6 + 0.4), 0.55);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(tone === "strings" ? 2600 : 1400, t); lp.connect(d);
        const dur = tone === "strings" ? 2.6 : 3.4, att = tone === "strings" ? 0.25 : 0.45;
        for (const det of [-7, 0, 7]) { const o = this.osc("sawtooth", f, t, dur, lp, [att, 0.8, dur]); o.detune.value = det; }
      }
    }
  },
  /* ----- 🎸 일렉 기타 · 베이스 ----- */
  guitar(midis, t, tone = "drive", vel = 1) {
    const ctx = this.ctx, d = this.bus(tone === "drive" ? 0.13 * vel : 0.2 * vel, 0.3);
    let dest = d;
    if (tone === "drive") {
      const ws = ctx.createWaveShaper(); ws.curve = this.distCurve; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
      const pre = ctx.createGain(); pre.gain.value = 0.8; pre.connect(ws); ws.connect(lp); lp.connect(d); dest = pre;
    }
    midis.forEach((m, i) => { // 줄을 하나씩 긁어요 (스트럼)
      const st = t + i * 0.014, f = mtof(m), dur = tone === "drive" ? 1.4 : 1.8;
      this.osc(tone === "drive" ? "sawtooth" : "triangle", f, st, dur, dest, [0.003, 0.7, dur]);
      if (tone !== "drive") this.osc("sine", f * 2, st, dur * 0.5, dest, [0.003, 0.25, dur * 0.5]);
    });
  },
  bass(midis, t, vel = 1) {
    const ctx = this.ctx, d = this.bus(0.42 * vel, 0.05), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.6); lp.connect(d);
    for (const m of midis) { const f = mtof(m); this.osc("triangle", f, t, 1.3, lp, [0.004, 1, 1.3]); this.osc("sine", f, t, 1.3, d, [0.004, 0.5, 1.3]); this.osc("sawtooth", f, t, 0.25, lp, [0.002, 0.25, 0.25]); }
  },
  /* ----- 🎤 노래 (아~ / 우~ / 오~) : 우리 청년부가 직접 녹음한 목소리 (2026-11-13) ----- */
  // voice/me-{aah|ooh|oh}-{53,55,57,58,60,62,64,65}.mp3 = 파3~파4 음계를 모음마다 녹음한 것.
  // 가장 가까운 녹음을 조금 빠르게/느리게 틀어서 그 음을 내요. 다 받기 전에는 아래 합성 목소리(voiceSynth)로 대신해요.
  VOICE_NOTES: [53, 55, 57, 58, 60, 62, 64, 65],
  VOICE_FILES: { a: "aah", u: "ooh", o: "oh" },
  vbuf: null,
  loadVoices() {
    if (this.vbuf || !this.ctx || !window.fetch) return;
    this.vbuf = { a: {}, u: {}, o: {} };
    for (const [v, name] of Object.entries(this.VOICE_FILES)) for (const n of this.VOICE_NOTES) {
      fetch(`voice/me-${name}-${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((ab) => new Promise((ok, no) => this.ctx.decodeAudioData(ab, ok, no)))
        .then((buf) => { this.vbuf[v][n] = buf; }).catch(() => {});
    }
  },
  voiceReady(v) { const b = this.vbuf && this.vbuf[v]; return !!b && this.VOICE_NOTES.every((n) => b[n]); },
  voice(midis, t, vowel = "a", vel = 1) {
    const v = ["a", "u", "o"].includes(vowel) ? vowel : "a";
    if (!this.voiceReady(v)) { this.loadVoices(); return this.voiceSynth(midis, t, v, vel); }
    const ctx = this.ctx, d = this.bus(0.95 * vel / Math.sqrt(midis.length), 0.4);
    midis.forEach((m, i) => {
      let near = this.VOICE_NOTES[0];
      for (const n of this.VOICE_NOTES) if (Math.abs(n - m) < Math.abs(near - m)) near = n;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = this.vbuf[v][near];
      src.playbackRate.value = Math.pow(2, (m - near) / 12);
      if (midis.length > 1) src.detune.value = (i % 2 ? 4 : -4) * (i ? 1 : 0); // 화음은 아주 살짝 다르게 (여럿이 부르는 느낌)
      const st = t + (midis.length > 1 ? i * 0.012 : 0), end = st + src.buffer.duration / src.playbackRate.value;
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(1, st + 0.03);
      g.gain.setValueAtTime(1, Math.max(st + 0.04, end - 0.3)); g.gain.linearRampToValueAtTime(0.0001, end);
      src.connect(g); g.connect(d); src.start(st); src.stop(end + 0.02);
    });
  },
  /* ----- 🎤 합성 목소리 (녹음을 다 받기 전에 대신 써요) ----- */
  // 성대 소리(톱니파 + 숨소리) → 입 모양(모음마다 다른 공명 5개, '포먼트') 을 통과시켜요.
  // 음마다 두 사람이 살짝 다르게 부르게(합창), 처음엔 살짝 아래에서 올라붙고, 조금 뒤부터 비브라토가 들어가요.
  // 낮은 음(라3 아래)은 남자 목소리, 높은 음은 여자 목소리 공명을 써요.
  voiceSynth(midis, t, vowel = "a", vel = 1) {
    const lo = Math.min(...midis) < 57;
    const lvl = ({ a: 1, o: 0.92, u: 0.68 }[vowel] || 1) * (lo ? 1.35 : 1); // 모음·높이마다 크기를 맞춰요
    const ctx = this.ctx, d = this.bus(0.27 * lvl * vel / Math.sqrt(midis.length), 0.45);
    const FT = {
      f: { a: [[800, 0, 80], [1150, -4, 90], [2900, -20, 120], [3900, -36, 130], [4950, -60, 140]],
           o: [[450, 0, 70], [800, -9, 80], [2830, -16, 100], [3800, -28, 130], [4950, -55, 135]],
           u: [[325, 0, 50], [700, -12, 60], [2530, -30, 170], [3500, -40, 180], [4950, -64, 200]] },
      m: { a: [[600, 0, 60], [1040, -7, 70], [2250, -9, 110], [2450, -9, 120], [2750, -20, 130]],
           o: [[400, 0, 40], [750, -11, 80], [2400, -21, 100], [2600, -20, 120], [2900, -40, 120]],
           u: [[350, 0, 40], [600, -20, 80], [2400, -32, 100], [2675, -28, 120], [2950, -36, 120]] },
    };
    const F = (FT[lo ? "m" : "f"][vowel] || FT.f.a);
    // 입 모양: 공명 필터 5개를 나란히
    const mouth = ctx.createGain();
    for (const [f, db, bw] of F) {
      const b = ctx.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = f; b.Q.value = f / bw;
      const g = ctx.createGain(); g.gain.value = Math.pow(10, db / 20) * 3.2;
      mouth.connect(b); b.connect(g); g.connect(d);
    }
    const end = t + 2.05;
    for (const m of midis) {
      const f0 = mtof(m);
      for (const [det, dl, rate] of [[-6, 0, 5.3], [7, 0.018, 5.75]]) { // 두 사람이 같이 불러요
        const st = t + dl, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sawtooth"; o.detune.value = det;
        o.frequency.setValueAtTime(f0 * 0.965, st); o.frequency.exponentialRampToValueAtTime(f0, st + 0.11); // 살짝 올라붙기
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rate;
        lg.gain.setValueAtTime(0, st); lg.gain.setValueAtTime(0, st + 0.35); lg.gain.linearRampToValueAtTime(f0 * 0.011, st + 0.85); // 늦게 들어오는 비브라토
        lfo.connect(lg); lg.connect(o.frequency);
        const jit = ctx.createOscillator(), jg = ctx.createGain(); jit.frequency.value = 2.1 + Math.random(); jg.gain.value = f0 * 0.003; jit.connect(jg); jg.connect(o.frequency); // 사람다운 흔들림
        g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(0.5, st + 0.14); g.gain.linearRampToValueAtTime(0.42, st + 0.5);
        g.gain.setValueAtTime(0.42, st + 1.45); g.gain.exponentialRampToValueAtTime(0.0001, end);
        o.connect(g); g.connect(mouth);
        o.start(st); lfo.start(st); jit.start(st); o.stop(end + 0.05); lfo.stop(end + 0.05); jit.stop(end + 0.05);
      }
    }
    // 숨소리 (아주 작게, 같은 입 모양을 통과)
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.05, t + 0.08); ng.gain.linearRampToValueAtTime(0.018, t + 0.4); ng.gain.exponentialRampToValueAtTime(0.0001, end);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    n.connect(hp); hp.connect(ng); ng.connect(mouth); n.start(t, Math.random() * 0.4); n.stop(end + 0.05);
  },
  click(t, accent) { const d = this.bus(accent ? 0.5 : 0.3, 0); this.osc("square", accent ? 1760 : 1320, t, 0.03, d, [0.001, 0.6, 0.03]); },
  /* ----- 소리 내기 (내 것이든 남의 것이든 같은 함수) ----- */
  // ev: { k: "d"(드럼) | "n"(음 여러 개), v: 드럼 이름 또는 midi 배열, s: 음색 }
  play(inst, ev, delay = 0) {
    if (!this.ensure() || !ev) return;
    const t = this.ctx.currentTime + 0.005 + Math.max(0, delay) / 1000;
    if (ev.k === "d") { if (DRUMS.includes(ev.v)) this.drum(ev.v, t, ev.vel || 1); return; }
    const m = (Array.isArray(ev.v) ? ev.v : [ev.v]).map(Number).filter((x) => x >= 20 && x <= 100).slice(0, 6);
    if (!m.length) return;
    if (inst === "drums") return;
    if (inst === "key" || inst === "key2") this.keys(m, t, ["piano", "pad", "organ", "strings"].includes(ev.s) ? ev.s : inst === "key2" ? "pad" : "piano");
    else if (inst === "egtr") this.guitar(m, t, ev.s === "clean" ? "clean" : "drive");
    else if (inst === "bass") this.bass(m, t);
    else this.voice(m, t, ["a", "u", "o"].includes(ev.s) ? ev.s : "a");
  },
  /* ----- 자동 리듬 · 메트로놈 (여러 개를 동시에 돌릴 수 있어요: 내 것 + 다른 드러머 것) ----- */
  loops: new Map(), // id → { pattern, bpm, step, next }
  setLoop(id, pattern, bpm) {
    const cur = this.loops.get(id);
    if (!pattern || !LOOPS[pattern]) { this.loops.delete(id); this._tick(); return; }
    if (cur && cur.pattern === pattern && cur.bpm === bpm) return;
    if (!this.ensure()) return;
    this.loops.set(id, { pattern, bpm: Math.max(40, Math.min(200, bpm || 80)), step: 0, next: this.ctx.currentTime + 0.1, metro: pattern === "metro" });
    this._tick();
  },
  setMetro(on, bpm) {
    if (!on) { this.loops.delete("__metro"); this._tick(); return; }
    if (!this.ensure()) return;
    const cur = this.loops.get("__metro"); if (cur && cur.bpm === bpm) return;
    this.loops.set("__metro", { metro: true, bpm: Math.max(40, Math.min(200, bpm || 80)), step: 0, next: this.ctx.currentTime + 0.1 });
    this._tick();
  },
  onStep: null, // 내 드럼 리듬이 칠 때 내 캐릭터 몸짓용
  _tick() {
    clearTimeout(this._tm);
    if (!this.loops.size || !this.ctx) return;
    const ahead = this.ctx.currentTime + 0.12;
    for (const [id, L] of this.loops) {
      const sixteenth = 60 / L.bpm / 4;
      while (L.next < ahead) {
        const st = L.step % 16;
        if (L.metro) { if (st % 4 === 0) this.click(L.next, st === 0); }
        else { const P = LOOPS[L.pattern]; for (const dn of ["kick", "snare", "hat", "ride"]) if (P[dn] && P[dn].includes(st)) this.drum(dn, L.next, dn === "hat" ? (st % 4 === 0 ? 0.8 : 0.55) : 0.85); if (st === 0 && L.step % 64 === 0 && L.step) this.drum("crash", L.next, 0.6); if (this.onStep && st % 4 === 0) this.onStep(id); }
        L.next += sixteenth; L.step++;
      }
    }
    this._tm = setTimeout(() => this._tick(), 40);
  },
  stopAll() { this.loops.clear(); clearTimeout(this._tm); },
};
window.JamAudio = A;
})();
