/**
 * Constantes partagées pour le daemon Google Health API (Fitbit Air).
 *
 * Contrairement à Coros (Dynamic Client Registration + MCP), Google utilise de
 * l'OAuth 2.0 standard avec des endpoints fixes et un client_id/secret créés
 * manuellement dans la console Google Cloud (type "Application de bureau").
 */

// --- Endpoints OAuth Google (fixes) ---
export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// --- API Health ---
export const API_BASE = 'https://health.googleapis.com/v4';

// --- Scopes (lecture seule). En mode "Test" sur la console, l'utilisateur de test
// (toi) peut consentir sans validation Google malgré le classement "Restricted". ---
export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
];

/**
 * Types de données ciblés (kebab-case = identifiant dans le path REST).
 * `time` = nom du champ racine snake_case utilisé pour filtrer par date
 * (ex: filter "steps.interval.start_time.physical_time >= ...").
 *
 * ⚠️ Les noms de champs de filtre sont à confirmer via `npm run inspect` :
 * on liste d'abord SANS filtre pour voir la vraie structure, puis on ajuste.
 *
 * Nutrition : l'API SERT bien le dataType `nutrition-log` (vérifié — il renvoie 403
 * "scope manquant" et non 400 "type inconnu"), il faut le scope nutrition.readonly.
 *
 * Non encore servis par l'API (juin 2026), donc absents ici :
 *   - score de sommeil (Fitbit) : seuls durée + stades sont exposés
 *   - variation de température cutanée : pas d'équivalent
 */
export const DATA_TYPES = [
  { id: 'steps', label: 'Pas', kind: 'interval' },
  { id: 'active-energy-burned', label: 'Énergie dépensée', kind: 'interval' },
  { id: 'daily-resting-heart-rate', label: 'FC repos', kind: 'daily' },
  { id: 'heart-rate-variability', label: 'VFC (HRV)', kind: 'sample' },
  { id: 'oxygen-saturation', label: 'SpO2', kind: 'sample' },
  { id: 'blood-glucose', label: 'Glycémie', kind: 'sample' },
  { id: 'sleep', label: 'Sommeil', kind: 'session' },
  { id: 'nutrition-log', label: 'Apport calorique', kind: 'log' },
  { id: 'hydration-log', label: 'Hydratation', kind: 'log' },
] as const;

export type DataTypeDef = (typeof DATA_TYPES)[number];
