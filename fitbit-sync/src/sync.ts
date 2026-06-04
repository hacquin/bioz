/**
 * Job de synchronisation quotidien : Google Health API (Fitbit Air) → Firestore.
 *
 * Flow :
 *   1. Récupère, pour chaque type, les dataPoints les plus récents (l'API renvoie
 *      en ordre décroissant). On ne pose PAS de filtre serveur (syntaxe AIP-160
 *      fragile par type) : on borne par `maxPages` puis on filtre par date côté
 *      client sur la fenêtre SYNC_DAYS_WINDOW.
 *   2. Parse en métriques quotidiennes (modèle aligné sur Coros pour les champs
 *      communs → fusion front "Google prioritaire").
 *   3. Upsert un doc par jour dans users/{uid}/fitbitDaily/{yyyy-MM-dd}.
 *
 * Lancer : `npm run sync`
 * Prod : cron 0 7 * * * /usr/bin/node /opt/bioz-fitbit-sync/dist/sync.js
 */

import 'dotenv/config';
import { HealthClient } from './healthClient.js';
import {
  parseRestingHeartRate,
  parseHrv,
  parseSpo2,
  parseGlucose,
  parseActiveEnergy,
  parseSteps,
  parseSleep,
  parseNutrition,
  mergeDaily,
  type ParsedStreams,
} from './parsers.js';
import { resolveUserUid, upsertFitbitDaily } from './firestore.js';

const SYNC_DAYS_WINDOW = parseInt(process.env.SYNC_DAYS_WINDOW || '14', 10);

/** "yyyy-MM-dd" il y a N jours (heure locale serveur). */
function dateNDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  const pad = (x: number): string => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Budget de pages par type (pageSize=1000), dimensionné pour couvrir la fenêtre
// sachant que l'API renvoie du plus récent au plus ancien.
const PAGE_BUDGET: Record<string, number> = {
  'daily-resting-heart-rate': 2,
  'heart-rate-variability': 20,
  'oxygen-saturation': 20,
  'blood-glucose': 5,
  'active-energy-burned': 40,
  steps: 40,
  sleep: 3,
  'nutrition-log': 30,
};

async function main(): Promise<void> {
  const startedAt = Date.now();
  const since = dateNDaysAgo(SYNC_DAYS_WINDOW);
  console.log(`🚀 bioz-fitbit-sync — démarrage (${new Date().toISOString()})`);
  console.log(`   fenêtre : ${SYNC_DAYS_WINDOW} jours (depuis ${since})\n`);

  const client = new HealthClient();

  console.log('📥 Récupération des données Google Health…');
  const fetchType = (id: string) => client.listDataPoints(id, { pageSize: 1000, maxPages: PAGE_BUDGET[id] });
  const [rhrPts, hrvPts, spo2Pts, gluPts, energyPts, stepsPts, sleepPts, nutriPts] = await Promise.all([
    fetchType('daily-resting-heart-rate'),
    fetchType('heart-rate-variability'),
    fetchType('oxygen-saturation'),
    fetchType('blood-glucose'),
    fetchType('active-energy-burned'),
    fetchType('steps'),
    fetchType('sleep'),
    fetchType('nutrition-log'),
  ]);
  console.log(
    `   ↳ points: rhr=${rhrPts.length} hrv=${hrvPts.length} spo2=${spo2Pts.length} ` +
      `glucose=${gluPts.length} energy=${energyPts.length} steps=${stepsPts.length} sleep=${sleepPts.length} nutrition=${nutriPts.length}`,
  );

  console.log('🔍 Parsing…');
  const streams: ParsedStreams = {
    rhr: parseRestingHeartRate(rhrPts),
    hrv: parseHrv(hrvPts),
    spo2: parseSpo2(spo2Pts),
    glucose: parseGlucose(gluPts),
    energy: parseActiveEnergy(energyPts),
    steps: parseSteps(stepsPts),
    sleep: parseSleep(sleepPts),
    nutrition: parseNutrition(nutriPts),
  };
  const daily = mergeDaily(streams, since);
  console.log(`   ↳ ${daily.length} jours dans la fenêtre`);

  console.log("🔑 Résolution de l'UID utilisateur…");
  const uid = await resolveUserUid();
  console.log(`   UID = ${uid}`);

  console.log('💾 Écriture dans Firestore…');
  let withData = 0;
  for (const d of daily) {
    await upsertFitbitDaily(uid, d);
    const hasAny =
      d.rhrBpm !== null ||
      d.hrvAvgMs !== null ||
      d.sleepMainMin !== null ||
      d.spo2AvgPct !== null ||
      d.glucoseAvgMgDl !== null ||
      d.activeKcal !== null ||
      d.steps !== null ||
      d.kcalIntake !== null;
    if (hasAny) withData++;
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✅ Sync terminé en ${elapsed}s`);
  console.log(`   - ${daily.length} jours upsertés (${withData} avec données)`);
  console.log(`   - chemin Firestore : users/${uid}/fitbitDaily\n`);
}

main().catch((e: unknown) => {
  console.error('\n❌ Sync échoué :', e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
