# bioz-fitbit-sync

Daemon de synchronisation **Google Health API (Fitbit Air) → Firestore** pour bioz.app.

Calqué sur `coros-sync/`, mais la source est la Google Health API (REST, OAuth 2.0
standard) au lieu du MCP Coros. Les données atterrissent dans Firestore sous
`users/{uid}/fitbitDaily/{yyyy-MM-dd}` et `users/{uid}/fitbitBaseline/snapshot`.

## Données récupérées (servies par l'API en juin 2026)

Pas · énergie dépensée · FC repos · VFC · SpO2 · glycémie · sommeil (durée + stades).

> Pas encore servis par l'API, donc reportés : **nutrition** (glucides/lipides/
> protéines), **score de sommeil** Fitbit, **variation de température cutanée**.

## Mise en route

```bash
cd fitbit-sync
cp .env.example .env          # puis remplir GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / BIOZ_USER_ID
cp ../coros-sync/service-account.json ./service-account.json   # réutilise la clé Firebase

npm install
npm run bootstrap             # 1 fois : autorise ton compte Google, écrit tokens.json
npm run inspect               # dumpe les vraies réponses de l'API (pour écrire les parsers)
npm run sync                  # synchronise vers Firestore (à venir)
```

### Config Google Cloud (déjà fait)

- Projet **Bioz** · Google Health API activée.
- Écran de consentement OAuth en mode **Test** (utilisateur de test = ton e-mail) →
  pas de validation Google requise.
- Client OAuth type **Application de bureau** → `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/config.ts` | endpoints, scopes, types de données |
| `src/tokens.ts` | refresh OAuth automatique (tokens.json) |
| `src/bootstrap.ts` | autorisation OAuth one-shot (loopback + PKCE) |
| `src/healthClient.ts` | client REST (list dataPoints, identity) |
| `src/inspect.ts` | exploration des réponses brutes |
| `src/sync.ts` | job quotidien → Firestore (à venir) |
| `src/firestore.ts` | écriture Firestore (à venir) |

## Prod

Cron quotidien sur le VPS : `0 6 * * * /usr/bin/node /opt/bioz-fitbit-sync/dist/sync.js`
(décalé de l'heure du sync Coros). Déclenchement manuel via `fitbit-trigger.php`.
