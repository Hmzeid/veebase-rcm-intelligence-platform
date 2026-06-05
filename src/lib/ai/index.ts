/**
 * AI router: selects the active provider, runs a fallback chain on failure, and
 * exposes chat (LLM) + vision (VLM) entry points used by the chat and ingestion
 * routes. Returns `null` when every configured provider fails, letting callers
 * use their deterministic domain fallback.
 */
import { db } from '@/lib/db';
import {
  type ProviderId, type ProviderConfig, ALL_PROVIDER_IDS,
  buildProviderConfig, applyActiveOverrides, envPrimaryProviderId, envFallbackChain,
} from './config';
import {
  type ChatMessage, type ChatOptions,
  zaiChat, zaiVision, openaiChat, openaiVision, anthropicChat, anthropicVision,
} from './providers';

export type { ChatMessage, ChatOptions } from './providers';
export type { ProviderId } from './config';

const ACTIVE_KEY = 'ai.provider';

export interface AIResult {
  text: string;
  provider: ProviderId;
  model: string;
}

// ── active provider (runtime-switchable, persisted in Setting) ───────────────

export async function getActiveProviderId(): Promise<ProviderId> {
  try {
    const row = await db.setting.findUnique({ where: { key: ACTIVE_KEY } });
    if (row && ALL_PROVIDER_IDS.includes(row.value as ProviderId)) return row.value as ProviderId;
  } catch {
    /* table may not exist yet */
  }
  return envPrimaryProviderId();
}

export async function setActiveProviderId(id: ProviderId): Promise<void> {
  if (!ALL_PROVIDER_IDS.includes(id)) throw new Error(`Unknown provider: ${id}`);
  await db.setting.upsert({ where: { key: ACTIVE_KEY }, create: { key: ACTIVE_KEY, value: id }, update: { value: id } });
}

function configFor(id: ProviderId, active: ProviderId): ProviderConfig {
  const base = buildProviderConfig(id);
  return id === active ? applyActiveOverrides(base) : base;
}

/** Ordered, de-duplicated chain: [active, ...fallbacks]. */
async function resolveChain(): Promise<ProviderConfig[]> {
  const active = await getActiveProviderId();
  const fallbacks = envFallbackChain();
  const ids: ProviderId[] = [active];
  if (fallbacks) {
    for (const f of fallbacks) if (!ids.includes(f)) ids.push(f);
  } else {
    // Auto: append every other configured provider.
    for (const id of ALL_PROVIDER_IDS) {
      if (ids.includes(id)) continue;
      if (buildProviderConfig(id).configured) ids.push(id);
    }
  }
  return ids.map((id) => configFor(id, active));
}

// ── chat (LLM) ───────────────────────────────────────────────────────────────

async function callChat(cfg: ProviderConfig, messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  if (cfg.kind === 'sdk') return zaiChat(messages, opts);
  if (cfg.kind === 'anthropic') return anthropicChat(cfg, messages, opts);
  return openaiChat(cfg, messages, opts);
}

export async function aiChat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<AIResult | null> {
  const chain = await resolveChain();
  for (const cfg of chain) {
    if (!cfg.configured) continue;
    try {
      const text = await callChat(cfg, messages, opts);
      return { text, provider: cfg.id, model: cfg.model };
    } catch (e) {
      console.warn(`[ai] chat via ${cfg.id} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

// ── vision (VLM) ──────────────────────────────────────────────────────────────

async function callVision(cfg: ProviderConfig, prompt: string, dataUrl: string): Promise<string> {
  if (cfg.kind === 'sdk') return zaiVision(prompt, dataUrl);
  if (cfg.kind === 'anthropic') return anthropicVision(cfg, prompt, dataUrl);
  return openaiVision(cfg, prompt, dataUrl);
}

export async function aiVision(prompt: string, dataUrl: string): Promise<AIResult | null> {
  const chain = await resolveChain();
  for (const cfg of chain) {
    if (!cfg.configured || !cfg.supportsVision) continue;
    try {
      const text = await callVision(cfg, prompt, dataUrl);
      return { text, provider: cfg.id, model: cfg.visionModel };
    } catch (e) {
      console.warn(`[ai] vision via ${cfg.id} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

// ── introspection & testing ───────────────────────────────────────────────────

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  visionModel: string;
  supportsVision: boolean;
  configured: boolean;
  local: boolean;
  active: boolean;
}

export async function listProviders(): Promise<{ active: ProviderId; chain: ProviderId[]; providers: ProviderInfo[] }> {
  const active = await getActiveProviderId();
  const chain = (await resolveChain()).map((c) => c.id);
  const providers = ALL_PROVIDER_IDS.map((id) => {
    const cfg = configFor(id, active);
    return {
      id, label: cfg.label, model: cfg.model, visionModel: cfg.visionModel,
      supportsVision: cfg.supportsVision, configured: cfg.configured, local: cfg.local,
      active: id === active,
    };
  });
  return { active, chain, providers };
}

export async function testProvider(id: ProviderId): Promise<{ ok: boolean; provider: ProviderId; model: string; latencyMs: number; sample?: string; error?: string }> {
  const active = await getActiveProviderId();
  const cfg = configFor(id, active);
  const start = Date.now();
  if (!cfg.configured) {
    return { ok: false, provider: id, model: cfg.model, latencyMs: 0, error: 'Provider is not configured (missing API key or endpoint).' };
  }
  try {
    const text = await callChat(cfg, [
      { role: 'system', content: 'You are a connectivity test. Reply with a single short sentence.' },
      { role: 'user', content: 'Reply with: RCM AI provider OK.' },
    ], { maxTokens: 32 });
    return { ok: true, provider: id, model: cfg.model, latencyMs: Date.now() - start, sample: text.slice(0, 160) };
  } catch (e) {
    return { ok: false, provider: id, model: cfg.model, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
