/**
 * AI provider configuration.
 *
 * The platform's chat (LLM) and PDF-ingestion (VLM) features are provider
 * agnostic. The active provider can be switched at runtime (persisted in the
 * Setting table) or via env, and a fallback chain provides automatic backup
 * when the primary is unavailable.
 *
 * Supported providers:
 *   • zai       — the bundled z-ai-web-dev-sdk (default, zero-config)
 *   • openai    — any OpenAI-compatible endpoint (OpenAI, Groq, Together,
 *                 OpenRouter, vLLM, LM Studio, …)
 *   • anthropic — Anthropic Claude Messages API
 *   • ollama    — local models via Ollama's OpenAI-compatible endpoint
 */

export type ProviderId = 'zai' | 'openai' | 'anthropic' | 'ollama';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  kind: 'sdk' | 'openai-compatible' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string;
  supportsVision: boolean;
  /** Whether the provider has the configuration it needs to be callable. */
  configured: boolean;
  /** True for local providers that need no API key (e.g. Ollama). */
  local: boolean;
}

const env = (k: string): string | undefined => process.env[k]?.trim() || undefined;

export const ALL_PROVIDER_IDS: ProviderId[] = ['zai', 'openai', 'anthropic', 'ollama'];

export function buildProviderConfig(id: ProviderId): ProviderConfig {
  switch (id) {
    case 'openai': {
      const apiKey = env('RCM_OPENAI_API_KEY') || env('OPENAI_API_KEY') || '';
      const baseUrl = env('RCM_OPENAI_BASE_URL') || 'https://api.openai.com/v1';
      const model = env('RCM_OPENAI_MODEL') || 'gpt-4o-mini';
      return {
        id, label: 'OpenAI-compatible', kind: 'openai-compatible',
        baseUrl, apiKey, model,
        visionModel: env('RCM_OPENAI_VISION_MODEL') || model,
        supportsVision: true, configured: !!apiKey, local: false,
      };
    }
    case 'anthropic': {
      const apiKey = env('RCM_ANTHROPIC_API_KEY') || env('ANTHROPIC_API_KEY') || '';
      const model = env('RCM_ANTHROPIC_MODEL') || 'claude-3-5-sonnet-latest';
      return {
        id, label: 'Anthropic Claude', kind: 'anthropic',
        baseUrl: env('RCM_ANTHROPIC_BASE_URL') || 'https://api.anthropic.com',
        apiKey, model,
        visionModel: env('RCM_ANTHROPIC_VISION_MODEL') || model,
        supportsVision: true, configured: !!apiKey, local: false,
      };
    }
    case 'ollama': {
      const baseUrl = env('RCM_OLLAMA_BASE_URL') || 'http://localhost:11434/v1';
      const model = env('RCM_OLLAMA_MODEL') || 'llama3.1';
      return {
        id, label: 'Local (Ollama)', kind: 'openai-compatible',
        baseUrl, apiKey: env('RCM_OLLAMA_API_KEY') || 'ollama', model,
        visionModel: env('RCM_OLLAMA_VISION_MODEL') || 'llava',
        supportsVision: true, configured: true, local: true,
      };
    }
    case 'zai':
    default:
      return {
        id: 'zai', label: 'Z.ai (bundled SDK)', kind: 'sdk',
        baseUrl: '', apiKey: '', model: env('RCM_ZAI_MODEL') || 'default',
        visionModel: 'default', supportsVision: true, configured: true, local: false,
      };
  }
}

/** Apply generic RCM_AI_* overrides to the active provider's config. */
export function applyActiveOverrides(cfg: ProviderConfig): ProviderConfig {
  const model = env('RCM_AI_MODEL');
  const baseUrl = env('RCM_AI_BASE_URL');
  const apiKey = env('RCM_AI_API_KEY');
  return {
    ...cfg,
    model: model || cfg.model,
    visionModel: env('RCM_AI_VISION_MODEL') || (model || cfg.visionModel),
    baseUrl: baseUrl || cfg.baseUrl,
    apiKey: apiKey || cfg.apiKey,
    configured: cfg.kind === 'sdk' || cfg.local ? true : !!(apiKey || cfg.apiKey),
  };
}

/** The env-declared primary provider (may be overridden at runtime via DB). */
export function envPrimaryProviderId(): ProviderId {
  const p = env('RCM_AI_PROVIDER') as ProviderId | undefined;
  return p && ALL_PROVIDER_IDS.includes(p) ? p : 'zai';
}

/** The env-declared fallback chain, or undefined to auto-derive. */
export function envFallbackChain(): ProviderId[] | undefined {
  const raw = env('RCM_AI_FALLBACKS');
  if (!raw) return undefined;
  return raw.split(',').map((s) => s.trim()).filter((s): s is ProviderId => ALL_PROVIDER_IDS.includes(s as ProviderId));
}
