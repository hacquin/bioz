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
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, getDoc, initializeFirestore } from "firebase/firestore";

import biozLogo from './BIOZ.png';
import { DEMO_DATA } from './demoData';

import video1 from './1.mp4';
import video2 from './2.mp4';
import video3 from './3.mp4';
import video4 from './4.mp4';
import video1L from './1-laptop.mp4';
import video2L from './2-laptop.mp4';
import video3L from './3-laptop.mp4';
import video4L from './4-laptop.mp4';
const ONBOARDING_VIDEOS_MOBILE = [video1, video2, video3, video4];
const ONBOARDING_VIDEOS_LAPTOP = [video1L, video2L, video3L, video4L];

// --- VERSIONING ---
const APP_VERSION = "v2.35.0 (Stable Switch)";
console.log(`[Bodycontrol] Démarrage de l'application ${APP_VERSION}`);

// --- WITHINGS CONFIGURATION ---
const WITHINGS_CONFIG = {
  clientId: import.meta.env.VITE_WITHINGS_CLIENT_ID,
  clientSecret: import.meta.env.VITE_WITHINGS_CLIENT_SECRET,
  redirectUri: "https://fitness.hacquin.net",
  authUrl: "https://account.withings.com/oauth2_user/authorize2",
  tokenUrl: "https://wbsapi.withings.net/v2/oauth2",
  measureUrl: "https://wbsapi.withings.net/measure",
  activityUrl: "https://wbsapi.withings.net/v2/measure",
  scope: "user.metrics,user.activity"
};

// --- STRAVA CONFIGURATION ---
const STRAVA_CONFIG = {
  clientId: import.meta.env.VITE_STRAVA_CLIENT_ID,
  clientSecret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
  redirectUri: "https://fitness.hacquin.net",
  authUrl: "https://www.strava.com/oauth/authorize",
  tokenUrl: "https://www.strava.com/oauth/token",
  scope: "activity:read_all,activity:read"
};

// --- HUAWEI HEALTH KIT CONFIGURATION ---
const HUAWEI_CONFIG = {
  clientId: import.meta.env.VITE_HUAWEI_CLIENT_ID,
  clientSecret: import.meta.env.VITE_HUAWEI_CLIENT_SECRET,
  redirectUri: "https://fitness.hacquin.net",
  authUrl: "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize",
  tokenUrl: "https://oauth-login.cloud.huawei.com/oauth2/v3/token",
  apiBase: "https://health-api.cloud.huawei.com/healthkit/v1",
  scope: "https://www.huawei.com/healthkit/bodyweight.read https://www.huawei.com/healthkit/bodyfat.read https://www.huawei.com/healthkit/heartrate.read https://www.huawei.com/healthkit/activity.read"
};

// --- HEVY CONFIGURATION ---
const HEVY_CONFIG = {
  apiBase: "https://api.hevyapp.com/v1",
};

// --- DATA SOURCE PREFERENCES ---
const DATA_TYPE_SOURCES = [
  { key: 'weight', label: 'Poids', sources: ['withings', 'huawei'] },
  { key: 'bodyFat', label: 'Body fat %', sources: ['withings', 'huawei'] },
  { key: 'muscleMass', label: 'Masse musculaire', sources: ['withings', 'huawei'] },
  { key: 'hydration', label: 'Hydratation', sources: ['withings', 'huawei'] },
  { key: 'restingHR', label: 'FC repos', sources: ['withings', 'huawei', 'strava'] },
  { key: 'systolic', label: 'Tension systolique', sources: ['withings'] },
  { key: 'diastolic', label: 'Tension diastolique', sources: ['withings'] },
  { key: 'pwv', label: 'PWV', sources: ['withings'] },
  { key: 'visceralFat', label: 'Graisse viscérale', sources: ['withings', 'huawei'] },
  { key: 'bmr', label: 'BMR', sources: ['withings', 'huawei'] },
  { key: 'vascularAge', label: 'Âge vasculaire', sources: ['withings'] },
  { key: 'steps', label: 'Pas', sources: ['withings', 'huawei', 'strava'] },
  { key: 'distance', label: 'Distance', sources: ['withings', 'huawei', 'strava'] },
  { key: 'endurance', label: 'Activités endurance', sources: ['strava', 'huawei'] },
];

const LOCAL_PROXY = "/proxy.php?url=";
const PUBLIC_PROXY = "https://corsproxy.io/?";

// --- FIREBASE CONFIG ---
const getFirebaseConfig = () => {
  let config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "fitness.hacquin.net", // <-- LA MAGIE EST ICI : On utilise votre domaine !
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

  try { 
    if (typeof __firebase_config !== 'undefined') {
      const injectedConfig = JSON.parse(__firebase_config);
      // On retire le "FORCE OVERRIDE" qui forçait firebaseapp.com.
      // On impose notre propre domaine à Firebase.
      config = { ...config, ...injectedConfig, authDomain: "fitness.hacquin.net" }; 
    }
  } catch (e) {}
  
  return config;
};

let app, auth, db;
try {
  app = initializeApp(getFirebaseConfig());
  auth = getAuth(app);
  
  // FIX CRITIQUE: On désactive systématiquement IndexedDB
  db = initializeFirestore(app, { localCache: { kind: 'memory' } });
} catch (error) { 
  console.error("Firebase Init Error:", error); 
}
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
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const defaultStart = isMobile
    ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : '2026-01-01';
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeFrame, setTimeFrame] = useState('day');
  const [showCardFilter, setShowCardFilter] = useState(false);
  const [hiddenCards, setHiddenCards] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bioz_hiddenCards') || '[]'); } catch { return []; }
  });
  const toggleCard = (cardId) => {
    setHiddenCards(prev => {
      const next = prev.includes(cardId) ? prev.filter(c => c !== cardId) : [...prev, cardId];
      localStorage.setItem('bioz_hiddenCards', JSON.stringify(next));
      return next;
    });
  };
  const isCardVisible = (cardId) => !hiddenCards.includes(cardId);

  const DASHBOARD_CARDS = [
    { id: 'frequency', label: "Fréquence d'entraînement" },
    { id: 'volume', label: "Volume d'entraînement" },
    { id: 'repartition', label: 'Répartition' },
    { id: 'steps', label: 'Pas par jour' },
    { id: 'cycling_dist', label: 'Cyclisme — Distance' },
    { id: 'running_dist', label: 'Running — Distance' },
    { id: 'endurance_hr', label: 'FC moy. endurance' },
    { id: 'cycling_dur', label: 'Cyclisme — Durée' },
    { id: 'running_dur', label: 'Running — Durée' },
    { id: 'cycling_speed', label: 'Cyclisme — Vit. moy.' },
    { id: 'running_pace', label: 'Running — Allure moy.' },
    { id: 'rowing_dist', label: 'Aviron — Distance' },
    { id: 'rowing_dur', label: 'Aviron — Durée' },
    { id: 'rowing_hr', label: 'Aviron — FC moy.' },
  ];

  // FIX PERF: utilisation de useMemo pour éviter le crash CPU sur mobile
  const safeStravaLogs = useMemo(() => Array.isArray(stravaLogs) ? stravaLogs : [], [stravaLogs]);
  
  const filteredStravaLogs = useMemo(() => safeStravaLogs.filter(log => {
    if (!log.start_date) return false;
    const logDate = new Date(log.start_date);
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    return logDate >= start && logDate <= end;
  }), [safeStravaLogs, startDate, endDate]);

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

  const stravaMappedLogs = useMemo(() => filteredStravaLogs.map(l => ({ ...l, date: l.start_date })), [filteredStravaLogs]);
  
  const stravaChartData = useMemo(() => aggregateData(stravaMappedLogs, (acc, log) => { 
      acc.count = (acc.count || 0) + 1; 
      acc.durationMin = (acc.durationMin || 0) + (log.moving_time ? log.moving_time / 60 : 0);
  }, { count: 0, durationMin: 0 }).map(d => ({ ...d, durationMin: Math.round(d.durationMin) })), [stravaMappedLogs, timeFrame, startDate, endDate]);

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

  const pieData = useMemo(() => {
    const raw = {};
    filteredStravaLogs.forEach(act => {
        const label = getTypeLabel(act);
        raw[label] = (raw[label] || 0) + 1;
    });
    return Object.keys(raw).map(key => ({ name: key, value: raw[key] }));
  }, [filteredStravaLogs]);
  
  const stepsData = useMemo(() => aggregateData(healthLogs.filter(l => new Date(l.date) >= new Date(startDate)), (acc, log) => {
      if (log.steps > 0) acc.total = (acc.total || 0) + (log.steps || 0);
  }, { total: 0 }), [healthLogs, startDate, endDate, timeFrame]);

  // --- Données endurance par type ---
  const cyclingTypes = ['Ride', 'VirtualRide', 'EBikeRide'];
  const runningTypes = ['Run'];
  const rowingTypes = ['Rowing', 'VirtualRow'];

  const cyclingMapped = useMemo(() => filteredStravaLogs.filter(a => cyclingTypes.includes(a.type)).map(l => ({ ...l, date: l.start_date })), [filteredStravaLogs]);
  const runningMapped = useMemo(() => filteredStravaLogs.filter(a => runningTypes.includes(a.type)).map(l => ({ ...l, date: l.start_date })), [filteredStravaLogs]);
  const rowingMapped = useMemo(() => filteredStravaLogs.filter(a => rowingTypes.includes(a.type)).map(l => ({ ...l, date: l.start_date })), [filteredStravaLogs]);
  const enduranceMapped = useMemo(() => filteredStravaLogs.filter(a => [...cyclingTypes, ...runningTypes, ...rowingTypes].includes(a.type)).map(l => ({ ...l, date: l.start_date })), [filteredStravaLogs]);

  const cyclingDistData = useMemo(() => aggregateData(cyclingMapped, (acc, log) => {
    acc.distance = (acc.distance || 0) + ((log.distance || 0) / 1000);
  }, { distance: 0 }).map(d => ({ ...d, distance: parseFloat(d.distance.toFixed(1)) || null })), [cyclingMapped, timeFrame, startDate, endDate]);

  const runningDistData = useMemo(() => aggregateData(runningMapped, (acc, log) => {
    acc.distance = (acc.distance || 0) + ((log.distance || 0) / 1000);
  }, { distance: 0 }).map(d => ({ ...d, distance: parseFloat(d.distance.toFixed(1)) || null })), [runningMapped, timeFrame, startDate, endDate]);

  const cyclingDurData = useMemo(() => aggregateData(cyclingMapped, (acc, log) => {
    acc.duration = (acc.duration || 0) + ((log.moving_time || 0) / 60);
  }, { duration: 0 }).map(d => ({ ...d, duration: Math.round(d.duration) || null })), [cyclingMapped, timeFrame, startDate, endDate]);

  const runningDurData = useMemo(() => aggregateData(runningMapped, (acc, log) => {
    acc.duration = (acc.duration || 0) + ((log.moving_time || 0) / 60);
  }, { duration: 0 }).map(d => ({ ...d, duration: Math.round(d.duration) || null })), [runningMapped, timeFrame, startDate, endDate]);

  const cyclingSpeedData = useMemo(() => aggregateData(cyclingMapped, (acc, log) => {
    if (log.average_speed) { acc._speeds = acc._speeds || []; acc._speeds.push(log.average_speed); }
  }, {}).map(d => ({ ...d, speed: d._speeds && d._speeds.length > 0 ? parseFloat((d._speeds.reduce((a, b) => a + b, 0) / d._speeds.length * 3.6).toFixed(1)) : null })), [cyclingMapped, timeFrame, startDate, endDate]);

  const runningPaceData = useMemo(() => aggregateData(runningMapped, (acc, log) => {
    if (log.average_speed) { acc._speeds = acc._speeds || []; acc._speeds.push(log.average_speed); }
  }, {}).map(d => ({ ...d, pace: d._speeds && d._speeds.length > 0 ? parseFloat((1000 / (d._speeds.reduce((a, b) => a + b, 0) / d._speeds.length) / 60).toFixed(2)) : null })), [runningMapped, timeFrame, startDate, endDate]);

  const rowingDistData = useMemo(() => aggregateData(rowingMapped, (acc, log) => {
    acc.distance = (acc.distance || 0) + ((log.distance || 0) / 1000);
  }, { distance: 0 }).map(d => ({ ...d, distance: parseFloat(d.distance.toFixed(1)) || null })), [rowingMapped, timeFrame, startDate, endDate]);

  const rowingDurData = useMemo(() => aggregateData(rowingMapped, (acc, log) => {
    acc.duration = (acc.duration || 0) + ((log.moving_time || 0) / 60);
  }, { duration: 0 }).map(d => ({ ...d, duration: Math.round(d.duration) || null })), [rowingMapped, timeFrame, startDate, endDate]);

  const rowingHRData = useMemo(() => aggregateData(rowingMapped, (acc, log) => {
    if (log.average_heartrate) { acc._hrs = acc._hrs || []; acc._hrs.push(log.average_heartrate); }
  }, {}).map(d => ({ ...d, hr: d._hrs && d._hrs.length > 0 ? Math.round(d._hrs.reduce((a, b) => a + b, 0) / d._hrs.length) : null })), [rowingMapped, timeFrame, startDate, endDate]);

  const enduranceHRData = useMemo(() => aggregateData(enduranceMapped, (acc, log) => {
    if (log.average_heartrate) { acc._hrs = acc._hrs || []; acc._hrs.push(log.average_heartrate); }
  }, {}).map(d => ({ ...d, hr: d._hrs && d._hrs.length > 0 ? Math.round(d._hrs.reduce((a, b) => a + b, 0) / d._hrs.length) : null })), [enduranceMapped, timeFrame, startDate, endDate]);

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
        <button onClick={() => setShowCardFilter(p => !p)} className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${showCardFilter ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:text-slate-200'}`}>
          <Settings size={14} /> Afficher / masquer des cartes {hiddenCards.length > 0 && <span className="bg-violet-500 text-white rounded-full px-1.5 text-[10px]">{hiddenCards.length}</span>}
        </button>
        {showCardFilter && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DASHBOARD_CARDS.map(card => (
              <button key={card.id} onClick={() => toggleCard(card.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${isCardVisible(card.id) ? 'bg-slate-700/50 border-slate-600 text-slate-200' : 'bg-slate-900/80 border-slate-700 text-slate-500 line-through'}`}>
                {isCardVisible(card.id) ? '✓' : '✕'} {card.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isCardVisible('frequency') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
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
      </div>}

      {isCardVisible('volume') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
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
      </div>}

      {isCardVisible('repartition') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
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
                <div className="text-slate-500 text-sm">Aucune donnée sur cette période.</div>
            )}
        </div>
      </div>}

      {isCardVisible('steps') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg md:col-span-2 xl:col-span-1">
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
      </div>}

      {isCardVisible('cycling_dist') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Bike size={16} className="text-blue-400"/> Cyclisme — Distance (km)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cyclingDistData}>
              <defs><linearGradient id="bikeDistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} km`, 'Distance']} />
              <Bar dataKey="distance" fill="url(#bikeDistGrad)" radius={[4, 4, 0, 0]} name="Distance (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('running_dist') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Footprints size={16} className="text-orange-400"/> Running — Distance (km)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={runningDistData}>
              <defs><linearGradient id="runDistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={1}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} km`, 'Distance']} />
              <Bar dataKey="distance" fill="url(#runDistGrad)" radius={[4, 4, 0, 0]} name="Distance (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('endurance_hr') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Heart size={16} className="text-red-400"/> FC moy. endurance (bpm)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enduranceHRData}>
              <defs><linearGradient id="hrEndGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={1}/><stop offset="100%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} domain={['auto', 'auto']} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} bpm`, 'FC moy.']} />
              <Bar dataKey="hr" fill="url(#hrEndGrad)" radius={[4, 4, 0, 0]} name="FC moy. (bpm)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('cycling_dur') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Clock size={16} className="text-blue-400"/> Cyclisme — Durée (min)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cyclingDurData}>
              <defs><linearGradient id="bikeDurGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={1}/><stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} min`, 'Durée']} />
              <Bar dataKey="duration" fill="url(#bikeDurGrad)" radius={[4, 4, 0, 0]} name="Durée (min)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('running_dur') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Clock size={16} className="text-orange-400"/> Running — Durée (min)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={runningDurData}>
              <defs><linearGradient id="runDurGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity={1}/><stop offset="100%" stopColor="#fb923c" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} min`, 'Durée']} />
              <Bar dataKey="duration" fill="url(#runDurGrad)" radius={[4, 4, 0, 0]} name="Durée (min)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('cycling_speed') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Bike size={16} className="text-blue-400"/> Cyclisme — Vit. moy. (km/h)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cyclingSpeedData}>
              <defs><linearGradient id="bikeSpdGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} domain={['auto', 'auto']} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} km/h`, 'Vit. moy.']} />
              <Area type="monotone" dataKey="speed" stroke="#3b82f6" fill="url(#bikeSpdGrad)" strokeWidth={2} name="Vit. moy. (km/h)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('running_pace') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Footprints size={16} className="text-orange-400"/> Running — Allure moy. (min/km)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={runningPaceData}>
              <defs><linearGradient id="runPaceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.6}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} domain={['auto', 'auto']} reversed />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} min/km`, 'Allure']} />
              <Area type="monotone" dataKey="pace" stroke="#f97316" fill="url(#runPaceGrad)" strokeWidth={2} name="Allure (min/km)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('rowing_dist') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Waves size={16} className="text-cyan-400"/> Aviron — Distance (km)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rowingDistData}>
              <defs><linearGradient id="rowDistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/><stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} km`, 'Distance']} />
              <Bar dataKey="distance" fill="url(#rowDistGrad)" radius={[4, 4, 0, 0]} name="Distance (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('rowing_dur') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Clock size={16} className="text-cyan-400"/> Aviron — Durée (min)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rowingDurData}>
              <defs><linearGradient id="rowDurGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} min`, 'Durée']} />
              <Bar dataKey="duration" fill="url(#rowDurGrad)" radius={[4, 4, 0, 0]} name="Durée (min)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {isCardVisible('rowing_hr') && <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Heart size={16} className="text-cyan-400"/> Aviron — FC moy. (bpm)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rowingHRData}>
              <defs><linearGradient id="rowHRGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/><stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} padding={{ left: 10, right: 30 }} />
              <YAxis tick={{fill: chartTheme.text, fontSize: 10}} axisLine={{stroke: chartTheme.grid}} domain={['auto', 'auto']} />
              <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} bpm`, 'FC moy.']} />
              <Bar dataKey="hr" fill="url(#rowHRGrad)" radius={[4, 4, 0, 0]} name="FC moy. (bpm)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}
    </div>
  );
}

// --- VUE HEVY ---
function HevyView({ hevyWorkouts, loadingHevy, hevyError, hevySyncStatus, fetchHevyWorkouts, onDeleteWorkout, isDemo }) {
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
        <button onClick={() => fetchHevyWorkouts()} disabled={loadingHevy || isDemo} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-colors">
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
                            {!isDemo && <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cardId); }}
                              className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                              title="Supprimer cette séance"
                            >
                              <Trash2 size={14} />
                            </button>}
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

function HealthTracker({ user, db, healthLogs, setHealthLogs, isSyncingWithings, onWithingsSync, goals, isDemo }) {
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
  
  const START_WEIGHT = goals.startWeight; const TARGET_WEIGHT = goals.targetWeight;
  const START_FAT = goals.startFat; const TARGET_FAT = goals.targetFat;
  const START_WAIST = goals.startWaist; const TARGET_WAIST = goals.targetWaist;

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

  // --- BILAN IA ---
  const [aiBilan, setAiBilan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiDate, setAiDate] = useState(null);

  useEffect(() => {
    if (isDemo) {
      setAiBilan(DEMO_DATA.aiBilan.text);
      setAiDate(DEMO_DATA.aiBilan.date);
      return;
    }
    if (!user || !db) return;
    const loadBilan = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.aiBilan) { setAiBilan(data.aiBilan.text); setAiDate(data.aiBilan.date); }
        }
      } catch(e) { console.error('Erreur chargement bilan IA', e); }
    };
    loadBilan();
  }, [user, db, isDemo]);

  const generateAiBilan = async () => {
    setAiLoading(true);
    setAiError(null);
    const recentLogs = [...healthLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    // Calcul des moyennes sur les 5 derniers jours pour aider Claude à analyser les tendances
    const avg = (logs, key) => {
      const vals = logs.filter(l => l[key] != null).map(l => l[key]);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
    };
    const last5 = recentLogs.slice(0, 5);
    const prev5 = recentLogs.slice(5, 10);
    const trends = {
      weight:  { recent: avg(last5, 'weight'),  prev: avg(prev5, 'weight') },
      bodyFat: { recent: avg(last5, 'bodyFat'), prev: avg(prev5, 'bodyFat') },
      waist:   { recent: avg(last5, 'waist'),   prev: avg(prev5, 'waist') },
    };
    const systemPrompt = `Tu es un coach santé expert en nutrition cétogène. Tu t'adresses à un homme de 55 ans, 1,74 m, en régime cétogène. Objectifs : 95 kg (depuis 106), 15% de graisse (depuis 26%), 95 cm de tour de taille (depuis 107). TON : Pince-sans-rire, direct, avec une touche d'humour sec — une vraie vanne max par bilan, pas un sourire de façade. Tu sais reconnaître les progrès et les saluer sincèrement (même avec une pointe d'ironie), et tu dis franchement quand ça stagne sans t'appesantir. ANALYSE : Ne jamais commenter une variation d'un seul jour — la balance ment, les conditions changent. Tu analyses UNIQUEMENT les tendances sur les 5 derniers jours disponibles : si le poids moyen des 5 jours baisse par rapport aux 5 jours d'avant, c'est une vraie tendance. Une variation isolée ne signifie rien. HYDRATATION : Quand le poids baisse mais que le taux de graisse augmente, ne conclus PAS automatiquement à une perte musculaire. Vérifie d'abord le taux d'hydratation : une déshydratation fausse la mesure de graisse à la hausse (impédancemétrie). Mentionne cette hypothèse si l'hydratation est basse. PRIORITÉS : L'objectif prioritaire est la perte de tour de taille (graisse viscérale), puis le poids. La perte de muscle n'est PAS un problème tant que le taux de graisse reste sous 20%. Ne tire pas la sonnette d'alarme pour une baisse de masse musculaire si la graisse est sous contrôle. IMPORTANT : Le bilan est généré le matin. Ignore les données du jour en cours. FORMATAGE : Zéro markdown, zéro tiret, zéro étoile. Prose uniquement. Maximum 4-5 phrases pour le bilan, 3 conseils courts. Sépare les deux parties avec [CONSEILS] seul sur une ligne.`;
    const userMessage = `Voici mes données de santé au ${new Date().toLocaleDateString('fr-FR')} :\n\nMESURES ACTUELLES :\n- Poids : ${latestWeight || 'non mesuré'} kg\n- Tour de taille : ${latestWaist || 'non mesuré'} cm\n- Graisse corporelle : ${latestFat || 'non mesuré'} %\n- Masse musculaire : ${latestMuscle || 'non mesuré'} %\n- Hydratation : ${latestHydration || 'non mesuré'} %\n- Tension : ${latestSystolic || '--'}/${latestDiastolic || '--'} mmHg\n- FC repos : ${latestRestingHR || 'non mesuré'} bpm\n- Vitesse onde de pouls : ${latestPWV || 'non mesuré'} m/s\n- Graisse viscérale : ${latestVisceral || 'non mesuré'}\n- Métabolisme de base : ${latestBMR || 'non mesuré'} kcal\n- Âge vasculaire : ${latestVascularAge || 'non mesuré'} ans\nTENDANCES SUR 5 JOURS (moyennes calculées — base ton analyse là-dessus, pas sur les variations quotidiennes) :\nPoids moyen J-5 à J-1 : ${trends.weight.recent || '—'} kg | Poids moyen J-10 à J-6 : ${trends.weight.prev || '—'} kg\nGraisse moyenne récente : ${trends.bodyFat.recent || '—'}% | Graisse période précédente : ${trends.bodyFat.prev || '—'}%\nTour de taille moyen récent : ${trends.waist.recent || '—'} cm | Période précédente : ${trends.waist.prev || '—'} cm\n\nMESURES BRUTES DES 10 DERNIERS JOURS (pour contexte uniquement) :\n${recentLogs.slice(0,10).map(l => `• ${new Date(l.date).toLocaleDateString('fr-FR')} — Poids: ${l.weight||'—'}kg, Graisse: ${l.bodyFat||'—'}%, Taille: ${l.waist||'—'}cm, Muscle: ${l.muscleMass||'—'}%`).join('\n')}\n\nFais mon bilan du jour en te basant sur les tendances, pas sur les variations d'un seul jour.`;
    try {
      const response = await fetch('/claude_proxy.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }) });
      if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
      const data = await response.json();
      const text = data.content?.[0]?.text || 'Aucune réponse reçue.';
      const today = new Date().toISOString().split('T')[0];
      setAiBilan(text);
      setAiDate(today);
      if (user && db) {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) { await setDoc(doc(db, 'users', user.uid), sanitizeForFirestore({ ...docSnap.data(), aiBilan: { text, date: today } })); }
        } catch(e) { console.error('Erreur sauvegarde bilan IA', e); }
      }
    } catch(e) { setAiError("Impossible de générer le bilan. Vérifiez votre connexion ou le proxy PHP."); console.error('Erreur bilan IA', e); }
    finally { setAiLoading(false); }
  };

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
  
  const filteredLogs = useMemo(() => healthLogs.filter(log => {
    if (!log.date) return false;
    const logDate = new Date(log.date);
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    return logDate >= start && logDate <= end;
  }), [healthLogs, startDate, endDate]);

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

  const chartData = useMemo(() => aggregateHealthData(filteredLogs), [filteredLogs, timeFrame]);
  
  // bpRange pour le graphe tension ; restingHR_bp = FC repos uniquement quand mesuré par le tensiomètre (présence de systolique)
  const safeChartData = useMemo(() => chartData.map(d => ({
    ...d,
    bpRange: (d.systolic && d.diastolic) ? [d.diastolic, d.systolic] : null,
    restingHR_bp: (d.restingHR && d.systolic) ? d.restingHR : null,
  })), [chartData]);

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

  const chartDataWithTrends = useMemo(() => {
    let data = calculateTrendLine(safeChartData, 'weight', 'weightTrend');
    data = calculateTrendLine(data, 'waist', 'waistTrend');
    data = calculateTrendLine(data, 'bodyFat', 'bodyFatTrend');
    data = calculateTrendLine(data, 'visceralFat', 'visceralFatTrend');
    return data;
  }, [safeChartData]);

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
          {isDemo ? (
            <span className="text-xs text-slate-500 italic">Lecture seule en démo</span>
          ) : isSyncingWithings ? (
            <span className="flex items-center gap-2 text-xs text-slate-400"><RefreshCw size={14} className="animate-spin text-violet-400"/> Sync Withings...</span>
          ) : (
            <button onClick={() => onWithingsSync()} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600">
              <RefreshCw size={14} className="text-violet-400"/> Sync Withings
            </button>
          )}
        </div>
        <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${isDemo ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" disabled={isDemo} />
            <input type="text" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Poids (kg)" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" disabled={isDemo} />
            <input type="text" value={waist} onChange={e => setWaist(e.target.value)} placeholder="Tour de taille (cm)" className="bg-slate-900 border border-slate-600 rounded p-2 text-white border-orange-500/50" disabled={isDemo} />
            <input type="text" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="Fat %" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" disabled={isDemo} />
            <input type="text" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} placeholder="Mus %" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" disabled={isDemo} />
            <input type="text" value={hydration} onChange={e => setHydration(e.target.value)} placeholder="Eau %" className="bg-slate-900 border border-slate-600 rounded p-2 text-white" disabled={isDemo} />
            <button onClick={handleSave} disabled={isDemo} className="col-span-2 md:col-span-3 w-full bg-violet-600 text-white font-bold p-2 rounded hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Enregistrer</button>
        </div>
      </div>

      {/* --- CARTES BILAN IA --- */}
      <div className="space-y-4">

        {/* En-tête avec bouton */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
              <span className="text-violet-400">✦</span> Analyse IA du jour
            </h3>
            {aiDate && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {new Date(aiDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {aiDate !== new Date().toISOString().split('T')[0] && <span className="text-orange-400"> — non actualisé aujourd'hui</span>}
              </p>
            )}
          </div>
          <button
            onClick={isDemo ? undefined : generateAiBilan}
            disabled={aiLoading || isDemo}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw size={13} className={aiLoading ? 'animate-spin' : ''} />
            {aiLoading ? 'Analyse...' : aiDate === new Date().toISOString().split('T')[0] ? 'Regénérer' : 'Générer mon bilan'}
          </button>
        </div>

        {/* Chargement */}
        {aiLoading && (
          <div className="bg-slate-800 border border-violet-500/30 rounded-xl flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Claude analyse vos données...</p>
          </div>
        )}

        {/* Erreur */}
        {aiError && !aiLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{aiError}</span>
          </div>
        )}

        {/* État vide */}
        {!aiBilan && !aiLoading && !aiError && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl text-center py-12 text-slate-500">
            <span className="text-4xl block mb-3 text-violet-500/30">✦</span>
            <p className="text-sm">Cliquez sur "Générer mon bilan" pour recevoir<br/>une analyse personnalisée de vos données.</p>
          </div>
        )}

        {/* Contenu en deux cartes */}
        {aiBilan && !aiLoading && (() => {
          // Nettoie le texte : supprime *, #, ** et les numéros de section
          const clean = (text) => text
            .replace(/\*\*/g, '')
            .replace(/^\*\s*/,'')
            .replace(/^#+\s*/,'')
            .replace(/^[-•]\s*/, '')
            .trim();

          // Split sur le séparateur [CONSEILS]
          const parts = aiBilan.split(/\[CONSEILS\]/i);
          const bilanText = parts[0] || '';
          const conseilText = parts[1] || '';
          const bilanLines = bilanText.split('\n').map(l => clean(l)).filter(Boolean);
          const conseilLines = conseilText.split('\n').map(l => clean(l)).filter(Boolean);

          return (
            <>
              {/* Carte 1 — Bilan */}
              <div className="bg-slate-800 border border-violet-500/30 rounded-xl overflow-hidden">
                <div className="bg-violet-500/10 px-5 py-3 border-b border-violet-500/20 flex items-center gap-2">
                  <HeartPulse size={15} className="text-violet-400 shrink-0" />
                  <span className="text-sm font-bold text-violet-300">Bilan du jour</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {bilanLines.map((line, i) => (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>

              {/* Carte 2 — Conseils */}
              {conseilLines.length > 0 && (
                <div className="bg-slate-800 border border-emerald-500/30 rounded-xl overflow-hidden">
                  <div className="bg-emerald-500/10 px-5 py-3 border-b border-emerald-500/20 flex items-center gap-2">
                    <TrendingUp size={15} className="text-emerald-400 shrink-0" />
                    <span className="text-sm font-bold text-emerald-300">Conseils personnalisés</span>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {conseilLines.map((line, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-emerald-500 font-bold text-sm mt-0.5 shrink-0">→</span>
                        <p className="text-slate-300 text-sm leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

      </div>

      <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col gap-4">
        <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Scale className="text-pink-500" /> Santé</h2><div className="flex bg-slate-900/50 p-1 rounded-lg">{['day', 'week', 'month'].map(tf => (<button key={tf} onClick={() => setTimeFrame(tf)} className={`px-3 py-1 rounded text-sm ${timeFrame === tf ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>{tf === 'day' ? 'Jour' : tf === 'week' ? 'Sem.' : 'Mois'}</button>))}</div></div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 bg-slate-900/50 p-2 rounded border border-slate-600"><Filter size={14} className="text-slate-400 shrink-0" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none w-full text-xs" /></div>
          <div className="flex items-center gap-1 bg-slate-900/50 p-2 rounded border border-slate-600"><span className="text-slate-500 text-xs px-1">à</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none w-full text-xs" /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12 gap-3">
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Poids</span><div className="text-xl font-bold text-white mt-1">{latestWeight || '--'} <span className="text-xs text-slate-500">kg</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Tour taille</span><div className="text-xl font-bold text-orange-400 mt-1">{latestWaist || '--'} <span className="text-xs text-slate-500">cm</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Graisse corporelle</span><div className="text-xl font-bold text-yellow-500 mt-1">{latestFat || '--'} <span className="text-xs text-slate-500">%</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Muscle</span><div className="text-xl font-bold text-emerald-500 mt-1">{latestMuscle || '--'} <span className="text-xs text-slate-500">%</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Eau</span><div className="text-xl font-bold text-blue-400 mt-1">{latestHydration || '--'} <span className="text-xs text-slate-500">%</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">FC Repos</span><div className="text-xl font-bold text-red-400 mt-1">{latestRestingHR || '--'} <span className="text-xs text-slate-500">bpm</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Tension</span><div className="text-xl font-bold text-red-400 mt-1">{latestSystolic && latestDiastolic ? `${latestSystolic}/${latestDiastolic}` : '--'} <span className="text-xs text-slate-500">mmHg</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">VOP (PWV)</span><div className="text-xl font-bold text-indigo-400 mt-1">{latestPWV || '--'} <span className="text-xs text-slate-500">m/s</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Graisse visc.</span><div className="text-xl font-bold text-amber-500 mt-1">{latestVisceral || '--'} <span className="text-xs text-slate-500">%</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">BMR</span><div className="text-xl font-bold text-teal-400 mt-1">{latestBMR || '--'} <span className="text-xs text-slate-500">kcal</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Âge vasc.</span><div className="text-xl font-bold text-rose-400 mt-1">{latestVascularAge || '--'} <span className="text-xs text-slate-500">ans</span></div></div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-700 transition-colors"><span className="text-slate-400 text-xs uppercase font-bold tracking-wide">Pas / Dist.</span><div className="text-xl font-bold text-cyan-400 mt-1">{latestSteps || '--'} <span className="text-xs text-slate-500">/ {latestDist || '-'} km</span></div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Poids', from: START_WEIGHT, to: TARGET_WEIGHT, unit: 'kg', progress: weightProgress, lost: lostWeight, lostUnit: 'kg perdus', color: '#8b5cf6' },
          { label: 'Graisse', from: START_FAT, to: TARGET_FAT, unit: '%', progress: fatProgress, lost: lostFat, lostUnit: 'pts perdus', color: '#eab308' },
          { label: 'Tour de taille', from: START_WAIST, to: TARGET_WAIST, unit: 'cm', progress: waistProgress, lost: lostWaist, lostUnit: 'cm perdus', color: '#f97316' },
        ].map(({ label, from, to, unit, progress, lost, lostUnit, color }) => {
          const clampedP = Math.min(100, Math.max(0, progress));
          const gradId = `objGrad-${label.replace(/\s+/g,'-')}`;
          const trackGradId = `objTrack-${label.replace(/\s+/g,'-')}`;
          const pieData = [{ value: clampedP }, { value: 100 - clampedP }];
          return (
            <div key={label} className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Target size={12} className="text-red-400"/> {label}
              </div>
              <div className="relative w-full overflow-hidden" style={{ height: '140px' }}>
                <div className="absolute inset-x-0" style={{ height: '280px', bottom: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={color} stopOpacity={0.2}/>
                          <stop offset="100%" stopColor={color} stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id={trackGradId} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={color} stopOpacity={0.08}/>
                          <stop offset="100%" stopColor={color} stopOpacity={0.18}/>
                        </linearGradient>
                      </defs>
                      {/* Arc de fond (filet coloré) */}
                      <Pie
                        data={[{ value: 100 }]}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="60%"
                        outerRadius="90%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill={`url(#${trackGradId})`} />
                      </Pie>
                      {/* Arc de progression */}
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="60%"
                        outerRadius="90%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill={`url(#${gradId})`} />
                        <Cell fill="transparent" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute inset-0 flex items-end justify-center" style={{ paddingBottom: '12px' }}>
                  <span className="text-3xl font-black block leading-none" style={{ color }}>{clampedP.toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-center -mt-2">
                <div className="text-[11px] text-slate-500">{from}{unit} → {to}{unit}</div>
                <div className="text-[11px] text-slate-300 font-semibold mt-0.5">{lost.toFixed(1)} {lostUnit}</div>
              </div>
            </div>
          );
        })}
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

        // FIX PERF: useMemo sur les régressions
        const regressions = useMemo(() => metrics.map(m => ({
          ...m,
          reg: weightedRegression(healthLogs, m.key),
        })), [healthLogs]);

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
             <div className="h-56">
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
             {latestWeight && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-violet-400">{latestWeight} kg</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestWeight < 60 ? 'bg-blue-500/20 text-blue-400' : latestWeight < 75 ? 'bg-emerald-500/20 text-emerald-400' : latestWeight < 90 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestWeight < 60 ? '⬇ Insuffisant' : latestWeight < 75 ? '✓ Optimal' : latestWeight < 90 ? '⚠ Surpoids' : '⛔ Obésité'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Ruler size={16} className="text-orange-400"/> Tour de taille (cm)</h3>
             <div className="h-56">
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
             {latestWaist && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-orange-400">{latestWaist} cm</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestWaist < 80 ? 'bg-emerald-500/20 text-emerald-400' : latestWaist < 88 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestWaist < 80 ? '✓ Optimal' : latestWaist < 88 ? '⚠ Risque modéré' : '⛔ Risque élevé'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Heart size={16} className="text-red-500"/> Tension Artérielle (mmHg)</h3>
             <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={[40, 180]} allowDataOverflow={true} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Legend wrapperStyle={{fontSize: 10, paddingTop: 10}} />
                        <Bar dataKey="bpRange" fill="#94a3b8" barSize={2} radius={[2, 2, 2, 2]} name="Plage" />
                        <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={0} dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Systolique" isAnimationActive={false}/>
                        <Line type="monotone" dataKey="diastolic" stroke="#8b5cf6" strokeWidth={0} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Diastolique" isAnimationActive={false}/>
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
             {latestSystolic && latestDiastolic && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-red-400">{latestSystolic}</span><span className="text-slate-500">/</span><span className="font-bold text-violet-400">{latestDiastolic}</span> mmHg</span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestSystolic < 120 && latestDiastolic < 80 ? 'bg-emerald-500/20 text-emerald-400' : latestSystolic < 130 && latestDiastolic < 85 ? 'bg-yellow-500/20 text-yellow-400' : latestSystolic < 140 && latestDiastolic < 90 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestSystolic < 120 && latestDiastolic < 80 ? '✓ Optimale' : latestSystolic < 130 && latestDiastolic < 85 ? '✓ Normale' : latestSystolic < 140 && latestDiastolic < 90 ? '⚠ Normale haute' : '⛔ Hypertension'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><HeartPulse size={16} className="text-pink-400"/> FC Repos — tensiomètre (bpm)</h3>
             <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeChartData}>
                        <defs><linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" stopOpacity={0.3}/><stop offset="100%" stopColor="#f472b6" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v} bpm`, 'FC repos (tensiomètre)']} />
                        <Area type="monotone" dataKey="restingHR_bp" stroke="#f472b6" fill="url(#pinkGradient)" strokeWidth={2} name="FC repos — tensiomètre (bpm)" dot={false} connectNulls/>
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
             {latestRestingHR && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-pink-400">{latestRestingHR} bpm</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestRestingHR < 60 ? 'bg-emerald-500/20 text-emerald-400' : latestRestingHR < 70 ? 'bg-cyan-500/20 text-cyan-400' : latestRestingHR < 85 ? 'bg-yellow-500/20 text-yellow-400' : latestRestingHR < 100 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestRestingHR < 60 ? '✓ Athlétique' : latestRestingHR < 70 ? '✓ Excellent' : latestRestingHR < 85 ? '✓ Normal' : latestRestingHR < 100 ? '⚠ Élevé' : '⛔ Tachycardie'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Activity size={16} className="text-cyan-400"/> Vitesse d'Onde de Pouls (m/s)</h3>
             <p className="text-[10px] text-slate-500 mb-3">Seuils adaptés à votre âge (55 ans) — source : Reference Values for Arterial Stiffness, Eur. Heart J. 2010. Plus la valeur est basse, plus vos artères sont souples.</p>
             <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeChartData}>
                        <defs>
                          <linearGradient id="pwvGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={[5, 13]} unit=" m/s" />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v, name) => name === 'Seuil normal (55 ans)' ? [`${v} m/s`, name] : [`${v} m/s`, 'Onde de pouls']} />
                        {/* Seuil à 9 m/s — limite haute du normal pour 50-59 ans */}
                        <Line type="monotone" dataKey={() => 9} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5} dot={false} name="Seuil normal (55 ans)" isAnimationActive={false} />
                        <Area type="monotone" dataKey="pwv" stroke="#22d3ee" fill="url(#pwvGradient)" strokeWidth={2} name="Onde de pouls (m/s)" dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }} connectNulls activeDot={{ r: 5 }}/>
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
             {latestPWV && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-cyan-400">{latestPWV} m/s</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestPWV < 7.5 ? 'bg-emerald-500/20 text-emerald-400' : latestPWV < 9 ? 'bg-cyan-500/20 text-cyan-400' : latestPWV < 10.5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestPWV < 7.5 ? '✓ Optimal' : latestPWV < 9 ? '✓ Normal' : latestPWV < 10.5 ? '⚠ Élevé' : '⛔ Très élevé'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Percent size={16} className="text-yellow-500"/> Graisse Corporelle (%)</h3>
             <div className="h-56">
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
             {latestFat && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-yellow-400">{latestFat} %</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestFat < 18 ? 'bg-blue-500/20 text-blue-400' : latestFat < 25 ? 'bg-emerald-500/20 text-emerald-400' : latestFat < 30 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestFat < 18 ? '⬇ Trop faible' : latestFat < 25 ? '✓ Normal' : latestFat < 30 ? '⚠ Élevé' : '⛔ Obésité'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Dumbbell size={16} className="text-emerald-500"/> Masse Musculaire (%)</h3>
             <div className="h-56">
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
             {latestMuscle && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-emerald-400">{latestMuscle} %</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestMuscle > 40 ? 'bg-emerald-500/20 text-emerald-400' : latestMuscle > 33 ? 'bg-cyan-500/20 text-cyan-400' : latestMuscle > 28 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestMuscle > 40 ? '✓ Athlétique' : latestMuscle > 33 ? '✓ Bon' : latestMuscle > 28 ? '⚠ Faible' : '⛔ Sarcopénie'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Droplet size={16} className="text-blue-400"/> Hydratation (%)</h3>
             <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeChartData}>
                        <defs><linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={1}/><stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis stroke="#94a3b8" tick={{fontSize:10}} domain={[50, 65]} allowDataOverflow={true} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} />
                        <Bar dataKey="hydration" fill="url(#blueGradient)" radius={[4, 4, 0, 0]} name="Eau %" />
                    </BarChart>
                </ResponsiveContainer>
             </div>
             {latestHydration && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-blue-400">{latestHydration} %</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestHydration >= 55 ? 'bg-emerald-500/20 text-emerald-400' : latestHydration >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestHydration >= 55 ? '✓ Bonne hydratation' : latestHydration >= 50 ? '⚠ Limite' : '⛔ Déshydratation'}
                 </span>
               </div>
             )}
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[300px]">
             <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Flame size={16} className="text-amber-500"/> Graisse Viscérale (%)</h3>
             <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataWithTrends}>
                        <defs><linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8}/><stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize:10}} padding={{ left: 10, right: 30 }} />
                        <YAxis domain={safeDomain} allowDataOverflow={true} stroke="#94a3b8" tick={{fontSize:10}} />
                        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} cursor={{fill: '#334155', opacity: 0.4}} formatter={(v) => [`${v}`, 'Graisse viscérale %']} />
                        <Area type="monotone" dataKey="visceralFat" stroke="#f59e0b" fill="url(#amberGradient)" strokeWidth={2} name="Graisse viscérale (%)" dot={false} connectNulls/>
                        <Line type="monotone" dataKey="visceralFatTrend" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Tendance" />
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
             {latestVisceral && (
               <div className="mt-3 flex items-center justify-between text-xs">
                 <span className="text-slate-400">Dernière valeur : <span className="font-bold text-amber-400">{latestVisceral}</span></span>
                 <span className={`font-semibold px-2 py-0.5 rounded-full ${latestVisceral <= 9 ? 'bg-emerald-500/20 text-emerald-400' : latestVisceral <= 14 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                   {latestVisceral <= 9 ? '✓ Normal' : latestVisceral <= 14 ? '⚠ Élevé' : '⛔ Très élevé'}
                 </span>
               </div>
             )}
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
                 {!isDemo && <button onClick={() => deleteEntry(log.id)} className="text-slate-500 hover:text-red-500 p-2"><Trash2 size={16} /></button>}
             </div>
         ))}
      </div>
    </div>
  );
}

// --- SETTINGS VIEW ---
function SettingsView({ user, isWithingsEnabled, handleWithingsAuth, isStravaEnabled, handleStravaAuth, isHuaweiEnabled, handleHuaweiAuth, huaweiNeedsReconnect, withingsNeedsReconnect, hevyApiKey, onSaveHevyApiKey, goals, setGoals, dataSourcePrefs, setDataSourcePrefs, connectedSources, isDemo }) {
  const [hevyKeyInput, setHevyKeyInput] = useState(hevyApiKey || '');
  const [hevyKeySaved, setHevyKeySaved] = useState(false);
  const updateGoal = (key, value) => {
    const num = parseFloat(value);
    if (!isNaN(num)) setGoals(prev => ({ ...prev, [key]: num }));
  };
  return (
    <div className="animate-fade-in space-y-6">
       <div className="text-center text-slate-500 text-xs mb-6">Connecté en tant que {isDemo ? 'Visiteur Démo' : (user?.email || 'Anonyme')}</div>
       
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
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-600/50">
                  <div className="flex items-center gap-3">
                      <div className="bg-[#CF0A2C] text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">H</div>
                      <div><div className="font-bold text-slate-200">Huawei Health</div><div className={`text-xs ${huaweiNeedsReconnect ? 'text-orange-400' : 'text-slate-500'}`}>{huaweiNeedsReconnect ? '⚠ Token expiré' : isHuaweiEnabled ? 'Connecté' : 'Non connecté'}</div></div>
                  </div>
                  <button onClick={handleHuaweiAuth} className={`px-3 py-1 rounded text-xs font-bold ${huaweiNeedsReconnect ? 'bg-orange-500 text-white' : isHuaweiEnabled ? 'bg-green-500/20 text-green-400' : 'bg-[#CF0A2C] text-white'}`}>{huaweiNeedsReconnect ? 'Reconnecter' : isHuaweiEnabled ? 'Actif' : 'Lier'}</button>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-600/50 space-y-3">
                  <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center"><Dumbbell size={16}/></div>
                      <div>
                        <div className="font-bold text-slate-200">Hevy</div>
                        <div className="text-xs text-slate-500">{hevyApiKey ? 'Connecté via API' : 'Non connecté'}</div>
                      </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Clé API personnelle (depuis hevy.com/settings → Developer)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={hevyKeyInput}
                        onChange={e => { setHevyKeyInput(e.target.value); setHevyKeySaved(false); }}
                        placeholder="Collez votre clé API Hevy ici"
                        disabled={isDemo}
                        className={`flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      <button
                        onClick={() => { onSaveHevyApiKey(hevyKeyInput); setHevyKeySaved(true); setTimeout(() => setHevyKeySaved(false), 3000); }}
                        disabled={isDemo || hevyKeyInput === hevyApiKey}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${hevyKeySaved ? 'bg-green-500/20 text-green-400' : 'bg-blue-600 text-white hover:bg-blue-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {hevyKeySaved ? '✓ Sauvé' : 'Sauver'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Nécessite un abonnement Hevy Pro. Chaque utilisateur utilise sa propre clé.</p>
                  </div>
              </div>
          </div>
       </section>

       {connectedSources.length >= 2 && (
       <section className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2"><Filter size={18} className="text-emerald-400"/> Sources de données</h3>
          <p className="text-xs text-slate-500 mb-3">Choisissez la source pour chaque type de donnée.</p>
          <div className="space-y-2">
            {DATA_TYPE_SOURCES.map(({ key, label, sources }) => {
              const available = sources.filter(s => connectedSources.includes(s));
              if (available.length < 2) return null;
              const current = dataSourcePrefs[key] || available[0];
              return (
                <div key={key} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-600/50">
                  <span className="text-sm text-slate-300">{label}</span>
                  <div className="flex gap-1">
                    {available.map(src => (
                      <button key={src} onClick={() => !isDemo && setDataSourcePrefs(p => ({...p, [key]: src}))}
                        className={`px-2 py-1 rounded text-xs font-bold capitalize ${current === src ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                        {src}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
       </section>
       )}

       <section className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2"><Target size={18} className="text-violet-400"/> Objectifs</h3>
          <div className="space-y-4">
            {[
              { label: 'Poids', unit: 'kg', startKey: 'startWeight', targetKey: 'targetWeight', color: 'violet' },
              { label: 'Graisse', unit: '%', startKey: 'startFat', targetKey: 'targetFat', color: 'yellow' },
              { label: 'Tour de taille', unit: 'cm', startKey: 'startWaist', targetKey: 'targetWaist', color: 'orange' },
            ].map(({ label, unit, startKey, targetKey, color }) => (
              <div key={label} className="bg-slate-900/50 p-3 rounded-lg border border-slate-600/50">
                <div className={`text-sm font-bold text-${color}-400 mb-2`}>{label} ({unit})</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Départ</label>
                    <input type="number" value={goals[startKey]} onChange={e => updateGoal(startKey, e.target.value)} disabled={isDemo} className={`w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1 ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Objectif</label>
                    <input type="number" value={goals[targetKey]} onChange={e => updateGoal(targetKey, e.target.value)} disabled={isDemo} className={`w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1 ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-3 text-center">Les modifications sont sauvegardées automatiquement</p>
       </section>
    </div>
  );
}

// --- STRAVA VIEW ---
function EnduranceView({ stravaLogs, onSync, isSyncing, isDemo }) {
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

    // --- Calcul des stats résumé (30 derniers jours) ---
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const recentLogs = safeLogs.filter(a => a.start_date && new Date(a.start_date).getTime() > thirtyDaysAgo);

    const cyclingTypes = ['Ride', 'VirtualRide', 'EBikeRide'];
    const runningTypes = ['Run'];
    const enduranceTypes = [...cyclingTypes, ...runningTypes, 'Swim', 'Rowing', 'VirtualRow', 'Walk', 'Hike'];

    const rowingTypes = ['Rowing', 'VirtualRow'];

    const cyclingLogs = recentLogs.filter(a => cyclingTypes.includes(a.type));
    const runningLogs = recentLogs.filter(a => runningTypes.includes(a.type));
    const rowingLogs = recentLogs.filter(a => rowingTypes.includes(a.type));
    const enduranceLogs = recentLogs.filter(a => enduranceTypes.includes(a.type));

    const sumDistance = (logs) => logs.reduce((s, a) => s + (a.distance || 0), 0);
    const sumDuration = (logs) => logs.reduce((s, a) => s + (a.moving_time || 0), 0);
    const avgSpeed = (logs) => {
        const withSpeed = logs.filter(a => a.average_speed);
        return withSpeed.length > 0 ? withSpeed.reduce((s, a) => s + a.average_speed, 0) / withSpeed.length : 0;
    };
    const avgHR = (logs) => {
        const withHR = logs.filter(a => a.average_heartrate);
        return withHR.length > 0 ? Math.round(withHR.reduce((s, a) => s + a.average_heartrate, 0) / withHR.length) : 0;
    };

    const cyclingDist = sumDistance(cyclingLogs);
    const runningDist = sumDistance(runningLogs);
    const rowingDist = sumDistance(rowingLogs);
    const cyclingDur = sumDuration(cyclingLogs);
    const runningDur = sumDuration(runningLogs);
    const rowingDur = sumDuration(rowingLogs);
    const cyclingSpeed = avgSpeed(cyclingLogs);
    const runningSpeed = avgSpeed(runningLogs);
    const enduranceHR = avgHR(enduranceLogs);

    const formatPace = (speedMs) => {
        if (!speedMs) return '—';
        const paceSecPerKm = 1000 / speedMs;
        const pm = Math.floor(paceSecPerKm / 60);
        const ps = Math.round(paceSecPerKm % 60);
        return `${pm}'${String(ps).padStart(2,'0')}" /km`;
    };

    const summaryCards = [
        { label: 'Cyclisme — Distance', value: cyclingDist ? `${(cyclingDist / 1000).toFixed(1)} km` : '—', icon: <Bike size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
        { label: 'Running — Distance', value: runningDist ? `${(runningDist / 1000).toFixed(1)} km` : '—', icon: <Footprints size={18} />, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
        { label: 'FC moy. endurance', value: enduranceHR ? `${enduranceHR} bpm` : '—', icon: <Heart size={18} />, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
        { label: 'Cyclisme — Durée', value: cyclingDur ? formatDuration(cyclingDur) : '—', icon: <Clock size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
        { label: 'Running — Durée', value: runningDur ? formatDuration(runningDur) : '—', icon: <Clock size={18} />, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
        { label: 'Cyclisme — Vit. moy.', value: cyclingSpeed ? `${(cyclingSpeed * 3.6).toFixed(1)} km/h` : '—', icon: <Bike size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
        { label: 'Running — Allure moy.', value: formatPace(runningSpeed), icon: <Footprints size={18} />, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
        { label: 'Aviron — Distance', value: rowingDist ? `${(rowingDist / 1000).toFixed(1)} km` : '—', icon: <Waves size={18} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
        { label: 'Aviron — Durée', value: rowingDur ? formatDuration(rowingDur) : '—', icon: <Clock size={18} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    ];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><MapIcon size={22} className="text-emerald-400" /> Endurance</h2>
                <button onClick={() => onSync()} disabled={isSyncing || isDemo} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-colors">
                    <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""}/>{isSyncing ? 'Sync...' : 'Synchroniser'}
                </button>
            </div>

            {/* Cartes résumé — 30 derniers jours */}
            <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">30 derniers jours</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {summaryCards.map((card, i) => (
                        <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-4 text-center`}>
                            <div className={`flex items-center justify-center gap-1.5 mb-2 ${card.color}`}>{card.icon}<span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{card.label}</span></div>
                            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Liste des activités */}
            <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Activités récentes</h3>
                {safeLogs.length === 0 ? (
                    <div className="text-center text-slate-500 py-16 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700"><MapIcon size={40} className="mx-auto mb-3 opacity-20"/><p className="font-medium">Aucune activité synchronisée.</p><p className="text-sm mt-1">Cliquez sur "Synchroniser" pour récupérer vos séances.</p></div>
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
        </div>
    );
}

// --- LOGIN SCREEN ---
function VideoOnboarding({ onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const videos = isMobile ? ONBOARDING_VIDEOS_MOBILE : ONBOARDING_VIDEOS_LAPTOP;

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.load();
    }
  }, [currentIndex]);

  const handlePlay = () => {
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  };

  const handleNext = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish();
    }
  };

  const isLast = currentIndex === videos.length - 1;

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <video
        ref={videoRef}
        src={videos[currentIndex]}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={handlePlay}
        onCanPlay={handlePlay}
        preload="auto"
      />
      <div className="absolute bottom-0 left-0 right-0 pb-10 px-6 flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20">
        <div className="flex gap-2 mb-2">
          {videos.map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIndex ? 'bg-violet-400 scale-125' : 'bg-slate-600'}`} />
          ))}
        </div>
        <button
          onClick={handleNext}
          className="w-full max-w-xs bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
        >
          {isLast ? 'Commencer' : 'Suivant'}
          <ArrowRight size={18} />
        </button>
        {!isLast && (
          <button
            onClick={onFinish}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            Passer
          </button>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, onDemo, version }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { setError("Remplissez tous les champs."); return; }
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <img src={biozLogo} alt="BIOZ" className="h-16 mx-auto mb-4" />
        <p className="text-slate-400">Un briefing sport santé quotidien alimenté par toutes tes applications.</p>
        <div className="text-xs text-slate-600 mt-2 font-mono">Version Bêta : 1.0</div>
      </div>
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="votre@email.com"
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-lg active:scale-95"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
      </div>
      <button
        onClick={onDemo}
        className="mt-6 text-violet-400 hover:text-violet-300 text-sm font-medium underline underline-offset-4 transition-colors"
      >
        Essayer la démo
      </button>
    </div>
  );
}

// --- MAIN APP ---
function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);
  const [syncStatus, setSyncStatus] = useState('idle'); 
  
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const [activeTab, setActiveTab] = useState(isMobileDevice ? 'health' : 'dashboard');
  const [healthLogs, setHealthLogs] = useState([]); 
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [isWithingsEnabled, setIsWithingsEnabled] = useState(false);
  const [isStravaEnabled, setIsStravaEnabled] = useState(false); 
  
  // OBJECTIFS (paramétrables depuis l'onglet Params)
  const [goals, setGoals] = useState({
    startWeight: 106, targetWeight: 95,
    startFat: 26, targetFat: 15,
    startWaist: 107, targetWaist: 95,
  });

  // HEVY STATE
  const [hevyWorkouts, setHevyWorkouts] = useState([]);
  const [loadingHevy, setLoadingHevy] = useState(false);
  const [hevyError, setHevyError] = useState(null);           // Erreurs réelles uniquement (rouge)
  const [hevySyncStatus, setHevySyncStatus] = useState(null); // Message de succès (vert)
  const lastHevyFetch = useRef(null);                         // Timestamp du dernier fetch
  const [hevyApiKey, setHevyApiKey] = useState('');            // Clé API Hevy personnelle (per-user)

  // WITHINGS STATE
  const [isSyncingWithings, setIsSyncingWithings] = useState(false);
  const [withingsNeedsReconnect, setWithingsNeedsReconnect] = useState(false);

  // STRAVA STATE
  const [stravaLogs, setStravaLogs] = useState([]);
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [stravaNextSync, setStravaNextSync] = useState(null); // FIX P3: timestamp du prochain auto-sync

  // HUAWEI STATE
  const [isHuaweiEnabled, setIsHuaweiEnabled] = useState(false);
  const [isSyncingHuawei, setIsSyncingHuawei] = useState(false);
  const [huaweiNeedsReconnect, setHuaweiNeedsReconnect] = useState(false);

  // DATA SOURCE PREFERENCES
  const [dataSourcePrefs, setDataSourcePrefs] = useState({});

  const connectedSources = useMemo(() => {
    const s = [];
    if (isWithingsEnabled) s.push('withings');
    if (isHuaweiEnabled) s.push('huawei');
    if (isStravaEnabled) s.push('strava');
    return s;
  }, [isWithingsEnabled, isHuaweiEnabled, isStravaEnabled]);

  const isRemoteUpdate = useRef(false);
  const isDataLoaded = useRef(false); 

  // Reset state quand l'utilisateur change (évite fuite de données entre comptes)
  const prevUserUid = useRef(null);
  useEffect(() => {
    const currentUid = user?.uid || null;
    if (prevUserUid.current !== null && prevUserUid.current !== currentUid) {
      // L'utilisateur a changé (logout ou switch) → reset complet du state
      isDataLoaded.current = false;
      isRemoteUpdate.current = false;
      isWriting.current = false;
      setHealthLogs([]);
      setStravaLogs([]);
      setHevyWorkouts([]);
      setHevyApiKey('');
      setIsWithingsEnabled(false);
      setIsStravaEnabled(false);
      setIsHuaweiEnabled(false);
      setHuaweiNeedsReconnect(false);
      setDataSourcePrefs({});
      setGoals({ startWeight: 106, targetWeight: 95, startFat: 26, targetFat: 15, startWaist: 107, targetWaist: 95 });
      setDataLoaded(false);
      setSyncStatus('idle');
    }
    prevUserUid.current = currentUid;
  }, [user]);

  // Charger la clé API Hevy personnelle depuis Firestore
  useEffect(() => {
    if (!user || !db || isDemo) return;
    const loadHevyKey = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "hevy"));
        if (snap.exists()) {
          setHevyApiKey(snap.data().apiKey || '');
        }
      } catch (e) {
        console.warn("[Hevy] Erreur chargement clé API:", e.message);
      }
    };
    loadHevyKey();
  }, [user, isDemo]);

  // Auth - restauration de session automatique via localStorage
  useEffect(() => {
    if (!auth) { setLoadingAuth(false); return; }
    setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence Error:", e));
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

  // Sauvegarder la clé API Hevy personnelle dans Firestore
  const saveHevyApiKey = async (key) => {
    const trimmed = (key || '').trim();
    setHevyApiKey(trimmed);
    if (!user || !db) return;
    try {
      await setDoc(doc(db, "users", user.uid, "integrations", "hevy"), { apiKey: trimmed, timestamp: Date.now() });
      console.log("[Hevy] Clé API sauvegardée dans Firestore");
    } catch (e) {
      console.error("[Hevy] Erreur sauvegarde clé API:", e.message);
    }
  };

  const fetchHevyWorkouts = async () => {
    setLoadingHevy(true);
    setHevyError(null);
    setHevySyncStatus(null);

    try {
      // --- Récupérer l'historique via l'API Hevy avec la clé personnelle de l'utilisateur ---
      let apiWorkouts = [];
      let apiConfigured = hevyApiKey && hevyApiKey.length > 20;
      let apiError = null;

      console.log(`[Hevy API] Clé configurée: ${apiConfigured}, longueur: ${hevyApiKey?.length || 0}`);

      if (apiConfigured) {
        try {
          let page = 1;
          let hasMore = true;
          while (hasMore && page <= 200) {
            const res = await fetch(
              `${HEVY_CONFIG.apiBase}/workouts?page=${page}&pageSize=10`,
              { headers: { "api-key": hevyApiKey, "accept": "application/json" } }
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
        console.warn("[Hevy API] Clé non configurée — allez dans Paramètres pour renseigner votre clé.");
      }

      // --- Normaliser les données API ---
      const mergedMap = new Map();
      apiWorkouts.forEach(w => {
        const normalized = normalizeWorkout(w);
        if (normalized) mergedMap.set(normalized.id, normalized);
      });

      console.log(`[Hevy] ${mergedMap.size} séances depuis l'API`);

      // --- Merger avec le state Firebase existant ---
      setHevyWorkouts(prevFirebase => {
        const finalMap = new Map();
        prevFirebase.forEach(w => {
          const normalized = normalizeWorkout(w);
          if (normalized) finalMap.set(normalized.id, normalized);
        });
        mergedMap.forEach((w, id) => finalMap.set(id, w));

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
        setHevySyncStatus(`${total} séances chargées depuis l'API Hevy`);
        if (!apiError) setHevyError(null);
        else setHevyError(`⚠ ${apiError}`);
      } else {
        const hint = apiConfigured
          ? "Aucune séance trouvée. Vérifiez la console (F12) pour le détail."
          : "Renseignez votre clé API Hevy dans les Paramètres pour synchroniser vos séances.";
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
    if (isDemo || activeTab !== 'workout') return;
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
        // On ne traite le callback QUE s'il y a un code dans l'URL
        // Si pas de code, on sort immédiatement sans déclencher de synchro
        if (!code) return;
        if (error) { alert(`Erreur Withings: ${error}`); window.history.replaceState({}, document.title, "/"); return; }
        const scope = params.get('scope');
        if (code && user && (!scope || scope.includes('user.metrics'))) {
            // Nettoyer l'URL immédiatement pour éviter un re-déclenchement
            window.history.replaceState({}, document.title, "/");
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
                    setIsWithingsEnabled(true); alert("Compte Withings connecté !");
                    setTimeout(() => handleWithingsSync(tokenData), 1000);
                } else throw new Error(data ? JSON.stringify(data) : "Réponse vide");
            } catch (err) { 
              console.error("Withings auth error:", err);
              alert("Erreur de connexion Withings. Veuillez réessayer depuis les Paramètres.");
            } 
            finally { setIsSyncingWithings(false); }
        }
    };
    if (user && !isDemo) handleWithingsCallback();
  }, [user, isDemo]);

  const handleStartStravaAuth = () => {
     window.location.href = `${STRAVA_CONFIG.authUrl}?client_id=${STRAVA_CONFIG.clientId}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_CONFIG.redirectUri)}&approval_prompt=force&scope=${STRAVA_CONFIG.scope}&state=${generateId()}`;
  };

  const handleStartHuaweiAuth = () => {
     window.location.href = `${HUAWEI_CONFIG.authUrl}?response_type=code&client_id=${HUAWEI_CONFIG.clientId}&state=huawei_${generateId()}&scope=${encodeURIComponent(HUAWEI_CONFIG.scope)}&redirect_uri=${encodeURIComponent(HUAWEI_CONFIG.redirectUri)}&access_type=offline`;
  };
  
  // --- HUAWEI OAUTH CALLBACK ---
  useEffect(() => {
    const handleHuaweiCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      if (!code || !state || !state.startsWith('huawei_')) return;
      window.history.replaceState({}, document.title, "/");
      setIsSyncingHuawei(true);
      try {
        const formData = new URLSearchParams();
        formData.append('grant_type', 'authorization_code');
        formData.append('code', code);
        formData.append('client_id', HUAWEI_CONFIG.clientId);
        formData.append('client_secret', HUAWEI_CONFIG.clientSecret);
        formData.append('redirect_uri', HUAWEI_CONFIG.redirectUri);
        const data = await fetchWithFallback(HUAWEI_CONFIG.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() });
        if (data && data.access_token) {
          const tokenData = { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, token_type: data.token_type, timestamp: Date.now() };
          await setDoc(doc(db, "users", user.uid, "integrations", "huawei"), tokenData);
          await setDoc(doc(db, "users", user.uid), { isHuaweiEnabled: true }, { merge: true });
          setIsHuaweiEnabled(true);
          alert("Huawei Health connecté !");
          setTimeout(() => handleHuaweiSync(tokenData), 1000);
        } else {
          throw new Error(data ? JSON.stringify(data) : "Réponse vide");
        }
      } catch (err) {
        console.error("[Huawei] Auth error:", err);
        alert("Erreur de connexion Huawei Health. Veuillez réessayer depuis les Paramètres.");
      } finally {
        setIsSyncingHuawei(false);
      }
    };
    if (user && !isDemo) handleHuaweiCallback();
  }, [user, isDemo]);

  // --- HUAWEI HEALTH SYNC ---
  const handleHuaweiSync = async (forcedToken = null) => {
    if (!user) return;
    setIsSyncingHuawei(true);
    setHuaweiNeedsReconnect(false);
    try {
      let tokenData = forcedToken;
      if (!tokenData) {
        const tokenSnap = await getDoc(doc(db, "users", user.uid, "integrations", "huawei"));
        if (!tokenSnap.exists()) { setIsSyncingHuawei(false); return; }
        tokenData = tokenSnap.data();
      }
      if (!tokenData) { setIsSyncingHuawei(false); return; }

      // Refresh token si expiré
      const isExpired = tokenData.timestamp && (Date.now() - tokenData.timestamp > (tokenData.expires_in - 300) * 1000);
      if (isExpired) {
        const refreshForm = new URLSearchParams();
        refreshForm.append('grant_type', 'refresh_token');
        refreshForm.append('client_id', HUAWEI_CONFIG.clientId);
        refreshForm.append('client_secret', HUAWEI_CONFIG.clientSecret);
        refreshForm.append('refresh_token', tokenData.refresh_token);
        try {
          const refreshData = await fetchWithFallback(HUAWEI_CONFIG.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: refreshForm.toString() });
          if (refreshData && refreshData.access_token) {
            tokenData = { ...tokenData, access_token: refreshData.access_token, refresh_token: refreshData.refresh_token || tokenData.refresh_token, expires_in: refreshData.expires_in, timestamp: Date.now() };
            await setDoc(doc(db, "users", user.uid, "integrations", "huawei"), tokenData);
          } else {
            console.error("[Huawei] Refresh token invalide, reconnexion nécessaire.");
            setHuaweiNeedsReconnect(true);
            setIsSyncingHuawei(false);
            return;
          }
        } catch (refreshErr) {
          console.error("[Huawei] Erreur refresh token:", refreshErr);
          setHuaweiNeedsReconnect(true);
          setIsSyncingHuawei(false);
          return;
        }
      }

      const authHeaders = { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' };
      const now = Date.now();
      const twoYearsAgo = now - (2 * 365 * 24 * 3600 * 1000);

      // Fetch body weight, body fat, heart rate, activity en parallèle
      const [weightData, bodyCompData, hrData, activityData] = await Promise.all([
        // Body weight
        fetchWithFallback(`${HUAWEI_CONFIG.apiBase}/sampleSet/bodyWeight/query`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ startTime: twoYearsAgo, endTime: now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }).catch(e => { console.warn("[Huawei] Weight fetch error:", e); return null; }),
        // Body composition (fat, muscle, hydration, visceral fat, BMR)
        fetchWithFallback(`${HUAWEI_CONFIG.apiBase}/sampleSet/bodyComposition/query`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ startTime: twoYearsAgo, endTime: now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }).catch(e => { console.warn("[Huawei] Body comp fetch error:", e); return null; }),
        // Resting heart rate
        fetchWithFallback(`${HUAWEI_CONFIG.apiBase}/sampleSet/heartRate/query`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ startTime: twoYearsAgo, endTime: now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }).catch(e => { console.warn("[Huawei] HR fetch error:", e); return null; }),
        // Steps & distance (activity)
        fetchWithFallback(`${HUAWEI_CONFIG.apiBase}/sampleSet/activitySummary/query`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ startTime: twoYearsAgo, endTime: now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }).catch(e => { console.warn("[Huawei] Activity fetch error:", e); return null; })
      ]);

      let newHealthLogs = [...healthLogs];
      let updates = 0;

      const upsertLog = (dateKey, isoDate, fields) => {
        const logIndex = newHealthLogs.findIndex(l => getLocalDateKey(l.date) === dateKey);
        if (logIndex === -1) {
          newHealthLogs.push({ id: generateId(), date: isoDate, ...fields });
          updates++;
        } else {
          const existing = newHealthLogs[logIndex];
          const merged = { ...existing };
          Object.entries(fields).forEach(([k, v]) => { if (v != null) merged[k] = v; });
          newHealthLogs[logIndex] = merged;
          updates++;
        }
      };

      // Process weight data
      if (weightData && weightData.samplePoints) {
        weightData.samplePoints.forEach(p => {
          const date = new Date(p.startTime || p.samplingTime);
          const dateKey = getLocalDateKey(date.toISOString());
          const weight = p.value?.[0]?.floatValue || p.fieldValues?.weight;
          if (weight) upsertLog(dateKey, date.toISOString(), { weight: parseFloat(weight.toFixed(2)) });
        });
      }

      // Process body composition
      if (bodyCompData && bodyCompData.samplePoints) {
        bodyCompData.samplePoints.forEach(p => {
          const date = new Date(p.startTime || p.samplingTime);
          const dateKey = getLocalDateKey(date.toISOString());
          const fields = {};
          const vals = p.value || [];
          vals.forEach(v => {
            if (v.fieldName === 'body_fat_rate' || v.fieldName === 'bodyFat') fields.bodyFat = parseFloat((v.floatValue).toFixed(2));
            if (v.fieldName === 'muscle_mass' || v.fieldName === 'muscleMass') fields.muscleMass = parseFloat((v.floatValue).toFixed(2));
            if (v.fieldName === 'moisture_rate' || v.fieldName === 'moisture') fields.hydration = parseFloat((v.floatValue).toFixed(2));
            if (v.fieldName === 'visceral_fat_level' || v.fieldName === 'visceralFat') fields.visceralFat = parseFloat((v.floatValue).toFixed(1));
            if (v.fieldName === 'basal_metabolism' || v.fieldName === 'bmr') fields.bmr = Math.round(v.floatValue);
          });
          if (Object.keys(fields).length > 0) upsertLog(dateKey, date.toISOString(), fields);
        });
      }

      // Process heart rate
      if (hrData && hrData.samplePoints) {
        hrData.samplePoints.forEach(p => {
          const date = new Date(p.startTime || p.samplingTime);
          const dateKey = getLocalDateKey(date.toISOString());
          const hr = p.value?.[0]?.floatValue || p.value?.[0]?.intValue || p.fieldValues?.restingHeartRate;
          if (hr) upsertLog(dateKey, date.toISOString(), { restingHR: Math.round(hr) });
        });
      }

      // Process activity (steps, distance)
      if (activityData && activityData.samplePoints) {
        activityData.samplePoints.forEach(p => {
          const date = new Date(p.startTime || p.samplingTime);
          const dateKey = getLocalDateKey(date.toISOString());
          const fields = {};
          const vals = p.value || [];
          vals.forEach(v => {
            if (v.fieldName === 'steps' || v.fieldName === 'step') fields.steps = Math.round(v.intValue || v.floatValue);
            if (v.fieldName === 'distance') fields.distance = parseFloat(((v.floatValue || 0) / 1000).toFixed(2));
          });
          if (Object.keys(fields).length > 0) upsertLog(dateKey, date.toISOString(), fields);
        });
      }

      if (updates > 0) {
        newHealthLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        setHealthLogs(newHealthLogs);
      }
    } catch (e) {
      console.error("[Huawei] Sync Error:", e);
    } finally {
      setIsSyncingHuawei(false);
    }
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
    if (user && !isDemo && !isStravaEnabled) handleStravaCallback();
  }, [user, isDemo, isStravaEnabled]);

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

  // Auto-sync Strava au chargement (désactivé sur mobile — bouton manuel disponible)
  const stravaAutoSynced = useRef(false);
  useEffect(() => {
    if (isDemo || !user || !dataLoaded || stravaAutoSynced.current || isMobileDevice) return;
    if (isStravaEnabled) {
      stravaAutoSynced.current = true;
      handleStravaSync();
    }
  }, [user, isStravaEnabled, dataLoaded]);

  // Auto-sync Withings au chargement (désactivé sur mobile — bouton manuel disponible)
  const withingsAutoSynced = useRef(false);
  useEffect(() => {
    if (isDemo || !user || !dataLoaded || withingsAutoSynced.current || isMobileDevice) return;
    if (isWithingsEnabled) {
      withingsAutoSynced.current = true;
      handleWithingsSync();
    }
  }, [user, isWithingsEnabled, dataLoaded]);

  // Auto-sync Huawei au chargement (désactivé sur mobile — bouton manuel disponible)
  const huaweiAutoSynced = useRef(false);
  useEffect(() => {
    if (isDemo || !user || !dataLoaded || huaweiAutoSynced.current || isMobileDevice) return;
    if (isHuaweiEnabled) {
      huaweiAutoSynced.current = true;
      handleHuaweiSync();
    }
  }, [user, isHuaweiEnabled, dataLoaded]);

  // Sync Read (Firebase) - onSnapshot écoute les changements distants
  const isWriting = useRef(false); // Empêche onSnapshot de réagir à nos propres écritures
  useEffect(() => {
    if (isDemo || !user || !db) return;
    setSyncStatus('syncing');
    // Vérifier si l'utilisateur a sa propre clé Hevy avant de charger ses workouts
    let userHasHevyKey = false;
    getDoc(doc(db, "users", user.uid, "integrations", "hevy")).then(snap => {
      userHasHevyKey = snap.exists() && !!snap.data().apiKey;
    }).catch(() => {});

    const unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      // Si c'est nous qui venons d'écrire, on ignore ce snapshot
      if (isWriting.current) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        isRemoteUpdate.current = true;
        setHealthLogs(data.healthLogs || []);
        setIsWithingsEnabled(data.isWithingsEnabled || false);
        setIsStravaEnabled(data.isStravaEnabled || false);
        setIsHuaweiEnabled(data.isHuaweiEnabled || false);
        setStravaLogs(data.stravaLogs || []);
        // Ne charger les workouts Hevy que si l'utilisateur a sa propre clé API
        setHevyWorkouts(userHasHevyKey ? (data.hevyWorkouts || []) : []);
        if (data.goals) setGoals(prev => ({ ...prev, ...data.goals }));
        if (data.dataSourcePrefs) setDataSourcePrefs(data.dataSourcePrefs);
        isDataLoaded.current = true;
        setDataLoaded(true);
        setSyncStatus('idle');
      } else {
        isDataLoaded.current = true;
        setDataLoaded(true);
        setSyncStatus('idle');
      }
    }, (error) => setSyncStatus('error'));
    return () => unsubscribeSnapshot();
  }, [user]);

  // Sync Write (Firebase) - debounce 2s pour éviter les écritures en rafale
  useEffect(() => {
    if (isDemo || !user || !isDataLoaded.current || !db) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    setSyncStatus('syncing');
    const saveData = async () => {
      try {
        isWriting.current = true;
        const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const trimmedHealthLogs = (healthLogs || []).filter(l => l.date && new Date(l.date) >= twelveMonthsAgo);
        const trimmedStravaLogs = (stravaLogs || []).slice(-150);
        const trimmedHevyWorkouts = (hevyWorkouts || []).slice(0, 50);

        const safeData = sanitizeForFirestore({
            healthLogs: trimmedHealthLogs,
            isWithingsEnabled,
            isStravaEnabled,
            isHuaweiEnabled,
            dataSourcePrefs,
            stravaLogs: trimmedStravaLogs,
            hevyWorkouts: trimmedHevyWorkouts,
            goals
        });
        await setDoc(doc(db, "users", user.uid), safeData, { merge: true });
        setSyncStatus('saved'); 
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (e) { 
        console.error("Save Error:", e); 
        setSyncStatus('error'); 
      } finally {
        // On laisse 3s avant de réautoriser onSnapshot à réagir
        setTimeout(() => { isWriting.current = false; }, 3000);
      }
    };
    const timeoutId = setTimeout(saveData, 2000); // debounce 2s au lieu de 500ms
    return () => clearTimeout(timeoutId);
  }, [healthLogs, user, isWithingsEnabled, isStravaEnabled, isHuaweiEnabled, dataSourcePrefs, stravaLogs, hevyWorkouts, goals]);

  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login error:", error);
      let message = "Erreur de connexion.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Email ou mot de passe incorrect.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Trop de tentatives. Réessayez dans quelques minutes.";
      }
      throw new Error(message);
    }
  };

  const handleEnterDemo = () => {
    setIsDemo(true);
    setHealthLogs(DEMO_DATA.healthLogs);
    setStravaLogs(DEMO_DATA.stravaLogs);
    setHevyWorkouts(DEMO_DATA.hevyWorkouts);
    setGoals(DEMO_DATA.goals);
    setDataLoaded(true);
    isDataLoaded.current = true;
  };

  const handleExitDemo = () => {
    setIsDemo(false);
    setHealthLogs([]);
    setStravaLogs([]);
    setHevyWorkouts([]);
    setGoals({ startWeight: 106, targetWeight: 95, startFat: 26, targetFat: 15, startWaist: 107, targetWaist: 95 });
    setDataLoaded(false);
    isDataLoaded.current = false;
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

  if (showSplash || loadingAuth) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <img src={new URL('./picto-transparent.png', import.meta.url).href} alt="BIOZ" className="w-24 h-24 md:w-32 md:h-32" />
    </div>
  );

  if (!user && !isDemo && showOnboarding) {
    return <VideoOnboarding onFinish={() => setShowOnboarding(false)} />;
  }

  if (!user && !isDemo) {
    return <LoginScreen onLogin={handleLogin} onDemo={handleEnterDemo} version={APP_VERSION} />;
  }

  // En mode démo, on bloque toutes les modifications
  const demoNoOp = () => {};
  const demoSetHealthLogs = isDemo ? demoNoOp : setHealthLogs;
  const demoSetGoals = isDemo ? demoNoOp : setGoals;
  const demoFetchHevy = isDemo ? demoNoOp : fetchHevyWorkouts;
  const demoDeleteHevy = isDemo ? demoNoOp : handleDeleteHevyWorkout;
  const demoStravaSync = isDemo ? demoNoOp : handleStravaSync;
  const demoWithingsSync = isDemo ? demoNoOp : handleWithingsSync;
  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return dataLoaded ? <Dashboard healthLogs={healthLogs} stravaLogs={stravaLogs} /> : <div className="flex items-center justify-center h-64 text-slate-500">Chargement...</div>;
      case 'workout': return <HevyView hevyWorkouts={hevyWorkouts} loadingHevy={loadingHevy} fetchHevyWorkouts={demoFetchHevy} hevyError={hevyError} hevySyncStatus={hevySyncStatus} onDeleteWorkout={demoDeleteHevy} isDemo={isDemo} />;
      case 'health': return <HealthTracker user={user} db={db} healthLogs={healthLogs} setHealthLogs={demoSetHealthLogs} isSyncingWithings={isSyncingWithings} onWithingsSync={demoWithingsSync} goals={goals} isDemo={isDemo} />;
      case 'endurance': return <EnduranceView stravaLogs={stravaLogs} onSync={demoStravaSync} isSyncing={isSyncingStrava} isDemo={isDemo} />;
      case 'settings': return <SettingsView user={user} isWithingsEnabled={isDemo || isWithingsEnabled} handleWithingsAuth={isDemo ? demoNoOp : handleStartWithingsAuth} isStravaEnabled={isDemo || isStravaEnabled} handleStravaAuth={isDemo ? demoNoOp : handleStartStravaAuth} isHuaweiEnabled={isDemo || isHuaweiEnabled} handleHuaweiAuth={isDemo ? demoNoOp : handleStartHuaweiAuth} huaweiNeedsReconnect={huaweiNeedsReconnect} withingsNeedsReconnect={false} hevyApiKey={hevyApiKey} onSaveHevyApiKey={isDemo ? demoNoOp : saveHevyApiKey} goals={goals} setGoals={demoSetGoals} dataSourcePrefs={dataSourcePrefs} setDataSourcePrefs={setDataSourcePrefs} connectedSources={connectedSources} isDemo={isDemo} />;
      default: return <div className="flex items-center justify-center h-64 text-slate-500">Chargement...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      {isDemo && (
        <div className="bg-violet-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-3 z-50 relative">
          <span>Mode Démo — Les données affichées sont fictives et aucune modification n'est sauvegardée.</span>
          <button onClick={handleExitDemo} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-bold transition-colors">Quitter la démo</button>
        </div>
      )}
      <header className="bg-slate-800 border-b border-slate-700 p-2 shadow-md sticky top-0 z-30">
        <div className="max-w-[98%] mx-auto flex justify-between items-center">
          <img src={new URL('./BIOZ.png', import.meta.url).href} alt="Bodycontrol" className="h-11" />
          <div className="flex items-center gap-3">
             <button onClick={() => !isDemo && setShowWaterModal(true)} className={`bg-blue-600/20 text-blue-400 p-2 rounded-full hover:bg-blue-600/40 border border-blue-500/50 mr-2 flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-blue-900/20 ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`}><Droplet size={20} fill="currentColor" className="opacity-80"/></button>
             {!isDemo && <div className="text-xs">{syncStatus === 'syncing' && <CloudLightning className="text-yellow-400 animate-pulse" size={20} />}{syncStatus === 'saved' && <Cloud className="text-green-400" size={20} />}{syncStatus === 'error' && <AlertCircle className="text-red-500" size={20} />}{syncStatus === 'idle' && <Cloud className="text-slate-600" size={20} />}</div>}
             <div className="hidden md:flex items-center gap-2 text-sm text-slate-400"><User size={16}/> {isDemo ? 'Visiteur Démo' : (user?.displayName || user?.email || 'Anonyme')}</div>
             {isDemo ? (
               <button onClick={handleExitDemo} className="text-slate-400 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-slate-700"><LogOut size={20} /></button>
             ) : (
               <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-slate-700"><LogOut size={20} /></button>
             )}
          </div>
        </div>
      </header>
      <main className="max-w-[98%] mx-auto p-4 md:p-6">{renderContent()}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-1 pb-safe shadow-2xl z-40">
        <div className="max-w-[98%] mx-auto flex justify-between items-center px-2">
          <NavButton icon={BarChart2} label="Sport" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={Dumbbell} label="Musculation" active={activeTab === 'workout'} onClick={() => setActiveTab('workout')} />
          <NavButton icon={HeartPulse} label="Santé" active={activeTab === 'health'} onClick={() => setActiveTab('health')} />
          <NavButton icon={MapIcon} label="Endurance" active={activeTab === 'endurance'} onClick={() => setActiveTab('endurance')} />
          <NavButton icon={Settings} label="Params" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </nav>
      <WaterModal isOpen={showWaterModal} onClose={() => setShowWaterModal(false)} onAdd={handleAddWater} />
    </div>
  );
}

export default App;