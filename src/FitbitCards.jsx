// =============================================================================
//  FitbitCards.jsx
//  Données Google Health API (bracelet Fitbit Air), lues dans Firestore :
//    users/{uid}/fitbitDaily/{yyyy-MM-dd}
//
//  Expose :
//    - useFitbitData(user, db)        → abonnement temps réel
//    - mergeHealthDaily(coros, fitbit) → fusion "Google prioritaire" + tags source
//    - SourceChip                      → badge Fitbit / Coros
//    - FitbitNewCards                  → cartes propres au Fitbit (Pas, Énergie,
//                                        SpO2, Glycémie), pilotées par le timeFrame
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
  Footprints, Flame, Wind, Droplet,
} from 'lucide-react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DayNavigator } from './CorosCards';

// =============================================================================
//  Hook Firestore
// =============================================================================

export function useFitbitData(user, db) {
  const [daily, setDaily] = useState(null);

  useEffect(() => {
    if (!user || !db) return undefined;
    const ref = collection(db, 'users', user.uid, 'fitbitDaily');
    const unsub = onSnapshot(
      query(ref, orderBy('date', 'desc'), limit(120)),
      (snap) => {
        const map = {};
        snap.forEach((d) => { map[d.id] = d.data(); });
        setDaily(map);
      },
      () => setDaily({}),
    );
    return () => unsub();
  }, [user, db]);

  return daily;
}

// =============================================================================
//  Fusion "Google prioritaire"
//  Pour les métriques en commun (FC repos, VFC, sommeil), Fitbit prime ; Coros
//  sert de repli. Chaque jour porte `_src` = { rhr|hrv|sleep: 'F'|'C' }.
//  Le bloc sommeil est pris EN ENTIER d'une seule source (cohérence stades/durée).
// =============================================================================

export function mergeHealthDaily(coros, fitbit) {
  const c0 = coros || {};
  const f0 = fitbit || {};
  const dates = new Set([...Object.keys(c0), ...Object.keys(f0)]);
  const out = {};

  for (const date of dates) {
    const c = c0[date] || {};
    const f = f0[date] || {};
    const m = { ...c };
    const src = {};

    // FC repos
    if (f.rhrBpm != null) { m.rhrBpm = f.rhrBpm; src.rhr = 'F'; }
    else if (c.rhrBpm != null) src.rhr = 'C';

    // VFC (Fitbit n'a pas d'évaluation → on la neutralise quand Fitbit prime)
    if (f.hrvAvgMs != null) { m.hrvAvgMs = f.hrvAvgMs; m.hrvEvaluation = null; src.hrv = 'F'; }
    else if (c.hrvAvgMs != null) src.hrv = 'C';

    // Sommeil — source unique pour rester cohérent
    if (f.sleepMainMin != null) {
      m.sleepMainMin = f.sleepMainMin;
      m.sleepDeepPct = f.sleepDeepPct;
      m.sleepLightPct = f.sleepLightPct;
      m.sleepRemPct = f.sleepRemPct;
      m.sleepAwakePct = f.sleepAwakePct;
      m.sleepAwakeMin = f.sleepAwakeMin;
      m.sleepAwakeCount = f.sleepAwakeCount;
      m.sleepStart = f.sleepStart;
      m.sleepEnd = f.sleepEnd;
      m.sleepScore = null; // Fitbit n'expose pas de score
      src.sleep = 'F';
    } else if (c.sleepMainMin != null || c.sleepScore != null) {
      src.sleep = 'C';
    }

    // Champs propres au Fitbit (utilisés par le Bilan + les nouvelles cartes)
    if (f.steps != null) m.steps = f.steps;
    if (f.activeKcal != null) m.activeKcal = f.activeKcal;
    if (f.spo2AvgPct != null) { m.spo2AvgPct = f.spo2AvgPct; m.spo2MinPct = f.spo2MinPct; }
    if (f.glucoseAvgMgDl != null) {
      m.glucoseAvgMgDl = f.glucoseAvgMgDl;
      m.glucoseMinMgDl = f.glucoseMinMgDl;
      m.glucoseMaxMgDl = f.glucoseMaxMgDl;
      m.glucoseCount = f.glucoseCount;
    }
    if (f.kcalIntake != null) {
      m.kcalIntake = f.kcalIntake;
      m.carbsG = f.carbsG;
      m.fatG = f.fatG;
      m.proteinG = f.proteinG;
    }

    m._src = src;
    out[date] = m;
  }
  return out;
}

// =============================================================================
//  Badge source
// =============================================================================

export function SourceChip({ src, className = '' }) {
  if (!src) return null;
  const isFitbit = src === 'F';
  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-bold rounded text-white ${className}`}
      style={{ backgroundColor: isFitbit ? '#10b981' : '#8b5cf6' }}
      title={isFitbit ? 'Source : Fitbit Air' : 'Source : Coros'}
    >
      {isFitbit ? 'Fitbit' : 'Coros'}
    </span>
  );
}

// =============================================================================
//  Utils (locaux, compacts — calqués sur CorosCards)
// =============================================================================

const localDateKey = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const addDays = (d, n) => { const o = new Date(d); o.setDate(o.getDate() + n); return o; };
const fmtDateFr = (d, opts) => d.toLocaleDateString('fr-FR', opts);
const fmtYearMonth = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const avg = (arr) => {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};
const getPeriodRange = (timeFrame, anchor) => {
  const a = new Date(anchor); a.setHours(0, 0, 0, 0);
  if (timeFrame === 'day') return { start: addDays(a, -6), end: a };
  if (timeFrame === 'week') {
    const day = (a.getDay() + 6) % 7;
    const start = addDays(a, -day);
    return { start, end: addDays(start, 6) };
  }
  return { start: new Date(a.getFullYear(), a.getMonth(), 1), end: new Date(a.getFullYear(), a.getMonth() + 1, 0) };
};
const daysInRange = (start, end) => {
  const out = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) out.push(localDateKey(d));
  return out;
};
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Agrégation moyenne d'un champ par semaine/mois ISO de l'année (jusqu'à aujourd'hui)
const aggregateByWeek = (daily, anchorDate, field) => {
  const year = anchorDate.getFullYear();
  const today = new Date();
  const currentWeek = today.getFullYear() === year ? getISOWeek(today) : 53;
  const groups = {};
  Object.entries(daily || {}).forEach(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    if (d.getFullYear() !== year || data[field] == null) return;
    const w = getISOWeek(d);
    (groups[w] = groups[w] || []).push(data[field]);
  });
  const out = [];
  for (let w = 1; w <= currentWeek; w++) {
    const vals = groups[w] || [];
    out.push({ label: `S${w}`, value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }
  return out;
};
const aggregateByMonth = (daily, anchorDate, field) => {
  const year = anchorDate.getFullYear();
  const today = new Date();
  const currentMonth = today.getFullYear() === year ? today.getMonth() : 11;
  const groups = Array.from({ length: 12 }, () => []);
  Object.entries(daily || {}).forEach(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    if (d.getFullYear() !== year || data[field] == null) return;
    groups[d.getMonth()].push(data[field]);
  });
  const out = [];
  for (let m = 0; m <= currentMonth; m++) {
    const vals = groups[m];
    out.push({ label: MONTH_LABELS[m], value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }
  return out;
};

// =============================================================================
//  Carte métrique générique (Pas, Énergie, SpO2, Glycémie)
// =============================================================================

// Régression linéaire simple → champ `trend` sur chaque point (ligne pointillée).
function withTrend(series) {
  const pts = series.map((d, i) => ({ i, v: d.value })).filter((p) => p.v != null);
  if (pts.length < 2) return series.map((d) => ({ ...d, trend: null }));
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.i, 0);
  const sy = pts.reduce((a, p) => a + p.v, 0);
  const sxx = pts.reduce((a, p) => a + p.i * p.i, 0);
  const sxy = pts.reduce((a, p) => a + p.i * p.v, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return series.map((d) => ({ ...d, trend: null }));
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return series.map((d, i) => ({ ...d, trend: Math.round((slope * i + intercept) * 10) / 10 }));
}

// Charte BIOZ : jour/sem = aire (courbe) + dégradé + ligne de tendance ; mois = barres.
// Footer "Dernière valeur : X" + pilule de qualification (cf. carte Tour de taille).
function SimpleMetricCard({ fitbitDaily, timeFrame, anchorDate, setAnchorDate, cfg }) {
  const mode = timeFrame;
  const range = useMemo(() => getPeriodRange(mode, anchorDate), [mode, anchorDate]);
  const days = useMemo(() => daysInRange(range.start, range.end), [range]);

  const chartSeries = useMemo(() => {
    let s;
    if (mode === 'day') {
      s = days.map((k) => ({
        label: new Date(k + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        value: fitbitDaily[k]?.[cfg.field] ?? null,
      }));
    } else if (mode === 'week') {
      s = aggregateByWeek(fitbitDaily, anchorDate, cfg.field);
    } else {
      s = aggregateByMonth(fitbitDaily, anchorDate, cfg.field);
    }
    return withTrend(s);
  }, [mode, anchorDate, fitbitDaily, days, cfg.field]);

  // Valeur de tête : dernier jour connu (mode jour) sinon moyenne période
  const periodValues = days.map((k) => fitbitDaily[k]?.[cfg.field]).filter((v) => v != null);
  const lastValue = periodValues[periodValues.length - 1] ?? null;
  const meanValue = avg(periodValues);
  const displayValue = mode === 'day' ? lastValue : meanValue;

  // Jour de référence (mode jour) pour les détails glycémie / SpO2
  const lastKey = [...days].reverse().find((k) => fitbitDaily[k]?.[cfg.field] != null);
  const focusDay = lastKey ? fitbitDaily[lastKey] : null;

  const qualif = cfg.qualify ? cfg.qualify(displayValue) : null;
  const gid = `fitgrad-${cfg.field}`;

  // Répartition macros (carte nutrition) : jour = jour de réf, sem/mois = moyenne.
  const macro = useMemo(() => {
    if (!cfg.macros) return null;
    let vals;
    if (mode === 'day') {
      if (focusDay?.kcalIntake == null) return null;
      vals = { carbs: focusDay.carbsG, fat: focusDay.fatG, protein: focusDay.proteinG };
    } else {
      const ds = days.map((k) => fitbitDaily[k]).filter((d) => d && d.kcalIntake != null);
      if (!ds.length) return null;
      const m = (f) => Math.round(ds.reduce((a, d) => a + (d[f] || 0), 0) / ds.length);
      vals = { carbs: m('carbsG'), fat: m('fatG'), protein: m('proteinG') };
    }
    const cCal = (vals.carbs || 0) * 4;
    const pCal = (vals.protein || 0) * 4;
    const fCal = (vals.fat || 0) * 9;
    const tot = cCal + pCal + fCal || 1;
    return { ...vals, cPct: (cCal / tot) * 100, fPct: (fCal / tot) * 100, pPct: (pCal / tot) * 100 };
  }, [cfg.macros, mode, focusDay, days, fitbitDaily]);

  const navLabel = (() => {
    if (mode === 'day') return fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (mode === 'week') return `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;
    return fmtYearMonth(anchorDate);
  })();

  const footerLabel = mode === 'day' ? 'Dernière valeur' : mode === 'week' ? 'Moyenne semaine' : 'Moyenne mois';
  const tooltipStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-full flex flex-col">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={navLabel}
        icon={cfg.icon}
        title={cfg.title}
        step={mode === 'day' ? 1 : mode === 'week' ? 7 : 30}
      />

      <div className="h-56 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartSeries} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cfg.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={cfg.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} padding={{ left: 10, right: 20 }} interval={mode === 'week' ? 'preserveStartEnd' : 0} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={cfg.domain || ['auto', 'auto']} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#f8fafc' }}
              cursor={{ fill: '#334155', opacity: 0.4 }}
              formatter={(v, name) => [`${cfg.format(v)} ${cfg.unit}`, name === 'Tendance' ? 'Tendance' : cfg.title]}
            />
            {mode === 'month' ? (
              <Bar dataKey="value" fill={cfg.color} radius={[4, 4, 0, 0]} name={cfg.title} />
            ) : (
              <Area type="monotone" dataKey="value" stroke={cfg.color} fill={`url(#${gid})`} strokeWidth={2} dot={false} connectNulls name={cfg.title} />
            )}
            <Line type="monotone" dataKey="trend" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Tendance" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {displayValue != null ? (
        <div className="mt-3 flex items-center justify-between text-xs flex-wrap gap-2">
          <span className="text-slate-400">
            {footerLabel} : <span className="font-bold" style={{ color: cfg.color }}>{cfg.format(displayValue)} {cfg.unit}</span>
            {cfg.field === 'glucoseAvgMgDl' && mode === 'day' && focusDay?.glucoseMinMgDl != null && focusDay.glucoseMinMgDl !== focusDay.glucoseMaxMgDl && (
              <span className="text-slate-500"> (min {focusDay.glucoseMinMgDl} / max {focusDay.glucoseMaxMgDl})</span>
            )}
            {cfg.field === 'spo2AvgPct' && mode === 'day' && focusDay?.spo2MinPct != null && (
              <span className="text-slate-500"> (min {focusDay.spo2MinPct}%)</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <SourceChip src="F" />
            {qualif && (
              <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${qualif.color}22`, color: qualif.color }}>
                {qualif.emoji ? `${qualif.emoji} ` : ''}{qualif.label}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-slate-500 mt-3">Pas de mesure sur cette période</div>
      )}

      {macro && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
            <div style={{ width: `${macro.cPct}%`, background: '#22c55e' }} title={`Glucides ${macro.carbs} g`} />
            <div style={{ width: `${macro.fPct}%`, background: '#f97316' }} title={`Lipides ${macro.fat} g`} />
            <div style={{ width: `${macro.pPct}%`, background: '#a78bfa' }} title={`Protéines ${macro.protein} g`} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-sm font-bold text-green-400">{macro.carbs ?? '—'} g</div><div className="text-[10px] text-slate-500">Glucides</div></div>
            <div><div className="text-sm font-bold text-orange-400">{macro.fat ?? '—'} g</div><div className="text-[10px] text-slate-500">Lipides</div></div>
            <div><div className="text-sm font-bold text-violet-400">{macro.protein ?? '—'} g</div><div className="text-[10px] text-slate-500">Protéines</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
//  Qualifications / formats
// =============================================================================

const fmtInt = (v) => Math.round(v).toLocaleString('fr-FR');
const qualifySteps = (v) => {
  if (v == null) return null;
  if (v >= 10000) return { label: 'Objectif atteint', color: '#10b981', emoji: '⭐' };
  if (v >= 7000) return { label: 'Actif', color: '#22c55e', emoji: '✓' };
  if (v >= 4000) return { label: 'Modéré', color: '#f59e0b', emoji: '○' };
  return { label: 'Faible', color: '#ef4444', emoji: '!' };
};
const qualifySpo2 = (v) => {
  if (v == null) return null;
  if (v >= 95) return { label: 'Normal', color: '#10b981', emoji: '✓' };
  if (v >= 90) return { label: 'Correct', color: '#f59e0b', emoji: '○' };
  return { label: 'Bas', color: '#ef4444', emoji: '!' };
};
// Seuils glycémie à jeun selon l'OMS (mg/dL) : normal < 110, IFG 110–125, diabète ≥ 126.
const qualifyGlucose = (v) => {
  if (v == null) return null;
  if (v < 70) return { label: 'Hypo', color: '#ef4444', emoji: '!' };
  if (v < 110) return { label: 'Normale', color: '#10b981', emoji: '✓' };
  if (v <= 125) return { label: 'Prédiabète', color: '#f59e0b', emoji: '○' };
  return { label: 'Diabète', color: '#ef4444', emoji: '!' };
};

const FITBIT_CARDS = [
  {
    id: 'h_fitbitPas',
    cfg: {
      field: 'steps', title: 'Pas', unit: 'pas', color: '#22c55e', chartType: 'bar',
      icon: <Footprints size={18} className="text-green-400" />, format: fmtInt, qualify: qualifySteps,
    },
  },
  {
    id: 'h_fitbitEnergie',
    cfg: {
      field: 'activeKcal', title: 'Énergie dépensée', unit: 'kcal', color: '#f97316', chartType: 'bar',
      icon: <Flame size={18} className="text-orange-400" />, format: fmtInt,
    },
  },
  {
    id: 'h_fitbitSpo2',
    cfg: {
      field: 'spo2AvgPct', title: 'SpO2 nocturne', unit: '%', color: '#38bdf8', chartType: 'line',
      icon: <Wind size={18} className="text-sky-400" />, format: (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR'),
      qualify: qualifySpo2, domain: ['dataMin - 1', 100],
    },
  },
  {
    id: 'h_fitbitGlycemie',
    cfg: {
      field: 'glucoseAvgMgDl', title: 'Glycémie', unit: 'mg/dL', color: '#e879f9', chartType: 'line',
      icon: <Droplet size={18} className="text-fuchsia-400" />, format: fmtInt, qualify: qualifyGlucose,
    },
  },
];

// =============================================================================
//  Section des nouvelles cartes Fitbit
// =============================================================================

export function FitbitNewCards({ fitbitDaily, timeFrame, anchorDate, setAnchorDate, hiddenCards = [] }) {
  if (!fitbitDaily) return null;
  return (
    <>
      {FITBIT_CARDS.filter((c) => !hiddenCards.includes(c.id)).map((c) => (
        <SimpleMetricCard
          key={c.id}
          fitbitDaily={fitbitDaily}
          timeFrame={timeFrame}
          anchorDate={anchorDate}
          setAnchorDate={setAnchorDate}
          cfg={c.cfg}
        />
      ))}
    </>
  );
}

// Liste des ids de cartes Fitbit (pour l'ordre / le drag dans CorosSection).
export const FITBIT_CARD_IDS = FITBIT_CARDS.map((c) => c.id);

// Rendu d'UNE carte Fitbit par id (utilisé par le groupe réordonnable).
export function FitbitCard({ id, fitbitDaily, timeFrame, anchorDate, setAnchorDate }) {
  const card = FITBIT_CARDS.find((c) => c.id === id);
  if (!card || !fitbitDaily) return null;
  return (
    <SimpleMetricCard
      fitbitDaily={fitbitDaily}
      timeFrame={timeFrame}
      anchorDate={anchorDate}
      setAnchorDate={setAnchorDate}
      cfg={card.cfg}
    />
  );
}
