import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import {
  buildProviderConfig,
  applyActiveOverrides,
  envPrimaryProviderId,
  envFallbackChain,
  ALL_PROVIDER_IDS,
} from '../src/lib/ai/config';

const SAVED = { ...process.env };
function reset() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('RCM_') || k === 'OPENAI_API_KEY' || k === 'ANTHROPIC_API_KEY') delete process.env[k];
  }
}
beforeEach(reset);
afterEach(() => { reset(); Object.assign(process.env, SAVED); });

describe('provider config', () => {
  test('zai is always configured and is the default primary', () => {
    expect(buildProviderConfig('zai').configured).toBe(true);
    expect(envPrimaryProviderId()).toBe('zai');
  });

  test('ollama (local) is configured without an API key', () => {
    const cfg = buildProviderConfig('ollama');
    expect(cfg.local).toBe(true);
    expect(cfg.configured).toBe(true);
    expect(cfg.baseUrl).toContain('11434');
  });

  test('openai is configured only when an API key is present', () => {
    expect(buildProviderConfig('openai').configured).toBe(false);
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(buildProviderConfig('openai').configured).toBe(true);
  });

  test('anthropic picks up its model + key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    process.env.RCM_ANTHROPIC_MODEL = 'claude-test';
    const cfg = buildProviderConfig('anthropic');
    expect(cfg.configured).toBe(true);
    expect(cfg.model).toBe('claude-test');
    expect(cfg.kind).toBe('anthropic');
  });

  test('all provider ids build a config', () => {
    for (const id of ALL_PROVIDER_IDS) {
      expect(buildProviderConfig(id).id).toBe(id);
    }
  });
});

describe('overrides & chain', () => {
  test('generic RCM_AI_MODEL overrides the active provider model', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.RCM_AI_MODEL = 'my-model';
    const cfg = applyActiveOverrides(buildProviderConfig('openai'));
    expect(cfg.model).toBe('my-model');
  });

  test('RCM_AI_PROVIDER selects the primary', () => {
    process.env.RCM_AI_PROVIDER = 'ollama';
    expect(envPrimaryProviderId()).toBe('ollama');
  });

  test('invalid RCM_AI_PROVIDER falls back to zai', () => {
    process.env.RCM_AI_PROVIDER = 'bogus';
    expect(envPrimaryProviderId()).toBe('zai');
  });

  test('RCM_AI_FALLBACKS parses and filters the chain', () => {
    process.env.RCM_AI_FALLBACKS = 'openai, bogus ,ollama';
    expect(envFallbackChain()).toEqual(['openai', 'ollama']);
  });
});
