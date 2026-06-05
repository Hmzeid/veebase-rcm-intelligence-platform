# Task 2-b: Feature Enhancement Builder

## Task: Add Claim Status Progression to Agent Simulation and Make Draft Appeal Buttons Functional

## Changes Made

### Feature 1: Claim Status Progression in Agent Simulation
- **File**: `/src/components/rcm/dashboard/use-agent-simulation.ts`
- Imported `ClaimStatus` and `PIPELINE_STAGES` from rcm-types
- Added claim progression logic in the `tick` function:
  - 30% chance per tick to pick a random claim in a pipeline stage
  - Advances claim to next stage (ELIGIBILITY → PRIOR_AUTH → ... → REMITTANCE)
  - REMITTANCE → 60% PAID / 40% DENIED
  - PAID claims: paidAmount = 80-100% of totalAmount, patientResponsibility = remainder
  - updatedAt set to current timestamp
  - Activity item generated for each advancement
- Added `claims: updatedClaims` to batch setState

### Feature 2: Functional Draft Appeal Buttons
- **File**: `/src/components/rcm/claims/claims-view.tsx`
- Added `handleDraftAppeal` function that:
  - Generates markdown-formatted appeal document with claim details, strategy info, required docs checklist, and letter template
  - Downloads as `.md` file via Blob/URL.createObjectURL
  - Shows success toast with strategy name and estimated recovery
- Updated `AppealStrategyPanel` to pass full `claim` object instead of just `claimAmount`
- Updated `AppealStrategyCard` props: `claimAmount: number` → `claim: ClaimRecord`

## Verification
- `bun run lint` — passed with zero errors
- Dev server compiling successfully
