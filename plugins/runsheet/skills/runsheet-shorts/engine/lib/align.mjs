// The words on screen against the words heard, so each word on screen lights up the moment it is said.
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
// the same word, or one cut short by the speech engine ("twenty-five" heard as "twenty"); short words must match exactly
const same = (a, b) => !!a && !!b && (a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))));

/** "Your channel posts when you *remember*." into words, each marked if it is drawn in the accent colour. */
export function tokens(show) {
  let inEm = false;
  return show.split(/\s+/).filter(Boolean).map((raw) => {
    const starts = raw.startsWith("*");
    const ends = /\*[.,!?;:'")]*$/.test(raw) && (raw.length > 1 || !starts);
    const emph = inEm || starts;
    if (starts && !ends) inEm = true;
    if (ends) inEm = false;
    return { text: raw.replace(/\*/g, ""), emph };
  });
}

/*
  IN ORDER, OVER THE WHOLE LINE. The words on screen keep their punctuation and spelling, the speech does not, and a
  transcript can mishear a name or run a web address into six words. They are matched as a longest common subsequence,
  so a word that matches nothing is skipped without pulling every word after it out of step. Each unmatched word takes
  its time from its neighbours; `heard` says which ones were matched.
*/
export function align(show, spoken, len) {
  const tk = tokens(show);
  const A = tk.map((t) => norm(t.text)), B = spoken.map((w) => norm(w.text));
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = same(A[i], B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (same(A[i], B[j]) && L[i][j] === L[i + 1][j + 1] + 1) {
      Object.assign(tk[i], { t0: spoken[j].t0, t1: spoken[j].t1, heard: true });
      i++; j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  // fill the unmatched ones between their neighbours, or across the clip when nothing matched
  for (let i = 0; i < tk.length; i++) {
    if (tk[i].t0 != null) continue;
    const prev = [...tk.slice(0, i)].reverse().find((t) => t.t1 != null);
    const next = tk.slice(i + 1).find((t) => t.t0 != null);
    const a = prev ? prev.t1 : 0.05, b = next ? next.t0 : Math.max(a + 0.2, len - 0.1);
    const gap = tk.slice(i).findIndex((t) => t.t0 != null);
    const step = (b - a) / Math.max(1, gap === -1 ? tk.length - i : gap);
    tk[i].t0 = a; tk[i].t1 = a + step; tk[i].heard = false;
  }
  return tk;
}
