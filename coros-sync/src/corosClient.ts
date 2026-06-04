/**
 * Client MCP pour Coros.
 *
 * Wrapping autour de `@modelcontextprotocol/sdk` :
 * - Récupère un access_token frais via tokens.ts (refresh automatique).
 * - Ouvre une connexion Streamable HTTP avec l'header Bearer.
 * - Expose des méthodes typées pour les 4 outils qui nous intéressent.
 *
 * Les outils MCP de Coros renvoient du texte structuré (pas du JSON), ce qui
 * nécessitera un parser côté sync.ts pour extraire les métriques.
 */

import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getValidAccessToken } from './tokens.js';

const ISSUER = process.env.COROS_MCP_ISSUER;
const MCP_ENDPOINT = process.env.COROS_MCP_ENDPOINT;
const CLIENT_ID = process.env.COROS_CLIENT_ID;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Paris';

if (!ISSUER || !MCP_ENDPOINT || !CLIENT_ID) {
  throw new Error('COROS_MCP_ISSUER, COROS_MCP_ENDPOINT et COROS_CLIENT_ID doivent être définis dans .env');
}

const TOKEN_ENDPOINT = `${ISSUER.replace(/\/$/, '')}/oauth2/token`;

export interface CorosToolResult {
  raw: string;
}

export class CorosClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;

  async connect(): Promise<void> {
    const accessToken = await getValidAccessToken(TOKEN_ENDPOINT, CLIENT_ID as string);

    this.transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT as string), {
      requestInit: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
    this.client = new Client(
      { name: 'bioz-coros-sync', version: '0.1.0' },
      { capabilities: {} },
    );
    await this.client.connect(this.transport);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async listTools(): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');
    const res = await this.client.listTools();
    return res.tools.map((t) => t.name);
  }

  private async callText(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error('Not connected');
    const res = await this.client.callTool({ name, arguments: args });
    const content = res.content as Array<{ type: string; text?: string }> | undefined;
    if (!content) return '';
    let raw = content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    // Coros sérialise son texte en JSON-string (avec \n littéraux et guillemets
    // englobants). On unwrap pour récupérer du texte avec de vrais retours ligne.
    raw = raw.trim();
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') raw = parsed;
      } catch {
        // Pas du JSON après tout, on garde tel quel.
      }
    }
    return raw;
  }

  // ===== Méthodes pour les 4 endpoints qui nous intéressent =====

  async getFitnessAssessmentOverview(): Promise<CorosToolResult> {
    return { raw: await this.callText('queryFitnessAssessmentOverview', {}) };
  }

  async getRestingHeartRate(days: number = 14): Promise<CorosToolResult> {
    return { raw: await this.callText('queryRestingHeartRate', { days, timezone: TIMEZONE }) };
  }

  async getHrvAssessment(days: number = 14): Promise<CorosToolResult> {
    return { raw: await this.callText('queryHrvAssessment', { days, timezone: TIMEZONE }) };
  }

  async getSleepData(days: number = 14): Promise<CorosToolResult> {
    // Bug Coros : sans endDate explicite, querySleepData exclut systématiquement
    // le jour courant (probablement par "prudence" pour les siestes à venir).
    // En forçant endDate=demain, on inclut bien la nuit qui vient de se terminer.
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(today); start.setDate(start.getDate() - (days - 1));
    return {
      raw: await this.callText('querySleepData', {
        days,
        timezone: TIMEZONE,
        startDate: fmt(start),
        endDate: fmt(tomorrow),
      }),
    };
  }

  async getStressLevel(days: number = 14): Promise<CorosToolResult> {
    return { raw: await this.callText('queryStressLevel', { days, timezone: TIMEZONE }) };
  }
}
