import { PrismaClient } from '@prisma/client'
import path from 'node:path'

/**
 * Resolve a robust, absolute database URL.
 *
 * SQLite relative paths in Prisma are resolved relative to the schema file at
 * generate-time, which breaks inside Next.js `standalone` builds (the server
 * runs from a different working directory). To make the platform portable and
 * "integrate-anywhere", we:
 *
 *   1. Use DATABASE_URL verbatim when it points at a real server (postgres,
 *      mysql, etc.) or is already an absolute file path. This lets operators
 *      drop in their own managed database with zero code changes.
 *   2. Otherwise, normalise a `file:` URL to an absolute path anchored at the
 *      process working directory so it resolves identically in dev, production
 *      and the standalone server.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim()

  // Non-SQLite providers (postgres://, mysql://, sqlserver://, ...) — pass through.
  if (raw && !raw.startsWith('file:')) return raw

  // Explicit override for the SQLite file location (absolute path preferred).
  const explicitFile = process.env.RCM_DATABASE_FILE?.trim()

  let filePath: string
  if (explicitFile) {
    filePath = explicitFile
  } else if (raw) {
    filePath = raw.slice('file:'.length)
  } else {
    filePath = './db/custom.db'
  }

  if (!path.isAbsolute(filePath)) {
    // Strip any leading ./ or ../ segments and re-anchor at the project root
    // (the working directory). This keeps a single canonical DB location
    // regardless of where the bundled code physically lives.
    const cleaned = filePath.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '')
    filePath = path.resolve(process.cwd(), cleaned)
  }

  return `file:${filePath}`
}

const databaseUrl = resolveDatabaseUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
