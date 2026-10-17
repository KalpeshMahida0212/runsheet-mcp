/*
  THE SOUND: the score, the hits and the voice, mixed and brought to -14 LUFS. The instruments, the buses, the ducking,
  the reverb and the limiter are Runsheet's own reel score (synthesised from oscillators and noise: no samples, nothing
  from any song or library, so every note is original and free to publish). The arrangement follows the plan:

      the hook            the groove at half strength, a tick on every word, a pop and a bell on the accent word
      the middle          the full groove; whooshes on the slides, pops and blips as cards land, ticks as boxes tick
      a dark scene        a riser and a snare roll into it, an impact as the dome opens, the darker chords
      an accent scene     a riser and a roll, then the drop on the number or the line: impact, crash, sub
      a slam              an impact and a sub under the word
      the end card        one chord, bells, the stamp's hit, then the last second lets go

  The voice sits about 11 dB over the score, the bed ducks 9 dB under it, the hits only about 1 dB so they still land.
*/
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { FFMPEG } from "./ff.mjs";

const SR = 48000;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; }
  set(type, f, q = 0.707) {
    f = Math.max(20, Math.min(f, SR * 0.45));
    const w = (2 * Math.PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === "lp") [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === "hp") [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [al, 0, -al];
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
const blep = (t, dt) => { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };
const saw = (ph, dt) => 2 * ph - 1 - blep(ph, dt);

const CHORDS = {
  Am: { root: 33, chord: [57, 60, 64, 67, 72], arp: [69, 72, 76, 79, 81, 79, 76, 72] },
  F: { root: 29, chord: [53, 57, 60, 64, 69], arp: [65, 69, 72, 76, 77, 76, 72, 69] },
  C: { root: 36, chord: [52, 55, 60, 64, 67], arp: [67, 72, 76, 79, 84, 79, 76, 72] },
  G: { root: 31, chord: [55, 59, 62, 67, 71], arp: [67, 71, 74, 79, 83, 79, 74, 71] },
  Dm: { root: 26, chord: [50, 53, 57, 62, 65], arp: [62, 65, 69, 72, 74, 72, 69, 65] },
  E: { root: 28, chord: [52, 56, 59, 64, 68], arp: [64, 68, 71, 76, 80, 76, 71, 68] },
};
const PROG_A = ["Am", "F", "C", "G"], PROG_D = ["Am", "F", "Dm", "E"];
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const CHIME = [[1, 1, 1.6], [2.76, 0.42, 2.6], [5.4, 0.22, 4], [8.93, 0.1, 6]];

function decode(file, channels = 1) {
  const r = spawnSync(FFMPEG, ["-v", "error", "-i", file, "-f", "f32le", "-ac", String(channels), "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`could not read ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
}

/**
 * The mix for a plan: `voices` are [{ file, at }] (seconds), `music` is "auto", "none" or { path, volume }.
 * Writes a 48 kHz 16-bit stereo wav at -14 LUFS to `out` and returns { lufs, peak, hits }.
 */
export function mixSound({ plan, voices, music = "auto", out, work }) {
  const DUR = plan.total, N = Math.round(DUR * SR);
  const bus = () => [new Float32Array(N), new Float32Array(N)];
  const DR = bus(), MU = bus(), FX = bus(), HT = bus(), SEND = bus();
  let seed = 20261017;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const noise = () => rnd() * 2 - 1;
  const panLR = (p) => { const a = ((p + 1) * Math.PI) / 4; return [Math.cos(a), Math.sin(a)]; };
  const put = (B, i, l, r, send = 0) => {
    if (i < 0 || i >= N) return;
    B[0][i] += l; B[1][i] += r;
    if (send) { SEND[0][i] += l * send; SEND[1][i] += r * send; }
  };
  const LOG = [];
  const note = (t, what) => LOG.push({ t: +t.toFixed(3), what });

  // ------------------------------------------------------------ the instruments
  const KICKS = [];
  function kick(t, g = 1, duck = 0.55) {
    KICKS.push([t, duck]);
    const i0 = Math.round(t * SR); let ph = 0;
    for (let n = 0; n < 0.5 * SR; n++) {
      const s = n / SR, f = 44 + 120 * Math.exp(-s * 26) + 60 * Math.exp(-s * 140);
      ph += (2 * Math.PI * f) / SR;
      let x = Math.sin(ph) * Math.min(1, s / 0.0015) * Math.exp(-s * 6.2);
      if (s < 0.004) x += noise() * 0.3 * (1 - s / 0.004);
      x = Math.tanh(x * 1.7) / Math.tanh(1.7);
      put(DR, i0 + n, x * g * 0.92, x * g * 0.92);
    }
  }
  function clap(t, g = 1, send = 0.25) {
    const i0 = Math.round(t * SR), fl = new Biquad().set("bp", 1250, 1.1), frr = new Biquad().set("bp", 1400, 1.1);
    for (let n = 0; n < 0.4 * SR; n++) {
      const s = n / SR; let env = 0;
      for (const o of [0, 0.008, 0.017]) if (s >= o) env = Math.max(env, Math.exp(-(s - o) * 190));
      if (s >= 0.022) env = Math.max(env, 0.6 * Math.exp(-(s - 0.022) * 13));
      put(DR, i0 + n, fl.run(noise()) * env * g * 1.9, frr.run(noise()) * env * g * 1.9, send);
    }
  }
  function hat(t, g = 1, open = false, p = 0) {
    const i0 = Math.round(t * SR), hp = new Biquad().set("hp", 7200, 0.7), bp = new Biquad().set("bp", 10500, 1.2), [pl, pr] = panLR(p);
    for (let n = 0; n < (open ? 0.32 : 0.07) * SR; n++) {
      const s = n / SR, env = open ? Math.exp(-s * 8.5) : Math.exp(-s * 60);
      const x = (hp.run(noise()) * 0.65 + bp.run(noise()) * 0.5) * env * g * 0.5;
      put(DR, i0 + n, x * pl, x * pr, open ? 0.1 : 0);
    }
  }
  function snare(t, g = 1, tone = 190) {
    const i0 = Math.round(t * SR), bp = new Biquad().set("bp", 1900, 0.8); let ph = 0;
    for (let n = 0; n < 0.24 * SR; n++) {
      const s = n / SR;
      ph += (2 * Math.PI * tone * (1 + 0.5 * Math.exp(-s * 40))) / SR;
      const x = bp.run(noise()) * Math.exp(-s * 20) * 1.3 + Math.sin(ph) * Math.exp(-s * 32) * 0.7;
      put(DR, i0 + n, x * g * 0.6, x * g * 0.6, 0.15);
    }
  }
  function crash(t, g = 1, B = DR) {
    const i0 = Math.round(t * SR), hl = new Biquad().set("hp", 3800, 0.6), hr = new Biquad().set("hp", 3800, 0.6), bl = new Biquad().set("bp", 7500, 0.9), br = new Biquad().set("bp", 7500, 0.9);
    for (let n = 0; n < 2.2 * SR; n++) {
      const s = n / SR, env = Math.min(1, s / 0.002) * Math.exp(-s * 2.1);
      put(B, i0 + n, (hl.run(noise()) + bl.run(noise()) * 0.6) * env * g * 0.32, (hr.run(noise()) + br.run(noise()) * 0.6) * env * g * 0.32, 0.25);
    }
  }
  function pad(t0, dur, notes, g = 1, o = {}) {
    const { attack = 0.2, release = 0.6, cut0 = 900, cut1 = 2600, q = 0.8, detune = 0.13, voices: nv = 5, send = 0.35, target = MU } = o;
    const i0 = Math.round(t0 * SR), len = Math.round((dur + release) * SR);
    for (const m of notes) {
      const f0 = mtof(m);
      const osc = Array.from({ length: nv }, (_, k) => ({ ph: rnd(), det: (k / (nv - 1) - 0.5) * 2 * detune, p: (k / (nv - 1) - 0.5) * 1.6 }));
      const fl = new Biquad(), frr = new Biquad();
      for (let n = 0; n < len; n++) {
        const s = n / SR;
        if (n % 32 === 0) { const c = cut0 + (cut1 - cut0) * Math.min(1, s / Math.max(0.01, dur)); fl.set("lp", c, q); frr.set("lp", c, q); }
        let l = 0, r = 0;
        for (const v of osc) {
          const dt = (f0 * Math.pow(2, v.det / 12)) / SR;
          v.ph += dt; if (v.ph >= 1) v.ph -= 1;
          const x = saw(v.ph, dt), [pl, pr] = panLR(v.p);
          l += x * pl; r += x * pr;
        }
        const env = Math.min(1, s / attack) * (s > dur ? Math.exp(-(s - dur) / (release / 4)) : 1);
        const k = (g * env * 1.6) / (nv * Math.sqrt(notes.length));
        put(target, i0 + n, fl.run(l) * k, frr.run(r) * k, send);
      }
    }
  }
  function pluck(t, m, g = 1, p = 0, send = 0.3) {
    const i0 = Math.round(t * SR), f0 = mtof(m), lp = new Biquad(), [pl, pr] = panLR(p);
    let a = rnd(), c = rnd();
    for (let n = 0; n < 0.45 * SR; n++) {
      const s = n / SR;
      if (n % 16 === 0) lp.set("lp", 350 + 5200 * Math.exp(-s * 16), 1.3);
      const d1 = (f0 * 1.0035) / SR, d2 = (f0 * 0.9965) / SR;
      a = (a + d1) % 1; c = (c + d2) % 1;
      const x = lp.run(saw(a, d1) + saw(c, d2)) * Math.min(1, s / 0.002) * Math.exp(-s * 7.5) * g * 0.5;
      put(MU, i0 + n, x * pl, x * pr, send);
    }
  }
  function bass(t, dur, m, g = 1) {
    const i0 = Math.round(t * SR), f0 = mtof(m), lp = new Biquad().set("lp", 520, 1.1); let p1 = 0, p2 = 0;
    for (let n = 0; n < (dur + 0.04) * SR; n++) {
      const s = n / SR, dt = f0 / SR;
      p1 += (2 * Math.PI * f0) / SR; p2 = (p2 + dt) % 1;
      const env = Math.min(1, s / 0.004) * (s > dur ? Math.max(0, 1 - (s - dur) / 0.04) : 1);
      const x = Math.tanh((Math.sin(p1) * 0.85 + lp.run(saw(p2, dt)) * 0.45) * 1.4) * env * g * 0.55;
      put(MU, i0 + n, x, x);
    }
  }
  function sub(t0, t1, m, g = 1, rise = 0, B = MU) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR); let ph = 0;
    for (let n = 0; n < len; n++) {
      const q = n / len;
      ph += (2 * Math.PI * mtof(m) * Math.pow(2, (rise * q) / 12)) / SR;
      const x = Math.sin(ph) * Math.min(1, q * 3) * Math.min(1, (1 - q) * 30) * g * (0.3 + 0.7 * q);
      put(B, i0 + n, x, x);
    }
  }
  function riser(t0, t1, g = 1, f0 = 250, f1 = 7000) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR), bl = new Biquad(), br = new Biquad(); let ph = 0;
    for (let n = 0; n < len; n++) {
      const q = n / len;
      if (n % 32 === 0) { const c = f0 * Math.pow(f1 / f0, q); bl.set("bp", c, 2.2); br.set("bp", c * 1.06, 2.2); }
      const tf = 110 * Math.pow(8, q); ph = (ph + tf / SR) % 1;
      const env = q * q * g, tone = saw(ph, tf / SR) * 0.07;
      put(HT, i0 + n, (bl.run(noise()) * 1.4 + tone) * env, (br.run(noise()) * 1.4 + tone) * env, 0.2);
    }
  }
  function whoosh(t0, dur, g = 1, f0 = 400, f1 = 4000, p0 = -0.6, p1 = 0.6, shape = "bell") {
    const i0 = Math.round(t0 * SR), len = Math.round(dur * SR), bp = new Biquad(), bp2 = new Biquad();
    for (let n = 0; n < len; n++) {
      const q = n / len;
      if (n % 32 === 0) { const c = f0 * Math.pow(f1 / f0, q); bp.set("bp", c, 1.4); bp2.set("bp", c * 1.5, 2); }
      const env = shape === "bell" ? Math.pow(Math.sin(q * Math.PI), 2) : shape === "rise" ? Math.pow(q, 2.5) * (q > 0.97 ? (1 - q) / 0.03 : 1) : Math.pow(1 - q, 2);
      const x = (bp.run(noise()) + bp2.run(noise()) * 0.5) * env * g * 1.3, [pl, pr] = panLR(p0 + (p1 - p0) * q);
      put(HT, i0 + n, x * pl, x * pr, 0.25);
    }
  }
  function impact(t, g = 1) {
    const i0 = Math.round(t * SR), lp = new Biquad(), hp = new Biquad().set("hp", 2200, 0.7); let ph = 0;
    for (let n = 0; n < 2.8 * SR; n++) {
      const s = n / SR;
      if (n % 32 === 0) lp.set("lp", 300 + 1400 * Math.exp(-s * 9), 0.8);
      ph += (2 * Math.PI * (30 + 52 * Math.exp(-s * 12))) / SR;
      const boom = Math.sin(ph) * Math.min(1, s / 0.002) * Math.exp(-s * 1.9), body = lp.run(noise()) * Math.exp(-s * 7) * 1.4, crack = hp.run(noise()) * Math.exp(-s * 55) * 0.8;
      const x = Math.tanh((boom * 1.1 + body + crack) * 1.3) * g;
      put(HT, i0 + n, x, x, 0.45);
    }
  }
  function tick(t, f, g = 1, p = 0, send = 0.15) {
    const i0 = Math.round(t * SR), [pl, pr] = panLR(p); let ph = 0;
    for (let n = 0; n < 0.06 * SR; n++) {
      const s = n / SR; ph += (2 * Math.PI * f) / SR;
      const x = (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * Math.exp(-s * 85) * g;
      put(FX, i0 + n, x * pl, x * pr, send);
    }
  }
  function blip(t, f, g = 1, p = 0) {
    const i0 = Math.round(t * SR), [pl, pr] = panLR(p); let ph = 0;
    for (let n = 0; n < 0.12 * SR; n++) {
      const s = n / SR; ph += (2 * Math.PI * f * (1 + 0.6 * Math.exp(-s * 70))) / SR;
      const x = Math.sin(ph) * Math.exp(-s * 32) * g;
      put(FX, i0 + n, x * pl, x * pr, 0.2);
    }
  }
  function pop(t, f, g = 1, p = 0) {
    const i0 = Math.round(t * SR), [pl, pr] = panLR(p); let ph = 0;
    for (let n = 0; n < 0.08 * SR; n++) {
      const s = n / SR; ph += (2 * Math.PI * f * (0.6 + 1.4 * Math.min(1, s / 0.03))) / SR;
      const x = Math.sin(ph) * Math.min(1, s / 0.002) * Math.exp(-s * 45) * g;
      put(FX, i0 + n, x * pl, x * pr, 0.15);
    }
  }
  function bell(t, m, g = 1, p = 0, partials = CHIME, len = 1.6) {
    const i0 = Math.round(t * SR), f0 = mtof(m), [pl, pr] = panLR(p), ph = partials.map(() => 0);
    for (let n = 0; n < len * SR; n++) {
      const s = n / SR; let x = 0;
      partials.forEach(([r, a, d], k) => { ph[k] += (2 * Math.PI * f0 * r) / SR; x += Math.sin(ph[k]) * a * Math.exp(-s * d); });
      x *= Math.min(1, s / 0.001) * g * 0.5;
      put(FX, i0 + n, x * pl, x * pr, 0.4);
    }
  }
  function tom(t, g = 1) {
    const i0 = Math.round(t * SR); let ph = 0;
    for (let n = 0; n < 0.35 * SR; n++) {
      const s = n / SR; ph += (2 * Math.PI * (80 + 70 * Math.exp(-s * 20))) / SR;
      put(HT, i0 + n, Math.sin(ph) * Math.exp(-s * 9) * g, Math.sin(ph) * Math.exp(-s * 9) * g, 0.1);
    }
  }
  const types = (t, n, every, f0 = 1900, g = 0.04) => { for (let k = 0; k < n; k++) tick(t + k * every, f0 + rnd() * 900, g, 0.2, 0.02); };
  const roll = (t, g0 = 0.26) => [0.32, 0.24, 0.17, 0.11, 0.06, 0.03].forEach((dt, i) => snare(t - dt, g0 + i * 0.08, 210 + i * 25));

  // ------------------------------------------------------------ the bed
  function groove(t0, t1, o) {
    const { grid0 = t0, prog = PROG_A, kick: gk = 1, clap: gc = 0.5, hat: gh = 0.4, bass: gb = 0.7, arp: ga = 0.12, pad: gp = 0.4, sub: gs = 0.3, sixteenth = false, crashEvery = 0 } = o;
    const BAR = 2, beat = (k) => grid0 + k * 0.5, k0 = Math.ceil((t0 - grid0) / 0.5 - 1e-6);
    const chordAt = (t) => CHORDS[prog[Math.max(0, Math.floor((t - grid0 + 1e-6) / BAR)) % prog.length]];
    for (let b = Math.floor((t0 - grid0) / BAR); grid0 + b * BAR < t1; b++) {
      const bs = Math.max(grid0 + b * BAR, t0), be = Math.min(grid0 + (b + 1) * BAR, t1);
      if (be - bs < 0.2) continue;
      const ch = CHORDS[prog[((b % prog.length) + prog.length) % prog.length]];
      if (gp) pad(bs, Math.max(0.1, be - bs - 0.1), ch.chord, gp, { attack: 0.02, release: 0.35, cut0: 1500, cut1: 4200 });
      if (gs) sub(bs, be - 0.01, ch.root, gs);
      if (crashEvery && b % crashEvery === 0 && b > 0) crash(bs, 0.3);
    }
    for (let k = k0; beat(k) < t1 - 1e-6; k++) {
      const t = beat(k); if (t < t0 - 1e-6) continue;
      const ch = chordAt(t), bi = ((k % 4) + 4) % 4;
      if (gk) kick(t, gk);
      if (gc && (bi === 1 || bi === 3)) clap(t, gc);
      if (gh) hat(t + 0.25, gh, true, 0.15);
      if (gb) { bass(t + 0.25, 0.2, ch.root + 12, gb); if (bi === 0) bass(t, 0.12, ch.root, gb * 0.7); }
    }
    const s0 = Math.ceil((t0 - grid0) / 0.125 - 1e-6);
    for (let s = s0; grid0 + s * 0.125 < t1 - 1e-6; s++) {
      const t = grid0 + s * 0.125; if (t < t0 - 1e-6) continue;
      const ch = chordAt(t);
      if (gh && (sixteenth ? s % 2 === 1 : s % 4 === 3)) hat(t, [0.28, 0.13, 0, 0.17][((s % 4) + 4) % 4] * gh * 2.2, false, s % 4 === 1 ? -0.35 : 0.35);
      if (ga) { const m = ch.arp[((s % 8) + 8) % 8]; pluck(t, m, ga, s % 2 ? 0.35 : -0.35); if (s % 3 === 0) pluck(t + 0.375, m, ga * 0.35, s % 2 ? -0.5 : 0.5, 0.4); }
    }
  }

  // ------------------------------------------------------------ the arrangement, from the plan
  const S = plan.scenes, bed = music === "auto";
  const moodOf = (s, i) => (i === 0 ? "hook" : s.type === "end" ? "end" : s.ground === "punch" ? "drop" : s.ground === "dark" ? "dark" : "main");
  const sections = [];
  S.forEach((s, i) => {
    const m = moodOf(s, i), last = sections[sections.length - 1];
    if (last && last.mood === m && m !== "drop") last.t1 = s.start + s.len;
    else sections.push({ mood: m, t0: s.start, t1: s.start + s.len, scene: s });
  });
  const endScene = S.find((s) => s.type === "end");
  const tMark = endScene ? endScene.start + endScene.cues.mark : DUR - 1.2;
  for (const [k, sec] of sections.entries()) {
    const t1 = sec.t1 - 0.01, t0 = sec.t0;
    const into = k > 0 && (sec.mood === "dark" || sec.mood === "drop");
    // the hit that opens a dark or accent section lands on the scene's own moment
    const land = sec.mood === "drop" ? sec.scene.start + (sec.scene.type === "stat" ? sec.scene.cues.value : sec.scene.cues.land ?? 0.05) : t0 + 0.02;
    if (into) {
      riser(Math.max(0, land - 1.1), land - 0.03, 0.36, 220, 7000);
      roll(land, 0.24);
      impact(land, sec.mood === "drop" ? 1.0 : 0.9);
      crash(land, 0.8);
      kick(land, 1.15, 0.3);
      sub(land, land + 1.4, sec.mood === "drop" ? 29 : 26, 0.55);
      note(land, `${sec.mood}: impact, crash, sub`);
    }
    if (!bed) continue;
    if (sec.mood === "hook") groove(t0, t1, { kick: 0.78, clap: 0, hat: 0.3, bass: 0.55, arp: 0.09, pad: 0.34, sub: 0.22 });
    else if (sec.mood === "main") groove(t0, t1, { kick: 0.92, clap: 0.5, hat: 0.4, bass: 0.7, arp: 0.12, pad: 0.44, sub: 0.28, crashEvery: 4 });
    else if (sec.mood === "dark") groove(t0 + 0.02, t1, { prog: PROG_D, kick: 0.92, clap: 0.48, hat: 0.4, bass: 0.78, arp: 0.14, pad: 0.48, sub: 0.32, sixteenth: true, crashEvery: 4 });
    else if (sec.mood === "drop") {
      // the bed waits for the drop: a held pad and a rising sub, then the full groove from the hit
      if (land - t0 > 0.3) { pad(t0, land - t0 - 0.05, [48, 52, 55, 59, 64], 0.4, { attack: 0.05, release: 0.3, cut0: 1800, cut1: 5200, send: 0.5 }); sub(t0, land - 0.02, 33, 0.35, 12); }
      groove(land, t1, { grid0: land, kick: 0.95, clap: 0.55, hat: 0.4, bass: 0.72, arp: 0.125, pad: 0.46, sub: 0.3, crashEvery: 4 });
    } else if (sec.mood === "end") {
      if (tMark - t0 > 0.4) groove(t0, tMark - 0.02, { kick: 0.85, clap: 0.42, hat: 0.36, bass: 0.62, arp: 0.13, pad: 0.4, sub: 0.26 });
      pad(tMark, 0.5, [33, 45, 52, 57, 60, 64, 71], 0.8, { attack: 0.004, release: 2.0, cut0: 6000, cut1: 1500, send: 0.6, target: FX });
      pad(tMark + 0.25, Math.max(0.5, DUR - tMark - 0.9), [57, 64, 69, 71, 76], 0.3, { attack: 0.4, release: 0.6, cut0: 1200, cut1: 2400, send: 0.5, target: FX });
    }
  }
  if (music && typeof music === "object" && music.path) {
    // the creator's own track instead of the bed, looped and faded at the end
    const x = decode(music.path, 2), g = Number(music.volume ?? 0.5), n2 = x.length / 2;
    for (let n = 0; n < N; n++) { const k = (n % n2) * 2; put(MU, n, x[k] * g, x[k + 1] * g); }
  }

  // ------------------------------------------------------------ every scene's sounds
  const word = (s, t) => s.start + t;
  for (const s of S) {
    const t = s.start;
    if (s.enter === "slide") whoosh(t - 0.05, 0.34, 0.34, 500, 3200, 0.6, -0.6, "bell");
    else if (s.enter === "flood") whoosh(t - 0.28, 0.3, 0.34, 300, 5000, -0.4, 0.4, "rise");
    else if (s.enter === "dome") whoosh(t - 0.3, 0.32, 0.4, 120, 2600, 0, 0, "rise");
    else if (s.enter === "zoom") whoosh(t - 0.02, 0.3, 0.34, 2800, 350, 0.5, -0.5, "fall");
    // the headline: a tick on every word, a pop and a bell on the accent word
    const heads = [...(s.head ?? []), ...(s.wrongHead ?? []), ...(s.rightHead ?? [])];
    heads.forEach((w, i) => {
      if (w.emph) { pop(word(s, w.at), 620, 0.14); bell(word(s, w.at) + 0.03, 88 + (s.no % 3) * 2, 0.1, 0); }
      else tick(word(s, w.at), 1500 + (i % 6) * 150, 0.06, -0.3 + (i % 5) * 0.15);
    });
    switch (s.type) {
      case "hook": case "text":
        if (s.icon) { const ti = word(s, s.cues.icon); whoosh(ti - 0.08, 0.3, 0.16, 500, 3200, 0, 0, "bell"); pop(ti, 540, 0.16); bell(ti + 0.04, 91, 0.12, 0); tom(ti, 0.22); }
        break;
      case "list":
        s.items.forEach((it, i) => { const ti = word(s, it.at); tom(ti, 0.22); pop(ti, 480 + i * 80, 0.14, -0.4 + i * 0.27); blip(ti + 0.03, mtof(PENTA[5 + i]), 0.08, -0.4 + i * 0.27); });
        break;
      case "checklist":
        s.items.forEach((it, i) => { const ti = word(s, it.at); tick(ti, 2400 + i * 200, 0.15); pop(ti + 0.01, 700, 0.1); bell(ti + 0.04, [88, 91, 93, 96][i], 0.11, -0.3 + i * 0.2); });
        break;
      case "steps":
        s.items.forEach((it, i) => { const ti = word(s, it.at); if (i) whoosh(ti - 0.3, 0.28, 0.1, 400, 2400, 0, 0, "rise"); pop(ti, 520 + i * 60, 0.14); blip(ti + 0.03, mtof(PENTA[4 + i]), 0.08); });
        break;
      case "compare": {
        const tl = word(s, s.cues.left), tr = word(s, s.cues.right);
        whoosh(tl - 0.1, 0.3, 0.2, 400, 2600, -0.7, 0, "bell"); tom(tl, 0.2);
        whoosh(tr - 0.1, 0.3, 0.2, 400, 2600, 0.7, 0, "bell"); pop(tr - 0.12, 560, 0.15); tom(tr, 0.24); bell(tr + 0.04, 93, 0.11, 0.2);
        break;
      }
      case "stat": {
        const tv = word(s, s.cues.value);
        for (let i = 0; i < 8; i++) tick(tv - 0.6 + i * 0.07, 2600 + i * 220, 0.06, i % 2 ? 0.3 : -0.3);
        bell(tv + 0.06, 93, 0.14, 0); bell(tv + 0.12, 100, 0.1, 0.3);
        [0.1, 0.18, 0.26, 0.34].forEach((dt, i) => blip(tv + dt, mtof(PENTA[7 + i]), 0.08, -0.5 + i * 0.35));
        break;
      }
      case "slam": {
        const ts = word(s, s.cues.slam);
        impact(ts, 0.9); sub(ts, ts + 1.0, 28, 0.5); crash(ts, 0.5, HT);
        note(ts, "slam");
        break;
      }
      case "punch": {
        const tl = word(s, s.cues.land);
        clap(tl, 0.32); bell(tl + 0.05, 93, 0.12, 0);
        break;
      }
      case "quote": {
        const t0 = word(s, s.cues.type), t1 = word(s, s.cues.typeEnd);
        pop(t0 - 0.25, 540, 0.12);
        types(t0, Math.max(4, Math.round((t1 - t0) / 0.07)), 0.07, 2000, 0.035);
        break;
      }
      case "chat":
        s.messages.forEach((m, i) => { const tm = word(s, m.at); pop(tm, m.from === "me" ? 760 : 560, 0.15, m.from === "me" ? 0.4 : -0.4); blip(tm + 0.03, mtof(PENTA[(m.from === "me" ? 7 : 5) + (i % 2)]), 0.08, m.from === "me" ? 0.4 : -0.4); });
        break;
      case "image":
        whoosh(t + 0.02, 0.3, 0.14, 500, 2600, 0, 0, "bell"); tick(t + 0.12, 3200, 0.12); pop(t + 0.14, 600, 0.1);
        break;
      case "strike": {
        const tk = word(s, s.cues.strike);
        whoosh(tk - 0.02, 0.26, 0.26, 2800, 500, -0.6, 0.6, "fall"); tick(tk, 1800, 0.12); tom(tk + 0.04, 0.18);
        break;
      }
      case "end": {
        const tm = word(s, s.cues.mark);
        impact(tm, 0.45);
        [[0.07, 81], [0.2, 88], [0.33, 93], [0.5, 95]].forEach(([dt, m], j) => bell(tm + dt, m, 0.12, -0.3 + j * 0.2, CHIME, 2.0));
        if (s.sub) types(tm + 0.28, Math.min(24, s.sub.length), 0.035, 2100, 0.03);
        if (s.cues.stamp != null) {
          const tst = word(s, s.cues.stamp);
          impact(tst, 0.6); crash(tst, 0.38, HT); sub(tst, tst + 0.9, 31, 0.4);
          [0.04, 0.1, 0.16, 0.24, 0.32, 0.42].forEach((dt, i) => blip(tst + dt, mtof(PENTA[6 + i]), 0.07, -0.6 + i * 0.25));
          note(tst, "stamp");
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ the voice
  const VOICE = new Float32Array(N), lines = [];
  for (const v of voices) {
    const pcm = decode(v.file), hp = new Biquad().set("hp", 75, 0.7), x = Float32Array.from(pcm, (q) => hp.run(q));
    let e = 0, c = 0;
    for (const q of x) if (Math.abs(q) > 0.02) { e += q * q; c++; }
    const g = Math.max(0.56, Math.min(1.78, 0.11 / Math.max(1e-6, Math.sqrt(e / Math.max(1, c)))));
    const start = Math.round(v.at * SR);
    for (let i = 0; i < x.length && start + i < N; i++) if (start + i >= 0) VOICE[start + i] += x[i] * g;
    let last = x.length - 1;
    while (last > 0 && Math.abs(x[last]) < 0.02) last--;
    lines.push({ start, len: last + 1 });
  }
  const duck = (db, fallS = 0.12, riseS = 0.34) => {
    const d = Math.pow(10, db / 20), fall = Math.round(fallS * SR), rise = Math.round(riseS * SR), env = new Float32Array(N).fill(1);
    for (const ln of lines) {
      const s = ln.start, e = ln.start + ln.len;
      for (let n = Math.max(0, s - fall); n < Math.min(N, e + rise); n++) {
        const g = n < s ? 1 - (1 - d) * ((n - (s - fall)) / fall) : n < e ? d : d + (1 - d) * ((n - e) / rise);
        if (g < env[n]) env[n] = g;
      }
    }
    return env;
  };
  const ENV_BED = duck(-9), ENV_FX = duck(-3.5), ENV_HIT = duck(-1.2, 0.05, 0.2);
  const sc = new Float32Array(N).fill(1);
  for (const [t, depth] of KICKS) {
    if (!depth) continue;
    const i0 = Math.round(t * SR);
    for (let n = 0; n < 0.4 * SR && i0 + n < N; n++) {
      const v = 1 - depth * (n < 0.004 * SR ? n / (0.004 * SR) : Math.exp(-(n - 0.004 * SR) / (0.11 * SR)));
      if (i0 + n >= 0 && v < sc[i0 + n]) sc[i0 + n] = v;
    }
  }
  const scale = SR / 44100;
  const freeverb = (input, spread) => {
    const o = new Float32Array(N), room = 0.84 * 0.28 + 0.7, damp = 0.35 * 0.4;
    const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((c) => ({ buf: new Float32Array(Math.round((c + spread) * scale)), i: 0, store: 0 }));
    const aps = [556, 441, 341, 225].map((c) => ({ buf: new Float32Array(Math.round((c + spread) * scale)), i: 0 }));
    for (let n = 0; n < N; n++) {
      const x = input[n] * 0.015; let y = 0;
      for (const c of combs) { const q = c.buf[c.i]; c.store = q * (1 - damp) + c.store * damp; c.buf[c.i] = x + c.store * room; if (++c.i >= c.buf.length) c.i = 0; y += q; }
      for (const a of aps) { const q = a.buf[a.i]; a.buf[a.i] = y + q * 0.5; y = q - y; if (++a.i >= a.buf.length) a.i = 0; }
      o[n] = y;
    }
    return o;
  };
  const RVL = freeverb(SEND[0], 0), RVR = freeverb(SEND[1], 23);
  const SL = new Float32Array(N), SRt = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    SL[n] = (DR[0][n] * 0.9 + MU[0][n] * sc[n] * 0.8) * ENV_BED[n] + FX[0][n] * 0.9 * ENV_FX[n] + HT[0][n] * 0.95 * ENV_HIT[n] + RVL[n] * 0.9 * ENV_FX[n];
    SRt[n] = (DR[1][n] * 0.9 + MU[1][n] * sc[n] * 0.8) * ENV_BED[n] + FX[1][n] * 0.9 * ENV_FX[n] + HT[1][n] * 0.95 * ENV_HIT[n] + RVR[n] * 0.9 * ENV_FX[n];
  }
  let sv = 0, ss = 0;
  for (const ln of lines) for (let k = 0; k < ln.len && ln.start + k < N; k++) { const n = ln.start + k; sv += VOICE[n] * VOICE[n] * 2; ss += SL[n] * SL[n] + SRt[n] * SRt[n]; }
  const vg = ss > 1e-9 ? Math.sqrt(ss / Math.max(1e-9, sv)) * Math.pow(10, 11 / 20) : 1;
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let n = 0; n < N; n++) { L[n] = SL[n] + VOICE[n] * vg; R[n] = SRt[n] + VOICE[n] * vg; }
  const f0 = Math.round((DUR - 0.9) * SR);
  for (let n = Math.max(0, f0); n < N; n++) { const k = 1 - (n - f0) / (N - f0); L[n] *= k * k; R[n] *= k * k; }

  // ------------------------------------------------------------ the limiter and the loudness
  let peak = 0;
  for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
  const gain = 0.5 / Math.max(1e-9, peak), ceil = Math.pow(10, -2.2 / 20), la = Math.round(0.003 * SR);
  const need = new Float32Array(N);
  for (let n = 0; n < N; n++) need[n] = Math.min(1, ceil / Math.max(1e-9, Math.abs(L[n] * gain), Math.abs(R[n] * gain)));
  const rel = Math.exp(-1 / (0.08 * SR));
  const wav = Buffer.alloc(44 + N * 4);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(N * 4, 40);
  let g = 1, win = 1;
  for (let n = 0; n < N; n++) {
    // the lowest gain the next 3 ms need, kept cheaply: rescan only when the window's minimum leaves it
    if (n === 0 || need[n - 1] === win) { win = 1; for (let k = 0; k <= la && n + k < N; k++) if (need[n + k] < win) win = need[n + k]; }
    else if (n + la < N && need[n + la] < win) win = need[n + la];
    g = win < g ? win : win + (g - win) * rel;
    wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[n] * gain * g * 32767))), 44 + n * 4);
    wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[n] * gain * g * 32767))), 46 + n * 4);
  }
  const raw = `${work}/mix-raw.wav`;
  writeFileSync(raw, wav);
  const probe = spawnSync(FFMPEG, ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.6:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(probe.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const r = spawnSync(FFMPEG, ["-v", "error", "-y", "-i", raw, "-af", `loudnorm=I=-14:TP=-1.6:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, "-ar", String(SR), "-ac", "2", "-c:a", "pcm_s16le", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`the mix's loudness pass failed: ${r.stderr}`);
  return { hits: LOG.sort((a, b) => a.t - b.t), measured: Number(m.input_i) };
}
