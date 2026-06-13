// =============================================================================
//  CorosCards.jsx
//  Cartes Sommeil + VFC nocturne (3 modes : Jour / Sem. / Mois)
//  Lit Firestore : users/{uid}/corosDaily + users/{uid}/corosBaseline/snapshot
//  Pilotée par le `timeFrame` global de HealthTracker.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  Moon, Heart, Info, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Scale,
  Target, Footprints, Flame, Utensils, Dumbbell, TrendingDown,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, ComposedChart, Area,
} from 'recharts';
import {
  useFitbitData, mergeHealthDaily, SourceChip, FitbitCard, FITBIT_CARD_IDS,
} from './FitbitCards';

// =============================================================================
//  Hook : abonnement Firestore
// =============================================================================

export function useCorosData(user, db, demo) {
  const [daily, setDaily] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (demo) {
      setDaily(demo.corosDaily || {});
      setBaseline(demo.corosBaseline || null);
      setLoading(false);
      return undefined;
    }
    if (!user || !db) { setLoading(false); return undefined; }

    const dailyRef = collection(db, 'users', user.uid, 'corosDaily');
    const unsubDaily = onSnapshot(
      query(dailyRef, orderBy('date', 'desc'), limit(90)),
      (snap) => {
        const map = {};
        snap.forEach((d) => { map[d.id] = d.data(); });
        setDaily(map);
        setLoading(false);
      },
      (e) => { setError(e); setLoading(false); },
    );

    const baselineRef = doc(db, 'users', user.uid, 'corosBaseline', 'snapshot');
    const unsubBase = onSnapshot(
      baselineRef,
      (s) => { if (s.exists()) setBaseline(s.data()); },
      (e) => setError(e),
    );

    return () => { unsubDaily(); unsubBase(); };
  }, [user, db, demo]);

  return { daily, baseline, loading, error };
}

// =============================================================================
//  Utils
// =============================================================================

const localDateKey = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d, n) => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
};

// Fraction du jour écoulée (0 à minuit → 1 en fin de journée), heure locale.
// Sert à proratiser le BMR pour coller à la dépense « accumulée » de Google Health.
const dayElapsedFraction = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.min(1, Math.max(0, (now - start) / 86400000));
};

const fmtMin = (min) => {
  if (min == null || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

const fmtHHMM = (s) => s || '—';

const parseHHMMtoMin = (s) => {
  if (!s) return null;
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const fmtDateFr = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  d.toLocaleDateString('fr-FR', opts);

const fmtYearMonth = (d) =>
  d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const fmtPaceSec = (sec) => {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
};

// Plage de dates selon le timeFrame
const getPeriodRange = (timeFrame, anchor) => {
  const a = new Date(anchor);
  a.setHours(0, 0, 0, 0);
  if (timeFrame === 'day') {
    // 7 derniers jours dont le jour ancré
    return { start: addDays(a, -6), end: a, focus: a };
  }
  if (timeFrame === 'week') {
    // semaine ISO commençant lundi
    const day = (a.getDay() + 6) % 7; // 0=lundi
    const start = addDays(a, -day);
    const end = addDays(start, 6);
    return { start, end, focus: a };
  }
  // month
  const start = new Date(a.getFullYear(), a.getMonth(), 1);
  const end = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  return { start, end, focus: a };
};

const daysInRange = (start, end) => {
  const out = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) out.push(localDateKey(d));
  return out;
};

// Régression linéaire → ajoute un champ trendKey sur chaque point (ligne pointillée).
const addTrend = (series, valueKey, trendKey) => {
  const pts = series.map((d, i) => ({ i, v: d[valueKey] })).filter((p) => p.v != null);
  if (pts.length < 2) return series.map((d) => ({ ...d, [trendKey]: null }));
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.i, 0);
  const sy = pts.reduce((a, p) => a + p.v, 0);
  const sxx = pts.reduce((a, p) => a + p.i * p.i, 0);
  const sxy = pts.reduce((a, p) => a + p.i * p.v, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return series.map((d) => ({ ...d, [trendKey]: null }));
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return series.map((d, i) => ({ ...d, [trendKey]: Math.round((slope * i + intercept) * 10) / 10 }));
};

// Moyennes (ignorant null)
const avg = (arr) => {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
};

const avgTimeHHMM = (arr) => {
  // Moyenne d'heures HH:MM, en tenant compte du wrap minuit pour les couchers tardifs.
  // Pour le coucher, on shift les valeurs < 12h de +24h pour éviter d'écraser
  // (ex: 23h et 01h doivent moyenner à 00h, pas à 12h).
  const mins = arr.map(parseHHMMtoMin).filter((m) => m != null);
  if (mins.length === 0) return null;
  const isLateNight = mins.every((m) => m < 12 * 60 || m > 18 * 60);
  const shifted = isLateNight ? mins.map((m) => (m < 12 * 60 ? m + 24 * 60 : m)) : mins;
  const m = shifted.reduce((a, b) => a + b, 0) / shifted.length;
  const norm = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(norm / 60);
  const mm = Math.round(norm % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const isWeekend = (dateKey) => {
  const d = new Date(dateKey + 'T00:00:00');
  const w = d.getDay();
  return w === 0 || w === 6;
};

// Semaine ISO (lundi = 1er jour)
const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Agrégation HRV : 1 point par semaine ISO de l'année jusqu'à la semaine courante
const aggregateHrvByWeekOfYear = (daily, anchorDate) => {
  const year = anchorDate.getFullYear();
  const today = new Date();
  const currentWeek = today.getFullYear() === year ? getISOWeek(today) : 52;
  const groups = {};
  Object.entries(daily || {}).forEach(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    if (d.getFullYear() !== year) return;
    if (data.hrvAvgMs == null) return;
    const w = getISOWeek(d);
    if (!groups[w]) groups[w] = [];
    groups[w].push(data.hrvAvgMs);
  });
  const out = [];
  for (let w = 1; w <= currentWeek; w++) {
    const vals = groups[w] || [];
    const hrv = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    out.push({ label: `S${w}`, hrv });
  }
  return out;
};

// Agrégation FC repos : 1 point par semaine ISO de l'année
const aggregateRhrByWeekOfYear = (daily, anchorDate) => {
  const year = anchorDate.getFullYear();
  const today = new Date();
  const currentWeek = today.getFullYear() === year ? getISOWeek(today) : 52;
  const groups = {};
  Object.entries(daily || {}).forEach(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    if (d.getFullYear() !== year) return;
    if (data.rhrBpm == null) return;
    const w = getISOWeek(d);
    if (!groups[w]) groups[w] = [];
    groups[w].push(data.rhrBpm);
  });
  const out = [];
  for (let w = 1; w <= currentWeek; w++) {
    const vals = groups[w] || [];
    const rhr = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    out.push({ label: `S${w}`, rhr });
  }
  return out;
};

// Agrégation FC repos : 1 point par mois
const aggregateRhrByMonthOfYear = (daily, anchorDate) => {
  const year = anchorDate.getFullYear();
  const today = new Date();
  const currentMonth = today.getFullYear() === year ? today.getMonth() : 11;
  const groups = Array.from({ length: 12 }, () => []);
  Object.entries(daily || {}).forEach(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    if (d.getFullYear() !== year) return;
    if (data.rhrBpm == null) return;
    groups[d.getMonth()].push(data.rhrBpm);
  });
  const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const out = [];
  for (let m = 0; m <= currentMonth; m++) {
    const vals = groups[m];
    const rhr = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    out.push({ label: labels[m], rhr });
  }
  return out;
};

// Agrégation HRV : 1 point par mois de l'année jusqu'au mois courant
const aggregateHrvByMonthOfYear = (daily, anchorDate) => {
  const year = anchorDate.getFullYear();
  const today = new Date();
  const currentMonth = today.getFullYear() === year ? today.getMonth() : 11;
  const groups = Array.from({ length: 12 }, () => []);
  Object.entries(daily || {}).forEach(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    if (d.getFullYear() !== year) return;
    if (data.hrvAvgMs == null) return;
    groups[d.getMonth()].push(data.hrvAvgMs);
  });
  const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const out = [];
  for (let m = 0; m <= currentMonth; m++) {
    const vals = groups[m];
    const hrv = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    out.push({ label: labels[m], hrv });
  }
  return out;
};

// Couleurs sommeil
const COLORS = {
  deep: '#1e3a8a',
  light: '#3b82f6',
  rem: '#60a5fa',
  awake: '#94a3b8',
  scoreHigh: '#10b981',
  scoreMid: '#f59e0b',
  scoreLow: '#ef4444',
  hrvNormal: '#10b981',
  hrvBelow: '#f59e0b',
  hrvAbove: '#3b82f6',
};

const scoreColor = (s) => {
  if (s == null) return '#475569';
  if (s >= 80) return COLORS.scoreHigh;
  if (s >= 50) return COLORS.scoreMid;
  return COLORS.scoreLow;
};

// Couleur de repli quand il n'y a pas de score (nuits Fitbit) : basée sur la durée.
const durationColor = (min) => {
  if (min == null) return '#475569';
  if (min >= 450) return COLORS.scoreHigh; // ≥ 7h30
  if (min >= 390) return COLORS.scoreMid;  // ≥ 6h30
  return COLORS.scoreLow;
};

const evalLabelFr = (ev) => ({ normal: 'Normal', below_normal: 'Basse', above_normal: 'Élevée' }[ev] || '—');
const evalColor = (ev) => ({ normal: COLORS.hrvNormal, below_normal: COLORS.hrvBelow, above_normal: COLORS.hrvAbove }[ev] || '#64748b');

const stressLabelFr = (s) => ({ relaxed: 'Calme', low: 'Faible', medium: 'Modéré', high: 'Élevé' }[s] || '—');
const stressColor = (s) => ({
  relaxed: '#3b82f6', low: '#10b981', medium: '#f59e0b', high: '#ef4444',
}[s] || '#64748b');

// Qualification FC repos (bpm)
const qualifyRhr = (bpm) => {
  if (bpm == null) return null;
  if (bpm < 50)  return { label: 'Excellent',   color: '#10b981', emoji: '⭐' };
  if (bpm < 60)  return { label: 'Athlétique',  color: '#22c55e', emoji: '✓' };
  if (bpm < 70)  return { label: 'Bonne',       color: '#22d3ee', emoji: '✓' };
  if (bpm < 80)  return { label: 'Moyenne',     color: '#f59e0b', emoji: '○' };
  return { label: 'Élevée', color: '#ef4444', emoji: '!' };
};

// =============================================================================
//  Carte Balance énergétique — absorbé (nutrition) vs dépensé (BMR + actif)
// =============================================================================

// Intake "Cronometer" (collection nutrition) par date — prioritaire sur le
// kcalIntake Google Health déjà présent dans `daily`. Fetch borné à la plage.
function useIntakeData(user, db, days, demoIntake) {
  const [intake, setIntake] = useState({});
  const daysKey = days.join('|');
  useEffect(() => {
    if (demoIntake) {
      const map = {};
      for (const k of days) { if (demoIntake[k] != null) map[k] = demoIntake[k]; }
      setIntake(map);
      return;
    }
    if (!user || !db || days.length === 0) { setIntake({}); return; }
    let cancelled = false;
    (async () => {
      const map = {};
      for (const key of days) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'nutrition', key));
          if (snap.exists() && snap.data().calories != null) map[key] = snap.data().calories;
        } catch { /* ignore */ }
      }
      if (!cancelled) setIntake(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, daysKey, demoIntake]);
  return intake;
}

// Fléau de balance en SVG : penche du côté le plus "lourd".
// diff = dépensé − absorbé : >0 → déficit (le plateau Dépensé descend).
function BalanceScale({ inKcal, outKcal }) {
  const diff = (outKcal || 0) - (inKcal || 0);
  const MAX_DEG = 15;
  const angle = Math.max(-MAX_DEG, Math.min(MAX_DEG, (diff / 800) * MAX_DEG));
  const rad = (angle * Math.PI) / 180;
  const cx = 150, cy = 58, L = 110, S = 18, baseY = 170;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lx = cx - L * cos, ly = cy - L * sin;   // gauche : Absorbé
  const rx = cx + L * cos, ry = cy + L * sin;   // droite : Dépensé
  const IN_COLOR = '#34d399', OUT_COLOR = '#fb923c';
  const pan = (x, y, color, value, label) => (
    <g key={label}>
      <line x1={x} y1={y} x2={x} y2={y + S} stroke="#64748b" strokeWidth={1.5} />
      <path d={`M ${x - 32} ${y + S} Q ${x} ${y + S + 24} ${x + 32} ${y + S}`}
        fill={`${color}22`} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <text x={x} y={y + S + 44} textAnchor="middle" fill={color} fontSize={16} fontWeight="700">{value}</text>
      <text x={x} y={y + S + 58} textAnchor="middle" fill="#94a3b8" fontSize={9}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 300 200" className="w-full" style={{ maxHeight: 200 }} role="img" aria-label="Balance énergétique">
      <line x1={122} y1={baseY} x2={178} y2={baseY} stroke="#475569" strokeWidth={3} strokeLinecap="round" />
      <path d={`M 138 ${baseY} L ${cx} ${cy} L 162 ${baseY} Z`} fill="#334155" />
      <line x1={lx} y1={ly} x2={rx} y2={ry} stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#94a3b8" />
      {pan(lx, ly, IN_COLOR, inKcal != null ? Math.round(inKcal) : '—', 'ABSORBÉ')}
      {pan(rx, ry, OUT_COLOR, outKcal != null ? Math.round(outKcal) : '—', 'DÉPENSÉ')}
    </svg>
  );
}

function BalanceCard({ daily, healthLogs, user, db, timeFrame, anchorDate, setAnchorDate, demoIntake }) {
  const mode = timeFrame;
  const range = useMemo(() => getPeriodRange(mode, anchorDate), [mode, anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);
  const cronoIntake = useIntakeData(user, db, days, demoIntake);

  // BMR : dernière valeur connue (balance Withings), ~constante sur la période.
  const bmr = useMemo(() => {
    const logs = (healthLogs || []).filter((l) => l.bmr != null);
    if (!logs.length) return null;
    logs.sort((a, b) => (a.date < b.date ? 1 : -1));
    return logs[0].bmr;
  }, [healthLogs]);

  // Par jour : intake (Cronometer prioritaire, sinon Google Health) + dépense (BMR + actif).
  // AUJOURD'HUI : BMR proraté au temps écoulé pour coller à la dépense « Énergie
  // dépensée » de Google Health (total base+actif accumulé en temps réel). Les jours
  // passés gardent le BMR plein (journée complète).
  const todayKey = localDateKey(new Date());
  const elapsed = dayElapsedFraction();
  const perDay = useMemo(() => days.map((k) => {
    const intake = cronoIntake[k] ?? daily[k]?.kcalIntake ?? null;
    const active = daily[k]?.activeKcal ?? null;
    const bmrPart = bmr == null ? null : (k === todayKey ? bmr * elapsed : bmr);
    const expend = bmrPart == null ? null : bmrPart + (active || 0);
    return { date: k, intake, expend, bmrPart };
  }), [days, cronoIntake, daily, bmr, todayKey, elapsed]);

  let inKcal, outKcal, bmrShown;
  if (mode === 'day') {
    const d = perDay.find((p) => p.date === localDateKey(anchorDate));
    inKcal = d?.intake ?? null;
    outKcal = d?.expend ?? null;
    bmrShown = d?.bmrPart ?? null;
  } else {
    inKcal = avg(perDay.map((p) => p.intake));
    outKcal = avg(perDay.filter((p) => p.intake != null).map((p) => p.expend));
    bmrShown = avg(perDay.filter((p) => p.intake != null).map((p) => p.bmrPart));
  }

  const net = (inKcal != null && outKcal != null) ? inKcal - outKcal : null; // >0 surplus
  let status = null;
  if (net != null) {
    if (net <= -150) status = { txt: `Déficit ${Math.round(-net)} kcal`, color: '#34d399' };
    else if (net >= 150) status = { txt: `Surplus ${Math.round(net)} kcal`, color: '#fb923c' };
    else status = { txt: 'Équilibre', color: '#94a3b8' };
  }

  const navLabel = (() => {
    if (mode === 'day') return fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (mode === 'week') return `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;
    return fmtYearMonth(anchorDate);
  })();
  const footerLabel = mode === 'day' ? 'Bilan du jour' : mode === 'week' ? 'Moy./jour (semaine)' : 'Moy./jour (mois)';

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={navLabel}
        icon={<Scale size={18} className="text-emerald-400" />}
        title="Balance énergétique"
        step={mode === 'day' ? 1 : mode === 'week' ? 7 : 30}
      />

      {bmr == null ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 mt-4 px-2">
          BMR manquant — ajoute une mesure de composition (balance Withings) pour calculer la dépense totale.
        </div>
      ) : inKcal == null ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 mt-4 px-2">
          Pas de données nutrition sur cette période.
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center mt-1">
            <BalanceScale inKcal={inKcal} outKcal={outKcal} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="text-slate-400">
              {footerLabel} · dépense {Math.round(bmrShown || 0)} base + {Math.round((outKcal || 0) - (bmrShown || 0))} actif
            </span>
            {status && (
              <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}22`, color: status.color }}>
                {status.txt}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
//  Cartes OBJECTIFS — anneaux concentriques (style WHOOP)
//  Une carte quotidienne + une carte hebdomadaire. Chaque objectif = un anneau.
// =============================================================================

// Palette à fort contraste, sûre pour le daltonisme (rouge-vert) :
// séparation par luminance (jaune clair → bleu foncé) ET par teinte chaud/froid.
// Ordre = de l'anneau extérieur vers l'intérieur.
const RING_COLORS = ['#EF4444', '#F97316', '#3B82F6', '#EC4899'];

// Anneaux concentriques : 1 anneau par métrique, rempli au prorata de l'objectif.
function GoalRings({ metrics, size = 200, centerTop, centerBottom }) {
  const cx = size / 2, cy = size / 2;
  const sw = 10, gap = 9;
  const outerR = size / 2 - sw / 2 - 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: 250 }} role="img" aria-label="Progression des objectifs" shapeRendering="geometricPrecision">
      {metrics.map((m, i) => {
        const r = outerR - i * (sw + gap);
        const c = 2 * Math.PI * r;
        const pct = Math.max(0, Math.min(1, m.pct ?? 0));
        return (
          <g key={i} transform={`rotate(-90 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0f172a" strokeWidth={sw} />
            <circle
              cx={cx} cy={cy} r={r} fill="none" stroke={m.color} strokeWidth={sw}
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </g>
        );
      })}
      <text x={cx} y={cy - 1} textAnchor="middle" fill="#f1f5f9" fontSize={17} fontWeight="800">{centerTop}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize={7} fontWeight="700" letterSpacing="1.2">{centerBottom}</text>
    </svg>
  );
}

// Carte générique : navigateur + anneaux + légende 2×2 (valeur / objectif / %).
function GoalRingCard({ navProps, metrics }) {
  const reached = metrics.filter((m) => (m.pct ?? 0) >= 1).length;
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator {...navProps} />
      <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 mt-3">
        <div className="flex flex-col gap-2 w-full md:w-64 flex-shrink-0">
          {metrics.map((m, i) => {
            const pct = m.pct ?? 0;
            const done = pct >= 1;
            return (
              <div key={i} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide truncate leading-tight">{m.label}</div>
                  <div className="text-sm font-bold text-slate-100 leading-tight">
                    {m.valueText}
                    <span className="text-[10px] text-slate-500 font-normal"> / {m.goalText}</span>
                  </div>
                </div>
                <span className="ml-auto text-xs font-extrabold flex-shrink-0" style={{ color: done ? '#34d399' : m.color }}>
                  {m.pctText}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex-1 flex items-center justify-center md:justify-end min-w-0">
          <GoalRings metrics={metrics} centerTop={`${reached}/${metrics.length}`} centerBottom="OBJECTIFS" />
        </div>
      </div>
    </div>
  );
}

const fmtInt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('fr-FR'));
const pctStr = (v, g) => (v == null ? '—' : `${Math.round((v / g) * 100)}%`);

// Dernière valeur BMR connue (balance Withings) — ~constante sur la période.
function useLastBmr(healthLogs) {
  return useMemo(() => {
    const logs = (healthLogs || []).filter((l) => l.bmr != null);
    if (!logs.length) return null;
    logs.sort((a, b) => (a.date < b.date ? 1 : -1));
    return logs[0].bmr;
  }, [healthLogs]);
}

// --- Objectifs QUOTIDIENS : pas 8000 · dépense 3000 · apport 2300 · sommeil 7h ---
const DAILY_GOALS = { steps: 8000, expend: 3000, intake: 2300, sleep: 420 };

function DailyGoalsCard({ daily, healthLogs, user, db, anchorDate, setAnchorDate, demoIntake }) {
  const key = localDateKey(anchorDate);
  const todayKey = localDateKey(new Date());
  const isToday = key === todayKey;
  const cronoIntake = useIntakeData(user, db, [key], demoIntake);
  const bmr = useLastBmr(healthLogs);

  const d = daily[key] || {};
  const steps = d.steps ?? null;
  const active = d.activeKcal ?? null;
  const bmrPart = bmr == null ? null : (isToday ? bmr * dayElapsedFraction() : bmr);
  const expend = bmrPart == null ? null : bmrPart + (active || 0);
  const intake = cronoIntake[key] ?? d.kcalIntake ?? null;
  const sleep = d.sleepMainMin ?? null;
  const G = DAILY_GOALS;

  const metrics = [
    { label: 'Pas', color: RING_COLORS[0], pct: steps == null ? 0 : steps / G.steps,
      valueText: fmtInt(steps), goalText: fmtInt(G.steps), pctText: pctStr(steps, G.steps) },
    { label: 'Dépense', color: RING_COLORS[1], pct: expend == null ? 0 : expend / G.expend,
      valueText: expend == null ? '—' : `${fmtInt(expend)} kcal`, goalText: `${fmtInt(G.expend)} kcal`, pctText: pctStr(expend, G.expend) },
    { label: 'Apport', color: RING_COLORS[2], pct: intake == null ? 0 : intake / G.intake,
      valueText: intake == null ? '—' : `${fmtInt(intake)} kcal`, goalText: `${fmtInt(G.intake)} kcal`, pctText: pctStr(intake, G.intake) },
    { label: 'Sommeil', color: RING_COLORS[3], pct: sleep == null ? 0 : sleep / G.sleep,
      valueText: fmtMin(sleep), goalText: '7h', pctText: pctStr(sleep, G.sleep) },
  ];

  return (
    <GoalRingCard
      navProps={{
        anchorDate, setAnchorDate, step: 1,
        icon: <Target size={18} className="text-emerald-400" />,
        title: 'Objectifs du jour',
        label: fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' }),
      }}
      metrics={metrics}
    />
  );
}

// --- Objectifs HEBDOMADAIRES : sport 300 mn · 60 000 pas · -500 g · déficit 4900 kcal ---
const WEEKLY_GOALS = { training: 300, steps: 60000, loss: 500, deficit: 4900 };
const MUSCU_TYPES = ['WeightTraining', 'Workout', 'Crossfit', 'HIIT', 'Hiit'];

function WeeklyGoalsCard({ daily, healthLogs, stravaLogs, hevyWorkouts, user, db, anchorDate, setAnchorDate, demoIntake }) {
  const range = useMemo(() => getPeriodRange('week', anchorDate), [anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);
  const cronoIntake = useIntakeData(user, db, days, demoIntake);
  const bmr = useLastBmr(healthLogs);
  const todayKey = localDateKey(new Date());

  // Borne fin de semaine inclusive (fin de journée).
  const endBoundary = useMemo(() => new Date(range.end.getTime() + 86399999), [range]);
  const inWk = (ds) => { if (!ds) return false; const t = new Date(ds); return t >= range.start && t <= endBoundary; };

  // Pas cumulés sur la semaine.
  const stepsWeek = days.reduce((t, k) => t + (daily[k]?.steps || 0), 0);

  // Minutes d'entraînement : cardio Strava + séances Hevy (durée) + muscu Strava hors jours Hevy (anti-doublon).
  const trainingMin = useMemo(() => {
    const sWk = (stravaLogs || []).filter((a) => inWk(a.start_date));
    const hWk = (hevyWorkouts || []).filter((w) => inWk(w.start_time));
    const hevyDays = new Set(hWk.map((w) => localDateKey(w.start_time)));
    const cardioMin = sWk.filter((a) => !MUSCU_TYPES.includes(a.type)).reduce((t, a) => t + (a.moving_time || 0) / 60, 0);
    const hevyMin = hWk.reduce((t, w) => t + (w.start_time && w.end_time ? Math.max(0, (new Date(w.end_time) - new Date(w.start_time)) / 60000) : 0), 0);
    const stravaMuscuMin = sWk.filter((a) => MUSCU_TYPES.includes(a.type) && !hevyDays.has(localDateKey(a.start_date)))
      .reduce((t, a) => t + (a.moving_time || 0) / 60, 0);
    return Math.round(cardioMin + hevyMin + stravaMuscuMin);
  }, [stravaLogs, hevyWorkouts, range, endBoundary]);

  // Perte de poids : poids d'entrée de semaine (dernier connu avant, sinon 1er de la semaine) vs dernier de la semaine.
  const lossG = useMemo(() => {
    const ws = (healthLogs || []).filter((l) => l.weight != null)
      .map((l) => ({ d: new Date(l.date), w: l.weight })).sort((a, b) => a.d - b.d);
    if (!ws.length) return null;
    const before = [...ws].reverse().find((x) => x.d < range.start);
    const inWeek = ws.filter((x) => x.d >= range.start && x.d <= endBoundary);
    const startW = before?.w ?? inWeek[0]?.w ?? null;
    const endW = inWeek.length ? inWeek[inWeek.length - 1].w : null;
    return (startW != null && endW != null) ? Math.round((startW - endW) * 1000) : null;
  }, [healthLogs, range, endBoundary]);

  // Déficit calorique cumulé : Σ(dépense) − Σ(apport) sur les jours renseignés.
  const deficit = useMemo(() => {
    let sumExpend = 0, sumIntake = 0, has = false;
    days.forEach((k) => {
      const intake = cronoIntake[k] ?? daily[k]?.kcalIntake ?? null;
      const active = daily[k]?.activeKcal ?? null;
      const bmrPart = bmr == null ? null : (k === todayKey ? bmr * dayElapsedFraction() : bmr);
      const expend = bmrPart == null ? null : bmrPart + (active || 0);
      if (intake != null && expend != null) { sumExpend += expend; sumIntake += intake; has = true; }
    });
    return has ? Math.round(sumExpend - sumIntake) : null;
  }, [days, cronoIntake, daily, bmr, todayKey]);

  const G = WEEKLY_GOALS;
  const lossText = lossG == null ? '—' : (lossG >= 0 ? `${fmtInt(lossG)} g` : `+${fmtInt(-lossG)} g`);

  const metrics = [
    { label: 'Entraînement', color: RING_COLORS[0], pct: trainingMin / G.training,
      valueText: `${fmtInt(trainingMin)} min`, goalText: `${G.training} min`, pctText: pctStr(trainingMin, G.training) },
    { label: 'Pas', color: RING_COLORS[1], pct: stepsWeek / G.steps,
      valueText: fmtInt(stepsWeek), goalText: fmtInt(G.steps), pctText: pctStr(stepsWeek, G.steps) },
    { label: 'Perte de poids', color: RING_COLORS[2], pct: lossG == null ? 0 : lossG / G.loss,
      valueText: lossText, goalText: `-${G.loss} g`, pctText: lossG == null ? '—' : `${Math.round((lossG / G.loss) * 100)}%` },
    { label: 'Déficit', color: RING_COLORS[3], pct: deficit == null ? 0 : deficit / G.deficit,
      valueText: deficit == null ? '—' : `${fmtInt(deficit)} kcal`, goalText: `${fmtInt(G.deficit)} kcal`, pctText: pctStr(deficit, G.deficit) },
  ];

  return (
    <GoalRingCard
      navProps={{
        anchorDate, setAnchorDate, step: 7,
        icon: <Target size={18} className="text-violet-400" />,
        title: 'Objectifs de la semaine',
        label: `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`,
      }}
      metrics={metrics}
    />
  );
}

// =============================================================================
//  Composant racine : section "Récupération & Sommeil"
// =============================================================================

// CorosSection est rendue À L'INTÉRIEUR de la grille de health cards
// (grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6). Elle émet un Fragment avec :
//   - 1 header en col-span-full (titre de la sous-section)
//   - 1 carte Sommeil (1 colonne du grid parent)
//   - 1 carte VFC nocturne (1 colonne du grid parent)
// Les états loading / error / empty sont aussi col-span-full pour rester lisibles.
// Ordre par défaut du groupe "wearables" (Coros + Fitbit), réordonnable par drag.
const WEARABLE_DEFAULT_ORDER = [
  'h_goalsDaily', 'h_goalsWeekly', 'h_corosBilan', 'h_corosSommeil', 'h_corosVfc', 'h_corosFcRepos', 'h_energyBalance', ...FITBIT_CARD_IDS,
];
const WEARABLE_ORDER_KEY = 'bioz_wearableCardOrder';

export function CorosSection({ user, db, timeFrame, healthLogs, stravaLogs = [], hevyWorkouts = [], hiddenCards = [], demo = null }) {
  const { daily: corosDaily, baseline, loading, error } = useCorosData(user, db, demo);
  const fitbitDaily = useFitbitData(user, db, demo ? demo.fitbitDaily : undefined);
  const [anchorDate, setAnchorDate] = useState(new Date());

  // Fusion "Google prioritaire" : Fitbit prime, Coros en repli (cf. mergeHealthDaily).
  const daily = useMemo(() => mergeHealthDaily(corosDaily, fitbitDaily), [corosDaily, fitbitDaily]);

  // Ordre réordonnable (persisté), fusionné avec le défaut pour intégrer de nouveaux ids.
  const [order, setOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WEARABLE_ORDER_KEY) || 'null');
      if (Array.isArray(saved)) {
        const missing = WEARABLE_DEFAULT_ORDER.filter((id) => !saved.includes(id));
        return [...saved.filter((id) => WEARABLE_DEFAULT_ORDER.includes(id)), ...missing];
      }
    } catch { /* ignore */ }
    return WEARABLE_DEFAULT_ORDER;
  });
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragId) setDropId(id);
  };
  const onDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && targetId && sourceId !== targetId) {
      setOrder((prev) => {
        const next = [...prev];
        const fromIdx = next.indexOf(sourceId);
        const toIdx = next.indexOf(targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, sourceId);
        }
        localStorage.setItem(WEARABLE_ORDER_KEY, JSON.stringify(next));
        return next;
      });
    }
    setDragId(null);
    setDropId(null);
  };
  const onDragEnd = () => { setDragId(null); setDropId(null); };

  if (loading && !fitbitDaily) {
    return (
      <div className="col-span-full bg-slate-800 rounded-xl p-6 text-center text-slate-400 flex items-center justify-center gap-2 border border-slate-700">
        <RefreshCw size={16} className="animate-spin" /> Chargement des données santé…
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full bg-slate-800 border border-red-900 rounded-xl p-4 text-red-400 flex items-start gap-2">
        <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold">Impossible de charger les données santé.</div>
          <div className="text-xs text-red-300 mt-1">{String(error.message || error)}</div>
        </div>
      </div>
    );
  }

  if (!daily || Object.keys(daily).length === 0) {
    return (
      <div className="col-span-full bg-slate-800 rounded-xl p-6 text-center text-slate-400 border border-slate-700">
        <Moon size={24} className="mx-auto mb-2 text-slate-500" />
        <div>Aucune donnée santé (Fitbit / Coros) pour le moment.</div>
      </div>
    );
  }

  const sLogs = demo ? (demo.stravaLogs || []) : (stravaLogs || []);
  const hLogs = demo ? (demo.hevyWorkouts || []) : (hevyWorkouts || []);

  const content = {
    h_goalsDaily: <DailyGoalsCard daily={daily} healthLogs={healthLogs} user={user} db={db} anchorDate={anchorDate} setAnchorDate={setAnchorDate} demoIntake={demo ? demo.intake : undefined} />,
    h_goalsWeekly: <WeeklyGoalsCard daily={daily} healthLogs={healthLogs} stravaLogs={sLogs} hevyWorkouts={hLogs} user={user} db={db} anchorDate={anchorDate} setAnchorDate={setAnchorDate} demoIntake={demo ? demo.intake : undefined} />,
    h_corosBilan: <BilanSanteCard daily={daily} healthLogs={healthLogs} user={user} />,
    h_corosSommeil: <SommeilCard daily={daily} baseline={baseline} timeFrame={timeFrame} anchorDate={anchorDate} setAnchorDate={setAnchorDate} />,
    h_corosVfc: <VfcCard daily={daily} baseline={baseline} timeFrame={timeFrame} anchorDate={anchorDate} setAnchorDate={setAnchorDate} />,
    h_corosFcRepos: <FcReposCard daily={daily} timeFrame={timeFrame} anchorDate={anchorDate} setAnchorDate={setAnchorDate} />,
    h_energyBalance: <BalanceCard daily={daily} healthLogs={healthLogs} user={user} db={db} timeFrame={timeFrame} anchorDate={anchorDate} setAnchorDate={setAnchorDate} demoIntake={demo ? demo.intake : undefined} />,
  };
  for (const id of FITBIT_CARD_IDS) {
    content[id] = <FitbitCard id={id} fitbitDaily={fitbitDaily} timeFrame={timeFrame} anchorDate={anchorDate} setAnchorDate={setAnchorDate} />;
  }

  return (
    <>
      {order.filter((id) => !hiddenCards.includes(id)).map((id) => {
        const el = content[id];
        if (!el) return null;
        const isDragging = dragId === id;
        const isDropTarget = dropId === id && dragId !== id;
        const wide = id === 'h_corosBilan' ? 'col-span-full' : '';
        return (
          <div
            key={id}
            className={`${wide} rounded-xl transition-all duration-150 ${isDragging ? 'opacity-40 scale-95' : isDropTarget ? 'ring-2 ring-violet-400/50' : ''}`}
            draggable={!isMobile}
            onDragStart={(e) => onDragStart(e, id)}
            onDragOver={(e) => onDragOver(e, id)}
            onDrop={(e) => onDrop(e, id)}
            onDragEnd={onDragEnd}
            onDragLeave={() => { if (dropId === id) setDropId(null); }}
            style={!isMobile ? { cursor: isDragging ? 'grabbing' : 'grab' } : {}}
          >
            {el}
          </div>
        );
      })}
    </>
  );
}

// =============================================================================
//  Carte FC REPOS — histogramme par jour / semaine ISO / mois
// =============================================================================

function FcReposCard({ daily, timeFrame, anchorDate, setAnchorDate }) {
  const mode = timeFrame;
  const range = useMemo(() => getPeriodRange(mode, anchorDate), [mode, anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);

  // Série pour le graphe selon le mode
  const chartSeries = useMemo(() => {
    let s;
    if (mode === 'day') {
      s = days.map((dateKey) => ({
        date: dateKey,
        label: new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        rhr: daily[dateKey]?.rhrBpm ?? null,
      }));
    } else if (mode === 'week') {
      s = aggregateRhrByWeekOfYear(daily, anchorDate);
    } else {
      s = aggregateRhrByMonthOfYear(daily, anchorDate);
    }
    return addTrend(s, 'rhr', 'rhrTrend');
  }, [mode, anchorDate, daily, days]);

  // Dernière valeur connue dans la période courante (pour le footer)
  const periodValues = days
    .map((dateKey) => daily[dateKey]?.rhrBpm)
    .filter((v) => v != null);
  const lastValue = periodValues[periodValues.length - 1] ?? null;
  const meanValue = avg(periodValues);
  const displayValue = mode === 'day' ? lastValue : (meanValue != null ? Math.round(meanValue) : null);
  const qualif = qualifyRhr(displayValue);

  // Source de la valeur affichée (mode jour uniquement — sem/mois sont mixtes)
  const srcKey = mode === 'day' ? [...days].reverse().find((k) => daily[k]?.rhrBpm != null) : null;
  const valueSrc = srcKey ? daily[srcKey]?._src?.rhr : null;

  const navLabel = (() => {
    if (mode === 'day') return fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (mode === 'week') return `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;
    return fmtYearMonth(anchorDate);
  })();

  // Couleur des barres : rose pour rester cohérent avec l'identité "FC" / "tensiomètre"
  const BAR_COLOR = '#ec4899';

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={navLabel}
        icon={<Heart size={18} className="text-pink-400" />}
        title="FC Repos"
        step={mode === 'day' ? 1 : mode === 'week' ? 7 : 30}
      />

      {/* Charte : aire+tendance en jour/sem, barres en mois */}
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartSeries} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="rhrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BAR_COLOR} stopOpacity={0.3} />
                <stop offset="100%" stopColor={BAR_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={mode === 'week' ? 'preserveStartEnd' : 0} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['dataMin - 3', 'dataMax + 3']} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              formatter={(v, name) => [`${v} bpm`, name === 'Tendance' ? 'Tendance' : 'FC repos']}
              cursor={{ fill: '#334155', opacity: 0.4 }}
            />
            {mode === 'month' ? (
              <Bar dataKey="rhr" fill={BAR_COLOR} radius={[4, 4, 0, 0]} name="FC repos" />
            ) : (
              <Area type="monotone" dataKey="rhr" stroke={BAR_COLOR} fill="url(#rhrGrad)" strokeWidth={2} dot={false} connectNulls name="FC repos" />
            )}
            <Line type="monotone" dataKey="rhrTrend" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Tendance" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {displayValue != null ? (
        <div className="mt-3 flex items-center justify-between text-xs flex-wrap gap-2">
          <span className="text-slate-400">
            {mode === 'day' ? 'Dernière valeur' : mode === 'week' ? 'Moyenne semaine' : 'Moyenne mois'} : <span className="font-bold" style={{ color: BAR_COLOR }}>{displayValue} bpm</span>
          </span>
          <div className="flex items-center gap-1.5">
            <SourceChip src={valueSrc} />
            {qualif && (
              <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${qualif.color}22`, color: qualif.color }}>
                {qualif.emoji} {qualif.label}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-slate-500 mt-3">Pas de mesure sur cette période</div>
      )}
    </div>
  );
}

// =============================================================================
//  Carte BILAN DE SANTÉ — mini-stats en col-span-full, en haut
// =============================================================================

// URL absolue vers l'endpoint trigger sur le VPS (fonctionne aussi depuis le dev server).
const COROS_TRIGGER_URL = 'https://bioz.app/coros-trigger.php';

function BilanSanteCard({ daily, healthLogs, user }) {
  // FC repos / VFC / Stress viennent de Coros (daily).
  // Fréquence respiratoire + SpO2 sont des SAISIES MANUELLES dans healthLogs.
  const corosCandidates = Object.keys(daily || {})
    .filter((k) => daily[k]?.rhrBpm != null || daily[k]?.hrvAvgMs != null || daily[k]?.stressAvg != null)
    .sort()
    .reverse();
  const lastKey = corosCandidates[0];
  const last = lastKey ? daily[lastKey] : null;

  // Dernière saisie manuelle (parmi healthLogs triés desc) qui contient resp ou SpO2
  const sortedLogs = Array.isArray(healthLogs)
    ? [...healthLogs].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];
  const lastRespiratoryRate = sortedLogs.find((l) => l && l.respiratoryRate != null)?.respiratoryRate ?? null;
  const lastManualSpo2 = sortedLogs.find((l) => l && l.spo2 != null)?.spo2 ?? null;

  // SpO2 : Fitbit prioritaire (nuit), repli sur la saisie manuelle.
  const spo2Key = Object.keys(daily || {}).filter((k) => daily[k]?.spo2AvgPct != null).sort().reverse()[0];
  const lastFitbitSpo2 = spo2Key ? Math.round(daily[spo2Key].spo2AvgPct) : null;
  const lastSpo2 = lastFitbitSpo2 ?? lastManualSpo2;
  const spo2Src = lastFitbitSpo2 != null ? 'F' : null;

  // Date affichée : la plus récente des 2 sources
  const lastManualDate = sortedLogs.find((l) => l && (l.respiratoryRate != null || l.spo2 != null))?.date ?? null;
  const refDate = [lastKey, lastManualDate ? localDateKey(new Date(lastManualDate)) : null]
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const dateLabel = refDate
    ? fmtDateFr(new Date(refDate + 'T00:00:00'), { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';

  // Sync manuel via PHP gateway sur le VPS
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null); // { ok, text }
  const handleSync = async () => {
    if (!user || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(COROS_TRIGGER_URL, {
        method: 'POST',
        headers: { 'X-Bioz-Uid': user.uid },
      });
      const data = await res.json();
      setSyncMsg({
        ok: !!data.ok,
        text: data.ok
          ? `✓ ${data.summary || 'Sync OK'} · ${data.duration_sec}s`
          : (data.error || 'Erreur sync'),
      });
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Erreur réseau' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 8000);
    }
  };

  return (
    <div className="col-span-full bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">🩺</span>
          <h3 className="font-bold text-slate-100 text-base">Bilan de santé</h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {syncMsg && (
            <span className={`text-xs ${syncMsg.ok ? 'text-green-400' : 'text-red-400'} max-w-[280px] truncate`} title={syncMsg.text}>
              {syncMsg.text}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || !user}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin text-violet-400' : ''} />
            {syncing ? 'Sync...' : 'Sync Coros'}
          </button>
          <span className="text-xs text-slate-400 capitalize">{dateLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
        <MiniMetric value={last?.rhrBpm}        unit="bpm"  label="Fréq. card." src={last?._src?.rhr} />
        <MiniMetric value={last?.hrvAvgMs}      unit="ms"   label="VFC" src={last?._src?.hrv} />
        <MiniMetric
          value={last?.stressAvg}
          unit=""
          label="Stress"
          badge={last?.stressLevel ? { text: stressLabelFr(last.stressLevel), color: stressColor(last.stressLevel) } : null}
        />
        <MiniMetric value={lastRespiratoryRate} unit="brpm" label="Fréquence respiratoire" />
        <MiniMetric value={lastSpo2}            unit="%"    label="SpO2" src={spo2Src} />
      </div>
    </div>
  );
}

function MiniMetric({ value, unit, label, badge, src }) {
  const hasValue = value != null;
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums" style={{ color: hasValue ? '#f8fafc' : '#475569' }}>
          {hasValue ? value : '—'}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-400 lowercase">{unit}</span>
        )}
        {hasValue && src && <SourceChip src={src} />}
        {badge && (
          <span
            className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded text-white"
            style={{ backgroundColor: badge.color }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

// =============================================================================
//  Carte SOMMEIL — dispatcher par mode
// =============================================================================

function SommeilCard(props) {
  const { timeFrame } = props;
  if (timeFrame === 'week') return <SommeilSemaine {...props} />;
  if (timeFrame === 'month') return <SommeilMois {...props} />;
  return <SommeilJour {...props} />;
}

// -- Mode Jour ---------------------------------------------------------------

function SommeilJour({ daily, baseline, anchorDate, setAnchorDate }) {
  // On affiche le jour ancré. Si pas de data, on cherche le jour le plus récent avec data.
  const dateKey = localDateKey(anchorDate);
  const day = daily[dateKey];
  const fallback = day ? null : Object.keys(daily).filter((k) => daily[k]?.sleepMainMin != null).sort().reverse()[0];
  const focusKey = day ? dateKey : fallback;
  const focus = focusKey ? daily[focusKey] : null;
  const focusSrc = focusKey ? daily[focusKey]?._src?.sleep : null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={focusKey ? fmtDateFr(new Date(focusKey + 'T00:00:00'), { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
        icon={<Moon size={18} className="text-blue-400" />}
        title="Sommeil"
      />
      {focus && focusSrc && (
        <div className="mt-2 flex justify-end"><SourceChip src={focusSrc} /></div>
      )}

      {!focus ? (
        <EmptyState text="Pas de nuit enregistrée. Porte ta montre la nuit pour voir tes métriques." />
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatCell label="Durée" value={fmtMin(focus.sleepMainMin)} />
            <StatCell
              label="Au lit"
              value={
                focus.sleepStart && focus.sleepEnd
                  ? fmtMin(computeBedMinutes(focus.sleepStart, focus.sleepEnd))
                  : '—'
              }
            />
            <StatCell
              label="Score"
              value={focus.sleepScore != null ? `${focus.sleepScore}/100` : '—'}
              valueColor={scoreColor(focus.sleepScore)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatCell
              label="Éveils"
              value={
                focus.sleepAwakeCount != null
                  ? `${focus.sleepAwakeCount} fois`
                  : '—'
              }
              hint={focus.sleepAwakeMin != null ? `${focus.sleepAwakeMin} min total` : null}
            />
            <StatCell
              label="HRV nuit"
              value={focus.hrvAvgMs != null ? `${focus.hrvAvgMs} ms` : '—'}
              hint={focus.hrvEvaluation ? evalLabelFr(focus.hrvEvaluation) : null}
              valueColor={evalColor(focus.hrvEvaluation)}
            />
          </div>

          {/* Composition stacked bar */}
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Composition de la nuit</div>
            <CompositionBar
              deep={focus.sleepDeepPct}
              light={focus.sleepLightPct}
              rem={focus.sleepRemPct}
              awake={focus.sleepAwakePct}
            />
            <div className="mt-3 space-y-1 text-sm">
              <CompositionRow color={COLORS.deep} label="Profond" pct={focus.sleepDeepPct} totalMin={focus.sleepMainMin} />
              <CompositionRow color={COLORS.light} label="Léger" pct={focus.sleepLightPct} totalMin={focus.sleepMainMin} />
              <CompositionRow color={COLORS.rem} label="Paradoxal" pct={focus.sleepRemPct} totalMin={focus.sleepMainMin} />
              <CompositionRow color={COLORS.awake} label="Éveillé" pct={focus.sleepAwakePct} totalMin={focus.sleepMainMin} />
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-700 flex justify-between text-sm text-slate-400">
            <span>🛌 Coucher {fmtHHMM(focus.sleepStart)}</span>
            <span>☀️ Lever {fmtHHMM(focus.sleepEnd)}</span>
          </div>

          {focus.napsTotalMin > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              + sieste {fmtMin(focus.napsTotalMin)}
              {focus.napStart && focus.napEnd && ` (${focus.napStart} – ${focus.napEnd})`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const computeBedMinutes = (start, end) => {
  const s = parseHHMMtoMin(start);
  const e = parseHHMMtoMin(end);
  if (s == null || e == null) return null;
  return e >= s ? e - s : 24 * 60 - s + e;
};

// -- Mode Semaine ------------------------------------------------------------

function SommeilSemaine({ daily, anchorDate, setAnchorDate }) {
  const range = useMemo(() => getPeriodRange('week', anchorDate), [anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);

  const weekData = days.map((k) => daily[k] ? { ...daily[k], date: k } : null);
  // Une "vraie nuit" = Coros a calculé un score valide (les siestes courtes ont score -1
  // que le parser transforme en null, donc on filtre les sleepScore != null).
  const sleepingDays = weekData.filter((d) => d && d.sleepMainMin != null);
  const weekdayDays = sleepingDays.filter((d) => !isWeekend(d.date));
  const weekendDays = sleepingDays.filter((d) =>  isWeekend(d.date));

  const avgs = (arr) => ({
    coucher: avgTimeHHMM(arr.map((d) => d.sleepStart)),
    lever: avgTimeHHMM(arr.map((d) => d.sleepEnd)),
    duree: avg(arr.map((d) => d.sleepMainMin)),
  });

  const weekAvg = avgs(weekdayDays);
  const weAvg = avgs(weekendDays);

  const scoreAvg = avg(sleepingDays.map((d) => d.sleepScore));
  const hrvAvg = avg(sleepingDays.map((d) => d.hrvAvgMs));
  const rhrAvg = avg(weekData.filter(Boolean).map((d) => d.rhrBpm));

  const labelRange = `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={labelRange}
        icon={<Moon size={18} className="text-blue-400" />}
        title="Sommeil"
        step={7}
      />

      {sleepingDays.length === 0 ? (
        <EmptyState text="Aucune nuit enregistrée sur cette semaine." />
      ) : (
        <>
          <WeekCalendar days={days} weekData={weekData} />

          <SubsectionTitle>Moyenne semaine</SubsectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatCell label="Coucher" value={weekAvg.coucher || '—'} />
            <StatCell label="Lever" value={weekAvg.lever || '—'} />
            <StatCell label="Durée" value={weekAvg.duree != null ? fmtMin(Math.round(weekAvg.duree)) : '—'} />
          </div>

          <SubsectionTitle>Moyenne week-end</SubsectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatCell label="Coucher" value={weAvg.coucher || '—'} />
            <StatCell label="Lever" value={weAvg.lever || '—'} />
            <StatCell label="Durée" value={weAvg.duree != null ? fmtMin(Math.round(weAvg.duree)) : '—'} />
          </div>

          <SubsectionTitle>Indicateurs santé moyens</SubsectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatCell label="Score" value={scoreAvg != null ? `${Math.round(scoreAvg)}/100` : '—'} valueColor={scoreColor(scoreAvg)} />
            <StatCell label="HRV nuit" value={hrvAvg != null ? `${Math.round(hrvAvg)} ms` : '—'} />
            <StatCell label="FC repos" value={rhrAvg != null ? `${Math.round(rhrAvg)} bpm` : '—'} />
          </div>
        </>
      )}
    </div>
  );
}

// Calendrier hebdo : 7 lignes × 24h, barres = sessions de sommeil
function WeekCalendar({ days, weekData }) {
  const dayLabels = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  const hours = [0, 6, 12, 18, 24];

  return (
    <div className="mt-2 mb-4 bg-slate-900/40 rounded-lg p-3 border border-slate-700">
      {days.map((dateKey, i) => {
        const data = weekData[i];
        const segments = computeSleepSegments(dateKey, data, weekData, days, i);
        return (
          <div key={dateKey} className="flex items-center h-6">
            <div className="w-6 text-[10px] text-slate-500 font-medium">{dayLabels[i]}</div>
            <div className="flex-1 relative h-4 bg-slate-800 rounded">
              {segments.map((seg, k) => (
                <div
                  key={k}
                  className="absolute h-full rounded"
                  style={{
                    left: `${(seg.startMin / (24 * 60)) * 100}%`,
                    width: `${((seg.endMin - seg.startMin) / (24 * 60)) * 100}%`,
                    background: seg.kind === 'nap' ? COLORS.rem : COLORS.light,
                    opacity: seg.kind === 'nap' ? 0.6 : 1,
                  }}
                  title={seg.title}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex justify-between mt-1 pl-6 text-[10px] text-slate-500">
        {hours.map((h) => <span key={h}>{String(h).padStart(2, '0')}h</span>)}
      </div>
    </div>
  );
}

// Calcule les segments d'une journée (peut inclure portion de la nuit précédente)
function computeSleepSegments(dateKey, dayData, weekData, days, idx) {
  const segs = [];

  // Nuit principale qui se TERMINE ce jour (positionnée sur ligne du LEVER)
  if (dayData?.sleepStart && dayData?.sleepEnd) {
    const s = parseHHMMtoMin(dayData.sleepStart);
    const e = parseHHMMtoMin(dayData.sleepEnd);
    if (s != null && e != null) {
      if (e >= s) {
        // Coucher et lever même jour (cas rare, sieste-like long)
        segs.push({ startMin: s, endMin: e, kind: 'main', title: `${dayData.sleepStart}–${dayData.sleepEnd}` });
      } else {
        // Wrap minuit : segment matin sur ce jour
        segs.push({ startMin: 0, endMin: e, kind: 'main', title: `00:00–${dayData.sleepEnd}` });
        // Segment soir sur la ligne du JOUR PRÉCÉDENT
        // (on injectera ce segment lors du rendu du jour précédent — voir ci-dessous)
      }
    }
  }

  // Si jour SUIVANT a un Main sleep wrap, on ajoute son segment "soir" ici
  const nextData = weekData[idx + 1];
  if (nextData?.sleepStart && nextData?.sleepEnd) {
    const ns = parseHHMMtoMin(nextData.sleepStart);
    const ne = parseHHMMtoMin(nextData.sleepEnd);
    if (ns != null && ne != null && ne < ns) {
      segs.push({ startMin: ns, endMin: 24 * 60, kind: 'main', title: `${nextData.sleepStart}–24:00 (→ ${days[idx + 1]})` });
    }
  }

  // Sieste du jour
  if (dayData?.napStart && dayData?.napEnd) {
    const s = parseHHMMtoMin(dayData.napStart);
    const e = parseHHMMtoMin(dayData.napEnd);
    if (s != null && e != null && e > s) {
      segs.push({ startMin: s, endMin: e, kind: 'nap', title: `Sieste ${dayData.napStart}–${dayData.napEnd}` });
    }
  }

  return segs;
}

// -- Mode Mois ---------------------------------------------------------------

function SommeilMois({ daily, anchorDate, setAnchorDate }) {
  const range = useMemo(() => getPeriodRange('month', anchorDate), [anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);

  const monthData = days.map((k) => ({ date: k, ...(daily[k] || {}) }));
  // Idem mode semaine : on compte les nuits avec une durée de sommeil (Fitbit
  // n'expose pas de score, donc on ne peut pas filtrer dessus).
  const sleepingDays = monthData.filter((d) => d.sleepMainMin != null);

  const avgDur = avg(sleepingDays.map((d) => d.sleepMainMin));
  const avgScore = avg(sleepingDays.map((d) => d.sleepScore));
  const avgCoucher = avgTimeHHMM(sleepingDays.map((d) => d.sleepStart));
  const avgLever = avgTimeHHMM(sleepingDays.map((d) => d.sleepEnd));

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <MonthNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        icon={<Moon size={18} className="text-blue-400" />}
        title="Sommeil"
      />

      <MonthHeatmap days={monthData} startDate={range.start} />

      <SubsectionTitle>Moyennes du mois</SubsectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <StatCell label="Durée" value={avgDur != null ? fmtMin(Math.round(avgDur)) : '—'} />
        <StatCell label="Score" value={avgScore != null ? `${Math.round(avgScore)}/100` : '—'} valueColor={scoreColor(avgScore)} />
        <StatCell label="Coucher" value={avgCoucher || '—'} />
        <StatCell label="Lever" value={avgLever || '—'} />
      </div>
      <div className="mt-3 text-xs text-slate-500 text-center">
        {sleepingDays.length} / {days.length} nuits enregistrées
      </div>
    </div>
  );
}

function MonthHeatmap({ days, startDate }) {
  // Construit une grille 7 colonnes (lu→di), nb lignes variable.
  // On préfixe d'éventuelles cases vides pour aligner le 1er du mois sur son jour de semaine.
  const firstDayOfMonth = new Date(startDate);
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7; // 0=lundi
  const cells = [...Array(firstWeekday).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mt-2 mb-4">
      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500 text-center mb-1">
        {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((l) => <div key={l}>{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const score = d.sleepScore;
          // Coros : couleur = score. Fitbit (pas de score) : couleur = durée.
          let bg = '#1e293b';
          let opacity = 0.25;
          if (score != null) {
            bg = scoreColor(score);
            opacity = Math.max(0.35, score / 100);
          } else if (d.sleepMainMin != null) {
            bg = durationColor(d.sleepMainMin);
            opacity = Math.max(0.35, Math.min(1, d.sleepMainMin / 480));
          }
          const dayNum = new Date(d.date + 'T00:00:00').getDate();
          return (
            <div
              key={i}
              className="aspect-square rounded flex items-center justify-center text-[10px] font-medium"
              style={{ background: bg, opacity }}
              title={`${d.date} — ${score != null ? `Score ${score}` : 'Durée'} ${fmtMin(d.sleepMainMin)}`}
            >
              <span className="text-white/90">{dayNum}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-500">
        <LegendDot color="#1e293b" label="—" />
        <LegendDot color={COLORS.scoreLow} label="< 50" />
        <LegendDot color={COLORS.scoreMid} label="50-80" />
        <LegendDot color={COLORS.scoreHigh} label="80-100" />
      </div>
    </div>
  );
}

// =============================================================================
//  Carte VFC — dispatcher
// =============================================================================

function VfcCard(props) {
  const { timeFrame } = props;
  if (timeFrame === 'week') return <VfcView {...props} mode="week" />;
  if (timeFrame === 'month') return <VfcView {...props} mode="month" />;
  return <VfcView {...props} mode="day" />;
}

function VfcView({ daily, baseline, anchorDate, setAnchorDate, mode }) {
  const range = useMemo(() => getPeriodRange(mode, anchorDate), [mode, anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);

  // Pour les stats du HEADER (gauge + moyenne période) : valeurs DANS la période courante
  const periodValues = days
    .map((dateKey) => daily[dateKey]?.hrvAvgMs)
    .filter((v) => v != null);
  const lastValue = periodValues[periodValues.length - 1] ?? null;
  const meanValue = avg(periodValues);
  const focusValue = mode === 'day' ? lastValue : meanValue;

  // Source de la valeur affichée (mode jour uniquement)
  const srcKey = mode === 'day' ? [...days].reverse().find((k) => daily[k]?.hrvAvgMs != null) : null;
  const valueSrc = srcKey ? daily[srcKey]?._src?.hrv : null;

  // Pour le GRAPHE :
  //   - Mode Jour : 7 derniers jours (résolution journalière)
  //   - Mode Sem  : agrégation hebdomadaire depuis le 1er janvier de l'année
  //   - Mode Mois : agrégation mensuelle depuis le 1er janvier de l'année
  const chartSeries = useMemo(() => {
    if (mode === 'day') {
      return days.map((dateKey) => ({
        date: dateKey,
        label: new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        hrv: daily[dateKey]?.hrvAvgMs ?? null,
      }));
    }
    if (mode === 'week') return aggregateHrvByWeekOfYear(daily, anchorDate);
    return aggregateHrvByMonthOfYear(daily, anchorDate);
  }, [mode, anchorDate, daily, days]);
  const rangeMin = baseline?.hrvRangeMinMs ?? null;
  const rangeMax = baseline?.hrvRangeMaxMs ?? null;

  const zoneLabel = (() => {
    if (focusValue == null || rangeMin == null || rangeMax == null) return null;
    if (focusValue < rangeMin) return 'below_normal';
    if (focusValue > rangeMax) return 'above_normal';
    return 'normal';
  })();

  const labelByMode = {
    day: 'Moy. der. nuit',
    week: 'Moyenne semaine',
    month: 'Moyenne mois',
  };

  const navLabel = (() => {
    if (mode === 'day') return fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (mode === 'week') return `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;
    return fmtYearMonth(anchorDate);
  })();

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={navLabel}
        icon={<Heart size={18} className="text-rose-400" />}
        title="VFC nocturne"
        step={mode === 'day' ? 1 : mode === 'week' ? 7 : 30}
      />

      {/* Charte : aire en jour/sem, barres en mois — avec la zone normale en fond */}
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartSeries} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            {rangeMin != null && rangeMax != null && (
              <ReferenceArea y1={rangeMin} y2={rangeMax} fill="#1e293b" fillOpacity={0.6} />
            )}
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={mode === 'week' ? 'preserveStartEnd' : 0} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['dataMin - 4', 'dataMax + 4']} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              formatter={(v) => [`${v} ms`, 'VFC']}
              cursor={{ fill: '#334155', opacity: 0.4 }}
            />
            {mode === 'month' ? (
              <Bar dataKey="hrv" fill="#22d3ee" radius={[4, 4, 0, 0]} name="VFC" />
            ) : (
              <Area type="monotone" dataKey="hrv" stroke="#22d3ee" fill="url(#hrvGrad)" strokeWidth={2} dot={{ r: 3, fill: '#22d3ee' }} activeDot={{ r: 5 }} connectNulls name="VFC" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {focusValue != null ? (
        <div className="mt-3 flex items-center justify-between text-xs flex-wrap gap-2">
          <span className="text-slate-400">
            {labelByMode[mode]} : <span className="font-bold" style={{ color: '#22d3ee' }}>{Math.round(focusValue)} ms</span>
          </span>
          <div className="flex items-center gap-1.5">
            <SourceChip src={valueSrc} />
            {zoneLabel && (
              <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${evalColor(zoneLabel)}22`, color: evalColor(zoneLabel) }}>
                {evalLabelFr(zoneLabel)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-slate-500 mt-3">Pas de mesure sur cette période</div>
      )}
    </div>
  );
}

// =============================================================================
//  Petits composants UI partagés
// =============================================================================

export function DayNavigator({ anchorDate, setAnchorDate, label, icon, title, step = 1 }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="font-semibold text-slate-100">{title}</span>
      </div>
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => setAnchorDate(addDays(anchorDate, -step))}
          className="p-1 rounded hover:bg-slate-700 text-slate-400"
          aria-label="Précédent"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-slate-300 px-1 capitalize">{label}</span>
        <button
          onClick={() => setAnchorDate(addDays(anchorDate, step))}
          className="p-1 rounded hover:bg-slate-700 text-slate-400"
          aria-label="Suivant"
          disabled={isAfterToday(addDays(anchorDate, step))}
          style={{ opacity: isAfterToday(addDays(anchorDate, step)) ? 0.3 : 1 }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function MonthNavigator({ anchorDate, setAnchorDate, icon, title }) {
  const prev = () => {
    const d = new Date(anchorDate);
    d.setMonth(d.getMonth() - 1, 1);
    setAnchorDate(d);
  };
  const next = () => {
    const d = new Date(anchorDate);
    d.setMonth(d.getMonth() + 1, 1);
    setAnchorDate(d);
  };
  const isFutureMonth = () => {
    const d = new Date(anchorDate);
    d.setMonth(d.getMonth() + 1, 1);
    return d > new Date();
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-slate-100">{title}</span>
      </div>
      <div className="flex items-center gap-1 text-sm">
        <button onClick={prev} className="p-1 rounded hover:bg-slate-700 text-slate-400"><ChevronLeft size={16} /></button>
        <span className="text-slate-300 px-1 capitalize">{fmtYearMonth(anchorDate)}</span>
        <button
          onClick={next}
          className="p-1 rounded hover:bg-slate-700 text-slate-400"
          disabled={isFutureMonth()}
          style={{ opacity: isFutureMonth() ? 0.3 : 1 }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

const isAfterToday = (d) => {
  // On compare les JOURS (minuit local), pas les timestamps exacts. Sans ça,
  // si anchorDate est hier 15:30 et qu'on additionne 1 jour, on obtient aujourd'hui 15:30
  // qui serait considéré "après" aujourd'hui 00:00 → bouton suivant désactivé à tort.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const candidate = new Date(d); candidate.setHours(0, 0, 0, 0);
  return candidate > today;
};

export function StatCell({ label, value, hint, valueColor }) {
  return (
    <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/50">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: valueColor || '#f8fafc' }}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function CompositionBar({ deep = 0, light = 0, rem = 0, awake = 0 }) {
  const total = (deep || 0) + (light || 0) + (rem || 0) + (awake || 0);
  if (!total) {
    return <div className="h-4 bg-slate-700/40 rounded-full" />;
  }
  return (
    <div className="flex h-4 rounded-full overflow-hidden">
      {deep   ? <div style={{ width: `${(deep   / total) * 100}%`, background: COLORS.deep  }} title={`Profond ${deep}%`} /> : null}
      {light  ? <div style={{ width: `${(light  / total) * 100}%`, background: COLORS.light }} title={`Léger ${light}%`} /> : null}
      {rem    ? <div style={{ width: `${(rem    / total) * 100}%`, background: COLORS.rem   }} title={`Paradoxal ${rem}%`} /> : null}
      {awake  ? <div style={{ width: `${(awake  / total) * 100}%`, background: COLORS.awake }} title={`Éveillé ${awake}%`} /> : null}
    </div>
  );
}

function CompositionRow({ color, label, pct, totalMin }) {
  const min = pct != null && totalMin != null ? Math.round((pct / 100) * totalMin) : null;
  return (
    <div className="flex items-center justify-between text-slate-300">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3 text-slate-400 text-xs">
        <span>{min != null ? fmtMin(min) : '—'}</span>
        <span className="w-8 text-right">{pct != null ? `${pct}%` : '—'}</span>
      </div>
    </div>
  );
}

function SubsectionTitle({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-5 mb-2">{children}</div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-3 h-3 rounded" style={{ background: color, opacity: 0.7 }} />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="mt-6 text-center text-slate-500 py-6 text-sm">
      <Moon size={20} className="mx-auto mb-2 opacity-50" />
      {text}
    </div>
  );
}
