/** Relit les derniers docs fitbitDaily pour vérifier les valeurs écrites. */
import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveUserUid } from './firestore.js';

async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json'),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  const uid = await resolveUserUid();
  const snap = await getFirestore()
    .collection('users')
    .doc(uid)
    .collection('fitbitDaily')
    .orderBy('date', 'desc')
    .limit(5)
    .get();
  snap.forEach((d) => {
    const { syncedAt, ...rest } = d.data();
    console.log(JSON.stringify(rest));
  });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
