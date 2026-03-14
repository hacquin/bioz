import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Dumbbell, Activity, Calendar, BarChart2, Save, Settings, X, AlertCircle, Filter, Scale, TrendingUp, LogOut, User, Droplet, RefreshCw, Cloud, CloudLightning, Ruler, Target, Footprints, Percent, Heart, HeartPulse, Map as MapIcon, ArrowRight,
  Bike, Mountain, Award, Waves, Flame, ChevronDown, ChevronUp, Clock, Plus, Trash2
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell
} from 'recharts';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, getDoc, initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";

// --- VERSIONING ---
const APP_VERSION = "v2.33.0 (Hevy Full Fix)";
console.log(`[Bodycontrol] Démarrage de l'application ${APP_VERSION}`);

// --- WITHINGS CONFIGURATION ---
const WITHINGS_CONFIG = {
  clientId: "d25aaf4a68b77b1e300f9d419530c0545b0c404c023796a555ae998039270674",
  clientSecret: "4867932a1005a89d19d2f7e57f574a2fb3bd29b3b37a3a5d042f8286bc366cc6",
  redirectUri: "https://fitness.hacquin.net",
  authUrl: "https://account.withings.com/oauth2_user/authorize2",
  tokenUrl: "https://wbsapi.withings.net/v2/oauth2",
  measureUrl: "https://wbsapi.withings.net/measure",
  activityUrl: "https://wbsapi.withings.net/v2/measure",
  scope: "user.metrics,user.activity"
};

// --- STRAVA CONFIGURATION ---
const STRAVA_CONFIG = {
  clientId: "195412", 
  clientSecret: "0912bd918a4d8eeccf1400df06426c21a338c935",
  redirectUri: "https://fitness.hacquin.net",
  authUrl: "https://www.strava.com/oauth/authorize",
  tokenUrl: "https://www.strava.com/oauth/token",
  scope: "activity:read_all,activity:read"
};

// --- HEVY CONFIGURATION ---
// ⚠️ Renseignez votre clé API Hevy : https://hevy.com/settings?developer (compte Pro requis)
const HEVY_CONFIG = {
  apiKey: "48144f81-2e39-4977-abf1-5e4aee014426",
  apiBase: "https://api.hevyapp.com/v1",
  webhookDataUrl: "https://fitness.hacquin.net/hevy_data.json",
};

const LOCAL_PROXY = "/proxy.php?url=";
const PUBLIC_PROXY = "https://corsproxy.io/?";

// --- FIREBASE CONFIG ---
const getFirebaseConfig = () => {
  try { if (typeof __firebase_config !== 'undefined') return JSON.parse(__firebase_config); } catch (e) {}
  return {
    apiKey: "AIzaSyADGfxKRC8Rijjb-dHCS8xfYTDeadeuVdI",
    authDomain: "fitness-373b6.firebaseapp.com",
    projectId: "fitness-373b6",
    storageBucket: "fitness-373b6.firebasestorage.app",
    messagingSenderId: "166695838984",
    appId: "1:166695838984:web:aa818cb4c41c487084f8bd"
  };
};

let app, auth, db, provider;
try {
  app = initializeApp(getFirebaseConfig());
  auth = getAuth(app);
  // Détection Chrome iOS : utilise un cache mémoire uniquement pour éviter le crash IndexedDB
  const isChromeIOS = /CriOS/.test(navigator.userAgent);
  db = isChromeIOS
    ? initializeFirestore(app, { localCache: { kind: 'memory' } })
    : getFirestore(app);
  provider = new GoogleAuthProvider();
} catch (error) { console.error("Firebase Init Error:", error); }

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (dateString) => { if (!dateString) return ''; const date = new Date(dateString); return `${date.getDate()}/${date.getMonth() + 1}`; };
const getWeekNumber = (d) => { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d - yearStart) / 86400000) + 1) / 7); };
const getGroupKey = (dateStr, timeFrame) => { const date = new Date(dateStr); if (timeFrame === 'day') return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); if (timeFrame === 'week') return `Sem ${getWeekNumber(date)}`; if (timeFrame === 'month') return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); if (timeFrame === 'year') return date.getFullYear().toString(); return date.toLocaleDateString(); };
const getSortKey = (dateStr, timeFrame) => { const date = new Date(dateStr); if (timeFrame === 'day') return date.getTime(); if (timeFrame === 'week') return date.getFullYear() * 100 + getWeekNumber(date); if (timeFrame === 'month') return date.getFullYear() * 100 + date.getMonth(); if (timeFrame === 'year') return date.getFullYear(); return date.getTime(); };
const getLocalDateKey = (dateInput) => { if (!dateInput) return ''; const d = new Date(dateInput); return d.toLocaleDateString('en-CA'); };
const sanitizeForFirestore = (data) => JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
const DARK_TOOLTIP_STYLE = { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)', fontSize: '12px', padding: '8px' };
const PIE_COLORS = ['#fc4c02', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

// --- UI COMPONENTS ---
function NavButton({ icon: Icon, label, active, onClick }) { return (<button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl w-full transition-all active:scale-95 touch-manipulation ${active ? 'text-violet-400 bg-slate-700/50' : 'text-slate-500 hover:text-slate-300'}`}><Icon size={24} strokeWidth={active ? 2.5 : 2} className="mb-1" /><span className="text-[10px] font-medium tracking-wide">{label}</span></button>); }
function Modal({ isOpen, onClose, title, children, confirmText, onConfirm, isDestructive }) { if (!isOpen) return null; return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"><div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800"><h3 className="font-bold text-lg text-white flex items-center gap-2">{isDestructive && <AlertCircle className="w-5 h-5 text-red-500" />}{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={24} /></button></div><div className="p-6 text-slate-300">{children}</div><div className="p-4 bg-slate-900/50 flex gap-3 justify-end">{onConfirm && (<><button onClick={onClose} className="px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 font-medium">Annuler</button><button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-3 rounded-lg text-white font-medium shadow-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}>{confirmText || 'Confirmer'}</button></>)}{!onConfirm && <button onClick={onClose} className="px-4 py-3 bg-slate-700 rounded-lg text-white font-medium hover:bg-slate-600">Fermer</button>}</div></div></div>); }
function WaterModal({ isOpen, onClose, onAdd }) { if (!isOpen) return null; return (<Modal isOpen={isOpen} onClose={onClose} title="Ajouter de l'eau" confirmText={null} onConfirm={null}><div className="grid grid-cols-2 gap-4"><button onClick={() => onAdd(300)} className="bg-blue-600/20 hover:bg-blue-600/40 border-2 border-blue-500 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all active:scale-95"><Droplet size={40} className="text-blue-400" /> <span className="text-xl font-bold text-blue-200">30 cl</span></button><button onClick={() => onAdd(500)} className="bg-blue-600/20 hover:bg-blue-600/40 border-2 border-blue-500 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all active:scale-95"><div className="relative"><Droplet size={48} className="text-blue-400" /> <span className="absolute -top-1 -right-2 font-bold text-xl text-blue-300">+</span></div><span className="text-xl font-bold text-blue-200">50 cl</span></button></div><p className="text-center text-slate-400 text-sm mt-4">Sélectionnez la quantité bue</p></Modal>); }

// ============================================================================
// 2. COMPOSANTS VUES
// ============================================================================

function Dashboard({ healthLogs, stravaLogs }) {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeFrame, setTimeFrame] = useState('day');

  const safeStravaLogs = Array.isArray(stravaLogs) ? stravaLogs : [];
  const filteredStravaLogs = safeStravaLogs.filter(log => {
    if (!log.start_date) return false;
    const logDate = new Date(log.start_date);
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    return logDate >= start && logDate <= end;
  });

  const aggregateData = (dataLogs, extractor, defaultValues = {}) => {
      const groups = {};
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      
      let current = new Date(start);
      while (current <= end) {
          const key = getGroupKey(current.toISOString(), timeFrame);
          const sortKey = getSortKey(current.toISOString(), timeFrame);
          if (!groups[key]) {
              groups[key] = { date: key, sortKey: sortKey, ...defaultValues };
          }
          current.setDate(current.getDate() + 1);
      }

      dataLogs.forEach(log => {
          if (!log.date) return;
          const key = getGroupKey(log.date, timeFrame);
          if (groups[key]) {
              extractor(groups[key], log);
          }
      });

      return Object.values(groups).sort((a, b) => a.sortKey - b.sortKey);
  };

  const stravaMappedLogs = filteredStravaLogs.map(l => ({ ...l, date: l.start_date }));
  const stravaChartData = aggregateData(stravaMappedLogs, (acc, log) => { 
      acc.count = (acc.count || 0) + 1; 
      acc.durationMin = (acc.durationMin || 0) + (log.moving_time ? log.moving_time / 60 : 0);
  }, { count: 0, durationMin: 0 }).map(d => ({ ...d, durationMin: Math.round(d.durationMin) }));

  const getTypeLabel = (act) => {
      const type = act.type;
      const name = (act.name || '').toLowerCase();
      if (name.includes('boxe')) return 'Boxe';
      if (type === 'Run') return 'Course';
      if (type === 'Ride') return 'Cyclisme';
      if (type === 'VirtualRide' || type === 'EBikeRide') return 'Zwift';
      if (type === 'Swim') return 'Natation';
      if (type === 'Walk') return 'Marche';
      if (type === 'Hike') return 'Randonnée';
      if (type === 'WeightTraining') return 'Musculation';
      if (type === 'Rowing' || type === 'VirtualRow') return 'Rameur';
      if (type === 'Kayaking') return 'Kayak';
      return 'Autre';
  };

  const pieDataRaw = {};
  filteredStravaLogs.forEach(act => {
      const label = getTypeLabel(act);
      pieDataRaw[label] = (pieDataRaw[label] || 0) + 1;
  });
  const pieData = Object.keys(pieDataRaw).map(key => ({ name: key, value: pieDataRaw[key] }));
  
  const stepsData = aggregateData(healthLogs.filter(l => new Date(l.date) >= new Date(startDate)), (acc, log) => { 
      if (log.steps > 0) acc.total = (acc.total || 0) + (log.steps || 0); 
  }, { total: 0 });

  const chartTheme = { background: '#1e293b', grid: '#334155', text: '#94a3b8' };

  return (
    <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col gap-4 col-span-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><TrendingUp className="text-violet-400" /> Performances sportives</h2>
            <div className="flex w-full md:w-auto bg-slate-900/50 p-1 rounded-lg border border-slate-600">{['day', 'week', 'month'].map(tf => (<button key={tf} onClick={() => setTimeFrame(tf)} className={`flex-1 px-3 py-1 rounded text-sm transition-colors ${timeFrame === tf ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>{tf === 'day' ? 'Jour' : tf === 'week' ? 'Sem.' : 'Mois'}</button>))}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 bg-slate-900/50 p-2 rounded border border-slate-600"><Filter size={14} className="text-slate-400 shrink-0" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none w-full text-xs" /></div>
          <div className="flex items-center gap-1 bg-slate-900/50 p-2 rounded border border-slate-600"><span className="text-slate-500 text-xs px-1">à</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none w-full text-xs" /></div>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-cyan-400"/> Fréquence d'entraînement
        </h3>
        <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stravaChartData}>
                    <defs>
                        <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/><stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
                    <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} allowDecimals={false} />
                    <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                    <Bar dataKey="count" name="Séances Strava" fill="url(#cyanGradient)" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[#fc4c02]"/> Volume d'entraînement (mn)
        </h3>
        <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stravaChartData}>
                    <defs>
                        <linearGradient id="stravaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fc4c02" stopOpacity={1}/><stop offset="100%" stopColor="#fc4c02" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
                    <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
                    <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(value) => [`${value} min`, "Durée"]} />
                    <Bar dataKey="durationMin" name="Durée (min)" fill="url(#stravaGradient)" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-violet-400"/> Répartition
        </h3>
        <div className="h-56 flex items-center justify-center">
            {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} itemStyle={{color: '#fff'}} />
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} style={{ filter: 'drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.4))' }} />
                            ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="text-slate-500 text-sm">Aucune donnée Strava sur cette période.</div>
            )}
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg md:col-span-2 xl:col-span-1">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Footprints size={16} className="text-emerald-400"/> Pas par jour</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stepsData}>
                <defs><linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={1}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
                <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
                <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                <Bar dataKey="total" fill="url(#emeraldGradient)" radius={[4, 4, 0, 0]} name="Pas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
}

// --- VUE HEVY ---
function HevyView({ hevyWorkouts, loadingHevy, hevyError, hevySyncStatus, fetchHevyWorkouts, onDeleteWorkout }) {
  const [expandedCards, setExpandedCards] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showAllRecords, setShowAllRecords] = useState(false);

  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const calculateDuration = (start, end) => {
    if (!start || !end) return '—';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins <= 0) return '—';
    if (diffMins < 60) return `${diffMins} min`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const getMaxWeight = (sets) => {
    if (!sets || sets.length === 0) return null;
    let max = 0; let hasWeight = false;
    sets.forEach(s => {
      if (s.weight_kg !== undefined && s.weight_kg !== null) {
        hasWeight = true;
        if (s.weight_kg > max) max = s.weight_kg;
      }
    });
    return hasWeight ? max : null;
  };

  const calculateTotalVolume = (exercises) => {
    if (!exercises || !Array.isArray(exercises)) return 0;
    let total = 0;
    exercises.forEach(exo => {
      if (exo.sets && Array.isArray(exo.sets)) {
        exo.sets.forEach(set => { total += ((set.weight_kg || 0) * (set.reps || 0)); });
      }
    });
    return Math.round(total);
  };

  const cleanTitle = (title) => {
      if (!title) return 'Séance sans nom';
      const clean = title.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
      return clean || 'Séance sans nom';
  };

  // --- CALCUL DES RECORDS PAR EXERCICE ---
  // 1RM estimé via formule Brzycki : poids × 36 / (37 - reps), valide pour reps <= 10
  const estimate1RM = (weight, reps) => {
    if (!weight || !reps || reps <= 0) return 0;
    if (reps === 1) return weight;
    if (reps > 15) return weight; // au-delà pas fiable
    return weight * 36 / (37 - reps);
  };

  const personalRecords = useMemo(() => {
    const records = {}; // key = exercise title
    hevyWorkouts.forEach(workout => {
      if (!workout.exercises) return;
      const workoutDate = workout.start_time ? new Date(workout.start_time) : null;
      workout.exercises.forEach(exo => {
        if (!exo.title || !exo.sets) return;
        const name = cleanTitle(exo.title);
        exo.sets.forEach(set => {
          if (!set.weight_kg || !set.reps || set.weight_kg <= 0 || set.reps <= 0) return;
          const orm = estimate1RM(set.weight_kg, set.reps);
          if (!records[name] || orm > records[name].orm) {
            records[name] = {
              name,
              orm: parseFloat(orm.toFixed(1)),
              weight: set.weight_kg,
              reps: set.reps,
              date: workoutDate,
            };
          }
        });
      });
    });
    // Trier par 1RM décroissant
    return Object.values(records).sort((a, b) => b.orm - a.orm);
  }, [hevyWorkouts]);

  const recordsToShow = showAllRecords ? personalRecords : personalRecords.slice(0, 12);

  return (
    <>
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Dumbbell size={22} className="text-blue-500" /> Séances de musculation - Hevy</h2>
        <button onClick={() => fetchHevyWorkouts()} disabled={loadingHevy} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-colors">
            <RefreshCw size={15} className={loadingHevy ? "animate-spin" : ""}/>{loadingHevy ? 'Sync...' : 'Synchroniser'}
        </button>
      </div>

      {hevyError && (
        <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-4 rounded-xl text-sm leading-relaxed flex items-start gap-3">
          <AlertCircle className="shrink-0 text-red-400 mt-0.5" />
          <div><strong>Erreur :</strong> {hevyError}</div>
        </div>
      )}
      {hevySyncStatus && !hevyError && (
        <div className="bg-green-900/30 border border-green-500/40 text-green-200 p-3 rounded-xl text-sm flex items-center gap-2">
          <span className="text-green-400 font-bold">✓</span> {hevySyncStatus}
        </div>
      )}

      {/* --- RECORDS PAR EXERCICE --- */}
      {personalRecords.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700 bg-slate-800">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Award size={18} className="text-yellow-400" /> Records personnels
              <span className="text-xs text-slate-500 font-normal ml-1">— 1RM estimé (Brzycki)</span>
            </h3>
            <span className="text-xs text-slate-500">{personalRecords.length} exercices</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-700/30">
            {recordsToShow.map((rec, i) => (
              <div key={rec.name} className="bg-slate-800 px-4 py-3 flex items-center gap-3 hover:bg-slate-750 transition-colors">
                {/* Rang */}
                <div className={`text-xs font-black w-6 text-center shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>
                  {i + 1}
                </div>
                {/* Nom + détail */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200 truncate">{rec.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {rec.weight} kg × {rec.reps} rép
                    {rec.date && <span className="ml-2">· {rec.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>}
                  </div>
                </div>
                {/* 1RM */}
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-emerald-400">{rec.orm}</div>
                  <div className="text-[10px] text-slate-500">kg 1RM</div>
                </div>
              </div>
            ))}
          </div>
          {personalRecords.length > 12 && (
            <div className="border-t border-slate-700 p-3 text-center">
              <button onClick={() => setShowAllRecords(v => !v)} className="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors">
                {showAllRecords ? `Voir moins` : `Voir les ${personalRecords.length - 12} autres exercices`}
              </button>
            </div>
          )}
        </div>
      )}

      {!loadingHevy && hevyWorkouts.length === 0 && !hevyError && (
        <div className="text-center text-slate-500 py-16 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700"><Dumbbell size={40} className="mx-auto mb-3 opacity-20"/><p className="font-medium">Aucune séance trouvée.</p><p className="text-sm mt-1">Cliquez sur "Synchroniser" pour charger votre historique.</p></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {hevyWorkouts.map((workout, index) => {
          const cardId = workout.id || index;
          const isExpanded = expandedCards[cardId];
          const exercisesToShow = isExpanded ? workout.exercises : (workout.exercises || []).slice(0, 3);
          const hiddenCount = (workout.exercises?.length || 0) - 3;
          const totalVolume = workout.volume_kg || calculateTotalVolume(workout.exercises);

          return (
          <div key={cardId} className="bg-slate-800 rounded-2xl border border-slate-700 shadow-md overflow-hidden hover:shadow-lg hover:border-slate-500 transition-all duration-200">
            <div className="bg-blue-500/10 px-4 pt-4 pb-3 border-b border-slate-700/50 cursor-pointer" onClick={() => toggleCard(cardId)}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="bg-blue-600/20 p-2 rounded-lg shrink-0"><Dumbbell size={20} className="text-blue-400" /></div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-white text-sm leading-tight truncate">{cleanTitle(workout.title)}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{totalVolume} kg</span>
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><Clock size={12}/> {calculateDuration(workout.start_time, workout.end_time)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cardId); }}
                              className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                              title="Supprimer cette séance"
                            >
                              <Trash2 size={14} />
                            </button>
                            <div className="text-xs text-slate-400">{new Date(workout.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div>
                        </div>
                        <div className="text-xs text-slate-500">{new Date(workout.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="mt-1 text-slate-500">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                    </div>
                </div>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Exercices ({workout.exercises?.length || 0})</p>
              <div className="space-y-1">
                  {exercisesToShow.map((exo, i) => {
                    const maxW = getMaxWeight(exo.sets);
                    return (
                    <div key={i} className="flex justify-between items-center bg-slate-700/30 p-2 rounded-lg">
                      <span className="text-xs text-slate-200 font-medium truncate pr-2 flex-1">{exo.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                          {maxW !== null && (<span className="text-[10px] text-emerald-400 font-semibold">{maxW} kg</span>)}
                          <span className="text-[10px] bg-slate-600 text-slate-300 px-2 py-0.5 rounded font-bold whitespace-nowrap">{exo.sets?.length || 0} séries</span>
                      </div>
                    </div>
                  )})}
                  {!isExpanded && hiddenCount > 0 && (
                    <div className="text-center pt-2 pb-1 cursor-pointer hover:bg-slate-700/30 rounded-lg transition-colors" onClick={() => toggleCard(cardId)}>
                        <span className="text-[10px] text-blue-400 font-bold flex justify-center items-center gap-1">+ {hiddenCount} autres exercices <ChevronDown size={12}/></span>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>

    <Modal
      isOpen={confirmDeleteId !== null}
      onClose={() => setConfirmDeleteId(null)}
      title="Supprimer la séance ?"
      confirmText="Supprimer"
      isDestructive={true}
      onConfirm={() => { onDeleteWorkout(confirmDeleteId); setConfirmDeleteId(null); }}
    >
      <p>Cette action supprimera la séance de votre historique local et Firebase.</p>
      <p className="text-slate-400 text-sm mt-2">Elle restera dans l'application Hevy. Une re-synchronisation la ramènera.</p>
    </Modal>
    </>
  );
}

function HealthTracker({ user, db, healthLogs, setHealthLogs, isSyncingWithings, onWithingsSync }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [hydration, setHydration] = useState('');
  const [steps, setSteps] = useState('');
  const [distance, setDistance] = useState(''); 
  const [waist, setWaist] = useState(''); 

  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeFrame, setTimeFrame] = useState('day');
  
  const START_WEIGHT = 106; const TARGET_WEIGHT = 95;
  const START_FAT = 26; const TARGET_FAT = 15;
  const START_WAIST = 107; const TARGET_WAIST = 95;

  const getLastKnownValue = (key) => {
      if (!healthLogs || healthLogs.length === 0) return null;
      const sortedLogs = [...healthLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
      for (let i = sortedLogs.length - 1; i >= 0; i--) {
          const val = sortedLogs[i][key];
          if (val !== null && val !== undefined && val !== '') return val;
      }
      return null;
  };

  const latestWeight = getLastKnownValue('weight');
  const latestWaist = getLastKnownValue('waist');
  const latestFat = getLastKnownValue('bodyFat');
  const latestMuscle = getLastKnownValue('muscleMass');
  const latestHydration = getLastKnownValue('hydration'); 
  const latestSteps = getLastKnownValue('steps');
  const latestDist = getLastKnownValue('distance');
  const latestSystolic = getLastKnownValue('systolic');
  const latestDiastolic = getLastKnownValue('diastolic');
  
  const latestPWV = getLastKnownValue('pwv');
  const latestVisceral = getLastKnownValue('visceralFat');
  const latestBMR = getLastKnownValue('bmr');
  const latestVascularAge = getLastKnownValue('vascularAge');
  const latestRestingHR = getLastKnownValue('restingHR');

  const handleSave = async () => {
    const cleanWeight = weight ? parseFloat(weight.replace(',', '.')) : null;
    const cleanBodyFat = bodyFat ? parseFloat(bodyFat.replace(',', '.')) : null;
    const cleanMuscleMass = muscleMass ? parseFloat(muscleMass.replace(',', '.')) : null;
    const cleanHydration = hydration ? parseFloat(hydration.replace(',', '.')) : null;
    const cleanWaist = waist ? parseFloat(waist.replace(',', '.')) : null;
    const cleanSteps = steps ? parseInt(steps) : null;
    const cleanDistance = distance ? parseFloat(distance.replace(',', '.')) : null;

    if (!cleanWeight && !cleanSteps && !cleanWaist && !cleanHydration && !cleanDistance) return;

    // FIX P2: On lit TOUJOURS les données les plus récentes depuis Firestore avant de fusionner
    // Cela évite d'écraser des saisies faites sur un autre device entre temps
    let latestLogs = healthLogs;
    if (user && db) {
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists()) latestLogs = docSnap.data().healthLogs || [];
        } catch(e) { console.error("Cloud fetch failed before save", e); }
    }

    const inputDateKey = getLocalDateKey(new Date(date));
    const existingIndex = latestLogs.findIndex(l => getLocalDateKey(l.date) === inputDateKey);
    
    let updatedLogs;
    if (existingIndex >= 0) {
        const existing = latestLogs[existingIndex];
        const updatedEntry = { ...existing, weight: cleanWeight || existing.weight, bodyFat: cleanBodyFat || existing.bodyFat, muscleMass: cleanMuscleMass || existing.muscleMass, hydration: cleanHydration || existing.hydration, steps: cleanSteps || existing.steps, distance: cleanDistance || existing.distance, waist: cleanWaist || existing.waist };
        updatedLogs = [...latestLogs];
        updatedLogs[existingIndex] = updatedEntry;
    } else {
        const newEntry = { id: generateId(), date: new Date(date).toISOString(), weight: cleanWeight, bodyFat: cleanBodyFat, muscleMass: cleanMuscleMass, hydration: cleanHydration, steps: cleanSteps, distance: cleanDistance, waist: cleanWaist };
        updatedLogs = [...latestLogs, newEntry];
    }
    
    updatedLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    setHealthLogs(updatedLogs);
    setWeight(''); setBodyFat(''); setMuscleMass(''); setHydration(''); setSteps(''); setWaist(''); setDistance('');
  };

  const deleteEntry = async (id) => { 
     let latestLogs = healthLogs;
     if (user && db) {
         try {
             const docSnap = await getDoc(doc(db, "users", user.uid));
             if (docSnap.exists()) latestLogs = docSnap.data().healthLogs || [];
         } catch(e) {}
     }
     setHealthLogs(latestLogs.filter(log => log.id !== id)); 
  };
  
  const filteredLogs = healthLogs.filter(log => {
    if (!log.date) return false;
    const logDate = new Date(log.date);
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    return logDate >= start && logDate <= end;
  });

  const aggregateHealthData = (logs) => {
      const groups = {};
      logs.forEach(log => {
          const key = getGroupKey(log.date, timeFrame);
          const sortKey = getSortKey(log.date, timeFrame);
          if (!groups[key]) groups[key] = { date: key, sortKey, weightSum: 0, fatSum: 0, musSum: 0, hydraSum: 0, stepSum:0, waistSum: 0, distSum: 0, sysSum: 0, diaSum: 0, countW: 0, countS: 0, countWaist: 0, countSys: 0, countDia: 0, pwvSum: 0, countPwv: 0, visceralSum: 0, countVisc: 0, bmrSum: 0, countBmr: 0, hrSum: 0, countHr: 0 };
          if (log.weight) { groups[key].weightSum += log.weight; groups[key].countW += 1; }
          if (log.bodyFat) groups[key].fatSum += log.bodyFat;
          if (log.muscleMass) groups[key].musSum += log.muscleMass;
          if (log.hydration) groups[key].hydraSum += log.hydration;
          if (log.steps) { groups[key].stepSum += log.steps; groups[key].countS += 1; }
          if (log.distance) { groups[key].distSum += log.distance; }
          if (log.waist) { groups[key].waistSum += log.waist; groups[key].countWaist += 1; }
          if (log.systolic) { groups[key].sysSum += log.systolic; groups[key].countSys += 1; }
          if (log.diastolic) { groups[key].diaSum += log.diastolic; groups[key].countDia += 1; }
          if (log.pwv) { groups[key].pwvSum += log.pwv; groups[key].countPwv += 1; }
          if (log.visceralFat) { groups[key].visceralSum += log.visceralFat; groups[key].countVisc += 1; }
          if (log.bmr) { groups[key].bmrSum += log.bmr; groups[key].countBmr += 1; }
          if (log.restingHR) { groups[key].hrSum += log.restingHR; groups[key].countHr += 1; }
      });
      return Object.values(groups).sort((a, b) => a.sortKey - b.sortKey).map(g => ({
            date: g.date,
            weight: g.countW > 0 ? parseFloat((g.weightSum / g.countW).toFixed(1)) : null,
            bodyFat: g.countW > 0 ? parseFloat((g.fatSum / g.countW).toFixed(1)) : null,
            muscleMass: g.countW > 0 ? parseFloat((g.musSum / g.countW).toFixed(1)) : null,
            hydration: g.countW > 0 ? parseFloat((g.hydraSum / g.countW).toFixed(1)) : null,
            waist: g.countWaist > 0 ? parseFloat((g.waistSum / g.countWaist).toFixed(1)) : null,
            steps: timeFrame === 'day' ? g.stepSum : (g.countS > 0 ? Math.round(g.stepSum / g.countS) : null),
            distance: g.countS > 0 ? parseFloat(g.distSum.toFixed(2)) : null,
            systolic: g.countSys > 0 ? Math.round(g.sysSum / g.countSys) : null,
            diastolic: g.countDia > 0 ? Math.round(g.diaSum / g.countDia) : null,
            pwv: g.countPwv > 0 ? parseFloat((g.pwvSum / g.countPwv).toFixed(1)) : null,
            visceralFat: g.countVisc > 0 ? parseFloat((g.visceralSum / g.countVisc).toFixed(1)) : null,
            bmr: g.countBmr > 0 ? Math.round(g.bmrSum / g.countBmr) : null,
            restingHR: g.countHr > 0 ? Math.round(g.hrSum / g.countHr) : null
      }));
  };

  const chartData = aggregateHealthData(filteredLogs);
  const safeChartData = chartData.map(d => ({ ...d, bpRange: (d.systolic && d.diastolic) ? [d.diastolic, d.systolic] : null }));

  const calculateTrendLine = (data, dataKey, trendKey) => {
      const validPoints = [];
      data.forEach((d, i) => { if (d[dataKey] !== null && d[dataKey] !== undefined) validPoints.push({ x: i, y: d[dataKey] }); });
      if (validPoints.length < 2) return data.map(d => ({ ...d, [trendKey]: null }));
      const n = validPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      validPoints.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; });
      const denominator = (n * sumXX - sumX * sumX);
      if (denominator === 0) return data.map(d => ({ ...d, [trendKey]: null }));
      const m = (n * sumXY - sumX * sumY) / denominator;
      const b = (sumY - m * sumX) / n;
      return data.map((d, i) => ({ ...d, [trendKey]: parseFloat((m * i + b).toFixed(2)) }));
  };

  let chartDataWithTrends = calculateTrendLine(safeChartData, 'weight', 'weightTrend');
  chartDataWithTrends = calculateTrendLine(chartDataWithTrends, 'waist', 'waistTrend');
  chartDataWithTrends = calculateTrendLine(chartDataWithTrends, 'bodyFat', 'bodyFatTrend');
  chartDataWithTrends = calculateTrendLine(chartDataWithTrends, 'visceralFat', 'visceralFatTrend');

  const getDynamicTrend = (key) => {
      const validData = safeChartData.filter(d => d[key] !== null && d[key] !== undefined);
      if (validData.length < 2) return 0;
      return (validData[validData.length - 1][key] - validData[0][key]).toFixed(1);
  };
  const muscleTrend = getDynamicTrend('muscleMass');
  const fatTrend = getDynamicTrend('bodyFat');

  const currentWeight = latestWeight || START_WEIGHT; const lostWeight = Math.max(0, START_WEIGHT - currentWeight); const weightProgress = Math.min(100, Math.max(0, (lostWeight / (START_WEIGHT - TARGET_WEIGHT)) * 100));
  const currentFat = latestFat || START_FAT; const lostFat = Math.max(0, START_FAT - currentFat); const fatProgress = Math.min(100, Math.max(0, (lostFat / (START_FAT - TARGET_FAT)) * 100));
  const currentWaist = latestWaist || START_WAIST; const lostWaist = Math.max(0, START_WAIST - currentWaist); const waistProgress = Math.min(100, Math.max(0, (lostWaist / (START_WAIST - TARGET_WAIST)) * 100));
  const safeDomain = ['auto', 'auto'];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-200 flex items-center gap-2"><Plus size={18} className="text-violet-400"/> Nouvelle mesure</h3>
          {isSyncingWithings ? (
            <span className="flex items-center gap-2 text-xs text-slate-400"><RefreshCw size={14} className="animate-spin text-violet-400"/> Sync Withings...</span>
          ) : (
            <button onClick={() => onWithingsSync()} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600">
              <RefreshCw size={14} className="text-violet-400"/> Sync Withings
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
            <input type="text" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Poids (kg)" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
            <input type="text" value={waist} onChange={e => setWaist(e.target.value)} placeholder="Tour de taille (cm)" className="bg-slate-900 border border-slate-600 rounded p-2 text-white border-orange-500/50" />
            <input type="text" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="Fat %" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
            <input type="text" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} placeholder="Mus %" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
            <input type="text" value={hydration} onChange={e => setHydration(e.target.value)} placeholder="Eau %" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
            <button onClick={handleSave} className="col-span-2 md:col-span-3 w-full bg-violet-600 text-white font-bold p-2 rounded hover:bg-violet-700 transition-colors">Enregistrer</button>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col gap-4">
        <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Scale className="text-pink-500" /> Santé</h2><div className="flex bg-slate-900/50 p-1 rounded-lg">{['day', 'week', 'month'].map(tf => (<button key={tf} onClick={() => setTimeFrame(tf)} className={`px-3 py-1 rounded text-sm ${timeFrame === tf ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>{tf === 'day' ? 'Jour' : tf === 'week' ? 'Sem.' : 'Mois'}</button>))}</div></div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 bg-slate-900/50 p-2 rounded border border-slate-600"><Filter size={14} className="text-slate-400 shrink-0" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none w-full text-xs" /></div>
          <div className="flex items-center gap-1 bg-slate-900/50 p-2 rounded border border-slate-600"><span className="text-slate-500 text-xs px-1">à</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none w-full text-xs" /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12 gap-3">
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Poids</span><div className="text-xl font-bold text-white mt-1">{latestWeight || '--'} <span className="text-xs text-slate-500">kg</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Tour taille</span><div className="text-xl font-bold text-orange-400 mt-1">{latestWaist || '--'} <span className="text-xs text-slate-500">cm</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Graisse</span><div className="text-xl font-bold text-yellow-500 mt-1">{latestFat || '--'} <span className="text-xs text-slate-500">%</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Mus %</span><div className="text-xl font-bold text-emerald-500 mt-1">{latestMuscle || '--'}</div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Eau %</span><div className="text-xl font-bold text-blue-400 mt-1">{latestHydration || '--'}</div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">FC Repos</span><div className="text-xl font-bold text-red-400 mt-1">{latestRestingHR || '--'} <span className="text-xs text-slate-500">bpm</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Tension</span><div className="text-xl font-bold text-red-400 mt-1">{latestSystolic && latestDiastolic ? `${latestSystolic}/${latestDiastolic}` : '--'} <span className="text-xs text-slate-500">mmHg</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">VOP (PWV)</span><div className="text-xl font-bold text-indigo-400 mt-1">{latestPWV || '--'} <span className="text-xs text-slate-500">m/s</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Graisse Visc.</span><div className="text-xl font-bold text-amber-500 mt-1">{latestVisceral || '--'}</div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">BMR</span><div className="text-xl font-bold text-teal-400 mt-1">{latestBMR || '--'} <span className="text-xs text-slate-500">kcal</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Age Vasc.</span><div className="text-xl font-bold text-rose-400 mt-1">{latestVascularAge || '--'} <span className="text-xs text-slate-500">ans</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold">Pas / Dist.</span><div className="text-xl font-bold text-cyan-400 mt-1">{latestSteps || '--'} <span className="text-xs text-slate-500">/ {latestDist || '-'}km</span></div></div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Target size={16} className="text-red-400"/> Mes Objectifs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <div className="flex justify-between items-end mb-1">
                    <span className="text-xs text-slate-400">Poids ({START_WEIGHT}kg ➔ {TARGET_WEIGHT}kg)</span>
                    <span className="text-xs font-bold text-violet-400">{weightProgress.toFixed(0)}% <span className="text-slate-500 font-normal">({lostWeight.toFixed(1)} kg perdus)</span></span>
                </div>
                <div className="h-3 w-full bg-slate-700 rounded-full relative overflow-hidden"><div className="absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out rounded-full bg-violet-600" style={{ width: `${weightProgress}%` }} /></div>
            </div>
            <div>
                <div className="flex justify-between items-end mb-1">
                    <span className="text-xs text-slate-400">Graisse ({START_FAT}% ➔ {TARGET_FAT}%)</span>
                    <span className="text-xs font-bold text-yellow-500">{fatProgress.toFixed(0)}% <span className="text-slate-500 font-normal">({lostFat.toFixed(1)} pts perdus)</span></span>
                </div>
                <div className="h-3 w-full bg-slate-700 rounded-full relative overflow-hidden"><div className="absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out rounded-full bg-yellow-500" style={{ width: `${fatProgress}%` }} /></div>
            </div>
            <div>
                <div className="flex justify-between items-end mb-1">
                    <span className="text-xs text-slate-400">Taille ({START_WAIST}cm ➔ {TARGET_WAIST}cm)</span>
                    <span className="text-xs font-bold text-orange-500">{waistProgress.toFixed(0)}% <span className="text-slate-500 font-normal">({lostWaist.toFixed(1)} cm perdus)</span></span>
                </div>
                <div className="h-3 w-full bg-slate-700 rounded-full relative overflow-hidden"><div className="absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out rounded-full bg-orange-600" style={{ width: `${waistProgress}%` }} /></div>
            </div>
        </div>
      </div>

      {/* --- CARTE PROJECTIONS --- */}
      {(() => {
        // Régression linéaire pondérée : les données récentes comptent plus que les anciennes
        const weightedRegression = (logs, key) => {
          const points = logs
            .filter(l => l[key] != null && l.date)
            .map(l => ({ x: new Date(l.date).getTime(), y: l[key] }))
            .sort((a, b) => a.x - b.x);
          if (points.length < 3) return null;
          // Fenêtre glissante : on prend les 90 derniers jours pour la projection
          const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
          const recent = points.filter(p => p.x >= cutoff);
          const pts = recent.length >= 3 ? recent : points.slice(-10);
          // Pondération exponentielle : point le plus récent = poids max
          const now = pts[pts.length - 1].x;
          const halfLife = 20 * 24 * 3600 * 1000; // 20 jours
          let sw = 0, swx = 0, swy = 0, swxy = 0, swxx = 0;
          pts.forEach(p => {
            const age = now - p.x;
            const w = Math.exp(-age / halfLife);
            sw += w; swx += w * p.x; swy += w * p.y;
            swxy += w * p.x * p.y; swxx += w * p.x * p.x;
          });
          const denom = sw * swxx - swx * swx;
          if (Math.abs(denom) < 1e-10) return null;
          const slope = (sw * swxy - swx * swy) / denom; // unité/ms
          const intercept = (swy - slope * swx) / sw;
          const slopePerDay = slope * 86400000;
          const currentVal = intercept + slope * now;
          return { slopePerDay, currentVal };
        };

        const msPerMonth = 30.44 * 24 * 3600 * 1000;
        const horizons = [1, 2, 3, 6];

        const metrics = [
          {
            key: 'weight', label: 'Poids', unit: 'kg', target: TARGET_WEIGHT,
            color: 'text-violet-400', borderColor: 'border-violet-500/30', bgColor: 'bg-violet-500/10',
            goodDirection: -1, decimals: 1,
            current: latestWeight,
          },
          {
            key: 'bodyFat', label: 'Graisse', unit: '%', target: TARGET_FAT,
            color: 'text-yellow-400', borderColor: 'border-yellow-500/30', bgColor: 'bg-yellow-500/10',
            goodDirection: -1, decimals: 1,
            current: latestFat,
          },
          {
            key: 'waist', label: 'Tour de taille', unit: 'cm', target: TARGET_WAIST,
            color: 'text-orange-400', borderColor: 'border-orange-500/30', bgColor: 'bg-orange-500/10',
            goodDirection: -1, decimals: 1,
            current: latestWaist,
          },
        ];

        const regressions = metrics.map(m => ({
          ...m,
          reg: weightedRegression(healthLogs, m.key),
        }));

        const hasEnoughData = regressions.some(r => r.reg !== null);
        if (!hasEnoughData) return null;

        return (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-300">Projections — si la tendance actuelle se maintient</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regressions.map(({ key, label, unit, target, color, borderColor, bgColor, goodDirection, decimals, current, reg }) => {
                if (!reg) return (
                  <div key={key} className={`rounded-xl border ${borderColor} ${bgColor} p-4 flex items-center justify-center`}>
                    <span className="text-slate-500 text-xs">Pas assez de données</span>
                  </div>
                );

                const projections = horizons.map(months => {
                  const projected = reg.currentVal + reg.slopePerDay * months * 30.44;
                  const isGood = goodDirection * (projected - (current || reg.currentVal)) > 0;
                  const reachedTarget = goodDirection === -1
                    ? projected <= target
                    : projected >= target;
                  // Estimation du mois où l'objectif sera atteint
                  return { months, projected, isGood, reachedTarget };
                });

                // Quand atteint-on l'objectif ?
                let monthsToGoal = null;
                if (reg.slopePerDay !== 0) {
                  const daysToGoal = (target - reg.currentVal) / reg.slopePerDay;
                  if (daysToGoal > 0) monthsToGoal = Math.ceil(daysToGoal / 30.44);
                }

                const ratePerMonth = reg.slopePerDay * 30.44;
                const trendGood = goodDirection * ratePerMonth < 0 ? false : goodDirection * ratePerMonth > 0;

                return (
                  <div key={key} className={`rounded-xl border ${borderColor} ${bgColor} p-4 space-y-3`}>
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</div>
                        <div className={`text-2xl font-bold mt-0.5 ${color}`}>
                          {current != null ? current.toFixed(decimals) : '—'}
                          <span className="text-xs text-slate-500 font-normal ml-1">{unit}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Tendance/mois</div>
                        <div className={`text-sm font-bold mt-0.5 ${goodDirection * ratePerMonth < 0 ? 'text-green-400' : goodDirection * ratePerMonth > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {ratePerMonth >= 0 ? '+' : ''}{ratePerMonth.toFixed(2)} {unit}
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-2 pt-1">
                      {projections.map(({ months, projected, isGood, reachedTarget }) => {
                        const diff = projected - (current || reg.currentVal);
                        const goodTrend = goodDirection * diff < 0;
                        return (
                          <div key={months} className="flex items-center gap-3">
                            <div className="text-[10px] text-slate-500 w-10 shrink-0 font-bold">
                              {months === 1 ? '1 mois' : months === 2 ? '2 mois' : months === 3 ? '3 mois' : '6 mois'}
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${goodTrend ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, Math.abs(diff) / Math.abs(target - (current || reg.currentVal)) * 100)}%` }}
                              />
                            </div>
                            <div className={`text-sm font-bold w-16 text-right shrink-0 ${reachedTarget ? 'text-green-400' : goodTrend ? 'text-emerald-300' : 'text-red-400'}`}>
                              {projected.toFixed(decimals)}
                              <span className="text-[10px] text-slate-500 font-normal ml-0.5">{unit}</span>
                            </div>
                            {reachedTarget && <span className="text-green-400 text-xs shrink-0">✓</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Objectif */}
                    <div className="pt-1 border-t border-slate-700/50 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500">Objectif : {target} {unit}</span>
                      {monthsToGoal != null && monthsToGoal <= 24 ? (
                        <span className={`text-[10px] font-bold ${monthsToGoal <= 6 ? 'text-green-400' : 'text-slate-400'}`}>
                          ≈ {monthsToGoal} mois
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Hors portée</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-600 mt-4 text-center">Projection basée sur une régression linéaire pondérée des 90 derniers jours — les données récentes ont plus de poids.</p>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4">Poids</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataWithTrends}>
                        <defs><linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis domain={safeDomain} allowDataOverflow={true} stroke="#94a3b8" tick={{fontSize:10}} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Area type="monotone" dataKey="weight" stroke="#8b5cf6" fill="url(#violetGradient)" strokeWidth={2} name="Poids (kg)" dot={false} connectNulls/>
                        <Line type="monotone" dataKey="weightTrend" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Tendance" />
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Ruler size={16} className="text-orange-400"/> Tour de taille (cm)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataWithTrends}>
                        <defs><linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity={0.3}/><stop offset="100%" stopColor="#fb923c" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis domain={safeDomain} allowDataOverflow={true} stroke="#94a3b8" tick={{fontSize:10}} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Area type="monotone" dataKey="waist" stroke="#fb923c" fill="url(#orangeGradient)" strokeWidth={2} name="Taille (cm)" dot={false} connectNulls/>
                        <Line type="monotone" dataKey="waistTrend" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Tendance" />
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Heart size={16} className="text-red-500"/> Tension Artérielle (mmHg)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={[40, 180]} allowDataOverflow={true} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Legend wrapperStyle={{fontSize: 10, paddingTop: 10}} />
                        <Bar dataKey="bpRange" fill="#94a3b8" barSize={2} radius={[2, 2, 2, 2]} name="Plage" />
                        <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} dot={false} name="Systolique" isAnimationActive={false} connectNulls/>
                        <Line type="monotone" dataKey="diastolic" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Diastolique" isAnimationActive={false} connectNulls/>
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><HeartPulse size={16} className="text-pink-400"/> FC Repos — tensiomètre (bpm)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeChartData}>
                        <defs><linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" stopOpacity={0.3}/><stop offset="100%" stopColor="#f472b6" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} bpm`, 'FC repos']} />
                        <Area type="monotone" dataKey="restingHR" stroke="#f472b6" fill="url(#pinkGradient)" strokeWidth={2} name="FC repos (bpm)" dot={false} connectNulls/>
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Percent size={16} className="text-yellow-500"/> Graisse Corporelle (%)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataWithTrends}>
                        <defs><linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eab308" stopOpacity={1}/><stop offset="100%" stopColor="#eab308" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis domain={safeDomain} allowDataOverflow={true} stroke="#94a3b8" tick={{fontSize:10}} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Bar dataKey="bodyFat" fill="url(#yellowGradient)" radius={[4, 4, 0, 0]} name="Graisse (%)" />
                        <Line type="monotone" dataKey="bodyFatTrend" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Tendance" />
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Dumbbell size={16} className="text-emerald-500"/> Masse Musculaire (%)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={safeChartData}>
                        <defs><linearGradient id="emeraldGradient2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis domain={safeDomain} allowDataOverflow={true} stroke="#94a3b8" tick={{fontSize:10}} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Area type="monotone" dataKey="muscleMass" stroke="#10b981" fill="url(#emeraldGradient2)" strokeWidth={2} name="Muscle (%)" connectNulls/>
                    </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Droplet size={16} className="text-blue-400"/> Hydratation (%)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeChartData}>
                        <defs><linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={1}/><stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={safeDomain} allowDataOverflow={true} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Bar dataKey="hydration" fill="url(#blueGradient)" radius={[4, 4, 0, 0]} name="Eau %" />
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 col-span-full">
         <div className="flex justify-between items-start mb-6">
             <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">COMPOSITION CORPORELLE</h3>
                 <div className="flex items-center gap-2">
                     <div className="bg-indigo-500/20 p-1 rounded-full"><ArrowRight size={16} className="text-indigo-400"/></div>
                     <h2 className="text-xl font-bold text-white">Stable</h2>
                 </div>
             </div>
             <div className="flex gap-4">
                 <div className="flex items-center gap-2 text-xs font-bold text-[#2dd4bf]"><div className="w-2 h-2 rounded-full bg-[#2dd4bf] ring-2 ring-[#2dd4bf]/30"></div> Muscle</div>
                 <div className="flex items-center gap-2 text-xs font-bold text-[#e879f9]"><div className="w-2 h-2 rotate-45 bg-[#e879f9] ring-2 ring-[#e879f9]/30"></div> Graisse</div>
             </div>
         </div>
         
         <div className="h-72 w-full relative min-h-[300px]">
            {safeChartData.length === 0 && (<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm z-10 bg-slate-800/50 backdrop-blur-sm">En attente de données pour le graphique...</div>)}
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis orientation="right" domain={[0, 90]} ticks={[0, 15, 30, 45, 60, 75, 90]} stroke="#94a3b8" tick={{fontSize:10}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{stroke: '#fff', strokeWidth: 1, strokeDasharray: '3 3'}} />
                    <Line type="monotone" dataKey="muscleMass" stroke="#2dd4bf" strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0}} connectNulls={true} isAnimationActive={false} />
                    <Line type="monotone" dataKey="bodyFat" stroke="#e879f9" strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0}} connectNulls={true} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
         </div>

         <div className="grid grid-cols-2 gap-4 mt-6">
             <div className="bg-black/40 rounded-xl p-4 border border-slate-700/50">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MASSE MUSCULAIRE</div>
                 <div className={`text-2xl font-bold ${muscleTrend >= 0 ? 'text-white' : 'text-slate-200'}`}>{muscleTrend > 0 ? '+' : ''}{muscleTrend}%</div>
             </div>
             <div className="bg-black/40 rounded-xl p-4 border border-slate-700/50">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MASSE GRASSE</div>
                 <div className={`text-2xl font-bold ${fatTrend <= 0 ? 'text-white' : 'text-slate-200'}`}>{fatTrend > 0 ? '+' : ''}{fatTrend}%</div>
             </div>
         </div>
      </div>

      <div className="space-y-2 col-span-full">
         {[...healthLogs].reverse().slice(0, 5).map(log => (
             <div key={log.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
                 <div className="text-white text-sm">
                    {formatDate(log.date)} {log.weight && ` - ${log.weight}kg`} {log.steps && ` - ${log.steps} pas`} {log.waist && ` - ${log.waist} cm`}
                 </div>
                 <button onClick={() => deleteEntry(log.id)} className="text-slate-500 hover:text-red-500 p-2"><Trash2 size={16} /></button>
             </div>
         ))}
      </div>
    </div>
  );
}

// --- SETTINGS VIEW ---
function SettingsView({ user, isWithingsEnabled, handleWithingsAuth, isStravaEnabled, handleStravaAuth, withingsNeedsReconnect, onWithingsSyncNow }) {
  return (
    <div className="animate-fade-in space-y-6">
       <div className="text-center text-slate-500 text-xs mb-6">Connecté en tant que {user.email || 'Anonyme'}</div>
       
       {/* FIX P3: Bannière reconnexion Withings */}
       {withingsNeedsReconnect && (
         <div className="bg-orange-900/40 border border-orange-500/50 text-orange-200 p-4 rounded-xl text-sm flex items-center gap-3">
           <AlertCircle className="shrink-0 text-orange-400" size={20}/>
           <div className="flex-1">
             <strong>Withings déconnecté</strong> — Votre token a expiré. Cliquez sur "Reconnecter" pour rétablir la liaison.
           </div>
           <button onClick={handleWithingsAuth} className="bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold shrink-0">Reconnecter</button>
         </div>
       )}

       <section className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2"><Cloud size={18} className="text-blue-400"/> Services Connectés</h3>
          <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-600/50">
                  <div className="flex items-center gap-3">
                      <div className="bg-white text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">W</div>
                      <div><div className="font-bold text-slate-200">Withings</div><div className={`text-xs ${withingsNeedsReconnect ? 'text-orange-400' : 'text-slate-500'}`}>{withingsNeedsReconnect ? '⚠ Token expiré' : isWithingsEnabled ? 'Connecté' : 'Non connecté'}</div></div>
                  </div>
                  <button onClick={handleWithingsAuth} className={`px-3 py-1 rounded text-xs font-bold ${withingsNeedsReconnect ? 'bg-orange-500 text-white' : isWithingsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-blue-600 text-white'}`}>{withingsNeedsReconnect ? 'Reconnecter' : isWithingsEnabled ? 'Actif' : 'Lier'}</button>
              </div>
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-600/50">
                  <div className="flex items-center gap-3">
                      <div className="bg-[#fc4c02] text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">S</div>
                      <div><div className="font-bold text-slate-200">Strava</div><div className="text-xs text-slate-500">{isStravaEnabled ? 'Connecté' : 'Non connecté'}</div></div>
                  </div>
                  <button onClick={handleStravaAuth} className={`px-3 py-1 rounded text-xs font-bold ${isStravaEnabled ? 'bg-green-500/20 text-green-400' : 'bg-[#fc4c02] text-white'}`}>{isStravaEnabled ? 'Actif' : 'Lier'}</button>
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/50 p-3 rounded-lg border border-slate-600/50 gap-3">
                  <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center"><Dumbbell size={16}/></div>
                      <div>
                        <div className="font-bold text-slate-200">Hevy</div>
                        <div className="text-xs text-slate-500">Webhook VPS + API historique</div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-xs font-bold ${HEVY_CONFIG.apiKey !== 'VOTRE_CLE_API_HEVY_ICI' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {HEVY_CONFIG.apiKey !== 'VOTRE_CLE_API_HEVY_ICI' ? 'API configurée' : '⚠ Clé API manquante'}
                      </span>
                  </div>
              </div>
          </div>
       </section>
    </div>
  );
}

// --- STRAVA VIEW ---
function StravaView({ stravaLogs, onSync, isSyncing }) {
    const safeLogs = Array.isArray(stravaLogs) ? stravaLogs : [];

    const getActivityIcon = (act, className) => {
        const type = act.type; const name = (act.name || '').toLowerCase();
        if (name.includes('boxe')) return <Flame size={20} className={className} />;
        if (type === 'Run') return <Footprints size={20} className={className} />;
        if (type === 'Ride' || type === 'VirtualRide' || type === 'EBikeRide') return <Bike size={20} className={className} />;
        if (type === 'Swim') return <Droplet size={20} className={className} />;
        if (type === 'Walk') return <Footprints size={20} className={className} />;
        if (type === 'Hike') return <Mountain size={20} className={className} />;
        if (type === 'WeightTraining') return <Dumbbell size={20} className={className} />;
        if (type === 'Rowing' || type === 'Kayaking' || type === 'Canoeing' || type === 'VirtualRow') return <Waves size={20} className={className} />;
        return <Award size={20} className={className} />;
    };

    const getActivityLabel = (act) => {
        const type = act.type; const name = (act.name || '').toLowerCase();
        if (name.includes('boxe')) return 'Boxe';
        if (type === 'Run') return 'Course';
        if (type === 'Ride') return 'Cyclisme';
        if (type === 'VirtualRide' || type === 'EBikeRide') return 'Zwift';
        if (type === 'Swim') return 'Natation';
        if (type === 'Walk') return 'Marche';
        if (type === 'Hike') return 'Randonnée';
        if (type === 'WeightTraining') return 'Musculation';
        if (type === 'Rowing' || type === 'VirtualRow') return 'Rameur';
        if (type === 'Kayaking') return 'Kayak';
        return 'Sport';
    };

    const getActivityColor = (act) => {
        const type = act.type; const name = (act.name || '').toLowerCase();
        if (name.includes('boxe')) return { border: 'border-red-500/40', accent: 'text-red-400', bg: 'bg-red-500/10' };
        if (type === 'Run') return { border: 'border-orange-500/40', accent: 'text-orange-400', bg: 'bg-orange-500/10' };
        if (type === 'Ride' || type === 'VirtualRide' || type === 'EBikeRide') return { border: 'border-blue-500/40', accent: 'text-blue-400', bg: 'bg-blue-500/10' };
        if (type === 'Swim' || type === 'Rowing' || type === 'Kayaking' || type === 'VirtualRow') return { border: 'border-cyan-500/40', accent: 'text-cyan-400', bg: 'bg-cyan-500/10' };
        if (type === 'Walk' || type === 'Hike') return { border: 'border-green-500/40', accent: 'text-green-400', bg: 'bg-green-500/10' };
        if (type === 'WeightTraining') return { border: 'border-violet-500/40', accent: 'text-violet-400', bg: 'bg-violet-500/10' };
        return { border: 'border-slate-500/40', accent: 'text-slate-400', bg: 'bg-slate-500/10' };
    };

    const formatDuration = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h${String(m).padStart(2,'0')}`;
        return `${m}'${String(s).padStart(2,'0')}"`;
    };

    const formatSpeed = (act) => {
        if (!act.average_speed) return '—';
        if (act.type === 'Run') {
            const paceSecPerKm = 1000 / act.average_speed;
            const pm = Math.floor(paceSecPerKm / 60);
            const ps = Math.round(paceSecPerKm % 60);
            return `${pm}'${String(ps).padStart(2,'0')}" /km`;
        }
        return `${(act.average_speed * 3.6).toFixed(1)} km/h`;
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><MapIcon size={22} className="text-[#fc4c02]" /> Activités Strava</h2>
                <button onClick={() => onSync()} disabled={isSyncing} className="bg-[#fc4c02] hover:bg-[#e34402] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-colors">
                    <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""}/>{isSyncing ? 'Sync...' : 'Synchroniser'}
                </button>
            </div>

            {safeLogs.length === 0 ? (
                <div className="text-center text-slate-500 py-16 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700"><MapIcon size={40} className="mx-auto mb-3 opacity-20"/><p className="font-medium">Aucune activité synchronisée.</p><p className="text-sm mt-1">Cliquez sur "Synchroniser" pour récupérer vos séances du jour.</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {safeLogs.map(act => {
                        const colors = getActivityColor(act);
                        return (
                            <div key={act.id} className={`bg-slate-800 rounded-2xl border ${colors.border} shadow-md overflow-hidden hover:shadow-lg hover:scale-[1.01] transition-all duration-200`}>
                                <div className={`${colors.bg} px-4 pt-4 pb-3 border-b border-slate-700/50`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="shrink-0">{getActivityIcon(act, colors.accent)}</span>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-white text-sm leading-tight truncate">{act.name}</h3>
                                                <span className={`text-xs font-semibold ${colors.accent}`}>{getActivityLabel(act)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs text-slate-400">{act.start_date ? new Date(act.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—'}</div>
                                            <div className="text-xs text-slate-500">{act.start_date ? new Date(act.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-px bg-slate-700/30 m-3 rounded-xl overflow-hidden">
                                    <div className="bg-slate-800/80 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Durée</div><div className="font-bold text-slate-100 text-base">{act.moving_time ? formatDuration(act.moving_time) : '—'}</div></div>
                                    <div className="bg-slate-800/80 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Distance</div><div className="font-bold text-slate-100 text-base">{act.distance ? `${(act.distance / 1000).toFixed(2)} km` : '—'}</div></div>
                                    <div className="bg-slate-800/80 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{act.type === 'Run' ? 'Allure' : 'Vit. moy.'}</div><div className={`font-bold text-base ${colors.accent}`}>{formatSpeed(act)}</div></div>
                                    <div className="bg-slate-800/80 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">FC moy.</div><div className="font-bold text-slate-100 text-base flex items-center justify-center gap-1">{act.average_heartrate ? <><Heart size={13} className="text-red-400 shrink-0"/>{Math.round(act.average_heartrate)} bpm</> : <span className="text-slate-600">—</span>}</div></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// --- MAIN APP ---
function App() {
  const [user, setUser] = useState(null); 
  const [loadingAuth, setLoadingAuth] = useState(true); 
  const [syncStatus, setSyncStatus] = useState('idle'); 
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [healthLogs, setHealthLogs] = useState([]); 
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [isWithingsEnabled, setIsWithingsEnabled] = useState(false);
  const [isStravaEnabled, setIsStravaEnabled] = useState(false); 
  
  // HEVY STATE
  const [hevyWorkouts, setHevyWorkouts] = useState([]);
  const [loadingHevy, setLoadingHevy] = useState(false);
  const [hevyError, setHevyError] = useState(null);           // Erreurs réelles uniquement (rouge)
  const [hevySyncStatus, setHevySyncStatus] = useState(null); // Message de succès (vert)
  const lastHevyFetch = useRef(null);                         // Timestamp du dernier fetch

  // WITHINGS STATE
  const [isSyncingWithings, setIsSyncingWithings] = useState(false);
  const [withingsNeedsReconnect, setWithingsNeedsReconnect] = useState(false);

  // STRAVA STATE
  const [stravaLogs, setStravaLogs] = useState([]); 
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [stravaNextSync, setStravaNextSync] = useState(null); // FIX P3: timestamp du prochain auto-sync

  const isRemoteUpdate = useRef(false);
  const isDataLoaded = useRef(false); 

  // Auth - FIX P1: on laisse Firebase restaurer la session depuis localStorage automatiquement
  // Plus de signInAnonymously qui écrasait la session Google au refresh
  useEffect(() => {
    if (!auth) { setLoadingAuth(false); return; }
    setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence Error:", e));
    // Sur mobile, récupérer le résultat d'une connexion par redirect
    getRedirectResult(auth).then(result => {
      if (result?.user) console.log("[Auth] Redirect login success:", result.user.email);
    }).catch(e => console.error("[Auth] Redirect result error:", e));
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { 
      setUser(currentUser); 
      setLoadingAuth(false); 
    });
    return () => unsubscribe();
  }, []);

  const fetchWithFallback = async (url, options = {}) => {
      let localErrorDetails = "";
      try {
          const localUrl = `${LOCAL_PROXY}${encodeURIComponent(url)}`;
          const res = await fetch(localUrl, options);
          if (res.ok) {
              const text = await res.text();
              try { return JSON.parse(text); } catch(e) { return text; } 
          } else {
             localErrorDetails = `Local Proxy: ${res.status} ${res.statusText}`;
          }
      } catch (e) { localErrorDetails = `Local Proxy Exception: ${e.message}`; }
      try {
          const publicUrl = `${PUBLIC_PROXY}${encodeURIComponent(url)}`;
          const res = await fetch(publicUrl, { ...options });
          if (res.ok) return await res.json();
      } catch (e) { console.error("[Proxy] Public proxy failed.", e); }
      throw new Error(`Echec connexion (${localErrorDetails || "Proxies inaccessibles"})`);
  };

  // ---- FETCH HEVY WORKOUTS (corrigé v3) ----
  // Normalise un workout. Retourne null si c'est un squelette (juste un ID, sans données).
  const normalizeWorkout = (w) => {
    if (!w) return null;
    const raw = w.workout || w.payload || w;
    const id = raw.id || raw.workoutId;
    if (!id) return null;
    // Filtrer les squelettes : le webhook stockait juste {"workoutId":"..."} sans données réelles
    // Un workout valide a au minimum un titre, des exercices, ou une date de début
    const startTime = raw.start_time || raw.created_at || raw.updatedAt || raw.createdAt || null;
    const hasRealData = (raw.title !== undefined) || (Array.isArray(raw.exercises) && raw.exercises.length > 0) || startTime;
    if (!hasRealData) {
      console.log(`[Hevy] Squelette ignoré (pas de données pour ID: ${id})`);
      return null;
    }
    return { ...raw, id, start_time: startTime };
  };

  const fetchHevyWorkouts = async () => {
    setLoadingHevy(true);
    setHevyError(null);
    setHevySyncStatus(null);

    try {
      // --- Étape 1 : récupérer les séances récentes via le JSON webhook (VPS) ---
      let webhookWorkouts = [];
      try {
        const res = await fetch(`${HEVY_CONFIG.webhookDataUrl}?t=${Date.now()}`);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const raw = await res.json();
            if (Array.isArray(raw)) webhookWorkouts = raw;
            console.log(`[Hevy webhook] ${webhookWorkouts.length} entrées brutes depuis le VPS`);
            // Debug : afficher la structure de la première entrée pour diagnostic
            if (webhookWorkouts.length > 0) {
              console.log("[Hevy webhook] Structure 1ère entrée:", JSON.stringify(webhookWorkouts[0]).substring(0, 300));
            }
          }
        }
      } catch (e) {
        console.warn("[Hevy] Webhook JSON inaccessible:", e.message);
      }

      // --- Étape 2 : récupérer l'historique complet via l'API Hevy ---
      let apiWorkouts = [];
      let apiConfigured = HEVY_CONFIG.apiKey && HEVY_CONFIG.apiKey.length > 20 && HEVY_CONFIG.apiKey !== "VOTRE_CLE_API_HEVY_ICI";
      let apiError = null;

      console.log(`[Hevy API] Clé configurée: ${apiConfigured}, longueur: ${HEVY_CONFIG.apiKey?.length || 0}`);

      if (apiConfigured) {
        try {
          let page = 1;
          let hasMore = true;
          while (hasMore && page <= 200) {
            const res = await fetch(
              `${HEVY_CONFIG.apiBase}/workouts?page=${page}&pageSize=10`,
              { headers: { "api-key": HEVY_CONFIG.apiKey, "accept": "application/json" } }
            );
            if (!res.ok) {
              const errText = await res.text();
              console.warn(`[Hevy API] Erreur ${res.status} page ${page}:`, errText.substring(0, 300));
              apiError = `Erreur API Hevy ${res.status} : ${errText.substring(0, 150)}`;
              break;
            }
            const json = await res.json();
            if (page === 1) {
              console.log("[Hevy API] Clés de la réponse:", Object.keys(json));
              console.log("[Hevy API] Extrait:", JSON.stringify(json).substring(0, 400));
            }
            const batch = json.workouts || json.data || [];
            console.log(`[Hevy API] Page ${page}: ${batch.length} séances`);
            if (batch.length === 0) { hasMore = false; break; }
            apiWorkouts = [...apiWorkouts, ...batch];
            const totalPages = json.page_count || json.pageCount || 1;
            hasMore = page < totalPages;
            page++;
          }
          console.log(`[Hevy API] Total: ${apiWorkouts.length} séances récupérées`);
        } catch (e) {
          console.warn("[Hevy API] Exception:", e.message);
          apiError = "Exception appel API Hevy : " + e.message;
        }
      } else {
        console.warn("[Hevy API] Clé non configurée ou invalide — seul le webhook sera utilisé.");
      }

      // --- Étape 3 : normaliser et fusionner les deux sources sans doublons ---
      const mergedMap = new Map();

      // Priorité 1 : données API (complètes, normalisées)
      apiWorkouts.forEach(w => {
        const normalized = normalizeWorkout(w);
        if (normalized) mergedMap.set(normalized.id, normalized);
      });

      // Priorité 2 : données webhook (pour séances très récentes)
      webhookWorkouts.forEach(w => {
        const normalized = normalizeWorkout(w);
        if (!normalized) return;
        if (!mergedMap.has(normalized.id)) {
          mergedMap.set(normalized.id, normalized);
        }
      });

      console.log(`[Hevy] ${mergedMap.size} séances uniques après merge API+webhook`);

      // --- Étape 4 : merger avec le state Firebase existant ---
      setHevyWorkouts(prevFirebase => {
        const finalMap = new Map();
        // Base : données Firebase déjà en mémoire
        prevFirebase.forEach(w => {
          const normalized = normalizeWorkout(w);
          if (normalized) finalMap.set(normalized.id, normalized);
        });
        // Écrasement/ajout avec les données fraîches
        mergedMap.forEach((w, id) => finalMap.set(id, w));

        // Tri : les séances avec start_time d'abord, puis les autres
        const sorted = Array.from(finalMap.values()).sort((a, b) => {
          if (!a.start_time && !b.start_time) return 0;
          if (!a.start_time) return 1;
          if (!b.start_time) return -1;
          return new Date(b.start_time) - new Date(a.start_time);
        });

        console.log(`[Hevy] ${sorted.length} séances totales en state`);
        return sorted;
      });

      // Message de résultat
      const total = mergedMap.size;
      if (total > 0) {
        // Succès : on affiche le résultat et on efface les erreurs non-bloquantes
        const sourceLabel = apiConfigured && apiWorkouts.length > 0
          ? `API (${apiWorkouts.length}) + webhook (${webhookWorkouts.length})`
          : `webhook uniquement (${webhookWorkouts.length} entrées)`;
        setHevySyncStatus(`${total} séances chargées — source: ${sourceLabel}`);
        if (!apiError) setHevyError(null);
        else setHevyError(`⚠ API: ${apiError} — L'historique webhook est affiché.`);
      } else {
        // Aucune séance valide après filtrage des squelettes
        const hint = apiConfigured
          ? "Aucune séance trouvée. Vérifiez la console (F12) pour le détail."
          : "Aucune séance trouvée. Renseignez votre clé API Hevy dans HEVY_CONFIG.apiKey pour charger l'historique.";
        if (apiError) setHevyError(apiError);
        else setHevySyncStatus(hint);
      }

    } catch (err) {
      console.error("[Hevy] Erreur globale:", err);
      setHevyError("Erreur de synchronisation : " + err.message);
    } finally {
      setLoadingHevy(false);
      lastHevyFetch.current = Date.now();
    }
  };

  // Suppression d'une séance Hevy (locale + Firebase)
  const handleDeleteHevyWorkout = (workoutId) => {
    setHevyWorkouts(prev => prev.filter(w => w.id !== workoutId));
  };

  // Auto-fetch au premier affichage de l'onglet workout, puis TTL 5 min
  useEffect(() => {
    if (activeTab !== 'workout') return;
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = Date.now();
    if (!lastHevyFetch.current || now - lastHevyFetch.current > FIVE_MINUTES) {
      fetchHevyWorkouts();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleWithingsCallback = async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code'); const error = params.get('error');
        if (error) { alert(`Erreur Withings: ${error}`); return; }
        const scope = params.get('scope');
        if (code && user && (!scope || scope.includes('user.metrics'))) {
            setIsSyncingWithings(true);
            try {
                const formData = new URLSearchParams();
                formData.append('action', 'requesttoken'); formData.append('grant_type', 'authorization_code');
                formData.append('client_id', WITHINGS_CONFIG.clientId); formData.append('client_secret', WITHINGS_CONFIG.clientSecret);
                formData.append('code', code); formData.append('redirect_uri', WITHINGS_CONFIG.redirectUri);
                const data = await fetchWithFallback(WITHINGS_CONFIG.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() });
                
                if (data && data.status === 0 && data.body) {
                    const tokenData = { access_token: data.body.access_token, refresh_token: data.body.refresh_token, userid: data.body.userid, expires_in: data.body.expires_in, timestamp: Date.now() };
                    await setDoc(doc(db, "users", user.uid, "integrations", "withings"), tokenData);
                    await setDoc(doc(db, "users", user.uid), { isWithingsEnabled: true }, { merge: true });
                    setIsWithingsEnabled(true); alert("Compte Withings connecté !"); window.history.replaceState({}, document.title, "/");
                    setTimeout(() => handleWithingsSync(tokenData), 1000);
                } else throw new Error(data ? JSON.stringify(data) : "Réponse vide");
            } catch (err) { 
              // FIX P3: on ne masque plus l'erreur — on informe l'utilisateur
              console.error("Withings auth error:", err);
              alert("Erreur de connexion Withings. Veuillez réessayer depuis les Paramètres.");
              window.history.replaceState({}, document.title, "/");
            } 
            finally { setIsSyncingWithings(false); }
        }
    };
    if (user) handleWithingsCallback();
  }, [user]);

  const handleStartStravaAuth = () => {
     window.location.href = `${STRAVA_CONFIG.authUrl}?client_id=${STRAVA_CONFIG.clientId}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_CONFIG.redirectUri)}&approval_prompt=force&scope=${STRAVA_CONFIG.scope}&state=${generateId()}`;
  };
  
  const handleStartWithingsAuth = () => {
     window.location.href = `${WITHINGS_CONFIG.authUrl}?response_type=code&client_id=${WITHINGS_CONFIG.clientId}&state=${generateId()}&scope=${WITHINGS_CONFIG.scope}&redirect_uri=${encodeURIComponent(WITHINGS_CONFIG.redirectUri)}`;
  };

  useEffect(() => {
    const handleStravaCallback = async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code'); const scope = params.get('scope'); 
        if (code && scope && scope.includes('read') && !isWithingsEnabled) {
            setIsSyncingStrava(true);
            try {
                const formData = new URLSearchParams();
                formData.append('client_id', STRAVA_CONFIG.clientId); formData.append('client_secret', STRAVA_CONFIG.clientSecret);
                formData.append('code', code); formData.append('grant_type', 'authorization_code');
                const data = await fetchWithFallback(STRAVA_CONFIG.tokenUrl, { method: 'POST', body: formData });
                if (data && data.access_token) {
                    const tokenData = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, athlete: data.athlete };
                    await setDoc(doc(db, "users", user.uid, "integrations", "strava"), tokenData);
                    await setDoc(doc(db, "users", user.uid), { isStravaEnabled: true }, { merge: true });
                    setIsStravaEnabled(true); alert("Strava connecté !"); window.history.replaceState({}, document.title, "/");
                    setTimeout(() => handleStravaSync(tokenData), 1000);
                }
            } catch (err) { alert("Erreur Strava: " + err.message); } 
            finally { setIsSyncingStrava(false); }
        }
    };
    if (user && !isStravaEnabled) handleStravaCallback();
  }, [user, isStravaEnabled]);

  const handleStravaSync = async (forcedToken = null) => {
      if (!user) return;
      setIsSyncingStrava(true);
      try {
          let tokenData = forcedToken;
          if (!tokenData) {
            const tokenSnap = await getDoc(doc(db, "users", user.uid, "integrations", "strava"));
            if (!tokenSnap.exists()) throw new Error("Strava non connecté.");
            tokenData = tokenSnap.data();
          }
          if (tokenData.expires_at && tokenData.expires_at < Math.floor(Date.now() / 1000) + 300) {
              const formData = new URLSearchParams();
              formData.append('client_id', STRAVA_CONFIG.clientId); formData.append('client_secret', STRAVA_CONFIG.clientSecret);
              formData.append('grant_type', 'refresh_token'); formData.append('refresh_token', tokenData.refresh_token);
              try {
                const refreshRes = await fetchWithFallback(STRAVA_CONFIG.tokenUrl, { method: 'POST', body: formData });
                if (refreshRes.access_token) {
                    tokenData = { ...tokenData, access_token: refreshRes.access_token, refresh_token: refreshRes.refresh_token, expires_at: refreshRes.expires_at };
                    await setDoc(doc(db, "users", user.uid, "integrations", "strava"), tokenData);
                } else {
                    // FIX P3: refresh échoué → reconnexion requise
                    await setDoc(doc(db, "users", user.uid), { isStravaEnabled: false }, { merge: true });
                    setIsStravaEnabled(false);
                    alert("⚠️ Votre connexion Strava a expiré. Veuillez la reconnecter depuis les Paramètres.");
                    return;
                }
              } catch(refreshErr) {
                console.error("[Strava] Erreur refresh:", refreshErr);
                await setDoc(doc(db, "users", user.uid), { isStravaEnabled: false }, { merge: true });
                setIsStravaEnabled(false);
                alert("⚠️ Votre connexion Strava a expiré. Veuillez la reconnecter depuis les Paramètres.");
                return;
              }
          }
          const activities = await fetchWithFallback(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
          if (Array.isArray(activities)) {
              setStravaLogs(prevLogs => {
                  const newLogs = [...prevLogs]; let updates = 0;
                  activities.forEach(act => {
                      const slimAct = { id: act.id, name: act.name, type: act.type, start_date: act.start_date, moving_time: act.moving_time, distance: act.distance, average_speed: act.average_speed, average_heartrate: act.average_heartrate || null };
                      const existingIndex = newLogs.findIndex(l => l.id === slimAct.id);
                      if (existingIndex === -1) { newLogs.push(slimAct); updates++; } else { newLogs[existingIndex] = slimAct; updates++; }
                  });
                  return updates > 0 ? newLogs.sort((a, b) => new Date(b.start_date) - new Date(a.start_date)) : prevLogs;
              });
              // FIX P3: mémoriser l'heure du dernier sync pour auto-refresh
              setStravaNextSync(Date.now() + 6 * 60 * 60 * 1000); // prochain refresh dans 6h
          }
      } catch (e) { console.error("Strava Sync Error:", e); } 
      finally { setIsSyncingStrava(false); }
  };

  // FIX P3: state réactif pour déclencher l'auto-sync après le chargement Firebase
  const [dataLoaded, setDataLoaded] = useState(false);

  // FIX P3: Auto-sync Strava au chargement (une seule fois par session)
  const stravaAutoSynced = useRef(false);
  useEffect(() => {
    if (!user || !dataLoaded || stravaAutoSynced.current) return;
    if (isStravaEnabled) {
      stravaAutoSynced.current = true;
      handleStravaSync();
    }
  }, [user, isStravaEnabled, dataLoaded]);

  // FIX P3: Auto-sync Withings au chargement (une seule fois par session)
  const withingsAutoSynced = useRef(false);
  useEffect(() => {
    if (!user || !dataLoaded || withingsAutoSynced.current) return;
    if (isWithingsEnabled) {
      withingsAutoSynced.current = true;
      handleWithingsSync();
    }
  }, [user, isWithingsEnabled, dataLoaded]);

  // Sync Read (Firebase)
  useEffect(() => {
    if (!user || !db) return;
    setSyncStatus('syncing');
    const unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        isRemoteUpdate.current = true;
        setHealthLogs(data.healthLogs || []);
        setIsWithingsEnabled(data.isWithingsEnabled || false);
        setIsStravaEnabled(data.isStravaEnabled || false);
        setStravaLogs(data.stravaLogs || []);
        setHevyWorkouts(data.hevyWorkouts || []);
        isDataLoaded.current = true;
        setDataLoaded(true); // FIX P3: déclenche les auto-syncs
        setSyncStatus('idle');
      } else { isDataLoaded.current = true; setDataLoaded(true); setSyncStatus('idle'); }
    }, (error) => setSyncStatus('error'));
    return () => unsubscribeSnapshot();
  }, [user]);

  // Sync Write (Firebase)
  useEffect(() => {
    if (!user || !isDataLoaded.current || !db) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    setSyncStatus('syncing');
    const saveData = async () => {
      try {
        const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const trimmedHealthLogs = (healthLogs || []).filter(l => l.date && new Date(l.date) >= twelveMonthsAgo);
        const trimmedStravaLogs = (stravaLogs || []).slice(-300);
        const trimmedHevyWorkouts = (hevyWorkouts || []).slice(0, 100);

        const safeData = sanitizeForFirestore({ 
            healthLogs: trimmedHealthLogs, 
            isWithingsEnabled, 
            isStravaEnabled, 
            stravaLogs: trimmedStravaLogs,
            hevyWorkouts: trimmedHevyWorkouts 
        });
        await setDoc(doc(db, "users", user.uid), safeData, { merge: true });
        setSyncStatus('saved'); setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (e) { console.error("Save Error:", e); setSyncStatus('error'); }
    };
    const timeoutId = setTimeout(saveData, 500); 
    return () => clearTimeout(timeoutId);
  }, [healthLogs, user, isWithingsEnabled, isStravaEnabled, stravaLogs, hevyWorkouts]);

  const handleLogin = async () => { 
    try { 
      await setPersistence(auth, browserLocalPersistence);
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error) { 
      console.error("Login error:", error);
      alert("Erreur de connexion Google."); 
    } 
  };

  const handleAddWater = async (amount) => {
      let latestLogs = healthLogs;
      if (user && db) {
          try {
              const docSnap = await getDoc(doc(db, "users", user.uid));
              if (docSnap.exists()) latestLogs = docSnap.data().healthLogs || [];
          } catch(e) {}
      }
      const todayKey = getLocalDateKey(new Date());
      const todayLogIndex = latestLogs.findIndex(l => l.date && getLocalDateKey(l.date) === todayKey);
      let newHealthLogs = [...latestLogs];
      if (todayLogIndex >= 0) {
          const log = newHealthLogs[todayLogIndex];
          newHealthLogs[todayLogIndex] = { ...log, waterIntake: (log.waterIntake || 0) + amount };
      } else {
          newHealthLogs.push({ id: generateId(), date: new Date().toISOString(), waterIntake: amount });
          newHealthLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
      }
      setHealthLogs(newHealthLogs);
  };

  const handleWithingsSync = async (forcedTokenData = null, skipTokenFetch = false) => {
      if (!user) return;
      setIsSyncingWithings(true);
      setWithingsNeedsReconnect(false);
      try {
          let tokenData = forcedTokenData;
          if (!tokenData && !skipTokenFetch) {
              const tokenSnap = await getDoc(doc(db, "users", user.uid, "integrations", "withings"));
              if (!tokenSnap.exists()) { setIsSyncingWithings(false); return; }
              tokenData = tokenSnap.data();
          }

          if (!tokenData) { setIsSyncingWithings(false); return; }

          const isExpired = tokenData.timestamp && (Date.now() - tokenData.timestamp > (tokenData.expires_in - 300) * 1000);
          if (isExpired) {
              const refreshForm = new URLSearchParams();
              refreshForm.append('action', 'requesttoken'); refreshForm.append('grant_type', 'refresh_token');
              refreshForm.append('client_id', WITHINGS_CONFIG.clientId); refreshForm.append('client_secret', WITHINGS_CONFIG.clientSecret);
              refreshForm.append('refresh_token', tokenData.refresh_token);
              try {
                const refreshData = await fetchWithFallback(WITHINGS_CONFIG.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: refreshForm.toString() });
                if (refreshData && refreshData.status === 0 && refreshData.body) {
                    tokenData = { ...tokenData, access_token: refreshData.body.access_token, refresh_token: refreshData.body.refresh_token, expires_in: refreshData.body.expires_in, timestamp: Date.now() };
                    await setDoc(doc(db, "users", user.uid, "integrations", "withings"), tokenData);
                } else {
                    // FIX P3: le refresh a échoué (token révoqué ou expiré) → demander reconnexion
                    console.error("[Withings] Refresh token invalide, reconnexion nécessaire.");
                    setWithingsNeedsReconnect(true);
                    setIsSyncingWithings(false);
                    return;
                }
              } catch(refreshErr) {
                console.error("[Withings] Erreur refresh token:", refreshErr);
                setWithingsNeedsReconnect(true);
                setIsSyncingWithings(false);
                return;
              }
          }

          const now = Math.floor(Date.now() / 1000);
          const twoYearsAgo = now - (2 * 365 * 24 * 3600);
          
          const [measResponse1, measResponse2, actDataArray] = await Promise.all([
              fetchWithFallback(`${WITHINGS_CONFIG.measureUrl}?action=getmeas&meastype=1,6,11,76,77,91,170,226,155&category=1&startdate=${twoYearsAgo}&enddate=${now}`, { method: 'GET', headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }),
              fetchWithFallback(`${WITHINGS_CONFIG.measureUrl}?action=getmeas&meastype=9,10&category=1&startdate=${twoYearsAgo}&enddate=${now}`, { method: 'GET', headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }),
              Promise.all(
                  Array.from({length: 24}, (_, i) => {
                      const endTs = now - (i * 30 * 24 * 3600);
                      const startTs = endTs - (30 * 24 * 3600);
                      const startDateStr = new Date(startTs * 1000).toISOString().split('T')[0];
                      const endDateStr = new Date(endTs * 1000).toISOString().split('T')[0];
                      return fetchWithFallback(`${WITHINGS_CONFIG.activityUrl}?action=getactivity&startdateymd=${startDateStr}&enddateymd=${endDateStr}&data_fields=steps,distance`, { method: 'GET', headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
                  })
              )
          ]);

          let newHealthLogs = [...healthLogs];
          let updates = 0;

          const processGroups = (response) => {
              if (response && response.status === 0 && response.body && response.body.measuregrps) {
                  response.body.measuregrps.forEach(group => {
                      const date = new Date(group.date * 1000).toISOString();
                      const dateKey = getLocalDateKey(date);
                      let weight = null, bodyFat = null, muscleMass = null, hydration = null;
                      let systolic = null, diastolic = null, pwv = null, visceralFat = null, bmr = null, vascularAge = null, restingHR = null;
                      group.measures.forEach(m => {
                          const val = m.value * Math.pow(10, m.unit);
                          if (m.type === 1) weight = parseFloat(val.toFixed(2));
                          if (m.type === 6) bodyFat = parseFloat(val.toFixed(2));
                          if (m.type === 11) restingHR = Math.round(val);
                          if (m.type === 76) muscleMass = parseFloat(val.toFixed(2));
                          if (m.type === 77) hydration = parseFloat(val.toFixed(2));
                          if (m.type === 10) systolic = parseInt(val.toFixed(0));
                          if (m.type === 9) diastolic = parseInt(val.toFixed(0));
                          if (m.type === 91) pwv = parseFloat(val.toFixed(1));
                          if (m.type === 170) visceralFat = parseFloat(val.toFixed(1));
                          if (m.type === 226) bmr = Math.round(val);
                          if (m.type === 155) vascularAge = parseFloat(val.toFixed(1));
                      });
                      let logIndex = newHealthLogs.findIndex(l => getLocalDateKey(l.date) === dateKey);
                      if (logIndex === -1) { 
                          newHealthLogs.push({ id: generateId(), date: date, weight: weight, bodyFat: bodyFat, muscleMass: (muscleMass && weight) ? parseFloat(((muscleMass / weight) * 100).toFixed(1)) : null, hydration: (hydration && weight) ? parseFloat(((hydration / weight) * 100).toFixed(1)) : null, systolic: systolic, diastolic: diastolic, pwv: pwv, visceralFat: visceralFat, bmr: bmr, vascularAge: vascularAge, restingHR: restingHR }); 
                          updates++;
                      } else {
                          const existing = newHealthLogs[logIndex];
                          newHealthLogs[logIndex] = { ...existing, weight: weight || existing.weight, bodyFat: bodyFat || existing.bodyFat, muscleMass: (muscleMass && weight) ? parseFloat(((muscleMass / weight) * 100).toFixed(1)) : existing.muscleMass, hydration: (hydration && weight) ? parseFloat(((hydration / weight) * 100).toFixed(1)) : existing.hydration, systolic: systolic || existing.systolic, diastolic: diastolic || existing.diastolic, pwv: pwv || existing.pwv, visceralFat: visceralFat || existing.visceralFat, bmr: bmr || existing.bmr, vascularAge: vascularAge || existing.vascularAge, restingHR: restingHR || existing.restingHR };
                          updates++;
                      }
                  });
              }
          };

          processGroups(measResponse1);
          processGroups(measResponse2);

          actDataArray.forEach(actData => {
            if (actData && actData.status === 0 && actData.body && actData.body.activities) {
                actData.body.activities.forEach(act => {
                    let logIndex = newHealthLogs.findIndex(l => getLocalDateKey(l.date) === act.date);
                    if (logIndex === -1) { 
                        newHealthLogs.push({ id: generateId(), date: new Date(act.date).toISOString(), steps: act.steps, distance: act.distance ? parseFloat((act.distance / 1000).toFixed(2)) : null }); 
                        updates++;
                    } else {
                        newHealthLogs[logIndex] = { ...newHealthLogs[logIndex], steps: act.steps || newHealthLogs[logIndex].steps, distance: act.distance ? parseFloat((act.distance / 1000).toFixed(2)) : newHealthLogs[logIndex].distance };
                        updates++;
                    }
                });
            }
          });
          if (updates > 0) { newHealthLogs.sort((a, b) => new Date(a.date) - new Date(b.date)); setHealthLogs(newHealthLogs); }
          setIsSyncingWithings(false);
      } catch(e) {
          console.error("Withings Sync Error:", e);
          setIsSyncingWithings(false);
      }
  };

  if (loadingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white animate-pulse">Chargement...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center"><Activity className="h-16 w-16 text-violet-400 mx-auto mb-4" /><h1 className="text-3xl font-bold text-white mb-2">Bodycontrol Program</h1><p className="text-slate-400">Suivez vos entraînements et votre santé dans le cloud.</p><div className="text-xs text-slate-600 mt-2 font-mono">Build: {APP_VERSION}</div></div>
        <button onClick={handleLogin} className="bg-white text-slate-900 font-bold py-3 px-6 rounded-xl flex items-center gap-3 hover:bg-slate-100 transition-colors shadow-lg"><img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" /> Se connecter avec Google</button>
      </div>
    );
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard healthLogs={healthLogs} stravaLogs={stravaLogs} />;
      case 'workout': return <HevyView hevyWorkouts={hevyWorkouts} loadingHevy={loadingHevy} fetchHevyWorkouts={fetchHevyWorkouts} hevyError={hevyError} hevySyncStatus={hevySyncStatus} onDeleteWorkout={handleDeleteHevyWorkout} />;
      case 'health': return <HealthTracker user={user} db={db} healthLogs={healthLogs} setHealthLogs={setHealthLogs} isSyncingWithings={isSyncingWithings} onWithingsSync={handleWithingsSync} />;
      case 'strava': return <StravaView stravaLogs={stravaLogs} onSync={handleStravaSync} isSyncing={isSyncingStrava} />;
      case 'settings': return <SettingsView user={user} isWithingsEnabled={isWithingsEnabled} handleWithingsAuth={handleStartWithingsAuth} isStravaEnabled={isStravaEnabled} handleStravaAuth={handleStartStravaAuth} withingsNeedsReconnect={withingsNeedsReconnect} />;
      default: return <Dashboard healthLogs={healthLogs} stravaLogs={stravaLogs} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      <header className="bg-slate-800 border-b border-slate-700 p-4 shadow-md sticky top-0 z-30">
        <div className="max-w-[98%] mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2 text-violet-400"><Activity className="h-6 w-6" /> Bodycontrol</h1>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowWaterModal(true)} className="bg-blue-600/20 text-blue-400 p-2 rounded-full hover:bg-blue-600/40 border border-blue-500/50 mr-2 flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-blue-900/20"><Droplet size={20} fill="currentColor" className="opacity-80"/></button>
             <div className="text-xs">{syncStatus === 'syncing' && <CloudLightning className="text-yellow-400 animate-pulse" size={20} />}{syncStatus === 'saved' && <Cloud className="text-green-400" size={20} />}{syncStatus === 'error' && <AlertCircle className="text-red-500" size={20} />}{syncStatus === 'idle' && <Cloud className="text-slate-600" size={20} />}</div>
             <div className="hidden md:flex items-center gap-2 text-sm text-slate-400"><User size={16}/> {user.displayName || 'Anonyme'}</div>
             <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-slate-700"><LogOut size={20} /></button>
          </div>
        </div>
      </header>
      <main className="max-w-[98%] mx-auto p-4 md:p-6">{renderContent()}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-1 pb-safe shadow-2xl z-40">
        <div className="max-w-[98%] mx-auto flex justify-between items-center px-2">
          <NavButton icon={BarChart2} label="Sport" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={Dumbbell} label="Musculation" active={activeTab === 'workout'} onClick={() => setActiveTab('workout')} />
          <NavButton icon={HeartPulse} label="Santé" active={activeTab === 'health'} onClick={() => setActiveTab('health')} />
          <NavButton icon={MapIcon} label="Strava" active={activeTab === 'strava'} onClick={() => setActiveTab('strava')} />
          <NavButton icon={Settings} label="Params" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </nav>
      <WaterModal isOpen={showWaterModal} onClose={() => setShowWaterModal(false)} onAdd={handleAddWater} />
    </div>
  );
}

export default App;