/* Deep dives on the error metrics and WAIC (S21b-S21f), placed after S21. Storyboard: STORYBOARD_DEEP_metrics.md.
   Data: window.FLIPBOOK_DATA.deep_metrics, written by scripts/flipbook/export_deep_metrics.py. */
(function () {
  const U = FB.util, { clamp, lerp, ease, seg } = U;
  const DM = () => (window.FLIPBOOK_DATA && window.FLIPBOOK_DATA.deep_metrics) || null;
  const DEEP = { text: 'Deep dive', cls: 'deep' };
  const ONE = { text: 'One real origin, for illustration' };
  const PROV = { text: 'Provisional: some fits fail convergence' };
  const MINUS = '\u2212';
  function fmt(x, d = 0) {
    if (x == null || !isFinite(x)) return '\u2013';
    const s = Math.abs(x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (x < 0 && +s.replace(/,/g, '') !== 0 ? MINUS : '') + s;
  }
  const sfmt = (x, d = 1) => (x > 0 ? '+' : '') + fmt(x, d);
  const dayOf = (startIso, t) => { const d = new Date(startIso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + t - 1); return U.fmtDate(d.toISOString().slice(0, 10)); };
  function missing(D) { D.text('Data file data/deep_metrics.js not loaded.', 40, 80, { size: 28, color: FB.C.critical }); }
  const G = (D, a, fn) => { if (a > 0) D.group(a, fn); };
  const exLabel = ex => `Ottawa, IGP, origin ${U.fmtDate(ex.origin)}, ${ex.h} days ahead`;
  const legend = (D, C) => { D.label('Cases-Only Active Set', 110, 50, C.cases, { size: 26 }); D.label('Viral-Load Active Set', 460, 50, C.vl, { size: 26 }); };
  // vertical jitter for dot strips (deterministic)
  const jit = i => (((i * 37) % 13) - 6) * 4.6;
  function arc(D, x1, x2, y, h, o) {
    const pts = [], cx = (x1 + x2) / 2, rx = (x2 - x1) / 2;
    for (let k = 0; k <= 24; k++) { const th = Math.PI * k / 24; pts.push([cx - rx * Math.cos(th), y - h * Math.sin(th)]); }
    D.line(pts, o);
  }
  function clip(ctx, box, fn) { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); fn(); ctx.restore(); }

  /* ------------------------------------------------------------------ S21b: CRPS anatomy */
  FB.scene({
    id: 'S21b', after: 'S21', part: 'Evaluation', title: 'CRPS from the draws: accuracy minus spread', dur: 15,
    tags: [DEEP, ONE],
    eq: '\\begin{aligned}\\mathrm{CRPS}(F,y)&=\\E_F\\lvert Y-y\\rvert\\\\&\\quad-\\tfrac12\\,\\E_F\\lvert Y-Y\'\\rvert\\end{aligned}',
    beats: [
      { at: 0, cap: 'A forecast is 4,000 simulated futures. Here are 40 of each, for the same day, and the count that happened.' },
      { at: 3, cap: 'Accuracy: how far, on average, a simulation lands from what happened. Smaller is better.', eq: '\\E_F\\lvert Y-y\\rvert\\approx\\frac1S\\sum_{s=1}^{S}\\lvert y^{(s)}-y\\rvert' },
      { at: 6.5, cap: 'Spread: half the average gap between two simulations. It is subtracted, so honest uncertainty earns some credit back.', eq: '\\tfrac12\\E_F\\lvert Y-Y\'\\rvert\\approx\\frac{1}{2S^2}\\sum_{s,s\'}\\lvert y^{(s)}-y^{(s\')}\\rvert' },
      { at: 9.5, cap: () => { const d = DM(); if (!d) return ''; const e = d.ex; return `CRPS is accuracy minus spread, in cases. The narrow Viral-Load forecast missed, and narrowness does not buy that back: ${fmt(e.V.crps, 1)} against ${fmt(e.C.crps, 1)}.`; } },
      { at: 12.5, cap: () => { const d = DM(); if (!d) return ''; const e = d.ex; return `A single number has no spread, so its CRPS is just the absolute error: the Cases-Only median alone scores ${fmt(e.pointC, 0)}, worse than the full forecast\u2019s ${fmt(e.C.crps, 1)}.`; }, eq: '\\mathrm{CRPS}(\\delta_{\\hat m},y)=\\lvert\\hat m-y\\rvert' },
    ],
    drawer: `<p><b>Why the two forms agree.</b> For indicators \\(u,v,w\\in\\{0,1\\}\\), \\((u-w)(v-w)=\\tfrac12\\{(u-w)^2+(v-w)^2-(u-v)^2\\}\\). Put \\(u=\\mathbb I(Y\\le z)\\), \\(v=\\mathbb I(Y'\\le z)\\), \\(w=\\mathbb I(y\\le z)\\) with \\(Y,Y'\\) independent from \\(F\\); then \\(\\E[(u-w)(v-w)]=\\{F(z)-\\mathbb I(y\\le z)\\}^2\\), and \\(\\int\\lvert\\mathbb I(a\\le z)-\\mathbb I(b\\le z)\\rvert dz=\\lvert a-b\\rvert\\). Integrating over \\(z\\):</p>
\\[\\begin{aligned}\\mathrm{CRPS}(F,y)&=\\int_{\\mathbb R}\\{F(z)-\\mathbb I(y\\le z)\\}^2dz\\\\&=\\E_F\\lvert Y-y\\rvert-\\tfrac12\\E_F\\lvert Y-Y'\\rvert\\end{aligned}\\]
<ul>
<li><b>Estimator.</b> Both expectations are replaced by averages over the \\(S=4{,}000\\) draws (main.tex:2162-2163). With sorted draws \\(y_{(1)}\\le\\dots\\le y_{(S)}\\) the pair term is \\(\\frac{2}{S^2}\\sum_i(i-\\tfrac12)y_{(i)}-\\bar y\\), an \\(O(S\\log S)\\) sum (code: <code>preq_age_crps_sample</code>, identical to <code>scoringRules::crps_sample</code>).</li>
<li><b>Accuracy and sharpness together.</b> The spread term can never exceed the accuracy term (\\(\\lvert Y-Y'\\rvert\\le\\lvert Y-y\\rvert+\\lvert Y'-y\\rvert\\)), so CRPS \\(\\ge0\\). Widening a forecast raises both terms, so it lowers the CRPS only when the gain in spread outweighs the extra distance; for one observation the best width is luck, and propriety concerns the average over many.</li>
<li><b>Point forecast.</b> If every draw equals \\(\\hat m\\), the spread is 0 and \\(\\mathrm{CRPS}=\\lvert\\hat m-y\\rvert\\) (main.tex:2164-2165): CRPS generalises the absolute error and is in the data's units, so Brazil and Ottawa scores are not comparable.</li>
<li><b>This example.</b> Ottawa, IGP (HSGP), origin \\(N=240\\) (last training day 25-03-2021), all-age cases on 04-04-2021, observed 152; both fits pass the convergence screen. Totals are summed over ages inside each draw. Cases-Only: median 128, \\(\\E\\lvert Y-y\\rvert=47.3\\), spread 31.1, CRPS 16.2. Viral-Load: median 85, 63.8, 18.1, 45.7. The exporter recomputes CRPS from the draws and asserts it equals the stored score.</li>
</ul>`,
    flags: ['One origin for illustration. It is the counter-example origin of S21: here viral load loses; at 14-01-2021 it wins. Pooled results are in S24.', 'The 40 dots are every 100th stored draw; all numbers use the 4,000 draws.'],
    source: 'main.tex:2157-2165; results/age_strat/gp_preq2/reports/gp_preq2_pilot_20261002/lab{3,4}/folds/ottawa_hsgp_mgp_{C,VLC}_N240/preq2_extras.rds; compiled_grid/scores_cells.csv',
    alt: 'Two strips of forecast draws, blue and orange, with the observed count as a vertical line; lines from draws to the observation, arcs between pairs of draws, then bars showing accuracy minus spread equals CRPS for each forecast and for a point forecast.',
    draw(t, ctx, D) {
      const d = DM(); if (!d) return missing(D); const e = d.ex, C = FB.C;
      legend(D, C);
      D.text(exLabel(e), 400, 96, { size: 26, color: C.ink2, align: 'center' });
      const box = { x: 100, y: 130, w: 640, h: 270 }, xmax = 300;
      const X = v => box.x + Math.min(v, xmax) / xmax * box.w;
      D.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: C.axis, width: 1.5 });
      for (const v of [0, 100, 200, 300]) D.text(String(v), X(v), box.y + box.h + 34, { size: 26, color: C.muted, align: 'center' });
      D.text('cases on ' + U.fmtDate(e.target), box.x + box.w, box.y + box.h + 68, { size: 26, color: C.ink2, align: 'right' });
      const rows = [['C', 205, C.cases, 'Cases-Only'], ['V', 330, C.vl, 'Viral-Load']], xo = X(e.y);
      const a0 = ease(seg(t, 0, 2));
      D.line([[xo, box.y - 2], [xo, box.y + box.h]], { color: C.ink, width: 3, alpha: a0 });
      D.text(`Observed ${e.y}`, xo + 10, box.y + 14, { size: 26, color: C.ink, weight: 600, alpha: a0 });
      const acc = seg(t, 3, 5.5), spr = seg(t, 6.5, 8.6), dim = 1 - .6 * seg(t, 9.5, 10.2);
      for (const [k, yc, col, nm] of rows) {
        const s = e[k].show;
        D.text(nm, 20, yc + 9, { size: 26, color: col, weight: 600, alpha: a0 });
        s.forEach((v, i) => {
          const u = ease(clamp(seg(t, 0, 2.4) * 1.6 - i * .015)); if (u <= 0) return;
          const x = X(v), y = yc + jit(i);
          if (acc > 0) D.line([[x, y], [lerp(x, xo, ease(clamp(acc * 1.5 - i * .012))), y]], { color: col, width: 1.5, alpha: .45 * dim * (1 - .7 * spr) });
          D.dot(x, y, 6, { color: col, alpha: u * (1 - .3 * spr) });
        });
        if (spr > 0) for (let i = 0; i < 20; i++) {
          const p = ease(clamp(spr * 1.6 - i * .03)); if (p <= 0) continue;
          const a = X(s[i]), b = X(s[i + 20]), lo = Math.min(a, b), hi = Math.max(a, b);
          arc(D, lo, lo + (hi - lo) * p, yc + (k === 'C' ? -28 : 28), (k === 'C' ? 1 : -1) * Math.min(38, 8 + (hi - lo) * .25), { color: col, width: 2, alpha: .7 * dim });
        }
      }
      // bars: accuracy, spread, CRPS (cases)
      const px = 6.6, x0 = 290;
      const bar = (lab, col, A, H, yy, aIn) => {
        if (aIn <= 0) return;
        D.group(aIn, () => {
          D.text(lab, 40, yy + 22, { size: 26, color: col === C.ink ? C.ink : col, weight: 600 });
          const sh = ease(seg(t, 6.8, 8.8)), cut = ease(seg(t, 9.6, 11.2));
          D.rect(x0, yy, A * px, 30, { color: col, alpha: .22, r: 4, stroke: col });
          if (H > 0 && sh > 0) D.rect(x0 + (A - H) * px, yy, H * px * sh, 30, { color: C.surface, alpha: .85 * cut, r: 0 });
          if (H > 0 && sh > 0) D.line([[x0 + (A - H) * px, yy - 6], [x0 + (A - H) * px, yy + 36]], { color: C.ink, width: 2, dash: [5, 5], alpha: sh });
          if (cut > 0) D.rect(x0, yy, (A - H) * px, 30, { color: col, alpha: cut, r: 4 });
          const txt = cut > .5 ? `${fmt(A, 1)} ${MINUS} ${fmt(H, H ? 1 : 0)} = ${fmt(A - H, 1)}` : (sh > 0 && H > 0 ? `${fmt(A, 1)} ${MINUS} ${fmt(H, 1)}` : fmt(A, 1));
          D.text(txt, x0, yy + 66, { size: 28, color: C.ink, weight: 650 });
        });
      };
      const ab = seg(t, 3.4, 4.4);
      G(D, ab, () => D.text('Accuracy \u2212 spread = CRPS (cases)', 40, 505, { size: 26, color: C.ink2 }));
      bar('Cases-Only', C.cases, e.C.acc, e.C.half, 530, ab);
      bar('Viral-Load', C.vl, e.V.acc, e.V.half, 625, ab);
      const pa = seg(t, 12.5, 13.3);
      bar('Median only', C.ink, e.pointC, 0, 720, pa);
      if (pa > 0) { const xm = X(e.C.q50); D.group(pa, () => { D.line([[xm, 172], [xm, 238]], { color: C.ink, width: 4 }); D.text(`median ${fmt(e.C.q50)}`, xm - 10, 255, { size: 26, color: C.ink, align: 'right', weight: 600 }); }); }
      G(D, seg(t, 1.5, 2.5), () => D.text('40 of 4,000 draws shown; numbers use all 4,000', 400, 862, { size: 26, color: C.muted, align: 'center' }));
    },
  });

  /* ------------------------------------------------------------------ S21c: log score */
  FB.scene({
    id: 'S21c', after: 'S21', part: 'Evaluation', title: 'The log score: how much probability landed on what happened', dur: 15,
    tags: [DEEP, ONE, { text: 'Hypothetical counts (illustration)', cls: 'synthetic' }],
    eq: '\\mathrm{LogS}(F,y)=\\log p_F(y)',
    beats: [
      { at: 0, cap: 'Smooth each forecast\u2019s 4,000 simulations into a curve: the probability of each count.', eq: '\\begin{aligned}\\widehat p_F(y)&=\\frac1S\\sum_{s=1}^{S}\\frac1b\\,\\varphi\\Bigl(\\frac{y-y^{(s)}}{b}\\Bigr)\\end{aligned}' },
      { at: 3, cap: () => { const d = DM(); if (!d) return ''; const e = d.ex; return `The log score is the log of the curve\u2019s height at what happened: ${fmt(e.C.logs, 2)} against ${fmt(e.V.logs, 2)}. Larger, closer to zero, is better.`; } },
      { at: 6.5, cap: 'What if the count had been somewhere else? Slide a hypothetical count along the Viral-Load forecast: CRPS grows steadily with the distance; the log score collapses where the forecast put almost nothing, as below its smallest draw.' },
      { at: 10.5, cap: () => { const d = DM(); if (!d) return ''; const e = d.ex; return `The same miss, two verdicts: CRPS says ${fmt(e.crpsRatio, 1)} times worse; the log score says 152 was ${fmt(e.probRatio, 1)} times less probable (${fmt(-e.logsDiff, 2)} lower).`; }, eq: '\\Delta\\mathrm{LogS}=\\log\\dfrac{p_{F_1}(y)}{p_{F_2}(y)}' },
      { at: 13, cap: 'CRPS: in cases, smaller is better. Log score: in log units, larger is better.' },
    ],
    drawer: `<ul>
<li><b>Definition.</b> \\(\\mathrm{LogS}(F,y)=\\log p_F(y)\\), larger is better; strictly proper and <i>local</i>: it depends on \\(F\\) only through the density at the observed value (main.tex:2166-2168).</li>
<li><b>Estimator.</b> \\(p_F\\) has no closed form, so it is a Gaussian kernel density estimate of the draws at \\(y\\) (main.tex:2168-2170):
\\[\\widehat{\\mathrm{LogS}}=\\log\\Bigl\\{\\frac1S\\sum_{s}\\frac1b\\,\\varphi\\Bigl(\\frac{y-y^{(s)}}{b}\\Bigr)\\Bigr\\}\\]
with \\(b=\\max(0.9\\min(\\hat\\sigma,\\mathrm{IQR}/1.34)S^{-1/5},\\,0.5)\\) (Silverman's rule, <code>bw.nrd0</code>). Here \\(b=8.7\\) (Cases-Only) and 5.1 (Viral-Load). The exporter recomputes both scores from the draws and matches the stored values.</li>
<li><b>Tail sensitivity.</b> A forecast that puts almost no mass at \\(y\\) gets \\(\\log p\\to-\\infty\\); CRPS instead grows like \\(\\lvert y-\\hat m\\rvert\\). One confident miss can dominate an average log score (main.tex:2170-2171).</li>
<li><b>Link to the likelihood.</b> Summed over one-step-ahead forecasts, the log score is the log marginal likelihood (prequential principle; main.tex:2167-2168).</li>
<li><b>Units.</b> A difference of 1.21 means the observed count was \\(e^{1.21}\\approx3.4\\) times less probable under one forecast; it has no case units, unlike CRPS.</li>
</ul>`,
    flags: ['The stored log scores come from the Gaussian-kernel fallback in <code>preq_age_log_score_sample</code> (bandwidth <code>bw.nrd0</code>, at least 0.5), not from <code>scoringRules::logs_sample</code>, which uses <code>bw.nrd</code> and returns the negative log density. The paper\u2019s description (Gaussian KDE, larger is better) matches the stored values.', 'Beyond the range of the draws (here below 24) the estimated log score falls with the Gaussian kernel\u2019s tail, so its steepness there is partly a property of the estimator.', 'The sliding count is hypothetical; only 152 was observed. One origin for illustration (S21\u2019s counter-example).'],
    source: 'main.tex:2166-2171; code/R/inference/exp/age_strat_prequential_report.R:145-167; preq2_extras.rds (Ottawa IGP N=240); compiled_grid/scores_cells.csv',
    alt: 'Two smoothed forecast densities, blue and orange, with the observed count; dots mark the height at the observation. A hypothetical count slides along the axis while two panels trace CRPS rising linearly and the log score falling.',
    draw(t, ctx, D) {
      const d = DM(); if (!d) return missing(D); const e = d.ex, C = FB.C;
      legend(D, C);
      D.text(exLabel(e), 400, 96, { size: 26, color: C.ink2, align: 'center' });
      const box = { x: 80, y: 165, w: 660, h: 190 };
      const [g0, g1, gs] = e.grid, ymax = Math.max(...e.C.dens, ...e.V.dens) * 1.08;
      const X = v => box.x + (v - g0) / (g1 - g0) * box.w, Y = v => box.y + box.h - v / ymax * box.h;
      D.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: C.axis, width: 1.5 });
      for (const v of [0, 100, 200, 300]) D.text(String(v), X(v), box.y + box.h + 34, { size: 26, color: C.muted, align: 'center' });
      D.text('probability of each count', box.x, box.y - 14, { size: 26, color: C.ink2 });
      const a0 = ease(seg(t, 0, 2.2));
      for (const [k, col] of [['C', C.cases], ['V', C.vl]]) {
        const pts = e[k].dens.map((v, i) => [X(g0 + i * gs), Y(v)]);
        const p = D.partial(pts, a0);
        D.band(p.map(([x]) => [x, Y(0)]), p, { color: col, alpha: .14 });
        D.line(p, { color: col, width: 3.5 });
      }
      const xo = X(e.y);
      D.line([[xo, box.y + box.h], [xo, box.y]], { color: C.ink, width: 2.5, alpha: a0 });
      D.text(`Observed ${e.y}`, xo + 10, box.y + 20, { size: 26, color: C.ink, weight: 600, alpha: a0 });
      // heights at y
      const h = seg(t, 3, 4.2);
      if (h > 0) for (const [k, col, dy] of [['C', C.cases, -8], ['V', C.vl, 30]]) {
        const yy = Y(Math.exp(e[k].logs));
        D.group(h, () => { D.line([[xo, yy], [X(330), yy]], { color: col, width: 1.5, dash: [5, 5] }); D.dot(xo, yy, 9, { color: col, ring: true });
          D.text(`log p = ${fmt(e[k].logs, 2)}`, X(340), yy - 10, { size: 26, color: col, weight: 700, align: 'right' }); });
      }
      // counterfactual sweep for the Viral-Load forecast
      const sw = seg(t, 6.5, 10.2), pa = seg(t, 6, 6.8);
      if (pa > 0) {
        const [s0, s1, ss] = e.sweep, n = e.V.sweepCrps.length;
        const yq = lerp(s0, s1, ease(sw)), iq = Math.round((yq - s0) / ss);
        D.group(pa, () => {
          if (sw > 0 && sw < 1) D.line([[X(yq), box.y + box.h], [X(yq), box.y]], { color: C.vl, width: 2, dash: [6, 6] });
          const panels = [
            { key: 'sweepCrps', nm: 'CRPS if the count were y\u2032', x: 80, lo: 0, hi: Math.ceil(Math.max(...e.V.sweepCrps) / 50) * 50, ticks: [0, 100, 200], real: e.V.crps, dir: '\u2193 better' },
            { key: 'sweepLogs', nm: 'LogS if the count were y\u2032', x: 470, lo: -22, hi: 0, ticks: [-20, -10, 0], real: e.V.logs, dir: '\u2191 better' },
          ];
          for (const P of panels) {
            const b = { x: P.x, y: 475, w: 260, h: 170 };
            const XX = v => b.x + (v - s0) / (s1 - s0) * b.w, YY = v => b.y + b.h - (v - P.lo) / (P.hi - P.lo) * b.h;
            D.text(P.nm, b.x - 30, 446, { size: 26, color: C.ink, weight: 600 });
            for (const v of P.ticks) { D.line([[b.x, YY(v)], [b.x + b.w, YY(v)]], { color: C.grid, width: 1 }); D.text(fmt(v), b.x - 8, YY(v) + 9, { size: 26, color: C.muted, align: 'right' }); }
            D.line([[b.x, b.y + b.h], [b.x + b.w, b.y + b.h]], { color: C.axis, width: 1.5 });
            for (const v of [0, 150, 300]) D.text(String(v), XX(v), b.y + b.h + 32, { size: 26, color: C.muted, align: 'center' });
            // below every draw
            D.rect(XX(s0), b.y, XX(e.V.min) - XX(s0), b.h, { color: C.ink, alpha: .07, r: 0 });
            const arr = e.V[P.key], pts = arr.map((v, i) => [XX(s0 + i * ss), YY(Math.max(P.lo, v))]).slice(0, Math.max(2, iq + 1));
            clip(ctx, { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 }, () => D.line(pts, { color: C.vl, width: 3.5 }));
            if (sw > 0) { const v = arr[Math.min(n - 1, iq)]; D.dot(XX(yq), YY(Math.max(P.lo, v)), 7, { color: C.vl }); }
            if (sw >= 1 || iq * ss >= e.y) { D.dot(XX(e.y), YY(P.real), 9, { color: C.ink, ring: true }); }
            D.text(P.dir, b.x + b.w, b.y + b.h + 66, { size: 26, color: C.muted, align: 'right' });
          }
          D.text('white dot: 152, what happened \u00b7 shaded: below every draw', 400, 752, { size: 26, color: C.muted, align: 'center' });
        });
      }
      // verdict card
      const vc = seg(t, 10.5, 11.5);
      G(D, vc, () => {
        D.rect(30, 784, 740, 108, { color: C.ink, alpha: .06, r: 12 });
        D.text(`CRPS ${fmt(e.V.crps, 1)} vs ${fmt(e.C.crps, 1)}: ${fmt(e.crpsRatio, 1)}\u00d7 worse (\u2193 better, cases)`, 50, 826, { size: 28, color: C.ink, weight: 650 });
        D.text(`LogS ${fmt(e.logsDiff, 2)}: 152 was ${fmt(e.probRatio, 1)}\u00d7 less probable (\u2191 better)`, 50, 870, { size: 28, color: C.ink, weight: 650 });
      });
    },
  });

  /* ------------------------------------------------------------------ S21d: point errors */
  FB.scene({
    id: 'S21d', after: 'S21', part: 'Evaluation', title: 'Point errors: MAE, RMSE and where squared error comes from', dur: 15,
    tags: [DEEP, PROV],
    eq: '\\begin{aligned}\\mathrm{MSE}&=\\frac{1}{\\lvert\\mathcal S\\rvert}\\sum_{i\\in\\mathcal S}e_i^{2}\\\\&=\\underbrace{\\bar e^{2}}_{\\text{squared bias}}+\\underbrace{\\frac{1}{\\lvert\\mathcal S\\rvert}\\sum_{i\\in\\mathcal S}(e_i-\\bar e)^{2}}_{\\text{error variance}}\\end{aligned}',
    beats: [
      { at: 0, cap: 'Each dot is one second-week forecast error, the forecast mean minus what happened: Ottawa, IGP, 21 origins \u00d7 7 days.', eq: 'e_i=\\bar y_i-y_i' },
      { at: 3.5, cap: () => { const d = DM(); if (!d) return ''; const c = d.pe.cells['ottawa|IGP|I=C']; return `MAE averages the distances; MSE squares them, so the largest errors dominate: the ${c.top} largest of ${c.n} carry ${fmt(100 * c.topShare, 0)}% of the MSE.`; }, eq: '\\begin{aligned}\\mathrm{MAE}&=\\frac{1}{\\lvert\\mathcal S\\rvert}\\sum_{i\\in\\mathcal S}\\lvert\\hat m_i-y_i\\rvert\\\\\\mathrm{RMSE}&=\\sqrt{\\mathrm{MSE}}\\end{aligned}' },
      { at: 7, cap: () => { const d = DM(); if (!d) return ''; const c = d.pe.cells['ottawa|IGP|I=C']; return `The average error is the bias: Cases-Only forecasts are ${fmt(c.ebar, 0)} cases too high on average. MSE = squared bias + scatter around it.`; } },
      { at: 10.5, cap: () => { const d = DM(); if (!d) return ''; return `With viral load the bias almost vanishes, yet it explains only ${fmt(100 * d.pe.shares['ottawa|IGP'], 0)}% of the drop in MSE; most is less scatter. In Brazil the bias explains ${fmt(100 * d.pe.shares['brazil|IGP'], 0)}%.`; } },
      { at: 13, cap: 'Error variance is spread across forecasts, not the width of any one forecast.' },
    ],
    drawer: `<ul>
<li><b>What they score.</b> The absolute error of the predictive median \\(\\hat m\\) and the squared error of the predictive mean \\(\\bar y\\) are consistent scoring functions for the median and the mean; they judge one summary of \\(F\\), not the whole distribution (main.tex:2172-2175).</li>
<li><b>Decomposition.</b> With \\(e_i=\\bar y_i-y_i\\) and \\(\\bar e=\\lvert\\mathcal S\\rvert^{-1}\\sum_ie_i\\), expanding \\(e_i=\\bar e+(e_i-\\bar e)\\) and using \\(\\sum_i(e_i-\\bar e)=0\\) gives \\(\\mathrm{MSE}=\\bar e^2+\\lvert\\mathcal S\\rvert^{-1}\\sum_i(e_i-\\bar e)^2\\) (main.tex:2176-2186). The second term is the variance of errors across forecasts, not predictive variance; it does not decompose the CRPS (results_preq2_main.tex:265-266).</li>
<li><b>Ottawa IGP, days 8-14</b> (\\(\\lvert\\mathcal S\\rvert=147\\)): Cases-Only MSE \\(1{,}908.42+8{,}627.16=10{,}535.58\\); Viral-Load \\(0.29+3{,}305.46=3{,}305.75\\). Share of the drop from bias: \\((1{,}908.42-0.29)/(10{,}535.58-3{,}305.75)=26\\%\\).</li>
<li><b>Brazil IGP, days 8-14</b> (\\(\\lvert\\mathcal S\\rvert=119\\)): MSE 655.94 \\(\\to\\) 442.36 million, squared bias 187.80 \\(\\to\\) 31.02 million: 73% of the drop (results_preq2_main.tex:254-262). ExGP: 66% (Brazil), 20% (Ottawa).</li>
<li><b>MAE vs RMSE.</b> Over horizons 1-14 the RMSE falls 13% (Brazil) and 29-40% (Ottawa), more than the MAE (3-4%, 20-23%): \u201cthe signal mainly removes large errors\u201d (results_preq2_main.tex:238-241).</li>
</ul>
<p>Errors are reconstructed from <code>scores_cells.csv</code> and asserted equal to the paper's block table (<code>scores_common_origins.csv</code>).</p>`,
    figure: { src: 'figures/metrics_scores_plot_ottawa.webp', caption: 'Paper figure: forecast scores, Ottawa, including MAE, MSE, squared bias and error variance by class (results_preq2_appendix.tex:378), paper colours.', alt: 'Paper panel of Ottawa forecast scores by metric and class' },
    flags: ['Pooled scores include fits that fail the convergence screen: of the 21 Ottawa IGP origins, 15 (Cases-Only) and 9 (Viral-Load) fits pass (scores_common_origins.csv, K_valid).', 'The paper prints the Ottawa Cases-Only MSE as 10,535.60 (results_preq2_main.tex:255); the table value is 10,535.58. Rounding only.', 'Dots: forecast-mean errors for the 21 common Ottawa origins and horizons 8-14; MAE uses the median, so it is not the mean of these dots\u2019 absolute values.'],
    source: 'main.tex:2172-2186; results_preq2_main.tex:236-266; compiled_grid/scores_cells.csv; outputs/paper_results_preq2/scores_common_origins.csv',
    alt: 'Two strips of forecast errors, blue for cases-only and orange for viral load; the largest errors are ringed, a dashed line marks the mean error, and stacked bars split each MSE into squared bias and scatter.',
    draw(t, ctx, D) {
      const d = DM(); if (!d) return missing(D); const C = FB.C, P = d.pe.cells, c = P['ottawa|IGP|I=C'], v = P['ottawa|IGP|I=VL+C'];
      legend(D, C);
      D.text('Ottawa, IGP, days 8\u201314 ahead, 147 forecasts', 400, 96, { size: 26, color: C.ink2, align: 'center' });
      const box = { x: 90, y: 130, w: 650, h: 260 }, lo = -250, hi = 450;
      const X = x => box.x + (x - lo) / (hi - lo) * box.w;
      D.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: C.axis, width: 1.5 });
      for (const x of [-200, 0, 200, 400]) D.text(fmt(x), X(x), box.y + box.h + 34, { size: 26, color: C.muted, align: 'center' });
      D.text('error, cases (forecast too high \u2192)', box.x + box.w, box.y + box.h + 68, { size: 26, color: C.ink2, align: 'right' });
      D.line([[X(0), box.y], [X(0), box.y + box.h]], { color: C.grid, width: 2 });
      const top = arr => { const ix = arr.map((x, i) => [Math.abs(x), i]).sort((a, b) => b[0] - a[0]).slice(0, c.top).map(p => p[1]); return new Set(ix); };
      const strip = (r, col, yc, a, name) => {
        if (a <= 0) return; const tp = top(r.e), ring = seg(t, 3.8, 4.8);
        D.group(a, () => {
          D.text(name, box.x + box.w, yc - 52, { size: 26, color: col, weight: 600, align: 'right' });
          r.e.forEach((x, i) => { const u = clamp(a * 1.5 - i / r.e.length * .5); const y = yc + (((i * 53) % 17) - 8) * 4.4;
            D.dot(X(x), y, 5, { color: col, alpha: .8 * u }); if (tp.has(i) && ring > 0) D.circle(X(x), y, 11, { color: C.ink, width: 2.5, alpha: ring }); });
          const mb = seg(t, 7.2, 8.2) * (name === 'Cases-Only' ? 1 : seg(t, 10.6, 11.4));
          if (mb > 0) { D.line([[X(r.ebar), yc - 44], [X(r.ebar), yc + 44]], { color: C.ink, width: 3, dash: [7, 5], alpha: mb });
            D.text(`\u0113 = ${sfmt(r.ebar, 1)}`, X(r.ebar) + 10, yc + 46, { size: 26, color: C.ink, weight: 650, alpha: mb }); }
        });
      };
      strip(c, C.cases, 205, ease(seg(t, 0, 2)), 'Cases-Only');
      strip(v, C.vl, 325, ease(seg(t, 10.5, 11.5)), 'Viral-Load');
      // MAE / RMSE line
      const m = seg(t, 4, 5);
      G(D, m, () => {
        D.text('MAE', 60, 500, { size: 26, color: C.ink2 }); D.text('RMSE', 290, 500, { size: 26, color: C.ink2 });
        const sv = seg(t, 10.5, 11.5);
        D.text(fmt(c.mae, 1) + (sv > 0 ? ` \u2192 ${fmt(v.mae, 1)}` : ''), 60, 538, { size: 30, color: C.ink, weight: 700 });
        D.text(fmt(c.rmse, 1) + (sv > 0 ? ` \u2192 ${fmt(v.rmse, 1)}` : ''), 290, 538, { size: 30, color: C.ink, weight: 700 });
        D.text(`${c.top} largest errors (ringed): ${fmt(100 * c.topShare, 0)}% of Cases-Only MSE`, 520, 500, { size: 26, color: C.muted, maxW: 260 });
      });
      // stacked bars
      const sc = 620 / 11000, x0 = 60;
      const stack = (r, col, yy, a, name) => {
        if (a <= 0) return; const sp = ease(seg(t, 8, 9.5));
        D.group(a, () => {
          D.text(name, x0, yy - 12, { size: 26, color: col, weight: 600 });
          const wb = r.bias2 * sc, wv = r.var * sc * sp;
          D.rect(x0, yy, Math.max(wb, 3), 30, { color: C.ink, r: 3 });
          D.rect(x0 + wb, yy, wv, 30, { color: col, alpha: .55, r: 3 });
          D.text(`${fmt(r.bias2, 2)} + ${fmt(r.var, 2)} = ${fmt(r.mse, 2)}`, x0, yy + 62, { size: 28, color: C.ink, weight: 650 });
        });
      };
      const sa = seg(t, 7.5, 8.3);
      G(D, sa, () => { D.text('MSE = squared bias (white) + scatter', x0, 596, { size: 26, color: C.ink2 }); });
      const dec = r => ({ bias2: r.dec[0], var: r.dec[1], mse: r.dec[2] });
      stack(dec(c), C.cases, 644, sa, 'Cases-Only');
      stack(dec(v), C.vl, 750, seg(t, 11, 11.8), 'Viral-Load');
      G(D, seg(t, 12, 12.8), () => D.text(`Brazil IGP: ${fmt(P['brazil|IGP|I=C'].mse / 1e6, 1)} \u2192 ${fmt(P['brazil|IGP|I=VL+C'].mse / 1e6, 1)} million; bias share ${fmt(100 * d.pe.shares['brazil|IGP'], 0)}%`, 400, 852, { size: 26, color: C.muted, align: 'center' }));
      G(D, seg(t, 13, 13.8), () => D.text('Scatter = spread of errors across forecasts', 400, 890, { size: 26, color: C.ink2, align: 'center' }));
    },
  });

  /* ------------------------------------------------------------------ S21e: coverage */
  FB.scene({
    id: 'S21e', after: 'S21', part: 'Evaluation', title: 'Coverage: a diagnostic, not a score', dur: 12,
    tags: [DEEP, ONE, { text: 'Widened forecast is synthetic', cls: 'synthetic' }],
    eq: '\\begin{aligned}h_i&=\\mathbb I\\{q_{0.05,i}\\le y_i\\le q_{0.95,i}\\}\\\\\\text{error}&=0.9-c_{0.9}\\end{aligned}',
    beats: [
      { at: 0, cap: 'A 90% forecast interval either contains what happened or not. Here both real forecasts contain 152: two hits.' },
      { at: 3.5, cap: () => { const d = DM(); if (!d) return ''; const e = d.ex; return `Coverage cannot tell them apart; CRPS can: ${fmt(e.C.crps, 1)} against ${fmt(e.V.crps, 1)}.`; } },
      { at: 6.5, cap: () => { const d = DM(); if (!d) return ''; const s = d.ex.C.stretch[2]; return `Make the Cases-Only forecast twice as wide: still a hit, but its CRPS rises to ${fmt(s[1], 1)}. \u201cA forecast can be well covered and uselessly wide.\u201d`; }, eq: '\\tilde y^{(s)}=\\hat m+k\\,(y^{(s)}-\\hat m),\\quad k=2' },
      { at: 9.5, cap: 'So coverage is read as a rate over many forecasts, next to a proper score. The paper\u2019s rates fall short of 90% (scene 28).' },
    ],
    drawer: `<ul>
<li><b>Definition.</b> \\(c_{0.9}=\\lvert\\mathcal S\\rvert^{-1}\\sum_{i\\in\\mathcal S}\\mathbb I\\{q_{0.05,i}\\le y_i\\le q_{0.95,i}\\}\\) and the coverage error \\(0.9-c_{0.9}\\) (main.tex:2187-2190).</li>
<li><b>Not proper.</b> Any forecast wide enough scores a hit every time, so coverage can be maximised without knowing anything; \u201ca forecast can be well covered and uselessly wide\u201d (main.tex:2190-2191). It diagnoses calibration of one feature (the central 90% interval) and is read next to the CRPS, which judges the whole distribution (discussion.tex:102-105).</li>
<li><b>Link to CRPS.</b> CRPS equals twice the integral over \\(\\alpha\\in(0,1)\\) of the quantile (pinball) loss, so it rewards correct quantiles at every level, not only at 5% and 95%.</li>
<li><b>This example</b> (Ottawa IGP, origin 25-03-2021, 04-04-2021, observed 152). Cases-Only interval 66-248, CRPS 16.2; Viral-Load 47-155, CRPS 45.7 (a hit by three cases). The doubled interval (4-368) stretches the real Cases-Only draws about their median, \\(k=2\\); it is synthetic.</li>
<li><b>Results.</b> \u201cFor SGP-AI, IGP and ExGP, empirical coverage of nominal 90% case intervals is 0.70--0.89 in Brazil and 0.72--0.90 in Ottawa\u201d (results_preq2_main.tex:517-519); see scene 28 for causes.</li>
</ul>`,
    flags: ['The 2\u00d7 widened forecast is a transformation of real draws for illustration; it was not fitted.', 'Single forecast: coverage is only meaningful as a rate over many forecasts (with 17 Brazil origins it moves in steps of 1/17; results_preq2_main.tex:533).'],
    source: 'main.tex:2187-2191; results_preq2_main.tex:513-537; preq2_extras.rds (Ottawa IGP N=240, h=10); compiled_grid/scores_cells.csv',
    alt: 'Three horizontal 90% intervals against the observed count: blue cases-only, orange viral-load, and a doubled blue interval; each carries a covers tick and its CRPS.',
    draw(t, ctx, D) {
      const d = DM(); if (!d) return missing(D); const e = d.ex, C = FB.C;
      legend(D, C);
      D.text(exLabel(e), 400, 96, { size: 26, color: C.ink2, align: 'center' });
      const box = { x: 70, y: 140, w: 670, h: 460 }, X = v => box.x + v / 400 * box.w;
      D.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: C.axis, width: 1.5 });
      for (const v of [0, 100, 200, 300, 400]) D.text(String(v), X(v), box.y + box.h + 34, { size: 26, color: C.muted, align: 'center' });
      D.text('cases on ' + U.fmtDate(e.target), box.x + box.w, box.y + box.h + 68, { size: 26, color: C.ink2, align: 'right' });
      const xo = X(e.y);
      D.line([[xo, box.y], [xo, box.y + box.h]], { color: C.ink, width: 1.5, dash: [4, 8], alpha: .5 });
      D.text(`Observed ${e.y}`, xo + 10, box.y + 4, { size: 26, color: C.ink, weight: 600 });
      const s2 = e.C.stretch[2];
      const rows = [
        { nm: 'Cases-Only, 90% interval', col: C.cases, lo: e.C.q05, hi: e.C.q95, m: e.C.q50, crps: e.C.crps, y: 230, a: ease(seg(t, 0, 1.4)) },
        { nm: 'Viral-Load, 90% interval', col: C.vl, lo: e.V.q05, hi: e.V.q95, m: e.V.q50, crps: e.V.crps, y: 370, a: ease(seg(t, .6, 2)) },
        { nm: 'Cases-Only, 2\u00d7 wider (illustration)', col: C.cases, lo: s2[2], hi: s2[3], m: e.C.q50, crps: s2[1], y: 510, a: ease(seg(t, 6.5, 7.8)), dash: true },
      ];
      const cr = seg(t, 3.5, 4.5);
      for (const r of rows) G(D, r.a, () => {
        D.text(`${r.nm}: ${fmt(r.lo)}\u2013${fmt(r.hi)}`, 70, r.y - 30, { size: 26, color: C.ink, weight: 600 });
        D.line([[X(r.lo), r.y], [X(r.hi), r.y]], { color: r.col, width: 12, alpha: r.dash ? .45 : .8 });
        for (const v of [r.lo, r.hi]) D.line([[X(v), r.y - 14], [X(v), r.y + 14]], { color: r.col, width: 3 });
        D.dot(X(r.m), r.y, 8, { color: C.ink });
        D.line([[xo, r.y - 22], [xo, r.y + 22]], { color: C.ink, width: 3 });
        D.badge('covers', 70, r.y + 56, true);
        if (cr > 0 || r.dash) D.text(`CRPS ${fmt(r.crps, 1)}`, 740, r.y + 56, { size: 30, color: r.col, weight: 700, align: 'right', alpha: r.dash ? 1 : cr });
      });
      G(D, seg(t, 9.5, 10.5), () => {
        D.rect(30, 760, 740, 120, { color: C.ink, alpha: .06, r: 12 });
        D.text('Over many forecasts, nominal 90% case intervals cover', 50, 800, { size: 26, color: C.ink2 });
        D.text('0.70\u20130.89 (Brazil) and 0.72\u20130.90 (Ottawa)', 50, 842, { size: 30, color: C.ink, weight: 700 });
        D.text('SGP-AI, IGP, ExGP; see scene 28', 50, 872, { size: 26, color: C.muted });
      });
    },
  });

  /* ------------------------------------------------------------------ S21f: WAIC */
  FB.scene({
    id: 'S21f', after: 'S21', part: 'Evaluation', title: 'WAIC: in-sample support, judged with a paired error bar', dur: 15,
    tags: [DEEP, { text: 'One cutoff; both fits pass the screen' }],
    eq: '\\begin{aligned}\\widehat{\\mathrm{elpd}}_{\\mathrm{WAIC}}&=\\sum_i\\log\\Bigl\\{\\frac1S\\sum_{s=1}^{S}p(y_i\\mid\\theta^{(s)})\\Bigr\\}\\\\&\\quad-\\sum_i\\mathrm{Var}_s\\bigl\\{\\log p(y_i\\mid\\theta^{(s)})\\bigr\\}\\end{aligned}',
    beats: [
      { at: 0, cap: 'WAIC asks how well a fitted model re-predicts each age-day point it was trained on: average the likelihood over posterior draws, then charge for how much the draws disagree.' },
      { at: 4, cap: 'Ottawa, IGP, trained to 22-08-2021, cases. The penalty acts like a count of effective parameters; WAIC is \u22122 times elpd.', eq: '\\mathrm{WAIC}=-2\\,\\widehat{\\mathrm{elpd}}_{\\mathrm{WAIC}}' },
      { at: 7, cap: () => { const d = DM(); if (!d) return ''; const w = d.waic.cases; return `Compare point by point and add up over time: viral load fits ${fmt(w.n)} points better by ${fmt(w.delta, 1)} in total.`; }, eq: '\\Delta\\widehat{\\mathrm{elpd}}=\\sum_{i=1}^{n}d_i,\\quad d_i=\\widehat{\\mathrm{elpd}}_i^{\\,\\mathrm{VL}+C}-\\widehat{\\mathrm{elpd}}_i^{\\,C}' },
      { at: 10, cap: () => { const d = DM(); if (!d) return ''; const w = d.waic.cases; return `Its paired standard error is ${fmt(w.se, 1)}, far below either model\u2019s own (${fmt(w.C.se, 0)}, ${fmt(w.VLC.se, 0)}): the same days are hard for both. ${fmt(w.z, 1)} SE from zero: clear.`; }, eq: '\\mathrm{SE}(\\Delta)=\\bigl\\{n\\,\\mathrm{Var}_i(d_i)\\bigr\\}^{1/2}' },
      { at: 12.5, cap: () => { const d = DM(); if (!d) return ''; const w = d.waic.deaths; return `For deaths the same fits differ by ${fmt(w.delta, 2)}: small. WAIC judges fit to seen days; forecasts are judged by the prequential scores.`; } },
    ],
    drawer: `<ul>
<li><b>Pieces</b> (main.tex:2112-2123). For each observation \\(i=(g,t)\\) and posterior draw \\(\\theta^{(s)}\\): \\(\\mathrm{lppd}_i=\\log\\{S^{-1}\\sum_sp(y_i\\mid\\theta^{(s)})\\}\\) and \\(p_i=\\mathrm{Var}_s\\log p(y_i\\mid\\theta^{(s)})\\); \\(\\widehat{\\mathrm{elpd}}_{\\mathrm{WAIC}}=\\sum_i(\\mathrm{lppd}_i-p_i)\\), \\(p_{\\mathrm{WAIC}}=\\sum_ip_i\\).</li>
<li><b>This example</b> (Ottawa IGP, HSGP, \\(N=390\\), 1,536 case points). Cases-Only: lppd \\(-4{,}838.3\\), \\(p_{\\mathrm{WAIC}}=60.9\\), elpd \\(-4{,}899.2\\), WAIC 9,798.5. Viral-Load: \\(-4{,}775.0\\), 78.3, \\(-4{,}853.3\\), 9,706.6. \\(\\Delta\\widehat{\\mathrm{elpd}}=45.95\\), paired SE 11.23, \\(\\Delta\\mathrm{WAIC}=-91.9\\). Deaths (1,428 points): \\(0.39\\) (SE 0.34).</li>
<li><b>Why paired.</b> \\(\\mathrm{Var}(A-B)=\\mathrm{Var}A+\\mathrm{Var}B-2\\mathrm{Cov}(A,B)\\): pointwise elpds of two models of the same data are strongly correlated, so the SE of the difference (11.2) is much smaller than \\(\\sqrt{53.1^2+50.1^2}\\approx73\\).</li>
<li><b>Thresholds</b> (main.tex:2125-2140). WAIC approaches AIC for regular models; the rule of thumb \\(\\lvert\\Delta\\mathrm{WAIC}\\rvert\\approx4\\) borrows \\(\\chi^2_1\\) (3.84) or \\(\\exp(\\Delta/2)\\approx7.4\\). Our models are non-nested, singular and serially dependent, so a difference is called clear only beyond 2 paired SE, and \\(\\lvert\\Delta\\widehat{\\mathrm{elpd}}\\rvert<4\\) (\\(\\lvert\\Delta\\mathrm{WAIC}\\rvert<8\\)) is small. The pointwise SE ignores serial dependence, so it understates uncertainty and errs towards declaring differences.</li>
<li><b>In-sample only.</b> \u201cWAIC estimates predictive accuracy for new observations at the same days \u2026 the prequential scores are the primary evidence for forecasting\u201d (main.tex:2142-2145).</li>
<li><b>Paper summaries</b> are medians over common cutoffs: case elpd gain 27 for Ottawa IGP (results_preq2_main.tex:273-275); \\(N=390\\) shown here is the reference cutoff, not the median.</li>
</ul>`,
    figure: { src: 'figures/metrics_vl_fit_pointwise.webp', caption: 'Paper figure: cumulative pointwise elpd difference, viral load minus cases only, Brazil N=360 and Ottawa N=390 (results_editorial_support.tex:79-81), paper colours.', alt: 'Cumulative pointwise elpd difference by class, dataset and outcome' },
    flags: (() => { const d = DM(); const w = d && d.waic.cases; return [
      `Some points have \\(p_i>0.4\\) (cases: ${w ? w.C.pBig : '\u2013'} Cases-Only, ${w ? w.VLC.pBig : '\u2013'} Viral-Load of 1,536), where the WAIC approximation is unreliable and PSIS-LOO is recommended (loo warning stored with the fit).`,
      'The first six days (cases) and 33 days (deaths) carry no likelihood term, so case points run from 04-08-2020 to 22-08-2021.',
      'Numbers are recomputed from the per-point files and asserted against waic_class.csv, waic_vl.csv and vl_pointwise_elpd.csv.']; })(),
    source: 'main.tex:2112-2145; results_preq2_main.tex:39-46, 273-279; lab{3,4}/folds/ottawa_hsgp_mgp_{C,VLC}_N390/waic_pointwise.csv; outputs/paper_results_preq2/waic_class.csv, waic_vl.csv, vl_pointwise_elpd.csv',
    alt: 'A ledger of lppd, penalty and elpd for both active sets, a rising cumulative pointwise elpd difference over training days, and error bars of two paired standard errors for cases (clear of zero) and deaths (near zero).',
    draw(t, ctx, D) {
      const d = DM(); if (!d) return missing(D); const w = d.waic, c = w.cases, C = FB.C;
      // beat 0: recipe card
      const r0 = 1 - seg(t, 3.6, 4.2);
      G(D, r0 * ease(seg(t, 0, 1)), () => {
        D.text('For each age-day point i:', 50, 70, { size: 28, color: C.ink, weight: 650 });
        const steps = [['1', 'likelihood of its count under each posterior draw'], ['2', 'average over draws, take the log: lppd'], ['3', 'variance of the log-likelihood over draws: p'], ['4', 'elpd = lppd \u2212 p; add over all points']];
        steps.forEach(([n, s], i) => { const a = seg(t, .4 + i * .7, 1 + i * .7); D.group(a, () => { D.circle(68, 120 + i * 52 - 9, 17, { color: C.ink2, width: 2 }); D.text(n, 68, 120 + i * 52, { size: 26, color: C.ink, align: 'center', weight: 700 }); D.text(s, 100, 120 + i * 52, { size: 28, color: C.ink }); }); });
      });
      // beat 1: ledger
      const la = seg(t, 4, 5);
      G(D, la, () => {
        D.label('Cases-Only', 470, 60, C.cases, { size: 26 }); D.label('Viral-Load', 660, 60, C.vl, { size: 26 });
        const rows = [['lppd', 'lppd', 0], ['\u2212 penalty p_WAIC', 'p', 1], ['= elpd_WAIC', 'elpd', 0], ['WAIC = \u22122 \u00d7 elpd', 'waic', 0]];
        rows.forEach(([lab, k, dp], i) => { const a = seg(t, 4.2 + i * .5, 4.8 + i * .5), y = 108 + i * 46;
          D.group(a, () => { D.text(lab, 40, y, { size: 28, color: i === 2 ? C.ink : C.ink2, weight: i === 2 ? 700 : 400 });
            D.text(fmt(c.C[k], dp), 570, y, { size: 30, color: C.cases, weight: 700, align: 'right' });
            D.text(fmt(c.VLC[k], dp), 760, y, { size: 30, color: C.vl, weight: 700, align: 'right' }); }); });
        D.text('Ottawa, IGP, N = 390, cases, 1,536 points', 40, 300, { size: 26, color: C.muted });
      });
      // beat 2: cumulative pointwise difference
      const ca = seg(t, 7, 7.8);
      G(D, ca, () => {
        const box = { x: 90, y: 350, w: 650, h: 150 }, n = c.cum.length;
        const X = i => box.x + i / (n - 1) * box.w, Y = v => box.y + box.h - (v + 5) / 60 * box.h;
        for (const v of [0, 25, 50]) { D.line([[box.x, Y(v)], [box.x + box.w, Y(v)]], { color: C.grid, width: 1 }); D.text(String(v), box.x - 8, Y(v) + 9, { size: 26, color: C.muted, align: 'right' }); }
        D.line([[box.x, Y(0)], [box.x + box.w, Y(0)]], { color: C.axis, width: 1.5 });
        D.text('running total of d, Viral-Load minus Cases-Only', box.x - 50, box.y - 16, { size: 26, color: C.ink2 });
        const pts = c.cum.map((v, i) => [X(i), Y(v)]), p = D.partial(pts, ease(seg(t, 7.2, 9.6)));
        D.line(p, { color: C.vl, width: 3.5 });
        D.text(dayOf(w.start, c.t0), box.x, box.y + box.h + 34, { size: 26, color: C.muted, align: 'left' });
        D.text(dayOf(w.start, c.t1), box.x + box.w, box.y + box.h + 34, { size: 26, color: C.muted, align: 'right' });
        const e2 = seg(t, 9.4, 10);
        if (e2 > 0) D.text(sfmt(c.delta, 2), X(n - 1) - 8, Y(c.cum[n - 1]) - 12, { size: 30, color: C.ink, weight: 700, align: 'right', alpha: e2 });
      });
      // beat 3/4: paired error bars
      const ea = seg(t, 10, 10.8);
      G(D, ea, () => {
        const lo = -10, hi = 70, bx = 200, bw = 540, X = v => bx + (v - lo) / (hi - lo) * bw, y0 = 665, y1 = 775;
        D.rect(X(-4), y0 - 45, X(4) - X(-4), y1 - y0 + 75, { color: C.ink, alpha: .08, r: 0 });
        D.text('shaded: |\u0394| < 4, small', 760, 592, { size: 26, color: C.muted, align: 'right' });
        D.line([[X(0), y0 - 45], [X(0), y1 + 30]], { color: C.axis, width: 1.5 });
        for (const v of [0, 20, 40, 60]) D.text(String(v), X(v), y1 + 80, { size: 26, color: C.muted, align: 'center' });
        D.text('\u0394 elpd \u00b1 2 paired SE', 40, 590, { size: 26, color: C.ink2 });
        const row = (lab, r, y, a, ok) => { if (a <= 0) return; D.group(a, () => {
          D.text(lab, 40, y + 9, { size: 28, color: C.ink, weight: 600 });
          D.line([[X(r.delta - 2 * r.se), y], [X(r.delta + 2 * r.se), y]], { color: C.ink, width: 4 });
          for (const v of [r.delta - 2 * r.se, r.delta + 2 * r.se]) D.line([[X(v), y - 12], [X(v), y + 12]], { color: C.ink, width: 3 });
          D.dot(X(r.delta), y, 10, { color: C.vl, ring: true });
          D.text(ok ? `${sfmt(r.delta, 2)} (SE ${fmt(r.se, 2)}): clear` : `${sfmt(r.delta, 2)} (SE ${fmt(r.se, 2)}): small`, ok ? X(r.delta - 2 * r.se) : X(r.delta) + 20, y - 24, { size: 26, color: ok ? C.good : C.muted, weight: 650 });
        }); };
        row('Cases', c, y0, 1, true);
        row('Deaths', w.deaths, y1, seg(t, 12.5, 13.3), false);
      });
    },
  });
})();
