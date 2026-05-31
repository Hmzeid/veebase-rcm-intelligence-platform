'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { Bell, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const viewTitles: Record<string, string> = {
  dashboard: 'Operations Dashboard',
  agents: 'Agent Fleet',
  claims: 'Claims Pipeline',
  escalations: 'Escalation Queue',
  'payer-rules': 'Payer Contract & Rules',
  analytics: 'Analytics & Reporting',
  chat: 'AI Assistant',
};

export function Header() {
  const { activeView, escalations, setActiveView } = useRCMStore();
  const pendingEsc = escalations.filter((e) => e.status === 'PENDING');

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b">
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-600 text-white">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm">Veebase RCM</span>
        </div>

        {/* Desktop title */}
        <h2 className="hidden md:block text-lg font-semibold">{viewTitles[activeView]}</h2>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search (hidden on mobile) */}
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search claims, patients..."
              className="pl-8 h-8 w-56 text-sm bg-muted/50 border-0"
            />
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                {pendingEsc.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {pendingEsc.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Escalations</span>
                <Badge variant="destructive" className="text-[10px]">
                  {pendingEsc.length} pending
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pendingEsc.slice(0, 5).map((esc) => (
                <DropdownMenuItem
                  key={esc.id}
                  onClick={() => setActiveView('escalations')}
                  className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 ${
                        esc.level >= 4
                          ? 'border-red-300 text-red-700'
                          : esc.level >= 3
                          ? 'border-orange-300 text-orange-700'
                          : 'border-amber-300 text-amber-700'
                      }`}
                    >
                      L{esc.level}
                    </Badge>
                    <span className="text-xs font-medium">{esc.claimNumber}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{esc.reason}</p>
                </DropdownMenuItem>
              ))}
              {pendingEsc.length > 5 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setActiveView('escalations')}
                    className="text-center text-xs text-emerald-600 cursor-pointer"
                  >
                    View all {pendingEsc.length} escalations
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Phase indicator */}
          <Badge
            variant="outline"
            className="hidden md:flex text-[10px] h-6 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300"
          >
            Phase 1
          </Badge>
        </div>
      </div>
    </header>
  );
}
