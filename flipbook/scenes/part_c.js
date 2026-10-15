/* Flipbook Part C: scenes S20-S30 (evaluation design, results, discussion).
   Data: window.FLIPBOOK_DATA.c, written by scripts/flipbook/export_part_c.py. Storyboard: STORYBOARD.md Part C + Section 0. */
(function () {
  const U = FB.util, { clamp, lerp, ease, seg } = U;
  const DC = () => (window.FLIPBOOK_DATA && window.FLIPBOOK_DATA.c) || null;
  const PAPER = '../documents/ViralLoadPaperV3/';
  const PROV = { text: 'Provisional: some fits fail convergence' };
  const INTERIM = { text: 'Interim' };
  const RHAT = 'R-hat';
  const SYN = { text: 'Synthetic (illustration)', cls: 'synthetic' };
  const PLUG = { text: 'Plug-in medians', cls: 'plugin' };
  const CLASSES = ['SGP', 'SGP-AI', 'IGP', 'ExGP'];
  const ccol = k => ({ 'SGP': FB.C.sgp, 'SGP-AI': FB.C.sgpai, 'IGP': FB.C.igp, 'ExGP': FB.C.exgp })[k];
  const MINUS = '\u2212';
  // number formatting: thousands separators, typographic minus
  function fmt(x, d = 0) {
    if (x == null || !isFinite(x)) return '\u2013';
    const s = Math.abs(x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (x < 0 && +s.replace(/,/g, '') !== 0 ? MINUS : '') + s;
  }
  const sfmt = (x, d = 1) => (x > 0 ? '+' : '') + fmt(x, d);
  const pct = (x, d = 1) => sfmt(x, d) + '%';
  function dateOf(t1, t) { const d = new Date(t1 + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + t - 1); return U.fmtDate(d.toISOString().slice(0, 10)); }
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

  // Alpha-aware wrapper around the kit: every call multiplies its alpha by `a` (the engine kit sets alpha absolutely).
  function K(D, a = 1) {
    const al = o => Object.assign({}, o, { alpha: (o && o.alpha != null ? o.alpha : 1) * a });
    const k = {
      a,
      text: (s, x, y, o = {}) => D.text(s, x, y, al(o)),
      line: (p, o = {}) => D.line(p, al(o)),
      band: (lo, hi, o = {}) => D.band(lo, hi, Object.assign({}, o, { alpha: (o.alpha ?? .18) * a })),
      dot: (x, y, r, o = {}) => D.dot(x, y, r, al(o)),
      circle: (x, y, r, o = {}) => D.circle(x, y, r, al(o)),
      rect: (x, y, w, h, o = {}) => D.rect(x, y, w, h, al(o)),
      arrow: (x1, y1, x2, y2, o = {}) => D.arrow(x1, y1, x2, y2, al(o)),
      label(s, x, y, color, o = {}) { k.text(s, x, y, { size: o.size || 28, color: FB.C.ink, weight: 600, align: o.align || 'left' }); k.dot(o.align === 'right' ? x + 14 : x - 14, y - 9, 7, { color }); },
      badge(s, x, y, ok) { const col = ok ? FB.C.good : FB.C.critical; k.rect(x, y - 27, 32 + s.length * 13.5, 38, { color: col, alpha: .16, r: 19 }); k.text((ok ? '\u2713 ' : '\u2715 ') + s, x + 12, y, { size: 24, color: col, weight: 600 }); },
      // frame with alpha; xs/ys ranges; ylog: log10 axis
      frame(box, xs, ys, o = {}) {
        const L = o.ylog ? Math.log10 : (v => v);
        const X = v => box.x + (v - xs[0]) / (xs[1] - xs[0]) * box.w;
        const Y = v => box.y + box.h - (L(v) - L(ys[0])) / (L(ys[1]) - L(ys[0])) * box.h;
        for (const v of o.yticks || []) { k.line([[box.x, Y(v)], [box.x + box.w, Y(v)]], { color: FB.C.grid, width: 1 });
          k.text(o.yfmt ? o.yfmt(v) : String(v), box.x - 10, Y(v) + 9, { size: 26, color: FB.C.muted, align: 'right' }); }
        k.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: FB.C.axis, width: 1.5 });
        for (const [v, lab, al2] of o.xticks || []) k.text(lab, X(v), box.y + box.h + 34, { size: 26, color: FB.C.muted, align: al2 || 'center' });
        if (o.ylab) k.text(o.ylab, box.x - (o.ylabdx || 0), box.y - 18, { size: 26, color: FB.C.ink2 });
        if (o.xlab) k.text(o.xlab, box.x + box.w, box.y + box.h + 70, { size: 26, color: FB.C.ink2, align: 'right' });
        return { X, Y, box };
      },
    };
    return k;
  }
  function clip(ctx, box, fn) { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); fn(); ctx.restore(); }
  // crossfade weight: fades in over [a,a+f], out over [b,b+f]
  const win = (t, a, b, f = .6) => (a <= 0 ? 1 : seg(t, a, a + f)) * (b == null ? 1 : 1 - seg(t, b, b + f));
  function missing(D) { D.text('Data file data/part_c.js not loaded.', 40, 80, { size: 28, color: FB.C.critical }); }
  // polygon markers for categorical shapes
  function marker(ctx, k, shape, x, y, r, col, filled) {
    ctx.save(); ctx.globalAlpha = k.a; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.beginPath();
    if (shape === 'circle') ctx.arc(x, y, r, 0, 7);
    else if (shape === 'square') ctx.rect(x - r * .85, y - r * .85, r * 1.7, r * 1.7);
    else if (shape === 'diamond') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); }
    else if (shape === 'tri') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r * .8); ctx.lineTo(x - r * 1.1, y + r * .8); ctx.closePath(); }
    if (shape === 'cross') { ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.lineWidth = 4; ctx.stroke(); }
    else if (filled) ctx.fill(); else { ctx.fillStyle = FB.C.surface; ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ S20 */
  FB.scene({
    id: 'S20', part: 'Evaluation', title: 'Forecasting the future, one origin at a time', dur: 15,
    tags: [{ text: 'Real forecasts: Ottawa, IGP, Cases-Only Active Set' }, { text: 'Retrospective (revised data)' }],
    eq: '\\begin{aligned}p(y_{g,N+h}\\mid\\mathbf y_{1:N})&=\\int p\\bigl(y_{g,N+h}\\mid\\mathbf f,\\vartheta,\\mathbf y_{1:N}\\bigr)\\\\&\\qquad\\times p(\\mathbf f,\\vartheta\\mid\\mathbf y_{1:N})\\,d(\\mathbf f,\\vartheta),\\\\ h&=1,\\ldots,14,\\quad N\\in\\{N_0,N_0+10,\\ldots\\}\\end{aligned}',
    beats: [
      { at: 0, cap: 'Ottawa daily cases. Everything after the first cut-off is hidden: it is the future.' },
      { at: 3, cap: 'The model learns from the past only, then draws a 14-day forecast: median and 90% interval.' },
      { at: 6, cap: 'The truth is revealed and scored. The cut-off moves 10 days on and the model is refitted from scratch.' },
      { at: 10, cap: () => { const d = DC(); return d ? `${d.s20.origins.length} origins in Ottawa and ${d.s20.nBrazil} in Brazil, each with 14 held-out days. Every model is judged on the same origins.` : ''; } },
      { at: 13, cap: 'This uses today\u2019s revised data, not what was known at the time: a retrospective test.' },
    ],
    drawer: `<p>At each forecast origin \\(N\\) the model is fitted to \\(\\mathbf y_{1:N}\\) only and issues the posterior predictive distribution for \\(h=1,\\ldots,H\\) days ahead, with \\(H=14\\), spacing \\(\\Delta=10\\) and first origin \\(N_0=180\\) (Brazil) or 90 (Ottawa) (main.tex:2070-2071).</p>
<ul>
<li><b>Exact leave-future-out.</b> The model is refitted from scratch at every origin. Importance-sampling approximations (PSIS-LFO) are avoided because successive posteriors differ substantially (main.tex:2090-2093).</li>
<li><b>Link to Bayesian model comparison.</b> With \\(\\Delta=1\\), \\(H=1\\): \\[\\sum_{N=N_0}^{T-1}\\log p(\\mathbf y_{N+1}\\mid\\mathbf y_{1:N})=\\log p(\\mathbf y_{N_0+1:T}\\mid\\mathbf y_{1:N_0})\\] (main.tex:2095-2101).</li>
<li><b>Score target.</b> The all-age total \\(Y_{N+h}=\\sum_g Y_{g,N+h}\\), formed within each of \\(S=4{,}000\\) predictive draws (main.tex:2105-2109).</li>
<li><b>Forecast mechanics.</b> Source days \\(s>N\\) use latent expected cases; viral load is held at the mean of the raw signal over the last five training days, then raised to \\(p_{VL}\\) (Stan <code>pow(vl_forecast_mean5, vl_power)</code>, prequential_core.stan:151-155, 280-282); demographic noise of the recursion is not propagated (main.tex:1114-1121).</li>
<li><b>Grids.</b> Brazil 17 common origins (180, 190, \\(\\ldots\\), 330, 360); Ottawa 21 (90, \\(\\ldots\\), 280, 390) (results_preq2_main.tex:24-26; score_origins.csv). The Ottawa N = 290 fit exists but is not common to all eight specifications, so it is dropped. Toronto, Scotland and S\\~ao Paulo use a coarse 42-day grid.</li>
<li><b>Retrospective.</b> Final revised series, not real-time vintages (main.tex:2073-2075). Origin dates here are the last training day \\(t=N\\) (Ottawa \\(t=1\\) is 29-07-2020).</li>
</ul>`,
    figure: { src: 'figures/c_rolling_vl_ottawa_exgp.webp', caption: 'Paper figure rolling_vl_ottawa_exgp: rolling forecasts, Ottawa, ExGP, both active sets (paper colours).', alt: 'Rolling forecasts for Ottawa' },
    flags: ['Viral load in the forecast window: the code raises the <i>mean of the raw signal</i> to \\(p_{VL}\\), it does not average powered values. Consistent with the paper\u2019s \u201cheld at its mean\u201d (main.tex:1117).'],
    source: 'main.tex:2063-2110; main.tex:1108-1121; results_preq2_main.tex:24-30; compiled_grid/scores_cells.csv (hsgp, total, cases, ottawa, mgp, I=C); data/ottawa/ts_ottawa_daily.rds; outputs/paper_results_preq2/score_origins.csv',
    alt: 'Ottawa daily cases with a vertical forecast origin; a blue forecast fan grows 14 days ahead, the truth lights up, then the origin jumps forward 21 times leaving ghost fans.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s20, C = FB.C, k = K(D);
      const box = { x: 100, y: 170, w: 600, h: 500 };
      const n = s.obs.length;
      const f = k.frame(box, [1, n], [0, 500], { yticks: [0, 100, 200, 300, 400, 500], xticks: [[1, dateOf(s.t1, 1)], [157, dateOf(s.t1, 157)], [n, dateOf(s.t1, n)]], ylab: 'Daily reported cases, all ages', ylabdx: 60 });
      k.label('Observed', 120, 62, C.obs); k.label('Forecast median, 90% interval', 300, 62, C.cases);
      // origin index
      const NO = s.origins.length;
      let ki, u;
      if (t < 6) { ki = 0; u = 1; } else if (t < 10) { const p = seg(t, 6, 10) * (NO - 1); ki = Math.min(NO - 1, Math.floor(p) + 1); u = clamp((p - Math.floor(p)) * 2.2); if (ki >= NO - 1 && p >= NO - 1) u = 1; } else { ki = NO - 1; u = 1; }
      const N = s.origins[ki];
      const grow = ki === 0 ? ease(seg(t, 3, 5)) : ease(clamp(u * 1.6));
      const reveal = ki === 0 ? seg(t, 5, 6) : clamp(u * 1.6 - .6);
      const shownT = t < 2 ? lerp(1, n, ease(seg(t, 0, 2))) : n;
      clip(ctx, { x: box.x, y: box.y - 4, w: box.w + 4, h: box.h + 4 }, () => {
        // ghost fans of previous origins, each drawn up to the next origin
        for (let j = 0; j < ki; j++) {
          const N0 = s.origins[j], N1 = s.origins[j + 1], fan = s.fans[N0], H = Math.min(14, N1 - N0);
          const lo = [], hi = [], md = [];
          for (let h = 1; h <= H; h++) { lo.push([f.X(N0 + h), f.Y(fan[h - 1][1])]); hi.push([f.X(N0 + h), f.Y(fan[h - 1][2])]); md.push([f.X(N0 + h), f.Y(fan[h - 1][0])]); }
          k.band(lo, hi, { color: C.cases, alpha: .16 }); k.line(md, { color: C.cases, width: 2, alpha: .45 });
        }
        // current fan
        if (t >= 3) {
          const fan = s.fans[N], H = Math.max(1, Math.round(grow * 14));
          const lo = [[f.X(N), f.Y(fan[0][0])]], hi = [[f.X(N), f.Y(fan[0][0])]], md = [[f.X(N), f.Y(fan[0][0])]];
          for (let h = 1; h <= H; h++) { lo.push([f.X(N + h), f.Y(fan[h - 1][1])]); hi.push([f.X(N + h), f.Y(fan[h - 1][2])]); md.push([f.X(N + h), f.Y(fan[h - 1][0])]); }
          k.band(lo, hi, { color: C.cases, alpha: .32 }); k.line(md, { color: C.cases, width: 3.5 });
          // absolute-error ticks on the revealed truth
          if (reveal > 0) for (let h = 1; h <= 14; h++) { const x = f.X(N + h); k.line([[x, f.Y(s.obs[N + h - 1])], [x, f.Y(fan[h - 1][0])]], { color: C.ink, width: 1.5, alpha: .55 * reveal }); }
        }
        // observed dots
        for (let i = 1; i <= Math.floor(shownT); i++) {
          const fut = t >= 2 && i > N; const inWin = i > N && i <= N + 14;
          const a = !fut ? 1 : inWin ? lerp(.18, 1, reveal) : .18;
          k.dot(f.X(i), f.Y(s.obs[i - 1]), inWin && reveal > 0 ? 4.5 : 3, { color: inWin && reveal > 0 ? C.ink : C.obs, alpha: a });
        }
      });
      // origin line
      if (t >= 2) {
        const a = ease(seg(t, 2, 3)), x = f.X(N);
        k.line([[x, box.y + box.h], [x, lerp(box.y + box.h, box.y - 6, a)]], { color: C.ink, width: 2, dash: [8, 6] });
        const lab = `Origin ${dateOf(s.t1, N)}  (N = ${N})`;
        k.text(lab, clamp(x, 250, 560), 112, { size: 26, color: C.ink, weight: 600, align: 'center', alpha: a });
      }
      // counter
      const cy = 775;
      if (t >= 6 && t < 10.3) k.text(`Origin ${ki + 1} of ${NO}`, 400, cy, { size: 34, weight: 650, align: 'center', color: C.ink, alpha: win(t, 6, 10) });
      if (t >= 10) {
        const a = ease(seg(t, 10, 11));
        k.text(`${NO} origins \u00d7 14 days = ${s.nScored} scored forecasts`, 400, cy, { size: 34, weight: 650, align: 'center', alpha: a });
        k.text(`Brazil: ${s.nBrazil} origins, same design`, 400, cy + 48, { size: 28, color: C.ink2, align: 'center', alpha: a });
      }
      if (t >= 13) k.text('Revised data, not real-time vintages', 400, cy + 96, { size: 28, color: C.muted, align: 'center', alpha: ease(seg(t, 13, 14)) });
    },
  });

  /* ------------------------------------------------------------------ S21 */
  // illustrative log-normal shape through the stored q05 / q50 / q95
  const lnPars = q => ({ mu: Math.log(q.q50), sd: (Math.log(q.q95) - Math.log(q.q05)) / (2 * 1.6449) });
  const lnPdf = (x, p) => x <= 0 ? 0 : Math.exp(-((Math.log(x) - p.mu) ** 2) / (2 * p.sd * p.sd)) / (x * p.sd * Math.sqrt(2 * Math.PI));
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const tt = 1 / (1 + .3275911 * x); const y = 1 - (((((1.061405429 * tt - 1.453152027) * tt) + 1.421413741) * tt - .284496736) * tt + .254829592) * tt * Math.exp(-x * x); return s * y; }
  const lnCdf = (x, p) => x <= 0 ? 0 : .5 * (1 + erf((Math.log(x) - p.mu) / (p.sd * Math.SQRT2)));
  FB.scene({
    id: 'S21', part: 'Evaluation', title: 'How do you score a forecast that is a whole distribution?', dur: 15,
    tags: [{ text: 'One real origin, for illustration' }, { text: 'Curve shape illustrative (from stored quantiles)', cls: 'synthetic' }],
    eq: '\\begin{aligned}\\mathrm{CRPS}(F,y)&=\\int_{\\mathbb R}\\bigl\\{F(z)-\\mathbb I(y\\le z)\\bigr\\}^{2}dz\\\\&=\\mathbb E_F\\lvert Y-y\\rvert-\\tfrac12\\mathbb E_F\\lvert Y-Y\'\\rvert\\end{aligned}',
    beats: [
      { at: 0, cap: 'Two forecasts for the same day: one wider and too high, one narrower and closer to what happened.' },
      { at: 3, cap: 'CRPS is the area between the forecast\u2019s cumulative curve and the truth\u2019s step, in cases. Smaller is better.' },
      { at: 7, cap: 'The log score asks how much probability the forecast gave to what happened. Larger is better; missing badly costs a lot.', eq: '\\mathrm{LogS}(F,y)=\\log p_F(y)' },
      { at: 11, cap: () => { const d = DC(); if (!d) return ''; const c = d.s21.counter; return `Scores are averaged over origins and days ahead. This origin favours viral load; others do not (${U.fmtDate(c.origin)}: ${fmt(c.meanC, 1)} vs ${fmt(c.meanV, 1)}).`; }, eq: '\\overline{\\mathrm{CRPS}}=\\frac{1}{14}\\sum_{h=1}^{14}\\mathrm{CRPS}(F_{N+h},y_{N+h})' },
    ],
    drawer: `<p>A scoring rule \\(\\mathrm S(F,y)\\), oriented so that smaller is better, is <i>proper</i> if \\(\\mathbb E_{Y\\sim G}\\mathrm S(G,Y)\\le\\mathbb E_{Y\\sim G}\\mathrm S(F,Y)\\) for all \\(F,G\\): reporting your true belief is optimal, so calibration and sharpness are rewarded together (main.tex:2147-2156).</p>
<ul>
<li><b>CRPS</b> is estimated from the 4,000 draws by replacing both expectations with draw averages (Jordan et al.); it is in case units and reduces to absolute error for a point forecast (main.tex:2157-2165).</li>
<li><b>LogS</b> \\(=\\log p_F(y)\\) uses a Gaussian kernel density estimate of the draws at \\(y\\); it is local and tail-sensitive, and sums over one-step forecasts to the marginal likelihood (main.tex:2166-2173).</li>
<li><b>Point errors.</b> \\(\\mathrm{MSE}=\\bar e^{2}+|\\mathcal S|^{-1}\\sum_i(e_i-\\bar e)^2\\): squared bias plus error variance across forecasts, not predictive variance (main.tex:2174-2186).</li>
<li><b>Coverage</b> is diagnostic, not proper: \u201ca forecast can be well covered and uselessly wide\u201d (main.tex:2190-2191).</li>
<li><b>WAIC</b> is in-sample support only; a difference is clear only beyond two paired SE, and \\(|\\Delta\\widehat{\\mathrm{elpd}}|<4\\) counts as small. \u201cthe prequential scores are the primary evidence for forecasting\u201d (main.tex:2134-2145).</li>
<li>\u201cScores at different origins and horizons share data and are dependent, so we report differences descriptively rather than as formal tests.\u201d (main.tex:2194-2196)</li>
</ul>
<p>The worked example is Ottawa, IGP, origin \\(N=170\\), all-age cases, 4 days ahead. The CRPS and LogS values on screen are the stored scores from the 4,000 draws; the drawn curves are a log-normal through the stored 5%, 50% and 95% quantiles, for illustration.</p>`,
    flags: ['Curves are drawn from three stored quantiles, not from the draws, so their area and height only illustrate the stored CRPS and LogS.', 'Origins are dated by their last training day \\(t=N\\) (here 14-01-2021); the first forecast day is 15-01-2021.'],
    source: 'main.tex:2147-2196; compiled_grid/scores_cells.csv (hsgp, total, cases, ottawa, mgp, N=170 and N=240, both variants)',
    alt: 'Two forecast densities, blue and orange, with the observed count as a vertical line; they morph into cumulative curves against a step, then per-day CRPS bars for both active sets.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s21, C = FB.C, k = K(D);
      k.label('Cases-Only Active Set', 110, 50, C.cases, { size: 26 }); k.label('Viral-Load Active Set', 460, 50, C.vl, { size: 26 });
      k.text(`Ottawa, IGP, origin ${U.fmtDate(s.origin)}, ${s.h} days ahead`, 400, 96, { size: 26, color: C.ink2, align: 'center' });
      const box = { x: 90, y: 130, w: 640, h: 270 }, xmax = 350;
      const X = v => box.x + v / xmax * box.w, Yb = v => box.y + box.h - v * box.h;
      k.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: C.axis, width: 1.5 });
      for (const v of [0, 100, 200, 300]) k.text(String(v), X(v), box.y + box.h + 34, { size: 26, color: C.muted, align: 'center' });
      k.text('cases on ' + U.fmtDate(s.target), box.x + box.w, box.y + box.h + 68, { size: 26, color: C.ink2, align: 'right' });
      const P = { C: lnPars(s.C), V: lnPars(s.V) }, y = s.C.obs;
      const grid = []; for (let i = 0; i <= 200; i++) grid.push(i / 200 * xmax);
      const pmax = Math.max(...grid.map(x => Math.max(lnPdf(x, P.C), lnPdf(x, P.V))));
      const u = ease(seg(t, 3, 4.8)) * (1 - ease(seg(t, 7, 8.2)));      // 0 density, 1 cdf
      const dimBars = 1 - .55 * seg(t, 11, 11.6);
      const curve = (p) => grid.map(x => [X(x), Yb(lerp(lnPdf(x, p) / pmax * .92, lnCdf(x, p), u))]);
      const draw0 = ease(seg(t, 0, 2.2));
      for (const key of ['C', 'V']) {
        const col = key === 'C' ? C.cases : C.vl, pts = curve(P[key]);
        if (u > 0) { // squared-gap area between F and the step
          const top = pts.map(([px, py], i) => [px, grid[i] < y ? py : Yb(lerp(0, 1, u))]);
          const bot = pts.map(([px, py], i) => [px, grid[i] < y ? Yb(0) : py]);
          k.band(bot, top, { color: col, alpha: .22 * u * dimBars });
        }
        k.line(D.partial(pts, draw0), { color: col, width: 4, alpha: dimBars });
      }
      // truth: vertical line (density view) / step (cdf view)
      const ty = X(y);
      k.line([[ty, box.y + box.h], [ty, box.y - 6]], { color: C.ink, width: 2.5, alpha: (1 - u) * draw0 * dimBars });
      if (u > 0) k.line([[box.x, Yb(0)], [ty, Yb(0)], [ty, Yb(1)], [box.x + box.w, Yb(1)]], { color: C.ink, width: 3, alpha: u * dimBars });
      k.text(`Observed ${y}`, ty + 12, box.y + 20, { size: 26, color: C.ink, weight: 600, alpha: draw0 * dimBars });
      // log-score dots
      const ls = seg(t, 8.2, 9);
      if (ls > 0 && t < 11.6) for (const key of ['C', 'V']) k.dot(ty, Yb(lnPdf(y, P[key]) / pmax * .92), 9, { color: key === 'C' ? C.cases : C.vl, ring: true, alpha: ls });
      // numbers
      const cu = ease(seg(t, 4, 6.5));
      const row = (lab, a, vc, vv, dir, yy, dp) => { if (a <= 0) return; k.text(lab, 90, yy, { size: 28, color: C.ink2, alpha: a });
        k.text(fmt(vc, dp), 470, yy, { size: 32, color: C.cases, weight: 700, align: 'right', alpha: a }); k.text(fmt(vv, dp), 640, yy, { size: 32, color: C.vl, weight: 700, align: 'right', alpha: a });
        k.text(dir, 700, yy, { size: 26, color: C.muted, alpha: a }); };
      row('CRPS, this day', cu, s.C.crps * cu, s.V.crps * cu, '\u2193 better', 520, 1);
      row('LogS, this day', ease(seg(t, 8.5, 9.5)), s.C.logs, s.V.logs, '\u2191 better', 570, 2);
      // per-day CRPS bars
      const b = seg(t, 11.2, 13.2);
      if (b > 0) {
        const mx = Math.max(...s.perhC, ...s.perhV), bw = 24, x0 = 230;
        k.text('CRPS by day ahead, 1\u201314', 90, 625, { size: 26, color: C.ink2, alpha: b });
        [['C', s.perhC, C.cases, 735, s.meanC], ['V', s.perhV, C.vl, 850, s.meanV]].forEach(([key, arr, col, base, mean]) => {
          k.text(key === 'C' ? 'Cases-Only' : 'Viral-Load', 90, base - 8, { size: 26, color: C.ink, alpha: b });
          arr.forEach((v, i) => { const hh = v / mx * 90 * ease(clamp(b * 1.4 - i * .03)); k.rect(x0 + i * (bw + 6), base - hh, bw, hh, { color: col, r: 3, alpha: b }); });
          k.text('mean ' + fmt(mean, 1), 790, base - 8, { size: 28, color: col, weight: 700, align: 'right', alpha: ease(seg(t, 12.8, 13.6)) });
        });
      }
    },
  });

  /* ------------------------------------------------------------------ S22 */
  let chainCache = null;
  function chains() {
    if (chainCache) return chainCache;
    const mk = (seed, stuck) => { const r = U.mulberry(seed), out = [];
      const starts = [-2.6, 2.4, -1.2, 1.6];
      for (let c = 0; c < 4; c++) { let v = starts[c]; const pts = []; const target = stuck && c === 3 ? 2.2 : 0;
        for (let i = 0; i < 250; i++) { const pull = i < 150 ? .06 : .25; v += pull * (target - v) * (i < 150 ? 1 : .6) + .32 * U.normal(r); pts.push(v); } out.push(pts); }
      return out; };
    chainCache = { good: mk(11, false), bad: mk(29, true) };
    return chainCache;
  }
  FB.scene({
    id: 'S22', part: 'Evaluation', title: 'The inference engine and the convergence screen', dur: 15,
    tags: [PROV, { text: 'Chain traces schematic', cls: 'synthetic' }],
    eq: '\\begin{aligned}&\\widehat R_{\\max}\\le1.01,\\quad \\mathrm{ESS}_{\\text{bulk}},\\,\\mathrm{ESS}_{\\text{tail}}\\ge400,\\\\&\\text{no divergences},\\quad \\text{E-BFMI}\\ge0.3\\end{aligned}',
    beats: [
      { at: 0, cap: 'Each fit runs four independent samplers: 1,500 warm-up and 1,000 kept steps each. We trust it only if all four agree.' },
      { at: 4, cap: 'The exact GP gets far slower as the series grows; the HSGP approximation stays fast. A Dense Brazil fit takes about 26 hours, the HSGP about 5.' },
      { at: 8, cap: () => { const d = DC(); if (!d) return ''; const n = d.s22.cells.filter(c => c.z <= .15).length; return `At ${n} of ${d.s22.cells.length} matched cells, approximate and exact posteriors agree within 0.15 posterior SD.`; } },
      { at: 12, cap: () => { const d = DC(); if (!d) return ''; const g = d.s22.diag; return `Only ${g.brazil.pass} of ${g.brazil.fits} Brazil fits and ${g.ottawa.pass} of ${g.ottawa.fits} Ottawa fits pass the strict screen. All results are provisional.`; } },
    ],
    drawer: `<p><b>Stan.</b> NUTS with 4 chains, 1,500 warm-up and 1,000 retained iterations, target acceptance 0.8, maximum tree depth 12; fit time is the longest chain (main.tex:2210-2215).</p>
<p><b>Screen.</b> Maximum \\(\\widehat R\\le1.01\\), bulk and tail ESS \\(\\ge400\\), no divergent transitions and E-BFMI \\(\\ge0.3\\) (results_preq2_main.tex:57-60; tab_diag_brazil.tex, tab_diag_ottawa.tex). Failures are mostly multimodality: one chain sits in a short-length-scale mode (\\(\\rho\\approx0.7\\) d) (results_preq2_main.tex:177-183). The red example value is the Brazil ExGP \\(I=C\\), \\(N=360\\) fit (representative_folds_brazil.csv).</p>
<p><b>Pathfinder</b> was rejected: Pareto-\\(\\hat k\\) between 8.5 and 71 across 72 Ottawa fits, against 0.7 (main.tex:2246-2249).</p>
<p><b>HSGP</b> (equations in S15). Cost per log-density evaluation \\(\\mathcal O\\{(N+H)m\\}\\) against \\(\\mathcal O\\{(N+H)^3\\}\\) for the Dense Cholesky factor (main.tex:2294-2295). Rank \\(m=785\\) (Brazil) and 805 (Ottawa) from \\(\\rho_{\\min}=2\\) d; 393/403 if all \\(\\rho>4\\) d (main.tex:2296-2298; results_preq2_hsgp_appendix.tex:25-70).</p>
<p><b>Dense vs HSGP</b> at 40 cells: 1.1 to 10.3 times faster (median 4.1); 39/40 cells within 0.15 posterior SD of every sampled scalar; forecast CRPS within 2.2% at the 12 scored cells. The exception is a Dense fit that has not converged (main.tex:2303-2321). Four adequacy checks: 241 of 244 fits pass (ii)-(iii) (main.tex:2343-2345).</p>
<p>Runtime caveat: \u201cFits ran on different lab PCs \u2026 not a controlled benchmark\u201d (results_preq2_appendix.tex:427-428).</p>`,
    figure: { src: 'figures/c_hsgp_dense_agreement.webp', caption: 'Paper figure fig:hsgp-dense-agreement (main.tex:2327): run time, agreement, and \\(\\lambda\\), CFR Dense vs HSGP for Ottawa ExGP \\(N=240\\).', alt: 'Dense versus HSGP agreement figure' },
    flags: ['Section heading typo \u201cSpecral\u201d at main.tex:2256.', 'Symbol clash: the paper writes the HSGP rank as \\(M\\), also the contact matrix; the flipbook uses \\(m\\).'],
    source: 'main.tex:2205-2345; results_preq2_main.tex:54-65; PAPER/figures/results_preq2/hsgp_dense_agreement_cells.csv; results/results_preq2/tab_diag_{brazil,ottawa}.tex; outputs/paper_results_preq2/diagnostics_hsgp.csv; representative_folds_brazil.csv',
    alt: 'Four schematic chain traces merge (green badge) or one stays apart (red badge); a run-time chart of Dense versus HSGP; 40 agreement bars under a 0.2 threshold; two rings showing the share of fits passing the screen.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s22, C = FB.C;
      const a1 = win(t, 0, 3.6), a2 = win(t, 3.6, 7.6), a3 = win(t, 7.6, 11.6), a4 = win(t, 11.6, null);
      // Panel A: chains (schematic)
      if (a1 > 0) { const k = K(D, a1), ch = chains(), cols = [C.ink, C.ink2, C.obs, C.muted];
        const panel = (data, y0, title, ok, badge) => {
          const box = { x: 80, y: y0, w: 660, h: 230 };
          k.text(title, 80, y0 - 22, { size: 28, color: C.ink, weight: 600 });
          k.rect(box.x, box.y, box.w * .6, box.h, { color: C.ink, alpha: .05, r: 0 });
          k.text('warm-up', box.x + 10, box.y + box.h - 12, { size: 26, color: C.muted });
          k.text('kept draws', box.x + box.w * .6 + 10, box.y + box.h - 12, { size: 26, color: C.muted });
          const u = ease(seg(t, 0, 2.8));
          data.forEach((pts, c) => { const p = pts.map((v, i) => [box.x + i / 249 * box.w, box.y + box.h / 2 - v * 30]); k.line(D.partial(p, u), { color: cols[c], width: 2.2 }); });
          if (t > 2.4) k.badge(badge, box.x + 10, box.y + box.h + 50, ok);
        };
        panel(ch.good, 100, 'Four chains agree', true, RHAT + ' \u2264 1.01');
        panel(ch.bad, 520, 'One chain stuck in another mode', false, `${RHAT} = ${fmt(s.rep.rhat, 2)}  (Brazil ExGP, Cases-Only, N = ${s.rep.N})`);
      }
      // Panel B: run time
      if (a2 > 0) { const k = K(D, a2);
        const box = { x: 120, y: 150, w: 580, h: 480 };
        const f = k.frame(box, [80, 300], [0.05, 40], { ylog: true, yticks: [0.1, 1, 10], yfmt: v => v < 1 ? '0.1 h' : v + ' h', xticks: [[90, '90'], [190, '190'], [280, '280 days']], ylab: 'Hours, longest chain', ylabdx: 60 });
        const prog = ease(seg(t, 4.2, 6.5));
        for (const cls of ['IGP', 'ExGP']) for (const impl of ['dense', 'hsgp']) {
          const pts = s.cells.filter(c => c.ds === 'ottawa' && c.cls === cls && c.v === 'I=C').sort((a, b) => a.N - b.N).map(c => [f.X(c.N), f.Y(c[impl])]);
          k.line(D.partial(pts, prog), { color: ccol(cls), width: 3, dash: impl === 'hsgp' ? [9, 7] : null });
          pts.forEach(([x, y], i) => { if (i / (pts.length - 1) <= prog + 1e-6) k.dot(x, y, 6, { color: ccol(cls), ring: true }); });
        }
        const lastD = s.cells.filter(c => c.ds === 'ottawa' && c.N === 280 && c.v === 'I=C' && c.cls === 'IGP')[0];
        if (prog > .95) { k.text('Dense', f.X(285), f.Y(lastD.dense) + 8, { size: 26, color: C.ink, weight: 600 }); k.text('HSGP', f.X(285), f.Y(lastD.hsgp) + 8, { size: 26, color: C.ink, weight: 600 }); }
        const br = seg(t, 5.8, 6.8);
        if (br > 0) { const bc = s.cells.filter(c => c.ds === 'brazil' && (c.cls === 'IGP' || c.cls === 'ExGP'));
          for (const c of bc) for (const impl of ['dense', 'hsgp']) marker(ctx, K(D, a2 * br), 'tri', f.X(180) + (c.cls === 'IGP' ? -9 : 9), f.Y(c[impl]), 9, ccol(c.cls), impl === 'dense');
          const dn = bc.map(c => c.dense), hs = bc.map(c => c.hsgp);
          k.text(`Brazil Dense ${fmt(Math.min(...dn), 1)}\u2013${fmt(Math.max(...dn), 1)} h`, f.X(180) + 26, f.Y(median(dn)) + 9, { size: 26, color: C.ink, alpha: br });
          k.text(`Brazil HSGP ${fmt(Math.min(...hs), 1)}\u2013${fmt(Math.max(...hs), 1)} h`, f.X(180) + 26, f.Y(Math.min(...hs)) + 46, { size: 26, color: C.ink, alpha: br }); }
        k.label('IGP', 140, 70, C.igp, { size: 26 }); k.label('ExGP', 250, 70, C.exgp, { size: 26 });
        k.text('solid Dense, dashed HSGP; \u25b2 Brazil', 380, 70, { size: 26, color: C.ink2 });
        k.text(`HSGP ${fmt(s.speed[0], 1)}\u2013${fmt(s.speed[2], 1)}\u00d7 faster (median ${fmt(s.speed[1], 1)}) over ${s.cells.length} cells`, 400, 735, { size: 28, color: C.ink, weight: 600, align: 'center' });
        k.text('Fits ran on different lab PCs: not a controlled benchmark', 400, 780, { size: 26, color: C.muted, align: 'center' });
      }
      // Panel C: agreement
      if (a3 > 0) { const k = K(D, a3);
        const box = { x: 110, y: 160, w: 600, h: 460 };
        const f = k.frame(box, [0, s.cells.length], [0, .45], { yticks: [0, .1, .2, .3, .4], yfmt: v => v.toFixed(1), ylab: 'Largest |HSGP \u2212 Dense| / posterior SD', ylabdx: 70 });
        const cells = [...s.cells].sort((a, b) => a.z - b.z), bw = box.w / cells.length;
        const g = ease(seg(t, 8, 10));
        cells.forEach((c, i) => { const h = (f.Y(0) - f.Y(c.z)) * g, x = f.X(i) + 2;
          if (c.z > .2) k.rect(x, f.Y(0) - h, bw - 4, h, { color: C.surface, stroke: ccol(c.cls), sw: 2.5, r: 2 });
          else k.rect(x, f.Y(0) - h, bw - 4, h, { color: ccol(c.cls), r: 2, alpha: c.dv ? 1 : .55 }); });
        k.line([[box.x, f.Y(.2)], [box.x + box.w, f.Y(.2)]], { color: C.ink, width: 2, dash: [10, 7] });
        k.text('agreement threshold 0.2', box.x + 10, f.Y(.2) - 12, { size: 26, color: C.ink });
        const ex = cells[cells.length - 1];
        if (g > .9) { k.text(`Brazil SGP-AI, Viral-Load: ${fmt(ex.z, 2)}`, box.x + box.w, f.Y(ex.z) - 44, { size: 26, color: C.ink, align: 'right', weight: 600 });
          k.text(`Dense fit not converged (${RHAT} = ${fmt(ex.rhat, 2)})`, box.x + box.w, f.Y(ex.z) - 12, { size: 26, color: C.ink2, align: 'right' }); }
        CLASSES.forEach((c, i) => k.label(c, 130 + i * 160, 700, ccol(c), { size: 26 }));
        k.text('one bar per matched cell, sorted; faded: Dense fit fails the screen', 400, 760, { size: 26, color: C.muted, align: 'center' });
      }
      // Panel D: tally rings + screen
      if (a4 > 0) { const k = K(D, a4), r = 120, u = ease(seg(t, 12, 14));
        [['Brazil', s.diag.brazil, 220], ['Ottawa', s.diag.ottawa, 580]].forEach(([nm, g, cx]) => {
          const cy = 210;
          k.circle(cx, cy, r, { color: C.line, width: 22 });
          ctx.save(); ctx.globalAlpha = a4; ctx.strokeStyle = C.good; ctx.lineWidth = 22; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * g.pass / g.fits * u); ctx.stroke(); ctx.restore();
          k.text(`${Math.round(g.pass * u)} / ${g.fits}`, cx, cy + 12, { size: 40, weight: 700, align: 'center' });
          k.text(`${nm} fits pass`, cx, cy + r + 60, { size: 28, color: C.ink2, align: 'center' });
        });
        k.text('The strict screen', 80, 470, { size: 28, color: C.ink, weight: 600 });
        [[RHAT + ' \u2264 1.01', 80, 525], ['bulk and tail ESS \u2265 400', 380, 525], ['no divergences', 80, 585], ['E-BFMI \u2265 0.3', 380, 585]].forEach(([s2, x, y]) => k.badge(s2, x, y, true));
        k.text('Pooled scores include failing fits: provisional', 400, 680, { size: 28, color: C.ink, align: 'center', weight: 600 });
      }
    },
  });

  /* ------------------------------------------------------------------ S23 */
  let iconCache = null;
  function iconPaths() {
    if (iconCache) return iconCache;
    const r = U.mulberry(5), base = [], per = [0, 1, 2, 3].map(() => []);
    const ph = [0, 1, 2, 3].map(() => [r() * 6, r() * 6, r() * 6]);
    for (let i = 0; i <= 40; i++) { const x = i / 40; base.push(Math.sin(5 * x + 1) * .5 + Math.sin(11 * x) * .2);
      for (let g = 0; g < 4; g++) per[g].push(Math.sin(5 * x + ph[g][0]) * .45 + Math.sin(9 * x + ph[g][1]) * .25 + Math.sin(13 * x + ph[g][2]) * .1); }
    iconCache = { base, per }; return iconCache;
  }
  FB.scene({
    id: 'S23', part: 'Results and discussion', title: 'How much age structure do the GPs need?', dur: 15,
    tags: [PROV],
    eq: '\\begin{aligned}\\text{SGP: }&\\textstyle\\sum_g K_{g,h,t}=\\tau\\lambda_t\\sum_g S_{g,t}M_{g,h}/N_h\\\\ \\text{IGP, ExGP: }&K_{g,h,t}=\\tau\\,\\lambda_{g,t}\\,S_{g,t}\\,M_{g,h}/N_h\\end{aligned}',
    beats: [
      { at: 0, cap: 'Four model families, from one shared curve for all ages to a separate curve per age with shared \u201cfamily traits\u201d.' },
      { at: 4, cap: 'The shared model gives every age the same fatality ratio, 7.3%. Separate curves find 0.18% for under-18s and 14% for over-65s.' },
      { at: 8, cap: () => { const d = DC(); if (!d) return ''; const b = d.classScores.brazil['I=C']; return `With one curve the forecasts fail: Brazil case CRPS ${fmt(b.SGP.crps)} against ${fmt(b.IGP.crps)} for independent age curves.`; } },
      { at: 12, cap: 'Independent and exchangeable age curves forecast almost identically, within 3%.' },
    ],
    drawer: `<ul>
<li>\u201cWith \\(I=C\\), SGP estimates a single CFR of 7.3% for every age group, whereas IGP estimates 0.18%, 0.27%, 1.8% and 14.0%\u201d (results_preq2_main.tex:95-97). SGP absorbs the misfit through the death dispersion: \\(\\log\\phi_D=-1.1\\) against 7.9 for IGP (98-100).</li>
<li>SGP\u2019s recombined \\(\\Reff\\) stays near 2 (Brazil 2.05; Ottawa 1.78-1.81) against 1.02-1.07 for IGP/ExGP: \u201ccompensation within a misspecified model and is not an epidemiological estimate\u201d (results_preq2_main.tex:102-110; outputs/paper_reff_mech/reff_pop_*.csv).</li>
<li>SGP-AI (age-specific intercepts, one shared path) recovers most of the fit and has the best Ottawa case CRPS (22.1 with wastewater) but is 30-144 elpd below IGP in Brazil (results_preq2_main.tex:136-145).</li>
<li>Brazil 0-18 transmission length scale 25-42 d vs 6-19 d for adults; Ottawa 15-25 d (results_preq2_main.tex:146-151).</li>
<li>IGP and ExGP: \u201cTheir case CRPS differs by at most 3% within either data set and active set, and their joint elpd differences are 0--8\u201d (results_preq2_main.tex:154-156). Exchangeability pools the weakly informed CFR hyperparameters (see S29).</li>
<li>Transmission levels are comparable only up to \\(b_Ce^{\\mu^\\lambda}\\) (results_preq2_main.tex:122-125).</li>
</ul>
<p>Scores: all-age total, pooled over the common origins (17 Brazil, 21 Ottawa) and \\(h=1\\)-14, from tab_class_scores.tex.</p>`,
    figure: { src: 'figures/c_class_compare_brazil_VLC.webp', caption: 'Paper figure fig:preq2-class-compare-brazil (results_preq2_main.tex:190): the four classes by age, Brazil, \\(I=\\mathrm{VL}+C\\).', alt: 'Class comparison by age for Brazil' },
    flags: ['Brazil age groups appear three ways in the paper (0-17/18-39/40-64/65+, 0-18/18-45/45-65/65+, 0-18/18-40/40-65/65+); the flipbook uses the fitted labels 0-18, 18-40, 40-65, 65+.', 'Three Brazil \\(I=C\\) fits (IGP, SGP-AI, ExGP at \\(N=360\\)) fail the screen (\u2020 in tab_model_scores_brazil).', 'The CFR values are quoted from the text (results_preq2_main.tex:95-97), not re-exported.'],
    source: 'results_preq2_main.tex:84-183; results/results_preq2/tab_class_scores.tex; main.tex:1727',
    alt: 'Four class icons; CFR bars morph from a flat 7.3% to an age gradient; dot plots of Brazil and Ottawa case CRPS by class with SGP off the scale; IGP and ExGP pulse together.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const cs = d.classScores, C = FB.C, k = K(D), ip = iconPaths();
      // icons
      const sub = ['one path', 'age offsets', 'own paths', 'shared traits'];
      CLASSES.forEach((c, i) => { const a = ease(seg(t, i * .5, i * .5 + 1)); if (a <= 0) return; const kk = K(D, a), x0 = 30 + i * 190, w = 150, y0 = 95, col = ccol(c);
        const P = arr => arr.map((v, j) => [x0 + j / 40 * w, y0 + v * 28]);
        if (c === 'SGP') kk.line(P(ip.base), { color: col, width: 4 });
        if (c === 'SGP-AI') [-.9, -.3, .3, .9].forEach(o => kk.line(P(ip.base.map(v => v + o)), { color: col, width: 3 }));
        if (c === 'IGP' || c === 'ExGP') ip.per.forEach((p, g) => kk.line(P(p.map(v => v + (g - 1.5) * .6)), { color: col, width: 3 }));
        if (c === 'ExGP') { kk.dot(x0 + w / 2, y0 - 58, 8, { color: col }); [0, 1, 2, 3].forEach(g => kk.line([[x0 + w / 2, y0 - 58], [x0 + 8 + g * 44, y0 - 30]], { color: col, width: 1.5, alpha: .7 })); }
        kk.text(c, x0 + w / 2, y0 + 86, { size: 28, weight: 650, align: 'center', color: C.ink });
        kk.text(sub[i], x0 + w / 2, y0 + 120, { size: 26, align: 'center', color: C.ink2 });
      });
      // CFR bars (quoted from results_preq2_main.tex:95-97)
      const a2 = win(t, 4, 8.2);
      if (a2 > 0) { const kk = K(D, a2), box = { x: 120, y: 330, w: 600, h: 420 };
        const f = kk.frame(box, [0, 4], [0, 15], { yticks: [0, 5, 10, 15], yfmt: v => v + '%', ylab: 'Case-fatality ratio, Brazil, Cases-Only Active Set' , ylabdx: 60});
        const sgp = 7.3, igp = [0.18, 0.27, 1.8, 14.0], ages = ['0\u201318', '18\u201340', '40\u201365', '65+'], u = ease(seg(t, 5.5, 7.5));
        igp.forEach((v, g) => { const val = lerp(sgp, v, u), x = f.X(g + .2), bw = f.X(.6) - f.X(0);
          kk.rect(x, f.Y(val), bw, f.Y(0) - f.Y(val), { color: ccol('SGP'), alpha: 1 - u, r: 3 }); kk.rect(x, f.Y(val), bw, f.Y(0) - f.Y(val), { color: ccol('IGP'), alpha: u, r: 3 });
          kk.text((u < .5 ? fmt(sgp, 1) : fmt(v, v < 1 ? 2 : 1)) + '%', x + bw / 2, f.Y(val) - 12, { size: 28, weight: 650, align: 'center' });
          kk.text(ages[g], x + bw / 2, box.y + box.h + 36, { size: 26, color: C.muted, align: 'center' }); });
        kk.label(u < .5 ? 'SGP: one CFR for all ages' : 'IGP: one CFR curve per age', 140, 820, u < .5 ? ccol('SGP') : ccol('IGP'), { size: 28 });
      }
      // CRPS dot plots
      const a3 = win(t, 8, null);
      if (a3 > 0) { const kk = K(D, a3);
        const rows = [['brazil', 'Brazil case CRPS (17 origins)', 330, [10000, 16500], [10000, 12000, 14000, 16000], 0], ['ottawa', 'Ottawa case CRPS (21 origins)', 600, [20, 32], [20, 24, 28, 32], 1]];
        for (const [ds, title, y0, xr, ticks, dp] of rows) {
          const sc = cs[ds]['I=C'], box = { x: 110, y: y0, w: 560, h: 120 };
          kk.text(title + ', Cases-Only Active Set', 60, y0 - 20, { size: 26, color: C.ink2 });
          const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w, yy = y0 + 70;
          kk.line([[box.x, yy], [box.x + box.w, yy]], { color: C.axis, width: 1.5 });
          ticks.forEach(v => kk.text(fmt(v), X(v), yy + 92, { size: 26, color: C.muted, align: 'center' }));
          ticks.forEach(v => kk.line([[X(v), yy - 6], [X(v), yy + 6]], { color: C.axis, width: 1.5 }));
          const order = ['SGP-AI', 'IGP', 'ExGP'];
          const u = seg(t, 8.4, 10);
          // labels alternate above / below where dots are close
          // label placement: SGP-AI above, ending at its dot; IGP above, starting at its dot; ExGP below
          const lab = { 'SGP-AI': [-26, 'right', 14], IGP: [-26, 'left', -14], ExGP: [52, 'center', 0] };
          for (const c of order) { const v = sc[c].crps, x = X(v);
            kk.dot(x, yy, 11, { color: ccol(c), ring: true, alpha: u });
            const pulse = (c === 'IGP' || c === 'ExGP') && t > 12 ? 1 : 0;
            if (pulse) kk.circle(x, yy, 18 + 5 * Math.sin((t - 12) * Math.PI * 2), { color: ccol(c), width: 2.5, alpha: .9 });
            const [dy, al, dx] = lab[c];
            kk.text(`${c} ${fmt(v, dp)}`, x + dx, yy + dy, { size: 26, weight: 600, align: al, alpha: u }); }
          // SGP off-scale arrow
          kk.arrow(box.x + box.w + 10, yy, box.x + box.w + 60, yy, { color: ccol('SGP'), width: 4, alpha: u });
          kk.text('SGP', box.x + box.w + 64, yy - 30, { size: 26, weight: 650, align: 'right', alpha: u, color: ccol('SGP') });
          kk.text(fmt(sc.SGP.crps, dp), box.x + box.w + 70, yy + 52, { size: 26, weight: 650, align: 'right', alpha: u, color: C.ink });
        }
        if (t > 12) { const i = ease(seg(t, 12, 13)); const b = cs.brazil, o = cs.ottawa;
          const w = [b['I=C'], b['I=VL+C'], o['I=C'], o['I=VL+C']].map(x => Math.abs(x.IGP.crps - x.ExGP.crps) / Math.max(x.IGP.crps, x.ExGP.crps) * 100);
          const wv = [b['I=C'], b['I=VL+C'], o['I=C'], o['I=VL+C']].map(x => x.ExGP.waic);
          kk.text(`IGP vs ExGP: \u2264 ${fmt(Math.ceil(Math.max(...w)), 0)}% apart; joint WAIC \u0394elpd ${fmt(Math.min(...wv))}\u2013${fmt(Math.max(...wv))}`, 400, 850, { size: 28, weight: 650, align: 'center', alpha: i }); }
      }
    },
  });

  /* ------------------------------------------------------------------ S24 */
  FB.scene({
    id: 'S24', part: 'Results and discussion', title: 'Does viral load improve the forecasts?', dur: 15,
    tags: [PROV],
    eq: '\\begin{aligned}\\Delta\\mathrm{CRPS}_h&=100\\,\\frac{\\mathrm{CRPS}^{\\,I=\\mathrm{VL}+C}_h-\\mathrm{CRPS}^{\\,I=C}_h}{\\mathrm{CRPS}^{\\,I=C}_h}\\end{aligned}',
    beats: [
      { at: 0, cap: 'Same model, one extra input stream. Below zero means the viral-load version forecasts better.' },
      { at: 3, cap: () => { const d = DC(); if (!d) return ''; const b = d.s24.blocks.ottawa; return `Ottawa (wastewater) improves at almost every horizon: ${fmt(-b.IGP.crps814, 0)}% and ${fmt(-b.ExGP.crps814, 0)}% lower CRPS in the second week.`; } },
      { at: 7, cap: () => { const d = DC(); if (!d) return ''; const b = d.s24.blocks.brazil; return `Brazil (PCR viral load) gains ${fmt(-b.IGP.crps814, 0)}\u2013${fmt(-b.ExGP.crps814, 0)}% in week two, but at day 6 viral load is 12\u201315% worse.`; } },
      { at: 11, cap: 'Each faint dot is one forecast origin: the pooled gain hides a wide spread.' },
      { at: 13, cap: () => { const d = DC(); if (!d) return ''; const b = d.s24.blocks.brazil; return `Deaths do not improve: Brazil death CRPS rises ${fmt(b.ExGP.dcrps, 0)}\u2013${fmt(b.IGP.dcrps, 0)}% (days 1\u201314). No stable gain.`; } },
    ],
    drawer: `<ul>
<li>\u201cWithin IGP and ExGP, adding the surveillance signal lowers the case CRPS in both settings, with larger relative improvements at 8--14 days. In Brazil the reductions are 0.4--2% at 1--7 days and 8--10% at 8--14 days. In Ottawa they are 12--13% and 24--28%, respectively.\u201d (results_preq2_main.tex:235-238)</li>
<li>\u201cthe RMSE falls by 13% in Brazil and 29--40% in Ottawa, more than the MAE does (3--4% and 20--23%). This indicates that the signal mainly removes large errors.\u201d (results_preq2_main.tex:239-242)</li>
<li>\u201cat \\(h=6\\) the Brazil IGP/ExGP CRPS is approximately 12--15% higher with viral load. A favourable block average therefore does not imply an improvement at every forecast horizon or epidemic phase.\u201d (results_preq2_main.tex:249-251)</li>
<li>MSE decomposition, IGP \\(h=8\\)-14: Brazil 655.94 \\(\\to\\) 442.36 million, about 73% of the reduction from squared bias; Ottawa 10,535.60 \\(\\to\\) 3,305.75, about 26% from squared bias, so mostly lower error variance (results_preq2_main.tex:253-266).</li>
<li>Deaths: \u201cThe sign of the Brazil change has varied with the set of common origins \u2026 so it is not a stable effect in either direction.\u201d WAIC case \\(\\Delta\\)elpd medians: Brazil 23/28, Ottawa 27/24 (IGP/ExGP); deaths \\(-0.6\\) to 3.3 (results_preq2_main.tex:268-275).</li>
<li>SGP and SGP-AI are hidden here: the large SGP gains (\\(-86\\)% in Brazil) are \u201cfixing a broken class\u201d (discussion.tex:21-23; see S27).</li>
</ul>
<p>Lines: change in mean CRPS over the common origins (outputs/paper_results_preq2/vl_crps_change_by_horizon.csv). Dots: per-origin changes recomputed by the flipbook exporter from compiled_grid/scores_cells.csv as \\(100(\\mathrm{VC}-\\mathrm C)/\\mathrm C\\) for each \\((N,h)\\); the exporter checks that the pooled lines are reproduced from the same rows. Dots beyond the axis are drawn as edge markers.</p>`,
    figure: { src: 'figures/c_vl_pred_crps_change.webp', caption: 'Paper figure fig:preq2-vl-pred (results_preq2_main.tex:283), paper colours.', alt: 'Change in CRPS by horizon' },
    flags: ['tab_vl_headline.tex (\\(h=8\\)-14 death CRPS: Brazil IGP +9%, ExGP +3%) and tab_vl_scores.tex (\\(h=1\\)-14: +7.0%, +2.0%) use different blocks; the screen quotes \\(h=1\\)-14.', 'tab_model_scores_brazil caption lists 14 origins; the table and score_origins.csv use 17.', 'Snapshot date: results_preq2_main.tex:4 says 10 October, line 24 says 12 October.'],
    source: 'results_preq2_main.tex:231-286; results/results_preq2/tab_vl_scores.tex; outputs/paper_results_preq2/vl_crps_change_by_horizon.csv, vl_effect_table.csv, score_origins.csv; compiled_grid/scores_cells.csv',
    alt: 'Two panels, Ottawa and Brazil, of percentage change in case CRPS by days ahead for IGP (violet) and ExGP (white); Ottawa lines mostly well below zero, Brazil near zero with a bump at day 6; per-origin dots; then death lines near zero.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s24, C = FB.C, k = K(D);
      const uD = ease(seg(t, 13, 14));
      k.label('IGP', 120, 52, C.igp, { size: 26 }); k.label('ExGP', 220, 52, C.exgp, { size: 26 });
      k.text('line: pooled over origins; dot: one origin', 340, 52, { size: 26, color: C.ink2 });
      const panels = [['ottawa', 'Ottawa, wastewater, 21 origins', 120, [3, 7]], ['brazil', 'Brazil, PCR viral load, 17 origins', 500, [7, 11]]];
      const yr = [-80, 80];
      for (const [ds, title, y0, [ta, tb]] of panels) {
        const box = { x: 110, y: y0, w: 520, h: 270 };
        const f = k.frame(box, [.5, 14.5], yr, { yticks: [-80, -40, 0, 40, 80], yfmt: v => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v) + '%', xticks: [[1, '1'], [7, '7'], [14, '14 days ahead']] });
        k.text(title, box.x - 60, y0 - 22, { size: 26, color: C.ink, weight: 600 });
        k.text((uD > .5 ? 'deaths' : 'cases'), box.x + box.w, y0 - 22, { size: 26, color: C.ink2, align: 'right' });
        k.rect(box.x, f.Y(0), box.w, f.Y(yr[0]) - f.Y(0), { color: C.good, alpha: .07, r: 0 });
        k.text('viral load better \u2193', box.x + 10, f.Y(yr[0]) - 12, { size: 26, color: C.good });
        k.line([[box.x, f.Y(0)], [box.x + box.w, f.Y(0)]], { color: C.ink2, width: 1.5 });
        // per-origin dots (cases only)
        const ad = seg(t, 11, 12.5) * (1 - uD);
        if (ad > 0) { const r = U.mulberry(ds === 'ottawa' ? 7 : 9);
          for (const cls of ['IGP', 'ExGP']) for (const [h, v] of s.dots[ds][cls]) { const jx = (r() - .5) * .5 + (cls === 'IGP' ? -.12 : .12);
            const vv = clamp(v, yr[0], yr[1]), off = v !== vv;
            if (off) k.arrow(f.X(h + jx), f.Y(vv) + (v > 0 ? 12 : -12), f.X(h + jx), f.Y(vv), { color: ccol(cls), width: 1.5, head: 7, alpha: .35 * ad });
            else k.dot(f.X(h + jx), f.Y(vv), 3.5, { color: ccol(cls), alpha: .32 * ad }); } }
        // lines
        const ends = [];
        for (const [out, alpha] of [['cases', 1 - uD], ['deaths', uD]]) { if (alpha <= 0) continue;
          for (const cls of ['IGP', 'ExGP']) { const L = s.lines[ds][out][cls], pts = L.map((v, i) => [f.X(i + 1), f.Y(v)]);
            const p = out === 'cases' ? ease(seg(t, ta, tb)) : 1; if (p <= 0) continue;
            k.line(D.partial(pts, p), { color: ccol(cls), width: 3.5, alpha });
            D.partial(pts, p).forEach(([x, y]) => k.dot(x, y, 4.5, { color: ccol(cls), alpha }));
            if (p > .98) ends.push([cls, f.Y(L[13]), alpha, L[13]]); } }
        // direct labels at line ends, nudged apart
        ends.sort((a, b) => a[1] - b[1]); for (let i = 1; i < ends.length; i++) if (ends[i][1] - ends[i - 1][1] < 30) ends[i][1] = ends[i - 1][1] + 30;
        ends.forEach(([cls, y, a, v]) => k.text(`${cls} ${pct(v, 0)}`, box.x + box.w + 12, y + 9, { size: 26, color: ccol(cls), weight: 600, alpha: a }));
        if (ds === 'brazil' && t > 9.6 && uD < 1) { const a = seg(t, 9.6, 10.4) * (1 - uD), v = Math.max(s.lines.brazil.cases.IGP[5], s.lines.brazil.cases.ExGP[5]);
          k.text('+12\u201315% at day 6', f.X(6), f.Y(v) - 22, { size: 26, color: C.ink, weight: 600, align: 'center', alpha: a }); }
      }
      const b = s.blocks;
      k.text(uD < .5 ? `Week two, IGP/ExGP: Ottawa ${sfmt(b.ottawa.IGP.crps814, 0)}/${pct(b.ottawa.ExGP.crps814, 0)}, Brazil ${sfmt(b.brazil.IGP.crps814, 0)}/${pct(b.brazil.ExGP.crps814, 0)}`
        : `Deaths h 1\u201314, IGP/ExGP: Brazil ${sfmt(b.brazil.IGP.dcrps, 1)}/${pct(b.brazil.ExGP.dcrps, 1)}, Ottawa ${sfmt(b.ottawa.IGP.dcrps, 1)}/${pct(b.ottawa.ExGP.dcrps, 1)}`,
      400, 880, { size: 26, color: C.ink2, align: 'center', alpha: t < 3 ? 0 : 1 });
    },
  });

  /* ------------------------------------------------------------------ S25 */
  const REFF_EQ = '\\begin{aligned}\\frac{\\mathcal R^{\\mathrm{eff},C}_{h,t}}{\\mathcal R^{\\mathrm{case}}_{h,t}}&=\\frac{q_{h,t}}{q^C_{h,t}}=\\frac{1}{1-q^{VL}_{h,t}},\\\\ \\mathcal R^{\\mathrm{eff},C}_t&=\\eigmax\\bigl(\\mathbf K_t\\mathbf D_{q_t}\\bigr)\\end{aligned}';
  FB.scene({
    id: 'S25', part: 'Results and discussion', title: 'How the signal enters: shares, coefficients and R_eff', dur: 15,
    tags: [PROV, PLUG, { text: 'Balance beam schematic', cls: 'synthetic' }],
    eq: '\\begin{aligned}(b_C,b_{VL},\\lambda_{g,t})&\\mapsto(a b_C,a b_{VL},\\lambda_{g,t}/a)\\end{aligned}',
    beats: [
      { at: 0, cap: 'Scaling the case weight up and transmission down by the same factor leaves the fitted cases unchanged. Only their product is identified.' },
      { at: 5, cap: 'The overall reproduction number barely moves with or without viral load.', eq: REFF_EQ },
      { at: 8, cap: () => { const d = DC(); if (!d) return ''; const a = d.s25.brazil.age; const c = a['IGP|I=C|VL-apportioned'], v = a['IGP|I=VL+C|VL-apportioned']; return `But the age split moves. In Brazil, adults 18\u201340 rise from ${fmt(c[1], 2)} to ${fmt(v[1], 2)}; children fall from ${fmt(c[0], 2)} to ${fmt(v[0], 2)}.`; }, eq: REFF_EQ },
      { at: 12, cap: 'Ottawa has one city-wide wastewater coefficient, so its age profile hardly changes. Age splits depend on the active set.', eq: REFF_EQ },
    ],
    drawer: `<p>With \\(I_{g,t}=b_CY_{g,t}+b_{VL}V_{g,t}\\), the rescaling \\((b_C,b_{VL},\\lambda_{g,t})\\mapsto(ab_C,ab_{VL},\\lambda_{g,t}/a)\\) leaves the case mean unchanged (results_preq2_main.tex:346-353). With \\(I=C\\) the four intercepts \\(\\mu^\\lambda_g\\) have posterior correlation 0.99-1.00 with each other and \\(-0.92\\) to \\(-0.94\\) with \\(b_C\\) (355-360). In Brazil \\(I=\\mathrm{VL}+C\\), \u201cthe posterior of \\(b_C\\) collapses to about 0.001 against a half-normal prior of scale 2\u201d and \\(\\lambda\\) rises to 0.47, 1.0, 1.5 (372-377).</p>
<ul>
<li><b>VL fraction</b> \\(q^{VL}_{g,t}=b_{VL}V_{g,t}/I_{g,t}\\): Brazil 85-99%; Ottawa 10-50%, rising to 75-100% in summer 2021; it \u201cneed not indicate an increase in wastewater concentration or a measured fraction of unreported infections\u201d (results_preq2_main.tex:384-395).</li>
<li><b>Sublinear powers:</b> IGP \\(p_{VL}\\approx0.2\\)-0.4 (Brazil) and 0.15 (Ottawa); doubling the input multiplies its contribution by \\(2^{p_{VL}}\\approx1.11\\)-1.32 (397-403).</li>
<li>\u201cthe recombined number is robust to the active set wherever the class is age-specific\u201d (439-440). \u201cThe age-specific reproduction numbers are therefore conditional on the active set and should not be read as estimates of age-specific infectiousness.\u201d (464-466)</li>
<li>Recombined values are exact posterior medians (Perron roots saved by Stan); age values are plug-in medians whose Perron root agrees with the exact median within 8% (433-437).</li>
</ul>
<p>Numbers on screen: training-window medians (\\(t>30\\)) of the IGP posterior medians in outputs/paper_reff_mech/reff_{age,pop}_{brazil,ottawa}.csv, recomputed by the exporter.</p>`,
    figure: { src: 'figures/c_reff_mech_brazil.webp', caption: 'Paper figure fig:preq2-reff-mech-brazil (results_preq2_main.tex:472): R_eff by source age and recombined, every class, Brazil.', alt: 'R_eff mechanism figure, Brazil' },
    flags: ['\\(q^{VL}\\) means two things in the paper: the VL gain component at main.tex:1776-1779 and the VL fraction \\(b_{VL}V/I\\) at results_preq2_main.tex:385, 431. The identity \\(1/(1-q^{VL})\\) holds only for the fraction, which the flipbook uses.', 'main.tex:1771 sets the cases-only gain to 1; the fitted \\(I=C\\) active set is \\(b_C\\sum\\Crep\\), so \\(q^{I=C}=b_C\\).', 'The fitted VL term raises the daily sum \\(\\VLsum_{g,s}\\) to \\(p_{VL,g}\\) (age-specific in Brazil, one city-wide coefficient in Ottawa), not \\(\\psi(\\VL)\\) with scalar \\(b_{VL}\\) as in Methods.', 'Recomputed medians round slightly differently from the text (Brazil IGP 65+: 0.79 here vs 0.78 at results_preq2_main.tex:452; Ottawa IGP 40-65 with \\(I=C\\): 0.83 vs 0.82).'],
    source: 'results_preq2_main.tex:333-468; main.tex:1742-1781; outputs/paper_reff_mech/reff_age_brazil.csv, reff_age_ottawa.csv, reff_pop_brazil.csv, reff_pop_ottawa.csv',
    alt: 'A balance beam keeps the fitted cases fixed while the case weight and transmission trade off; then bars of recombined R_eff for Brazil and Ottawa, and age bars that change between active sets in Brazil but not in Ottawa.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s25, C = FB.C;
      const a1 = win(t, 0, 4.6), a2 = win(t, 4.6, null);
      if (a1 > 0) { const k = K(D, a1);
        // fixed fitted case curve (schematic)
        const box = { x: 120, y: 90, w: 560, h: 220 }, pts = [];
        for (let i = 0; i <= 60; i++) { const x = i / 60; pts.push([box.x + x * box.w, box.y + box.h - (Math.exp(-((x - .45) ** 2) / .03) * .8 + .1) * box.h]); }
        k.line(pts, { color: C.cases, width: 4 }); k.text('fitted reported cases: unchanged', box.x, box.y - 10, { size: 26, color: C.ink2 });
        const la = Math.log(2.2) * Math.sin(Math.PI * t / 2.2), a = Math.exp(la);
        const cx = 400, cy = 560;
        k.line([[cx - 280, cy], [cx + 280, cy]], { color: C.ink2, width: 6 });
        ctx.save(); ctx.globalAlpha = a1; ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx - 34, cy + 64); ctx.lineTo(cx + 34, cy + 64); ctx.closePath(); ctx.fill(); ctx.restore();
        const rl = 34 * Math.sqrt(a), rr = 34 / Math.sqrt(a);
        k.dot(cx - 220, cy - rl, rl, { color: C.cases }); k.dot(cx + 220, cy - rr, rr, { color: C.ink2 });
        k.text('case weight b', cx - 226, cy + 60, { size: 30, weight: 650, align: 'center' }); k.text('C', cx - 226 + 98, cy + 70, { size: 26, weight: 650 }); k.text('\u00d7 a', cx - 220, cy + 100, { size: 30, weight: 650, align: 'center' });
        k.text('transmission \u03bb', cx + 220, cy + 60, { size: 30, weight: 650, align: 'center' }); k.text('\u00f7 a', cx + 220, cy + 100, { size: 30, weight: 650, align: 'center' });
        k.text(`a = ${fmt(a, 2)}`, cx, cy + 160, { size: 30, color: C.ink, align: 'center' });
        k.text('Only the product of case weight and transmission is identified', 400, 790, { size: 26, color: C.ink2, align: 'center', maxW: 680 });
      }
      if (a2 > 0) { const k = K(D, a2);
        k.label('Cases Contribution', 110, 48, C.cases, { size: 26 }); k.label('Viral Load Contribution', 400, 48, C.vl, { size: 26 });
        k.text('Recombined reproduction number, IGP, training-window median', 60, 100, { size: 26, color: C.ink2 });
        const X = v => 260 + v / 1.2 * 460, gb = seg(t, 5, 7);
        [['brazil', 'Brazil', 162], ['ottawa', 'Ottawa', 312]].forEach(([ds, nm, y0]) => {
          const p = s[ds].pop, rc = p['IGP|I=C|VL-apportioned'], rv = p['IGP|I=VL+C|VL-apportioned'], ch = p['IGP|I=VL+C|case channel'];
          k.text(nm, 60, y0 - 12, { size: 28, weight: 650 });
          k.text('Cases-Only', 245, y0 + 18, { size: 26, color: C.ink2, align: 'right' }); k.text('Viral-Load', 245, y0 + 72, { size: 26, color: C.ink2, align: 'right' });
          k.rect(X(0), y0, (X(rc) - X(0)) * gb, 26, { color: C.cases, r: 3 });
          k.rect(X(0), y0 + 54, (X(ch) - X(0)) * gb, 26, { color: C.cases, r: 3 });
          k.rect(X(ch * gb), y0 + 54, (X(rv) - X(ch)) * gb, 26, { color: C.vl, r: 3 });
          k.text(fmt(rc, 2), X(rc) + 10, y0 + 22, { size: 26, weight: 650, alpha: gb }); k.text(fmt(rv, 2), X(rv) + 10, y0 + 76, { size: 26, weight: 650, alpha: gb });
          k.text(`case channel ${fmt(ch, 2)}`, X(0) + 6, y0 + 112, { size: 26, color: C.muted, alpha: gb });
        });
        k.line([[X(1), 150], [X(1), 440]], { color: C.ink2, width: 1.5, dash: [6, 6] }); k.text('1', X(1), 466, { size: 26, color: C.muted, align: 'center' });
        // age bars
        const ga = seg(t, 8, 9.2);
        if (ga > 0) { const kk = K(D, a2 * ga), m = ease(seg(t, 12, 13.6));
          const ages = ['0\u201318', '18\u201340', '40\u201365', '65+'];
          const ag = ds => s[ds].age, cB = ag('brazil')['IGP|I=C|VL-apportioned'], vB = ag('brazil')['IGP|I=VL+C|VL-apportioned'], cO = ag('ottawa')['IGP|I=C|VL-apportioned'], vO = ag('ottawa')['IGP|I=VL+C|VL-apportioned'];
          const box = { x: 110, y: 540, w: 600, h: 250 };
          const f = kk.frame(box, [0, 4], [0, 1.6], { yticks: [0, .5, 1, 1.5], yfmt: v => v.toFixed(1) });
          kk.text(`Reproduction number by source age, ${m < .5 ? 'Brazil' : 'Ottawa'} IGP`, 60, 510, { size: 26, color: C.ink2 });
          const grow = ease(seg(t, 8.6, 10.4));
          for (let g = 0; g < 4; g++) { const c = lerp(cB[g], cO[g], m), v = lerp(c, lerp(vB[g], vO[g], m), grow), bw = 52, x = f.X(g + .5);
            kk.rect(x - bw - 4, f.Y(c), bw, f.Y(0) - f.Y(c), { color: C.cases, r: 3 }); kk.rect(x + 4, f.Y(v), bw, f.Y(0) - f.Y(v), { color: C.vl, r: 3 });
            kk.text(fmt(c, 2), x - bw / 2 - 4, f.Y(c) - 10, { size: 26, align: 'center' }); kk.text(fmt(v, 2), x + bw / 2 + 4, f.Y(v) - 10, { size: 26, align: 'center' });
            kk.text(ages[g], x, box.y + box.h + 36, { size: 26, color: C.muted, align: 'center' }); }
          kk.label('Cases-Only Active Set', 130, 870, C.cases, { size: 26 }); kk.label('Viral-Load Active Set', 450, 870, C.vl, { size: 26 });
        }
      }
    },
  });

  /* ------------------------------------------------------------------ S26 */
  FB.scene({
    id: 'S26', part: 'Results and discussion', title: 'Wastewater in three cities: Ottawa yes, Toronto and Scotland no', dur: 15,
    tags: [{ text: 'Interim: 42-day grid, single-origin cells' }, PROV],
    eq: '\\begin{aligned}W_t&=\\frac{1}{|S_N|}\\sum_{s\\in S_N}\\widetilde W_{s,t},\\\\ \\widetilde W_{s,t}&=W_{s,a}+\\frac{t-a}{b-a}\\bigl(W_{s,b}-W_{s,a}\\bigr),\\ \\ a<t<b\\end{aligned}',
    beats: [
      { at: 0, cap: 'Three cities. Each dot is one model fit at one forecast date where both versions passed the convergence screen.' },
      { at: 4, cap: () => { const d = DC(); if (!d) return ''; const o = d.s26.summary.ottawa; return `Ottawa: wastewater lowered forecast error in ${o.lower} of ${o.n} comparisons, median ${pct(o.median)}.`; } },
      { at: 8, cap: () => { const d = DC(); if (!d) return ''; const T = d.s26.summary.toronto, S = d.s26.summary.scotland; return `Toronto ${T.lower} of ${T.n} better (median ${pct(T.median)}), Scotland ${S.lower} of ${S.n} (${pct(S.median)}): effectively no gain.`; } },
      { at: 12, cap: 'The fitted wastewater power is small, so the term acts like a nearly constant extra push. Interim results.', eq: '\\begin{aligned}I_t&=b_C\\textstyle\\sum_{s\\in\\mathcal W_t}\\Crep_s+b_{VL}\\sum_{s\\in\\mathcal W_t}W_s^{\\,p_{VL}}\\\\ 10^{0.1}&\\approx1.26\\end{aligned}' },
    ],
    drawer: `<ul>
<li>\u201cIn sample, wastewater improves the case WAIC by more than two paired standard errors in 19 of them and worsens it in 12; out of sample, the 14-day case CRPS is lower with wastewater in 43 and higher in 17.\u201d (results_ww_sp.tex:22)</li>
<li>\u201cThe forecasting benefit is therefore confined to Ottawa; in Toronto and Scotland the wastewater signal as currently entered gives none.\u201d (results_ww_sp.tex:22)</li>
<li>The fitted power is small (posterior medians 0.07-0.60 in converged cells); at \\(p_V=0.1\\) a tenfold change in the signal changes its contribution by \\(10^{0.1}\\approx1.26\\). The median share of the active set on the last training day is 1% for SGP, 47% for IGP, 42% for ExGP (results_ww_sp.tex:22).</li>
<li>The three series differ in scale by more than three orders of magnitude (median daily proxy about 20 Toronto, 2,850 Ottawa, 26,900 Scotland) under one shared prior for \\(b_V\\) (results_ww_sp.tex:22).</li>
<li>Convergence: Toronto passes SGP 11/12, SGP-AI 3/12, IGP 6/12, ExGP 6/12; Scotland SGP 11/14, SGP-AI 12/14, IGP 8/13, ExGP 3/12. Failures are multimodality linked to the weekly reporting cycle (results_ww_sp.tex:9).</li>
<li>Toronto deaths are dated by episode date (main.tex:2024-2026; discussion.tex:152-157). The Scotland site panel changes with each origin (13-22 sites), chosen from training data only (results_preq2_appendix.tex:255-260, 303-309).</li>
</ul>
<p>Dots: the 60 cells of tab_ww_vl_effect.csv with both_pass = TRUE; per-city counts, medians and WAIC tallies recomputed by the exporter and matching results_ww_sp.tex:22. Curves in the inset are \\(v^{p}\\) for illustrative \\(p\\) inside the fitted range.</p>`,
    figure: { src: 'figures/c_fig_ww_sp_rho.webp', caption: 'Paper figure: transmission length scales by data set (results_ww_sp.tex:13).', alt: 'Length scales by data set' },
    flags: ['results_ww_sp.tex:9 contains generator artefacts (\u201c\\(P(\\rho<5)\\ge0.00\\)\u201d, \u201cvl_power 90% interval is [--, --]\u201d for \\(I=C\\) fits).', 'results/results_ww_preq2/tab_vl_headline.tex is empty, so there are no pooled Toronto/Scotland headline numbers.', 'The Discussion (dated 10-10) does not mention this null result.'],
    source: 'results/ww_sp_20261010/results_ww_sp.tex:4-23; PAPER/results/ww_sp_20261010/tab_ww_vl_effect.csv; results_preq2_appendix.tex:255-260',
    alt: 'Strip plot of percentage change in 14-day case CRPS with wastewater for Ottawa, Toronto and Scotland; Ottawa dots mostly left of zero, the others centred on zero; inset of power curves.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s26, C = FB.C, k = K(D);
      CLASSES.forEach((c, i) => k.label(c, 70 + i * 190, 50, ccol(c), { size: 26 }));
      const box = { x: 160, y: 120, w: 560, h: 420 }, xr = [-70, 100];
      const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w;
      const a0 = ease(seg(t, 0, 1.5));
      k.rect(box.x, box.y, X(0) - box.x, box.h, { color: C.good, alpha: .07 * a0, r: 0 });
      k.text('\u2190 wastewater better', X(0) - 10, box.y + box.h + 76, { size: 26, color: C.good, align: 'right', alpha: a0 });
      k.line([[X(0), box.y], [X(0), box.y + box.h]], { color: C.ink2, width: 1.5, alpha: a0 });
      for (const v of [-60, -30, 0, 30, 60, 90]) k.text((v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v) + '%', X(v), box.y + box.h + 36, { size: 26, color: C.muted, align: 'center', alpha: a0 });
      k.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], { color: C.axis, width: 1.5, alpha: a0 });
      k.text('% change in 14-day case CRPS with wastewater', box.x + box.w, box.y - 14, { size: 26, color: C.ink2, align: 'right', alpha: a0 });
      const rows = [['ottawa', 'Ottawa', 200, 4, 7.5], ['toronto', 'Toronto', 340, 8, 9.8], ['scotland', 'Scotland', 470, 9.8, 11.6]];
      const r = U.mulberry(17);
      for (const [ds, nm, yc, ta, tb] of rows) {
        const sm = s.summary[ds], pts = s.rows.filter(x => x[0] === ds), ra = seg(t, ta - .6, ta);
        k.text(nm, 30, yc + 9, { size: 28, weight: 650, alpha: ra }); k.line([[box.x, yc], [box.x + box.w, yc]], { color: C.grid, width: 1, alpha: ra });
        pts.forEach((p, i) => { const ti = ta + (tb - ta) * i / pts.length, u = seg(t, ti, ti + .4), jy = (r() - .5) * 56; if (u <= 0) return;
          k.dot(X(p[3]), lerp(yc - 90, yc + jy, ease(u)), 7, { color: ccol(p[1]), ring: true, alpha: Math.min(1, u * 2) }); });
        const ma = seg(t, tb, tb + .5);
        if (ma > 0) { k.line([[X(sm.median), yc - 40], [X(sm.median), yc + 40]], { color: C.ink, width: 4, alpha: ma });
          k.text(`${sm.lower}/${sm.n} lower, median ${pct(sm.median)}`, box.x + box.w, yc - 44, { size: 26, color: C.ink, weight: 600, align: 'right', alpha: ma }); }
      }
      // inset: v^p over a tenfold range
      const ia = seg(t, 12, 13);
      if (ia > 0) { const kk = K(D, ia), ib = { x: 160, y: 722, w: 420, h: 130 };
        kk.text('Contribution v\u1d56 over a tenfold range of the signal', 60, 662, { size: 26, color: C.ink2 });
        kk.text(`fitted powers ${fmt(s.powerRange[0], 2)}\u2013${fmt(s.powerRange[1], 2)} (posterior medians)`, 60, 696, { size: 26, color: C.muted });
        const Xi = v => ib.x + (v - 1) / 9 * ib.w, Yi = v => ib.y + ib.h - (v - 1) / 3.2 * ib.h;
        kk.line([[ib.x, ib.y + ib.h], [ib.x + ib.w, ib.y + ib.h]], { color: C.axis, width: 1.5 }); kk.line([[ib.x, ib.y], [ib.x, ib.y + ib.h]], { color: C.axis, width: 1.5 });
        kk.text('1\u00d7', ib.x, ib.y + ib.h + 32, { size: 26, color: C.muted, align: 'center' }); kk.text('10\u00d7', ib.x + ib.w, ib.y + ib.h + 32, { size: 26, color: C.muted, align: 'center' });
        [[.1, 1], [.3, .75], [.6, .5]].forEach(([p, al]) => { const pts = []; for (let i = 0; i <= 40; i++) { const v = 1 + 9 * i / 40; pts.push([Xi(v), Yi(Math.pow(v, p))]); }
          kk.line(D.partial(pts, ease(seg(t, 12.2, 13.6))), { color: C.vl, width: 3.5, alpha: al });
          kk.text(`p = ${p}: \u00d7${fmt(Math.pow(10, p), 2)}`, ib.x + ib.w + 16, Yi(Math.pow(10, p)) + 9, { size: 26, color: C.ink, alpha: seg(t, 13.4, 14) }); });
      }
    },
  });

  /* ------------------------------------------------------------------ S27 */
  const AS = [
    { v: 'I=VL+C', name: 'I = VL + C', shape: 'circle', col: () => FB.C.vl, filledAlways: false },
    { v: 'I=VLxC', name: 'I = VL \u00d7 C', shape: 'cross', col: () => FB.C.vl },
    { v: 'I=C^a', name: 'I = C^a', shape: 'square', col: () => FB.C.cases },
    { v: 'I=VL+Cfix', name: 'I = VL + C fix', shape: 'diamond', col: () => FB.C.vl },
  ];
  FB.scene({
    id: 'S27', part: 'Results and discussion', title: 'S\u00e3o Paulo: five ways to build the active set', dur: 15,
    tags: [{ text: 'Interim: 51 of 75 fits, single origins' }, PROV],
    eq: '\\begin{aligned}I=C:&\\ \\ I_{g,t}=b_C\\textstyle\\sum_{s\\in\\mathcal W_t}\\Crep_{g,s}\\\\ I=\\mathrm{VL}+C:&\\ \\ I_{g,t}=b_C\\textstyle\\sum_{s\\in\\mathcal W_t}\\Crep_{g,s}\\\\&\\qquad+b_{VL,g}\\textstyle\\sum_{s\\in\\mathcal W_t}\\bigl(\\VLsum_{g,s}\\bigr)^{p_{VL,g}}\\end{aligned}',
    beats: [
      { at: 0, cap: 'Five recipes for \u201cinfectious pressure\u201d: cases only, plus viral load, cases times viral load, bent cases, and a fixed case weight.' },
      { at: 4, cap: 'Viral load rescues only the shared-curve model (SGP), replacing age structure it lacked. Age-specific models gain little.' },
      { at: 8, cap: 'Weighting each case by viral load fits worse than cases alone, losing 18\u201335 log-likelihood points.', eq: '\\begin{aligned}I=\\mathrm{VL}\\times C:&\\ \\ I_{g,t}=b_{VL,g}\\textstyle\\sum_{s\\in\\mathcal W_t}\\Crep_{g,s}\\\\&\\qquad\\times\\bigl(\\VLsum_{g,s}/\\overline{\\VL}_g\\bigr)^{p_{VL,g}}\\end{aligned}' },
      { at: 12, cap: () => { const d = DC(); if (!d) return ''; const p = d.s27.power; return `Bending case counts (power ${fmt(p.ExGP[0], 2)}\u2013${fmt(p.IGP[0], 2)} at the first origin) gives the largest in-sample gain. Forecasts are mixed. Interim.`; }, eq: '\\begin{aligned}I=C^{a}:&\\ \\ I_{g,t}=b_C\\textstyle\\sum_{s\\in\\mathcal W_t}\\bigl[(\\Crep_{g,s}+1)^{a}-1\\bigr]\\\\ I=\\mathrm{VL}+C_{\\mathrm{fix}}:&\\ \\ b_C\\equiv1\\ \\text{in}\\ I=\\mathrm{VL}+C\\end{aligned}' },
    ],
    drawer: `<p>Over \\(\\mathcal W_t=\\{t-\\tau+1,\\ldots,t\\}\\) the five active sets are (results_active_set_sp.tex:21-31):
\\[\\begin{aligned}I=C:&\\ I_{g,t}=b_C\\textstyle\\sum_{s}\\Crep_{g,s}\\\\ I=\\mathrm{VL}+C:&\\ I_{g,t}=b_C\\textstyle\\sum_{s}\\Crep_{g,s}+b_{VL,g}\\sum_{s}(\\VLsum_{g,s})^{p_{VL,g}}\\\\ I=\\mathrm{VL}\\times C:&\\ I_{g,t}=b_{VL,g}\\textstyle\\sum_{s}(\\VLsum_{g,s}/\\overline{\\VL}_g)^{p_{VL,g}}\\Crep_{g,s}\\\\ I=C^{a}:&\\ I_{g,t}=b_C\\textstyle\\sum_{s}[(\\Crep_{g,s}+1)^{a}-1],\\ a\\sim\\mathrm{LogNormal}(0,1)\\\\ I=\\mathrm{VL}+C_{\\mathrm{fix}}:&\\ I_{g,t}=\\textstyle\\sum_{s}\\Crep_{g,s}+b_{VL,g}\\sum_{s}(\\VLsum_{g,s})^{p_{VL,g}}\\end{aligned}\\]
Each contains \\(I=C\\) as a special case (\\(a=1\\); \\(b_{VL,g}=0\\); \\(p_{VL,g}=0\\)).</p>
<ul>
<li>\u201cWe read the SGP result as a correction of the class, not evidence that viral load measures infectiousness.\u201d (results_active_set_sp.tex:67-68)</li>
<li>\u201cIn the age-specific classes viral load adds little. In \\(I=\\mathrm{VL}+C\\) it carries 16--25% of the active set\u201d (73-74).</li>
<li>\u201c\\(I=\\mathrm{VL}\\times C\\) is the only active set that fits the data worse than \\(I=C\\) in the age-specific classes\u201d (82-84). \\(\\VLsum\\) moves with test volume, so it acts as a multiplier on each case (89-91). All three SGP VL\\(\\times\\)C fits split (\\(\\widehat R\\) 1.66-2.45) (48-50).</li>
<li>\\(C^a\\): \u201cWith \\(a\\approx0.5\\), doubling the reported cases raises the infectious pressure by a factor \\(2^{a}\\approx1.4\\)\u201d; one explanation is ascertainment rising with incidence (102-105). Forecasts mixed: IGP \\(-11\\)% CRPS, ExGP \\(+20\\)%/\\(+9\\)% (101-102).</li>
<li>The recombined \\(\\Reff\\) is robust (1.03-1.06 for every active set in IGP/ExGP at \\(N=180\\)); the age profile is not: VL\\(\\times\\)C concentrates offspring at 18-40 (IGP 1.62, ExGP 1.87) (109-133).</li>
<li>Convergence: 20 of 51 fits pass; 19 fail marginally, 12 severely (46-56). Comparisons against a severely failing \\(I=C\\) baseline are omitted, as in the paper figure.</li>
</ul>
<p>Points: outputs/paper_active_set_sp/paired_vs_IC.csv with any_severe = FALSE; filled = both fits pass, open = marginal failure; bars \\(\\pm2\\) paired SE. Case power \\(a\\): fold_summary.csv.</p>`,
    figure: { src: 'figures/c_fig_as_sp_scores.webp', caption: 'Paper figure fig:as-sp-scores (results_active_set_sp.tex:153), paper colours.', alt: 'Sao Paulo active set scores' },
    flags: ['The older Methods active sets (main.tex:1557-1562: lag 1, intercept \\(b_1\\)) are superseded; the window form is used.', 'Methods write \\(I=\\mathrm{VL}\\times C\\) un-normalised (main.tex:1772-1775); the fitted variant divides by \\(\\overline{\\VL}_g\\).', 'The Discussion does not yet report these S\\~ao Paulo findings.'],
    source: 'results/results_active_set_sp.tex:8-150; outputs/paper_active_set_sp/paired_vs_IC.csv, fold_summary.csv',
    alt: 'Five recipe cards; then paired differences against cases-only for SGP, IGP and ExGP: in-sample case ELPD with error bars and forecast CRPS change; finally the posterior case power below 1.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s27, C = FB.C;
      const a1 = win(t, 0, 3.9), a2 = win(t, 4.5, null);
      if (a1 > 0) { const k = K(D, a1);
        const cards = [['I = C', 'cases only', 'c'], ['I = VL + C', 'cases plus viral load', 'cv'], ['I = VL \u00d7 C', 'each case weighted by viral load', 'x'], ['I = C^a', 'bent case counts', 'a'], ['I = VL + C fix', 'case weight fixed at 1', 'cv']];
        cards.forEach(([nm, sub, kind], i) => { const u = ease(seg(t, i * .35, i * .35 + .8)), y = 70 + i * 160 + (1 - u) * 40; if (u <= 0) return; const kk = K(D, a1 * u);
          kk.rect(40, y, 720, 136, { color: C.surface2, r: 14 });
          kk.text(nm, 70, y + 56, { size: 32, weight: 700 }); kk.text(sub, 70, y + 100, { size: 26, color: C.ink2 });
          const hs = [30, 52, 40, 64, 46], x0 = 520;
          hs.forEach((h, j) => { let hh = h; if (kind === 'a') hh = Math.pow(h, .6) * 5.1; if (kind === 'x') hh = h * [1.4, .6, 1.2, .8, 1.1][j];
            kk.rect(x0 + j * 30, y + 118 - hh * .9, 22, hh * .9, { color: C.cases, r: 2 }); });
          if (kind === 'cv') kk.rect(x0 + 160, y + 118 - 52, 28, 52, { color: C.vl, r: 2 });
          if (kind === 'x') kk.text('\u00d7 VL', x0 + 160, y + 80, { size: 26, color: C.vl, weight: 650 });
        });
      }
      if (a2 > 0) { const k = K(D, a2), cls3 = ['SGP', 'IGP', 'ExGP'];
        AS.forEach((A, i) => { const x = 70 + (i % 2) * 360, y = 44 + Math.floor(i / 2) * 40; marker(ctx, k, A.shape, x, y - 9, 9, A.col(), true); k.text(A.name, x + 22, y, { size: 26, weight: 600 }); });
        const focus = t < 8 ? 'I=VL+C' : t < 12 ? 'I=VLxC' : 'I=C^a';
        const box = { x: 120, y: 205, w: 620, h: 270 }, yr = [-60, 170];
        const f = k.frame(box, [0, 3], yr, { yticks: [-40, 0, 40, 80, 120, 160], yfmt: v => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v) });
        k.text('Δ case ELPD vs I = C, ±2 SE', 60, 138, { size: 26, color: C.ink2 });
        k.line([[box.x, f.Y(0)], [box.x + box.w, f.Y(0)]], { color: C.ink2, width: 1.5 });
        cls3.forEach((c, ci) => { k.text(c, f.X(ci + .5), box.y - 14, { size: 28, weight: 700, align: 'center', color: ccol(c) }); if (ci) k.line([[f.X(ci), box.y], [f.X(ci), box.y + box.h]], { color: C.grid, width: 1 }); });
        const xpos = (row) => { const ci = cls3.indexOf(row.cls), ai = AS.findIndex(A => A.v === row.v), Ns = [180, 222, 264, 306, 348];
          return ci + .14 + ai * .2 + Ns.indexOf(row.N) * .045; };
        const g = seg(t, 4.9, 6.2);
        const pv = ease(seg(t, 12, 12.8));
        // severe own-fit failures: dashed ring + double dagger; off-scale values as edge arrows
        const point = (kk, A, row, x, yv, lo, hi, range, Yf) => {
          const off = yv < range[0] || yv > range[1], y = Yf(clamp(yv, range[0], range[1]));
          if (lo != null && !off) kk.line([[x, Yf(clamp(lo, range[0], range[1]))], [x, Yf(clamp(hi, range[0], range[1]))]], { color: A.col(), width: 2, dash: row.sev ? [4, 4] : null });
          if (off) { kk.arrow(x, y + (yv < range[0] ? -16 : 16), x, y + (yv < range[0] ? 4 : -4), { color: A.col(), width: 2.5, head: 9 }); kk.text('‡', x + 8, y + (yv < range[0] ? -6 : 22), { size: 26, color: C.ink2 }); return; }
          marker(ctx, kk, A.shape, x, y, 7.5, A.col(), row.bp && !row.sev);
          if (row.sev) kk.text('‡', x + 10, y - 8, { size: 26, color: C.ink2 });
        };
        for (const row of s.rows) { const A = AS.find(A => A.v === row.v); if (!A) continue; const al = (row.v === focus ? 1 : .28) * g; const kk = K(D, a2 * al);
          point(kk, A, row, f.X(xpos(row)), row.de, row.de - 2 * row.se, row.de + 2 * row.se, yr, f.Y); }
        const ann = { 'I=VL+C': 'SGP: +92 and +114', 'I=VLxC': 'IGP, ExGP: −18 to −35', 'I=C^a': 'Cᵃ: +16 to +51' }[focus];
        k.text(ann, box.x + box.w, 138, { size: 26, weight: 650, align: 'right', alpha: g });
        // bottom: CRPS change, then posterior case power
        const b1 = g * (1 - pv);
        if (b1 > 0) { const kk = K(D, a2 * (1 - pv)), bb = { x: 120, y: 590, w: 620, h: 220 }, yr2 = [-100, 190];
          const f2 = kk.frame(bb, [0, 3], yr2, { yticks: [-80, 0, 80, 160], yfmt: v => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v) + '%' });
          kk.text('Δ 14-day case CRPS vs I = C (forecast)', 60, 560, { size: 26, color: C.ink2 });
          kk.line([[bb.x, f2.Y(0)], [bb.x + bb.w, f2.Y(0)]], { color: C.ink2, width: 1.5 });
          cls3.forEach((c, ci) => { if (ci) kk.line([[f2.X(ci), bb.y], [f2.X(ci), bb.y + bb.h]], { color: C.grid, width: 1 }); });
          for (const row of s.rows) { const A = AS.find(A => A.v === row.v); if (!A || row.pct == null) continue; const al = (row.v === focus ? 1 : .28) * g;
            point(K(D, a2 * (1 - pv) * al), A, row, f2.X(xpos(row)), row.pct, null, null, yr2, f2.Y); }
          kk.text('below zero: better', 740, 560, { size: 26, color: C.good, align: 'right' });
        }
        if (pv > 0) { const kk = K(D, a2 * pv), bx = { x: 200, y: 640, w: 520 }, X = v => bx.x + v / 1.2 * bx.w;
          kk.text('Posterior case power a, first origin (N = 180)', 60, 570, { size: 26, color: C.ink2 });
          [['IGP', 640], ['ExGP', 730]].forEach(([c, y]) => { const [m, lo, hi, ok] = s.power[c];
            kk.text(c, 180, y + 9, { size: 28, weight: 650, align: 'right', color: ccol(c) });
            kk.line([[X(lo), y], [X(hi), y]], { color: C.cases, width: 8 }); marker(ctx, kk, 'square', X(m), y, 10, C.cases, ok);
            kk.text(`${fmt(m, 2)} [${fmt(lo, 2)}, ${fmt(hi, 2)}]`, X(lo), y + 42, { size: 26 }); });
          kk.line([[X(1), 610], [X(1), 800]], { color: C.ink, width: 2, dash: [8, 6] }); kk.text('a = 1: proportional to cases', X(1), 830, { size: 26, color: C.ink2, align: 'center' });
          [0, .5].forEach(v => kk.text(String(v), X(v), 830, { size: 26, color: C.muted, align: 'center' }));
        }
        k.text('filled: both pass · open: marginal fail · ‡: severe fail', 400, 885, { size: 26, color: C.muted, align: 'center', alpha: g });
      }
    },
  });

  /* ------------------------------------------------------------------ S28 */
  FB.scene({
    id: 'S28', part: 'Results and discussion', title: 'Accurate on average, but intervals too narrow', dur: 15,
    tags: [PROV, { text: 'Net schematic; rate is real', cls: 'synthetic' }],
    eq: '\\begin{aligned}c_{0.9}&=\\lvert\\mathcal S\\rvert^{-1}\\textstyle\\sum_{i\\in\\mathcal S}\\mathbb I\\{q_{0.05,i}\\le y_i\\le q_{0.95,i}\\}\\end{aligned}',
    beats: [
      { at: 0, cap: 'A 90% forecast range should contain the real count 9 times in 10.' },
      { at: 4, cap: 'Ours contain it 70\u201389% of the time in Brazil and 72\u201390% in Ottawa. The ranges are too narrow.' },
      { at: 8, cap: () => { const d = DC(); if (!d) return ''; const b = d.s28.blocks.brazil; return `Adding viral load does not reliably fix this: Brazil\u2019s week-two coverage goes from ${fmt(b['IGP|I=C']['8-14'], 2)} to ${fmt(b['IGP|I=VL+C']['8-14'], 2)}.`; } },
      { at: 12, cap: 'Likely causes: frozen future viral load, no simulated noise in the recursion, and the weekly reporting cycle.' },
    ],
    drawer: `<ul>
<li>\u201cImproved average scores coexist with undercoverage. For SGP-AI, IGP and ExGP, empirical coverage of nominal 90% case intervals is 0.70--0.89 in Brazil and 0.72--0.90 in Ottawa\u201d (results_preq2_main.tex:517-519).</li>
<li>\u201cAverage predictive accuracy and interval calibration therefore need separate assessment.\u201d (results_preq2_main.tex:524-525)</li>
<li>Coverage is diagnostic, not a proper score (main.tex:2187-2191); CRPS judges the whole distribution, coverage one feature of it (discussion.tex:102-105).</li>
<li>Undercoverage sources (discussion.tex:111-122): future viral load fixed at the last-5-day mean; the recursion uses expected future cases; the weekly reporting cycle is unmodelled. \u201cTheir individual effects on coverage have not been quantified.\u201d</li>
<li>Case dispersion \\(\\phi_C\\approx3\\) (Brazil) and \\(\\approx5\\) (Ottawa) gives a coefficient of variation of about 0.58/0.45, much of it the weekly cycle (results_preq2_appendix.tex:341-345).</li>
<li>\u201cWith only 17 origins, single-horizon Brazil coverage changes in steps of \\(1/17\\).\u201d Origin-bootstrap intervals ignore dependence (results_preq2_main.tex:533-535).</li>
</ul>
<p>Lines: cover90 by horizon from outputs/paper_results_preq2/scores_by_horizon.csv; block table from scores_common_origins.csv. The falling-dot net is a schematic of the rate.</p>`,
    figure: { src: 'figures/c_scores_by_horizon_brazil.webp', caption: 'Paper figure: scores by horizon, Brazil (results_editorial_support.tex:121), paper colours.', alt: 'Scores by horizon, Brazil' },
    source: 'results_preq2_main.tex:513-537; discussion.tex:100-122; outputs/paper_results_preq2/scores_by_horizon.csv, scores_common_origins.csv',
    alt: 'Ten interval bars catch falling dots, nine of ten then about seven of ten; coverage-by-horizon lines for Brazil and Ottawa sit below the 0.90 line; a table of week-two coverage.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const s = d.s28, C = FB.C, k = K(D);
      // net (schematic of the rate): intervals catch falling observations
      const rate = s.blocks.brazil['IGP|I=VL+C']['8-14'], nIn = Math.round(rate * 10);
      const phase2 = t >= 2.6, tp = phase2 ? seg(t, 2.6, 4.4) : seg(t, .3, 2.1);
      const missIdx = phase2 ? [1, 4, 8].slice(0, 10 - nIn) : [6];
      const netCol = phase2 ? C.vl : C.ink2;
      for (let i = 0; i < 10; i++) { const x = 130 + i * 60, y0 = 90, y1 = 200; const miss = missIdx.includes(i);
        k.line([[x, y0], [x, y1]], { color: netCol, width: 8, alpha: .5 }); k.line([[x - 10, y0], [x + 10, y0]], { color: netCol, width: 3 }); k.line([[x - 10, y1], [x + 10, y1]], { color: netCol, width: 3 });
        const u = ease(clamp(tp * 1.6 - i * .06)); const target = miss ? (i % 2 ? y0 - 32 : y1 + 30) : 115 + ((i * 37) % 60);
        k.dot(x, lerp(30, target, u), 9, { color: miss ? C.critical : C.ink, alpha: u > 0 ? 1 : 0 }); }
      k.text(phase2 ? `Brazil, IGP, Viral-Load, week two: ${fmt(rate, 2)}, about ${nIn} in 10` : 'Nominal 90% interval: 9 in 10', 400, 280, { size: 28, weight: 650, align: 'center' });
      // coverage by horizon
      const a2 = seg(t, 5, 6);
      if (a2 > 0) { const kk = K(D, a2);
        kk.label('Cases-Only Active Set', 110, 340, C.cases, { size: 26 }); kk.label('Viral-Load Active Set', 440, 340, C.vl, { size: 26 });
        [['brazil', 'Brazil, IGP', 100], ['ottawa', 'Ottawa, IGP', 470]].forEach(([ds, nm, x0]) => {
          const box = { x: x0, y: 410, w: 290, h: 210 };
          const f = kk.frame(box, [.5, 14.5], [.4, 1], { yticks: [.5, .7, .9], yfmt: v => v.toFixed(1), xticks: [[1, '1'], [7, '7'], [14, '14 d']] });
          kk.text(nm, x0, 392, { size: 26, weight: 650 });
          kk.line([[box.x, f.Y(.9)], [box.x + box.w, f.Y(.9)]], { color: C.ink, width: 2, dash: [8, 6] });
          const p = ease(seg(t, 5.5, 9.5));
          for (const [v, col] of [['I=C', C.cases], ['I=VL+C', C.vl]]) { const pts = s.cov[ds]['IGP|' + v].map((c, i) => [f.X(i + 1), f.Y(c)]);
            kk.line(D.partial(pts, p), { color: col, width: 3 }); D.partial(pts, p).forEach(([x, y]) => kk.dot(x, y, 4, { color: col })); }
        });
        kk.text('dashed: nominal 0.90 · Brazil moves in steps of 1/17', 400, 700, { size: 26, color: C.muted, align: 'center' });
      }
      // block table
      const a3 = seg(t, 12, 13);
      if (a3 > 0) { const kk = K(D, a3), B = s.blocks;
        kk.text('Week-two coverage, Cases-Only → Viral-Load', 60, 770, { size: 26, color: C.ink2 });
        const rows = [['Brazil IGP', B.brazil, 'IGP'], ['Ottawa IGP', B.ottawa, 'IGP'], ['Ottawa ExGP', B.ottawa, 'ExGP']];
        rows.forEach(([nm, b, c], i) => { const x = 60 + i * 250; kk.text(nm, x, 814, { size: 26, weight: 600 });
          kk.text(`${fmt(b[c + '|I=C']['8-14'], 2)} → ${fmt(b[c + '|I=VL+C']['8-14'], 2)}`, x, 856, { size: 30, weight: 700 }); });
      }
    },
  });

  /* ------------------------------------------------------------------ S29 */
  let wigCache = null;
  function wiggles() { if (wigCache) return wigCache; const r = U.mulberry(41); wigCache = [0, 1, 2, 3].map(g => { const ph = [r() * 6, r() * 6, r() * 6], fr = [3 + g * 1.5, 7 + g, 12]; const p = []; for (let i = 0; i <= 80; i++) { const x = i / 80; p.push(Math.sin(fr[0] * x + ph[0]) * .5 + Math.sin(fr[1] * x + ph[1]) * .3 + Math.sin(fr[2] * x + ph[2]) * .12); } return p; }); return wigCache; }
  FB.scene({
    id: 'S29', part: 'Results and discussion', title: 'What exchangeability contributes, and what we cannot yet claim', dur: 15,
    tags: [PROV, { text: 'Age curves and dials schematic', cls: 'synthetic' }],
    eq: '',
    beats: [
      { at: 0, cap: 'Exchangeable means the age curves share a family of wiggliness and size (prior in S16). They do not share a path.' },
      { at: 4, cap: 'It pulled the uncertain fatality curves together and left the well-measured transmission differences alone.' },
      { at: 8, cap: 'With only four age groups there is little to pool, so forecasts match. More groups or shorter histories might show a benefit.' },
      { at: 11, cap: 'Caveats: many fits fail convergence checks, data are revised rather than real-time, and there is no vaccination or variant modelling.' },
    ],
    drawer: `<p>The exchangeable prior is shown in S16. Here we read what it did.</p>
<ul>
<li>\u201cExchangeability here concerns a prior distribution over process characteristics, not equality of transmission, fatality risk, or social contacts between age groups.\u201d (discussion.tex:85-87)</li>
<li>\u201cIntegrating over shared hyperparameters can make the paths dependent through their scales, even when cross-group covariances of zero-mean prior paths vanish.\u201d (discussion.tex:83-85)</li>
<li>Brazil \\(I=\\mathrm{VL}+C\\): ExGP shifts the four CFR length scales from 25.9-30.0 d (IGP) to 36.7-38.4 d and the CFR amplitudes from 0.57-0.93 to 0.96-1.05; transmission length scales keep their age differences (IGP 11.5-41.7, ExGP 12.4-41.3) (results_preq2_main.tex:157-166).</li>
<li>\u201cThe similarity of IGP and ExGP predictions under matched marginal priors suggests limited additional predictive benefit from this hierarchy in the present comparison. Four age groups supply little information about a population distribution of hyperparameters\u201d (discussion.tex:89-92); these are \u201cpossible explanations, not separately tested findings\u201d (93-94).</li>
<li><b>Computation.</b> The HSGP is validated at selected cells only; the short-length-scale mode in three Brazil fits lies outside the validated basis range. \u201cSuch failures cannot be interpreted as epidemiological evidence.\u201d (discussion.tex:124-134)</li>
<li><b>Scope</b> (discussion.tex:136-167): incomplete grids and few origins; dependent windows; Ottawa age deaths allocated from city totals; Toronto deaths dated by episode; no explicit ascertainment, vaccination, variants or reinfection; \u201cevidence for retrospective short-term prediction, not yet for operational nowcasting performance.\u201d</li>
<li>The PCR sum is count \\(\\times\\) mean, \\(\\VLsum_{g,t}=n^{\\PCR}_{g,t}\\,\\overline{\\VL}_{g,t}\\); a positive-PCR-count control is \u201cthe most direct control\u201d (discussion.tex:39-49).</li>
</ul>`,
    figure: { src: 'figures/c_dens_class_brazil_VLC.webp', caption: 'Paper figure fig:preq2-dens-class-brazil (results_preq2_main.tex:218): hyperparameter posteriors by class, Brazil, \\(I=\\mathrm{VL}+C\\).', alt: 'Hyperparameter densities by class' },
    flags: ['discussion.tex is dated 10 October against the 8 October snapshot and does not mention the Toronto/Scotland null wastewater result or the S\\~ao Paulo findings.', 'Length-scale ranges are quoted from the text (results_preq2_main.tex:157-166), not re-exported.'],
    source: 'discussion.tex:78-175; results_preq2_main.tex:152-173; results/results_preq2/tab_class_scores.tex',
    alt: 'Four age curves hang from dials tied to a shared hook; range bars show CFR length scales pulled together under ExGP while transmission ranges stay wide; IGP and ExGP CRPS bars nearly equal; a list of caveats.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const cs = d.classScores, C = FB.C, k = K(D), W = wiggles();
      // hook, dials, curves (schematic)
      const hook = [400, 50], dx = [160, 320, 480, 640], pool = ease(seg(t, 5, 8));
      const spread = [-.9, -.2, .5, 1.1], pooled = [-.15, -.05, .05, .12];
      k.dot(hook[0], hook[1], 9, { color: C.exgp }); k.text('shared traits', hook[0] + 20, hook[1] + 9, { size: 26, color: C.ink2 });
      dx.forEach((x, g) => { const ang = lerp(spread[g], pooled[g], pool);
        k.line([hook, [x, 112]], { color: C.exgp, width: 1.5, alpha: .6 }); k.circle(x, 145, 32, { color: C.ink2, width: 2.5 });
        k.line([[x, 145], [x + 28 * Math.sin(ang), 145 - 28 * Math.cos(ang)]], { color: C.exgp, width: 3.5 });
        const ages = ['0\u201318', '18\u201340', '40\u201365', '65+']; k.text(ages[g], x, 205, { size: 26, color: C.muted, align: 'center' }); });
      const cb = { x: 90, y: 230, w: 620, h: 110 }, u0 = ease(seg(t, 0, 2.5));
      W.forEach((p, g) => k.line(D.partial(p.map((v, i) => [cb.x + i / 80 * cb.w, cb.y + cb.h / 2 + v * 30 + (g - 1.5) * 14]), u0), { color: C.exgp, width: 2.5, alpha: .45 + .15 * g }));
      // ranges (quoted from results_preq2_main.tex:157-166)
      const a2 = seg(t, 4.5, 5.5) * (1 - seg(t, 10.8, 11.4));
      if (a2 > 0) { const kk = K(D, a2), X = v => 230 + v / 45 * 500;
        kk.text('Brazil, Viral-Load Active Set: length scale by age (days)', 60, 395, { size: 26, color: C.ink2 });
        const rows = [['CFR', [25.9, 30.0], [36.7, 38.4], 440], ['Transmission', [11.5, 41.7], [12.4, 41.3], 540]];
        rows.forEach(([nm, ig, ex, y]) => { kk.text(nm, 210, y + 30, { size: 28, weight: 650, align: 'right' });
          kk.rect(X(ig[0]), y, X(ig[1]) - X(ig[0]), 20, { color: C.igp, r: 4 }); kk.text('IGP', X(ig[1]) + 8, y + 18, { size: 26, color: C.igp });
          const g2 = ease(seg(t, 6, 8)); kk.rect(X(lerp(ig[0], ex[0], g2)), y + 34, X(lerp(ig[1], ex[1], g2)) - X(lerp(ig[0], ex[0], g2)), 20, { color: C.exgp, r: 4, alpha: g2 > 0 ? 1 : 0 });
          if (g2 > .9) kk.text('ExGP', X(ex[1]) + 8, y + 52, { size: 26, color: C.exgp }); });
        [0, 15, 30, 45].forEach(v => kk.text(String(v), X(v), 640, { size: 26, color: C.muted, align: 'center' }));
      }
      // CRPS bars
      const a3 = seg(t, 9, 10);
      if (a3 > 0) { const kk = K(D, a3), X0 = 300, Wb = 330;
        kk.text('Case CRPS, Viral-Load Active Set', 60, 690, { size: 26, color: C.ink2 });
        [['Brazil', cs.brazil['I=VL+C'], 715, 0], ['Ottawa', cs.ottawa['I=VL+C'], 790, 1]].forEach(([nm, sc, y, dp]) => {
          const mx = Math.max(sc.IGP.crps, sc.ExGP.crps); kk.text(nm, 60, y + 32, { size: 28, weight: 650 });
          [['IGP', 0], ['ExGP', 30]].forEach(([c, o]) => { const w = sc[c].crps / mx * Wb * ease(seg(t, 9.2, 10.4)); kk.rect(X0, y + o, w, 22, { color: ccol(c), r: 3 });
            kk.text(`${c} ${fmt(sc[c].crps, dp)}`, X0 - 12, y + o + 19, { size: 26, align: 'right', color: C.ink2 }); });
        });
      }
      const a4 = seg(t, 11.3, 12);
      if (a4 > 0) { const kk = K(D, a4);
        kk.text('What we cannot yet claim', 60, 400, { size: 28, weight: 650 });
        ['Many fits fail the convergence screen', 'Revised data, not real-time vintages', 'No vaccination, variant or reinfection mechanisms', 'Four age groups: little to pool'].forEach((s2, i) => {
          const u = ease(seg(t, 11.3 + i * .4, 11.9 + i * .4)); kk.text('\u2022 ' + s2, 60, 450 + i * 46, { size: 28, color: C.ink, alpha: u }); });
      }
    },
  });

  /* ------------------------------------------------------------------ S30 */
  FB.scene({
    id: 'S30', part: 'Results and discussion', title: 'Take-home', dur: 15,
    tags: [PROV, INTERIM],
    eq: '',
    beats: [
      { at: 0, cap: '1. Give each age group its own baseline. One shared curve fails.' },
      { at: 3, cap: '2. Exchangeable vs independent age curves: the same forecasts here. Pooling only steadies the weak fatality curves.' },
      { at: 6, cap: '3. Viral load and wastewater: clear gains in Ottawa, modest in Brazil, none in Toronto, Scotland or S\u00e3o Paulo\u2019s age models.' },
      { at: 9, cap: '4. Multiplying cases by viral load is worse than cases alone. The overall reproduction number is robust; the age split is not.' },
      { at: 12, cap: '5. Intervals are still too narrow. Results are provisional until every fit converges.' },
    ],
    drawer: `<ul>
<li>\u201cThese results support the predictive usefulness of the added streams in the evaluated periods. They do not establish that the augmented active set recovers the number of infectious individuals, that viral load corrects case underascertainment, or that the gains extend to deaths.\u201d (discussion.tex:10-13)</li>
<li>\u201cthe substantial gains from adding viral load to an unstable SGP forecast should not be conflated with its incremental value within an already competitive model.\u201d (discussion.tex:21-23)</li>
<li>S\\~ao Paulo summary (i)-(iv): viral load helps SGP only; VL\\(\\times\\)C worse and hard to fit; \\(C^a\\) with \\(a\\approx0.4\\)-0.65 best in sample; fixing \\(b_C=1\\) changes nothing (results_active_set_sp.tex:140-147).</li>
<li>Every number carries the diagnostic qualification of results_preq2_main.tex:54-65.</li>
<li>Next: \u201ccomplete and diagnose the matched fits, separate PCR-count information from viral-load magnitude, and assess calendar effects and the omitted forecast uncertainties\u201d (discussion.tex:169-172).</li>
<li>Thesis objective 3 (likelihood tempering for a robust causal model) is not part of this paper.</li>
</ul>
<p>Row 3 mixes pooled evidence (Brazil, Ottawa: \\(h=1\\)-14 CRPS change, IGP/ExGP, tab_vl_scores.tex) with interim single-origin evidence (Toronto, Scotland: median over converged cells, tab_ww_vl_effect.csv; S\\~ao Paulo: IGP \\(N=180\\) and ExGP \\(N=222\\), paired_vs_IC.csv).</p>`,
    figure: { src: 'figures/c_overview_allage_exgp.webp', caption: 'Paper figure fig:preq2-overview (results_preq2_main.tex:79): all-age fits and forecasts, ExGP.', alt: 'Overview of all-age fits' },
    flags: ['Row 3 mixes pooled (Brazil, Ottawa) and interim single-origin (Toronto, Scotland, S\\~ao Paulo) evidence; the interim tiles are labelled.'],
    source: 'discussion.tex:2-23, 169-175; results_preq2_main.tex:13-22, 54-65; results_active_set_sp.tex:140-147; results_ww_sp.tex:22; tab_class_scores.tex; tab_vl_scores.tex (vl_effect_table.csv); tab_ww_vl_effect.csv; paired_vs_IC.csv; scores_common_origins.csv',
    alt: 'A five-row scorecard: SGP CRPS bar collapsing to IGP; IGP and ExGP twin bars; five dataset tiles for the viral-load effect; a red VL times C tile; a coverage gauge below 0.90.',
    draw(t, ctx, D) {
      const d = DC(); if (!d) return missing(D); const C = FB.C, k = K(D), cs = d.classScores, bl = d.s24.blocks, ww = d.s26.summary;
      const rowY = i => 10 + i * 160;
      const head = (i, txt, at) => { const u = ease(seg(t, at, at + .6)), y = rowY(i);
        k.circle(46, y + 30, 20, { color: C.ink2, width: 2.5 }); k.dot(46, y + 30, 20 * u, { color: C.ink2 });
        k.text(String(i + 1), 46, y + 39, { size: 26, weight: 700, align: 'center', color: u > .5 ? C.surface : C.ink2 });
        k.text(txt, 84, y + 39, { size: 28, weight: 650, alpha: Math.max(.35, u) }); return u; };
      const sg = (x, dp = 0) => (x > 0 ? '+' : '') + fmt(x, dp);
      // 1. age structure
      let u = head(0, 'Age structure matters most', 0);
      if (u > 0) { const kk = K(D, u), b = cs.brazil['I=C'], mx = b.SGP.crps, W = 640, y = rowY(0) + 62, m = ease(seg(t, .8, 2.2));
        kk.rect(84, y, W, 30, { color: 'rgba(0,0,0,0)', stroke: ccol('SGP'), sw: 1.5, r: 4, alpha: .6 });
        kk.rect(84, y, lerp(b.SGP.crps, b.IGP.crps, m) / mx * W, 30, { color: m < .5 ? ccol('SGP') : ccol('IGP'), r: 4 });
        kk.text(`SGP ${fmt(b.SGP.crps)} → IGP ${fmt(b.IGP.crps)}`, 84, y + 66, { size: 26, color: C.ink2, alpha: m });
        kk.text('Brazil case CRPS', 84 + W, y + 66, { size: 26, color: C.muted, align: 'right' }); }
      // 2. IGP vs ExGP
      u = head(1, 'IGP and ExGP forecast alike (≤ 3% apart)', 3);
      if (u > 0) { const kk = K(D, u), b = cs.brazil['I=C'], y = rowY(1) + 60, W = 450;
        [['IGP', 0], ['ExGP', 38]].forEach(([c, o]) => { kk.rect(170, y + o, b[c].crps / b.IGP.crps * W * ease(seg(t, 3.4, 4.6)), 28, { color: ccol(c), r: 4 });
          kk.text(c, 156, y + o + 23, { size: 26, align: 'right' }); kk.text(fmt(b[c].crps), 170 + W + 14, y + o + 23, { size: 26, color: C.ink2 }); }); }
      // 3. viral load by data set
      u = head(2, 'Viral load / wastewater, case CRPS', 6);
      if (u > 0) { const sp = d.s27.rows, spI = sp.find(r => r.cls === 'IGP' && r.v === 'I=VL+C' && r.N === 180), spE = sp.find(r => r.cls === 'ExGP' && r.v === 'I=VL+C' && r.N === 222);
        const tiles = [
          ['Ottawa', `${sg(bl.ottawa.IGP.crps)}/${sg(bl.ottawa.ExGP.crps)}%`, 'clear gain', C.good, .5, false],
          ['Brazil', `${sg(bl.brazil.IGP.crps)}/${sg(bl.brazil.ExGP.crps)}%`, 'modest', C.good, .22, false],
          ['Toronto', sg(ww.toronto.median, 1) + '%', 'none*', C.muted, .2, true],
          ['Scotland', sg(ww.scotland.median, 1) + '%', 'none*', C.muted, .2, true],
          ['São Paulo', `${sg(spI.pct)}/${sg(spE.pct)}%`, 'little*', C.muted, .2, true]];
        tiles.forEach(([nm, val, word, col, al, interim], i) => { const a = ease(seg(t, 6.3 + i * .25, 6.9 + i * .25)), x = 18 + i * 154, y = rowY(2) + 54; const kk = K(D, a);
          kk.rect(x, y, 146, 100, { color: col, alpha: al, r: 10 });
          if (interim) kk.rect(x, y, 146, 100, { color: 'rgba(0,0,0,0)', stroke: C.muted, sw: 1.5, r: 10 });
          kk.text(nm, x + 73, y + 30, { size: 26, weight: 650, align: 'center' });
          kk.text(val, x + 73, y + 62, { size: 26, align: 'center' });
          kk.text(word, x + 73, y + 92, { size: 26, color: C.ink2, align: 'center' }); });
        k.text('* interim', 790, rowY(2) + 39, { size: 26, color: C.muted, align: 'right', alpha: seg(t, 7.4, 8) }); }
      // 4. VL x C
      u = head(3, 'Cases × viral load is worse than cases', 9);
      // Split the evidence by screen status: the two ExGP cells the paper quotes are severe failures.
      if (u > 0) { const kk = K(D, u), vr = d.s27.rows.filter(r => r.v === 'I=VLxC' && r.cls !== 'SGP'), y = rowY(3) + 90;
        const ok = vr.filter(r => !r.sev).map(r => `${fmt(r.de, 0)} ${r.cls}`), sev = vr.filter(r => r.sev).map(r => fmt(r.de, 0));
        kk.badge(`I = VL × C: ΔELPD ${ok.join(', ')}; ExGP ${sev.join(', ')}‡`, 84, y, false);
        kk.text('‡ severe sampler failure; overall R robust, age split not', 84, y + 44, { size: 26, color: C.ink2 }); }
      // 5. coverage gauge
      u = head(4, 'Intervals too narrow', 12);
      if (u > 0) { const kk = K(D, u), B = d.s28.blocks, vals = []; for (const ds of ['brazil', 'ottawa']) for (const c of ['SGP-AI', 'IGP', 'ExGP']) for (const v of ['I=C', 'I=VL+C']) for (const b of ['1-7', '8-14']) vals.push(B[ds][c + '|' + v][b]);
        const lo = Math.min(...vals), hi = Math.max(...vals), y = rowY(4) + 102, X = v => 120 + (v - .5) / .5 * 560, g = ease(seg(t, 12.3, 13.5));
        kk.line([[X(.5), y], [X(1), y]], { color: C.axis, width: 2 });
        kk.rect(X(lo), y - 14, (X(hi) - X(lo)) * g, 28, { color: C.cases, alpha: .75, r: 6 });
        kk.line([[X(.9), y - 26], [X(.9), y + 20]], { color: C.ink, width: 3, dash: [6, 5] });
        kk.text('nominal 0.90', X(.9) + 10, y - 30, { size: 26 });
        kk.text(`90% intervals cover ${fmt(lo, 2)}–${fmt(hi, 2)}`, 84, y - 30, { size: 26, color: C.ink2, alpha: g });
        [.5, .7, 1].forEach(v => kk.text(v.toFixed(1), X(v), y + 50, { size: 26, color: C.muted, align: 'center' })); }
      const fa = ease(seg(t, 13.6, 14.6));
      k.text('Next: refit failed cells · PCR-count control · calendar effects · forecast the signal', 400, 858, { size: 26, color: C.ink2, align: 'center', alpha: fa, maxW: 740 });
    },
  });
})();
