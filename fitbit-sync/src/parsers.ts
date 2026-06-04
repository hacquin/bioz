/**
 * Parsers des dataPoints JSON de la Google Health API → métriques quotidiennes.
 *
 * Le modèle FitbitDailyMetrics est un SURENSEMBLE de DailyMetrics (Coros) : il
 * reprend les mêmes noms de champs pour les métriques en commun (rhrBpm, hrvAvgMs,
 * sleep*) afin que la couche de fusion front "Google prioritaire" se superpose jour
 * par jour, et ajoute les métriques propres au Fitbit (pas, énergie, SpO2, glycémie).
 *
 * Conventions de date (alignées sur Coros) :
 *   - une nuit de sommeil est attribuée au jour de RÉVEIL (civil date de endTime) ;
 *   - les samples (HRV, SpO2, glycémie) au jour civil du sample ;
 *   - l'énergie au jour civil de l'intervalle ;
 *   - la FC repos au jour porté par le point (déjà quotidien).
 */

import { DATA_TYPES } from './config.js';

export interface FitbitDailyMetrics {
  /** yyyy-MM-dd */
  date: string;

  // --- en commun avec Coros (fusion prioritaire) ---
  rhrBpm: number | null;
  hrvAvgMs: number | null;
  sleepMainMin: number | null;
  sleepDeepPct: number | null;
  sleepLightPct: number | null;
  sleepRemPct: number | null;
  sleepAwakePct: number | null;
  sleepAwakeMin: number | null;
  sleepAwakeCount: number | null;
  sleepStart: string | null; // HH:MM local
  sleepEnd: string | null; // HH:MM local

  // --- propre au Fitbit Air ---
  steps: number | null;
  activeKcal: number | null;
  spo2AvgPct: number | null;
  spo2MinPct: number | null;
  glucoseAvgMgDl: number | null;
  glucoseMinMgDl: number | null;
  glucoseMaxMgDl: number | null;
  glucoseCount: number | null;

  // --- nutrition (Google Health, repas loggés) ---
  kcalIntake: number | null;
  carbsG: number | null;
  fatG: number | null;
  proteinG: number | null;
  // calories par repas
  kcalBreakfast: number | null;
  kcalLunch: number | null;
  kcalDinner: number | null;
  kcalSnack: number | null;
}

type CivilDate = { year: number; month: number; day: number };

const pad = (n: number): string => String(n).padStart(2, '0');

/** {year,month,day} → "yyyy-MM-dd". */
function ymd(d: CivilDate): string {
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

/** Secondes d'un offset "7200s" / "-3600s". */
function offsetSec(offset: string | undefined): number {
  if (!offset) return 0;
  const n = parseInt(offset, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Instant UTC + offset → "yyyy-MM-dd" local. */
function localYmd(utcIso: string, offset: string | undefined): string {
  const d = new Date(new Date(utcIso).getTime() + offsetSec(offset) * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Instant UTC + offset → "HH:MM" local. */
function localHHMM(utcIso: string, offset: string | undefined): string {
  const d = new Date(new Date(utcIso).getTime() + offsetSec(offset) * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Durée en minutes entre deux ISO UTC. */
function durMin(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPoint = any;

// ============================================================================
// FC repos (daily-resting-heart-rate)
// ============================================================================

export function parseRestingHeartRate(points: AnyPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of points) {
    const r = p?.dailyRestingHeartRate;
    if (!r?.date) continue;
    const bpm = parseInt(String(r.beatsPerMinute), 10);
    if (Number.isFinite(bpm)) out.set(ymd(r.date), bpm);
  }
  return out;
}

// ============================================================================
// VFC (heart-rate-variability) — moyenne RMSSD par jour
// ============================================================================

export function parseHrv(points: AnyPoint[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const p of points) {
    const h = p?.heartRateVariability;
    const rmssd = h?.rootMeanSquareOfSuccessiveDifferencesMilliseconds;
    const date = h?.sampleTime?.civilTime?.date;
    if (typeof rmssd !== 'number' || !date) continue;
    const key = ymd(date);
    const cur = acc.get(key) ?? { sum: 0, n: 0 };
    cur.sum += rmssd;
    cur.n += 1;
    acc.set(key, cur);
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) out.set(k, Math.round(v.sum / v.n));
  return out;
}

// ============================================================================
// SpO2 (oxygen-saturation) — moyenne/min par jour, artefacts filtrés
// ============================================================================

const SPO2_MIN_PLAUSIBLE = 70; // en dessous = artefact capteur (vu des 50%)

export function parseSpo2(points: AnyPoint[]): Map<string, { avg: number; min: number }> {
  const acc = new Map<string, { sum: number; n: number; min: number }>();
  for (const p of points) {
    const o = p?.oxygenSaturation;
    const pct = o?.percentage;
    const date = o?.sampleTime?.civilTime?.date;
    if (typeof pct !== 'number' || pct < SPO2_MIN_PLAUSIBLE || !date) continue;
    const key = ymd(date);
    const cur = acc.get(key) ?? { sum: 0, n: 0, min: Infinity };
    cur.sum += pct;
    cur.n += 1;
    cur.min = Math.min(cur.min, pct);
    acc.set(key, cur);
  }
  const out = new Map<string, { avg: number; min: number }>();
  for (const [k, v] of acc) {
    out.set(k, { avg: Math.round((v.sum / v.n) * 10) / 10, min: Math.round(v.min * 10) / 10 });
  }
  return out;
}

// ============================================================================
// Glycémie (blood-glucose) — avg/min/max/count par jour (mg/dL)
// ============================================================================

export function parseGlucose(
  points: AnyPoint[],
): Map<string, { avg: number; min: number; max: number; count: number }> {
  const acc = new Map<string, { sum: number; n: number; min: number; max: number }>();
  // Le même relevé arrive souvent en double (Apple Santé + Fitbit) → dédup sur
  // (instant physique + valeur).
  const seen = new Set<string>();
  for (const p of points) {
    const g = p?.bloodGlucose;
    const mgdl = g?.bloodGlucoseMilligramsPerDeciliter;
    const date = g?.sampleTime?.civilTime?.date;
    if (typeof mgdl !== 'number' || !date) continue;
    const dedupKey = `${g?.sampleTime?.physicalTime}|${mgdl}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const key = ymd(date);
    const cur = acc.get(key) ?? { sum: 0, n: 0, min: Infinity, max: -Infinity };
    cur.sum += mgdl;
    cur.n += 1;
    cur.min = Math.min(cur.min, mgdl);
    cur.max = Math.max(cur.max, mgdl);
    acc.set(key, cur);
  }
  const out = new Map<string, { avg: number; min: number; max: number; count: number }>();
  for (const [k, v] of acc) {
    out.set(k, { avg: Math.round(v.sum / v.n), min: v.min, max: v.max, count: v.n });
  }
  return out;
}

// ============================================================================
// Énergie dépensée (active-energy-burned) — somme kcal par jour
// ============================================================================

export function parseActiveEnergy(points: AnyPoint[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const p of points) {
    // On ne garde que la source bracelet pour éviter le double-comptage avec les
    // calories importées d'autres apps (Apple/Coros) dans Google Health.
    if (p?.dataSource?.platform !== 'FITBIT') continue;
    const e = p?.activeEnergyBurned;
    const kcal = e?.kcal;
    const date = e?.interval?.civilStartTime?.date;
    if (typeof kcal !== 'number' || !date) continue;
    const key = ymd(date);
    acc.set(key, (acc.get(key) ?? 0) + kcal);
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) out.set(k, Math.round(v));
  return out;
}

// ============================================================================
// Pas (steps) — somme par jour, source FITBIT uniquement.
// `count` est renvoyé en CHAÎNE ("24"). Les pas existent en multiples sources
// (Fitbit, Apple, Coros via Apple Santé) : on ne somme que la plateforme FITBIT
// pour ne pas double-compter (cohérent avec "Google prioritaire").
// ============================================================================

export function parseSteps(points: AnyPoint[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const p of points) {
    if (p?.dataSource?.platform !== 'FITBIT') continue;
    const s = p?.steps;
    const interval = s?.interval;
    const date = interval?.civilStartTime?.date
      ? ymd(interval.civilStartTime.date)
      : interval?.startTime
        ? localYmd(interval.startTime, interval.startUtcOffset)
        : null;
    const count = s?.count != null ? Number(s.count) : NaN;
    if (!date || !Number.isFinite(count)) continue;
    acc.set(date, (acc.get(date) ?? 0) + count);
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) out.set(k, Math.round(v));
  return out;
}

// ============================================================================
// Nutrition (nutrition-log) — apport calorique + macros par jour.
// Chaque point = un aliment loggé. On somme par jour civil. Source FITBIT
// uniquement (repas saisis dans Google Health). Protéines dans `nutrients[]`,
// glucides/lipides en champs racine, énergie dans `energy.kcal`.
// ============================================================================

export interface NutritionDay {
  kcal: number;
  carbs: number;
  fat: number;
  protein: number;
  // calories par repas (pour le graphe "Calories par repas")
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

/** Repas cible : mealType explicite, sinon inféré depuis l'heure (ANYTIME = 88% des entrées). */
function mealBucket(mealType: string | undefined, hour: number | null): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  switch (mealType) {
    case 'BREAKFAST': return 'breakfast';
    case 'LUNCH': return 'lunch';
    case 'DINNER': return 'dinner';
    case 'SNACK': return 'snack';
    default:
      if (hour == null) return 'snack';
      if (hour < 11) return 'breakfast';
      if (hour < 15) return 'lunch';
      if (hour < 18) return 'snack';
      if (hour < 23) return 'dinner';
      return 'snack';
  }
}

export function parseNutrition(points: AnyPoint[]): Map<string, NutritionDay> {
  const zero = (): NutritionDay => ({ kcal: 0, carbs: 0, fat: 0, protein: 0, breakfast: 0, lunch: 0, dinner: 0, snack: 0 });
  const acc = new Map<string, NutritionDay>();
  for (const p of points) {
    if (p?.dataSource?.platform !== 'FITBIT') continue;
    const nl = p?.nutritionLog;
    const interval = nl?.interval;
    const date = interval?.civilStartTime?.date
      ? ymd(interval.civilStartTime.date)
      : interval?.startTime
        ? localYmd(interval.startTime, interval.startUtcOffset)
        : null;
    if (!date) continue;
    const cur = acc.get(date) ?? zero();
    const kcal = typeof nl.energy?.kcal === 'number' ? nl.energy.kcal : 0;
    cur.kcal += kcal;
    if (typeof nl.totalCarbohydrate?.grams === 'number') cur.carbs += nl.totalCarbohydrate.grams;
    if (typeof nl.totalFat?.grams === 'number') cur.fat += nl.totalFat.grams;
    if (Array.isArray(nl.nutrients)) {
      const prot = nl.nutrients.find((n: AnyPoint) => n?.nutrient === 'PROTEIN');
      if (typeof prot?.quantity?.grams === 'number') cur.protein += prot.quantity.grams;
    }
    const hour = typeof interval?.civilStartTime?.time?.hours === 'number' ? interval.civilStartTime.time.hours : null;
    cur[mealBucket(nl.mealType, hour)] += kcal;
    acc.set(date, cur);
  }
  const out = new Map<string, NutritionDay>();
  for (const [k, v] of acc) {
    out.set(k, {
      kcal: Math.round(v.kcal),
      carbs: Math.round(v.carbs),
      fat: Math.round(v.fat),
      protein: Math.round(v.protein),
      breakfast: Math.round(v.breakfast),
      lunch: Math.round(v.lunch),
      dinner: Math.round(v.dinner),
      snack: Math.round(v.snack),
    });
  }
  return out;
}

// ============================================================================
// Sommeil (sleep, type=STAGES) — durée + composition par jour de réveil
// ============================================================================

interface SleepDay {
  sleepMainMin: number;
  sleepDeepPct: number;
  sleepLightPct: number;
  sleepRemPct: number;
  sleepAwakePct: number;
  sleepAwakeMin: number;
  sleepAwakeCount: number;
  sleepStart: string;
  sleepEnd: string;
}

function buildSleepDay(sleep: AnyPoint): SleepDay | null {
  const interval = sleep?.interval;
  const stages: AnyPoint[] = Array.isArray(sleep?.stages) ? sleep.stages : [];
  if (!interval?.startTime || !interval?.endTime || stages.length === 0) return null;

  let deep = 0;
  let light = 0;
  let rem = 0;
  let awake = 0;
  let awakeCount = 0;
  for (const st of stages) {
    if (!st?.startTime || !st?.endTime) continue;
    const m = durMin(st.startTime, st.endTime);
    switch (st.type) {
      case 'DEEP':
        deep += m;
        break;
      case 'REM':
        rem += m;
        break;
      case 'AWAKE':
        awake += m;
        if (m > 5) awakeCount += 1;
        break;
      default: // LIGHT, ASLEEP, RESTLESS…
        light += m;
    }
  }
  const asleep = deep + light + rem;
  const total = asleep + awake;
  if (total <= 0) return null;
  const pct = (x: number): number => Math.round((x / total) * 100);

  return {
    sleepMainMin: Math.round(asleep),
    sleepDeepPct: pct(deep),
    sleepLightPct: pct(light),
    sleepRemPct: pct(rem),
    sleepAwakePct: pct(awake),
    sleepAwakeMin: Math.round(awake),
    sleepAwakeCount: awakeCount,
    sleepStart: localHHMM(interval.startTime, interval.startUtcOffset),
    sleepEnd: localHHMM(interval.endTime, interval.endUtcOffset),
  };
}

/** Map jour-de-réveil → SleepDay. En cas de sessions multiples, garde la plus longue. */
export function parseSleep(points: AnyPoint[]): Map<string, SleepDay> {
  const out = new Map<string, SleepDay>();
  for (const p of points) {
    if (p?.dataSource?.platform !== 'FITBIT') continue;
    const sleep = p?.sleep;
    const interval = sleep?.interval;
    if (!interval?.endTime) continue;
    const day = buildSleepDay(sleep);
    if (!day) continue;
    const key = localYmd(interval.endTime, interval.endUtcOffset);
    const existing = out.get(key);
    if (!existing || day.sleepMainMin > existing.sleepMainMin) out.set(key, day);
  }
  return out;
}

// ============================================================================
// Fusion des streams jour par jour
// ============================================================================

export interface ParsedStreams {
  rhr: Map<string, number>;
  hrv: Map<string, number>;
  spo2: Map<string, { avg: number; min: number }>;
  glucose: Map<string, { avg: number; min: number; max: number; count: number }>;
  energy: Map<string, number>;
  steps: Map<string, number>;
  sleep: Map<string, SleepDay>;
  nutrition: Map<string, NutritionDay>;
}

export function mergeDaily(s: ParsedStreams, sinceDate: string): FitbitDailyMetrics[] {
  const allDates = new Set<string>([
    ...s.rhr.keys(),
    ...s.hrv.keys(),
    ...s.spo2.keys(),
    ...s.glucose.keys(),
    ...s.energy.keys(),
    ...s.steps.keys(),
    ...s.sleep.keys(),
    ...s.nutrition.keys(),
  ]);

  const out: FitbitDailyMetrics[] = [];
  for (const date of allDates) {
    if (date < sinceDate) continue;
    const spo2 = s.spo2.get(date);
    const glu = s.glucose.get(date);
    const sleep = s.sleep.get(date);
    const nut = s.nutrition.get(date);
    out.push({
      date,
      rhrBpm: s.rhr.get(date) ?? null,
      hrvAvgMs: s.hrv.get(date) ?? null,
      sleepMainMin: sleep?.sleepMainMin ?? null,
      sleepDeepPct: sleep?.sleepDeepPct ?? null,
      sleepLightPct: sleep?.sleepLightPct ?? null,
      sleepRemPct: sleep?.sleepRemPct ?? null,
      sleepAwakePct: sleep?.sleepAwakePct ?? null,
      sleepAwakeMin: sleep?.sleepAwakeMin ?? null,
      sleepAwakeCount: sleep?.sleepAwakeCount ?? null,
      sleepStart: sleep?.sleepStart ?? null,
      sleepEnd: sleep?.sleepEnd ?? null,
      steps: s.steps.get(date) ?? null,
      activeKcal: s.energy.get(date) ?? null,
      spo2AvgPct: spo2?.avg ?? null,
      spo2MinPct: spo2?.min ?? null,
      glucoseAvgMgDl: glu?.avg ?? null,
      glucoseMinMgDl: glu?.min ?? null,
      glucoseMaxMgDl: glu?.max ?? null,
      glucoseCount: glu?.count ?? null,
      kcalIntake: nut?.kcal ?? null,
      carbsG: nut?.carbs ?? null,
      fatG: nut?.fat ?? null,
      proteinG: nut?.protein ?? null,
      kcalBreakfast: nut?.breakfast ?? null,
      kcalLunch: nut?.lunch ?? null,
      kcalDinner: nut?.dinner ?? null,
      kcalSnack: nut?.snack ?? null,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Petit garde-fou de cohérence : liste les types attendus (debug). */
export const EXPECTED_TYPES = DATA_TYPES.map((d) => d.id);
