/**
 * Script de diagnostic : se connecte au serveur MCP Coros, liste les outils
 * disponibles, puis appelle les 4 endpoints qu'on cible (fitness overview, FC repos,
 * HRV, sommeil) sur les 14 derniers jours et affiche les réponses brutes.
 *
 * Utile pour vérifier que :
 *   - Le token Bearer est accepté
 *   - Le serveur MCP répond comme attendu
 *   - On voit le format texte des réponses (input pour les parsers)
 *
 * À lancer : `npx tsx src/inspect.ts`
 */

import { CorosClient } from './corosClient.js';

async function main(): Promise<void> {
  const client = new CorosClient();

  console.log('🔌 Connexion au serveur MCP Coros…');
  await client.connect();

  console.log('\n📋 Liste des outils disponibles :');
  const tools = await client.listTools();
  for (const t of tools) console.log(`   - ${t}`);

  console.log('\n────────────────────────────────────────');
  console.log('🏃 queryFitnessAssessmentOverview');
  console.log('────────────────────────────────────────');
  const fitness = await client.getFitnessAssessmentOverview();
  console.log(fitness.raw);

  console.log('\n────────────────────────────────────────');
  console.log('❤️  queryRestingHeartRate (14j)');
  console.log('────────────────────────────────────────');
  const rhr = await client.getRestingHeartRate(14);
  console.log(rhr.raw);

  console.log('\n────────────────────────────────────────');
  console.log('💓 queryHrvAssessment (14j)');
  console.log('────────────────────────────────────────');
  const hrv = await client.getHrvAssessment(14);
  console.log(hrv.raw);

  console.log('\n────────────────────────────────────────');
  console.log('😴 querySleepData (14j)');
  console.log('────────────────────────────────────────');
  const sleep = await client.getSleepData(14);
  console.log(sleep.raw);

  await client.disconnect();
  console.log('\n✅ Inspection terminée. Connexion fermée proprement.');
}

main().catch((e: unknown) => {
  console.error('\n❌ Inspection échouée :', e instanceof Error ? e.message : e);
  process.exit(1);
});
