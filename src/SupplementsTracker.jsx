import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Pill, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

// --- Liste des compléments suivis ---
const SUPPLEMENTS = [
  { id: 'omega3',        name: 'Omega 3' },
  { id: 'creatine',      name: 'Créatine' },
  { id: 'collagene',     name: 'Collagène' },
  { id: 'fibres',        name: 'Fibres (Psyllium)' },
  { id: 'probiotiques',  name: 'Probiotiques' },
  { id: 'magnesium',     name: 'Magnésium' },
  { id: 'multivitamines',name: 'Multivitamines' },
  { id: 'vitd3k2',       name: 'Vitamines D3/K2' },
  { id: 'whey',          name: 'Whey' },
];
const TOTAL = SUPPLEMENTS.length;

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const WEEKDAYS = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

// Clé de date locale "YYYY-MM-DD" (évite le décalage UTC de toISOString)
const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Nombre de compléments pris dans un doc jour
const countTaken = (data) => data ? SUPPLEMENTS.reduce((n, s) => n + (data[s.id] ? 1 : 0), 0) : 0;

// Couleur du rond selon le ratio (rouge/orange partiel → emerald plein)
const dotColor = (ratio) => {
  if (ratio <= 0) return 'transparent';
  const hue = 8 + ratio * 142; // 8 = rouge-orangé, ~150 = emerald
  return `hsl(${hue}, 72%, 46%)`;
};

export default function SupplementsTracker({ user, db, isDemo }) {
  const [docsByDate, setDocsByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [editDay, setEditDay] = useState(null); // clé "YYYY-MM-DD" du jour ouvert en édition

  const todayKey = dateKey(new Date());

  // Chargement de l'historique
  useEffect(() => {
    if (isDemo || !user || !db) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'supplements'));
        const map = {};
        snap.forEach(d => { map[d.id] = d.data(); });
        if (!cancelled) setDocsByDate(map);
      } catch (e) {
        console.error('Fetch supplements error:', e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, db, isDemo]);

  const todayData = docsByDate[todayKey] || {};
  const todayCount = countTaken(todayData);

  const toggle = async (dayKey, suppId) => {
    const prev = docsByDate[dayKey] || {};
    const next = { ...prev, [suppId]: !prev[suppId], date: dayKey };
    setDocsByDate(d => ({ ...d, [dayKey]: next }));
    if (!isDemo && user && db) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'supplements', dayKey), next, { merge: true });
      } catch (e) {
        console.error('Save supplement error:', e);
      }
    }
  };

  // Grille du mois affiché (semaines Lu→Di)
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const goMonth = (delta) => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const isFutureMonth = viewMonth.getFullYear() > new Date().getFullYear() ||
    (viewMonth.getFullYear() === new Date().getFullYear() && viewMonth.getMonth() >= new Date().getMonth());

  // Liste lisible des compléments pris un jour donné
  const takenNames = (data) => SUPPLEMENTS.filter(s => data?.[s.id]).map(s => s.name);

  return (
    <div className="animate-fade-in space-y-6">

      {/* En-tête + saisie du jour */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Pill size={22} className="text-blue-400" /> Compléments alimentaires
          </h2>
          {/* Anneau de progression du jour */}
          <div className="flex items-center gap-2 text-sm">
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#34d399" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(todayCount / TOTAL) * 100} 100`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-200">{todayCount}/{TOTAL}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3 capitalize">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUPPLEMENTS.map(s => {
            const taken = !!todayData[s.id];
            return (
              <button
                key={s.id}
                onClick={() => toggle(todayKey, s.id)}
                disabled={loading}
                className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 text-left active:scale-[0.97] ${
                  taken
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-700/40 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${taken ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>
                  {taken && <Check size={13} strokeWidth={3} className="text-white" />}
                </span>
                <span className="text-sm font-semibold leading-tight">{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => goMonth(-1)} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700"><ChevronLeft size={20} /></button>
          <h3 className="text-base font-bold text-slate-100 capitalize">{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</h3>
          <button onClick={() => goMonth(1)} disabled={isFutureMonth} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight size={20} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map(d => <div key={d} className="text-center text-[11px] font-medium text-slate-500">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const key = dateKey(d);
            const data = docsByDate[key];
            const count = countTaken(data);
            const ratio = count / TOTAL;
            const size = count > 0 ? 26 + ratio * 30 : 0; // % du conteneur
            const isToday = key === todayKey;
            const isFuture = d > new Date();
            const names = takenNames(data);
            return (
              <button
                key={i}
                onClick={() => !isFuture && setEditDay(key)}
                disabled={isFuture}
                className={`group relative aspect-square rounded-lg flex items-center justify-center transition-colors disabled:cursor-default ${
                  isToday ? 'ring-2 ring-blue-400' : 'hover:bg-slate-700/40'
                } ${isFuture ? 'opacity-30' : ''}`}
              >
                <span className="absolute top-0.5 left-1 text-[9px] text-slate-500">{d.getDate()}</span>
                {count > 0 && (
                  <span
                    className="rounded-full transition-all"
                    style={{ width: `${size}%`, height: `${size}%`, backgroundColor: dotColor(ratio) }}
                  />
                )}
                {/* Infobulle (survol desktop) */}
                {count > 0 && (
                  <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 hidden group-hover:block w-40 bg-slate-900 border border-slate-600 rounded-lg p-2 text-left shadow-xl">
                    <p className="text-[11px] font-bold text-slate-200 mb-1">{count}/{TOTAL} pris</p>
                    <ul className="text-[10px] text-slate-400 space-y-0.5">
                      {names.map(n => <li key={n}>• {n}</li>)}
                    </ul>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Légende */}
        <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-slate-500">
          <span>Moins</span>
          {[0.2, 0.5, 0.8, 1].map(r => (
            <span key={r} className="rounded-full" style={{ width: 8 + r * 10, height: 8 + r * 10, backgroundColor: dotColor(r) }} />
          ))}
          <span>Tout pris</span>
        </div>
      </div>

      {/* Modale d'édition d'un jour (tap, fonctionne aussi sur mobile) */}
      {editDay && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditDay(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-100 capitalize">
                {new Date(editDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setEditDay(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {SUPPLEMENTS.map(s => {
                const taken = !!(docsByDate[editDay] || {})[s.id];
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(editDay, s.id)}
                    className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                      taken ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-slate-700/40 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${taken ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>
                      {taken && <Check size={13} strokeWidth={3} className="text-white" />}
                    </span>
                    <span className="text-sm font-semibold">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
