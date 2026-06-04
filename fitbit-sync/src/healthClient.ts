/**
 * Client REST minimal pour la Google Health API (v4).
 *
 * Auth : Bearer access_token (refresh auto via tokens.ts).
 * Base : https://health.googleapis.com/v4/users/me/...
 *
 * On utilise `users/me` (l'API résout l'utilisateur via le token) — pas besoin
 * d'appeler getIdentity en amont, mais on l'expose pour debug.
 */

import { API_BASE } from './config.js';
import { getValidAccessToken } from './tokens.js';

export interface DataPoint {
  // structure exacte découverte via `npm run inspect` ; on garde un sac générique.
  [key: string]: unknown;
}

interface ListResponse {
  dataPoints?: DataPoint[];
  nextPageToken?: string;
  [key: string]: unknown;
}

export interface ListOptions {
  /** Filtre AIP-160, ex: `steps.interval.start_time.physical_time >= "2026-05-12T00:00:00Z"` */
  filter?: string;
  pageSize?: number;
  /** Garde-fou pour ne pas paginer à l'infini pendant l'exploration. */
  maxPages?: number;
}

export class HealthClient {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!id || !secret) {
      throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants dans .env');
    }
    this.clientId = id;
    this.clientSecret = secret;
  }

  private async authHeader(): Promise<Record<string, string>> {
    const token = await getValidAccessToken(this.clientId, this.clientSecret);
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  /** GET brut sur un chemin relatif à API_BASE. Renvoie {status, body(text), json?}. */
  async rawGet(pathAndQuery: string): Promise<{ status: number; ok: boolean; body: string; json?: unknown }> {
    const headers = await this.authHeader();
    const res = await fetch(`${API_BASE}${pathAndQuery}`, { headers });
    const body = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      /* pas du JSON */
    }
    return { status: res.status, ok: res.ok, body, json };
  }

  /** Renvoie l'identité (legacyUserId / healthUserId) — utile pour debug. */
  async getIdentity(): Promise<unknown> {
    const r = await this.rawGet('/users/me/identity');
    if (!r.ok) throw new Error(`getIdentity ${r.status}: ${r.body}`);
    return r.json;
  }

  /**
   * Liste les data points d'un type, avec pagination.
   * Retourne le tableau agrégé (et lève si la 1re page échoue).
   */
  async listDataPoints(dataTypeId: string, opts: ListOptions = {}): Promise<DataPoint[]> {
    const pageSize = opts.pageSize ?? 1000;
    const maxPages = opts.maxPages ?? 50;
    const out: DataPoint[] = [];
    let pageToken: string | undefined;
    let page = 0;

    do {
      const qs = new URLSearchParams();
      if (opts.filter) qs.set('filter', opts.filter);
      qs.set('pageSize', String(pageSize));
      if (pageToken) qs.set('pageToken', pageToken);

      const r = await this.rawGet(`/users/me/dataTypes/${dataTypeId}/dataPoints?${qs.toString()}`);
      if (!r.ok) {
        throw new Error(`listDataPoints(${dataTypeId}) ${r.status}: ${r.body}`);
      }
      const data = (r.json ?? {}) as ListResponse;
      if (Array.isArray(data.dataPoints)) out.push(...data.dataPoints);
      pageToken = data.nextPageToken;
      page++;
    } while (pageToken && page < maxPages);

    return out;
  }
}
