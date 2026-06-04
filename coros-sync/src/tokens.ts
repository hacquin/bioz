/**
 * Gestion des tokens OAuth Coros.
 * - Chargement / sauvegarde depuis tokens.json (gitignored).
 * - Refresh automatique via le refresh_token quand l'access_token approche l'expiration.
 *
 * Le serveur Coros peut faire de la "rotating refresh token" : à chaque refresh, il
 * renvoie un nouveau refresh_token qui invalide le précédent. On le sauvegarde donc
 * systématiquement.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const TOKENS_PATH = path.resolve('tokens.json');
const REFRESH_MARGIN_MS = 60_000; // refresh si < 1 min restante

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
  obtained_at?: string;
}

interface TokenEndpointResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function loadTokens(): Promise<StoredTokens> {
  try {
    const content = await fs.readFile(TOKENS_PATH, 'utf8');
    return JSON.parse(content) as StoredTokens;
  } catch (e) {
    throw new Error(
      `Impossible de lire ${TOKENS_PATH}. As-tu lancé \`npm run bootstrap\` ?\n` +
      `Détail: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

async function refreshAccessToken(
  tokenEndpoint: string,
  clientId: string,
  refreshToken: string,
): Promise<TokenEndpointResponse> {
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Refresh token failed: ${res.status} ${res.statusText}\n${body}\n\n` +
      `Si refresh_token est expiré ou révoqué, relance \`npm run bootstrap\` pour ré-autoriser.`,
    );
  }
  return res.json() as Promise<TokenEndpointResponse>;
}

/**
 * Retourne un access_token valide, en rafraîchissant si nécessaire.
 * Met à jour tokens.json côté disque si refresh effectué.
 */
export async function getValidAccessToken(
  tokenEndpoint: string,
  clientId: string,
): Promise<string> {
  const current = await loadTokens();

  if (current.access_token && Date.now() < current.expires_at - REFRESH_MARGIN_MS) {
    return current.access_token;
  }

  console.log('🔄 Access token expiré ou bientôt — refresh…');
  const refreshed = await refreshAccessToken(tokenEndpoint, clientId, current.refresh_token);

  const updated: StoredTokens = {
    access_token: refreshed.access_token,
    // Coros peut rotater le refresh_token : si renvoyé, on prend le nouveau, sinon on
    // garde l'ancien.
    refresh_token: refreshed.refresh_token || current.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope || current.scope,
    token_type: refreshed.token_type || current.token_type,
    obtained_at: new Date().toISOString(),
  };
  await saveTokens(updated);
  console.log(`   ↳ nouvel access_token expire dans ${Math.round(refreshed.expires_in / 60)} min`);
  return updated.access_token;
}
