/**
 * Parsers pour les réponses texte du MCP Coros.
 *
 * Les outils Coros renvoient du texte structuré (pas du JSON) avec un format stable
 * que l'on extrait via regex simples. Tout est tolérant aux trous (No data, jours
 * absents, valeurs négatives comme Sleep Score: -1 = invalide).
 */

export type HrvEvaluation = 'normal' | 'below_normal' | 'above_normal';
export type StressLevel = 'relaxed' | 'low' | 'medium' | 'high';

export interface DailyMetrics {
  /** yyyy-MM-dd */
  date: string;
  rhrBpm: number | null;
  hrvAvgMs: number | null;
  hrvEvaluation: HrvEvaluation | null;
  stressAvg: number | null;
  stressLevel: StressLevel | null;
  sleepScore: number | null;
  sleepMainMin: number | null;
  sleepDeepPct: number | null;
  sleepLightPct: number | null;
  sleepRemPct: number | null;
  sleepAwakePct: number | null;
  sleepAwakeMin: number | null;
  sleepAwakeCount: number | null;
  /** HH:MM (local) */
  sleepStart: string | null;
  /** HH:MM (local) */
  sleepEnd: string | null;
  napsTotalMin: number;
  napStart: string | null;
  napEnd: string | null;
}

export interface BaselineMetrics {
  vo2max: number | null;
  thresholdPaceSecPerKm: number | null;
  /** Prédictions race en secondes ("5k" -> sec). Vide si pas dispo. */
  racePredictions: Record<string, number>;
  hrvBaselineMs: number | null;
  hrvRangeMinMs: number | null;
  hrvRangeMaxMs: number | null;
}

/** Convertit "5h 45min" / "1h 8min" / "39min" en minutes. */
function parseDurationToMin(s: string): number | null {
  const m = s.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/);
  if (!m) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h === 0 && min === 0 && !s.match(/\d/)) return null;
  return h * 60 + min;
}

/** Convertit "4:45" (m:ss) en secondes. */
function parsePaceToSec(s: string): number | null {
  const m = s.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function hrvEvaluationFromLabel(label: string): HrvEvaluation | null {
  const l = label.trim().toLowerCase();
  if (l === 'normal') return 'normal';
  if (l === 'below normal') return 'below_normal';
  if (l === 'above normal') return 'above_normal';
  return null;
}

// ============================================================================
// parseFitnessOverview
// ============================================================================

export function parseFitnessOverview(raw: string): Pick<BaselineMetrics, 'vo2max' | 'thresholdPaceSecPerKm' | 'racePredictions'> {
  const out: Pick<BaselineMetrics, 'vo2max' | 'thresholdPaceSecPerKm' | 'racePredictions'> = {
    vo2max: null,
    thresholdPaceSecPerKm: null,
    racePredictions: {},
  };

  const vo2 = raw.match(/VO2\s*max\s*:\s*([\d.]+)/i);
  if (vo2) out.vo2max = parseFloat(vo2[1]);

  const tp = raw.match(/Threshold\s+Pace\s*:\s*(\d+:\d{2})/i);
  if (tp) out.thresholdPaceSecPerKm = parsePaceToSec(tp[1]);

  // Prédictions de course, ex : "5K Predicted Time: 23:15" ou "Half-Marathon: 1:42:30"
  // On extrait toute ligne contenant Predicted ou Race.
  const lines = raw.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(5K|10K|Half[- ]?Marathon|Marathon)[\s\w]*[:\-]\s*((?:\d+:)?\d+:\d{2})/i);
    if (m) {
      const key = m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
      const parts = m[2].split(':').map((n) => parseInt(n, 10));
      let sec = 0;
      if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
      out.racePredictions[key] = sec;
    }
  }

  return out;
}

// ============================================================================
// parseRestingHeartRate
// ============================================================================

/** Retourne map date (yyyy-MM-dd) -> bpm ou null si "No data". */
export function parseRestingHeartRate(raw: string): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const re = /^(\d{4}-\d{2}-\d{2})\s*:\s*(?:(\d+)\s*bpm|No\s+data)\s*$/gim;
  for (const m of raw.matchAll(re)) {
    out.set(m[1], m[2] ? parseInt(m[2], 10) : null);
  }
  return out;
}

// ============================================================================
// parseHrvAssessment
// ============================================================================

export interface HrvParseResult {
  baseline: Pick<BaselineMetrics, 'hrvBaselineMs' | 'hrvRangeMinMs' | 'hrvRangeMaxMs'>;
  daily: Map<string, { avgMs: number; evaluation: HrvEvaluation | null } | null>;
}

export function parseHrvAssessment(raw: string): HrvParseResult {
  const baseline: HrvParseResult['baseline'] = {
    hrvBaselineMs: null,
    hrvRangeMinMs: null,
    hrvRangeMaxMs: null,
  };
  const daily = new Map<string, { avgMs: number; evaluation: HrvEvaluation | null } | null>();

  const range = raw.match(/Normal\s+Range\s*:\s*(\d+)\s*-\s*(\d+)\s*ms/i);
  if (range) {
    baseline.hrvRangeMinMs = parseInt(range[1], 10);
    baseline.hrvRangeMaxMs = parseInt(range[2], 10);
  }
  const base = raw.match(/Baseline\s*:\s*(\d+)\s*ms/i);
  if (base) baseline.hrvBaselineMs = parseInt(base[1], 10);

  // Format :
  //   2026-05-14:
  //     HRV Avg: 54 ms — Normal
  //   2026-05-03:
  //     No data
  const sectionRe = /^(\d{4}-\d{2}-\d{2})\s*:\s*\n\s+(?:HRV\s+Avg\s*:\s*(\d+)\s*ms(?:\s*[—\-]\s*(.+?))?|No\s+data)\s*$/gim;
  for (const m of raw.matchAll(sectionRe)) {
    const date = m[1];
    if (m[2]) {
      daily.set(date, {
        avgMs: parseInt(m[2], 10),
        evaluation: m[3] ? hrvEvaluationFromLabel(m[3]) : null,
      });
    } else {
      daily.set(date, null);
    }
  }
  return { baseline, daily };
}

// ============================================================================
// parseStressLevel
// ============================================================================

/**
 * Format Coros :
 *   2026-05-16:
 *   Average Stress: 16 (Relaxed)
 *   ...
 */
export function parseStressLevel(raw: string): Map<string, { avg: number; level: StressLevel } | null> {
  const out = new Map<string, { avg: number; level: StressLevel } | null>();
  const re = /^(\d{4}-\d{2}-\d{2})\s*:\s*\n\s*Average\s+Stress\s*:\s*(\d+)\s*\((Relaxed|Low|Medium|High)\)/gim;
  for (const m of raw.matchAll(re)) {
    out.set(m[1], {
      avg: parseInt(m[2], 10),
      level: m[3].toLowerCase() as StressLevel,
    });
  }
  return out;
}

// ============================================================================
// parseSleepData
// ============================================================================

export interface SleepDay {
  sleepScore: number | null;
  sleepMainMin: number | null;
  sleepDeepPct: number | null;
  sleepLightPct: number | null;
  sleepRemPct: number | null;
  sleepAwakePct: number | null;
  sleepAwakeMin: number | null;
  sleepAwakeCount: number | null;
  sleepStart: string | null;
  sleepEnd: string | null;
  napsTotalMin: number;
  napStart: string | null;
  napEnd: string | null;
}

const EMPTY_SLEEP_DAY: SleepDay = {
  sleepScore: null,
  sleepMainMin: null,
  sleepDeepPct: null,
  sleepLightPct: null,
  sleepRemPct: null,
  sleepAwakePct: null,
  sleepAwakeMin: null,
  sleepAwakeCount: null,
  sleepStart: null,
  sleepEnd: null,
  napsTotalMin: 0,
  napStart: null,
  napEnd: null,
};

export function parseSleepData(raw: string): Map<string, SleepDay> {
  const out = new Map<string, SleepDay>();

  // On split par bloc de date. Chaque bloc commence par "yyyy-MM-dd" en début de
  // ligne, et finit avant la prochaine date (ou la fin du texte).
  const blockRe = /^(\d{4}-\d{2}-\d{2})\s*$/gm;
  const matches: Array<{ date: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(raw)) !== null) {
    matches.push({ date: m[1], start: m.index + m[0].length, end: -1 });
  }
  for (let i = 0; i < matches.length; i++) {
    matches[i].end = i + 1 < matches.length ? matches[i + 1].start - 11 : raw.length;
  }

  for (const { date, start, end } of matches) {
    const block = raw.slice(start, end);
    const day: SleepDay = { ...EMPTY_SLEEP_DAY };

    const score = block.match(/Sleep\s+Score\s*:\s*(-?\d+)/i);
    if (score) {
      const v = parseInt(score[1], 10);
      day.sleepScore = v < 0 ? null : v; // -1 = invalide chez Coros
    }
    const main = block.match(/Main\s+Sleep\s*:\s*((?:\d+\s*h\s*)?(?:\d+\s*min)?)/i);
    if (main) day.sleepMainMin = parseDurationToMin(main[1]);

    const deep = block.match(/Deep\s+Sleep\s+Ratio\s*:\s*(\d+)\s*%/i);
    if (deep) day.sleepDeepPct = parseInt(deep[1], 10);
    const light = block.match(/Light\s+Sleep\s+Ratio\s*:\s*(\d+)\s*%/i);
    if (light) day.sleepLightPct = parseInt(light[1], 10);
    const rem = block.match(/REM\s+Ratio\s*:\s*(\d+)\s*%/i);
    if (rem) day.sleepRemPct = parseInt(rem[1], 10);
    const awakePct = block.match(/Awake\s+Ratio\s*:\s*(\d+)\s*%/i);
    if (awakePct) day.sleepAwakePct = parseInt(awakePct[1], 10);
    const awakeTime = block.match(/Awake\s+Time\s*:\s*(\d+)\s*min/i);
    if (awakeTime) day.sleepAwakeMin = parseInt(awakeTime[1], 10);
    const awakeCount = block.match(/Awake\s+Count\s*\(>5\s*min\)\s*:\s*(\d+)/i);
    if (awakeCount) day.sleepAwakeCount = parseInt(awakeCount[1], 10);

    const mainWin = block.match(/Main\s+Sleep\s+Window\s*:\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/i);
    if (mainWin) {
      day.sleepStart = mainWin[1];
      day.sleepEnd = mainWin[2];
    }

    const napTotal = block.match(/Naps?\s+Total\s*:\s*((?:\d+\s*h\s*)?(?:\d+\s*min)?)/i);
    if (napTotal) {
      const parsed = parseDurationToMin(napTotal[1]);
      day.napsTotalMin = parsed ?? 0;
    }
    const napWin = block.match(/Nap\s+Window\s*:\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/i);
    if (napWin) {
      day.napStart = napWin[1];
      day.napEnd = napWin[2];
    }

    out.set(date, day);
  }
  return out;
}

// ============================================================================
// mergeDaily — fusionne les 3 streams jour par jour
// ============================================================================

export function mergeDailyMetrics(
  rhr: Map<string, number | null>,
  hrv: Map<string, { avgMs: number; evaluation: HrvEvaluation | null } | null>,
  sleep: Map<string, SleepDay>,
  stress: Map<string, { avg: number; level: StressLevel } | null>,
): DailyMetrics[] {
  const allDates = new Set<string>([...rhr.keys(), ...hrv.keys(), ...sleep.keys(), ...stress.keys()]);
  const out: DailyMetrics[] = [];
  for (const date of allDates) {
    const sleepDay = sleep.get(date) ?? EMPTY_SLEEP_DAY;
    const hrvDay = hrv.get(date);
    const stressDay = stress.get(date);
    out.push({
      date,
      rhrBpm: rhr.get(date) ?? null,
      hrvAvgMs: hrvDay?.avgMs ?? null,
      hrvEvaluation: hrvDay?.evaluation ?? null,
      stressAvg: stressDay?.avg ?? null,
      stressLevel: stressDay?.level ?? null,
      sleepScore: sleepDay.sleepScore,
      sleepMainMin: sleepDay.sleepMainMin,
      sleepDeepPct: sleepDay.sleepDeepPct,
      sleepLightPct: sleepDay.sleepLightPct,
      sleepRemPct: sleepDay.sleepRemPct,
      sleepAwakePct: sleepDay.sleepAwakePct,
      sleepAwakeMin: sleepDay.sleepAwakeMin,
      sleepAwakeCount: sleepDay.sleepAwakeCount,
      sleepStart: sleepDay.sleepStart,
      sleepEnd: sleepDay.sleepEnd,
      napsTotalMin: sleepDay.napsTotalMin,
      napStart: sleepDay.napStart,
      napEnd: sleepDay.napEnd,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
