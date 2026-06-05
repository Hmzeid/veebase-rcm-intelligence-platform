import { test, expect, describe } from 'bun:test';
import {
  ClaimInputSchema,
  ClaimCreateSchema,
  normaliseClaimCreate,
  EligibilitySchema,
  WebhookSchema,
  ApiKeySchema,
} from '../src/lib/validation';

describe('ClaimInputSchema', () => {
  test('accepts a minimal valid claim', () => {
    const r = ClaimInputSchema.safeParse({ patientName: 'Sara', totalAmount: 1500 });
    expect(r.success).toBe(true);
  });

  test('rejects a missing patient name', () => {
    expect(ClaimInputSchema.safeParse({ totalAmount: 1500 }).success).toBe(false);
  });

  test('rejects non-positive amounts', () => {
    expect(ClaimInputSchema.safeParse({ patientName: 'x', totalAmount: 0 }).success).toBe(false);
    expect(ClaimInputSchema.safeParse({ patientName: 'x', totalAmount: -5 }).success).toBe(false);
  });

  test('rejects an invalid payer type', () => {
    expect(ClaimInputSchema.safeParse({ patientName: 'x', totalAmount: 5, payerType: 'BUPA' }).success).toBe(false);
  });
});

describe('ClaimCreateSchema + normalise', () => {
  test('single object → not a batch', () => {
    const data = ClaimCreateSchema.parse({ patientName: 'A', totalAmount: 100 });
    const n = normaliseClaimCreate(data);
    expect(n.isBatch).toBe(false);
    expect(n.items.length).toBe(1);
  });

  test('array form → batch', () => {
    const data = ClaimCreateSchema.parse([{ patientName: 'A', totalAmount: 100 }, { patientName: 'B', totalAmount: 200 }]);
    const n = normaliseClaimCreate(data);
    expect(n.isBatch).toBe(true);
    expect(n.items.length).toBe(2);
  });

  test('{ claims: [...] } form → batch', () => {
    const data = ClaimCreateSchema.parse({ claims: [{ patientName: 'A', totalAmount: 100 }] });
    const n = normaliseClaimCreate(data);
    expect(n.isBatch).toBe(true);
  });
});

describe('other schemas', () => {
  test('eligibility requires payerType and amount', () => {
    expect(EligibilitySchema.safeParse({ payerType: 'NHIA', totalAmount: 8000 }).success).toBe(true);
    expect(EligibilitySchema.safeParse({ totalAmount: 8000 }).success).toBe(false);
  });

  test('webhook requires a valid URL', () => {
    expect(WebhookSchema.safeParse({ url: 'https://example.com/hook' }).success).toBe(true);
    expect(WebhookSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);
  });

  test('api key requires a name and validates scopes', () => {
    expect(ApiKeySchema.safeParse({ name: 'EHR', scopes: ['read', 'write'] }).success).toBe(true);
    expect(ApiKeySchema.safeParse({ name: 'EHR', scopes: ['superuser'] }).success).toBe(false);
    expect(ApiKeySchema.safeParse({ scopes: ['read'] }).success).toBe(false);
  });
});
