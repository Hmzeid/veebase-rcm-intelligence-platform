#!/usr/bin/env bash
# Switch the Prisma datasource between SQLite and PostgreSQL.
# Usage: scripts/switch-db.sh sqlite | postgresql
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-}"
case "$TARGET" in
  sqlite|postgresql|mysql) ;;
  *) echo "Usage: $0 sqlite|postgresql|mysql"; exit 1;;
esac

# Rewrite the provider line inside the datasource block.
perl -0pi -e "s/(datasource db \{[^}]*?provider\s*=\s*)\"[a-z]+\"/\${1}\"$TARGET\"/s" prisma/schema.prisma

echo "✓ Prisma provider set to \"$TARGET\" in prisma/schema.prisma"
echo
echo "Next steps:"
if [ "$TARGET" = "sqlite" ]; then
  echo "  1) export DATABASE_URL=\"file:../db/custom.db\""
else
  echo "  1) export DATABASE_URL=\"$TARGET://user:pass@host:5432/rcm\""
fi
echo "  2) bunx prisma generate"
echo "  3) bunx prisma db push   # or: bunx prisma migrate deploy"
echo "  4) bun run prisma/seed.ts"
