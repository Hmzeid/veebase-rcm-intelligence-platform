'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCog, LogOut, ShieldCheck } from 'lucide-react';

interface Session {
  authEnabled: boolean;
  user: string | null;
  role: string | null;
  capabilities: string[];
}

export function AccountCard() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setSession)
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="w-4 h-4 text-sky-600" />
          Account & Access
        </CardTitle>
        <CardDescription>
          Role-based access control. Five roles (Admin, RCM Manager, Biller, Compliance, Viewer)
          map to capabilities such as processing claims, approving write-offs, resolving
          high-severity escalations, and managing AI, keys, and users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!session && <p className="text-sm text-muted-foreground">Loading…</p>}

        {session && !session.authEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Authentication is disabled (open mode)</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
              Set <span className="font-mono">RCM_AUTH_ENABLED=true</span> (and provision users, or set{' '}
              <span className="font-mono">RCM_UI_PASSWORD</span>) to require sign-in and enforce roles.
            </p>
          </div>
        )}

        {session?.authEnabled && (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold">{session.user ?? 'Not signed in'}</span>
                {session.role && <Badge className="h-5 text-[10px] bg-sky-600">{session.role}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{session.capabilities.length} capabilities granted</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={logout}>
              <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
