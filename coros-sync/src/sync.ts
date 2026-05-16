/**
 * Job de synchronisation quotidien : Coros MCP -> Firestore.
 *
 * Flow :
 *   1. Connecte au serveur MCP Coros (avec refresh OAuth automatique).
 *   2. Récupère 4 endpoints (Fitness Overview, RHR, HRV, Sleep) sur SYNC_DAYS_WINDOW
 *      jours (14 par défaut, fenêtre overlap pour rattraper les jours en retard).
 *   3. Parse les réponses texte en métriques structurées.
 *   4. Résout l'UID utilisateur dans Firebase Auth.
 *   5. Upsert :
 *        - 1 doc par jour dans users/{uid}/corosDaily/{yyyy-MM-dd}
 *        - 1 doc snapshot dans users/{uid}/corosBaseline/snapshot
 *   6. Affiche un récap (X jours sync, Y trous, Z baseline).
 *
 * À lancer manuellement : `npm run sync`
 * En prod : cron 0 6 * * * /usr/bin/node /opt/bioz-coros-sync/dist/sync.js
 */

import 'dotenv/config';
import { CorosClient } from './corosClient.js';
import {
  parseFitnessOverview,
  parseHrvAssessment,
  parseRestingHeartRate,
  parseSleepData,
  parseStressLevel,
  mergeDailyMetrics,
  type BaselineMetrics,
} from './parsers.js';
import { resolveUserUid, upsertBaseline, upsertDailyMetrics } from './firestore.js';

const SYNC_DAYS_WINDOW = parseInt(process.env.SYNC_DAYS_WINDOW || '14', 10);

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`🚀 bioz-coros-sync — démarrage (${new Date().toISOString()})`);
  console.log(`   fenêtre : ${SYNC_DAYS_WINDOW} jours\n`);

  // 1. Connexion MCP
  const client = new CorosClient();
  await client.connect();
  console.log('🔌 Connecté au serveur MCP Coros');

  // 2. Récupération parallèle des 5 endpoints
  console.log('📥 Récupération des données...');
  const [fitness, rhr, hrv, sleep, stress] = await Promise.all([
    client.getFitnessAssessmentOverview(),
    client.getRestingHeartRate(SYNC_DAYS_WINDOW),
    client.getHrvAssessment(SYNC_DAYS_WINDOW),
    client.getSleepData(SYNC_DAYS_WINDOW),
    client.getStressLevel(SYNC_DAYS_WINDOW),
  ]);
  await client.disconnect();

  // 3. Parsing
  console.log('🔍 Parsing des réponses...');
  const overviewParsed = parseFitnessOverview(fitness.raw);
  const rhrMap = parseRestingHeartRate(rhr.raw);
  const hrvParsed = parseHrvAssessment(hrv.raw);
  const sleepMap = parseSleepData(sleep.raw);
  const stressMap = parseStressLevel(stress.raw);

  const baseline: BaselineMetrics = {
    vo2max: overviewParsed.vo2max,
    thresholdPaceSecPerKm: overviewParsed.thresholdPaceSecPerKm,
    racePredictions: overviewParsed.racePredictions,
    hrvBaselineMs: hrvParsed.baseline.hrvBaselineMs,
    hrvRangeMinMs: hrvParsed.baseline.hrvRangeMinMs,
    hrvRangeMaxMs: hrvParsed.baseline.hrvRangeMaxMs,
  };

  const daily = mergeDailyMetrics(rhrMap, hrvParsed.daily, sleepMap, stressMap);

  console.log(`   - Baseline : VO2max=${baseline.vo2max ?? '∅'}, seuil=${baseline.thresholdPaceSecPerKm ?? '∅'}s/km, HRV baseline=${baseline.hrvBaselineMs ?? '∅'}ms`);
  console.log(`   - Jours parsés : ${daily.length}`);

  // 4. Résolution UID
  console.log('🔑 Résolution de l\'UID utilisateur...');
  const uid = await resolveUserUid();
  console.log(`   UID = ${uid}`);

  // 5. Écriture Firestore
  console.log('💾 Écriture dans Firestore...');
  await upsertBaseline(uid, baseline);
  let withData = 0;
  let empty = 0;
  for (const d of daily) {
    await upsertDailyMetrics(uid, d);
    const hasAny =
      d.rhrBpm !== null ||
      d.hrvAvgMs !== null ||
      d.sleepScore !== null ||
      d.sleepMainMin !== null ||
      d.napsTotalMin > 0;
    if (hasAny) withData++; else empty++;
  }

  // 6. Récap
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✅ Sync terminé en ${elapsed}s`);
  console.log(`   - 1 baseline upserté`);
  console.log(`   - ${daily.length} jours upsertés (${withData} avec données, ${empty} jours "no data")`);
  console.log(`   - chemin Firestore : users/${uid}/corosDaily + users/${uid}/corosBaseline\n`);
}

main().catch((e: unknown) => {
  console.error('\n❌ Sync échoué :', e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
