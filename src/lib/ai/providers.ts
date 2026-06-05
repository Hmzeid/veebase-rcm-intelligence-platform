/**
 * Provider call implementations. Each function throws on failure so the router
 * (index.ts) can fall through to the next provider in the chain.
 */
import type { ProviderConfig } from './config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

const TIMEOUT_MS = Number(process.env.RCM_AI_TIMEOUT_MS ?? 30000);

// ── z.ai bundled SDK ────────────────────────────────────────────────────────

export async function zaiChat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const sdk = (await import('z-ai-web-dev-sdk')) as unknown as {
    LLM?: new () => { chat: (b: unknown) => Promise<{ choices?: { message?: { content?: string } }[]; content?: string }> };
    default?: { LLM?: new () => { chat: (b: unknown) => Promise<{ choices?: { message?: { content?: string } }[]; content?: string }> } };
  };
  const LLMClass = sdk.LLM || sdk.default?.LLM;
  if (!LLMClass) throw new Error('z.ai LLM export unavailable');
  const llm = new LLMClass();
  const res = await llm.chat({ messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens ?? 1024 });
  const text = res.choices?.[0]?.message?.content || res.content;
  if (!text) throw new Error('z.ai returned empty response');
  return text;
}

export async function zaiVision(prompt: string, dataUrl: string): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default as unknown as { create: () => Promise<{ chat: { completions: { createVision: (b: unknown) => Promise<{ choices?: { message?: { content?: string } }[] }> } } }> };
  const zai = await ZAI.create();
  const res = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'file_url', file_url: { url: dataUrl } }] }],
    thinking: { type: 'disabled' },
  });
  const text = res.choices?.[0]?.message?.content;
  if (!text) throw new Error('z.ai vision returned empty response');
  return text;
}

// ── OpenAI-compatible (OpenAI, Groq, Together, vLLM, LM Studio, Ollama) ──────

export async function openaiChat(cfg: ProviderConfig, messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens ?? 1024 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${cfg.label} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${cfg.label} returned empty response`);
  return text;
}

export async function openaiVision(cfg: ProviderConfig, prompt: string, dataUrl: string): Promise<string> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.visionModel,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${cfg.label} vision HTTP ${res.status}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${cfg.label} vision returned empty response`);
  return text;
}

// ── Anthropic Claude ────────────────────────────────────────────────────────

export async function anthropicChat(cfg: ProviderConfig, messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.model, system: system || undefined, messages: rest, max_tokens: opts.maxTokens ?? 1024, temperature: opts.temperature ?? 0.3 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json.content?.[0]?.text;
  if (!text) throw new Error('Anthropic returned empty response');
  return text;
}

export async function anthropicVision(cfg: ProviderConfig, prompt: string, dataUrl: string): Promise<string> {
  // dataUrl: data:<mime>;base64,<data>
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Anthropic vision requires a base64 data URL');
  const [, mediaType, data] = match;
  const block = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.visionModel, max_tokens: 1500, messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Anthropic vision HTTP ${res.status}`);
  const json = await res.json();
  const text = json.content?.[0]?.text;
  if (!text) throw new Error('Anthropic vision returned empty response');
  return text;
}
