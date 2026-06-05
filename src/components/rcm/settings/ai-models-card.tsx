'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Check, Loader2, PlugZap, Cpu, Cloud } from 'lucide-react';
import { toast } from 'sonner';

interface ProviderInfo {
  id: string;
  label: string;
  model: string;
  visionModel: string;
  supportsVision: boolean;
  configured: boolean;
  local: boolean;
  active: boolean;
}

interface AIState {
  active: string;
  chain: string[];
  providers: ProviderInfo[];
}

export function AIModelsCard() {
  const [state, setState] = useState<AIState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai', { cache: 'no-store' });
      if (res.ok) setState(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchTo(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      if (res.ok) {
        setState(await res.json());
        toast.success(`Active AI provider set to "${id}"`);
      } else {
        toast.error('Failed to switch provider');
      }
    } finally {
      setBusy(null);
    }
  }

  async function test(id: string) {
    setTesting(id);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${id} reachable (${data.latencyMs}ms)`, { description: data.sample });
      } else {
        toast.error(`${id} test failed`, { description: data.error });
      }
    } catch {
      toast.error(`${id} test failed`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="w-4 h-4 text-violet-600" />
          AI Models
        </CardTitle>
        <CardDescription>
          Choose the LLM/VLM provider powering the assistant and PDF extraction. Switch between
          Z.ai, any OpenAI-compatible endpoint, Anthropic Claude, or a local model — with automatic
          failover. The platform always falls back to its deterministic knowledge base if every
          provider is unavailable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!state && <p className="text-sm text-muted-foreground">Loading providers…</p>}

        {state?.providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {p.local ? <Cpu className="w-3.5 h-3.5 text-emerald-600" /> : <Cloud className="w-3.5 h-3.5 text-sky-600" />}
                <span className="text-sm font-semibold">{p.label}</span>
                {p.active && <Badge className="h-5 text-[10px] bg-violet-600">Active</Badge>}
                {!p.configured && <Badge variant="outline" className="h-5 text-[10px] text-amber-600 border-amber-300">Not configured</Badge>}
                {p.local && <Badge variant="outline" className="h-5 text-[10px] text-emerald-600 border-emerald-300">Local</Badge>}
                {p.supportsVision && <Badge variant="outline" className="h-5 text-[10px]">Vision</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">{p.model}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={testing === p.id || !p.configured} onClick={() => test(p.id)}>
                {testing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
                <span className="ml-1">Test</span>
              </Button>
              {p.active ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                  <Check className="w-3.5 h-3.5 mr-1" /> Active
                </Button>
              ) : (
                <Button size="sm" className="h-7 text-xs" disabled={busy === p.id || !p.configured} onClick={() => switchTo(p.id)}>
                  {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set active'}
                </Button>
              )}
            </div>
          </div>
        ))}

        {state && (
          <p className="text-[11px] text-muted-foreground pt-1">
            Failover order: <span className="font-mono">{state.chain.join(' → ')} → knowledge-base</span>.
            Configure providers via environment variables (see <span className="font-mono">.env.example</span>).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
