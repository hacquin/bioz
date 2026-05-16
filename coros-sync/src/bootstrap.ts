/**
 * Bootstrap OAuth pour bioz-coros-sync (Authorization Code + PKCE + callback localhost).
 *
 * Le device flow de Coros refuse silencieusement nos requêtes (invalid_request sans
 * détail) malgré sa présence dans grant_types_supported. On utilise donc l'auth code
 * flow standard avec PKCE et un serveur local Node sur http://localhost:8910/callback.
 *
 * Étapes :
 *   1. Découverte des endpoints OAuth.
 *   2. Dynamic Client Registration (client public, auth_method=none, PKCE remplace le
 *      secret) — re-registration automatique si pas encore fait.
 *   3. Génération PKCE (code_verifier + code_challenge S256) et state CSRF.
 *   4. Démarrage d'un mini-serveur HTTP sur localhost:8910 pour recevoir le callback.
 *   5. Construction de l'URL d'autorisation, affichage + tentative d'ouvrir le navigateur.
 *   6. Réception du code, vérification du state.
 *   7. Échange du code contre access_token + refresh_token.
 *   8. Sauvegarde dans tokens.json (gitignored).
 *
 * À lancer une seule fois localement : `npm run bootstrap`.
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';

const ISSUER = process.env.COROS_MCP_ISSUER;
const ENV_PATH = '.env';
const TOKENS_PATH = 'tokens.json';
const SCOPE = 'openid mcp.tools offline_access';
const CALLBACK_PORT = 8910;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const CLIENT_NAME = 'bioz-coros-sync';

interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported?: string[];
}

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

async function fetchOAuthMetadata(issuer: string): Promise<OAuthMetadata> {
  const url = `${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OAuth metadata fetch failed: ${res.status}`);
  return res.json() as Promise<OAuthMetadata>;
}

async function registerClient(meta: OAuthMetadata): Promise<Record<string, unknown>> {
  const payload = {
    client_name: CLIENT_NAME,
    redirect_uris: [REDIRECT_URI],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: SCOPE,
    application_type: 'native',
  };
  console.log(`   ↳ POST ${meta.registration_endpoint}`);
  console.log(`   ↳ payload : ${JSON.stringify(payload, null, 2).replace(/\n/g, '\n     ')}`);
  const res = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dynamic Client Registration failed: ${res.status}\n${body}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function startCallbackServer(expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${CALLBACK_PORT}`);
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
        res.end(html('❌', 'Pas de code', 'Le serveur Coros n\'a pas renvoyé de code.', '#f87171'));
        setImmediate(() => server.close());
        reject(new Error('No code in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html('✅', 'Autorisation reçue', 'Tu peux fermer cet onglet et retourner dans ton terminal.', '#34d399'));
      setImmediate(() => server.close());
      resolve({ code });
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(`   ↳ serveur callback prêt sur ${REDIRECT_URI}`);
    });
    server.on('error', reject);
  });
}

async function exchangeCodeForToken(
  meta: OAuthMetadata,
  clientId: string,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const res = await fetch(meta.token_endpoint, {
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
      client_id: clientId,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status}\n${body}`);
  }
  return res.json() as Promise<TokenResponse>;
}

async function upsertEnv(updates: Record<string, string>): Promise<void> {
  let content = '';
  try {
    content = await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    try { content = await fs.readFile('.env.example', 'utf8'); } catch { content = ''; }
  }
  const lines = content.split('\n');
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`);
    const idx = lines.findIndex((l) => re.test(l));
    const newLine = `${key}=${value}`;
    if (idx >= 0) lines[idx] = newLine;
    else lines.push(newLine);
  }
  await fs.writeFile(ENV_PATH, lines.join('\n'));
}

function tryOpenBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "" "${url}"` :
                                     `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      // Pas grave, l'user peut copier-coller à la main
    }
  });
}

async function main(): Promise<void> {
  if (!ISSUER) throw new Error('COROS_MCP_ISSUER manquant dans .env');

  console.log(`📡 Découverte OAuth depuis ${ISSUER}…`);
  const meta = await fetchOAuthMetadata(ISSUER);
  console.log(`   ↳ auth endpoint  : ${meta.authorization_endpoint}`);
  console.log(`   ↳ token endpoint : ${meta.token_endpoint}`);
  console.log(`   ↳ scopes         : ${(meta.scopes_supported || []).join(', ')}`);

  // Un client_id existant venait d'un autre flow (device, redirect bioz.app).
  // Pour auth code + localhost, on re-register systématiquement.
  let clientId = process.env.COROS_CLIENT_ID;

  if (!clientId) {
    console.log(`\n🆕 Enregistrement dynamique d'un client public "${CLIENT_NAME}"…`);
    const reg = await registerClient(meta);
    console.log(`   ↳ réponse :\n${JSON.stringify(reg, null, 2).replace(/\n/g, '\n     ')}`);
    clientId = reg.client_id as string;
    await upsertEnv({
      COROS_CLIENT_ID: clientId,
      COROS_CLIENT_SECRET: '',
    });
  } else {
    console.log(`\n♻️  client_id existant : ${clientId}`);
    console.log(`   (si ce client a été créé pour un autre flow, supprime COROS_CLIENT_ID du .env et relance)`);
  }

  // PKCE
  const { verifier, challenge } = generatePkce();
  const state = base64url(crypto.randomBytes(16));

  // URL d'autorisation
  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log(`\n🌐 Démarrage du serveur de callback local…`);
  const serverPromise = startCallbackServer(state);

  console.log(`\n=================================================`);
  console.log(`👉 Si ton navigateur ne s'ouvre pas, copie cette URL :\n`);
  console.log(`   ${authUrl.toString()}\n`);
  console.log(`=================================================\n`);
  console.log(`⏳ En attente du callback Coros (redirect vers ${REDIRECT_URI})…`);

  tryOpenBrowser(authUrl.toString());

  const { code } = await serverPromise;
  console.log(`\n✅ Code reçu, échange contre tokens…`);

  const token = await exchangeCodeForToken(meta, clientId, code, verifier);

  if (!token.refresh_token) {
    throw new Error(
      'Aucun refresh_token reçu — vérifie que offline_access a bien été accordé (peut nécessiter un consentement explicite côté Coros).',
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
  console.log(`\n🎉 Bootstrap terminé. Étape suivante : on codera \`npm run sync\`.`);
}

main().catch((e: unknown) => {
  console.error('\n❌ Bootstrap échoué :', e instanceof Error ? e.message : e);
  process.exit(1);
});
