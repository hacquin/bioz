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
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  Moon, Heart, Info, ChevronLeft, ChevronRight, RefreshCw, AlertCircle,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';

// =============================================================================
//  Hook : abonnement Firestore
// =============================================================================

export function useCorosData(user, db) {
  const [daily, setDaily] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, [user, db]);

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
//  Composant racine : section "Récupération & Sommeil"
// =============================================================================

// CorosSection est rendue À L'INTÉRIEUR de la grille de health cards
// (grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6). Elle émet un Fragment avec :
//   - 1 header en col-span-full (titre de la sous-section)
//   - 1 carte Sommeil (1 colonne du grid parent)
//   - 1 carte VFC nocturne (1 colonne du grid parent)
// Les états loading / error / empty sont aussi col-span-full pour rester lisibles.
export function CorosSection({ user, db, timeFrame, healthLogs, hiddenCards = [] }) {
  const { daily, baseline, loading, error } = useCorosData(user, db);
  const [anchorDate, setAnchorDate] = useState(new Date());

  if (loading) {
    return (
      <div className="col-span-full bg-slate-800 rounded-xl p-6 text-center text-slate-400 flex items-center justify-center gap-2 border border-slate-700">
        <RefreshCw size={16} className="animate-spin" /> Chargement Coros…
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full bg-slate-800 border border-red-900 rounded-xl p-4 text-red-400 flex items-start gap-2">
        <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold">Impossible de charger les données Coros.</div>
          <div className="text-xs text-red-300 mt-1">{String(error.message || error)}</div>
        </div>
      </div>
    );
  }

  if (!daily || Object.keys(daily).length === 0) {
    return (
      <div className="col-span-full bg-slate-800 rounded-xl p-6 text-center text-slate-400 border border-slate-700">
        <Moon size={24} className="mx-auto mb-2 text-slate-500" />
        <div>Aucune donnée Coros pour le moment.</div>
        <div className="text-xs mt-1">Lance `npm run sync` depuis le daemon coros-sync.</div>
      </div>
    );
  }

  return (
    <>
      {!hiddenCards.includes('h_corosBilan') && (
        <BilanSanteCard daily={daily} healthLogs={healthLogs} user={user} />
      )}
      {!hiddenCards.includes('h_corosSommeil') && (
        <SommeilCard
          daily={daily}
          baseline={baseline}
          timeFrame={timeFrame}
          anchorDate={anchorDate}
          setAnchorDate={setAnchorDate}
        />
      )}
      {!hiddenCards.includes('h_corosVfc') && (
        <VfcCard
          daily={daily}
          baseline={baseline}
          timeFrame={timeFrame}
          anchorDate={anchorDate}
          setAnchorDate={setAnchorDate}
        />
      )}
      {!hiddenCards.includes('h_corosFcRepos') && (
        <FcReposCard
          daily={daily}
          timeFrame={timeFrame}
          anchorDate={anchorDate}
          setAnchorDate={setAnchorDate}
        />
      )}
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
    if (mode === 'day') {
      return days.map((dateKey) => ({
        date: dateKey,
        label: new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        rhr: daily[dateKey]?.rhrBpm ?? null,
      }));
    }
    if (mode === 'week') return aggregateRhrByWeekOfYear(daily, anchorDate);
    return aggregateRhrByMonthOfYear(daily, anchorDate);
  }, [mode, anchorDate, daily, days]);

  // Dernière valeur connue dans la période courante (pour le footer)
  const periodValues = days
    .map((dateKey) => daily[dateKey]?.rhrBpm)
    .filter((v) => v != null);
  const lastValue = periodValues[periodValues.length - 1] ?? null;
  const meanValue = avg(periodValues);
  const displayValue = mode === 'day' ? lastValue : (meanValue != null ? Math.round(meanValue) : null);
  const qualif = qualifyRhr(displayValue);

  const navLabel = (() => {
    if (mode === 'day') return fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (mode === 'week') return `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;
    return fmtYearMonth(anchorDate);
  })();

  // Couleur des barres : rose pour rester cohérent avec l'identité "FC" / "tensiomètre"
  const BAR_COLOR = '#ec4899';

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={navLabel}
        icon={<Heart size={18} className="text-pink-400" />}
        title="FC Repos - Coros"
        step={mode === 'day' ? 1 : mode === 'week' ? 7 : 30}
      />

      {/* Stat header */}
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-100 tabular-nums">
            {displayValue != null ? displayValue : '—'}
          </span>
          <span className="text-xs font-semibold text-slate-400">bpm</span>
          {qualif && (
            <span
              className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded text-white"
              style={{ backgroundColor: qualif.color }}
            >
              {qualif.emoji} {qualif.label}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {mode === 'day' ? 'Dernière mesure' : mode === 'week' ? 'Moyenne semaine' : 'Moyenne mois'}
        </div>
      </div>

      {/* Histogramme — hauteur fixe plus généreuse qu'avant */}
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartSeries} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
              interval={mode === 'week' ? 'preserveStartEnd' : 0}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
              domain={['dataMin - 3', 'dataMax + 3']}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              formatter={(v) => [`${v} bpm`, 'FC repos']}
              cursor={{ fill: '#1e293b', opacity: 0.4 }}
            />
            <Bar dataKey="rhr" radius={[3, 3, 0, 0]}>
              {chartSeries.map((p, i) => (
                <Cell key={i} fill={p.rhr == null ? 'transparent' : BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {periodValues.length === 0 && (
        <div className="text-center text-xs text-slate-500 mt-2">Pas de mesure sur cette période</div>
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
  const lastSpo2 = sortedLogs.find((l) => l && l.spo2 != null)?.spo2 ?? null;

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
          <h3 className="font-bold text-slate-100 text-base">Bilan de santé - Coros</h3>
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
        <MiniMetric value={last?.rhrBpm}        unit="bpm"  label="Fréq. card." />
        <MiniMetric value={last?.hrvAvgMs}      unit="ms"   label="VFC" />
        <MiniMetric
          value={last?.stressAvg}
          unit=""
          label="Stress"
          badge={last?.stressLevel ? { text: stressLabelFr(last.stressLevel), color: stressColor(last.stressLevel) } : null}
        />
        <MiniMetric value={lastRespiratoryRate} unit="brpm" label="Fréquence respiratoire" />
        <MiniMetric value={lastSpo2}            unit="%"    label="SpO2" />
      </div>
    </div>
  );
}

function MiniMetric({ value, unit, label, badge }) {
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
  const fallback = day ? null : Object.keys(daily).filter((k) => daily[k]?.sleepScore != null).sort().reverse()[0];
  const focusKey = day ? dateKey : fallback;
  const focus = focusKey ? daily[focusKey] : null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={focusKey ? fmtDateFr(new Date(focusKey + 'T00:00:00'), { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
        icon={<Moon size={18} className="text-blue-400" />}
        title="Sommeil - Coros"
      />

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
  const sleepingDays = weekData.filter((d) => d && d.sleepScore != null);
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
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={labelRange}
        icon={<Moon size={18} className="text-blue-400" />}
        title="Sommeil - Coros"
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
  // Idem mode semaine : on ne compte que les nuits avec un Sleep Score valide.
  const sleepingDays = monthData.filter((d) => d.sleepScore != null);

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
        title="Sommeil - Coros"
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
          const bg = score != null ? scoreColor(score) : '#1e293b';
          const opacity = score != null ? Math.max(0.35, score / 100) : 0.25;
          const dayNum = new Date(d.date + 'T00:00:00').getDate();
          return (
            <div
              key={i}
              className="aspect-square rounded flex items-center justify-center text-[10px] font-medium"
              style={{ background: bg, opacity }}
              title={`${d.date} — Score ${score ?? '—'}, Durée ${fmtMin(d.sleepMainMin)}`}
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
  const baselineVal = baseline?.hrvBaselineMs ?? null;

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

  const phraseByZone = {
    normal: 'La VFC se situe dans la fourchette normale. Continue comme prévu.',
    below_normal: 'VFC sous la fourchette normale — prends du repos.',
    above_normal: 'VFC au-dessus de la fourchette — excellente récup.',
  };

  const navLabel = (() => {
    if (mode === 'day') return fmtDateFr(anchorDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (mode === 'week') return `${fmtDateFr(range.start, { day: 'numeric', month: 'short' })} – ${fmtDateFr(range.end, { day: 'numeric', month: 'short' })}`;
    return fmtYearMonth(anchorDate);
  })();

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <DayNavigator
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        label={navLabel}
        icon={<Heart size={18} className="text-rose-400" />}
        title="VFC nocturne - Coros"
        step={mode === 'day' ? 1 : mode === 'week' ? 7 : 30}
      />

      {/* Header gauge */}
      <div className="grid grid-cols-3 gap-3 mt-4 items-start">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Plage</div>
          <div className="text-base font-bold" style={{ color: evalColor(zoneLabel) }}>
            {zoneLabel ? evalLabelFr(zoneLabel) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{labelByMode[mode]}</div>
          <div className="text-base font-bold text-slate-100">
            {focusValue != null ? `${Math.round(focusValue)} ms` : '—'}
          </div>
          <HrvGauge value={focusValue} min={rangeMin} max={rangeMax} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Plage normale</div>
          <div className="text-base font-bold text-slate-100">
            {rangeMin != null && rangeMax != null ? `${rangeMin}-${rangeMax} ms` : '—'}
          </div>
        </div>
      </div>

      {zoneLabel && (
        <p className="mt-3 text-sm text-slate-300">{phraseByZone[zoneLabel]}</p>
      )}

      {/* Graphe — hauteur fixe plus généreuse qu'avant */}
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartSeries} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            {rangeMin != null && rangeMax != null && (
              <ReferenceArea y1={rangeMin} y2={rangeMax} fill="#1e293b" fillOpacity={0.6} />
            )}
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
              interval={mode === 'week' ? 'preserveStartEnd' : mode === 'month' ? 0 : 0}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
              domain={['dataMin - 4', 'dataMax + 4']}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              formatter={(v) => [`${v} ms`, 'VFC']}
            />
            <Line
              type="monotone"
              dataKey="hrv"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={{ r: 3, fill: '#22d3ee' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {baselineVal != null && (
        <div className="mt-2 text-[11px] text-slate-500 text-center">
          Zone grise = fourchette normale · Baseline {baselineVal} ms
        </div>
      )}
    </div>
  );
}

// Gauge mini : barre orange-vert-orange + curseur sur la position de `value`
function HrvGauge({ value, min, max }) {
  if (value == null || min == null || max == null) return null;
  const padding = (max - min) * 0.5;
  const total = max - min + 2 * padding;
  const pct = Math.max(0, Math.min(1, (value - (min - padding)) / total));

  return (
    <div className="mt-1 relative h-2">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(to right,
            ${COLORS.hrvBelow} 0%,
            ${COLORS.hrvBelow} ${(padding / total) * 100}%,
            ${COLORS.hrvNormal} ${(padding / total) * 100}%,
            ${COLORS.hrvNormal} ${((padding + (max - min)) / total) * 100}%,
            ${COLORS.hrvBelow} ${((padding + (max - min)) / total) * 100}%,
            ${COLORS.hrvBelow} 100%)`,
        }}
      />
      <div
        className="absolute -top-1 w-0 h-0"
        style={{
          left: `calc(${pct * 100}% - 4px)`,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '5px solid #f8fafc',
        }}
      />
    </div>
  );
}

// =============================================================================
//  Petits composants UI partagés
// =============================================================================

function DayNavigator({ anchorDate, setAnchorDate, label, icon, title, step = 1 }) {
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

function MonthNavigator({ anchorDate, setAnchorDate, icon, title }) {
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

function StatCell({ label, value, hint, valueColor }) {
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
