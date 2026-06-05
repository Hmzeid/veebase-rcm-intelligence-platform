import crypto from 'node:crypto';
import { db } from '@/lib/db';

/**
 * Event names emitted by the platform. External systems subscribe to these via
 * registered webhooks (outbound integration).
 */
export type RcmEvent =
  | 'claim.created'
  | 'claim.updated'
  | 'claim.status_changed'
  | 'claim.submitted'
  | 'claim.denied'
  | 'claim.paid'
  | 'claim.written_off'
  | 'escalation.created'
  | 'escalation.resolved'
  | 'agent.run'
  | 'ping';

export interface EventEnvelope {
  id: string;
  event: RcmEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

const MAX_ATTEMPTS = Number(process.env.RCM_WEBHOOK_MAX_ATTEMPTS ?? 3);
const BACKOFF_MS = [0, 1500, 4000, 10000];

function sign(secret: string, payload: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Hook { id: string; url: string; secret: string }

/** Deliver a single signed payload with bounded exponential-backoff retries. */
async function deliverWithRetry(hook: Hook, event: RcmEvent, payload: string, deliveryId: string): Promise<void> {
  const signature = sign(hook.secret, payload);
  let attempts = 0;
  let status = 'FAILED';
  let statusCode: number | null = null;
  let responseBody: string | null = null;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (BACKOFF_MS[i]) await sleep(BACKOFF_MS[i]);
    attempts += 1;
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RCM-Event': event,
          'X-RCM-Signature': signature,
          'X-RCM-Delivery': deliveryId,
          'X-RCM-Attempt': String(attempts),
        },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
      statusCode = res.status;
      responseBody = (await res.text()).slice(0, 500);
      if (res.ok) { status = 'SUCCESS'; break; }
      status = 'FAILED';
    } catch (e) {
      responseBody = e instanceof Error ? e.message : 'delivery error';
      status = 'FAILED';
    }
  }

  try {
    await db.webhookDelivery.create({
      data: {
        webhookId: hook.id,
        event,
        payload,
        status,
        statusCode: statusCode ?? undefined,
        responseBody: responseBody ?? undefined,
        attempts,
        deliveredAt: status === 'SUCCESS' ? new Date() : undefined,
      },
    });
  } catch {
    /* ignore delivery-log failures */
  }
}

/**
 * Emit an event to all active webhooks subscribed to it. The subscriber lookup
 * is awaited (fast); the HTTP deliveries run in the background with retries so
 * the caller's request is never blocked on a slow receiver.
 */
export async function emitEvent(event: RcmEvent, data: Record<string, unknown>): Promise<void> {
  let hooks: Array<{ id: string; url: string; secret: string; events: string }> = [];
  try {
    hooks = await db.webhook.findMany({ where: { active: true } });
  } catch {
    return; // table may not exist yet during bootstrap
  }

  const subscribers = hooks.filter((h) => {
    try {
      const evts: string[] = JSON.parse(h.events || '["*"]');
      return evts.includes('*') || evts.includes(event);
    } catch {
      return true;
    }
  });
  if (subscribers.length === 0) return;

  const envelope: EventEnvelope = { id: crypto.randomUUID(), event, timestamp: new Date().toISOString(), data };
  const payload = JSON.stringify(envelope);

  // Fire-and-forget: do not block the API response on delivery + retries.
  for (const hook of subscribers) {
    void deliverWithRetry(hook, event, payload, envelope.id);
  }
}

/** Send a test "ping" event to a specific webhook (synchronously awaited). */
export async function pingWebhook(hookId: string): Promise<boolean> {
  const hook = await db.webhook.findUnique({ where: { id: hookId } });
  if (!hook) return false;
  const envelope: EventEnvelope = {
    id: crypto.randomUUID(), event: 'ping', timestamp: new Date().toISOString(),
    data: { message: 'Veebase RCM webhook test', webhookId: hookId },
  };
  await deliverWithRetry(hook, 'ping', JSON.stringify(envelope), envelope.id);
  return true;
}
