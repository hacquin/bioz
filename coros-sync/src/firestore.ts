/**
 * Initialisation du SDK Firebase Admin et helpers d'écriture pour les données Coros.
 *
 * Structure Firestore (mono-user pour l'instant, mais pattern prêt pour du multi-user) :
 *
 *   users/{uid}/corosBaseline/snapshot     ← un seul doc, mis à jour à chaque sync
 *   users/{uid}/corosDaily/{yyyy-MM-dd}    ← un doc par jour
 *
 * L'UID est résolu une seule fois au démarrage du sync soit via BIOZ_USER_ID, soit
 * par recherche via BIOZ_USER_EMAIL (Auth Admin SDK getUserByEmail).
 */

import 'dotenv/config';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { DailyMetrics, BaselineMetrics } from './parsers.js';

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
    initializeApp({
      credential: cert(SERVICE_ACCOUNT_PATH),
      projectId: PROJECT_ID,
    });
  }
  db = getFirestore();
  return db;
}

/**
 * Résout l'UID utilisateur :
 *  - Si BIOZ_USER_ID est dans .env, on l'utilise tel quel.
 *  - Sinon, on cherche via BIOZ_USER_EMAIL en interrogeant Firebase Auth Admin.
 */
export async function resolveUserUid(): Promise<string> {
  const explicit = process.env.BIOZ_USER_ID;
  if (explicit) return explicit;

  const email = process.env.BIOZ_USER_EMAIL;
  if (!email) {
    throw new Error(
      'Aucun BIOZ_USER_ID ni BIOZ_USER_EMAIL dans .env — ajoute l\'un des deux pour identifier l\'utilisateur cible.',
    );
  }

  getDb(); // assure init Firebase
  const user = await getAuth().getUserByEmail(email);
  return user.uid;
}

/**
 * Upsert d'une métrique quotidienne. Fusionne avec le doc existant : un champ
 * "no data" (null) ne va PAS écraser une donnée préexistante.
 */
export async function upsertDailyMetrics(uid: string, daily: DailyMetrics): Promise<void> {
  const ref = getDb().collection('users').doc(uid).collection('corosDaily').doc(daily.date);

  // On retire les champs null pour ne pas écraser des données partielles déjà présentes
  // (ex: un jour où on a sync sleep mais pas encore FC repos).
  const data: Record<string, unknown> = { date: daily.date };
  for (const [k, v] of Object.entries(daily)) {
    if (k === 'date') continue;
    if (v === null || v === undefined) continue;
    data[k] = v;
  }
  data.syncedAt = FieldValue.serverTimestamp();

  await ref.set(data, { merge: true });
}

export async function upsertBaseline(uid: string, baseline: BaselineMetrics): Promise<void> {
  const ref = getDb().collection('users').doc(uid).collection('corosBaseline').doc('snapshot');
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(baseline)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    data[k] = v;
  }
  data.syncedAt = FieldValue.serverTimestamp();
  await ref.set(data, { merge: true });
}
