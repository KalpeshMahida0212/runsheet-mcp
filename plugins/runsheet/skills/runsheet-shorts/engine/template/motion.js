/*
  THE PICTURE: every scene type of a Short, as motion graphics, drawn as a function of time.

  The look is the one in Runsheet's own reels: a cream, ink or accent ground that never stands still (soft glows, a
  drifting grid, specks), headlines whose words rise out of a mask on the word the voice says, one accent word in a
  serif italic, white cards that spring in, bursts, rings and stamps on the hits, a camera that pushes in and shakes
  on the impacts, scenes that slide, flood or open as a dome, and caption pills that light each word as it is said.

  load(timeline) builds every scene once; seek(t) sets every transform for that moment. Times arrive in seconds and
  run here in frames (30 a second), the unit the springs were tuned in. Nothing here is random: hash() is.
*/
(() => {
  const W = 1080, H = 1920, FPS = 30;
  const HEAD_TOP = 300, PILL_Y = 128, CAP_Y = 1368;

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

  let T = null, C = null;
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
  const CARD_SHADOW = "0 22px 56px rgba(40,24,60,0.12), 0 3px 8px rgba(40,24,60,0.06)";

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

  // ---------------------------------------------------------------- grounds

  /** Four arrangements of the glows, so scenes in a row do not sit on the same light. */
  const MOODS = [
    [[900, 330, 780, "warm", 0.5, 0], [40, 840, 720, "cool", 0.36, 2], [720, 1560, 760, "warm2", 0.42, 4]],
    [[540, 880, 860, "warm", 0.5, 0], [80, 280, 640, "cool", 0.34, 1], [980, 1600, 620, "warm2", 0.34, 3]],
    [[130, 380, 740, "cool", 0.34, 1], [960, 860, 700, "warm", 0.42, 3], [300, 1620, 720, "warm2", 0.38, 5]],
    [[940, 260, 700, "warm2", 0.46, 2], [60, 1010, 780, "warm", 0.4, 4], [860, 1500, 700, "cool", 0.32, 1]],
  ];
  const glowRgb = (k) => (k === "warm" ? T.theme.glowWarm : k === "warm2" ? T.theme.glowWarm2 : T.theme.glowCool);

  function glowDot(parent, [x, y, r, k, a, p], rgb) {
    const el = h("div", { position: "absolute", width: px(r * 2), height: px(r * 2), borderRadius: "50%", background: `radial-gradient(circle, ${rgba(rgb ?? glowRgb(k), a)} 0%, ${rgba(rgb ?? glowRgb(k), 0)} 68%)` }, parent);
    return (f) => {
      el.style.left = px(x - r + Math.sin(f / 80 + p) * 46);
      el.style.top = px(y - r + Math.cos(f / 100 + p) * 36);
    };
  }

  function grid(parent, color, speed = [-0.12, -0.08]) {
    const el = h("div", { position: "absolute", inset: 0, backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: "54px 54px" }, parent);
    return (f) => { el.style.backgroundPosition = `${f * speed[0]}px ${f * speed[1]}px`; };
  }

  /** Outlined circles, plus signs and squares drifting about. */
  function specks(parent, dark, seed, n = 15) {
    const col = dark ? "rgba(255,255,255,0.26)" : "rgba(15,15,19,0.17)";
    const items = Array.from({ length: n }, (_, i) => {
      const k = i % 3, s = 12 + hash(i * 7.7 + seed) * 14;
      let el;
      if (k === 1) {
        el = h("div", { position: "absolute", width: px(s * 1.5), height: px(s * 1.5) }, parent);
        el.innerHTML = `<svg width="${s * 1.5}" height="${s * 1.5}" viewBox="0 0 10 10"><path d="M5 0.8 V9.2 M0.8 5 H9.2" stroke="${col}" stroke-width="1.1" stroke-linecap="round"/></svg>`;
      } else el = h("div", { position: "absolute", width: px(s), height: px(s), borderRadius: k === 0 ? "50%" : "4px", border: `2px solid ${col}` }, parent);
      return { el, i, x0: hash(i * 3.1 + seed) * (W - 60) + 30, y0: 130 + hash(i * 5.3 + seed) * (H - 260), k };
    });
    return (f) => {
      for (const s of items) {
        s.el.style.left = px(s.x0 + Math.cos(f / 52 + s.i * 2) * 8);
        s.el.style.top = px(s.y0 + Math.sin(f / 38 + s.i) * 10);
        if (s.k) s.el.style.transform = `rotate(${f * (s.k === 1 ? 0.4 : 0.5) + s.i * 30}deg)`;
      }
    };
  }

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

  /** The three grounds: light (cream), dark (ink) and punch (the accent, with rays). */
  function ground(parent, kind, mood, seed) {
    const g = h("div", { position: "absolute", inset: 0, overflow: "hidden" }, parent);
    const parts = [];
    if (kind === "dark") {
      g.style.background = C.inkDeep;
      parts.push(glowDot(g, [190, 520, 760, "", 0.26, 1], T.theme.darkGlowA), glowDot(g, [900, 1280, 800, "", 0.26, 3], T.theme.darkGlowB), glowDot(g, [560, 980, 500, "", 0.1, 5], T.theme.darkGlowA));
      parts.push(grid(g, "rgba(255,255,255,0.045)", [-0.1, -0.06]));
      const stars = Array.from({ length: 70 }, (_, i) => {
        const s = 2 + hash(i * 4.1 + seed) * 3.5;
        return { i, el: h("div", { position: "absolute", left: px(hash(i * 1.7 + seed) * W), top: px(hash(i * 2.9 + 3 + seed) * H), width: px(s), height: px(s), borderRadius: "50%", background: i % 5 === 0 ? T.theme.accentSoft : "#fff" }, g) };
      });
      parts.push((f) => { for (const s of stars) s.el.style.opacity = String(0.8 * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(f / (14 + hash(s.i) * 20) + s.i * 3)))); });
    } else if (kind === "punch") {
      g.style.background = `radial-gradient(ellipse 90% 70% at 50% 46%, ${T.theme.accentLight} 0%, ${T.theme.accentFill} 52%, ${T.theme.accentDeep} 100%)`;
      const sb = sunburst(g, 540, 930, 2600, [255, 255, 255], 0.13, 16, 6, 70);
      parts.push((f) => { sb.style.transform = `rotate(${f * 0.7}deg)`; });
      parts.push(grid(g, "rgba(255,255,255,0.07)", [0.2, 0.12]));
      parts.push(specks(g, true, seed + 7, 12));
    } else {
      g.style.background = C.paper;
      for (const d of MOODS[mood % MOODS.length]) parts.push(glowDot(g, d));
      parts.push(grid(g, "rgba(15,15,19,0.05)"));
      parts.push(specks(g, false, seed));
    }
    return (f) => { for (const p of parts) p(f); };
  }

  // ---------------------------------------------------------------- type

  /**
   * Words that rise out of a mask, each on its own frame (`at`, in seconds from the scene's start). An accent word is
   * Instrument Serif italic in the accent colour, a touch larger so the two weigh the same. The size steps down until
   * the words fit in `maxRows` rows.
   */
  function headline(parent, tokens, { top, size = 112, sizes, width = 920, left = (W - width) / 2, align = "center", color, accent, maxRows = 3, label = "headline", sceneNo, lh = 1.04 }) {
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
          fontFamily: t.emph ? SERIF : SANS, fontStyle: t.emph ? "italic" : "normal", fontWeight: t.emph ? "400" : "800",
          fontSize: px(t.emph ? s * 1.12 : s), letterSpacing: t.emph ? "-0.01em" : "-0.04em", color: t.emph ? accent : color,
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
          w.style.transform = `translateY(${(1 - e) * 130}%) rotate(${(1 - e) * 6}deg)`;
        }
      },
      /** frame the last word has risen */
      doneAt: () => Math.max(0, ...tokens.map((t) => t.at * FPS)) + 13,
    };
  }

  /** The brand at the top of the light and dark scenes: a dot and the channel's name. */
  function brandPill(parent, kind) {
    const dark = kind !== "light";
    const el = h("div", { position: "absolute", left: "0", width: px(W), top: px(PILL_Y), display: "flex", justifyContent: "center" }, parent);
    const p = h("div", { display: "inline-flex", alignItems: "center", gap: "14px", height: "62px", padding: "0 26px 0 20px", borderRadius: "31px", background: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.86)", border: `1.5px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(15,15,19,0.08)"}`, boxShadow: dark ? "none" : "0 8px 22px rgba(40,24,60,0.08)" }, el);
    if (T.brand.logo) h("img", { width: "34px", height: "34px", borderRadius: "9px", objectFit: "cover" }, p).src = T.brand.logo;
    else h("span", { width: "16px", height: "16px", borderRadius: "50%", background: T.theme.accentFill, boxShadow: `0 0 12px ${T.theme.accentFill}` }, p);
    h("span", { fontFamily: SANS, fontWeight: "800", fontSize: "33px", letterSpacing: "-0.02em", color: dark ? "#fff" : C.ink, whiteSpace: "nowrap" }, p, T.brand.name);
    return el;
  }

  function card(parent, style) {
    return h("div", { position: "absolute", background: "#fff", borderRadius: "36px", boxShadow: CARD_SHADOW, border: "1px solid rgba(15,15,19,0.05)", boxSizing: "border-box", ...style }, parent);
  }

  /** The icon in a white rounded tile, for a scene's picture. */
  function iconTile(parent, name, size, { cx, cy, bg = "#fff", fg }) {
    const wrap = h("div", { position: "absolute", left: px(cx - size / 2), top: px(cy - size / 2), width: px(size), height: px(size) }, parent);
    const tile = h("div", { width: "100%", height: "100%", borderRadius: px(size * 0.26), background: bg, boxShadow: "0 30px 70px rgba(40,24,60,0.18), 0 4px 10px rgba(40,24,60,0.08)", display: "grid", placeItems: "center" }, wrap);
    tile.appendChild(icon(name, Math.round(size * 0.52), fg ?? T.theme.accentText, 2.1));
    return wrap;
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

  /** An ink pill in mono with a glowing accent dot, its text typed in. */
  function monoPill(parent, text, { cy, size = 32, light = false }) {
    const wrap = h("div", { position: "absolute", left: "0", width: px(W), top: px(cy - size * 1.3), display: "flex", justifyContent: "center" }, parent);
    const p = h("div", { display: "inline-flex", alignItems: "center", gap: px(size * 0.45), padding: `${size * 0.5}px ${size * 0.95}px`, borderRadius: "999px", background: light ? "rgba(255,255,255,0.92)" : C.ink, boxShadow: "0 14px 30px rgba(15,15,19,0.22)", fontFamily: MONO, fontWeight: "700", fontSize: px(size), color: light ? C.ink : "#fff", whiteSpace: "nowrap" }, wrap);
    h("span", { width: px(size * 0.42), height: px(size * 0.42), borderRadius: "50%", background: T.theme.accentFill, boxShadow: `0 0 ${size * 0.4}px ${T.theme.accentFill}` }, p);
    const shown = h("span", {}, p), rest = h("span", { opacity: "0" }, p);
    return { wrap, update(f, at, cps = 60) { const n = typedN(text, f, at, cps); shown.textContent = text.slice(0, n); rest.textContent = text.slice(n); } };
  }

  // ---------------------------------------------------------------- the scenes

  const at = (s) => s * FPS;
  const SCENES = {};

  /** HOOK: the first thing anyone sees. A kicker, the line, and the picture popping in with a ring. */
  SCENES.hook = (s, L, gk) => {
    const parts = [];
    let kick = null;
    if (s.kicker) kick = monoPill(L, s.kicker.toUpperCase(), { cy: 300, size: 30, light: gk === "dark" });
    const hasIcon = !!s.icon;
    const hd = headline(L, s.head, { top: hasIcon ? 420 : 560, size: 128, color: gk === "light" ? C.ink : "#fff", accent: gk === "light" ? T.theme.accentText : T.theme.accentSoft, sceneNo: s.no });
    if (!hasIcon) hd.box.style.top = px(Math.max(420, 860 - hd.height() / 2));
    parts.push((f) => hd.update(f));
    if (kick) parts.push((f) => { popTo(kick.wrap, f, 2, { from: 0.5, cfg: POP }); kick.update(f, 4, 50); });
    if (hasIcon) {
      const cy = Math.min(1150, 420 + hd.height() + 300);
      const tile = iconTile(L, s.icon, 300, { cx: 540, cy });
      const rg = ring(L, 540, cy, 150, 260, T.theme.accentFill), bu = burst(L, 540, cy, 14, [T.theme.accentFill, C.ink, "#ffd23f", T.theme.accentSoft], 420, s.no * 7);
      const t0 = at(s.cues.icon);
      parts.push((f) => {
        const e = popTo(tile, f, t0, { from: 0.2, y: 120, r: -16, cfg: POP });
        if (e && f > t0 + 14) tile.style.transform += ` translateY(${Math.sin((f - t0) / 14) * 10}px) rotate(${Math.sin((f - t0) / 22) * 3}deg)`;
        rg(f - t0); bu(f - t0 - 1);
      });
    }
    return (f) => parts.forEach((p) => p(f));
  };

  /** TEXT: a statement, with an icon tile under it, or alone and larger. */
  SCENES.text = (s, L, gk) => {
    const parts = [];
    const color = gk === "light" ? C.ink : "#fff", accent = gk === "light" ? T.theme.accentText : gk === "punch" ? "#fff" : T.theme.accentSoft;
    const hd = headline(L, s.head, { top: HEAD_TOP + 40, size: s.icon ? 108 : 124, color, accent, sceneNo: s.no });
    if (!s.icon) hd.box.style.top = px(Math.max(HEAD_TOP + 40, 840 - hd.height() / 2));
    parts.push((f) => hd.update(f));
    if (s.icon) {
      const cy = Math.min(1080, HEAD_TOP + 40 + hd.height() + 330);
      const tile = iconTile(L, s.icon, 330, { cx: 540, cy, bg: gk === "light" ? "#fff" : "rgba(255,255,255,0.96)" });
      const rg = ring(L, 540, cy, 165, 240, gk === "punch" ? "#fff" : T.theme.accentFill);
      const t0 = at(s.cues.icon);
      parts.push((f) => {
        const e = popTo(tile, f, t0, { from: 0.3, y: 140, r: 12, cfg: POP });
        if (e && f > t0 + 14) tile.style.transform += ` translateY(${Math.sin((f - t0) / 15) * 10}px) rotate(${Math.sin((f - t0) / 24) * 2.5}deg)`;
        rg(f - t0);
      });
    }
    return (f) => parts.forEach((p) => p(f));
  };

  /** The top of a block `hgt` tall, centred (a little high) between `top` and the captions. */
  const zone = (hgt, top, bottom = 1286) => Math.round(top + Math.max(0, (bottom - top - hgt) * 0.46));
  /** A scene's title, and where the room under it starts. */
  const titled = (s, L, gk, size = 104) => {
    if (!s.head.length) return { update: () => {}, below: 420 };
    const hd = headline(L, s.head, { top: HEAD_TOP, size, maxRows: 2, color: gk === "light" ? C.ink : "#fff", accent: gk === "light" ? T.theme.accentText : T.theme.accentSoft, sceneNo: s.no, label: "title" });
    return { update: (f) => hd.update(f), below: HEAD_TOP + hd.height() + 64, doneAt: hd.doneAt };
  };

  /** LIST and CHECKLIST: a title and up to four cards; a list's cards fly in on their words, a checklist's get ticked. */
  const listScene = (checks) => (s, L, gk) => {
    const parts = [];
    const ti = titled(s, L, gk);
    parts.push(ti.update);
    const n = s.items.length, gap = n > 3 ? 24 : 32, cards = [];
    for (const [i, it] of s.items.entries()) {
      const c = card(L, { left: "90px", top: "0px", width: "900px", padding: "34px 40px 34px 36px", display: "flex", alignItems: "center", gap: "32px", borderRadius: "36px" });
      const badge = h("div", { flex: "0 0 auto", width: "104px", height: "104px", borderRadius: checks ? "30px" : "50%", display: "grid", placeItems: "center", background: checks ? "#fff" : T.theme.accentFill, border: checks ? "5px solid rgba(15,15,19,0.16)" : "none", boxSizing: "border-box", color: "#fff", fontFamily: SANS, fontWeight: "900", fontSize: "52px", letterSpacing: "-0.03em" }, c);
      let tick = null;
      if (checks) {
        badge.innerHTML = `<svg width="62" height="62" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
        tick = badge.querySelector("path");
      } else if (it.icon) badge.appendChild(icon(it.icon, 56, "#fff", 2.4));
      else badge.textContent = String(i + 1);
      const tx = h("div", { fontFamily: SANS, fontWeight: "800", fontSize: "52px", lineHeight: "1.1", letterSpacing: "-0.03em", color: C.ink }, c, it.text);
      if (tx.offsetHeight > 52 * 1.1 * 2 + 4) problems.push(`scene ${s.no}: item ${i + 1} ("${it.text}") runs over two rows. Shorten it.`);
      cards.push({ c, badge, tick, tx, it, hgt: c.offsetHeight });
    }
    const stack = cards.reduce((a, k) => a + k.hgt, 0) + gap * (n - 1);
    let y = zone(stack, ti.below);
    for (const k of cards) { k.c.style.top = px(y); y += k.hgt + gap; }
    if (y - gap > 1300) problems.push(`scene ${s.no}: the ${checks ? "checklist" : "list"} runs into the captions. Use fewer or shorter items.`);
    for (const [i, k] of cards.entries()) {
      const t0 = at(k.it.at);
      if (checks) {
        // the boxes are all there from the start; each is ticked on its word
        const tIn = Math.max(3, (ti.doneAt ? ti.doneAt() : 6) - 6) + i * 3;
        parts.push((f) => {
          popTo(k.c, f, tIn, { from: 0.94, y: 70, cfg: SETTLE });
          const e = ramp(f, t0, t0 + 9, EXPO_OUT), on = f >= t0;
          k.tick.setAttribute("stroke-dashoffset", String(1 - e));
          k.badge.style.background = on ? T.theme.ok : "#fff";
          k.badge.style.borderColor = on ? T.theme.ok : "rgba(15,15,19,0.16)";
          k.badge.style.transform = on ? `scale(${1 + 0.2 * (1 - spr(f, t0, POP))})` : "none";
          k.tx.style.color = on ? C.ink : "rgba(15,15,19,0.4)";
        });
      } else {
        parts.push((f) => {
          popTo(k.c, f, t0, { from: 0.9, x: 160, r: 3, cfg: SETTLE });
          const b = f < t0 + 2 ? 0 : spr(f, t0 + 2, POP);
          k.badge.style.transform = `scale(${b}) rotate(${(1 - Math.min(1, b)) * -40}deg)`;
          const glow = f >= t0 ? 1 - ramp(f, t0 + 6, t0 + 26) : 0;
          k.c.style.boxShadow = glow > 0 ? `${CARD_SHADOW}, 0 0 0 ${5 * glow}px ${T.theme.accentFill}` : CARD_SHADOW;
        });
      }
    }
    return (f) => parts.forEach((p) => p(f));
  };
  SCENES.list = listScene(false);
  SCENES.checklist = listScene(true);

  /** STEPS: numbered circles down a line that draws itself, each step's words beside it. */
  SCENES.steps = (s, L, gk) => {
    const parts = [];
    const ti = titled(s, L, gk);
    parts.push(ti.update);
    const n = s.items.length;
    const cards = s.items.map((it) => {
      const c = card(L, { left: "282px", top: "0px", width: "708px", minHeight: "130px", padding: "28px 36px", display: "flex", alignItems: "center", fontFamily: SANS, fontWeight: "800", fontSize: "48px", lineHeight: "1.1", letterSpacing: "-0.03em", color: C.ink, borderRadius: "32px" });
      c.textContent = it.text;
      return c;
    });
    cards.forEach((c, i) => { if (c.offsetHeight > 170) problems.push(`scene ${s.no}: step ${i + 1} runs over two rows. Shorten it.`); });
    const stepH = Math.max(...cards.map((c) => c.offsetHeight)), gap = Math.min(250, Math.max(stepH + 34, (1286 - ti.below) / n));
    const top = zone(gap * (n - 1) + stepH, ti.below) + stepH / 2;
    h("div", { position: "absolute", left: "175px", width: "12px", borderRadius: "6px", background: gk === "light" ? "rgba(15,15,19,0.12)" : "rgba(255,255,255,0.18)", top: px(top), height: px(gap * (n - 1)) }, L);
    const fill = h("div", { position: "absolute", left: "175px", width: "12px", borderRadius: "6px", background: T.theme.accentFill, top: px(top), height: "0px" }, L);
    const steps = s.items.map((it, i) => {
      const cy = top + i * gap;
      const dot = h("div", { position: "absolute", left: px(181 - 58), top: px(cy - 58), width: "116px", height: "116px", borderRadius: "50%", background: T.theme.accentFill, color: "#fff", display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: "900", fontSize: "56px", boxShadow: "0 16px 30px rgba(40,24,60,0.18)" }, L, String(i + 1));
      cards[i].style.top = px(cy - cards[i].offsetHeight / 2);
      return { dot, c: cards[i], t0: at(it.at) };
    });
    parts.push((f) => {
      let reach = 0;
      steps.forEach((st, i) => {
        popTo(st.dot, f, st.t0, { from: 0, cfg: POP });
        popTo(st.c, f, st.t0 + 2, { from: 0.92, x: 140, cfg: SETTLE });
        if (i > 0) { const e = ramp(f, st.t0 - 8, st.t0, SNAP); if (e > 0) reach = Math.max(reach, (i - 1 + e) * gap); }
      });
      fill.style.height = px(reach);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** COMPARE: two cards that swing in from the sides, the worse one dimming once the better one lands. */
  SCENES.compare = (s, L, gk) => {
    const parts = [];
    const ti = titled(s, L, gk);
    parts.push(ti.update);
    const side = (x, data, good) => {
      const c = card(L, { left: px(x), top: "0px", width: "450px", padding: "36px 32px 44px", borderRadius: "40px", border: good ? `5px solid ${T.theme.accentFill}` : "1px solid rgba(15,15,19,0.06)" });
      const chip = h("div", { display: "inline-flex", alignItems: "center", gap: "12px", height: "70px", padding: "0 26px 0 18px", borderRadius: "35px", background: good ? T.theme.accentFill : "rgba(15,15,19,0.07)", color: good ? "#fff" : C.gray, fontFamily: SANS, fontWeight: "800", fontSize: "36px", letterSpacing: "-0.01em" }, c);
      chip.appendChild(icon(good ? "check" : "x", 38, good ? "#fff" : T.theme.bad, 3));
      h("span", {}, chip, data.label);
      for (const line of data.lines) {
        const r = h("div", { display: "flex", gap: "16px", marginTop: "30px", fontFamily: SANS, fontWeight: "800", fontSize: "42px", lineHeight: "1.12", letterSpacing: "-0.025em", color: good ? C.ink : "rgba(15,15,19,0.6)" }, c);
        h("span", { flex: "0 0 auto", width: "14px", height: "14px", marginTop: "17px", borderRadius: "50%", background: good ? T.theme.accentFill : "rgba(15,15,19,0.3)" }, r);
        h("span", {}, r, line);
      }
      return c;
    };
    const left = side(60, s.left, false), right = side(570, s.right, true);
    const hgt = Math.max(300, left.offsetHeight, right.offsetHeight);
    const top = zone(hgt, ti.below + 10);
    for (const c of [left, right]) { c.style.top = px(top); c.style.height = px(hgt); }
    if (top + hgt > 1300) problems.push(`scene ${s.no}: the two sides run into the captions. Use fewer or shorter lines.`);
    const vs = h("div", { position: "absolute", left: px(540 - 66), top: px(top + hgt / 2 - 66), width: "132px", height: "132px", borderRadius: "50%", background: C.ink, color: "#fff", display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: "900", fontSize: "48px", letterSpacing: "-0.03em", boxShadow: "0 18px 36px rgba(15,15,19,0.3)", border: "7px solid #fff", boxSizing: "border-box" }, L, "VS");
    const tl = at(s.cues.left), tr = at(s.cues.right);
    parts.push((f) => {
      popTo(left, f, tl, { from: 0.9, x: -540, r: -10, cfg: SETTLE });
      popTo(right, f, tr, { from: 0.9, x: 540, r: 10, cfg: SETTLE });
      popTo(vs, f, tr - 4, { from: 0, r: -90, cfg: POP });
      const dim = ramp(f, tr + 8, tr + 22, SOFT);
      if (f >= tl) left.style.transform += ` scale(${1 - 0.04 * dim})`;
      left.style.opacity = String(1 - 0.3 * dim);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** STAT: the accent ground, a number that counts up and slams down, a ring and confetti, the label under it. */
  SCENES.stat = (s, L) => {
    const parts = [];
    const t0 = at(s.cues.value);
    const m = /^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/.exec(s.value);
    const num = m ? Number(m[2].replace(/,/g, "")) : null, dec = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
    const row = h("div", { position: "absolute", left: "0", width: px(W), top: "360px", height: "440px", display: "flex", alignItems: "center", justifyContent: "center" }, L);
    const box = h("div", { display: "inline-flex", alignItems: "center", gap: "30px" }, row);
    let tile = null;
    if (s.icon) {
      tile = h("div", { width: "230px", height: "230px", borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 26px 50px rgba(0,0,0,0.25)" }, box);
      tile.appendChild(icon(s.icon, 120, T.theme.accentText, 2.2));
    }
    const val = h("span", { fontFamily: SANS, fontWeight: "900", letterSpacing: "-0.05em", lineHeight: "1", color: "#fff", textShadow: "0 20px 44px rgba(0,0,0,0.22)", display: "inline-block", whiteSpace: "nowrap" }, box, s.value);
    let size = 420;
    val.style.fontSize = px(size);
    while (box.offsetWidth > 980 && size > 120) { size -= 10; val.style.fontSize = px(size); }
    const rg = ring(L, 540, 580, 220, 340, "#fff"), bu = burst(L, 540, 580, 24, ["#ffffff", C.ink, "#ffd23f", "#ffffff"], 600, 9);
    const hd = headline(L, s.head, { top: 840, size: 104, maxRows: 3, color: "#fff", accent: "#fff", sceneNo: s.no, label: "label" });
    const fmt = (v) => (m ? `${m[1]}${v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}${m[3]}` : s.value);
    parts.push((f) => {
      hd.update(f);
      const count = num != null ? EXPO_OUT(ramp(f, t0 - 18, t0)) : 1;
      val.textContent = f < t0 - 18 ? (num != null ? fmt(0) : "") : f >= t0 ? s.value : fmt(num * count);
      const slam = spr(f, t0, { damping: 16, stiffness: 340, mass: 0.8 });
      const idle = f > t0 + 14 ? 1 + 0.012 * Math.sin((f - t0) / 6) : 1;
      val.style.transform = f >= t0 ? `scale(${(1 + 0.18 * (1 - Math.min(1, slam))) * idle})` : `scale(${0.7 + 0.3 * ramp(f, t0 - 18, t0)})`;
      val.style.opacity = String(ramp(f, t0 - 20, t0 - 12));
      if (tile) {
        const c = spr(f, 1, { damping: 12, stiffness: 200, mass: 0.8 }), spin = Math.cos(ramp(f, 1, 16, EXPO_OUT) * Math.PI * 2);
        tile.style.transform = `scale(${Math.max(0, c)}) scaleX(${0.25 + 0.75 * Math.abs(spin)})`;
      }
      rg(f - t0); bu(f - t0 - 1);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** SLAM: one or two huge words in an ink band that slams across the frame, the camera jolting with it. */
  SCENES.slam = (s, L) => {
    const t0 = at(s.cues.slam);
    const dim = h("div", { position: "absolute", inset: "-60px", background: "rgba(9,9,15,0.52)" }, L);
    const band = h("div", { position: "absolute", left: "-40px", width: px(W + 80), top: "760px", height: "400px", background: C.ink, transformOrigin: "50% 50%", boxShadow: "0 40px 80px rgba(0,0,0,0.35)" }, L);
    const txt = h("div", { position: "absolute", left: "0", width: px(W), top: "760px", height: "400px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0px", color: "#fff", fontFamily: SANS, fontWeight: "900", letterSpacing: "-0.045em", lineHeight: "1", whiteSpace: "nowrap" }, L);
    const inner = h("span", { display: "inline-flex", alignItems: "flex-end" }, txt);
    h("span", {}, inner, s.text.toUpperCase().replace(/[.!]+$/, ""));
    const dot = h("span", { display: "inline-block", width: "0.2em", height: "0.2em", borderRadius: "50%", background: T.theme.accentFill, marginLeft: "0.06em", marginBottom: "0.1em" }, inner);
    let size = 250;
    txt.style.fontSize = px(size);
    while (inner.offsetWidth > 960 && size > 90) { size -= 6; txt.style.fontSize = px(size); }
    if (inner.offsetWidth > 960) problems.push(`scene ${s.no}: the slam "${s.text}" is too long. One or two short words.`);
    return (f) => {
      dim.style.opacity = String(ramp(f, t0 - 6, t0, SOFT));
      const b = ramp(f, t0 - 5, t0 + 1, SNAP);
      band.style.transform = `scaleY(${b}) rotate(${-2 + 2 * b}deg)`;
      const e = spr(f, t0, SLAM);
      txt.style.visibility = f < t0 ? "hidden" : "visible";
      txt.style.transform = `scale(${1 + 0.7 * (1 - Math.min(1, e)) + (f > t0 + 12 ? 0.01 * Math.sin((f - t0) / 7) : 0)})`;
      dot.style.transform = `scale(${f < t0 + 4 ? 0 : spr(f, t0 + 4, POP)})`;
    };
  };

  /** PUNCH: the accent ground and a big white line, a ring and confetti when it lands. */
  SCENES.punch = (s, L) => {
    const parts = [];
    let tile = null, cy = 0;
    const hd = headline(L, s.head, { top: 0, size: 132, maxRows: 3, color: "#fff", accent: "#fff", sceneNo: s.no });
    const ht = hd.height();
    if (s.icon) {
      cy = 760 - ht / 2 - 40;
      tile = h("div", { position: "absolute", left: px(540 - 120), top: px(cy - 120), width: "240px", height: "240px", borderRadius: "64px", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" }, L);
      tile.appendChild(icon(s.icon, 130, T.theme.accentText, 2.2));
      hd.box.style.top = px(cy + 170);
    } else hd.box.style.top = px(Math.max(330, 840 - ht / 2));
    const t0 = at(s.cues.land), mid = s.icon ? cy : 840;
    const rg = ring(L, 540, mid, 200, 340, "#fff"), bu = burst(L, 540, mid, 22, ["#ffffff", C.ink, "#ffd23f", "#ffffff"], 560, s.no * 3);
    parts.push((f) => {
      hd.update(f);
      if (tile) popTo(tile, f, 3, { from: 0.2, y: 80, r: -14, cfg: POP });
      rg(f - t0); bu(f - t0 - 1);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** QUOTE: a card with a big serif quote mark, the words typed in, who said it under it. */
  SCENES.quote = (s, L, gk) => {
    const parts = [];
    const ti = titled(s, L, gk, 96);
    parts.push(ti.update);
    const c = card(L, { left: "80px", top: "0px", width: "920px", padding: "120px 64px 64px", borderRadius: "44px" });
    const mark = h("div", { position: "absolute", left: "50px", top: "-34px", fontFamily: SERIF, fontStyle: "italic", fontSize: "320px", lineHeight: "1", color: T.theme.accentText }, c, "“");
    const body = h("div", { fontFamily: SANS, fontWeight: "800", fontSize: "60px", lineHeight: "1.16", letterSpacing: "-0.03em", color: C.ink }, c);
    const shown = h("span", {}, body), caret = h("span", { display: "inline-block", width: "6px", height: "58px", marginLeft: "4px", verticalAlign: "-7px", background: T.theme.accentFill }, body), rest = h("span", { opacity: "0" }, body);
    let by = null;
    if (s.by) {
      by = h("div", { marginTop: "38px", display: "flex", alignItems: "center", gap: "18px", fontFamily: MONO, fontWeight: "500", fontSize: "32px", letterSpacing: "0.03em", color: C.gray }, c);
      h("span", { width: "44px", height: "5px", borderRadius: "3px", background: T.theme.accentFill }, by);
      h("span", {}, by, s.by);
    }
    const q = s.quote;
    rest.textContent = q;
    c.style.top = px(zone(c.offsetHeight, Math.max(ti.below, 400)));
    if (c.offsetTop + c.offsetHeight > 1300) problems.push(`scene ${s.no}: the quote runs into the captions. Shorten it.`);
    const t0 = at(s.cues.type), cps = Math.max(14, (q.length * FPS) / Math.max(12, at(s.cues.typeEnd) - t0));
    parts.push((f) => {
      popTo(c, f, Math.max(2, t0 - 8), { from: 0.92, y: 90, cfg: SETTLE });
      popTo(mark, f, Math.max(2, t0 - 6), { from: 0.3, r: -20, cfg: POP });
      const n = typedN(q, f, t0, cps);
      shown.textContent = q.slice(0, n); rest.textContent = q.slice(n);
      caret.style.opacity = n >= q.length ? (Math.floor(f / 8) % 2 ? "0" : "1") : "1";
      if (by) popTo(by, f, t0 + (q.length / cps) * FPS + 4, { from: 0.9, y: 20, cfg: SETTLE });
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** CHAT: message bubbles, the other side typing first. */
  SCENES.chat = (s, L, gk) => {
    const parts = [];
    const ti = titled(s, L, gk, 96);
    parts.push(ti.update);
    const box = h("div", { position: "absolute", left: "60px", width: "960px", top: "0px", display: "flex", flexDirection: "column", gap: "36px" }, L);
    for (const m of s.messages) {
      const me = m.from === "me";
      const row = h("div", { position: "relative", display: "flex", justifyContent: me ? "flex-end" : "flex-start", alignItems: "flex-end", gap: "18px" }, box);
      let av = null;
      if (!me) {
        av = h("div", { width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, #d9d6f5, #f3d6cf)", flex: "0 0 auto", display: "grid", placeItems: "center", boxShadow: "0 8px 18px rgba(40,24,60,0.12)" }, row);
        av.appendChild(icon("user", 44, "rgba(15,15,19,0.55)", 2));
      }
      const b = h("div", { maxWidth: "720px", padding: "30px 38px", borderRadius: me ? "42px 42px 12px 42px" : "42px 42px 42px 12px", background: me ? T.theme.accentFill : "#fff", color: me ? "#fff" : C.ink, boxShadow: CARD_SHADOW, fontFamily: SANS, fontWeight: "800", fontSize: "46px", lineHeight: "1.16", letterSpacing: "-0.025em", transformOrigin: me ? "100% 100%" : "0% 100%" }, row, m.text);
      const dots = me ? null : h("div", { position: "absolute", left: "98px", bottom: "0px", padding: "30px 34px", borderRadius: "42px 42px 42px 12px", background: "#fff", boxShadow: CARD_SHADOW, display: "flex", gap: "12px" }, row);
      const dd = dots ? [0, 1, 2].map(() => h("span", { width: "20px", height: "20px", borderRadius: "50%", background: "rgba(15,15,19,0.35)", display: "inline-block" }, dots)) : [];
      const t0 = at(m.at);
      parts.push((f) => {
        const early = me ? 0 : 14;
        row.style.visibility = f < t0 - early ? "hidden" : "visible";
        if (dots) {
          dots.style.display = f >= t0 - early && f < t0 ? "flex" : "none";
          dd.forEach((d, k) => { d.style.transform = `translateY(${-9 * Math.max(0, Math.sin((f - k * 4) / 3))}px)`; });
          if (av) popTo(av, f, t0 - early, { from: 0.4, cfg: POP });
        }
        popTo(b, f, t0, { from: 0.5, y: 30, cfg: POP });
      });
    }
    box.style.top = px(zone(box.offsetHeight, Math.max(ti.below, 420)));
    if (box.offsetTop + box.offsetHeight > 1300) problems.push(`scene ${s.no}: the messages run into the captions. Use fewer or shorter messages.`);
    return (f) => parts.forEach((p) => p(f));
  };

  /** IMAGE: the creator's own picture or clip in a big card that slowly pushes in, the line above it. */
  SCENES.image = (s, L, gk) => {
    const parts = [];
    const ti = titled(s, L, gk, 96);
    parts.push(ti.update);
    const size = Math.min(880, 1270 - ti.below), top = zone(size, ti.below);
    const c = h("div", { position: "absolute", left: px(540 - size / 2), top: px(top), width: px(size), height: px(size), borderRadius: "48px", overflow: "hidden", boxShadow: "0 40px 90px rgba(40,24,60,0.25)", background: "#ddd", border: "8px solid #fff", boxSizing: "border-box" }, L);
    let media;
    if (/\.(mp4|mov|webm|m4v)$/i.test(s.src)) { media = h("video", { width: "100%", height: "100%", objectFit: "cover" }, c); media.muted = true; media.src = s.src; media.preload = "auto"; }
    else { media = h("img", { width: "100%", height: "100%", objectFit: "cover", transformOrigin: "50% 50%" }, c); media.src = s.src; }
    s._media = media;
    const len = s.len * FPS;
    parts.push((f) => {
      popTo(c, f, 2, { from: 0.86, y: 120, r: -4, cfg: SETTLE });
      media.style.transform = `scale(${1.02 + 0.08 * ramp(f, 0, len, SOFT)})`;
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** STRIKE: the wrong idea, struck through by a marker; the right one rises under it. */
  SCENES.strike = (s, L, gk) => {
    const parts = [];
    const color = gk === "light" ? C.ink : "#fff", accent = gk === "light" ? T.theme.accentText : T.theme.accentSoft;
    const wrong = headline(L, s.wrongHead, { top: 0, size: 108, maxRows: 3, color, accent: color, sceneNo: s.no, label: "wrong line" });
    const right = s.rightHead ? headline(L, s.rightHead, { top: 0, size: 120, maxRows: 3, color, accent, sceneNo: s.no, label: "right line" }) : null;
    const gapY = 120, total = wrong.height() + (right ? gapY + right.height() : 0);
    const top = zone(total, 380);
    wrong.box.style.top = px(top);
    if (right) right.box.style.top = px(top + wrong.height() + gapY);
    if (top + total > 1300) problems.push(`scene ${s.no}: the two lines run into the captions. Shorten them.`);
    const masks = [...wrong.box.querySelectorAll("span > span")].map((w) => w.parentElement);
    const lines = [...new Set(masks.map((m) => m.offsetTop))].map((rowTop) => {
      const ms = masks.filter((m) => m.offsetTop === rowTop);
      const x0 = Math.min(...ms.map((m) => m.offsetLeft)), x1 = Math.max(...ms.map((m) => m.offsetLeft + m.offsetWidth));
      return h("div", { position: "absolute", left: px(wrong.box.offsetLeft + x0 - 16), top: px(top + rowTop + wrong.size * 0.5), width: px(x1 - x0 + 32), height: "18px", borderRadius: "9px", background: T.theme.bad, transformOrigin: "0% 50%", transform: "scaleX(0) rotate(-2deg)", boxShadow: "0 6px 14px rgba(229,72,77,0.3)" }, L);
    });
    const tS = at(s.cues.strike);
    parts.push((f) => {
      wrong.update(f);
      lines.forEach((ln, i) => { const e = ramp(f, tS + i * 4, tS + i * 4 + 8, SNAP); ln.style.transform = `scaleX(${e}) rotate(-2deg)`; });
      const d = ramp(f, tS + 4, tS + 14, SOFT);
      wrong.box.style.opacity = String(1 - 0.5 * d);
      if (right) right.update(f);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** END: the channel's mark bursting in on a sunburst, its name, a typed line, and a stamp. */
  SCENES.end = (s, L, gk) => {
    const parts = [];
    const sbWrap = h("div", { position: "absolute", inset: "0", transformOrigin: "540px 640px" }, L);
    const sb = sunburst(sbWrap, 540, 640, 2000, gk === "light" ? T.theme.glowWarmDeep : [255, 255, 255], gk === "light" ? 0.16 : 0.09, 20, 8, 66);
    let hd = null;
    if (s.head.length) {
      hd = headline(L, s.head, { top: 260, size: 116, maxRows: 2, color: gk === "light" ? C.ink : "#fff", accent: gk === "light" ? T.theme.accentText : T.theme.accentSoft, sceneNo: s.no });
      parts.push((f) => hd.update(f));
    }
    const top = hd ? 260 + hd.height() + 70 : 470;
    const markRow = h("div", { position: "absolute", left: "0", width: px(W), top: px(top), display: "flex", justifyContent: "center" }, L);
    const mark = h("div", { display: "inline-flex", alignItems: "center", gap: "28px" }, markRow);
    if (T.brand.logo) {
      const img = h("img", { width: "150px", height: "150px", borderRadius: "40px", objectFit: "cover", boxShadow: "0 20px 40px rgba(15,15,19,0.28)" }, mark);
      img.src = T.brand.logo;
    } else h("div", { width: "150px", height: "150px", borderRadius: "40px", background: T.theme.accentFill, color: "#fff", display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: "900", fontSize: "92px", letterSpacing: "-0.04em", boxShadow: "0 20px 40px rgba(15,15,19,0.28)" }, mark, (T.brand.name.match(/[A-Za-z0-9]/) || ["★"])[0].toUpperCase());
    const name = h("span", { fontFamily: SANS, fontWeight: "800", fontSize: "120px", letterSpacing: "-0.045em", lineHeight: "1", color: gk === "light" ? C.ink : "#fff", whiteSpace: "nowrap" }, mark, T.brand.name);
    let ns = 120;
    while (mark.offsetWidth > 980 && ns > 56) { ns -= 4; name.style.fontSize = px(ns); }
    const pill = s.sub ? monoPill(L, s.sub, { cy: top + 260, size: 34 }) : null;
    let stamp = null;
    if (s.stamp) {
      stamp = h("div", { position: "absolute", left: "0", width: px(W), top: px(top + 400), display: "flex", justifyContent: "center" }, L);
      const st = h("div", { padding: "34px 54px", background: T.theme.stamp, border: `9px solid ${C.ink}`, borderRadius: "30px", boxShadow: "0 26px 50px rgba(15,15,19,0.28)", fontFamily: SANS, fontWeight: "900", fontSize: "62px", letterSpacing: "-0.025em", color: T.theme.stampOn, whiteSpace: "nowrap", position: "relative" }, stamp, s.stamp.toUpperCase());
      h("div", { position: "absolute", inset: "12px", borderRadius: "17px", border: "2.5px solid rgba(15,15,19,0.45)" }, st);
      if (st.offsetWidth > 960) problems.push(`scene ${s.no}: the stamp "${s.stamp}" is too long. Three or four words.`);
    }
    const tMark = at(s.cues.mark), tStamp = at(s.cues.stamp ?? s.cues.mark + 1);
    const bu = burst(L, 540, top + 75, 22, [T.theme.accentFill, C.ink, "#ffd23f", gk === "light" ? "#ffffff" : T.theme.accentSoft], 560, 3);
    const bu2 = stamp ? burst(L, 540, top + 470, 22, [T.theme.accentFill, C.ink, "#ffd23f", "#ffffff"], 560, 5) : () => {};
    parts.push((f) => {
      sbWrap.style.transform = `scale(${0.7 + 0.3 * ramp(f, 0, 16, EXPO_OUT)})`;
      sb.style.transform = `rotate(${f * 0.8}deg)`;
      popTo(markRow, f, tMark, { from: 0.5, y: 50, cfg: SETTLE });
      bu(f - tMark - 1);
      if (pill) { popTo(pill.wrap, f, tMark + 5, { from: 0.9, y: 40, cfg: SETTLE }); pill.update(f, tMark + 7, 55); }
      if (stamp) {
        if (f < tStamp) stamp.style.visibility = "hidden";
        else {
          const e = spr(f, tStamp, { damping: 24, stiffness: 420, mass: 0.7 });
          stamp.style.visibility = "visible";
          stamp.style.transform = `rotate(${-5 + (1 - Math.min(1, e)) * 9}deg) scale(${1 + 0.55 * (1 - e)})`;
        }
        bu2(f - tStamp - 1);
      }
    });
    return (f) => parts.forEach((p) => p(f));
  };

  // ---------------------------------------------------------------- scenes, transitions and the camera

  const built = [];

  function buildScene(s, cam) {
    const root = h("div", {}, cam);
    root.className = "scene";
    // laid out while built (shown, unseen), so every height and row the scene measures is real
    root.style.display = "block"; root.style.visibility = "hidden";
    const gk = s.ground;
    // a slam has no ground of its own: it lands over the scene before it, dimmed
    const g = s.type === "slam" ? () => {} : ground(root, gk, s.mood, s.no * 13);
    const L = h("div", { position: "absolute", inset: "0", transformOrigin: "540px 900px" }, root);
    if (gk !== "punch" && s.type !== "end" && s.type !== "slam") brandPill(L, gk);
    const make = SCENES[s.type] ?? SCENES.text;
    const upd = make(s, L, gk);
    root.style.display = "none"; root.style.visibility = "";
    built.push({ s, root, g, L, upd, from: fr(s.start), to: fr(s.start + s.len + s.overlap), len: s.len * FPS });
  }

  /** How a scene arrives: a slide from the right, a flood from the middle, a dome from below, a zoom, or a cut. */
  function enter(b, f) {
    const st = b.root.style;
    st.transform = ""; st.clipPath = ""; st.boxShadow = ""; st.opacity = "";
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

  const caps = [];
  let ctx2d = null;
  const wordEm = (t) => {
    if (!ctx2d) ctx2d = document.createElement("canvas").getContext("2d");
    ctx2d.font = `800 100px ${SANS}`;
    return ctx2d.measureText(t).width / 100;
  };
  function buildCaptions(layer) {
    const PAD = 0.2, CAP_W = 880, CAP_MAX = 76;
    for (const c of T.captions) {
      const el = h("div", { position: "absolute", left: "0", top: px(CAP_Y - 70), width: "1010px", height: "140px", display: "none", alignItems: "center", justifyContent: "center" }, layer);
      const em = c.words.reduce((s, w) => s + wordEm(w.t) + 2 * PAD, 0) + (c.words.length - 1) * 0.02;
      const size = Math.min(CAP_MAX, CAP_W / em);
      const inner = h("div", { display: "flex", gap: px(size * 0.02), alignItems: "center" }, el);
      const spans = c.words.map((w) => h("span", { display: "inline-block", padding: `${size * 0.04}px ${size * PAD}px ${size * 0.08}px`, borderRadius: px(size * 0.34), fontFamily: SANS, fontWeight: "800", fontSize: px(size), lineHeight: "1.1", letterSpacing: "-0.025em", whiteSpace: "nowrap" }, inner, w.t));
      caps.push({ c, el, inner, spans });
    }
  }
  function captions(f) {
    for (const k of caps) {
      const on = f >= Math.round(k.c.a * FPS) && f < Math.round(k.c.end * FPS);
      k.el.style.display = on ? "flex" : "none";
      if (!on) continue;
      const g = k.c.ground, e = spr(f, Math.round(k.c.a * FPS), { damping: 14, stiffness: 320, mass: 0.6 });
      k.inner.style.transform = `translateY(${(1 - Math.min(1, e)) * 18}px) scale(${0.92 + 0.08 * Math.min(1.08, e)})`;
      const pill = g === "punch" ? C.ink : T.theme.accentFill;
      const said = g === "light" ? C.ink : "#ffffff";
      const next = g === "light" ? "rgba(15,15,19,0.3)" : g === "punch" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.34)";
      k.c.words.forEach((w, i) => {
        const sp = k.spans[i], a = Math.round(w.a * FPS), active = f >= a && f < Math.round(w.b * FPS), done = f >= a;
        sp.style.background = active ? pill : "transparent";
        sp.style.color = active ? "#fff" : done ? said : next;
        sp.style.boxShadow = active ? `0 8px 18px ${g === "punch" ? "rgba(15,15,19,0.25)" : T.theme.accentShadow}` : "none";
        sp.style.transform = active ? `scale(${0.9 + 0.1 * Math.min(1.1, spr(f, a, { damping: 12, stiffness: 340, mass: 0.5 }))})` : "none";
      });
    }
  }

  // ---------------------------------------------------------------- load and seek

  window.load = async (timeline) => {
    T = timeline;
    C = { ink: "#0f0f13", inkDeep: "#09090f", paper: T.theme.paper, gray: "#6b6b7c" };
    await Promise.all([
      document.fonts.load(`800 100px "Inter Tight"`), document.fonts.load(`900 100px "Inter Tight"`), document.fonts.load(`700 100px "Inter Tight"`),
      document.fonts.load(`italic 400 100px "Instrument Serif"`), document.fonts.load(`700 40px "JetBrains Mono"`), document.fonts.load(`500 40px "JetBrains Mono"`),
    ]);
    await document.fonts.ready;
    const cam = document.getElementById("cam");
    document.body.style.background = C.paper;
    for (const s of T.scenes) buildScene(s, cam);
    buildCaptions(document.getElementById("caps"));
    // pictures the scenes show must be decoded before the first frame
    await Promise.all([...document.images].map((im) => im.decode().catch(() => problems.push(`a picture did not load: ${im.src}`))));
    await Promise.all([...document.querySelectorAll("video")].map((v) => new Promise((ok) => { if (v.readyState >= 2) ok(); else { v.onloadeddata = ok; v.onerror = () => { problems.push(`a clip did not load: ${v.src}`); ok(); }; } })));
    window.problems = problems;
    window.ready = true;
  };

  window.seek = async (t) => {
    const f = t * FPS;
    const sh = shake(f), m = Math.max(Math.abs(sh.x), Math.abs(sh.y));
    document.getElementById("cam").style.transform = `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg) scale(${1 + (2 * m + 4) / W + Math.abs(sh.r) * 0.05})`;
    for (const b of built) {
      const on = f >= b.from - 0.5 && f < b.to;
      b.root.style.display = on ? "block" : "none";
      if (!on) continue;
      const lf = f - b.from;
      b.g(f);
      b.L.style.transform = `scale(${1 + 0.035 * clamp01(lf / Math.max(1, b.len))})`;
      enter(b, lf);
      b.upd(lf);
      const v = b.s._media;
      if (v && v.tagName === "VIDEO" && v.duration) {
        const want = (lf / FPS) % v.duration;
        if (Math.abs(v.currentTime - want) > 0.01) await new Promise((ok) => { v.onseeked = ok; v.currentTime = want; setTimeout(ok, 1500); });
      }
    }
    captions(f);
  };
})();
