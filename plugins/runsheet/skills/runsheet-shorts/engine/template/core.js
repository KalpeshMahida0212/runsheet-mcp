/*
  THE SHARED MOTION CORE: everything every style of Short needs and none of them should write again. The math (eases,
  springs, a hash for anything that must look random), the page helpers, the icons, the confetti and the rings, the
  word-by-word headline, the scene loop with its transitions, the camera, and the caption pills.

  A style is a script loaded after this one that sets window.RS_STYLE:
    { name, setup(timeline), ground(parent, kind, mood, seed, scene) -> update(f), brand(layer, kind, scene),
      scenes: { hook, text, list, checklist, steps, compare, stat, slam, punch, quote, chat, image, strike, end },
      enter(built, f, style) -> true when it drew the arrival itself, captions: { build(layer), update(f) } or null,
      camera: { push, shake }, slamGround }
  Every scene builder is (scene, layer, groundKind) -> update(frame). Times arrive in seconds and run here in frames,
  30 a second, the unit the springs were tuned in. Nothing is random: hash() is.
*/
(() => {
  const W = 1080, H = 1920, FPS = 30, CAP_Y = 1368;

  // ---------------------------------------------------------------- math

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise1 = (x, seed = 0) => {
    const i = Math.floor(x), f = x - i, a = hash(i + seed * 57.3), b = hash(i + 1 + seed * 57.3);
    return (a + (b - a) * f * f * (3 - 2 * f)) * 2 - 1;
  };
  // cubic-bezier easing (WebKit's UnitBezier)
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return sy(t); const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 30; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  };
  const EXPO_OUT = bezier(0.16, 1, 0.3, 1), EXPO_IN = bezier(0.7, 0, 0.84, 0), SNAP = bezier(0.65, 0, 0.2, 1), SOFT = bezier(0.45, 0, 0.25, 1);
  /** 0..1 over frames [a, b], clamped, eased. */
  const ramp = (f, a, b, ease = (x) => x) => ease(clamp01((f - a) / Math.max(1e-6, b - a)));
  /** A spring that starts at frame `at` (zero before), the physics Remotion uses: mass, stiffness, damping. */
  const spr = (f, at, { damping = 14, stiffness = 170, mass = 0.7 } = {}) => {
    if (f < at) return 0;
    const t = (f - at) / FPS, w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r1 = -w0 * (z - Math.sqrt(z * z - 1)), r2 = -w0 * (z + Math.sqrt(z * z - 1));
    return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
  };
  const POP = { damping: 11, stiffness: 230, mass: 0.7 };
  const SETTLE = { damping: 19, stiffness: 190, mass: 0.8 };
  const SLAM = { damping: 13, stiffness: 320, mass: 0.8 };

  // ---------------------------------------------------------------- the page

  let T = null;
  const problems = [];
  const fr = (s) => Math.round(s * FPS);
  const h = (tag, style, parent, text) => {
    const e = document.createElement(tag);
    if (style) Object.assign(e.style, style);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const px = (n) => `${n}px`;
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  const SANS = '"Inter Tight", "Segoe UI", system-ui, sans-serif';
  const SERIF = '"Instrument Serif", Georgia, serif';
  const MONO = '"JetBrains Mono", Consolas, monospace';

  /** A visible element pops in at frame `at`: springs up from `from`, slides `x`/`y` px and turns `r` degrees in. */
  const popTo = (el, f, at, { from = 0.6, x = 0, y = 0, r = 0, cfg = POP } = {}) => {
    if (f < at) { el.style.visibility = "hidden"; return 0; }
    const e = spr(f, at, cfg);
    el.style.visibility = "visible";
    el.style.transform = `translate(${(1 - e) * x}px, ${(1 - e) * y}px) scale(${from + (1 - from) * e}) rotate(${(1 - e) * r}deg)`;
    return e;
  };

  // ---------------------------------------------------------------- icons

  const SVGNS = "http://www.w3.org/2000/svg";
  /** A Lucide icon (or YouTube's play button) as an SVG element. */
  function icon(name, size, color, stroke = 2.2) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", size); svg.setAttribute("height", size); svg.setAttribute("viewBox", "0 0 24 24");
    svg.style.display = "block";
    const node = window.ICONS[name] ?? window.ICONS.sparkles;
    if (node === "yt") {
      const r = document.createElementNS(SVGNS, "rect");
      Object.entries({ x: 1.5, y: 5, width: 21, height: 14.5, rx: 4.4, fill: "#ff0000" }).forEach(([k, v]) => r.setAttribute(k, v));
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", "M10 9.2v6l5.2-3z"); p.setAttribute("fill", "#fff");
      svg.append(r, p);
      return svg;
    }
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", color); svg.setAttribute("stroke-width", stroke);
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    for (const [tag, attrs] of node) {
      const e = document.createElementNS(SVGNS, tag);
      for (const [k, v] of Object.entries(attrs)) if (k !== "key") e.setAttribute(k, v);
      svg.appendChild(e);
    }
    return svg;
  }

  // ---------------------------------------------------------------- effects and type

  /** A fan of rays turning about a point, faded toward its edge. */
  function sunburst(parent, cx, cy, size, rgb, a, period = 18, ray = 7, fade = 72) {
    const el = h("div", {
      position: "absolute", left: px(cx - size / 2), top: px(cy - size / 2), width: px(size), height: px(size),
      background: `repeating-conic-gradient(from 0deg at 50% 50%, ${rgba(rgb, a)} 0deg ${ray}deg, ${rgba(rgb, 0)} ${ray}deg ${period}deg)`,
      maskImage: `radial-gradient(circle at 50% 50%, #000 0%, #000 ${fade * 0.35}%, transparent ${fade}%)`,
      webkitMaskImage: `radial-gradient(circle at 50% 50%, #000 0%, #000 ${fade * 0.35}%, transparent ${fade}%)`,
    }, parent);
    return el;
  }


  /**
   * Words that rise out of a mask, each on its own frame (`at`, in seconds from the scene's start). An accent word is
   * Instrument Serif italic in the accent colour, a touch larger so the two weigh the same. The size steps down until
   * the words fit in `maxRows` rows.
   */
  function headline(parent, tokens, { top, size = 112, sizes, width = 920, left = (W - width) / 2, align = "center", color, accent, maxRows = 3, label = "headline", sceneNo, lh = 1.04, sans = SANS, serif = SERIF, weight = "800", emphWeight = "400", emphItalic = true, emphScale = 1.12, tracking = "-0.04em", upper = false, rise = 130 }) {
    const box = h("div", { position: "absolute", left: px(left), top: px(top), width: px(width), textAlign: align }, parent);
    const row = h("div", { display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", alignItems: "baseline" }, box);
    const words = tokens.map((t) => {
      const m = h("span", { display: "inline-block", clipPath: "inset(-0.14em -0.34em -0.28em -0.14em)" }, row);
      const w = h("span", { display: "inline-block", lineHeight: "1", transformOrigin: "0% 100%", whiteSpace: "nowrap" }, m, t.text);
      return { m, w, t };
    });
    const fit = (s) => {
      row.style.columnGap = px(s * 0.22);
      row.style.rowGap = px(s * (lh - 1) + s * 0.08);
      for (const { w, t } of words) {
        Object.assign(w.style, {
          fontFamily: t.emph ? serif : sans, fontStyle: t.emph && emphItalic ? "italic" : "normal", fontWeight: t.emph ? emphWeight : weight,
          fontSize: px(t.emph ? s * emphScale : s), letterSpacing: t.emph ? "-0.01em" : tracking, color: t.emph ? accent : color, textTransform: upper ? "uppercase" : "none",
        });
      }
    };
    const rowsOf = () => new Set(words.map(({ m }) => Math.round(m.offsetTop / 4))).size;
    const tries = sizes ?? [size, size * 0.9, size * 0.8, size * 0.72, size * 0.64, size * 0.57, size * 0.5];
    let used = tries[0];
    for (const s of tries) { used = s; fit(s); if (rowsOf() <= maxRows && box.scrollWidth <= width + 2) break; }
    if (rowsOf() > maxRows) problems.push(`scene ${sceneNo}: the ${label} needs ${rowsOf()} rows at the smallest size; ${maxRows} at most. Shorten it.`);
    return {
      box, size: used, height: () => box.offsetHeight, rows: rowsOf,
      update(f) {
        for (const { m, w, t } of words) {
          const at = t.at * FPS;
          m.style.visibility = f < at ? "hidden" : "visible";
          const e = ramp(f, at, at + 13, EXPO_OUT);
          w.style.transform = `translateY(${(1 - e) * rise}%) rotate(${(1 - e) * 6}deg)`;
        }
      },
      /** frame the last word has risen */
      doneAt: () => Math.max(0, ...tokens.map((t) => t.at * FPS)) + 13,
    };
  }


  /** Confetti from a point: dashes and triangles that fly out and fall. */
  function burst(parent, cx, cy, n, colors, reach, seed) {
    const parts = Array.from({ length: n }, (_, i) => {
      const tri = i % 5 === 0, sz = 10 + 22 * hash(i * 13 + seed);
      const el = tri ? h("div", { position: "absolute", width: px(sz), height: px(sz) }, parent) : h("div", { position: "absolute", width: px(sz * 2), height: px(sz * 0.38), borderRadius: "999px", background: colors[i % colors.length] }, parent);
      if (tri) el.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z" fill="${colors[i % colors.length]}"/></svg>`;
      return { el, i, tri, sz, a: i * 2.39996 + hash(i * 7 + seed) * 0.6, d: reach * (0.35 + 0.65 * hash(i * 11 + seed)), fadeAt: 12 + 20 * hash(i + seed) };
    });
    return (age) => {
      for (const p of parts) {
        if (age < 0) { p.el.style.display = "none"; continue; }
        p.el.style.display = "block";
        const dist = p.d * (1 - Math.exp(-age / 7));
        const x = cx + Math.cos(p.a) * dist, y = cy + Math.sin(p.a) * dist + age * age * 0.02;
        const rot = p.a * 57.3 + age * (hash(p.i * 3) - 0.5) * 22;
        p.el.style.opacity = String(1 - ramp(age, p.fadeAt, 44));
        if (p.tri) { p.el.style.left = px(x - p.sz / 2); p.el.style.top = px(y - p.sz / 2); p.el.style.transform = `rotate(${rot}deg)`; }
        else { p.el.style.left = px(x - p.sz); p.el.style.top = px(y - p.sz * 0.19); p.el.style.transform = `rotate(${rot}deg) scaleX(${1 + Math.max(0, 1.4 - age * 0.12)})`; }
      }
    };
  }


  /** A ring that expands and fades from a point. */
  function ring(parent, cx, cy, r0, grow, color, width = 8) {
    const el = h("div", { position: "absolute", borderRadius: "50%", border: `${width}px solid ${color}`, display: "none" }, parent);
    return (age) => {
      if (age < 0 || age > 16) { el.style.display = "none"; return; }
      const e = ramp(age, 0, 14, EXPO_OUT), r = r0 + grow * e;
      Object.assign(el.style, { display: "block", left: px(cx - r), top: px(cy - r), width: px(r * 2), height: px(r * 2), opacity: String(0.85 * (1 - ramp(age, 1, 14))) });
    };
  }


  /** Characters typed by frame f from `at`, `cps` a second. */
  const typedN = (text, f, at, cps) => Math.max(0, Math.min(text.length, Math.floor(((f - at) * cps) / FPS)));

  // ---------------------------------------------------------------- scenes, transitions and the camera

  const built = [];

  function buildScene(s, cam) {
    const root = h("div", {}, cam);
    root.className = "scene";
    // laid out while built (shown, unseen), so every height and row the scene measures is real
    root.style.display = "block"; root.style.visibility = "hidden";
    const gk = s.ground;
    // a slam has no ground of its own: it lands over the scene before it, dimmed
    const g = s.type === "slam" && !S.slamGround ? () => {} : S.ground(root, gk, s.mood, s.no * 13, s);
    const L = h("div", { position: "absolute", inset: "0", transformOrigin: "540px 900px" }, root);
    if (S.brand) S.brand(L, gk, s);
    const make = S.scenes[s.type] ?? S.scenes.text;
    const upd = make(s, L, gk);
    root.style.display = "none"; root.style.visibility = "";
    built.push({ s, root, g, L, upd, from: fr(s.start), to: fr(s.start + s.len + s.overlap), len: s.len * FPS });
  }

  /** How a scene arrives: a slide from the right, a flood from the middle, a dome from below, a zoom, or a cut. */
  function enter(b, f) {
    const st = b.root.style;
    st.transform = ""; st.clipPath = ""; st.boxShadow = ""; st.opacity = ""; st.filter = "";
    // a style may draw its own arrival for any kind (or a kind of its own); it returns true when it did
    if (S.enter && S.enter(b, f, st)) return;
    switch (b.s.enter) {
      case "slide": {
        const e = ramp(f, 0, 10, EXPO_OUT);
        if (e < 1) { st.transform = `translateX(${(1 - e) * W}px)`; st.boxShadow = "-40px 0 70px rgba(15,15,19,0.16)"; }
        break;
      }
      case "flood": {
        const e = ramp(f, 0, 11, SNAP);
        if (e < 1) st.clipPath = `circle(${e * 1300}px at 540px 900px)`;
        break;
      }
      case "dome": {
        const e = ramp(f, 0, 13, EXPO_OUT);
        if (e < 1) st.clipPath = `circle(${e * 2700}px at 540px 2400px)`;
        break;
      }
      case "zoom": {
        const e = ramp(f, 0, 9, EXPO_OUT);
        if (e < 1) { st.transform = `scale(${1.25 - 0.25 * e})`; st.opacity = String(e); }
        break;
      }
      default:
    }
  }

  /** The camera: a slow push into every scene, and a jolt on every hit that decays. */
  function shake(f) {
    let x = 0, y = 0, r = 0;
    for (const k of T.hits) {
      const age = f - k.t * FPS, decay = k.decay;
      if (age < 0 || age > decay * 7) continue;
      const e = k.amp * Math.exp(-age / decay);
      x += e * noise1(f * 0.93, k.t * 7);
      y += e * noise1(f * 0.87, k.t * 7 + 17);
      r += e * 0.018 * noise1(f * 0.7, k.t * 7 + 33);
    }
    return { x, y, r };
  }

  // ---------------------------------------------------------------- the captions

  let ctx2d = null;
  const wordEm = (t) => {
    if (!ctx2d) ctx2d = document.createElement("canvas").getContext("2d");
    ctx2d.font = `800 100px ${SANS}`;
    return ctx2d.measureText(t).width / 100;
  };
  /**
   * Caption pills: three or four words at a time at the foot of the frame, the word being said in a pill. `colors(ground)`
   * gives { pill, said, next, shadow } for a scene's ground; `font` is the family; `y` the line's middle.
   */
  function pillCaptions({ colors, font = SANS, weight = "800", y = CAP_Y, upper = false, radius = 0.34 }) {
    const caps = [];
    const build = (layer) => {
    const PAD = 0.2, CAP_W = 880, CAP_MAX = 76;
    for (const c of T.captions) {
      const el = h("div", { position: "absolute", left: "0", top: px(y - 70), width: "1010px", height: "140px", display: "none", alignItems: "center", justifyContent: "center" }, layer);
      const em = c.words.reduce((s, w) => s + wordEm(w.t) + 2 * PAD, 0) + (c.words.length - 1) * 0.02;
      const size = Math.min(CAP_MAX, CAP_W / em);
      const inner = h("div", { display: "flex", gap: px(size * 0.02), alignItems: "center" }, el);
      const spans = c.words.map((w) => h("span", { display: "inline-block", padding: `${size * 0.04}px ${size * PAD}px ${size * 0.08}px`, borderRadius: px(size * radius), fontFamily: font, fontWeight: weight, fontSize: px(size), lineHeight: "1.1", letterSpacing: "-0.025em", whiteSpace: "nowrap", textTransform: upper ? "uppercase" : "none" }, inner, w.t));
      caps.push({ c, el, inner, spans });
    }
    };
    const update = (f) => {
    for (const k of caps) {
      const on = f >= Math.round(k.c.a * FPS) && f < Math.round(k.c.end * FPS);
      k.el.style.display = on ? "flex" : "none";
      if (!on) continue;
      const g = k.c.ground, e = spr(f, Math.round(k.c.a * FPS), { damping: 14, stiffness: 320, mass: 0.6 });
      k.inner.style.transform = `translateY(${(1 - Math.min(1, e)) * 18}px) scale(${0.92 + 0.08 * Math.min(1.08, e)})`;
      const { pill, said, next, shadow } = colors(g);
      k.c.words.forEach((w, i) => {
        const sp = k.spans[i], a = Math.round(w.a * FPS), active = f >= a && f < Math.round(w.b * FPS), done = f >= a;
        sp.style.background = active ? pill : "transparent";
        sp.style.color = active ? "#fff" : done ? said : next;
        sp.style.boxShadow = active && shadow ? `0 8px 18px ${shadow}` : "none";
        sp.style.transform = active ? `scale(${0.9 + 0.1 * Math.min(1.1, spr(f, a, { damping: 12, stiffness: 340, mass: 0.5 }))})` : "none";
      });
    }
    };
    return { build, update };
  }

  // ---------------------------------------------------------------- load and seek

  let S = null;
  window.RS = { W, H, FPS, clamp01, lerp, hash, noise1, bezier, EXPO_OUT, EXPO_IN, SNAP, SOFT, ramp, spr, POP, SETTLE, SLAM,
    h, px, rgba, popTo, typedN, icon, sunburst, headline, burst, ring, pillCaptions, problems, SANS, SERIF, MONO, fr, CAP_Y };

  window.load = async (timeline) => {
    T = timeline;
    S = window.RS_STYLE;
    await Promise.all((S.fonts ?? []).map((f) => document.fonts.load(f).catch(() => problems.push(`a font did not load: ${f}`))));
    await document.fonts.ready;
    S.setup(T);
    const cam = document.getElementById("cam");
    for (const s of T.scenes) buildScene(s, cam);
    if (S.captions) S.captions.build(document.getElementById("caps"));
    // pictures the scenes show must be decoded before the first frame
    await Promise.all([...document.images].map((im) => im.decode().catch(() => problems.push(`a picture did not load: ${im.src}`))));
    await Promise.all([...document.querySelectorAll("video")].map((v) => new Promise((ok) => { if (v.readyState >= 2) ok(); else { v.onloadeddata = ok; v.onerror = () => { problems.push(`a clip did not load: ${v.src}`); ok(); }; } })));
    window.problems = problems;
    window.ready = true;
  };

  window.seek = async (t) => {
    const f = t * FPS;
    const cam = S.camera ?? {};
    const sh = shake(f), k = cam.shake ?? 1, m = Math.max(Math.abs(sh.x), Math.abs(sh.y)) * k;
    document.getElementById("cam").style.transform = `translate(${sh.x * k}px, ${sh.y * k}px) rotate(${sh.r * k}deg) scale(${1 + (2 * m + 4) / W + Math.abs(sh.r * k) * 0.05})`;
    for (const b of built) {
      const on = f >= b.from - 0.5 && f < b.to;
      b.root.style.display = on ? "block" : "none";
      if (!on) continue;
      const lf = f - b.from;
      b.g(f);
      b.L.style.transform = `scale(${1 + (cam.push ?? 0.035) * clamp01(lf / Math.max(1, b.len))})`;
      enter(b, lf);
      b.upd(lf);
      const v = b.s._media;
      if (v && v.tagName === "VIDEO" && v.duration) {
        const want = (lf / FPS) % v.duration;
        if (Math.abs(v.currentTime - want) > 0.01) await new Promise((ok) => { v.onseeked = ok; v.currentTime = want; setTimeout(ok, 1500); });
      }
    }
    if (S.captions) S.captions.update(f);
  };
})();
