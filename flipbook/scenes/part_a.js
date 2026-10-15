/* Part A: S01-S08 (problem and data). Data: window.FLIPBOOK_DATA.a from scripts/flipbook/export_part_a.py.
   Paths in `source`: main.tex etc. are in ../documents/ViralLoadPaperV3/; data/ is the repository's data/. */
(function () {
  const U = FB.util, C = FB.C;
  const { clamp, lerp, ease, seg, mulberry, normal, fmtDate } = U;
  const DA = () => (window.FLIPBOOK_DATA && window.FLIPBOOK_DATA.a) || null;
  const PART = 'Problem and data';
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  // ---------- local helpers ----------
  const es = (t, a, b) => ease(seg(t, a, b));
  const fmt = v => Math.round(v).toLocaleString('en-US');
  const fmt3 = v => Number(Number(v).toPrecision(3)).toLocaleString('en-US');
  const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
  const dayIx = (start, iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 864e5);
  const ticksAt = (start, isos) => isos.map(d => [dayIx(start, d), fmtDate(d)]);
  // Cover what was drawn so far with the page colour (a fade-out that works with the kit's per-call alpha).
  // D.group with a local copy of the group alpha, for the few places that draw on ctx directly.
  let LGA = 1;
  const grp = (D, a, fn) => { if (a <= 0) return; const prev = LGA; LGA = prev * clamp(a); try { D.group(a, fn); } finally { LGA = prev; } };
  // Split a series with nulls into drawable runs of [x, y] points.
  function runs(vals, X, Y, upto) {
    const out = []; let cur = [];
    const n = upto === undefined ? vals.length : Math.min(vals.length, upto);
    for (let i = 0; i < n; i++) { const v = vals[i]; if (v === null || v === undefined || !isFinite(Y(v))) { if (cur.length) out.push(cur); cur = []; } else cur.push([X(i), Y(v)]); }
    if (cur.length) out.push(cur); return out;
  }
  const lines = (D, rs, o) => rs.forEach(r => r.length > 1 ? D.line(r, o) : D.dot(r[0][0], r[0][1], (o.width || 3) / 2 + .5, { color: o.color, alpha: o.alpha }));
  // Centred rolling mean over non-null values (window 2h+1, needs >= need values).
  function roll(a, h = 3, need = 3) {
    return a.map((_, i) => { let s = 0, k = 0; for (let j = i - h; j <= i + h; j++) { const v = a[j]; if (v !== null && v !== undefined) { s += v; k++; } } return k >= need ? s / k : null; });
  }
  const textW = (ctx, s, size, weight) => { ctx.save(); ctx.font = `${weight || 400} ${size}px ${FONT}`; const w = ctx.measureText(s).width; ctx.restore(); return w; };
  // Symbol with subscript, e.g. sub(D, ctx, 'b', 'VL', x, y, {size:34}).
  function sub(D, ctx, main, s, x, y, o = {}) {
    const size = o.size || 34, w = textW(ctx, main, size, o.weight || 'italic 400');
    D.text(main, x, y, { ...o, size, weight: o.weight || 'italic 400' });
    D.text(s, x + w + 1, y + size * .28, { ...o, size: Math.max(26, size * .72), weight: 400 });
    return w + textW(ctx, s, Math.max(26, size * .72)) + 2;
  }
  const gammaPdf = (x, k, th) => x <= 0 ? 0 : Math.pow(x, k - 1) * Math.exp(-x / th);

  // ======================================================================================
  // S01 — Can viral load help us see the epidemic coming?
  // ======================================================================================
  FB.scene({
    id: 'S01', part: PART, title: 'Can viral load help us see the epidemic coming?', dur: 15,
    tags: [{ text: 'Synthetic (illustration)', cls: 'synthetic' }, { text: 'Interim' }],
    eq: '\\begin{aligned}I_{g,t}=\\textstyle\\sum_{s\\in\\mathcal W_t}\\bigl[\\,&b_C\\,\\Crep_{g,s}\\\\&+b_{VL,g}\\,\\bigl(\\VLsum_{g,s}\\bigr)^{p_{VL,g}}\\bigr]\\end{aligned}',
    beats: [
      { at: 0, cap: 'Reported cases lag behind the virus. Does measuring the virus itself, in swabs or in sewage, improve two-week forecasts?' },
      { at: 3, cap: 'Two streams feed one model: counted cases and a measured virus signal (Brazil shown, 2020–2021).' },
      { at: 7, cap: 'The question: does adding the virus signal sharpen 14-day forecasts of cases in four age groups?' },
      { at: 11, cap: 'Short answer: clearly in Ottawa, modestly in Brazil, not in Toronto or Scotland. The last three are interim results.' },
    ],
    drawer: `<p>The paper asks whether a viral-load signal adds <em>predictive</em> information to an age-stratified epidemic model whose transmission rates are Gaussian processes. The model's infectious pressure ("active set") \\(I_{g,t}\\) adds the signal to reported cases over the window \\(\\mathcal W_t=\\{t-\\tau+1,\\dots,t\\}\\). The cases-only active set \\(I=C\\) sets \\(b_{VL}=0\\); the comparison is \\(I=C\\) against \\(I=\\mathrm{VL}+C\\).</p>
<ul>
<li>Abstract (main.tex:189-191): "We show including viral load measurements can modestly improve predictions of future cases, and this motivates further integration of viral load data."</li>
<li>Brazil and Ottawa (results_preq2_main.tex:234-238): "Within IGP and ExGP, adding the surveillance signal lowers the case CRPS in both settings, with larger relative improvements at 8--14 days. In Brazil the reductions are 0.4--2% at 1--7 days and 8--10% at 8--14 days. In Ottawa they are 12--13% and 24--28%, respectively."</li>
<li>Toronto and Scotland (results_ww_sp.tex:22): "The forecasting benefit is therefore confined to Ottawa; in Toronto and Scotland the wastewater signal as currently entered gives none."</li>
<li>São Paulo (results_active_set_sp.tex:139-141): viral load "improves the fit and forecasts of the shared-path SGP class, where it replaces missing age structure, but adds little to the age-specific classes"; a multiplicative viral-load weight on each case "is worse than cases alone".</li>
<li>Scope (discussion.tex:10-13): the results "do not establish that the augmented active set recovers the number of infectious individuals, that viral load corrects case underascertainment, or that the gains extend to deaths."</li>
<li>Evaluation basis: CRPS pooled over 17 common origins in Brazil (\\(N=180,\\dots,330\\) and 360) and 21 in Ottawa (\\(N=90,\\dots,280\\) and 390), each with 14 held-out days (results_preq2_main.tex:25-28). Not a single origin.</li>
</ul>
<p>On screen the two data streams are the real Brazil series (shapes only, no axes); the forecast fans are synthetic and only show the idea of a narrower predictive distribution.</p>`,
    flags: [
      'The title names only Brazil and Ottawa (main.tex:140), but the paper analyses five datasets.',
      'São Paulo, Toronto and Scotland come from a coarse interim pass, forecast origins every 42 days (results_ww_sp.tex:6); their verdicts are marked interim.',
      'Methods write scalar \\(b_{VL}, p_{VL}\\) (main.tex:1305). The Brazil and São Paulo fits are age-specific \\(b_{VL,g}, p_{VL,g}\\) (results_preq2_main.tex:219); wastewater fits use one city-wide pair. Shown in the fitted form.',
    ],
    source: 'main.tex:140 (title), 168-196 (abstract), 1303-1305 (active set); results_preq2_main.tex:25-28, 234-238; results_ww_sp.tex:22; results_active_set_sp.tex:139-142; discussion.tex:10-13; data: figures/data_overview/data_overview_series.csv',
    alt: 'The paper title, then Brazil reported cases as grey bars and the viral-load signal as an orange line flowing into a model box, which emits a wide blue and a narrower orange forecast fan. Five verdict rows follow: Ottawa clear gain, Brazil modest gain, Toronto and Scotland no gain, São Paulo little gain in age-specific models.',
    draw(t, ctx, D) {
      const A = DA();
      // title card
      const a0 = es(t, 0, 1.5);
      D.text('THE PAPER', 40, 48, { size: 26, color: C.muted, weight: 600, alpha: a0 });
      D.text('Epidemic nowcasting with Gaussian Processes: assessing the added value of viral load and wastewater data', 40, 96,
        { size: 36, weight: 650, maxW: 720, lh: 46, alpha: a0 });
      if (!A) return;
      const B = A.series.Brazil, n = B.n;
      // pipes (real Brazil shapes)
      const u1 = es(t, 3, 6), u2 = es(t, 3.6, 6.6);
      if (t > 3) {
        D.text('Reported cases', 40, 252, { size: 28, color: C.ink2, weight: 600, alpha: seg(t, 3, 3.6) });
        const cmax = Math.max(...B.cases7.filter(v => v !== null));
        for (let i = 0; i < n; i += 3) {
          if (i / n > u1) break; const v = B.cases7[i]; if (v === null) continue;
          const h = 80 * v / cmax; D.rect(40 + 360 * i / n, 348 - h, 3, h, { color: C.obs, alpha: .75, r: 0 });
        }
        D.text('Viral-load signal', 40, 396, { size: 28, color: C.ink2, weight: 600, alpha: seg(t, 3.6, 4.2) });
        const smax = Math.max(...B.sig7.filter(v => v !== null));
        lines(D, runs(B.sig7, i => 40 + 360 * i / n, v => 490 - 80 * v / smax, Math.round(u2 * n)), { color: C.vl, width: 3.5 });
      }
      // into the model
      const a2 = es(t, 6.6, 7.6);
      if (a2 > 0) {
        D.arrow(408, 300, lerp(408, 452, a2), lerp(300, 345, a2), { color: C.ink2, width: 2.5, alpha: a2 });
        D.arrow(408, 448, lerp(408, 452, a2), lerp(448, 400, a2), { color: C.ink2, width: 2.5, alpha: a2 });
        D.rect(460, 322, 116, 100, { color: C.surface2, stroke: C.ink2, r: 14, alpha: a2 });
        D.text('Model', 518, 382, { size: 30, weight: 600, align: 'center', alpha: a2 });
      }
      // forecast fans (synthetic)
      const fw = es(t, 7.6, 9.2), fn = es(t, 9.2, 10.8), cy = 372;
      const fan = (hw, u, col, al) => {
        const k = Math.max(1, Math.round(u * 14)), lo = [[578, cy]], hi = [[578, cy]];
        for (let j = 0; j < k; j++) { const x = 592 + j * 13; lo.push([x, cy + hw(j)]); hi.push([x, cy - hw(j)]); }
        D.band(lo, hi, { color: col, alpha: al });
        return k;
      };
      if (fw > 0) { fan(j => 8 + 6.5 * j, fw, C.cases, .3); }
      if (fn > 0) { fan(j => 5 + 3.4 * j, fn, C.vl, .55); }
      if (fw > 0) for (let j = 0; j < Math.round(fw * 14); j++) D.dot(592 + j * 13, cy, 3.5, { color: C.ink });
      if (fw > 0) D.text('Cases-Only Active Set', 770, 506, { size: 27, color: C.cases, weight: 600, align: 'right', alpha: fw });
      if (fn > 0) D.text('Viral-Load Active Set', 770, 542, { size: 27, color: C.vl, weight: 600, align: 'right', alpha: fn });
      if (t > 3) D.text('Data: Brazil 2020–21, shapes only. Fans: illustrative.', 40, 588, { size: 26, color: C.muted, alpha: seg(t, 4, 5) });
      // verdicts quoted from the paper
      const V = [
        ['✓', C.good, 'Ottawa', 'clear gain: week-2 CRPS 24–28% lower'],
        ['✓', C.good, 'Brazil', 'modest gain: week-2 CRPS 8–10% lower'],
        ['–', C.muted, 'Toronto', 'no gain (interim)'],
        ['–', C.muted, 'Scotland', 'no gain (interim)'],
        ['≈', C.ink2, 'São Paulo', 'little, in age-specific GPs (interim)'],
      ];
      if (t > 10.8) D.text('What the paper finds for 14-day case forecasts', 40, 646, { size: 27, color: C.ink2, weight: 600, alpha: seg(t, 10.8, 11.3) });
      V.forEach(([ic, col, name, txt], k) => {
        const a = es(t, 11.2 + k * .55, 11.8 + k * .55); if (a <= 0) return;
        const y = 694 + k * 46, dx = (1 - a) * 30;
        D.text(ic, 44 + dx, y, { size: 30, color: col, weight: 700, alpha: a });
        D.text(name, 84 + dx, y, { size: 28, weight: 600, alpha: a });
        D.text(txt, 238 + dx, y, { size: 26, color: C.ink2, alpha: a });
      });
    },
  });

  // ======================================================================================
  // S02 — Why epidemic inference is hard (synthetic)
  // ======================================================================================
  let S02cache = null;
  function s02() {
    if (S02cache) return S02cache;
    const r = mulberry(20201005), dots = [];
    const bands = ['65+', '40–65', '18–40', '0–18'];
    for (let b = 0; b < 4; b++) for (let row = 0; row < 3; row++) for (let c = 0; c < 16; c++)
      dots.push({ b, x: 188 + c * 36, y: 92 + b * 116 + row * 30 });
    const seeds = [dots[3 * 48 + 20], dots[1 * 48 + 40], dots[2 * 48 + 7]];
    for (const d of dots) {
      const dist = Math.min(...seeds.map(s => Math.hypot(s.x - d.x, s.y - d.y)));
      const escape = r() < .2 && dist > 0;
      d.inf = escape ? Infinity : Math.min(3.9, .3 + dist / 190 + r() * .5);
      const pTest = d.b === 0 ? .5 : .3;
      d.test = d.inf < Infinity && r() < pTest ? Math.max(d.inf + .4, 4 + r() * 2.8) : Infinity;
      const pDie = d.b === 0 ? .1 : d.b === 1 ? .04 : 0;
      d.die = d.inf < Infinity && r() < pDie ? 8 + r() * 2.6 : Infinity;
    }
    const tested = dots.filter(d => d.test < Infinity).sort((a, b) => a.test - b.test);
    tested.forEach((d, k) => { d.slot = [52 + (k % 38) * 18.6, 636 + Math.floor(k / 38) * 22]; d.land = d.test + .8; });
    const dead = dots.filter(d => d.die < Infinity).sort((a, b) => a.die - b.die);
    dead.forEach((d, k) => { d.dslot = [52 + k * 22, 756]; d.dland = d.die + 1.1; });
    return (S02cache = { dots, bands });
  }
  FB.scene({
    id: 'S02', part: PART, title: 'Why epidemic inference is hard', dur: 15,
    tags: [{ text: 'Synthetic (illustration)', cls: 'synthetic' }],
    eq: '',
    beats: [
      { at: 0, cap: 'Infections spread unseen. Each dot is one person; red means infected.' },
      { at: 4, cap: 'Only some get tested (white ring). Only positives are reported, days later.' },
      { at: 8, cap: 'A few die, weeks later. Deaths are counted more reliably, but they arrive last.' },
      { at: 12, cap: 'Infections never tested stay latent. The model must reconstruct the hidden epidemic from these partial, delayed views.' },
    ],
    drawer: `<p>The paper opens its data section (main.tex:491-493): "Epidemic inference is hard because transmission events, infection status, and disease progression are latent quantities that can only be indirectly, and often-belatedly, observed."</p>
<ul>
<li>Testing was largely symptom-driven, particularly in Brazil, "so reported cases are a time-varying and age-dependent fraction of infections" (main.tex:2018-2020).</li>
<li>The estimation problem (main.tex:2054-2062): from all observations \\(\\mathbf y_{1:N}\\) up to day \\(N\\), estimate the age-specific transmission rate \\(\\lambda_{g,t}\\), the effective reproduction number \\(\\Reff_t\\) and the case-fatality ratio \\(\\CFR_{g,t}\\), and forecast cases and deaths.</li>
<li>The evaluation uses final, revised series, so it is retrospective with respect to reporting delays and back-fill (main.tex:2072-2074).</li>
<li>Forecast-hub evidence (Cramer et al. 2022; Bracher et al. 2021, cited near main.tex:214-218) motivates scoring whole predictive distributions rather than point forecasts.</li>
</ul>
<p>The animation is a toy: the contagion cascade, testing probabilities (about 30%, more in the oldest row) and death probabilities are invented for illustration.</p>`,
    source: 'main.tex:491-493, 2018-2020, 2054-2062, 2072-2074',
    alt: 'A grid of about 190 dots in four age rows. Infection spreads as a red cascade; some infected dots get a white ring and send a blue token to a reported-cases bar; a few in the oldest rows die and send a token to a deaths bar; untested infections fade and are labelled latent.',
    draw(t, ctx, D) {
      const { dots, bands } = s02();
      bands.forEach((b, k) => D.text(b, 40, 92 + k * 116 + 40, { size: 28, color: C.ink2, weight: 600 }));
      D.text('Age group', 40, 50, { size: 26, color: C.muted });
      D.text('Illustration, not data', 760, 50, { size: 26, color: C.muted, align: 'right' });
      const latentFade = es(t, 12, 13.5);
      for (const d of dots) {
        const inf = t >= d.inf, dead = t >= d.die, tested = t >= d.test;
        if (!inf) { D.circle(d.x, d.y, 9, { color: C.muted, width: 2 }); continue; }
        const pop = clamp((t - d.inf) / .35);
        if (dead) {
          D.dot(d.x, d.y, 10, { color: C.axis });
          D.line([[d.x - 6, d.y - 6], [d.x + 6, d.y + 6]], { color: C.ink, width: 2.5 }); D.line([[d.x - 6, d.y + 6], [d.x + 6, d.y - 6]], { color: C.ink, width: 2.5 });
        } else {
          const a = tested ? 1 : 1 - .78 * latentFade;
          D.dot(d.x, d.y, 4 + 6 * ease(pop), { color: C.critical, alpha: a });
        }
        if (tested) D.circle(d.x, d.y, 14, { color: C.ink, width: 2.5, alpha: es(t, d.test, d.test + .3) });
      }
      if (latentFade > 0) {
        D.rect(150, 530, 500, 44, { color: C.surface2, r: 10, alpha: latentFade });
        D.text('latent: infected, never observed', 400, 561, { size: 28, color: C.ink, weight: 600, align: 'center', alpha: latentFade });
      }
      // reported cases bar
      const aR = seg(t, 3.8, 4.4), aD = seg(t, 7.8, 8.4);
      D.text('Reported cases: positive tests, days later', 40, 616, { size: 26, color: C.ink2, weight: 600, alpha: aR });
      D.line([[40, 682], [760, 682]], { color: C.axis, width: 1.5, alpha: aR });
      D.text('Deaths: counted well, weeks later', 40, 736, { size: 26, color: C.ink2, weight: 600, alpha: aD });
      D.line([[40, 776], [760, 776]], { color: C.axis, width: 1.5, alpha: aD });
      for (const d of dots) {
        if (d.slot && t >= d.test) {
          const u = es(t, d.test, d.land), x = lerp(d.x, d.slot[0], u), y = lerp(d.y, d.slot[1], u);
          D.rect(x - 7, y - 7, 14, 14, { color: C.cases, r: 3 });
        }
        if (d.dslot && t >= d.die) {
          const u = es(t, d.die, d.dland), x = lerp(d.x, d.dslot[0], u), y = lerp(d.y, d.dslot[1], u);
          D.rect(x - 8, y - 8, 16, 16, { color: C.obs, r: 3 });
        }
      }
      // legend
      const ly = 846;
      D.circle(52, ly - 9, 9, { color: C.muted, width: 2 }); D.text('not infected', 70, ly, { size: 26, color: C.ink2 });
      D.dot(250, ly - 9, 9, { color: C.critical }); D.text('infected', 268, ly, { size: 26, color: C.ink2 });
      D.dot(410, ly - 9, 9, { color: C.critical }); D.circle(410, ly - 9, 14, { color: C.ink, width: 2.5 }); D.text('tested', 432, ly, { size: 26, color: C.ink2 });
      D.dot(560, ly - 9, 10, { color: C.axis }); D.line([[554, ly - 15], [566, ly - 3]], { color: C.ink, width: 2.5 }); D.line([[554, ly - 3], [566, ly - 15]], { color: C.ink, width: 2.5 });
      D.text('died', 580, ly, { size: 26, color: C.ink2 });
    },
  });

  // ======================================================================================
  // S03 — Reported cases and deaths (Brazil)
  // ======================================================================================
  let S03cache = null;
  function s03() {
    if (S03cache) return S03cache;
    const B = DA().series.Brazil;
    // illustrative delay: gamma with mean 12 days (shape 6, scale 2), truncated at 40 days
    const pi = []; for (let k = 1; k <= 40; k++) pi.push(gammaPdf(k, 6, 2)); const z = pi.reduce((a, b) => a + b, 0); for (let k = 0; k < 40; k++) pi[k] /= z;
    const cfr = B.deaths_total / B.cases_total;             // illustrative constant CFR = total deaths / total cases
    const c7 = B.cases7.map((v, i) => v === null ? B.cases[i] : v);
    const pred = c7.map((_, i) => { if (i < 40) return null; let s = 0; for (let k = 1; k <= 40; k++) s += c7[i - k] * pi[k - 1]; return cfr * s; });
    return (S03cache = { B, pi, cfr, pred });
  }
  FB.scene({
    id: 'S03', part: PART, title: 'Reported cases and deaths', dur: 15,
    tags: [{ text: 'Delay and CFR: synthetic (illustration)', cls: 'synthetic' }],
    eq: 'E[\\Drep_{g,t}]=\\textstyle\\sum_{k=1}^{|\\mathrm{ITD}|}\\CFR_{g,t-k}\\,E[\\Crep_{g,t-k}]\\,\\pi_k',
    beats: [
      { at: 0, cap: () => { const B = DA().series.Brazil; return `Brazil, ${fmtDate(B.start)} to ${fmtDate(B.end)}: daily reported cases, with a 7-day mean.`; } },
      { at: 4, cap: () => { const B = DA().series.Brazil; const d = B.deaths_peak.i - B.cases_peak.i; return `Daily deaths follow, smaller and later: the March 2021 peaks of the 7-day means are ${d} days apart.`; } },
      { at: 8, cap: 'Deaths ≈ earlier cases × a fatality ratio, spread over a delay. Delay and ratio here are illustrative.' },
      { at: 12, cap: 'An older, retrospective approach runs this backwards: from deaths, divided by the infection-fatality ratio, to infections.',
        eq: 'E[Y^{*}_{t}]=\\frac{1}{\\IFR}\\sum_{k=1}^{|\\pi|}\\Drep_{t+k}\\,\\pi(k)' },
    ],
    drawer: () => { const B = DA().series.Brazil; return `<p>Both counts enter the model through negative-binomial likelihoods (main.tex:1288-1289): \\(\\Crep_{g,t}\\sim\\NB(E[\\Crep_{g,t}],\\phi^C)\\) and \\(\\Drep_{g,t}\\sim\\NB(E[\\Drep_{g,t}],\\phi^D)\\), with priors \\(\\phi^C\\sim\\LN(\\log 3,1)\\) and \\(\\phi^D\\sim\\LN(\\log 100,1)\\) (main.tex:1357-1358). Expected deaths convolve <em>expected</em> cases with the infection-to-death delay \\(\\pi\\) and a time-varying CFR (main.tex:1290-1291).</p>
<ul>
<li>Deaths "are naturally second-order observations that are mediated by age, immunity, clinical practice, and time-varying risks of severe disease" (main.tex:512-514).</li>
<li>The CFR is a GP on the logit scale, \\(\\CFR_{g,t}=\\logit^{-1}(\\mu^{\\CFR}_g+\\widetilde f^{\\CFR}_{g,t})\\) (main.tex:1318-1319); the fitted CFR extrapolates to give death forecasts with credible intervals.</li>
<li>Ottawa deaths are city-wide only and are allocated to ages by case weights; Toronto deaths are dated by episode date (main.tex:2021-2025).</li>
<li>Retrospective (Flaxman-type) estimation works backwards from deaths with an external IFR and delay (main.tex:516-527), avoiding reported cases and their underascertainment. Corrected form:
\\[E[Y^{*}_{t}]=\\frac{1}{\\IFR}\\sum_{k=1}^{|\\pi|}\\Drep_{t+k}\\,\\pi(k).\\]</li>
<li>Brazil in the exported series: ${fmt(B.cases_total)} reported cases and ${fmt(B.deaths_total)} deaths over ${B.n} days (sums rounded to 4 significant figures). 7-day-mean peaks: cases ${fmt3(B.cases_peak.v)}/day on ${fmtDate(B.cases_peak.date)}, deaths ${fmt3(B.deaths_peak.v)}/day on ${fmtDate(B.deaths_peak.date)}.</li>
</ul>
<p>On screen the delay is a gamma kernel with mean 12 days and the CFR is a constant equal to total deaths over total cases (${(100 * s03().cfr).toFixed(1)}%); both are illustrative, not fitted values.</p>`; },
    figure: { src: 'figures/a_data_overview.webp', caption: 'Figure (fig:data-overview) of the paper: cases, deaths and the viral-load or wastewater signal for all five case studies; the Brazil column is re-animated here.', alt: 'Paper data overview figure' },
    flags: [
      'main.tex:525 writes \\(E[\\Ctrue_t]=\\IFR\\sum_k^{\\|\\pi\\|}\\Drep_{t+k}\\pi(k)\\). Back-projection from deaths to infections must divide by the IFR, and the upper limit is the support length \\(|\\pi|\\), as \\(|\\mathrm{ITD}|\\) at main.tex:1290. The corrected form is shown.',
      'The Brazil case series has a single-day spike (13,509 on 07-04-2020); the 7-day mean is drawn prominently so the spike does not dominate.',
      'Totals are summed from the paper\'s exported data_overview_series.csv: 11,032,051 cases and 407,211 deaths over the analysed window.',
    ],
    source: 'main.tex:509-527, 1283-1291, 1318-1319, 1357-1358; data: figures/data_overview/data_overview_series.csv (dataset Brazil)',
    alt: 'Two stacked panels for Brazil, April 2020 to April 2021. Top: daily reported cases as grey bars with a blue 7-day mean, two waves, peak mid-March 2021. Bottom: daily deaths with a 7-day mean, peaking 12 days later. An illustrative delay kernel slides along cases and produces a dashed predicted-deaths line. An upward arrow marks the retrospective deaths-to-infections estimate.',
    draw(t, ctx, D) {
      const { B, pred } = s03(), n = B.n;
      const xt = ticksAt(B.start, ['2020-07-01', '2020-11-01', '2021-03-01']);
      const bc = { x: 120, y: 74, w: 640, h: 250 }, bd = { x: 120, y: 450, w: 640, h: 200 };
      const fc = D.frame(bc, [0, n - 1], [0, 85000], { yticks: [0, 40000, 80000], yfmt: v => v ? (v / 1000) + 'k' : '0', xticks: xt, ylab: 'Reported cases per day' });
      const u1 = es(t, 0, 3.6);
      for (let i = 0; i < n * u1; i++) { const v = B.cases[i]; if (v === null) continue; D.rect(fc.X(i) - .7, fc.Y(Math.min(v, 85000)), 1.6, fc.Y(0) - fc.Y(Math.min(v, 85000)), { color: C.obs, alpha: .5, r: 0 }); }
      lines(D, runs(B.cases7, fc.X, fc.Y, Math.round(u1 * n)), { color: C.cases, width: 4 });
      const u2 = es(t, 4, 7);
      const fd = D.frame(bd, [0, n - 1], [0, 4000], { yticks: [0, 2000, 4000], yfmt: v => v ? (v / 1000) + 'k' : '0', xticks: xt, ylab: 'Reported deaths per day', alpha: seg(t, 3.6, 4.2) });
      for (let i = 0; i < n * u2; i++) { const v = B.deaths[i]; if (v === null) continue; D.rect(fd.X(i) - .7, fd.Y(v), 1.6, fd.Y(0) - fd.Y(v), { color: C.obs, alpha: .3, r: 0 }); }
      lines(D, runs(B.deaths7, fd.X, fd.Y, Math.round(u2 * n)), { color: C.ink2, width: 4 });
      // peaks
      const aP = es(t, 6.6, 7.6);
      if (aP > 0) {
        const xc = fc.X(B.cases_peak.i), xd = fd.X(B.deaths_peak.i);
        D.line([[xc, bc.y + 10], [xc, bd.y + bd.h]], { color: C.cases, width: 2, dash: [6, 6], alpha: aP });
        D.line([[xd, bd.y + 10], [xd, bd.y + bd.h]], { color: C.ink2, width: 2, dash: [6, 6], alpha: aP });
        D.text(`Cases peak ${fmtDate(B.cases_peak.date)}: ≈${fmt3(B.cases_peak.v)}/day`, xc - 10, bc.y + 24, { size: 26, color: C.ink, align: 'right', alpha: aP });
        D.text(`Deaths peak ${fmtDate(B.deaths_peak.date)}: ≈${fmt3(B.deaths_peak.v)}/day`, xc - 10, bd.y + 30, { size: 26, color: C.ink, align: 'right', alpha: aP });
        const yA = bd.y + 60; D.arrow(xc, yA, xd, yA, { color: C.ink, width: 2.5, head: 9, alpha: aP });
        D.text(`${B.deaths_peak.i - B.cases_peak.i} days`, xc - 10, yA + 9, { size: 26, color: C.ink, weight: 600, align: 'right', alpha: aP });
      }
      // illustrative convolution
      const u3 = es(t, 8, 11.6);
      if (t > 8) {
        const cur = Math.round(lerp(40, n - 1, u3));
        const { pi } = s03(), pmax = Math.max(...pi);
        const kpts = [[fc.X(cur), fc.Y(0)]]; for (let k = 1; k <= 40; k++) kpts.push([fc.X(cur - k), fc.Y(0) - 90 * pi[k - 1] / pmax]); kpts.push([fc.X(cur - 40), fc.Y(0)]);
        if (u3 < 1) D.band(kpts, kpts.map(([x]) => [x, fc.Y(0)]), { color: C.ink, alpha: .28 });
        if (u3 < 1) D.line([[fc.X(cur), fc.Y(0)], [fc.X(cur), fd.Y(0)]], { color: C.ink, width: 1.5, alpha: .5 });
        lines(D, runs(pred, fd.X, fd.Y, cur + 1), { color: C.ink, width: 2.5, dash: [8, 6] });
      }
      // legend
      const ly = 762, aL = seg(t, 4, 5);
      D.rect(40, ly - 20, 22, 22, { color: C.obs, alpha: .5 * aL, r: 2 }); D.text('daily count', 72, ly, { size: 26, color: C.ink2, alpha: aL });
      D.line([[250, ly - 9], [290, ly - 9]], { color: C.cases, width: 4, alpha: aL }); D.text('cases, 7-day mean', 300, ly, { size: 26, color: C.ink2, alpha: aL });
      D.line([[540, ly - 9], [580, ly - 9]], { color: C.ink2, width: 4, alpha: aL }); D.text('deaths, 7-day', 590, ly, { size: 26, color: C.ink2, alpha: aL });
      if (t > 8) { const a = seg(t, 8, 8.6); D.line([[40, ly + 33], [80, ly + 33]], { color: C.ink, width: 2.5, dash: [8, 6], alpha: a });
        D.text('CFR × delayed cases (both illustrative)', 92, ly + 42, { size: 26, color: C.ink2, alpha: a }); }
      // retrospective arrow
      const aR = es(t, 12, 13.2);
      if (aR > 0) {
        D.arrow(30, bd.y + 180, 30, lerp(bd.y + 180, bc.y + 40, aR), { color: C.ink, width: 4, head: 16, alpha: aR });
        D.rect(40, 836, 720, 46, { color: C.surface2, r: 10, alpha: aR });
        D.text('Retrospective (Flaxman-type): deaths ÷ IFR → infections', 400, 867, { size: 26, color: C.ink, weight: 600, align: 'center', alpha: aR });
      }
    },
  });

  // ======================================================================================
  // S04 — Viral kinetics (schematic, then Brazil Ct data)
  // ======================================================================================
  // Catmull-Rom through the TikZ control points of figures/DAG/viral_kinetic_diagram.tex (schematic).
  const VK = [[0, .02], [.9, .12], [1.6, .7], [2.3, 1.7], [2.9, 2.2], [3, 2.23], [3.1, 2.24], [3.2, 2.25], [3.3, 2.25], [4, 2.1], [5, 1.6], [6.2, .95], [7.5, .45], [8.8, .15], [9.5, .15]];
  function catmull(P, per = 12) {
    const out = []; for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let s = 0; s < per; s++) { const u = s / per, u2 = u * u, u3 = u2 * u;
        out.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3))); }
    } out.push(P[P.length - 1]); return out;
  }
  const VKC = catmull(VK);
  let S04cache = null;
  function s04() {
    if (S04cache) return S04cache;
    const P = DA().pcr, out = { P, g: {} };
    for (const a of P.ages) out.g[a] = { q25: roll(P[a].vl25), q50: roll(P[a].vl50), q75: roll(P[a].vl75), n: P[a].tests.reduce((s, v) => s + (v || 0), 0) };
    out.total = Array.from({ length: P.n }, (_, i) => { let s = 0, k = 0; for (const a of P.ages) { const v = P[a].vlsum[i]; if (v !== null) { s += v; k++; } } return k ? s : null; });
    return (S04cache = out);
  }
  const vlOf = ct => 1 - (ct - 10.43) / (39.98 - 10.43);
  FB.scene({
    id: 'S04', part: PART, title: 'Viral kinetics: the virus inside one person', dur: 15,
    tags: [{ text: 'Kinetics curve and PCR tubes: schematic', cls: 'synthetic' }],
    eq: '\\begin{aligned}\\VLsum_{g,t}&=\\textstyle\\sum_{j=1}^{\\Cpcr_{g,t}}\\VL_{g,t,j}\\\\\\VL&=1-\\frac{\\mathrm{Ct}-10.43}{39.98-10.43}\\end{aligned}',
    beats: [
      { at: 0, cap: 'After infection, the virus multiplies quickly inside the body.' },
      { at: 3, cap: 'It peaks near symptom onset, when most people get swabbed, then fades.' },
      { at: 6, cap: 'PCR doubles the genetic material cycle by cycle. Detection after fewer cycles (low Ct) means more virus.' },
      { at: 10, cap: 'Brazil, real positive tests: daily viral-load quartiles per age group, then summed into one daily signal.' },
    ],
    drawer: () => { const P = DA().pcr; return `<p>The paper turns each positive test's cycle threshold into a dimensionless viral-load proxy, \\(\\VL=1-(\\mathrm{Ct}-10.43)/(39.98-10.43)\\), "not copies per millilitre" (results_preq2_appendix.tex:42), and sums it over the day's positive tests in each age group (main.tex:1287). On screen the quartile bands are recomputed from the Ct quartiles with this map and smoothed with a centred 7-day mean.</p>
<ul>
<li>He et al. (main.tex:547-553), as cited by the paper: 414 swabs from 94 patients; 44% of secondary cases from pre-symptomatic infectors; highest viral load at symptom onset; infectiousness and viral load decreasing monotonically after onset.</li>
<li>Hay et al. (main.tex:556-567): cross-sectional Ct can act as a clock for time since infection; growing epidemics show more recent infections. The paper's analysis does <em>not</em> use Ct this way (discussion.tex:26-33): "The fitted power and weight should therefore be interpreted as parameters of a surveillance-to-pressure mapping, rather than physiological measures."</li>
<li>The daily sum mixes count and magnitude, \\(\\VLsum_{g,t}=n^{PCR}_{g,t}\\,\\overline{\\VL}_{g,t}\\) (discussion.tex:35-41); a positive-PCR-count control is the suggested comparison (discussion.tex:47-49).</li>
<li>The sample is not random: it depends on who seeks a test and when, relative to symptom onset (main.tex:2032-2034).</li>
<li>Kutta et al. (main.tex:569-575): change-point detection on the Fréchet mean of Ct densities, a pointer to variant emergence.</li>
<li>Records: ${fmt(P.tests_window)} positive PCR records fall in the analysed Brazil window (to ${fmtDate(DA().series.Brazil.end)}); the source file holds ${fmt(P.tests_all)} to ${fmtDate(P.tests_all_end)}.</li>
</ul>`; },
    figure: { src: 'figures/a_brazil_observation_fit.webp', caption: 'Figure (fig:m31-brazil-fit) of the paper: Brazil Ct heat map, daily vl_sum, number of records and VL quantiles.', alt: 'Brazil nasal-PCR context figure' },
    flags: [
      'main.tex:542 references Figure fig:viral-kinetics, which is only in the appendix (results_preq2_appendix.tex:32); the schematic is redrawn here from its TikZ control points.',
      'In data/pcr_age_strat.csv the vl_mean and vl_sum columns use the paper map \\(1-(\\mathrm{Ct}-10.43)/29.55\\), but the vl_q* columns use \\(1-\\mathrm{Ct}/40\\), which the paper says is not used. The quantiles shown are recomputed from ct_q*.',
      '"More than 280,000 RT-qPCR results" (main.tex:2029) counts the whole source to 17-05-2022; about 152,500 fall in the analysed Brazil window, and they are available positive records, not all national tests.',
      'Brazil age groups are labelled three ways: 0–17/18–39/40–64/65+ (data table), 0–18/18–45/45–65/65+ (results_preq2_appendix.tex:59-60), 0–18/18–40/40–65/65+ (fit metadata and the CSV, used here).',
      'He et al. figures (main.tex:549-555, e.g. mean incubation 5.8 days) are unverified against the source and are kept out of the main tier; main.tex:567 still carries a red "(double check)" on Hay et al.',
    ],
    source: 'main.tex:531-575, 1285-1287, 2028-2034; results_preq2_appendix.tex:31-42; figures/DAG/viral_kinetic_diagram.tex; discussion.tex:26-49; data: data/pcr_age_strat.csv (ct_q25, ct_q50, ct_q75, vl_sum, num_tests)',
    alt: 'A schematic hump of viral load against days since infection with arrows for wastewater sample, symptom onset, nasal swab and peak. Then a PCR cycle counter with two tubes detected at Ct 18 and 32 and a bar mapping Ct to viral load. Finally four Brazil age-group panels of daily viral-load quartiles and a bar chart of the daily summed signal.',
    draw(t, ctx, D) {
      if (t < 10) grp(D, 1 - es(t, 9.4, 10), () => {
        // ---- phase 1: schematic kinetics
        const box = { x: 120, y: 70, w: 600, h: 270 };
        const f = D.frame(box, [0, 9.8], [0, 3.8], { xticks: [[0, 't = 0'], [6, 'τ = 6'], [9, 'tmax = 9']] });
        D.text('Viral load', box.x - 10, box.y + 4, { size: 26, color: C.ink2, align: 'right' });
        D.text('Time since infection', box.x + box.w, box.y + box.h + 64, { size: 26, color: C.ink2, align: 'right' });
        D.line([[box.x, box.y], [box.x, box.y + box.h]], { color: C.axis, width: 1.5 });
        D.line([[f.X(0), f.Y(.3)], [f.X(9.5), f.Y(.3)]], { color: C.muted, width: 2, dash: [8, 8] });
        D.text('LOD', f.X(9.5), f.Y(.3) - 10, { size: 26, color: C.muted, align: 'right' });
        D.line(D.partial(VKC.map(([x, y]) => [f.X(x), f.Y(y)]), es(t, 0, 3)), { color: C.vl, width: 4.5 });
        const marks = [[1.3, 1.45, .55, 'WW sample', 'right', C.obs, 1.6], [2.6, 3.65, 2.05, 'Symptom onset', 'left', C.ink, 3], [3.0, 3.25, 2.3, 'Nasal swab', 'left', C.ink, 3.6], [3.3, 2.85, 2.32, 'Peak viral load', 'left', C.ink, 4.2]];
        for (const [x, y0, y1, lab, al, col, at] of marks) {
          const a = es(t, at, at + .6); if (a <= 0) continue;
          D.arrow(f.X(x), f.Y(y0), f.X(x), lerp(f.Y(y0), f.Y(y1), a), { color: col, width: 2.5, head: 10, alpha: a });
          D.text(lab, al === 'right' ? f.X(x) + 18 : f.X(x) + (lab === 'Symptom onset' ? -20 : lab === 'Nasal swab' ? 10 : 16), f.Y(y0) - 8, { size: 26, color: col, align: al, alpha: a, weight: 600 });
        }
        // ---- phase 2: PCR cycles and the Ct -> VL map
        if (t > 5.6) {
          const a = es(t, 5.6, 6.4), cyc = Math.round(lerp(10, 40, es(t, 6.2, 9.2)));
          D.text(`PCR cycle ${cyc}`, 40, 470, { size: 34, weight: 650, alpha: a });
          const tubes = [[18, 'High viral load', 420], [32, 'Low viral load', 620]];
          for (const [ct, lab, x] of tubes) {
            const on = cyc >= ct;
            D.rect(x - 18, 418, 36, 70, { color: on ? C.vl : C.surface2, stroke: C.ink2, r: 10, alpha: a });
            D.text(on ? `detected, Ct ${ct}` : lab, x, 520, { size: 26, color: on ? C.ink : C.muted, align: 'center', alpha: a, weight: on ? 600 : 400 });
          }
          const b = { x: 170, y: 600, w: 560 }, ab = es(t, 7.4, 8.4);
          const Xc = ct => b.x + (ct - 10.43) / (39.98 - 10.43) * b.w;
          if (ab > 0) {
            ctx.save(); const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0); g.addColorStop(0, C.vl); g.addColorStop(1, C.surface2);
            ctx.globalAlpha = LGA * ab; ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, 26); ctx.restore();
            D.text('Ct', b.x - 50, b.y - 14, { size: 26, color: C.ink2, align: 'right', alpha: ab });
            D.text('VL', b.x - 50, b.y + 70, { size: 26, color: C.ink2, align: 'right', alpha: ab });
            for (const ct of [10.43, 20, 30, 39.98]) {
              D.line([[Xc(ct), b.y - 6], [Xc(ct), b.y + 32]], { color: C.ink2, width: 1.5, alpha: ab });
              D.text(String(ct), Xc(ct), b.y - 14, { size: 26, color: C.ink2, align: 'center', alpha: ab });
              D.text(vlOf(ct).toFixed(2), Xc(ct), b.y + 70, { size: 26, color: C.ink2, align: 'center', alpha: ab });
            }
            const am = es(t, 8.4, 9.4);
            for (const [ct] of tubes) { D.dot(Xc(ct), b.y + 13, 9, { color: C.ink, alpha: am }); }
            D.text(`Ct 18 → VL ${vlOf(18).toFixed(2)};  Ct 32 → VL ${vlOf(32).toFixed(2)}`, 400, b.y + 130, { size: 28, align: 'center', weight: 600, alpha: am });
            D.text('fewer cycles = more virus = higher VL', 400, b.y + 172, { size: 26, color: C.ink2, align: 'center', alpha: am });
          }
        }
      });
      if (t < 10) return;
      D.group(es(t, 10, 10.5), () => {
      // ---- phase 3: Brazil data
      const S = s04(), P = S.P, n = P.n;
      const cur = Math.round(lerp(1, n, es(t, 10.2, 12.8)));
      const xt = ticksAt(P.start, ['2020-07-01', '2020-11-01', '2021-03-01']);
      P.ages.forEach((a, k) => {
        const box = { x: 120, y: 54 + k * 128, w: 640, h: 92 };
        const f = D.frame(box, [0, n - 1], [.2, .8], { yticks: [.3, .5, .7], yfmt: v => v.toFixed(1), xticks: k === 3 ? xt : [] });
        const G = S.g[a], lo = [], hi = [];
        for (let i = 0; i < cur; i++) { if (G.q25[i] === null || G.q75[i] === null) continue; lo.push([f.X(i), f.Y(G.q25[i])]); hi.push([f.X(i), f.Y(G.q75[i])]); }
        D.band(lo, hi, { color: C.vl, alpha: .3 });
        lines(D, runs(G.q50, f.X, f.Y, cur), { color: C.vl, width: 3 });
        D.text(`${a}`, box.x + 10, box.y + 26, { size: 26, weight: 600 });
        D.text(`${fmt(G.n)} records`, box.x + box.w, box.y + 26, { size: 26, color: C.ink2, align: 'right' });
      });
      D.text('VL', 70, 40, { size: 26, color: C.ink2 });
      D.text('median and 25–75% band, 7-day mean', 120, 40, { size: 26, color: C.ink2 });
      // summed signal
      const a = es(t, 12.6, 13.2);
      if (a > 0) {
        const tmax = 900, box = { x: 120, y: 650, w: 640, h: 150 };
        const f = D.frame(box, [0, n - 1], [0, tmax], { yticks: [0, 400, 800], xticks: xt, alpha: a });
        const cur2 = Math.round(lerp(1, n, es(t, 12.8, 14.6)));
        for (let i = 0; i < cur2; i++) { const v = S.total[i]; if (v === null) continue; D.rect(f.X(i) - .7, f.Y(v), 1.7, f.Y(0) - f.Y(v), { color: C.vl, alpha: .85 * a, r: 0 }); }
        D.text('Daily signal: sum over ages and positive tests', 120, 632, { size: 26, weight: 600, alpha: a });
      }
      });
    },
  });

  // ======================================================================================
  // S05 — Wastewater (schematic, then Ottawa data)
  // ======================================================================================
  let S05cache = null;
  function s05() {
    if (S05cache) return S05cache;
    const r = mulberry(91600), houses = [], branchY = [92, 152, 212, 272];
    const plant = [400, 336];
    const off = new Set([7, 18, 29, 40]);                    // 46 of 50 houses connected = 92% (Ottawa 91.6%, main.tex:2039)
    let id = 0;
    for (const by of branchY) for (let c = 0; c < 13; c++) {
      if (houses.length >= 50) break;
      houses.push({ x: 70 + c * 52 + (c >= 7 ? 22 : 0), y: by - 26, by, id: id++ });
    }
    houses.forEach(h => { h.on = !off.has(h.id); h.ph = r(); });
    // synthetic infections and the faecal-kernel echo
    const inf = []; let lvl = 2; for (let d = 0; d < 70; d++) { lvl *= d < 30 ? 1.07 : .95; inf.push(lvl * (.4 + 1.4 * r()) * (r() < .12 ? 2.2 : 1)); }
    const D_F = 21.8, kern = []; for (let k = 0; k < 30; k++) kern.push(Math.pow(k + .5, 1.2) * Math.pow(Math.max(0, D_F - k), 2));
    const z = kern.reduce((a, b) => a + b, 0); kern.forEach((v, k) => kern[k] = v / z);
    const ww = inf.map((_, i) => { let s = 0; for (let k = 0; k < kern.length && k <= i; k++) s += inf[i - k] * kern[k]; return s; });
    return (S05cache = { houses, branchY, plant, inf, ww });
  }
  const shed = (x, Dd) => x <= 0 || x >= Dd ? 0 : Math.pow(x / Dd, 1.2) * Math.pow(1 - x / Dd, 2);
  FB.scene({
    id: 'S05', part: PART, title: "Wastewater: the whole city's sample", dur: 15,
    tags: [{ text: 'City map, shedding and infections: synthetic (illustration)', cls: 'synthetic' }],
    eq: '\\begin{aligned}I_{g,t}=\\textstyle\\sum_{s\\in\\mathcal W_t}\\bigl[\\,&b_C\\,\\Crep_{g,s}\\\\&+b_{VL}\\,W_s^{\\,p_{VL}}\\bigr]\\end{aligned}',
    beats: [
      { at: 0, cap: 'Homes feed pipes, pipes feed one treatment plant: about 92% of Ottawa is connected.' },
      { at: 4, cap: 'Virus is shed in faeces for longer than from the nose and throat.' },
      { at: 8, cap: 'So the wastewater curve is a smoothed echo of past infections, not a count of current ones.' },
      { at: 11, cap: () => { const O = DA().series.Ottawa; return `Ottawa, ${fmtDate(O.start)} to ${fmtDate(O.end)}: reported cases (top) and wastewater (bottom), each on its own axis, sharing only the dates.`; } },
    ],
    drawer: () => { const O = DA().series.Ottawa; return `<p>Wastewater concentrations of the N1 or N2 gene target "measure shedding by the whole connected population, regardless of testing, but without individual or age resolution" (main.tex:2036-2038). In the fitted model a city-wide wastewater series \\(W_t\\), common to all age groups (main.tex:2054-2057), takes the place of \\(\\VLsum_{g,s}\\) in the active set, with one city-wide \\(b_{VL}\\) and \\(p_{VL}\\).</p>
<ul>
<li>Faecal RNA was detectable in 43% (95% CI 34–52%) of patients; mean faecal shedding lasted 21.8 days against 14.7 days in respiratory specimens; 27% kept shedding faecally after respiratory RNA cleared (main.tex:612-619, Zhang et al.). Median faecal concentration about 3.4 log10 gene copies per gram over a median 26.0 days from onset (main.tex:622-625, Chen et al.).</li>
<li>"Wastewater measurements reflect a temporally smoothed history of infections rather than only the population that is currently infectious" (main.tex:625-628).</li>
<li>Related models (main.tex:629-643): per-person shedding with sewer decay (McMahan), EM reconstruction (Huisman), compartmental models with post-infectious shedding (Goldstein), joint infection, reproduction and ascertainment models with an infection-to-shedding convolution (Watson; Steyn). The paper does not model shedding explicitly (discussion.tex:52-60).</li>
<li>Toronto uses 4 plants (N2 on solids) and Scotland a 10-site final panel (N1); both use the panel mean, about 2 samples per site per week (main.tex:2039-2045, tab:data-overview). Ottawa: one plant, 6.4 samples per week.</li>
<li>Fitted wastewater powers are small: posterior medians of \\(p_{VL}\\) from 0.07 to 0.60 in converged cells, so the term "acts mostly as additional, nearly constant infectious pressure" (results_ww_sp.tex:22).</li>
<li>Ottawa 7-day-mean peaks in the export: cases ${fmt3(O.cases_peak.v)}/day on ${fmtDate(O.cases_peak.date)}; wastewater on ${fmtDate(O.sig_peak.date)}.</li>
</ul>`; },
    figure: { src: 'figures/a_data_overview.webp', caption: 'Figure (fig:data-overview) of the paper; the Ottawa column is re-animated here.', alt: 'Paper data overview figure' },
    flags: [
      'eq:ww-I (main.tex:1557-1562) is an older form (lags 0, 1, 3; generic \\(b_1,b_2,b_3\\); mislabelled "proposed formulation #2"). The window form of main.tex:1304-1305 is shown, with \\(W_s\\) in place of \\(\\VLsum_{g,s}\\).',
      'The paper writes "%90" (main.tex:255, 591). Ottawa coverage is 91.6% (main.tex:2039); shown as about 92% (46 of 50 houses on the map).',
      'In Ottawa the wastewater 7-day maximum (03-01-2021) precedes the case peak (15-04-2021) by more than three months. That is the export as-is; the flipbook does not claim wastewater "leads" cases.',
      'Shedding humps are schematic shapes spanning the reported mean durations; they are not fitted shedding distributions.',
    ],
    source: 'main.tex:577-654, 2036-2045, 1557-1562, 1303-1305; results_ww_sp.tex:22; data: figures/data_overview/data_overview_series.csv (dataset Ottawa), data_overview_table.tex',
    alt: 'A schematic city: 50 houses on branching pipes draining to one treatment plant, 46 connected. Two shedding humps, respiratory 14.7 days and faecal 21.8 days. Spiky synthetic infections smoothed into a wastewater-like curve. Then Ottawa data in two stacked panels sharing the date axis: grey daily case bars with a blue 7-day mean on top, and the orange wastewater 7-day mean with sample dots on a log axis below, each with its 7-day peak marked.',
    draw(t, ctx, D) {
      const S = s05();
      if (t < 11) grp(D, 1 - es(t, 10.4, 11), () => {
        // ---- city
        const am = es(t, 0, 1.2), [px, py] = S.plant;
        D.line([[px, S.branchY[0]], [px, py - 20]], { color: C.ink2, width: 5, alpha: am });
        for (const by of S.branchY) D.line([[64, by], [736, by]], { color: C.ink2, width: 3, alpha: am });
        for (const h of S.houses) {
          const a = es(t, .1 + h.id * .04, .5 + h.id * .04), col = h.on ? C.ink : C.muted;
          if (h.on) D.line([[h.x, h.y + 12], [h.x, h.by]], { color: C.ink2, width: 2, alpha: a });
          ctx.save(); ctx.globalAlpha = LGA * a; ctx.fillStyle = h.on ? C.ink2 : C.axis; ctx.beginPath();
          ctx.moveTo(h.x - 12, h.y + 12); ctx.lineTo(h.x - 12, h.y - 2); ctx.lineTo(h.x, h.y - 13); ctx.lineTo(h.x + 12, h.y - 2); ctx.lineTo(h.x + 12, h.y + 12); ctx.closePath(); ctx.fill(); ctx.restore();
          if (!h.on) D.text('×', h.x, h.y - 18, { size: 26, color: C.critical, align: 'center', alpha: a });
          // droplets: house -> branch -> trunk -> plant, position periodic in t (pure function of t)
          if (h.on && t > 1.2) {
            const L1 = h.by - h.y - 12, L2 = Math.abs(h.x - px), L3 = py - 20 - h.by, Lt = L1 + L2 + L3;
            const s = ((t * 150 + h.ph * Lt) % Lt);
            let x, y; if (s < L1) { x = h.x; y = h.y + 12 + s; } else if (s < L1 + L2) { x = h.x + Math.sign(px - h.x) * (s - L1); y = h.by; } else { x = px; y = h.by + (s - L1 - L2); }
            D.dot(x, y, 4, { color: C.vl, alpha: .9 * seg(t, 1.2, 1.8) });
          }
        }
        D.rect(px - 60, py - 22, 120, 44, { color: C.surface2, stroke: C.ink, r: 10, alpha: am });
        D.text('Plant', px, py + 9, { size: 26, weight: 600, align: 'center', alpha: am });
        D.text('46 of 50 homes connected (Ottawa: 91.6%)', 400, 404, { size: 26, color: C.ink2, align: 'center', alpha: es(t, 1.5, 2.3) });
        // ---- shedding humps
        const as = es(t, 4, 4.8);
        if (as > 0) {
          const f = D.frame({ x: 110, y: 470, w: 620, h: 120 }, [0, 30], [0, 1.25], { xticks: [[0, '0'], [10, '10'], [20, '20'], [30, '30 days']], alpha: as });
          const zr = 1 / Math.max(...Array.from({ length: 300 }, (_, i) => shed(i / 10, 14.7))), zf = 1 / Math.max(...Array.from({ length: 300 }, (_, i) => shed(i / 10, 21.8)));
          const u = es(t, 4.4, 6.6), R = [], F = [];
          for (let x = 0; x <= 30 * u; x += .25) { R.push([f.X(x), f.Y(zr * shed(x, 14.7))]); F.push([f.X(x), f.Y(.8 * zf * shed(x, 21.8))]); }
          D.line(R, { color: C.ink2, width: 3, alpha: as }); D.line(F, { color: C.vl, width: 4, alpha: as });
          const al = es(t, 6.2, 7);
          D.text('respiratory, mean 14.7 days', f.X(5.2), f.Y(1.13), { size: 26, color: C.ink2, alpha: al });
          D.text('faecal, mean 21.8 days', f.X(17), f.Y(.62), { size: 26, color: C.vl, weight: 600, alpha: al });
          D.text('Shedding after symptom onset (schematic)', 110, 450, { size: 26, weight: 600, alpha: as });
        }
        // ---- convolution demo
        const ac = es(t, 8, 8.7);
        if (ac > 0) {
          const n = S.inf.length, mx = Math.max(...S.inf), f = D.frame({ x: 110, y: 690, w: 620, h: 150 }, [0, n - 1], [0, mx], { alpha: ac });
          const u = es(t, 8.3, 10.6);
          for (let i = 0; i < n * u; i++) D.rect(f.X(i) - 3, f.Y(S.inf[i]), 6, f.Y(0) - f.Y(S.inf[i]), { color: C.obs, alpha: .6 * ac, r: 1 });
          const wmx = Math.max(...S.ww);
          D.line(D.partial(S.ww.map((v, i) => [f.X(i), f.Y(.9 * mx * v / wmx)]), u), { color: C.vl, width: 4.5, alpha: ac });
          D.text('infections (synthetic)', 110, 672, { size: 26, color: C.ink2, alpha: ac });
          D.text('wastewater-like echo', 730, 672, { size: 26, color: C.vl, weight: 600, align: 'right', alpha: ac });
        }
      });
      if (t < 11) return;
      // ---- Ottawa data: two stacked panels sharing the date axis (no dual axis)
      const O = DA().series.Ottawa, n = O.n;
      D.group(es(t, 11, 11.6), () => {
        D.text(`Ottawa, ${fmtDate(O.start)} to ${fmtDate(O.end)}`, 40, 50, { size: 28, weight: 650 });
        const xt = ticksAt(O.start, ['2020-10-01', '2021-03-01', '2021-08-01']);
        const cur = Math.round(lerp(1, n, es(t, 11.4, 14)));
        const tag = (str, x, y, col) => { const w = textW(ctx, str, 26, 600) + 14;
          const x0 = clamp(x - w / 2, 112, 730 - w);
          D.rect(x0, y - 26, w, 36, { color: C.surface, r: 8, alpha: .85 }); D.text(str, x0 + 7, y, { size: 26, weight: 600, color: col }); };
        const ap = es(t, 13.6, 14.4);
        // top: reported cases, linear
        const bc = { x: 110, y: 120, w: 620, h: 260 };
        const fc = D.frame(bc, [0, n - 1], [0, 420], { yticks: [0, 200, 400], ylab: 'Reported cases per day' });
        for (let i = 0; i < cur; i++) { const v = O.cases[i]; if (v === null) continue; D.rect(fc.X(i) - .6, fc.Y(v), 1.5, fc.Y(0) - fc.Y(v), { color: C.obs, alpha: .45, r: 0 }); }
        lines(D, runs(O.cases7, fc.X, fc.Y, cur), { color: C.cases, width: 4 });
        // bottom: wastewater N1, log10 scale
        const bw = { x: 110, y: 480, w: 620, h: 260 };
        const fw = D.frame(bw, [0, n - 1], [2, 4.8], { yticks: [2, 3, 4], yfmt: v => Math.pow(10, v).toLocaleString('en-US'), xticks: xt, ylab: 'Wastewater N1 (log scale)' });
        const YW = v => v > 0 ? fw.Y(Math.log10(v)) : NaN;
        for (let i = 0; i < cur; i++) { const v = O.sig[i]; if (v === null || v <= 0) continue; D.dot(fw.X(i), YW(v), 2.4, { color: C.vl, alpha: .4 }); }
        lines(D, runs(O.sig7, fw.X, YW, cur), { color: C.vl, width: 4 });
        if (ap > 0) D.group(ap, () => {
          const xc = fc.X(O.cases_peak.i), yc = fc.Y(O.cases_peak.v), xw = fw.X(O.sig_peak.i), yw = YW(O.sig_peak.v);
          D.dot(xc, yc, 8, { color: C.cases, ring: true }); D.dot(xw, yw, 8, { color: C.vl, ring: true });
          tag(`7-day peak ${fmtDate(O.cases_peak.date)}: ${fmt3(O.cases_peak.v)}/day`, xc, yc - 18, C.ink);
          tag(`7-day peak ${fmtDate(O.sig_peak.date)}`, xw, yw - 18, C.ink);
        });
        const ly = 836;
        D.rect(110, ly - 20, 22, 22, { color: C.obs, alpha: .45, r: 2 }); D.text('daily cases', 142, ly, { size: 26, color: C.ink2 });
        D.line([[330, ly - 9], [370, ly - 9]], { color: C.cases, width: 4 }); D.text('cases, 7-day mean', 380, ly, { size: 26, color: C.ink2 });
        D.line([[110, ly + 31], [140, ly + 31]], { color: C.vl, width: 4 }); D.text('wastewater, 7-day mean', 150, ly + 40, { size: 26, color: C.ink2 });
        D.dot(470, ly + 31, 4, { color: C.vl }); D.text('samples', 484, ly + 40, { size: 26, color: C.ink2 });
      });
    },
  });

  // ======================================================================================
  // S06 — Five case studies
  // ======================================================================================
  const ORDER = ['Brazil', 'São Paulo', 'Ottawa', 'Toronto', 'Scotland'];
  const G0 = '2020-04-05', G1 = '2021-12-31';
  let S06cache = null;
  function s06() {
    if (S06cache) return S06cache;
    const A = DA(), rows = {};
    for (const k of ORDER) {
      const s = A.series[k], tb = A.table.find(r => r.dataset === k);
      const nz = a => a.filter(v => v !== null && v > 0);
      const cm = Math.max(...nz(s.cases7)), dm = Math.max(...nz(s.deaths7));
      const sl = nz(s.sig7).map(Math.log10), lo = Math.min(...sl), hi = Math.max(...sl);
      rows[k] = { s, tb, off: dayIx(G0, s.start), c: s.cases7.map(v => v === null ? null : v / cm), d: s.deaths7.map(v => v === null ? null : v / dm),
        g: s.sig7.map(v => v === null || v <= 0 ? null : (Math.log10(v) - lo) / (hi - lo)) };
    }
    return (S06cache = { rows, span: dayIx(G0, G1) });
  }
  let S06open = null;                                     // expanded dataset (tap a row), reset on entering the scene
  function niceTicks(max) { const raw = max / 2.2, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, out = [0]; while (out[out.length - 1] < max) out.push(out[out.length - 1] + step); return out; }
  const kfmt = v => v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? (v / 1e3) + 'k' : String(+v.toPrecision(3));
  function monthTicks(start, n) {
    const d0 = new Date(start + 'T00:00:00Z'), months = Math.round(n / 30.4), k = Math.max(1, Math.ceil(months / 3.5)), out = [];
    for (let m = 1; m <= months; m += k) { const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + m, 1)).toISOString().slice(0, 10);
      const i = dayIx(start, d); if (i > 8 && i < n - 25) out.push([i, fmtDate(d)]); }
    return out;
  }
  function drawExpanded(D, ctx, k) {
    const R = s06().rows[k], s = R.s, n = s.n, xt = monthTicks(s.start, n), cut = s.cutoff.N - 1;
    D.text(k, 40, 50, { size: 32, weight: 650 });
    D.text('tap to return', 760, 50, { size: 26, color: C.muted, align: 'right' });
    const panel = (box, vals, sm, col, lab, last, raw) => {
      const mx = Math.max(...sm.filter(v => v !== null)), yt = niceTicks(mx * 1.08);
      const f = D.frame(box, [0, n - 1], [0, yt[yt.length - 1]], { yticks: yt, yfmt: kfmt, xticks: last ? xt : [], ylab: lab });
      for (let i = 0; i < n; i++) { const v = vals[i]; if (v === null) continue; const vv = Math.min(v, yt[yt.length - 1]);
        D.rect(f.X(i) - .6, f.Y(vv), 1.4, f.Y(0) - f.Y(vv), { color: C.obs, alpha: raw, r: 0 }); }
      lines(D, runs(sm, f.X, f.Y), { color: col, width: 3.5 }); return f;
    };
    const fc = panel({ x: 130, y: 110, w: 600, h: 190 }, s.cases, s.cases7, C.cases, 'Reported cases per day (7-day mean)', false, .4);
    const fd = panel({ x: 130, y: 380, w: 600, h: 160 }, s.deaths, s.deaths7, C.ink2, 'Reported deaths per day (7-day mean)', false, .3);
    const pos = s.sig7.filter(v => v !== null && v > 0), lo = Math.floor(Math.log10(Math.min(...pos))), hi = Math.ceil(Math.log10(Math.max(...pos)));
    const yt = []; for (let v = lo; v <= hi; v++) yt.push(v);
    const bs = { x: 130, y: 620, w: 600, h: 170 };
    const fs = D.frame(bs, [0, n - 1], [lo, hi], { yticks: yt, yfmt: v => kfmt(Math.pow(10, v)), xticks: xt,
      ylab: s.kind === 'individual' ? 'Viral-load signal, daily sum (log)' : 'Wastewater signal (log)' });
    const YS = v => v > 0 ? fs.Y(Math.log10(v)) : NaN;
    for (let i = 0; i < n; i++) { const v = s.sig[i]; if (v === null || v <= 0 || Math.log10(v) < lo || Math.log10(v) > hi) continue; D.dot(fs.X(i), YS(v), 2, { color: C.vl, alpha: .4 }); }
    lines(D, runs(s.sig7, fs.X, YS), { color: C.vl, width: 3.5 });
    const xc = fc.X(cut);
    D.line([[xc, 110], [xc, bs.y + bs.h]], { color: C.ink, width: 2, dash: [6, 5] });
    const lab = `reference cutoff N=${s.cutoff.N}`, w = textW(ctx, lab, 26, 600) + 12, lx = xc + 6 + w > 760 ? xc - 6 - w : xc + 6;
    D.rect(lx, 116, w, 32, { color: C.surface, r: 6, alpha: .85 }); D.text(lab, lx + 6, 141, { size: 26, weight: 600 });
    D.text(`${fmtDate(s.start)} to ${fmtDate(s.end)} · light marks: daily values`, 40, 886, { size: 26, color: C.muted });
  }
  FB.scene({
    id: 'S06', part: PART, title: 'Five case studies', dur: 15,
    tags: [{ text: 'Each series scaled to its own maximum' }],
    eq: '\\Crep_{g,t},\\ \\Drep_{g,t},\\ \\VL_{g,t}\\ \\text{or}\\ W_t,\\quad g=1,\\dots,4',
    beats: [
      { at: 0, cap: 'Two swab datasets: Brazil (212 million people) and São Paulo state (46 million).' },
      { at: 4, cap: 'Three sewage datasets: Ottawa (1 million), Toronto (2.8 million) and Scotland (5.4 million).' },
      { at: 8, cap: 'Each has daily cases and deaths in four age groups, plus a virus signal. Tap a row to enlarge it.' },
      { at: 12, cap: 'Periods differ, from April 2020 to December 2021. Dashed lines: the reference cutoff of each dataset.' },
    ],
    drawer: () => { const A = DA(); const rows = A.table.map(r => `<tr><td>${r.dataset}</td><td>${r.pop.toLocaleString('en-US')}</td><td>${r.from} to ${r.to} (${r.days} d)</td><td>${r.ages}</td><td>${r.source}</td><td>${r.sampling}</td><td>${r.age_deaths}</td></tr>`).join('');
      return `<p>"The datasets differ in population size, from about one million to over two hundred million, in period, from the first wave of 2020 to the end of 2021, and in how directly the age structure of deaths is observed" (main.tex:1992-1995).</p>
<div style="overflow-x:auto"><table style="font-size:.8rem;border-collapse:collapse"><tr><th>Dataset</th><th>Population</th><th>Period</th><th>Ages</th><th>VL source</th><th>Sampling</th><th>Age deaths</th></tr>${rows}</table></div>
<ul>
<li>Prequential design: horizon \\(H=14\\), spacing \\(\\Delta=10\\), first origin \\(N_0=180\\) (Brazil) and 90 (Ottawa) (main.tex:2066-2068). Brazil and Ottawa are full grids; São Paulo, Toronto and Scotland are a coarse interim pass every 42 days (results_ww_sp.tex:6).</li>
<li>Reference cutoffs (largest \\(N\\) with both active sets): Brazil 360, Ottawa 390, Toronto 300, Scotland 216, São Paulo 222 (results_preq2_main.tex:80). On screen each is placed at day \\(N\\) of its dataset.</li>
<li>Ottawa's age-specific deaths "carry no independent information about the age profile of fatality" (main.tex:2022-2024).</li>
<li>The virus signal is in different units: a dimensionless Ct proxy for swabs, gene copies for wastewater, with median daily values of about 20 (Toronto), 2,850 (Ottawa) and 26,900 (Scotland) under one shared \\(b_{VL}\\) prior (results_ww_sp.tex:22).</li>
<li>Toronto and Scotland run to 31-12-2021, so they include vaccination, Delta and the start of Omicron (both case peaks are on 28-12-2021).</li>
</ul>`; },
    figure: { src: 'figures/a_data_overview.webp', caption: 'Figure (fig:data-overview) of the paper: all five datasets, re-animated here from the exported series.', alt: 'Paper data overview figure' },
    flags: [
      'The Introduction says the analysis concerns "the early years of COVID before strains and pharmaceutical interventions" (main.tex:224-226); Toronto and Scotland run to 31-12-2021, which includes vaccination, Delta and the start of Omicron.',
      'The Contributions list still says "(as well as Scotland and Toronto (?)" (main.tex:407); the data table is taken as authoritative.',
      'main.tex:1999 gives Brazil as "Pop. ~210M+"; the table says 212,000,000 (used). Ottawa is rounded to 1,000,000 in the table.',
      'Brazil age groups: the table says 0–17, 18–39, 40–64, 65+, the fit metadata 0–18, 18–40, 40–65, 65+ (see S04).',
      'São Paulo, Toronto and Scotland cutoffs belong to the interim pass.',
    ],
    source: 'main.tex:1984-2047, 2066-2071; figures/data_overview/data_overview_table.tex; results_preq2_main.tex:25-28, 80; results_ww_sp.tex:6, 22; data: figures/data_overview/data_overview_series.csv',
    alt: 'Five rows on a shared calendar from April 2020 to December 2021: Brazil, São Paulo, Ottawa, Toronto, Scotland. Each row shows cases (blue area), deaths (light line) and the virus signal (orange, log) scaled to its own maximum, with population, signal source, sampling rate and age-death availability, and a dashed reference-cutoff line.',
    setup() { S06open = null; },
    onTap(x, y) {
      if (S06open) { S06open = null; return true; }
      const r = Math.floor((y - 64) / 160); if (r < 0 || r > 4 || y > 64 + r * 160 + 150) return false;
      S06open = ORDER[r]; return true;
    },
    draw(t, ctx, D) {
      if (S06open) { drawExpanded(D, ctx, S06open); return; }
      const { rows, span } = s06(), X0 = 40, W = 720, Xg = i => X0 + W * i / span;
      const al = seg(t, 0, .6);
      D.label('Cases', 58, 40, C.cases); D.label('Deaths', 210, 40, C.ink2); D.label('Virus signal (log)', 382, 40, C.vl);
      // shared calendar
      for (const d of ['2020-07-01', '2021-01-01', '2021-07-01']) {
        const x = Xg(dayIx(G0, d)); D.line([[x, 62], [x, 862]], { color: C.grid, width: 1, alpha: al * .9 });
        D.text(fmtDate(d), x, 890, { size: 26, color: C.muted, align: 'center', alpha: al });
      }
      ORDER.forEach((k, r) => {
        const R = rows[k], y0 = 64 + r * 160, start = r < 2 ? 0 : 4, u = es(t, start + .2 * (r % 3), start + 3.2 + .2 * (r % 3));
        if (u <= 0) return;
        const box = { x: X0, y: y0 + 40, w: W, h: 70 }, X = i => Xg(R.off + i), Y = v => box.y + box.h - v * box.h;
        D.text(k, X0, y0 + 30, { size: 30, weight: 650, alpha: seg(t, start, start + .5) });
        D.line([[X0, box.y + box.h], [X0 + W, box.y + box.h]], { color: C.axis, width: 1.5 });
        D.rect(X(0), box.y, X(R.s.n - 1) - X(0), box.h, { color: C.surface2, r: 3, alpha: .8 });
        const cur = Math.round(u * R.s.n);
        const cr = runs(R.c, X, Y, cur); cr.forEach(p => D.band(p.map(([x]) => [x, Y(0)]), p, { color: C.cases, alpha: .28 }));
        lines(D, cr, { color: C.cases, width: 2.5 });
        lines(D, runs(R.d, X, Y, cur), { color: C.ink2, width: 2 });
        lines(D, runs(R.g, X, Y, cur), { color: C.vl, width: 3 });
        // chips
        const ac = es(t, 8 + r * .4, 8.8 + r * .4);
        if (ac > 0) {
          const tb = R.tb, src = tb.source.replace('Individual swab Ct (RT-qPCR)', 'swab Ct').replace('Wastewater ', 'WW ').replace(/ \(.*\)$/, '').replace('10-site final panel', '10 sites');
          D.text(`${tb.pop.toLocaleString('en-US')} · ${src}`, X0 + W, y0 + 30, { size: 26, color: C.ink2, align: 'right', alpha: ac });
          const deaths = tb.age_deaths.startsWith('Yes') ? 'yes' : 'no, allocated';
          D.text(`${tb.sampling.replace('Daily; median', 'daily, median').replace('/ site', '/site')} · age-specific deaths: ${deaths}`, X0, y0 + 142, { size: 26, color: C.muted, alpha: ac });
        }
        // reference cutoff
        const ar = es(t, 12 + r * .35, 12.7 + r * .35);
        if (ar > 0) {
          const xc = X(R.s.cutoff.N - 1);
          D.line([[xc, box.y - 4], [xc, box.y + box.h]], { color: C.ink, width: 2.5, dash: [6, 5], alpha: ar });
          const lab = `N=${R.s.cutoff.N}`, w = textW(ctx, lab, 26, 600) + 12;
          const lx = xc + 6 + w > X0 + W ? xc - 6 - w : xc + 6;
          D.rect(lx, box.y + 2, w, 32, { color: C.surface, r: 6, alpha: .85 * ar });
          D.text(lab, lx + 6, box.y + 27, { size: 26, weight: 600, alpha: ar });
        }
      });
    },
  });

  // ======================================================================================
  // S07 — What this paper contributes (synthetic draws)
  // ======================================================================================
  let S07cache = null;
  function s07() {
    if (S07cache) return S07cache;
    const r = mulberry(1407), J = 60, rho = 14, draws = [];
    for (let g = 0; g < 4; g++) { const w = [], ph = [], a = [];
      for (let j = 0; j < J; j++) { w.push(normal(r) / rho); ph.push(2 * Math.PI * r()); a.push(normal(r)); }
      draws.push(x => { let s = 0; for (let j = 0; j < J; j++) s += a[j] * Math.cos(w[j] * x + ph[j]); return s * Math.sqrt(2 / J) * .35; }); }
    const lrho = [-1.3, -.4, .5, 1.2].map(z => Math.log(14) + .2 * z);   // illustrative, sigma = 0.2
    // HSGP pieces: basis on [-L, L], SE spectral density, rho = 0.3, alpha = 1
    const L = 1.5, z = Array.from({ length: 24 }, () => normal(r));
    const sd = j => { const w = Math.PI * j / (2 * L), rr = .3; return Math.sqrt(Math.sqrt(2 * Math.PI) * rr * Math.exp(-.5 * rr * rr * w * w)); };
    const phi = (j, x) => Math.sin(Math.PI * j * (x + L) / (2 * L)) / Math.sqrt(L);
    let fmax = 0; for (let x = -1; x <= 1; x += .01) { let s = 0; for (let j = 1; j <= 20; j++) s += sd(j) * phi(j, x) * z[j - 1]; fmax = Math.max(fmax, Math.abs(s)); }
    return (S07cache = { draws, lrho, L, z, sd, phi, fmax });
  }
  const AGEC = () => [C.ink, C.ink2, C.obs, C.muted];
  FB.scene({
    id: 'S07', part: PART, title: 'What this paper contributes', dur: 15,
    tags: [{ text: 'GP draws: synthetic (illustration)', cls: 'synthetic' }],
    eq: '\\begin{aligned}\\lambda_{g,t}&=\\exp\\bigl(\\mu^\\lambda_g+\\widetilde f^\\lambda_{g,t}\\bigr)\\\\\\CFR_{g,t}&=\\logit^{-1}\\bigl(\\mu^{\\CFR}_g+\\widetilde f^{\\CFR}_{g,t}\\bigr)\\end{aligned}',
    beats: [
      { at: 0, cap: 'Transmission and fatality change smoothly over time, and the model lets them, separately for each age group.' },
      { at: 4, cap: 'Age groups share information without being forced to move together.',
        eq: '\\begin{aligned}\\log\\alpha^p_g&\\sim\\N\\bigl(\\mu_{\\alpha,p},\\sigma_{\\alpha,p}^2\\bigr)\\\\\\log\\rho^p_g&\\sim\\N\\bigl(\\mu_{\\rho,p},\\sigma_{\\rho,p}^2\\bigr)\\end{aligned}' },
      { at: 7, cap: 'A fast approximation, built from a few sine waves, keeps many such curves computable.',
        eq: '\\widetilde f(t)\\approx\\textstyle\\sum_{j=1}^{m}\\sqrt{S_{\\alpha,\\rho}(\\omega_j)}\\,\\phi_j(t)\\,z_j' },
      { at: 10, cap: 'Virus data enter the infectious pressure, and are judged by out-of-sample 14-day forecasts.',
        eq: '\\begin{aligned}I_{g,t}=\\textstyle\\sum_{s\\in\\mathcal W_t}\\bigl[\\,&b_C\\,\\Crep_{g,s}\\\\&+b_{VL,g}\\,\\bigl(\\VLsum_{g,s}\\bigr)^{p_{VL,g}}\\bigr]\\end{aligned}' },
    ],
    drawer: `<p>The proposed model (main.tex:1294-1338) gives every age group its own transmission GP and CFR GP, and ties their hyperparameters together with exchangeable hyperpriors (main.tex:1327-1336):</p>
\\[\\begin{aligned}\\mu_{\\alpha,\\lambda}&\\sim\\N(-0.804,0.446^2),\\\\ \\mu_{\\alpha,\\CFR}&\\sim\\N(-1.497,0.446^2),\\\\ \\mu_{\\rho,p}&\\sim\\N(\\log 14,0.302^2),\\\\ \\sigma_{\\alpha,p},\\sigma_{\\rho,p}&\\sim\\HN(0,0.15).\\end{aligned}\\]
<ul>
<li>Contribution 1 (main.tex:352-359): GPs as stochastic drivers of the general stochastic epidemic, aiming to estimate all squared-exponential kernel hyperparameters, which are "often only partially identified" in the literature.</li>
<li>Contribution 2 (main.tex:361-366): exchangeable age-hierarchical hyperpriors, giving partial pooling with conditionally independent paths and no full multi-task correlation structure. The results compare SGP, SGP-AI, IGP and ExGP (results_preq2_main.tex:14-19).</li>
<li>Contribution 3 (main.tex:368-374): a reduced-rank spectral (Hilbert-space, HSGP) approximation with "comparable statistical efficiency with lighter computational complexity". The basis size is \\(m\\) (S15 has the details).</li>
<li>Contributions 4-5 (main.tex:376-396): a viral-load-augmented force of infection, a departure from the linear mass-action assumption (O'Neill 2012). Only \\(b_{VL}/b_C\\) and \\(b_C e^{\\mu^\\lambda_g}\\) are identified (main.tex:1659-1661).</li>
<li>Unlike Bouranis et al. (2025) and Flaxman et al. (2020), which reconstruct the past from deaths, the paper is forward-looking: short-term forecasts of cases and deaths (main.tex:332-339).</li>
</ul>
<p>On screen: the four curves are random draws from a squared-exponential GP with length scale 14 days; the four length scales are illustrative draws around \\(\\log 14\\); the sine-wave panel uses an illustrative length scale.</p>`,
    flags: [
      'Contribution 4 (main.tex:376-387) speaks of "coefficient and power scalings… various transformations". The main comparison fits only the additive \\(I=\\mathrm{VL}+C\\) with \\((b_C,b_{VL},p_{VL})\\); \\(I=\\mathrm{VL}\\times C\\) was fitted only in São Paulo and "is worse than cases alone" (results_active_set_sp.tex:141-142).',
      'The Contributions section carries an AI-revision disclaimer (main.tex:329); the wording may still change.',
      'Brazil and São Paulo fits use age-specific \\(b_{VL,g}, p_{VL,g}\\); wastewater fits use one pair (shown in the fitted form).',
    ],
    source: 'main.tex:328-407 (contributions), 1294-1338 (proposed model), 1327-1336 (exchangeable hyperpriors); results_preq2_main.tex:14-19',
    alt: 'Four stacked cards. 1: four smooth wiggling transmission curves, one per age group. 2: a parent bell curve over the length scale, dropping four dots for the age groups. 3: a curve built as a weighted sum of sine waves, with the weights as bars and the count of basis functions growing. 4: case bars and a viral-load line flowing into an active-set box with knobs b_C, b_VL and p_VL. A final strip says forecasts are judged by CRPS.',
    draw(t, ctx, D) {
      const S = s07(), cols = AGEC(), ages = ['0–18', '18–40', '40–65', '65+'];
      const card = (k, title, at) => {
        const y = 14 + k * 206, a = es(t, at, at + .8);
        if (a <= 0) return null;
        D.rect(20, y + (1 - a) * 20, 760, 194, { color: C.surface2, r: 16, alpha: a });
        D.text(`${k + 1}`, 48, y + 44, { size: 30, color: C.muted, weight: 700, alpha: a });
        D.text(title, 84, y + 44, { size: 30, weight: 650, alpha: a });
        return { y, a };
      };
      // 1 GP-driven SIR
      const c1 = card(0, 'GP-driven transmission, per age group', 0);
      if (c1) {
        const sh = t * 2.2, X = x => 60 + x * 5.6, Y0 = c1.y + 122;
        S.draws.forEach((f, g) => {
          const pts = []; for (let x = 0; x <= 100; x += 1) pts.push([X(x), Y0 + (g - 1.5) * 18 - 34 * f(x + sh)]);
          D.line(D.partial(pts, es(t, .3 + g * .25, 2 + g * .25)), { color: cols[g], width: 3, alpha: c1.a });
        });
        // direct labels at the curve ends, spread to at least 28 units apart
        const ly = S.draws.map((f, g) => ({ g, y: Y0 + (g - 1.5) * 18 - 34 * f(100 + sh) + 9 })).sort((a, b) => a.y - b.y);
        for (let i = 1; i < 4; i++) ly[i].y = Math.max(ly[i].y, ly[i - 1].y + 32);
        const over = ly[3].y - (c1.y + 186); if (over > 0) ly.forEach(l => l.y -= over);
        ly.forEach(({ g, y }) => D.text(ages[g], 640, y, { size: 26, color: cols[g], weight: 600, alpha: c1.a * seg(t, 2, 2.6) }));
      }
      // 2 exchangeable hyperpriors
      const c2 = card(1, 'Exchangeable hyperpriors', 3.6);
      if (c2) {
        const lo = Math.log(5), hi = Math.log(40), X = v => 120 + (v - lo) / (hi - lo) * 560, base = c2.y + 160, m = Math.log(14), sdv = .302;
        const pts = []; for (let v = lo; v <= hi; v += .02) pts.push([X(v), base - 80 * Math.exp(-.5 * ((v - m) / sdv) ** 2)]);
        D.band(pts.map(([x]) => [x, base]), pts, { color: C.ink, alpha: .12 * c2.a }); D.line(pts, { color: C.ink2, width: 2.5, alpha: c2.a });
        D.line([[X(lo), base], [X(hi), base]], { color: C.axis, width: 1.5, alpha: c2.a });
        for (const d of [7, 14, 28]) D.text(`ρ = ${d} d`, X(Math.log(d)), base + 30, { size: 26, color: C.muted, align: 'center', alpha: c2.a });
        S.lrho.forEach((v, g) => { const u = es(t, 4.6 + g * .35, 5.4 + g * .35); if (u <= 0) return;
          D.dot(X(v), lerp(c2.y + 60, base - 8, u), 10, { color: cols[g], ring: true }); });
        D.text('one parent, four children', 760, c2.y + 44, { size: 26, color: C.ink2, align: 'right', alpha: c2.a });
      }
      // 3 HSGP
      const c3 = card(2, 'HSGP: curves from sine waves', 6.8);
      if (c3) {
        const m = Math.max(1, Math.round(lerp(2, 20, es(t, 7.4, 10)))), X = x => 60 + (x + 1) / 2 * 460, Y0 = c3.y + 125;
        for (let j = 1; j <= Math.min(m, 6); j++) { const pts = []; for (let x = -1; x <= 1.0001; x += .02) pts.push([X(x), Y0 - 24 * S.phi(j, x)]); D.line(pts, { color: C.muted, width: 1.5, alpha: .5 * c3.a }); }
        const f = x => { let s = 0; for (let j = 1; j <= m; j++) s += S.sd(j) * S.phi(j, x) * S.z[j - 1]; return s; };
        const pts = []; for (let x = -1; x <= 1.0001; x += .01) pts.push([X(x), Y0 - 44 * f(x) / S.fmax]); D.line(pts, { color: C.ink, width: 3.5, alpha: c3.a });
        const bx = 560, sd1 = S.sd(1);
        for (let j = 1; j <= 20; j++) { const h = 70 * S.sd(j) / sd1; D.rect(bx + (j - 1) * 10, c3.y + 165 - h, 7, h, { color: j <= m ? C.ink2 : C.axis, r: 1, alpha: c3.a }); }
        D.text(`m = ${m}`, 760, c3.y + 44, { size: 26, color: C.ink2, align: 'right', alpha: c3.a });
      }
      // 4 viral-load active set
      const c4 = card(3, 'Viral load in the active set', 9.8);
      if (c4) {
        const y = c4.y, r = mulberry(7);
        for (let i = 0; i < 16; i++) { const h = 14 + 40 * Math.abs(Math.sin(i / 3.5)) + 8 * r(); D.rect(190 + i * 13, y + 120 - h, 9, h, { color: C.cases, r: 1, alpha: c4.a }); }
        const vp = []; for (let i = 0; i <= 36; i++) vp.push([190 + i * 5.8, y + 170 - 22 * Math.abs(Math.sin(i / 8 + .5))]); D.line(vp, { color: C.vl, width: 3, alpha: c4.a });
        D.text('cases', 50, y + 112, { size: 26, color: C.cases, weight: 600, alpha: c4.a }); D.text('viral load', 50, y + 170, { size: 26, color: C.vl, weight: 600, alpha: c4.a });
        const u = es(t, 10.6, 11.6);
        D.arrow(406, y + 98, lerp(406, 438, u), lerp(y + 98, y + 112, u), { color: C.cases, width: 3, alpha: c4.a * u });
        D.arrow(406, y + 156, lerp(406, 438, u), lerp(y + 156, y + 140, u), { color: C.vl, width: 3, alpha: c4.a * u });
        D.rect(444, y + 74, 120, 92, { color: C.surface, stroke: C.ink, r: 12, alpha: c4.a * u });
        sub(D, ctx, 'I', 'g,t', 474, y + 128, { size: 38, color: C.ink, alpha: c4.a * u });
        const ak = es(t, 11.4, 12.4);
        let x = 590; x += sub(D, ctx, 'b', 'C', x, y + 100, { size: 32, color: C.cases, alpha: ak }) + 26;
        sub(D, ctx, 'b', 'VL', 590, y + 146, { size: 32, color: C.vl, alpha: ak });
        sub(D, ctx, 'p', 'VL', 680, y + 146, { size: 32, color: C.vl, alpha: ak });
      }
      const as = es(t, 12.8, 13.6);
      if (as > 0) D.text('Judged by rolling 14-day forecasts, scored with CRPS', 400, 878, { size: 28, weight: 650, align: 'center', alpha: as });
    },
  });

  // ======================================================================================
  // S08 — Roadmap (tap a station to jump)
  // ======================================================================================
  const ROUTE = [
    ['Model', 3, [['S09', 'One infectious person, many chances'], ['S10', 'Force of infection and the active set'], ['S11', 'Age groups and the contact matrix'],
      ['S12', 'One number for all: the Perron root'], ['S13', 'From cases to deaths: a moving CFR'], ['S14', 'A Gaussian process prior'], ['S15', 'HSGP: curves from sine waves'],
      ['S16', 'Four ways to share across ages'], ['S17', 'Viral load in the infectious pressure'], ['S18', 'Power, sum or product'], ['S19', 'Effective R: cases vs viral load']]],
    ['Evaluation', 7, [['S20', 'Forecasting, one origin at a time'], ['S21', 'Scoring a whole distribution'], ['S22', 'Inference engine, convergence screen']]],
    ['Results and discussion', 11, [['S23', 'How much age structure do GPs need?'], ['S24', 'Does viral load improve forecasts?'], ['S25', 'Shares, coefficients, effective R'],
      ['S26', 'Wastewater: Ottawa yes, others no'], ['S27', 'São Paulo: five active sets'], ['S28', 'Accurate, but intervals too narrow'], ['S29', 'Exchangeability, and its limits'], ['S30', 'Take-home']]],
  ];
  const STATIONS = [];
  (function layout() { let y = 70; for (const [name, at, st] of ROUTE) { const hy = y; y += 44; st.forEach(([id, lab], k) => { STATIONS.push({ id, lab, y, at: at + .3 + k * (3.4 / st.length), group: name, hy }); y += 31; }); y += 12; } })();
  FB.scene({
    id: 'S08', part: PART, title: 'Roadmap of the flipbook', dur: 15,
    tags: [],
    eq: '',
    beats: [
      { at: 0, cap: 'Part 1, done: the problem and the data.' },
      { at: 3, cap: 'Part 2: the epidemic model, Gaussian processes and the viral-load active set.' },
      { at: 7, cap: 'Part 3: rolling two-week forecasts, scored fairly across many start dates.' },
      { at: 11, cap: 'Part 4: results by place, calibration and limitations. Tap a station to jump to it.' },
    ],
    drawer: `<p>The flipbook follows the paper's outline (main.tex:420-466):</p>
<ul>
<li>Methodology: the general stochastic epidemic with age groups and contact matrices (sec:epi-model); Gaussian processes, prediction and the Hilbert-space approximation (sec:gp); deaths through a time-varying CFR (sec:forecast); the proposed model (sec:proposed-model); three ways of sharing across age groups (sec:age-strat-models); viral kinetics, wastewater and the viral-load active set (sec:include-vl-model) with its effective reproduction number (sec:vl-reff).</li>
<li>Application: five case studies (sec:case-studies); prequential evaluation by rolling 14-day forecasts scored with CRPS, alongside in-sample WAIC (sec:prequential); the inference engine (sec:inference-engine).</li>
<li>Results: comparison design (sec:res2-summary), GP structure (sec:res2-class), what viral load adds (sec:res2-vl), the fitted active-set allocation (sec:res2-vl-mech), calibration (sec:res2-forecast), and the further case studies (Appendix sec:ww-sp-results). Then the Discussion.</li>
<li>Appendices: constant-transmission and non-age-stratified baselines, GP implementation and priors, a Pathfinder evaluation, HSGP checks and per-case-study supporting analysis (main.tex:461-466).</li>
</ul>
<p>Results are from the 12 October 2026 snapshot (results_preq2_main.tex:23).</p>`,
    flags: ['results_preq2_main.tex:4 says 10 October and :23 says 12 October for the snapshot date.', 'Station names are short forms of the scene titles; a station only jumps if that scene is present in this build.'],
    source: 'main.tex:420-466 (Paper Outline)',
    // Tap a station (logical units) to jump to its scene; consumed only on a hit, otherwise the tap toggles play.
    onTap(x, y) { const hit = STATIONS.find(p => Math.abs(p.y - 10 - y) < 15.5 && x > 30); if (!hit) return false; FB.go(hit.id); return true; },
    alt: 'A vertical metro map. A top row of eight ticked stations for the problem and data. Below, a Model line with eleven stations, an Evaluation line with three and a Results and discussion line with eight, each station labelled with its scene number and title.',
    draw(t, ctx, D) {
      const LX = 64;
      // part 1 row
      const a0 = es(t, 0, .8);
      D.text('1 · PROBLEM AND DATA', 40, 40, { size: 26, color: C.ink2, weight: 650, alpha: a0 });
      const DX = 372, DS = 36;
      D.line([[DX, 31], [DX + 7 * DS, 31]], { color: C.ink2, width: 5, alpha: a0 * es(t, .2, 2) });
      for (let k = 0; k < 8; k++) { const a = es(t, .3 + k * .25, .7 + k * .25); if (a <= 0) continue;
        D.dot(DX + k * DS, 31, 13, { color: C.good, alpha: a }); D.text('✓', DX + k * DS, 40, { size: 26, color: C.surface, weight: 700, align: 'center', alpha: a }); }
      D.text('S01–S08', DX + 7 * DS + 26, 40, { size: 26, color: C.muted, alpha: es(t, 2, 2.6) });
      // routes
      let gi = 2;
      for (const [name, at] of ROUTE) {
        const pts = STATIONS.filter(s => s.group === name), a = es(t, at - .4, at + .3);
        if (a <= 0) { gi++; continue; }
        D.text(`${gi} · ${name.toUpperCase()}`, 40, pts[0].hy + 14, { size: 26, color: C.ink2, weight: 650, alpha: a });
        const y0 = pts[0].y - 10, y1 = pts[pts.length - 1].y - 10, u = es(t, at, at + 3.6);
        D.line([[LX, y0], [LX, lerp(y0, y1, u)]], { color: C.ink2, width: 5, alpha: a });
        for (const s of pts) {
          const as = es(t, s.at, s.at + .5); if (as <= 0) continue;
          D.dot(LX, s.y - 10, 9, { color: C.surface, alpha: as }); D.circle(LX, s.y - 10, 9, { color: C.ink, width: 3, alpha: as });
          D.text(s.id.slice(1), LX + 26, s.y, { size: 28, color: C.muted, alpha: as });
          D.text(s.lab, LX + 72, s.y, { size: 28, color: C.ink, alpha: as });
        }
        gi++;
      }
    },
  });
})();
