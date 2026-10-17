/*
  STUDIO: the free style, and the look of Runsheet's own reels. A cream, ink or accent ground that never stands still
  (soft glows, a drifting grid, specks), headlines whose words rise on the word the voice says with one accent word in a
  serif italic, white cards that spring in, bursts, rings and stamps on the hits, scenes that slide, flood or open as a
  dome, and caption pills that light each word as it is said.

  Two shapes: a Short (9:16) and a long video (16:9, RS.WIDE). The wide frame has its own scene builders (WS, below
  the Short's), its own places for the glows and the brand, and a gentler camera; the Short's code paths are
  the same as before the wide frame existed.
*/
(() => {
  const { W, H, WIDE, FPS, clamp01, lerp, hash, noise1, EXPO_OUT, EXPO_IN, SNAP, SOFT, ramp, spr, POP, SETTLE, SLAM,
    h, px, rgba, popTo, typedN, icon, sunburst, headline, burst, ring, pillCaptions, problems, SANS, SERIF, MONO } = window.RS;
  const HEAD_TOP = 300, PILL_Y = 128;
  /*
    The wide frame's grid: everything between x 120 and 1800 (inside RS.SAFE's 96 to 1824), a left column for the
    words (120 to 820) and a right one for their cards (900 to 1800), under the brand pill and above WBOT, which is
    the captions' line when a creator turns them on and the foot of the safe area when not (set in setup).
  */
  const WX0 = 120, WX1 = 1800, WIDE_PILL_Y = 66, LW = 700, RX = 900, RW = 900, WTOP = 168;
  let WBOT = 952;
  const CARD_SHADOW = "0 22px 56px rgba(40,24,60,0.12), 0 3px 8px rgba(40,24,60,0.06)";
  let T = null, C = null;
  void lerp; void noise1; void EXPO_IN; void H;

  // ---------------------------------------------------------------- grounds

  /** Four arrangements of the glows, so scenes in a row do not sit on the same light. */
  const MOODS = WIDE ? [
    [[1520, 250, 780, "warm", 0.5, 0], [160, 780, 720, "cool", 0.36, 2], [1080, 1060, 680, "warm2", 0.4, 4]],
    [[980, 600, 860, "warm", 0.46, 0], [140, 160, 640, "cool", 0.34, 1], [1800, 920, 620, "warm2", 0.36, 3]],
    [[240, 300, 740, "cool", 0.34, 1], [1520, 660, 720, "warm", 0.42, 3], [700, 1060, 660, "warm2", 0.38, 5]],
    [[1700, 180, 700, "warm2", 0.46, 2], [100, 880, 780, "warm", 0.4, 4], [1260, 1040, 620, "cool", 0.32, 1]],
  ] : [
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

  /** The three grounds: light (cream), dark (ink) and punch (the accent, with rays). */
  function ground(parent, kind, mood, seed) {
    const g = h("div", { position: "absolute", inset: 0, overflow: "hidden" }, parent);
    const parts = [];
    if (kind === "dark") {
      g.style.background = C.inkDeep;
      if (WIDE) parts.push(glowDot(g, [330, 300, 820, "", 0.26, 1], T.theme.darkGlowA), glowDot(g, [1580, 820, 860, "", 0.26, 3], T.theme.darkGlowB), glowDot(g, [1000, 560, 560, "", 0.1, 5], T.theme.darkGlowA));
      else parts.push(glowDot(g, [190, 520, 760, "", 0.26, 1], T.theme.darkGlowA), glowDot(g, [900, 1280, 800, "", 0.26, 3], T.theme.darkGlowB), glowDot(g, [560, 980, 500, "", 0.1, 5], T.theme.darkGlowA));
      parts.push(grid(g, "rgba(255,255,255,0.045)", [-0.1, -0.06]));
      const stars = Array.from({ length: 70 }, (_, i) => {
        const s = 2 + hash(i * 4.1 + seed) * 3.5;
        return { i, el: h("div", { position: "absolute", left: px(hash(i * 1.7 + seed) * W), top: px(hash(i * 2.9 + 3 + seed) * H), width: px(s), height: px(s), borderRadius: "50%", background: i % 5 === 0 ? T.theme.accentSoft : "#fff" }, g) };
      });
      parts.push((f) => { for (const s of stars) s.el.style.opacity = String(0.8 * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(f / (14 + hash(s.i) * 20) + s.i * 3)))); });
    } else if (kind === "punch") {
      g.style.background = `radial-gradient(ellipse 90% 70% at 50% 46%, ${T.theme.accentLight} 0%, ${T.theme.accentFill} 52%, ${T.theme.accentDeep} 100%)`;
      // a long video turns its rays at half the speed: it is watched for minutes, not seconds
      const sb = WIDE ? sunburst(g, 960, 540, 3000, [255, 255, 255], 0.12, 16, 6, 70) : sunburst(g, 540, 930, 2600, [255, 255, 255], 0.13, 16, 6, 70);
      parts.push((f) => { sb.style.transform = `rotate(${f * (WIDE ? 0.35 : 0.7)}deg)`; });
      parts.push(grid(g, "rgba(255,255,255,0.07)", [0.2, 0.12]));
      parts.push(specks(g, true, seed + 7, WIDE ? 16 : 12));
    } else {
      g.style.background = C.paper;
      for (const d of MOODS[mood % MOODS.length]) parts.push(glowDot(g, d));
      parts.push(grid(g, "rgba(15,15,19,0.05)"));
      parts.push(WIDE ? specks(g, false, seed, 20) : specks(g, false, seed));
    }
    return (f) => { for (const p of parts) p(f); };
  }

  // ---------------------------------------------------------------- type

  /** The brand at the top of the light and dark scenes: a dot and the channel's name. */
  function brandPill(parent, kind) {
    const dark = kind !== "light";
    // a long video wears it in the top left corner, like a channel's mark on air
    const el = WIDE ? h("div", { position: "absolute", left: px(WX0), top: px(WIDE_PILL_Y), display: "flex" }, parent)
      : h("div", { position: "absolute", left: "0", width: px(W), top: px(PILL_Y), display: "flex", justifyContent: "center" }, parent);
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

  // ---------------------------------------------------------------- the wide frame: a long video (16:9)

  /*
    A LONG VIDEO is 1920 x 1080 and watched for minutes, on a TV or a phone held sideways. Its scenes use the width:
    words on the left and their cards or picture on the right, compare cards side by side, steps along a line, the
    number with its label beside it, and a chapter card between sections. The motion is the Short's, a little slower
    and smaller, and something always moves.
  */
  const WS = {};
  let CAPS = false;
  const fgOf = (gk) => (gk === "light" ? C.ink : "#fff");
  const acOf = (gk) => (gk === "light" ? T.theme.accentText : gk === "punch" ? "#fff" : T.theme.accentSoft);
  /** The top of a block `hgt` tall, centred (a touch high) between `top` and `bottom`. */
  const zoneW = (hgt, top = WTOP, bottom = WBOT) => Math.round(top + Math.max(0, (bottom - top - hgt) * 0.46));
  /** A plain message when something reaches past the captions' line, or past the player's controls. */
  const footCheck = (s, bottom, what, fix) => {
    if (bottom > WBOT + 2) problems.push(`scene ${s.no}: ${what} ${CAPS ? "runs into the captions" : "runs off the bottom of the frame"}. ${fix}`);
  };
  /**
   * The core's headline, sized and balanced here. Its rows are counted by their tops give or take half a word, because
   * the larger serif word sits a little higher on its row than the sans words beside it (the core's own count takes
   * such a row for two). It steps down in size until it fits `maxRows`, then the box narrows until one more pixel off
   * would add a row, so a line breaks as "Plan it once, / let it run" and never leaves one word alone at the end. A
   * centred one stays centred.
   */
  const hl = (L, tokens, o) => {
    const max = o.maxRows ?? 3, width = o.width ?? 1500, size = o.size ?? 104;
    let hd = null;
    const rows = () => [...hd.box.firstChild.children].map((m) => m.offsetTop).sort((a, b) => a - b).reduce((k, t, i, a) => k + (i && t - a[i - 1] > hd.size * 0.5 ? 1 : 0), 1);
    for (const sz of [size, size * 0.9, size * 0.8, size * 0.72, size * 0.64, size * 0.57, size * 0.5]) {
      if (hd) hd.box.remove();
      hd = headline(L, tokens, { ...o, sizes: [sz], maxRows: 99 });
      if (rows() <= max && hd.box.scrollWidth <= width + 2) break;
    }
    if (rows() > max) problems.push(`scene ${o.sceneNo}: the ${o.label ?? "headline"} needs ${rows()} rows at the smallest size; ${max} at most. Shorten it.`);
    const w0 = hd.box.offsetWidth, n = rows();
    if (n < 2) return hd;
    let lo = w0 * 0.4, hi = w0;
    for (let i = 0; i < 14; i++) {
      const w = (lo + hi) / 2;
      hd.box.style.width = px(w);
      if (rows() > n || hd.box.scrollWidth > w + 2) lo = w; else hi = w;
    }
    hd.box.style.width = px(Math.ceil(hi));
    if ((o.align ?? "center") === "center") hd.box.style.left = px(hd.box.offsetLeft + (w0 - Math.ceil(hi)) / 2);
    return hd;
  };
  /** How far right the words of a left aligned headline reach, from its left edge. */
  const reachOf = (hd) => Math.max(0, ...[...hd.box.firstChild.children].map((m) => m.offsetLeft + m.offsetWidth));
  /** A `monoPill` holding its full width from the start (its words typed over their own room), so it can be measured. */
  const primed = (p) => { p.update(-1, 0); return p; };
  /** The ink pill of `monoPill`, moved from the middle of the frame to start at `left`. */
  const pillLeft = (p, left) => { Object.assign(primed(p).wrap.style, { left: px(left), width: "auto", justifyContent: "flex-start" }); return p; };

  /** A title in the left column, left aligned, with a short accent bar under it that draws itself once it has risen. */
  function sideTitle(s, L, gk, { size = 100, width = LW, left = WX0 } = {}) {
    const hd = hl(L, s.head, { top: 0, size, width, left, align: "left", maxRows: 3, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no, label: "title" });
    const bar = h("div", { position: "absolute", left: px(left + 4), top: "0px", width: "112px", height: "10px", borderRadius: "5px", background: gk === "punch" ? "#fff" : T.theme.accentFill, transformOrigin: "0% 50%", visibility: "hidden" }, L);
    return {
      height: () => hd.height() + 44,
      doneAt: () => hd.doneAt(),
      place(top) { hd.box.style.top = px(top); bar.style.top = px(top + hd.height() + 34); },
      update(f) {
        hd.update(f);
        const e = ramp(f, hd.doneAt() - 2, hd.doneAt() + 14, EXPO_OUT);
        bar.style.visibility = e > 0 ? "visible" : "hidden";
        bar.style.transform = `scaleX(${e})`;
      },
    };
  }

  /** HOOK: the kicker and the line on the left, the picture on the right on turning rays, a ring and confetti. It is the thumbnail too. */
  WS.hook = (s, L, gk) => {
    const parts = [], hasIcon = !!s.icon;
    const kick = s.kicker ? monoPill(L, s.kicker.toUpperCase(), { cy: 0, size: 30, light: gk === "dark" }) : null;
    const hd = hl(L, s.head, hasIcon
      ? { top: 0, size: 152, width: 1020, left: WX0, align: "left", maxRows: 3, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no }
      : { top: 0, size: 156, width: 1560, maxRows: 3, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no });
    const KH = kick ? 108 : 0, bh = KH + hd.height(), top = zoneW(bh), mid = Math.round(top + bh / 2);
    if (kick) {
      if (hasIcon) pillLeft(kick, WX0);
      kick.wrap.style.top = px(top);
      parts.push((f) => { popTo(kick.wrap, f, 2, { from: 0.5, cfg: POP }); kick.update(f, 4, 50); });
    }
    hd.box.style.top = px(top + KH);
    parts.push((f) => hd.update(f));
    if (hasIcon) {
      const cx = 1450, cy = mid, t0 = at(s.cues.icon);
      // rays of its own behind the picture, except on the accent ground, which turns its own
      const sbWrap = h("div", { position: "absolute", inset: "0", transformOrigin: `${cx}px ${cy}px`, display: gk === "punch" ? "none" : "block" });
      L.insertBefore(sbWrap, L.firstChild);
      const sb = sunburst(sbWrap, cx, cy, 1500, gk === "light" ? T.theme.glowWarmDeep : [255, 255, 255], gk === "light" ? 0.15 : 0.09, 20, 8, 66);
      const tile = iconTile(L, s.icon, 340, { cx, cy });
      const rg = ring(L, cx, cy, 170, 280, gk === "punch" ? "#fff" : T.theme.accentFill);
      const bu = burst(L, cx, cy, 16, [T.theme.accentFill, C.ink, "#ffd23f", T.theme.accentSoft], 470, s.no * 7);
      parts.push((f) => {
        const b = ramp(f, t0 - 4, t0 + 20, EXPO_OUT);
        sbWrap.style.visibility = b > 0 ? "visible" : "hidden";
        sbWrap.style.opacity = String(b);
        sbWrap.style.transform = `scale(${0.5 + 0.5 * b})`;
        sb.style.transform = `rotate(${f * 0.3}deg)`;
        const e = popTo(tile, f, t0, { from: 0.2, y: 120, r: -16, cfg: POP });
        if (e && f > t0 + 14) tile.style.transform += ` translateY(${Math.sin((f - t0) / 20) * 9}px) rotate(${Math.sin((f - t0) / 30) * 2.2}deg)`;
        rg(f - t0); bu(f - t0 - 1);
      });
    }
    return (f) => parts.forEach((p) => p(f));
  };

  /** TEXT: the line on one side and its picture on the other (the sides swap scene to scene), or the line alone, large. */
  WS.text = (s, L, gk) => {
    const parts = [];
    if (!s.icon) {
      const hd = hl(L, s.head, { top: 0, size: 144, width: 1560, maxRows: 3, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no });
      hd.box.style.top = px(zoneW(hd.height()));
      return (f) => hd.update(f);
    }
    const flip = s.no % 2 === 0, tx = flip ? 860 : WX0, cx = flip ? 470 : 1450;
    const hd = hl(L, s.head, { top: 0, size: 128, width: 940, left: tx, align: "left", maxRows: 3, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no });
    const top = zoneW(hd.height()), cy = Math.round(top + hd.height() / 2);
    hd.box.style.top = px(top);
    parts.push((f) => hd.update(f));
    const glow = gk === "light" ? rgba(T.theme.glowWarm, 0.55) : gk === "punch" ? "rgba(255,255,255,0.28)" : rgba(T.theme.darkGlowA, 0.34);
    const halo = h("div", { position: "absolute", left: px(cx - 340), top: px(cy - 340), width: "680px", height: "680px", borderRadius: "50%", background: `radial-gradient(circle, ${glow} 0%, rgba(255,255,255,0) 66%)` }, L);
    const tile = iconTile(L, s.icon, 330, { cx, cy, bg: gk === "light" ? "#fff" : "rgba(255,255,255,0.96)" });
    const rg = ring(L, cx, cy, 165, 250, gk === "punch" ? "#fff" : T.theme.accentFill);
    const t0 = at(s.cues.icon);
    parts.push((f) => {
      const b = ramp(f, t0 - 2, t0 + 18, EXPO_OUT);
      halo.style.opacity = String(b);
      halo.style.transform = `scale(${(0.4 + 0.6 * b) * (1 + 0.05 * Math.sin(f / 24))})`;
      const e = popTo(tile, f, t0, { from: 0.3, y: 120, r: flip ? -12 : 12, cfg: POP });
      if (e && f > t0 + 14) tile.style.transform += ` translateY(${Math.sin((f - t0) / 20) * 9}px) rotate(${Math.sin((f - t0) / 30) * 2}deg)`;
      rg(f - t0);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** LIST and CHECKLIST: the title on the left, the cards stacked on the right, both on one middle line. */
  const listWide = (checks) => (s, L, gk) => {
    const parts = [];
    const ti = sideTitle(s, L, gk);
    parts.push(ti.update);
    const n = s.items.length, gap = n > 3 ? 22 : 30, cards = [];
    for (const [i, it] of s.items.entries()) {
      const c = card(L, { left: px(RX), top: "0px", width: px(RW), padding: "28px 40px 28px 30px", display: "flex", alignItems: "center", gap: "30px", borderRadius: "34px" });
      const badge = h("div", { flex: "0 0 auto", width: "96px", height: "96px", borderRadius: checks ? "28px" : "50%", display: "grid", placeItems: "center", background: checks ? "#fff" : T.theme.accentFill, border: checks ? "5px solid rgba(15,15,19,0.16)" : "none", boxSizing: "border-box", color: "#fff", fontFamily: SANS, fontWeight: "900", fontSize: "48px", letterSpacing: "-0.03em" }, c);
      let tick = null;
      if (checks) {
        badge.innerHTML = `<svg width="58" height="58" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
        tick = badge.querySelector("path");
      } else if (it.icon) badge.appendChild(icon(it.icon, 52, "#fff", 2.4));
      else badge.textContent = String(i + 1);
      const tx = h("div", { fontFamily: SANS, fontWeight: "800", fontSize: "50px", lineHeight: "1.1", letterSpacing: "-0.03em", color: C.ink }, c, it.text);
      if (tx.offsetHeight > 50 * 1.1 * 2 + 4) problems.push(`scene ${s.no}: item ${i + 1} ("${it.text}") runs over two rows. Shorten it.`);
      cards.push({ c, badge, tick, tx, it, hgt: c.offsetHeight });
    }
    const stack = cards.reduce((a, k) => a + k.hgt, 0) + gap * (n - 1), th = ti.height(), bh = Math.max(stack, th);
    const mid = zoneW(bh) + bh / 2;
    ti.place(Math.round(mid - th / 2));
    let y = Math.round(mid - stack / 2);
    for (const k of cards) { k.c.style.top = px(y); y += k.hgt + gap; }
    footCheck(s, mid + bh / 2, `the ${checks ? "checklist" : "list"}`, "Use fewer or shorter items.");
    for (const [i, k] of cards.entries()) {
      const t0 = at(k.it.at);
      if (checks) {
        const tIn = Math.max(3, ti.doneAt() - 6) + i * 3;
        parts.push((f) => {
          popTo(k.c, f, tIn, { from: 0.94, x: 90, cfg: SETTLE });
          const e = ramp(f, t0, t0 + 9, EXPO_OUT), on = f >= t0;
          k.tick.setAttribute("stroke-dashoffset", String(1 - e));
          k.badge.style.background = on ? T.theme.ok : "#fff";
          k.badge.style.borderColor = on ? T.theme.ok : "rgba(15,15,19,0.16)";
          k.badge.style.transform = on ? `scale(${1 + 0.2 * (1 - spr(f, t0, POP))})` : "none";
          k.tx.style.color = on ? C.ink : "rgba(15,15,19,0.4)";
        });
      } else {
        parts.push((f) => {
          popTo(k.c, f, t0, { from: 0.9, x: 220, r: 3, cfg: SETTLE });
          const b = f < t0 + 2 ? 0 : spr(f, t0 + 2, POP);
          k.badge.style.transform = `scale(${b}) rotate(${(1 - Math.min(1, b)) * -40}deg)`;
          const glow = f >= t0 ? 1 - ramp(f, t0 + 6, t0 + 26) : 0;
          k.c.style.boxShadow = glow > 0 ? `${CARD_SHADOW}, 0 0 0 ${5 * glow}px ${T.theme.accentFill}` : CARD_SHADOW;
        });
      }
    }
    return (f) => parts.forEach((p) => p(f));
  };
  WS.list = listWide(false);
  WS.checklist = listWide(true);

  /** STEPS: numbered circles along a line that draws itself left to right, each step's card under its circle. */
  WS.steps = (s, L, gk) => {
    const parts = [];
    const n = s.items.length, GX = 48, cw = Math.floor((WX1 - WX0 - GX * (n - 1)) / n), fs = n > 3 ? 44 : 50;
    const xOf = (i) => WX0 + i * (cw + GX);
    const hd = hl(L, s.head, { top: 0, size: 104, width: 1560, maxRows: 2, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no, label: "title" });
    parts.push((f) => hd.update(f));
    const cards = s.items.map((it, i) => card(L, { left: px(xOf(i)), top: "0px", width: px(cw), minHeight: "136px", padding: "30px 34px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: SANS, fontWeight: "800", fontSize: px(fs), lineHeight: "1.1", letterSpacing: "-0.03em", color: C.ink, borderRadius: "32px" }));
    cards.forEach((c, i) => { c.textContent = s.items[i].text; if (c.offsetHeight > fs * 1.1 * 2 + 64) problems.push(`scene ${s.no}: step ${i + 1} runs over two rows. Shorten it.`); });
    const cardH = Math.max(...cards.map((c) => c.offsetHeight));
    cards.forEach((c) => { c.style.height = px(cardH); });
    const DOT = 112, HG = 72, CG = 40, total = hd.height() + HG + DOT + CG + cardH;
    const top = zoneW(total), cy = top + hd.height() + HG + DOT / 2;
    hd.box.style.top = px(top);
    footCheck(s, top + total, "the steps", "Use fewer or shorter steps.");
    const x0 = xOf(0) + cw / 2;
    h("div", { position: "absolute", left: px(x0), top: px(cy - 6), width: px((n - 1) * (cw + GX)), height: "12px", borderRadius: "6px", background: gk === "light" ? "rgba(15,15,19,0.12)" : "rgba(255,255,255,0.18)" }, L);
    const fill = h("div", { position: "absolute", left: px(x0), top: px(cy - 6), width: "0px", height: "12px", borderRadius: "6px", background: T.theme.accentFill }, L);
    const steps = s.items.map((it, i) => {
      const cx = xOf(i) + cw / 2;
      const dot = h("div", { position: "absolute", left: px(cx - DOT / 2), top: px(cy - DOT / 2), width: px(DOT), height: px(DOT), borderRadius: "50%", background: T.theme.accentFill, color: "#fff", display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: "900", fontSize: "54px", boxShadow: "0 16px 30px rgba(40,24,60,0.18)" }, L, String(i + 1));
      cards[i].style.top = px(cy + DOT / 2 + CG);
      return { dot, c: cards[i], t0: at(it.at) };
    });
    parts.push((f) => {
      let reach = 0;
      steps.forEach((st, i) => {
        popTo(st.dot, f, st.t0, { from: 0, cfg: POP });
        popTo(st.c, f, st.t0 + 2, { from: 0.92, y: 90, cfg: SETTLE });
        if (i > 0) { const e = ramp(f, st.t0 - 8, st.t0, SNAP); if (e > 0) reach = Math.max(reach, (i - 1 + e) * (cw + GX)); }
      });
      fill.style.width = px(reach);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** COMPARE: the two cards side by side under the title, each swinging in from its own side, VS between them. */
  WS.compare = (s, L, gk) => {
    const parts = [];
    const hd = hl(L, s.head, { top: 0, size: 104, width: 1560, maxRows: 2, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no, label: "title" });
    parts.push((f) => hd.update(f));
    const CW = 740;
    const side = (x, data, good) => {
      const c = card(L, { left: px(x), top: "0px", width: px(CW), padding: "40px 46px 48px", borderRadius: "40px", border: good ? `5px solid ${T.theme.accentFill}` : "1px solid rgba(15,15,19,0.06)" });
      const chip = h("div", { display: "inline-flex", alignItems: "center", gap: "12px", height: "76px", padding: "0 30px 0 20px", borderRadius: "38px", background: good ? T.theme.accentFill : "rgba(15,15,19,0.07)", color: good ? "#fff" : C.gray, fontFamily: SANS, fontWeight: "800", fontSize: "40px", letterSpacing: "-0.01em" }, c);
      chip.appendChild(icon(good ? "check" : "x", 40, good ? "#fff" : T.theme.bad, 3));
      h("span", {}, chip, data.label);
      for (const line of data.lines) {
        const r = h("div", { display: "flex", gap: "18px", marginTop: "28px", fontFamily: SANS, fontWeight: "800", fontSize: "48px", lineHeight: "1.12", letterSpacing: "-0.025em", color: good ? C.ink : "rgba(15,15,19,0.6)" }, c);
        h("span", { flex: "0 0 auto", width: "16px", height: "16px", marginTop: "19px", borderRadius: "50%", background: good ? T.theme.accentFill : "rgba(15,15,19,0.3)" }, r);
        h("span", {}, r, line);
      }
      return c;
    };
    const left = side(WX0, s.left, false), right = side(WX1 - CW, s.right, true);
    const hgt = Math.max(260, left.offsetHeight, right.offsetHeight), HG = 64, total = hd.height() + HG + hgt;
    const top = zoneW(total), ctop = top + hd.height() + HG;
    hd.box.style.top = px(top);
    for (const c of [left, right]) { c.style.top = px(ctop); c.style.height = px(hgt); }
    footCheck(s, ctop + hgt, "the two sides", "Use fewer or shorter lines.");
    const vs = h("div", { position: "absolute", left: px(W / 2 - 70), top: px(ctop + hgt / 2 - 70), width: "140px", height: "140px", borderRadius: "50%", background: C.ink, color: "#fff", display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: "900", fontSize: "50px", letterSpacing: "-0.03em", boxShadow: "0 18px 36px rgba(15,15,19,0.3)", border: "7px solid #fff", boxSizing: "border-box" }, L, "VS");
    const tl = at(s.cues.left), tr = at(s.cues.right);
    parts.push((f) => {
      popTo(left, f, tl, { from: 0.9, x: -700, r: -8, cfg: SETTLE });
      popTo(right, f, tr, { from: 0.9, x: 700, r: 8, cfg: SETTLE });
      popTo(vs, f, tr - 4, { from: 0, r: -90, cfg: POP });
      const dim = ramp(f, tr + 8, tr + 22, SOFT);
      if (f >= tl) left.style.transform += ` scale(${1 - 0.04 * dim})`;
      left.style.opacity = String(1 - 0.3 * dim);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** STAT: the accent ground, the number large on the left counting up and slamming down, its label beside it across a rule. */
  WS.stat = (s, L) => {
    const parts = [];
    const t0 = at(s.cues.value);
    const m = /^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/.exec(s.value);
    const num = m ? Number(m[2].replace(/,/g, "")) : null, dec = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
    const box = h("div", { position: "absolute", left: "0px", top: "0px", display: "flex", alignItems: "center", gap: "40px", whiteSpace: "nowrap" }, L);
    let tile = null;
    if (s.icon) {
      tile = h("div", { flex: "0 0 auto", width: "200px", height: "200px", borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 26px 50px rgba(0,0,0,0.25)" }, box);
      tile.appendChild(icon(s.icon, 104, T.theme.accentText, 2.2));
    }
    const val = h("span", { fontFamily: SANS, fontWeight: "900", letterSpacing: "-0.05em", lineHeight: "1", color: "#fff", textShadow: "0 20px 44px rgba(0,0,0,0.22)", display: "inline-block", whiteSpace: "nowrap", textAlign: "right" }, box, s.value);
    let size = 440;
    val.style.fontSize = px(size);
    while (box.offsetWidth > 900 && size > 140) { size -= 10; val.style.fontSize = px(size); }
    // the count runs right aligned in the final number's width, so the rule beside it never moves
    val.style.width = px(val.offsetWidth);
    const GUT = 120;
    const hd = hl(L, s.head, { top: 0, size: 112, width: 700, left: 0, align: "left", maxRows: 3, color: "#fff", accent: "#fff", sceneNo: s.no, label: "label" });
    const bw = box.offsetWidth, x0 = Math.max(WX0, Math.round(W / 2 - (bw + GUT + reachOf(hd)) / 2));
    const bh = Math.max(box.offsetHeight, hd.height()), mid = zoneW(bh) + bh / 2;
    box.style.left = px(x0); box.style.top = px(Math.round(mid - box.offsetHeight / 2));
    hd.box.style.left = px(x0 + bw + GUT); hd.box.style.top = px(Math.round(mid - hd.height() / 2));
    const ruleH = Math.min(320, bh + 20);
    const rule = h("div", { position: "absolute", left: px(x0 + bw + GUT / 2 - 3), top: px(Math.round(mid - ruleH / 2)), width: "6px", height: px(ruleH), borderRadius: "3px", background: "rgba(255,255,255,0.55)", transformOrigin: "50% 50%" }, L);
    const vx = x0 + bw - val.offsetWidth / 2;
    const rg = ring(L, vx, mid, 220, 340, "#fff"), bu = burst(L, vx, mid, 24, ["#ffffff", C.ink, "#ffd23f", "#ffffff"], 620, 9);
    const fmt = (v) => (m ? `${m[1]}${v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}${m[3]}` : s.value);
    parts.push((f) => {
      hd.update(f);
      const count = num != null ? EXPO_OUT(ramp(f, t0 - 18, t0)) : 1;
      val.textContent = f < t0 - 18 ? (num != null ? fmt(0) : "") : f >= t0 ? s.value : fmt(num * count);
      const slam = spr(f, t0, { damping: 16, stiffness: 340, mass: 0.8 });
      const idle = f > t0 + 14 ? 1 + 0.01 * Math.sin((f - t0) / 9) : 1;
      val.style.transform = f >= t0 ? `scale(${(1 + 0.18 * (1 - Math.min(1, slam))) * idle})` : `scale(${0.7 + 0.3 * ramp(f, t0 - 18, t0)})`;
      val.style.opacity = String(ramp(f, t0 - 20, t0 - 12));
      if (tile) {
        const c = spr(f, 1, { damping: 12, stiffness: 200, mass: 0.8 }), spin = Math.cos(ramp(f, 1, 16, EXPO_OUT) * Math.PI * 2);
        tile.style.transform = `scale(${Math.max(0, c)}) scaleX(${0.25 + 0.75 * Math.abs(spin)})`;
      }
      rule.style.transform = `scaleY(${ramp(f, 2, 16, EXPO_OUT)})`;
      rg(f - t0); bu(f - t0 - 1);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** SLAM: one or two huge words in an ink band that slams across the frame, over the scene before it. */
  WS.slam = (s, L) => {
    const t0 = at(s.cues.slam), BT = 350, BH = 380;
    const dim = h("div", { position: "absolute", inset: "-60px", background: "rgba(9,9,15,0.52)" }, L);
    const band = h("div", { position: "absolute", left: "-40px", width: px(W + 80), top: px(BT), height: px(BH), background: C.ink, transformOrigin: "50% 50%", boxShadow: "0 40px 80px rgba(0,0,0,0.35)" }, L);
    const txt = h("div", { position: "absolute", left: "0", width: px(W), top: px(BT), height: px(BH), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: SANS, fontWeight: "900", letterSpacing: "-0.045em", lineHeight: "1", whiteSpace: "nowrap" }, L);
    const inner = h("span", { display: "inline-flex", alignItems: "flex-end" }, txt);
    h("span", {}, inner, s.text.toUpperCase().replace(/[.!]+$/, ""));
    const dot = h("span", { display: "inline-block", width: "0.2em", height: "0.2em", borderRadius: "50%", background: T.theme.accentFill, marginLeft: "0.06em", marginBottom: "0.1em" }, inner);
    let size = 290;
    txt.style.fontSize = px(size);
    while (inner.offsetWidth > 1600 && size > 110) { size -= 8; txt.style.fontSize = px(size); }
    if (inner.offsetWidth > 1600) problems.push(`scene ${s.no}: the slam "${s.text}" is too long. One or two short words.`);
    return (f) => {
      dim.style.opacity = String(ramp(f, t0 - 6, t0, SOFT));
      const b = ramp(f, t0 - 5, t0 + 1, SNAP);
      band.style.transform = `scaleY(${b}) rotate(${-1.5 + 1.5 * b}deg)`;
      const e = spr(f, t0, SLAM);
      txt.style.visibility = f < t0 ? "hidden" : "visible";
      txt.style.transform = `scale(${1 + 0.6 * (1 - Math.min(1, e)) + (f > t0 + 12 ? 0.008 * Math.sin((f - t0) / 9) : 0)})`;
      dot.style.transform = `scale(${f < t0 + 4 ? 0 : spr(f, t0 + 4, POP)})`;
    };
  };

  /** PUNCH: the accent ground, the picture and the line large in the middle, a ring and confetti when it lands. */
  WS.punch = (s, L) => {
    const parts = [];
    const hd = hl(L, s.head, { top: 0, size: 150, width: 1560, maxRows: 3, color: "#fff", accent: "#fff", sceneNo: s.no });
    const ht = hd.height(), TILE = 220, GAP = 60, total = (s.icon ? TILE + GAP : 0) + ht, top = zoneW(total);
    let tile = null, mid;
    if (s.icon) {
      tile = h("div", { position: "absolute", left: px(W / 2 - TILE / 2), top: px(top), width: px(TILE), height: px(TILE), borderRadius: "60px", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" }, L);
      tile.appendChild(icon(s.icon, 120, T.theme.accentText, 2.2));
      hd.box.style.top = px(top + TILE + GAP);
      mid = top + TILE / 2;
    } else { hd.box.style.top = px(top); mid = top + ht / 2; }
    const t0 = at(s.cues.land);
    const rg = ring(L, W / 2, mid, 200, 360, "#fff"), bu = burst(L, W / 2, mid, 24, ["#ffffff", C.ink, "#ffd23f", "#ffffff"], 680, s.no * 3);
    parts.push((f) => {
      hd.update(f);
      if (tile) {
        const e = popTo(tile, f, 3, { from: 0.2, y: 80, r: -14, cfg: POP });
        if (e && f > 17) tile.style.transform += ` translateY(${Math.sin((f - 17) / 20) * 8}px) rotate(${Math.sin((f - 17) / 30) * 2}deg)`;
      }
      rg(f - t0); bu(f - t0 - 1);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** QUOTE: a wide card with a big serif quote mark, the words typed in, who said it under them; a title, if any, on the left. */
  WS.quote = (s, L, gk) => {
    const parts = [];
    const ti = s.head.length ? sideTitle(s, L, gk, { size: 96 }) : null;
    const fs = ti ? 58 : 72;
    const c = card(L, ti ? { left: px(RX), top: "0px", width: px(RW), padding: "118px 64px 60px", borderRadius: "44px" }
      : { left: "0px", top: "0px", minWidth: "900px", maxWidth: "1360px", padding: "128px 96px 74px", borderRadius: "44px" });
    const mark = h("div", { position: "absolute", left: ti ? "50px" : "80px", top: "-34px", fontFamily: SERIF, fontStyle: "italic", fontSize: "320px", lineHeight: "1", color: T.theme.accentText }, c, "“");
    const body = h("div", { fontFamily: SANS, fontWeight: "800", fontSize: px(fs), lineHeight: "1.16", letterSpacing: "-0.03em", color: C.ink }, c);
    const shown = h("span", {}, body), caret = h("span", { display: "inline-block", width: "6px", height: px(fs - 2), marginLeft: "4px", verticalAlign: px(-Math.round(fs * 0.12)), background: T.theme.accentFill }, body), rest = h("span", { opacity: "0" }, body);
    let by = null;
    if (s.by) {
      by = h("div", { marginTop: "40px", display: "flex", alignItems: "center", gap: "18px", fontFamily: MONO, fontWeight: "500", fontSize: "34px", letterSpacing: "0.03em", color: C.gray }, c);
      h("span", { width: "48px", height: "5px", borderRadius: "3px", background: T.theme.accentFill }, by);
      h("span", {}, by, s.by);
    }
    const q = s.quote;
    rest.textContent = q;
    if (!ti) c.style.left = px(Math.round((W - c.offsetWidth) / 2));
    const ch = c.offsetHeight, th = ti ? ti.height() : 0, bh = Math.max(ch, th), mid = zoneW(bh) + bh / 2;
    c.style.top = px(Math.round(mid - ch / 2));
    if (ti) { ti.place(Math.round(mid - th / 2)); parts.push(ti.update); }
    footCheck(s, mid + bh / 2, "the quote", "Shorten it.");
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

  /** CHAT: message bubbles, the other side typing first; a title, if any, on the left and the thread on the right. */
  WS.chat = (s, L, gk) => {
    const parts = [];
    const ti = s.head.length ? sideTitle(s, L, gk, { size: 96 }) : null;
    const bx = ti ? RX : 420, bw = ti ? RW : 1080, maxB = ti ? 700 : 860;
    const box = h("div", { position: "absolute", left: px(bx), width: px(bw), top: "0px", display: "flex", flexDirection: "column", gap: "32px" }, L);
    for (const m of s.messages) {
      const me = m.from === "me";
      const row = h("div", { position: "relative", display: "flex", justifyContent: me ? "flex-end" : "flex-start", alignItems: "flex-end", gap: "18px" }, box);
      let av = null;
      if (!me) {
        av = h("div", { width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, #d9d6f5, #f3d6cf)", flex: "0 0 auto", display: "grid", placeItems: "center", boxShadow: "0 8px 18px rgba(40,24,60,0.12)" }, row);
        av.appendChild(icon("user", 44, "rgba(15,15,19,0.55)", 2));
      }
      const b = h("div", { maxWidth: px(maxB), padding: ti ? "28px 38px" : "32px 44px", borderRadius: me ? "42px 42px 12px 42px" : "42px 42px 42px 12px", background: me ? T.theme.accentFill : "#fff", color: me ? "#fff" : C.ink, boxShadow: CARD_SHADOW, fontFamily: SANS, fontWeight: "800", fontSize: ti ? "46px" : "54px", lineHeight: "1.16", letterSpacing: "-0.025em", transformOrigin: me ? "100% 100%" : "0% 100%" }, row, m.text);
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
    const bh0 = box.offsetHeight, th = ti ? ti.height() : 0, bh = Math.max(bh0, th), mid = zoneW(bh) + bh / 2;
    box.style.top = px(Math.round(mid - bh0 / 2));
    if (ti) { ti.place(Math.round(mid - th / 2)); parts.push(ti.update); }
    footCheck(s, mid + bh / 2, "the messages", "Use fewer or shorter messages.");
    return (f) => parts.forEach((p) => p(f));
  };

  /** IMAGE: the creator's picture or clip large on the right in its own shape, slowly pushing in; its line on the left. */
  WS.image = (s, L, gk) => {
    const parts = [];
    const ti = s.head.length ? sideTitle(s, L, gk, { size: 96, width: 500 }) : null;
    const room = ti ? { x: 680, w: WX1 - 680 } : { x: 240, w: W - 480 }, maxH = WBOT - WTOP - 16;
    const c = h("div", { position: "absolute", left: px(room.x), top: px(WTOP), width: px(room.w), height: px(Math.round(room.w * 9 / 16)), borderRadius: "34px", overflow: "hidden", boxShadow: "0 44px 100px rgba(40,24,60,0.26), 0 6px 16px rgba(40,24,60,0.1)", background: "#ddd", border: "10px solid #fff", boxSizing: "border-box" }, L);
    let media;
    if (/\.(mp4|mov|webm|m4v)$/i.test(s.src)) { media = h("video", { width: "100%", height: "100%", objectFit: "cover" }, c); media.muted = true; media.src = s.src; media.preload = "auto"; }
    else { media = h("img", { width: "100%", height: "100%", objectFit: "cover", transformOrigin: "50% 50%" }, c); media.src = s.src; }
    s._media = media;
    // the card takes the picture's own shape, which is known once it has loaded (before the first frame)
    let laid = false;
    const lay = () => {
      const nw = media.naturalWidth || media.videoWidth || 16, nh = media.naturalHeight || media.videoHeight || 9;
      let w = room.w, hh = Math.round((w * nh) / nw);
      if (hh > maxH) { hh = maxH; w = Math.round((hh * nw) / nh); }
      const top = zoneW(hh), x = Math.round(room.x + (room.w - w) / 2);
      Object.assign(c.style, { left: px(x), top: px(top), width: px(w), height: px(hh), transformOrigin: `${ti ? "0%" : "50%"} 50%` });
      if (ti) ti.place(Math.round(top + hh / 2 - ti.height() / 2));
      laid = true;
    };
    if (ti) { ti.place(Math.round(WTOP + 300 - ti.height() / 2)); parts.push(ti.update); }
    const len = s.len * FPS;
    parts.push((f) => {
      if (!laid) lay();
      const e = popTo(c, f, 2, { from: 0.86, x: 160, r: 3, cfg: SETTLE });
      if (e) c.style.transform += ` perspective(2400px) rotateY(${-7 + 4 * ramp(f, 2, len, SOFT)}deg)`;
      media.style.transform = `scale(${1.02 + 0.06 * ramp(f, 0, len, SOFT)}) translateX(${-1.2 * ramp(f, 0, len, SOFT)}%)`;
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** STRIKE: the wrong idea in one wide line, struck through by a marker; the right one rises under it. */
  WS.strike = (s, L, gk) => {
    const parts = [];
    const color = fgOf(gk), accent = acOf(gk);
    const wrong = hl(L, s.wrongHead, { top: 0, size: 116, width: 1600, maxRows: 2, color, accent: color, sceneNo: s.no, label: "wrong line" });
    const right = s.rightHead ? hl(L, s.rightHead, { top: 0, size: 134, width: 1600, maxRows: 2, color, accent, sceneNo: s.no, label: "right line" }) : null;
    const gapY = 96, total = wrong.height() + (right ? gapY + right.height() : 0), top = zoneW(total);
    wrong.box.style.top = px(top);
    if (right) right.box.style.top = px(top + wrong.height() + gapY);
    footCheck(s, top + total, "the two lines", "Shorten them.");
    const masks = [...wrong.box.firstChild.children];
    const lines = [...new Set(masks.map((m) => m.offsetTop))].map((rowTop) => {
      const ms = masks.filter((m) => m.offsetTop === rowTop);
      const x0 = Math.min(...ms.map((m) => m.offsetLeft)), x1 = Math.max(...ms.map((m) => m.offsetLeft + m.offsetWidth));
      return h("div", { position: "absolute", left: px(wrong.box.offsetLeft + x0 - 18), top: px(top + rowTop + wrong.size * 0.5), width: px(x1 - x0 + 36), height: "18px", borderRadius: "9px", background: T.theme.bad, transformOrigin: "0% 50%", transform: "scaleX(0) rotate(-1.5deg)", boxShadow: "0 6px 14px rgba(229,72,77,0.3)" }, L);
    });
    const tS = at(s.cues.strike);
    parts.push((f) => {
      wrong.update(f);
      lines.forEach((ln, i) => { const e = ramp(f, tS + i * 4, tS + i * 4 + 9, SNAP); ln.style.transform = `scaleX(${e}) rotate(-1.5deg)`; });
      wrong.box.style.opacity = String(1 - 0.5 * ramp(f, tS + 4, tS + 14, SOFT));
      if (right) right.update(f);
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /*
    CHAPTER (long videos only): the section break, and a YouTube chapter at its first frame. The chapter's number large
    in the serif italic on turning rays, its kicker in an ink pill, its title rising beside it, and along the foot a
    line of every chapter in the video: the ones before this one filled, this one filling as its title lands.
  */
  WS.chapter = (s, L, gk) => {
    const parts = [];
    const fg = fgOf(gk), ac = acOf(gk), light = gk === "light";
    const all = T.scenes.filter((x) => x.type === "chapter"), n = Math.max(1, all.length), k = Math.max(0, all.findIndex((x) => x.no === s.no));
    const fillC = gk === "punch" ? "#fff" : T.theme.accentFill, trackC = light ? "rgba(15,15,19,0.12)" : "rgba(255,255,255,0.16)";
    // the line of chapters along the foot, each named when the names fit
    const LINE_Y = WBOT - 72, SG = 24, sw = (WX1 - WX0 - SG * (n - 1)) / n;
    const segs = all.map((c, i) => {
      const x = WX0 + i * (sw + SG);
      const track = h("div", { position: "absolute", left: px(x), top: px(LINE_Y), width: px(sw), height: "8px", borderRadius: "4px", background: trackC, transformOrigin: "0% 50%" }, L);
      const fill = h("div", { position: "absolute", left: px(x), top: px(LINE_Y), width: px(sw), height: "8px", borderRadius: "4px", background: fillC, transformOrigin: "0% 50%" }, L);
      const label = h("div", { position: "absolute", left: px(x), top: px(LINE_Y + 24), fontFamily: SANS, fontWeight: "800", fontSize: "34px", letterSpacing: "-0.02em", lineHeight: "1.1", whiteSpace: "nowrap", color: fg }, L, String(c.text).replace(/\*/g, "").trim());
      return { x, track, fill, label, i };
    });
    if (!segs.every((g) => g.label.offsetWidth <= sw - 12)) segs.forEach((g) => { g.label.style.display = "none"; });
    const node = h("div", { position: "absolute", left: "0px", top: px(LINE_Y + 4 - 14), width: "28px", height: "28px", borderRadius: "50%", background: fillC, boxShadow: `0 0 0 7px ${light ? "rgba(255,255,255,0.92)" : "rgba(9,9,15,0.9)"}, 0 0 26px ${fillC}` }, L);
    // the number, in a mask it rises out of
    const sbWrap = h("div", { position: "absolute", inset: "0" });
    L.insertBefore(sbWrap, L.firstChild);
    const nmask = h("div", { position: "absolute", left: px(WX0 - 24), top: "0px", padding: "6px 44px 30px 24px", overflow: "hidden" }, L);
    const numEl = h("div", { fontFamily: SERIF, fontStyle: "italic", fontWeight: "400", fontSize: "460px", lineHeight: "0.9", letterSpacing: "-0.02em", color: ac, whiteSpace: "nowrap" }, nmask, String(k + 1).padStart(2, "0"));
    const nw = nmask.offsetWidth, nh = nmask.offsetHeight;
    const tx = Math.max(600, WX0 - 24 + nw + 40), tw = WX1 - tx;
    const kick = pillLeft(monoPill(L, (s.kicker || `Chapter ${k + 1}`).toUpperCase(), { cy: 0, size: 30, light: !light }), tx);
    const hd = hl(L, s.head, { top: 0, size: 184, width: tw, left: tx, align: "left", maxRows: 2, color: fg, accent: ac, sceneNo: s.no, label: "chapter title" });
    const KH = 110, bh = KH + hd.height(), blockH = Math.max(bh, nh), mid = zoneW(blockH, WTOP, LINE_Y - 40) + blockH / 2;
    kick.wrap.style.top = px(Math.round(mid - bh / 2));
    hd.box.style.top = px(Math.round(mid - bh / 2 + KH));
    nmask.style.top = px(Math.round(mid - nh / 2));
    if (mid + blockH / 2 > LINE_Y - 30) problems.push(`scene ${s.no}: the chapter title is too long for its card. Two to four words.`);
    const ncx = WX0 - 24 + nw / 2, ncy = Math.round(mid);
    sbWrap.style.transformOrigin = `${ncx}px ${ncy}px`;
    const sb = sunburst(sbWrap, ncx, ncy, 1300, light ? T.theme.glowWarmDeep : [255, 255, 255], light ? 0.14 : 0.07, 20, 8, 64);
    const rg = ring(L, ncx, ncy, 150, 280, fillC);
    const tl = at(s.cues.land);
    parts.push((f) => {
      const b = ramp(f, 0, 24, EXPO_OUT);
      sbWrap.style.transform = `scale(${0.6 + 0.4 * b})`;
      sb.style.transform = `rotate(${f * 0.3}deg)`;
      const e = ramp(f, 2, 20, EXPO_OUT);
      numEl.style.transform = `translateY(${(1 - e) * 104 + Math.sin(f / 26) * 1.1}%) rotate(${(1 - e) * 8}deg)`;
      popTo(kick.wrap, f, 4, { from: 0.5, cfg: POP });
      kick.update(f, 6, 40);
      hd.update(f);
      rg(f - tl);
      let fe = 0;
      for (const g of segs) {
        const d = ramp(f, 3 + g.i * 2, 16 + g.i * 2, EXPO_OUT);
        g.track.style.transform = `scaleX(${d})`;
        const fill = g.i < k ? d : g.i === k ? ramp(f, tl - 12, tl + 6, SNAP) : 0;
        if (g.i === k) fe = fill;
        g.fill.style.visibility = fill > 0 ? "visible" : "hidden";
        g.fill.style.transform = `scaleX(${fill})`;
        const le = ramp(f, 6 + g.i * 2, 20 + g.i * 2, EXPO_OUT);
        g.label.style.transform = `translateY(${(1 - le) * 34}px)`;
        g.label.style.opacity = String(le * (g.i === k ? 1 : g.i < k ? 0.62 : 0.36));
      }
      const pop = f < tl - 12 ? 0 : spr(f, tl - 12, POP);
      node.style.left = px((segs[k] ? segs[k].x + sw * fe : WX0) - 14);
      node.style.transform = `scale(${pop * (f > tl + 8 ? 1 + 0.12 * Math.sin((f - tl) / 8) : 1)})`;
    });
    return (f) => parts.forEach((p) => p(f));
  };

  /** END: the channel's mark bursting in on turning rays, its name, then the handle and the stamp side by side. */
  WS.end = (s, L, gk) => {
    const parts = [];
    let hd = null;
    if (s.head.length) {
      hd = hl(L, s.head, { top: 0, size: 120, width: 1560, maxRows: 2, color: fgOf(gk), accent: acOf(gk), sceneNo: s.no });
      parts.push((f) => hd.update(f));
    }
    const markRow = h("div", { position: "absolute", left: "0", width: px(W), top: "0px", display: "flex", justifyContent: "center" }, L);
    const mark = h("div", { display: "inline-flex", alignItems: "center", gap: "30px" }, markRow);
    if (T.brand.logo) {
      const img = h("img", { width: "150px", height: "150px", borderRadius: "40px", objectFit: "cover", boxShadow: "0 20px 40px rgba(15,15,19,0.28)" }, mark);
      img.src = T.brand.logo;
    } else h("div", { width: "150px", height: "150px", borderRadius: "40px", background: T.theme.accentFill, color: "#fff", display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: "900", fontSize: "92px", letterSpacing: "-0.04em", boxShadow: "0 20px 40px rgba(15,15,19,0.28)" }, mark, (T.brand.name.match(/[A-Za-z0-9]/) || ["★"])[0].toUpperCase());
    const name = h("span", { fontFamily: SANS, fontWeight: "800", fontSize: "128px", letterSpacing: "-0.045em", lineHeight: "1", color: fgOf(gk), whiteSpace: "nowrap" }, mark, T.brand.name);
    let ns = 128;
    while (mark.offsetWidth > 1500 && ns > 60) { ns -= 4; name.style.fontSize = px(ns); }
    const pill = s.sub ? primed(monoPill(L, s.sub, { cy: 0, size: 36 })) : null;
    let stamp = null, st = null;
    if (s.stamp) {
      stamp = h("div", { position: "absolute", left: "0px", top: "0px" }, L);
      st = h("div", { padding: "32px 52px", background: T.theme.stamp, border: `9px solid ${C.ink}`, borderRadius: "30px", boxShadow: "0 26px 50px rgba(15,15,19,0.28)", fontFamily: SANS, fontWeight: "900", fontSize: "60px", letterSpacing: "-0.025em", color: T.theme.stampOn, whiteSpace: "nowrap", position: "relative" }, stamp, s.stamp.toUpperCase());
      h("div", { position: "absolute", inset: "12px", borderRadius: "17px", border: "2.5px solid rgba(15,15,19,0.45)" }, st);
      if (st.offsetWidth > 900) problems.push(`scene ${s.no}: the stamp "${s.stamp}" is too long. Three or four words.`);
    }
    // the headline, the mark, and under them the handle and the stamp in one row
    const HG = 60, MG = 70, pp = pill ? pill.wrap.firstChild : null;
    const hh = hd ? hd.height() + HG : 0, mh = mark.offsetHeight, rowH = Math.max(pp ? pp.offsetHeight : 0, st ? st.offsetHeight : 0);
    const total = hh + mh + (rowH ? MG + rowH : 0), top = zoneW(total);
    if (hd) hd.box.style.top = px(top);
    markRow.style.top = px(top + hh);
    const rowMid = top + hh + mh + MG + rowH / 2, RG = 64;
    const pw = pp ? pp.offsetWidth : 0, sw = st ? st.offsetWidth : 0, rowW = pw + (pp && st ? RG : 0) + sw, rx = Math.round(W / 2 - rowW / 2);
    if (pill) Object.assign(pill.wrap.style, { left: px(rx), width: px(pw), top: px(Math.round(rowMid - pp.offsetHeight / 2)), justifyContent: "flex-start" });
    if (stamp) Object.assign(stamp.style, { left: px(rx + rowW - sw), top: px(Math.round(rowMid - st.offsetHeight / 2)) });
    footCheck(s, top + total + 20, "the end card", "Shorten the line, the handle or the stamp.");
    const mcy = top + hh + mh / 2;
    const sbWrap = h("div", { position: "absolute", inset: "0", transformOrigin: `${W / 2}px ${mcy}px` });
    L.insertBefore(sbWrap, L.firstChild);
    const sb = sunburst(sbWrap, W / 2, mcy, 2600, gk === "light" ? T.theme.glowWarmDeep : [255, 255, 255], gk === "light" ? 0.16 : 0.09, 20, 8, 66);
    const tMark = at(s.cues.mark), tStamp = at(s.cues.stamp ?? s.cues.mark + 1);
    const bu = burst(L, W / 2, mcy, 22, [T.theme.accentFill, C.ink, "#ffd23f", gk === "light" ? "#ffffff" : T.theme.accentSoft], 620, 3);
    const scx = rx + rowW - sw / 2;
    const bu2 = stamp ? burst(L, scx, rowMid, 22, [T.theme.accentFill, C.ink, "#ffd23f", "#ffffff"], 520, 5) : () => {};
    parts.push((f) => {
      sbWrap.style.transform = `scale(${0.7 + 0.3 * ramp(f, 0, 16, EXPO_OUT)})`;
      sb.style.transform = `rotate(${f * 0.35}deg)`;
      popTo(markRow, f, tMark, { from: 0.5, y: 50, cfg: SETTLE });
      bu(f - tMark - 1);
      if (pill) { popTo(pill.wrap, f, tMark + 5, { from: 0.9, y: 40, cfg: SETTLE }); pill.update(f, tMark + 7, 55); }
      if (stamp) {
        if (f < tStamp) stamp.style.visibility = "hidden";
        else {
          const e = spr(f, tStamp, { damping: 24, stiffness: 420, mass: 0.7 });
          stamp.style.visibility = "visible";
          stamp.style.transform = `rotate(${-5 + (1 - Math.min(1, e)) * 9 + (f > tStamp + 20 ? Math.sin((f - tStamp) / 22) * 0.8 : 0)}deg) scale(${1 + 0.55 * (1 - e)})`;
        }
        bu2(f - tStamp - 1);
      }
    });
    return (f) => parts.forEach((p) => p(f));
  };

  window.RS_STYLE = {
    name: "studio",
    fonts: [`800 100px "Inter Tight"`, `900 100px "Inter Tight"`, `700 100px "Inter Tight"`, `italic 400 100px "Instrument Serif"`, `700 40px "JetBrains Mono"`, `500 40px "JetBrains Mono"`],
    setup(timeline) {
      T = timeline;
      C = { ink: "#0f0f13", inkDeep: "#09090f", paper: T.theme.paper, gray: "#6b6b7c" };
      document.body.style.background = C.paper;
      // a long video has no captions unless the creator asks; when it has them, nothing goes below their line
      CAPS = T.captions.length > 0;
      WBOT = CAPS ? 872 : 952;
    },
    ground,
    brand: (L, gk, s) => { if (gk !== "punch" && s.type !== "end" && s.type !== "slam") brandPill(L, gk); },
    scenes: WIDE ? WS : SCENES,
    captions: pillCaptions({
      colors: (g) => ({
        pill: g === "punch" ? C.ink : T.theme.accentFill,
        said: g === "light" ? C.ink : "#ffffff",
        next: g === "light" ? "rgba(15,15,19,0.3)" : g === "punch" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.34)",
        shadow: g === "punch" ? "rgba(15,15,19,0.25)" : T.theme.accentShadow,
      }),
    }),
    // a long video is watched for minutes: half the push and a softer jolt
    camera: WIDE ? { push: 0.018, shake: 0.6 } : { push: 0.035, shake: 1 },
  };
})();
