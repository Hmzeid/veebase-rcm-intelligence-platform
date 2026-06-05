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
  | 'agent.run';

export interface EventEnvelope {
  id: string;
  event: RcmEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(secret: string, payload: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Emit an event to all active webhooks subscribed to it. Deliveries are logged
 * and signed with an HMAC-SHA256 signature in the `X-RCM-Signature` header so
 * receivers can verify authenticity. Fire-and-forget — never blocks the caller.
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

  const envelope: EventEnvelope = {
    id: crypto.randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const payload = JSON.stringify(envelope);

  await Promise.allSettled(
    subscribers.map(async (hook) => {
      const signature = sign(hook.secret, payload);
      let status = 'FAILED';
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      try {
        const res = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RCM-Event': event,
            'X-RCM-Signature': signature,
            'X-RCM-Delivery': envelope.id,
          },
          body: payload,
          signal: AbortSignal.timeout(8000),
        });
        statusCode = res.status;
        status = res.ok ? 'SUCCESS' : 'FAILED';
        responseBody = (await res.text()).slice(0, 500);
      } catch (e) {
        responseBody = e instanceof Error ? e.message : 'delivery error';
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
            attempts: 1,
            deliveredAt: status === 'SUCCESS' ? new Date() : undefined,
          },
        });
      } catch {
        /* ignore delivery-log failures */
      }
    }),
  );
}
