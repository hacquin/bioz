/**
 * Init Firebase Admin + écriture des données Fitbit.
 *
 * Structure Firestore (en parallèle de corosDaily, jamais en conflit) :
 *   users/{uid}/fitbitDaily/{yyyy-MM-dd}   ← un doc par jour
 *
 * L'UID est résolu via BIOZ_USER_ID, sinon via BIOZ_USER_EMAIL (Auth Admin).
 * On réutilise la même clé de service Firebase que coros-sync (projet fitness-373b6).
 */

import 'dotenv/config';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { FitbitDailyMetrics } from './parsers.js';

const SERVICE_ACCOUNT_PATH = path.resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json',
);
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error('FIREBASE_PROJECT_ID manquant dans .env');
}

let db: Firestore | null = null;

function getDb(): Firestore {
  if (db) return db;
  if (getApps().length === 0) {
    initializeApp({ credential: cert(SERVICE_ACCOUNT_PATH), projectId: PROJECT_ID });
  }
  db = getFirestore();
  return db;
}

export async function resolveUserUid(): Promise<string> {
  const explicit = process.env.BIOZ_USER_ID;
  if (explicit) return explicit;

  const email = process.env.BIOZ_USER_EMAIL;
  if (!email) {
    throw new Error(
      "Aucun BIOZ_USER_ID ni BIOZ_USER_EMAIL dans .env — ajoute l'un des deux pour identifier l'utilisateur cible.",
    );
  }
  getDb();
  const user = await getAuth().getUserByEmail(email);
  return user.uid;
}

/**
 * Upsert d'un jour. On retire les champs null pour ne pas écraser une donnée
 * partielle déjà présente (merge:true).
 */
export async function upsertFitbitDaily(uid: string, daily: FitbitDailyMetrics): Promise<void> {
  const ref = getDb().collection('users').doc(uid).collection('fitbitDaily').doc(daily.date);
  const data: Record<string, unknown> = { date: daily.date };
  for (const [k, v] of Object.entries(daily)) {
    if (k === 'date') continue;
    if (v === null || v === undefined) continue;
    data[k] = v;
  }
  data.syncedAt = FieldValue.serverTimestamp();
  await ref.set(data, { merge: true });
}
