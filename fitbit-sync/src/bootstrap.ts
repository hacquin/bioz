/**
 * Bootstrap OAuth pour bioz-fitbit-sync (Google Health API).
 *
 * Authorization Code + PKCE + callback loopback. Contrairement à Coros, pas de
 * Dynamic Client Registration : on utilise le client_id/secret du client OAuth
 * "Application de bureau" créé dans la console Google Cloud.
 *
 * Étapes :
 *   1. Génération PKCE (code_verifier + code_challenge S256) et state CSRF.
 *   2. Démarrage d'un mini-serveur HTTP sur 127.0.0.1:8910/callback.
 *   3. Construction de l'URL d'autorisation (access_type=offline + prompt=consent
 *      pour forcer l'émission d'un refresh_token), affichage + ouverture navigateur.
 *   4. Réception du code, vérification du state.
 *   5. Échange du code contre access_token + refresh_token.
 *   6. Sauvegarde dans tokens.json (gitignored).
 *
 * À lancer une seule fois localement : `npm run bootstrap`.
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { AUTH_ENDPOINT, TOKEN_ENDPOINT, SCOPES } from './config.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const TOKENS_PATH = 'tokens.json';
const CALLBACK_PORT = 8910;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function startCallbackServer(expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDesc = url.searchParams.get('error_description');

      const html = (emoji: string, title: string, msg: string, color: string) =>
        `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head>` +
        `<body style="font-family:system-ui,sans-serif;text-align:center;padding:4em 1em;background:#0f172a;color:#f8fafc">` +
        `<div style="font-size:3em">${emoji}</div><h1 style="color:${color}">${title}</h1>` +
        `<p style="opacity:.8">${msg}</p></body></html>`;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html('❌', 'Erreur', `${error}${errorDesc ? ` — ${errorDesc}` : ''}`, '#f87171'));
        setImmediate(() => server.close());
        reject(new Error(`Authorization error: ${error}${errorDesc ? ` — ${errorDesc}` : ''}`));
        return;
      }
      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html('❌', 'State invalide', 'CSRF suspecté, on annule.', '#f87171'));
        setImmediate(() => server.close());
        reject(new Error('State mismatch — possible CSRF'));
        return;
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html('❌', 'Pas de code', "Google n'a pas renvoyé de code.", '#f87171'));
        setImmediate(() => server.close());
        reject(new Error('No code in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html('✅', 'Autorisation reçue', 'Tu peux fermer cet onglet et retourner dans ton terminal.', '#34d399'));
      setImmediate(() => server.close());
      resolve({ code });
    });

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      console.log(`   ↳ serveur callback prêt sur ${REDIRECT_URI}`);
    });
    server.on('error', reject);
  });
}

async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      client_id: CLIENT_ID as string,
      client_secret: CLIENT_SECRET as string,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status}\n${body}`);
  }
  return res.json() as Promise<TokenResponse>;
}

function tryOpenBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* pas grave, l'user peut copier-coller à la main */
  });
}

async function main(): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants dans .env.\n' +
        'Récupère-les dans le JSON du client OAuth "Application de bureau" (console Google Cloud).',
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = base64url(crypto.randomBytes(16));

  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  // Indispensables pour obtenir un refresh_token réutilisable côté daemon :
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('🌐 Démarrage du serveur de callback local…');
  const serverPromise = startCallbackServer(state);

  console.log('\n=================================================');
  console.log("👉 Si ton navigateur ne s'ouvre pas, copie cette URL :\n");
  console.log(`   ${authUrl.toString()}\n`);
  console.log('=================================================\n');
  console.log(`⏳ En attente du callback Google (redirect vers ${REDIRECT_URI})…`);
  console.log("   ⚠️ Google affichera un écran \"appli non validée\" : clique \"Paramètres avancés\" → \"Accéder à BIOZ\".");

  tryOpenBrowser(authUrl.toString());

  const { code } = await serverPromise;
  console.log('\n✅ Code reçu, échange contre tokens…');

  const token = await exchangeCodeForToken(code, verifier);

  if (!token.refresh_token) {
    throw new Error(
      'Aucun refresh_token reçu — vérifie access_type=offline + prompt=consent. ' +
        'Si tu avais déjà autorisé, révoque l\'accès sur https://myaccount.google.com/permissions et relance.',
    );
  }

  const tokens = {
    refresh_token: token.refresh_token,
    access_token: token.access_token,
    expires_at: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    token_type: token.token_type,
    obtained_at: new Date().toISOString(),
  };
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log(`💾 Tokens stockés dans ${TOKENS_PATH} (gitignored).`);
  console.log(`   scope accordé : ${token.scope || '(non précisé)'}`);
  console.log('\n🎉 Bootstrap terminé. Étape suivante : `npm run inspect` pour voir les vraies données.');
}

main().catch((e: unknown) => {
  console.error('\n❌ Bootstrap échoué :', e instanceof Error ? e.message : e);
  process.exit(1);
});
