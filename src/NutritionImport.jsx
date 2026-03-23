import { useState, useRef, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import ReactECharts from 'echarts-for-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- LAZY CARD ---
function LazyCard({ children, height = 300, className = "", style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: '200px' });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={style}>
      {visible ? children : <div style={{ minHeight: height }} className="flex items-center justify-center text-slate-600 text-xs animate-pulse">Chargement...</div>}
    </div>
  );
}

// --- KETO-MOJO DATA (en attente API) ---
const ketoData = [
  { date: '15/11', glucose: 95, ketones: 0.8, gki: 95 / 18.016 / 0.8 },
  { date: '01/12', glucose: 102, ketones: 0.5, gki: 102 / 18.016 / 0.5 },
  { date: '15/12', glucose: 98, ketones: 0.7, gki: 98 / 18.016 / 0.7 },
  { date: '10/01', glucose: 105, ketones: 0.4, gki: 105 / 18.016 / 0.4 },
  { date: '01/02', glucose: 100, ketones: 0.6, gki: 100 / 18.016 / 0.6 },
  { date: '15/02', glucose: 97, ketones: 0.9, gki: 97 / 18.016 / 0.9 },
  { date: '01/03', glucose: 103, ketones: 0.5, gki: 103 / 18.016 / 0.5 },
  { date: '21/03', glucose: 102, ketones: 0.5, gki: 102 / 18.016 / 0.5 },
];
const latestGlucose = 102;
const latestKetones = 0.5;
const latestGKI = parseFloat((latestGlucose / 18.016 / latestKetones).toFixed(1));

// Objectifs macro par défaut (régime cétogène)
const DEFAULT_TARGETS = { carbs: 25, fat: 156, protein: 125, calories: 2500 };

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function buildWeeklyData(nutritionDocs) {
  // Get last 7 days
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = DAY_LABELS[d.getDay()];
    const doc = nutritionDocs.find(n => n.date === key);
    days.push({
      day: label,
      date: key,
      calories: doc?.calories || 0,
      carbs: doc?.carbs || 0,
      fat: doc?.fat || 0,
      protein: doc?.protein || 0,
      petitDej: doc?.petitDej || 0,
      dejeuner: doc?.dejeuner || 0,
      diner: doc?.diner || 0,
      encas: doc?.encas || 0,
      carbsObj: 100, fatObj: 100, protObj: 100,
      carbsPctTarget: doc ? Math.round((doc.carbs || 0) / DEFAULT_TARGETS.carbs * 100) : 0,
      fatPctTarget: doc ? Math.round((doc.fat || 0) / DEFAULT_TARGETS.fat * 100) : 0,
      protPctTarget: doc ? Math.round((doc.protein || 0) / DEFAULT_TARGETS.protein * 100) : 0,
    });
  }
  return days;
}

// --- GAUGE BUILDER ---
function buildGaugeOption(value, min, max, splitNumber, color, formatter) {
  return {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge', radius: '90%',
      progress: { show: true, width: 18, roundCap: true, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: color[0] }, { offset: 1, color: color[1] }] } } },
      axisLine: { lineStyle: { width: 18, color: [[1, '#334155']] }, roundCap: true },
      axisTick: { show: false },
      splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
      axisLabel: { distance: 25, color: '#999', fontSize: 14 },
      anchor: { show: true, showAbove: true, size: 25, itemStyle: { borderWidth: 10 } },
      title: { show: false },
      detail: { valueAnimation: true, fontSize: 46, fontWeight: 400, color: '#f8fafc', offsetCenter: [0, '70%'], formatter: formatter || (v => `${v}`) },
      pointer: { itemStyle: { color: 'auto' } },
      min, max, splitNumber,
      itemStyle: { color: color[1] },
      data: [{ value: Math.min(value, max) }]
    }]
  };
}

// --- SECTION HEADER ---
function SectionHeader({ title }) {
  return (
    <div className="col-span-full">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2">{title}</h2>
    </div>
  );
}

// --- DRAGGABLE CARD GRID SECTION ---
function CardSection({ title, cardIds, cardContent, wideCards = [], dragState, isMobile }) {
  const { dragId, dropTargetId, onDragStart, onDragOver, onDrop, onDragEnd, onDragLeave } = dragState;
  return (
    <>
      <SectionHeader title={title} />
      {cardIds.map(id => {
        const content = cardContent[id];
        if (!content) return null;
        const isDragging = dragId === id;
        const isDropTarget = dropTargetId === id && dragId !== id;
        return (
          <div key={id}
            className={`bg-slate-800 p-4 rounded-xl border-2 shadow-lg transition-all duration-150 flex flex-col ${wideCards.includes(id) ? 'col-span-full xl:col-span-3' : 'min-h-[300px]'} ${isDragging ? 'border-violet-500 opacity-40 scale-95' : isDropTarget ? 'border-violet-400 ring-2 ring-violet-400/30 scale-[1.02]' : 'border-slate-700'}`}
            draggable={!isMobile}
            onDragStart={(e) => onDragStart(e, id)}
            onDragOver={(e) => onDragOver(e, id)}
            onDrop={(e) => onDrop(e, id)}
            onDragEnd={onDragEnd}
            onDragLeave={() => { if (dropTargetId === id) onDragLeave(); }}
            style={!isMobile ? { cursor: isDragging ? 'grabbing' : 'grab' } : {}}
          >
            <LazyCard height={300} className="flex-1 flex flex-col" style={isDragging ? { pointerEvents: 'none' } : {}}>
              {content}
            </LazyCard>
          </div>
        );
      })}
    </>
  );
}


export default function NutritionImport({ user, db, isDemo, demoNutritionDocs }) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // --- DRAG & DROP STATE (per section) ---
  const [macroDragId, setMacroDragId] = useState(null);
  const [macroDropTargetId, setMacroDropTargetId] = useState(null);
  const [ketoDragId, setKetoDragId] = useState(null);
  const [ketoDropTargetId, setKetoDropTargetId] = useState(null);

  const MACRO_DEFAULT = ['n_carbs', 'n_fat', 'n_protein', 'n_weeklyMacros', 'n_weeklyCalories'];
  const KETO_DEFAULT = ['n_ketones', 'n_glucose', 'n_gki', 'n_ketoChart'];

  const [macroCardOrder, setMacroCardOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('bioz_macroCardOrder') || 'null');
      if (saved && Array.isArray(saved)) {
        const missing = MACRO_DEFAULT.filter(id => !saved.includes(id));
        return [...saved.filter(id => MACRO_DEFAULT.includes(id)), ...missing];
      }
    } catch {}
    return MACRO_DEFAULT;
  });
  const [ketoCardOrder, setKetoCardOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('bioz_ketoCardOrder') || 'null');
      if (saved && Array.isArray(saved)) {
        const missing = KETO_DEFAULT.filter(id => !saved.includes(id));
        return [...saved.filter(id => KETO_DEFAULT.includes(id)), ...missing];
      }
    } catch {}
    return KETO_DEFAULT;
  });

  function makeDragHandlers(setOrder, setDragId, setDropTargetId, storageKey) {
    return {
      onDragStart: (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); },
      onDragOver: (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetId(prev => prev !== id ? id : prev); },
      onDrop: (e, targetId) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && targetId && sourceId !== targetId) {
          setOrder(prev => {
            const next = [...prev]; const fromIdx = next.indexOf(sourceId); const toIdx = next.indexOf(targetId);
            if (fromIdx !== -1 && toIdx !== -1) { next.splice(fromIdx, 1); next.splice(toIdx, 0, sourceId); }
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
          });
        }
        setDragId(null); setDropTargetId(null);
      },
      onDragEnd: () => { setDragId(null); setDropTargetId(null); },
      onDragLeave: () => setDropTargetId(null),
    };
  }

  const macroDrag = { dragId: macroDragId, dropTargetId: macroDropTargetId, ...makeDragHandlers(setMacroCardOrder, setMacroDragId, setMacroDropTargetId, 'bioz_macroCardOrder') };
  const ketoDrag = { dragId: ketoDragId, dropTargetId: ketoDropTargetId, ...makeDragHandlers(setKetoCardOrder, setKetoDragId, setKetoDropTargetId, 'bioz_ketoCardOrder') };

  const [todayData, setTodayData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(() => buildWeeklyData([]));

  useEffect(() => {
    if (isDemo && demoNutritionDocs) {
      // Mode démo : utiliser les données fictives
      setWeeklyData(buildWeeklyData(demoNutritionDocs));
      const todayKey = new Date().toISOString().split('T')[0];
      const todayDoc = demoNutritionDocs.find(d => d.date === todayKey);
      if (todayDoc) setTodayData(todayDoc);
      return;
    }
    if (!user || !db) return;
    const fetchNutrition = async () => {
      const today = new Date();
      const docs = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'nutrition', key));
          if (snap.exists()) docs.push(snap.data());
        } catch {}
      }
      setWeeklyData(buildWeeklyData(docs));
      const todayKey = today.toISOString().split('T')[0];
      const todayDoc = docs.find(d => d.date === todayKey);
      if (todayDoc) setTodayData(todayDoc);
    };
    fetchNutrition();
  }, [user, db, isDemo, demoNutritionDocs]);

  // --- COMPUTED VALUES ---
  const carbs = todayData?.carbs || 0;
  const fat = todayData?.fat || 0;
  const protein = todayData?.protein || 0;

  const carbsPct = carbs > 0 ? Math.round(carbs / DEFAULT_TARGETS.carbs * 100) : 0;
  const carbsStatus = carbsPct >= 100 ? { text: `${carbsPct}% de l'objectif`, cls: 'text-red-400' } : carbsPct >= 80 ? { text: `${carbsPct}% de l'objectif`, cls: 'text-yellow-400' } : { text: `${carbsPct}% de l'objectif`, cls: 'text-emerald-400' };
  const fatPct = fat > 0 ? Math.round(fat / DEFAULT_TARGETS.fat * 100) : 0;
  const fatStatus = fatPct >= 80 ? { text: `${fatPct}% de l'objectif`, cls: 'text-emerald-400' } : fatPct >= 50 ? { text: `${fatPct}% de l'objectif`, cls: 'text-cyan-400' } : { text: `${fatPct}% de l'objectif`, cls: 'text-slate-400' };
  const protPct = protein > 0 ? Math.round(protein / DEFAULT_TARGETS.protein * 100) : 0;
  const protStatus = protPct >= 80 ? { text: `${protPct}% de l'objectif`, cls: 'text-emerald-400' } : protPct >= 50 ? { text: `${protPct}% de l'objectif`, cls: 'text-cyan-400' } : { text: `${protPct}% de l'objectif`, cls: 'text-slate-400' };

  const ketoneStatus = latestKetones >= 3.0 ? { text: 'Cétose profonde', cls: 'text-emerald-400' } : latestKetones >= 1.5 ? { text: 'Cétose optimale', cls: 'text-cyan-400' } : latestKetones >= 0.5 ? { text: 'Cétose légère', cls: 'text-[#EBAA6D]' } : { text: 'Pas en cétose', cls: 'text-slate-400' };
  const glucoseStatus = latestGlucose < 70 ? { text: 'Hypoglycémie', cls: 'text-blue-400' } : latestGlucose < 100 ? { text: 'Glycémie normale', cls: 'text-emerald-400' } : latestGlucose < 126 ? { text: 'Pré-diabète', cls: 'text-yellow-400' } : { text: 'Diabète', cls: 'text-red-400' };
  const gkiStatus = latestGKI <= 1 ? { text: 'Cétose thérapeutique', cls: 'text-emerald-400' } : latestGKI <= 3 ? { text: 'Cétose élevée', cls: 'text-cyan-400' } : latestGKI <= 6 ? { text: 'Cétose modérée', cls: 'text-blue-400' } : latestGKI <= 9 ? { text: 'Cétose légère', cls: 'text-yellow-400' } : { text: 'Pas en cétose', cls: 'text-red-400' };

  const gValues = ketoData.map(d => d.glucose);
  const kValues = ketoData.map(d => d.ketones);
  const gMin = Math.floor(Math.min(...gValues) / 3) * 3 - 3;
  const gMax = Math.ceil(Math.max(...gValues) / 3) * 3 + 3;
  const kMax = Math.ceil(Math.max(...kValues) * 2) / 2 + 0.5;

  // --- ALL CARD CONTENT ---
  const allCards = {
    // MACRO CARDS
    n_carbs: (
      <>
        <div className="flex items-baseline gap-2 mb-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">GLUCIDES</h3>
          <span className="text-[10px] text-slate-500">— g / jour</span>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
          <ReactECharts option={buildGaugeOption(Math.round(carbs), 0, DEFAULT_TARGETS.carbs, 5, ['rgba(241,135,1,0)', '#f18701'])} style={{ width: '100%', height: '100%', minHeight: 260 }} opts={{ renderer: 'svg' }} />
        </div>
        <p className={`text-xs font-semibold text-center ${carbsStatus.cls}`}>{carbsStatus.text}</p>
      </>
    ),
    n_fat: (
      <>
        <div className="flex items-baseline gap-2 mb-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">LIPIDES</h3>
          <span className="text-[10px] text-slate-500">— g / jour</span>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
          <ReactECharts option={buildGaugeOption(Math.round(fat), 0, DEFAULT_TARGETS.fat, 4, ['rgba(118,120,237,0)', '#7678ed'])} style={{ width: '100%', height: '100%', minHeight: 260 }} opts={{ renderer: 'svg' }} />
        </div>
        <p className={`text-xs font-semibold text-center ${fatStatus.cls}`}>{fatStatus.text}</p>
      </>
    ),
    n_protein: (
      <>
        <div className="flex items-baseline gap-2 mb-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">PROTÉINES</h3>
          <span className="text-[10px] text-slate-500">— g / jour</span>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
          <ReactECharts option={buildGaugeOption(Math.round(protein), 0, DEFAULT_TARGETS.protein, 5, ['rgba(247,184,1,0)', '#f7b801'])} style={{ width: '100%', height: '100%', minHeight: 260 }} opts={{ renderer: 'svg' }} />
        </div>
        <p className={`text-xs font-semibold text-center ${protStatus.cls}`}>{protStatus.text}</p>
      </>
    ),

    // WEEKLY MACROS % OF TARGET CHART (ECharts custom series for overlapping bars)
    n_weeklyMacros: (() => {
      const days = weeklyData.map(d => d.day);
      const macrosDef = [
        { name: 'Glucides', key: 'carbsPctTarget', color: '#f18701', colorFade: 'rgba(241,135,1,0)', bgColor: 'rgba(241,135,1,0.15)' },
        { name: 'Lipides', key: 'fatPctTarget', color: '#7678ed', colorFade: 'rgba(118,120,237,0)', bgColor: 'rgba(118,120,237,0.15)' },
        { name: 'Protéines', key: 'protPctTarget', color: '#f7b801', colorFade: 'rgba(247,184,1,0)', bgColor: 'rgba(247,184,1,0.15)' },
      ];
      const series = macrosDef.map((m, idx) => ({
        type: 'custom',
        name: m.name,
        renderItem: (_params, api) => {
          const catIdx = api.value(0);
          const val = api.value(1);
          const catW = api.size([1, 0])[0];
          const groupW = catW * 0.75;
          const gap = groupW * 0.05;
          const bW = (groupW - gap * 2) / 3;
          const startX = api.coord([catIdx, 0])[0] - groupW / 2 + idx * (bW + gap);
          const baseY = api.coord([catIdx, 0])[1];
          const top100 = api.coord([catIdx, 100])[1];
          const topVal = api.coord([catIdx, Math.min(val, 120)])[1];
          const r = Math.min(4, bW / 2);
          return {
            type: 'group',
            children: [
              { type: 'rect', shape: { x: startX, y: top100, width: bW, height: baseY - top100, r: [r, r, 0, 0] }, style: { fill: m.bgColor } },
              { type: 'rect', shape: { x: startX, y: topVal, width: bW, height: baseY - topVal, r: [r, r, 0, 0] }, style: { fill: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: m.color }, { offset: 1, color: m.colorFade }] } } },
              { type: 'text', style: { text: `${val}%`, x: startX + bW / 2, y: topVal - 6, fill: '#f1f5f9', fontSize: 10, fontWeight: 600, textAlign: 'center', textVerticalAlign: 'bottom' } },
            ],
          };
        },
        data: weeklyData.map((d, i) => [i, d[m.key]]),
        encode: { x: 0, y: 1 },
      }));

      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9', fontSize: 12 },
          formatter: (params) => {
            let html = `<b>${days[params[0]?.value?.[0]]}</b><br/>`;
            params.forEach(p => {
              const v = p.value[1];
              html += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${macrosDef[p.seriesIndex]?.color};margin-right:6px"></span>${p.seriesName}: <b>${v}%</b><br/>`;
            });
            return html;
          },
        },
        legend: {
          data: macrosDef.map(m => ({ name: m.name, itemStyle: { color: m.color } })),
          bottom: 0,
          textStyle: { color: '#94a3b8', fontSize: 11 },
          icon: 'circle',
          itemWidth: 10, itemHeight: 10,
        },
        grid: { top: 10, right: 10, bottom: 40, left: 45 },
        xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#475569' } }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 13, fontWeight: 600 } },
        yAxis: { type: 'value', max: 140, axisLabel: { color: '#64748b', fontSize: 12, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#334155', type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
        series,
      };
      return (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">RÉSUMÉ HEBDOMADAIRE</h3>
            <span className="text-[10px] text-slate-500">— % de l'objectif</span>
          </div>
          <div className="flex-1" style={{ minHeight: 280 }}>
            <ReactECharts option={option} style={{ width: '100%', height: '100%', minHeight: 280 }} opts={{ renderer: 'svg' }} />
          </div>
        </>
      );
    })(),

    // WEEKLY CALORIES STACKED CHART (ECharts)
    n_weeklyCalories: (() => {
      const days = weeklyData.map(d => d.day);
      const meals = [
        { name: 'Petit déjeuner', key: 'petitDej', color: '#c1272d' },
        { name: 'Déjeuner', key: 'dejeuner', color: '#f5a623' },
        { name: 'Dîner', key: 'diner', color: '#5b8fc9' },
        { name: 'En-cas', key: 'encas', color: '#17344a' },
      ];
      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9', fontSize: 12 },
        },
        legend: {
          data: meals.map(m => m.name),
          bottom: 0,
          textStyle: { color: '#94a3b8', fontSize: 11 },
          icon: 'circle',
          itemWidth: 10, itemHeight: 10,
        },
        grid: { top: 10, right: 10, bottom: 40, left: 45 },
        xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#475569' } }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 13, fontWeight: 600 } },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#64748b', fontSize: 12, formatter: v => v >= 1000 ? `${(v/1000).toFixed(1).replace('.0','')}k` : v },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          axisLine: { show: false }, axisTick: { show: false },
        },
        series: [
          ...meals.map((m, i) => ({
            name: m.name,
            type: 'bar',
            stack: 'calories',
            barWidth: '55%',
            data: weeklyData.map(d => d[m.key]),
            itemStyle: {
              color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: m.color }, { offset: 1, color: m.color + '66' }] },
              borderRadius: i === meals.length - 1 ? [4, 4, 0, 0] : 0,
            },
          })),
          // Ligne objectif kcal
          {
            type: 'line',
            name: `Objectif (${DEFAULT_TARGETS.calories} kcal)`,
            data: days.map(() => DEFAULT_TARGETS.calories),
            symbol: 'none',
            lineStyle: { color: '#94a3b8', width: 2, type: 'dashed' },
            itemStyle: { color: '#94a3b8' },
            z: 10,
          },
        ],
      };
      return (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">RÉSUMÉ HEBDOMADAIRE</h3>
            <span className="text-[10px] text-slate-500">— Calories par repas</span>
          </div>
          <div className="flex-1" style={{ minHeight: 280 }}>
            <ReactECharts option={option} style={{ width: '100%', height: '100%', minHeight: 280 }} opts={{ renderer: 'svg' }} />
          </div>
        </>
      );
    })(),

    // KETO CARDS
    n_ketones: (
      <>
        <div className="flex items-baseline gap-2 mb-0"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">CÉTONES</h3><span className="text-[10px] text-slate-500">— mmol/L</span></div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
          <ReactECharts option={buildGaugeOption(latestKetones, 0, 9, 9, ['#EBAA6D', '#F5D4A6'], v => v.toFixed(1))} style={{ width: '100%', height: '100%', minHeight: 260 }} opts={{ renderer: 'svg' }} />
        </div>
        <p className={`text-xs font-semibold text-center ${ketoneStatus.cls}`}>{ketoneStatus.text}</p>
      </>
    ),
    n_glucose: (
      <>
        <div className="flex items-baseline gap-2 mb-0"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">GLUCOSE</h3><span className="text-[10px] text-slate-500">— mg/dl</span></div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
          <ReactECharts option={buildGaugeOption(latestGlucose, 40, 130, 9, ['#EB1C23', '#F5878B'])} style={{ width: '100%', height: '100%', minHeight: 260 }} opts={{ renderer: 'svg' }} />
        </div>
        <p className={`text-xs font-semibold text-center ${glucoseStatus.cls}`}>{glucoseStatus.text}</p>
      </>
    ),
    n_gki: (
      <>
        <div className="flex items-baseline gap-2 mb-0"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">GKI</h3><span className="text-[10px] text-slate-500">— Indice Glucose-Cétone</span></div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
          <ReactECharts option={buildGaugeOption(latestGKI, 0, 12, 12, ['#271BEB', '#7B75F5'], v => v.toFixed(1))} style={{ width: '100%', height: '100%', minHeight: 260 }} opts={{ renderer: 'svg' }} />
        </div>
        <p className={`text-xs font-semibold text-center ${gkiStatus.cls}`}>{gkiStatus.text}</p>
      </>
    ),
    n_ketoChart: (
      <>
        <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">GLUCOSE & CÉTONES — HISTORIQUE</h3>
            <p className="text-[10px] text-slate-500 mt-1">Source : Keto-Mojo <span className="text-amber-400/70">(en attente API)</span></p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#a1a1aa]"><div className="w-3 h-0.5 bg-[#a1a1aa] rounded"></div><div className="w-2.5 h-2.5 rounded-full bg-[#a1a1aa]"></div> Glucose mg/dl</div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#22d3ee]"><div className="w-3 h-0.5 bg-[#22d3ee] rounded" style={{ borderTop: '2px dashed #22d3ee', height: 0 }}></div><div className="w-2.5 h-2.5 rounded-full bg-[#22d3ee]"></div> Cétones mmol/L</div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ketoData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#475569' }} tickLine={false} />
              <YAxis yAxisId="left" domain={[gMin, gMax]} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, kMax]} tick={{ fill: '#22d3ee', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }} />
              <Area yAxisId="left" type="monotone" dataKey="glucose" fill="#a1a1aa" fillOpacity={0.08} stroke="none" />
              <Line yAxisId="left" type="monotone" dataKey="glucose" stroke="#a1a1aa" strokeWidth={2} dot={{ r: 5, fill: '#a1a1aa', strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0 }} connectNulls name="Glucose sanguin" />
              <Line yAxisId="right" type="monotone" dataKey="ketones" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 5, fill: '#22d3ee', strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0 }} connectNulls name="Cétones sanguines" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </>
    ),
  };

  const MACRO_WIDE = ['n_weeklyMacros', 'n_weeklyCalories'];
  const KETO_WIDE = ['n_ketoChart'];

  // --- COACH NUTRITION (Claude AI) ---
  const [coachAdvice, setCoachAdvice] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');

  const fetchCoachAdvice = async () => {
    setCoachLoading(true);
    setCoachError('');
    try {
      const todayMacros = {
        glucides: Math.round(carbs),
        lipides: Math.round(fat),
        proteines: Math.round(protein),
        objectifs: { glucides: DEFAULT_TARGETS.carbs, lipides: DEFAULT_TARGETS.fat, proteines: DEFAULT_TARGETS.protein, calories: DEFAULT_TARGETS.calories },
      };
      const weekly = weeklyData.map(d => ({ jour: d.day, date: d.date, calories: d.calories, glucides: d.carbs, lipides: d.fat, proteines: d.protein }));
      const keto = { glucose: latestGlucose, cetones: latestKetones, gki: latestGKI };

      const systemPrompt = "Tu es un coach nutrition expert en régime cétogène. Tu donnes des avis personnalisés, directs, motivants et concrets. Tu réponds toujours en français.";
      const userMessage = `Analyse ces données nutritionnelles et donne un avis personnalisé en exactement 4 phrases courtes et percutantes.

Données du jour : ${JSON.stringify(todayMacros)}
Données de la semaine : ${JSON.stringify(weekly)}
Données cétogène : ${JSON.stringify(keto)}

Règles :
- Exactement 4 phrases, pas plus, pas moins
- Sois direct, motivant et concret
- Mentionne les points positifs ET les axes d'amélioration
- Adapte tes conseils au régime cétogène`;

      const res = await fetch('/claude_proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
      });
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
      const data = await res.json();
      setCoachAdvice(data.content?.[0]?.text || 'Aucune réponse.');
    } catch (e) {
      setCoachError("Impossible de générer l'avis. Vérifiez votre connexion ou le proxy PHP.");
      console.error('Erreur coach nutrition IA', e);
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* AVIS DU COACH NUTRITION */}
      <div className="col-span-full bg-gradient-to-r from-slate-800 via-slate-800 to-slate-700 p-5 rounded-xl border-2 border-violet-500/40 shadow-lg shadow-violet-500/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <h2 className="text-sm font-bold text-violet-300 uppercase tracking-widest">Avis du Coach Nutrition</h2>
            <span className="text-[10px] text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Claude AI</span>
          </div>
          <button
            onClick={fetchCoachAdvice}
            disabled={coachLoading}
            className="text-xs bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {coachLoading ? (
              <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Analyse...</>
            ) : coachAdvice ? '🔄 Actualiser' : '✨ Analyser'}
          </button>
        </div>
        {coachError && <p className="text-xs text-red-400 mb-2">{coachError}</p>}
        {coachAdvice ? (
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{coachAdvice}</p>
        ) : !coachLoading && !coachError ? (
          <p className="text-xs text-slate-500 italic">Cliquez sur "Analyser" pour obtenir l'avis personnalisé de votre coach IA basé sur vos données nutritionnelles.</p>
        ) : null}
      </div>
      <CardSection title="Macronutrition du jour" cardIds={macroCardOrder} cardContent={allCards} wideCards={MACRO_WIDE} dragState={macroDrag} isMobile={isMobile} />
      <CardSection title="Régime cétogène" cardIds={ketoCardOrder} cardContent={allCards} wideCards={KETO_WIDE} dragState={ketoDrag} isMobile={isMobile} />
    </div>
  );
}
