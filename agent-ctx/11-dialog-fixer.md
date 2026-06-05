# Task 11 - Dialog Fixer

## Summary
Converted all Dialog/Modal components to full-screen slide-out Sheet panels to fix overflow/cramped scrolling issues.

## Changes Made

### 1. `/src/lib/rcm-store.ts`
- Added missing `addClaim` action to RCMStore interface and implementation (was referenced by claim-submit-dialog.tsx but not defined)

### 2. `/src/components/rcm/claims/claims-view.tsx`
- Replaced `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` with `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`
- Claim detail: Sheet with `side="right"`, `sm:max-w-2xl`, `overflow-y-auto`, `p-0` (content padded via inner div `p-6`)
- Replaced `DialogHeader`/`DialogTitle` inside `ClaimDetail` with `SheetHeader`/`SheetTitle`

### 3. `/src/components/rcm/agents/agents-view.tsx`
- Removed `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogTrigger` imports
- Added `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` imports
- Changed `AgentCard` and `AgentDetailCard` from DialogTrigger-wrapped cards to plain clickable cards that call `setSelectedAgent`
- Moved detail content into controlled Sheet at `AgentsView` level (`open={!!selectedAgent}`)
- Renamed `AgentDetailDialog` to `AgentDetailContent` (just content, no dialog wrapper)
- Sheet: `side="right"`, `sm:max-w-lg`, `overflow-y-auto`, `p-0`

### 4. `/src/components/rcm/claims/claim-submit-dialog.tsx`
- Replaced all Dialog imports with Sheet equivalents
- Changed from DialogTrigger-wrapped Button to standalone Button with `onClick={() => setOpen(true)}`
- Sheet: `side="right"`, `sm:max-w-xl`, `overflow-y-auto`, `p-0`
- Content wrapped in `div` with `p-6` and `space-y-4`
- Replaced `DialogFooter` with simple flex div for action buttons

## Verification
- `bun run lint` — passed with zero errors
- Dev server compiles successfully
