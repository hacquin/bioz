/** Lit healthLogs (user doc) et inspecte la série hydratation + régression. */
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
  const snap = await getFirestore().collection('users').doc(uid).get();
  const logs: any[] = (snap.data()?.healthLogs as any[]) || [];
  const hyd = logs
    .filter((l) => l && l.hydration != null && l.date)
    .map((l) => ({ date: String(l.date).slice(0, 10), v: Number(l.hydration) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`hydration points: ${hyd.length}`);
  console.log('min', Math.min(...hyd.map((h) => h.v)), 'max', Math.max(...hyd.map((h) => h.v)));
  console.log('5 premiers:', JSON.stringify(hyd.slice(0, 5)));
  console.log('5 derniers:', JSON.stringify(hyd.slice(-5)));
  // valeurs hors plage plausible (40-70)
  const weird = hyd.filter((h) => h.v < 40 || h.v > 70);
  console.log('valeurs hors [40,70]:', JSON.stringify(weird.slice(0, 20)));
  // OLS sur l'index
  const n = hyd.length;
  const xs = hyd.map((_, i) => i);
  const ys = hyd.map((h) => h.v);
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - m * sx) / n;
  console.log(`OLS sur index: pente=${m.toFixed(4)}/pt, début=${b.toFixed(2)}, fin=${(m * (n - 1) + b).toFixed(2)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
