/**
 * Script d'exploration : dumpe les vraies réponses de la Google Health API pour
 * chaque type de donnée ciblé, afin de découvrir la structure exacte des
 * dataPoints (noms de champs, unités, kind) AVANT d'écrire les parsers.
 *
 * Stratégie :
 *   1. getIdentity() pour confirmer que le token marche et voir l'utilisateur.
 *   2. Pour chaque type : liste SANS filtre (pageSize court) → on voit la forme.
 *      Si l'API exige un filtre temporel, l'erreur nous le dira et on ajustera.
 *
 * Lancer : `npm run inspect`  (après `npm run bootstrap`).
 */

import 'dotenv/config';
import { HealthClient } from './healthClient.js';
import { DATA_TYPES } from './config.js';

const PEEK = 3; // nb de dataPoints à afficher par type

function preview(obj: unknown): string {
  const s = JSON.stringify(obj, null, 2);
  return s.length > 4000 ? s.slice(0, 4000) + '\n   …(tronqué)' : s;
}

async function main(): Promise<void> {
  const client = new HealthClient();

  console.log('🪪  getIdentity()…');
  try {
    const id = await client.getIdentity();
    console.log(preview(id));
  } catch (e) {
    console.log(`   ⚠️ getIdentity a échoué : ${e instanceof Error ? e.message : e}`);
  }

  for (const dt of DATA_TYPES) {
    console.log(`\n========================================`);
    console.log(`📦 ${dt.label}  (dataType="${dt.id}", kind=${dt.kind})`);
    console.log('========================================');
    try {
      const points = await client.listDataPoints(dt.id, { pageSize: PEEK, maxPages: 1 });
      console.log(`   ↳ ${points.length} dataPoint(s) sur la 1re page`);
      points.slice(0, PEEK).forEach((p, i) => {
        console.log(`   --- point #${i} ---`);
        console.log(preview(p));
      });
    } catch (e) {
      console.log(`   ❌ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log('\n✅ Inspection terminée. Copie-colle cette sortie pour qu\'on écrive les parsers.');
}

main().catch((e: unknown) => {
  console.error('\n❌ Inspect échoué :', e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
