import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Request validation schemas (Zod) for the integration API. Centralising these
 * keeps every endpoint's contract explicit and produces consistent, structured
 * 422 error responses instead of ad-hoc 400s.
 */

export const PayerTypeSchema = z.enum(['NHIA', 'PRIVATE', 'SELF_PAY']);

export const ClaimStatusSchema = z.enum([
  'ELIGIBILITY', 'PRIOR_AUTH', 'CHARGE_CAPTURE', 'CODING', 'SCRUBBING',
  'SUBMITTED', 'ADJUDICATION', 'REMITTANCE', 'DENIED', 'PAID', 'CLOSED', 'WRITTEN_OFF',
]);

export const ClaimInputSchema = z.object({
  patientName: z.string().min(1, 'patientName is required').max(200),
  nationalId: z.string().max(32).optional(),
  patientId: z.string().max(64).optional(),
  encounterId: z.string().max(64).optional(),
  payerId: z.string().max(64).optional(),
  payerName: z.string().max(200).optional(),
  payerType: PayerTypeSchema.optional(),
  serviceDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  totalAmount: z.number({ message: 'totalAmount must be a number' }).positive('totalAmount must be > 0').max(100_000_000),
  priorAuthRequired: z.boolean().optional(),
  priorAuthNumber: z.string().max(64).optional(),
  tags: z.array(z.string().max(48)).max(40).optional(),
  status: ClaimStatusSchema.optional(),
  source: z.string().max(32).optional(),
});

// Accepts a single claim object, a raw array, or { claims: [...] }.
export const ClaimCreateSchema = z.union([
  z.array(ClaimInputSchema).min(1).max(500),
  z.object({ claims: z.array(ClaimInputSchema).min(1).max(500) }),
  ClaimInputSchema,
]);

/** Normalise any of the accepted create payloads into { items, isBatch }. */
export function normaliseClaimCreate(
  data: z.infer<typeof ClaimCreateSchema>,
): { items: z.infer<typeof ClaimInputSchema>[]; isBatch: boolean } {
  if (Array.isArray(data)) return { items: data, isBatch: true };
  if ('claims' in data) return { items: data.claims, isBatch: true };
  return { items: [data], isBatch: false };
}

export const ClaimPatchSchema = z.object({
  payerName: z.string().max(200).optional(),
  payerType: PayerTypeSchema.optional(),
  totalAmount: z.number().positive().max(100_000_000).optional(),
  priorAuthRequired: z.boolean().optional(),
  priorAuthNumber: z.string().max(64).optional(),
  priorAuthStatus: z.string().max(32).optional(),
  status: ClaimStatusSchema.optional(),
  tags: z.array(z.string().max(48)).max(40).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field must be provided' });

export const ProcessSchema = z.object({
  mode: z.enum(['step', 'auto']).optional(),
}).optional();

export const EligibilitySchema = z.object({
  payerType: PayerTypeSchema,
  totalAmount: z.number().nonnegative().max(100_000_000),
  priorAuthNumber: z.string().max(64).optional(),
  serviceDate: z.string().optional(),
  patientName: z.string().max(200).optional(),
});

export const WebhookSchema = z.object({
  url: z.string().url('url must be a valid URL'),
  events: z.array(z.string().max(48)).max(20).optional(),
  description: z.string().max(280).optional(),
});

export const WebhookPatchSchema = z.object({
  active: z.boolean().optional(),
  events: z.array(z.string().max(48)).max(20).optional(),
  description: z.string().max(280).optional(),
});

export const ApiKeySchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).min(1).max(3).optional(),
});

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Parse a request body against a schema, returning a 422 response on failure. */
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })),
        },
        { status: 422 },
      ),
    };
  }
  return { ok: true, data: result.data };
}
