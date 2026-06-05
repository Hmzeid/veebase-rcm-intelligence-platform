#!/usr/bin/env bash
# One-command setup for a fresh clone.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; echo "✓ created .env from .env.example"; }
bun install
bunx prisma generate
bunx prisma migrate deploy
bun run prisma/seed.ts
echo "✓ Setup complete. Run: bun run dev"
