import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import fs from 'node:fs'

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
    // Strip any leading ./ or ../ segments and re-anchor at the project root.
    const cleaned = filePath.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '')
    filePath = path.resolve(projectRoot(), cleaned)
  }

  return `file:${filePath}`
}

/**
 * Determine the project root regardless of where the bundled server runs from.
 *
 * Next.js `standalone` output chdir's the server into `.next/standalone/`, so
 * `process.cwd()` is NOT the project root there. We therefore walk up from cwd
 * looking for an anchor (the `db` folder, `prisma/schema.prisma`, or a
 * `package.json`), and also special-case the standalone directory. This keeps a
 * single canonical SQLite location in dev and in the standalone server.
 */
function projectRoot(): string {
  let dir = process.cwd()

  // Next standalone: cwd ends with .next/standalone → go up two levels.
  const standalone = path.join('.next', 'standalone')
  if (dir.endsWith(standalone)) {
    return path.resolve(dir, '..', '..')
  }

  // Walk up to find a directory that looks like the project root.
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(dir, 'db')) ||
      fs.existsSync(path.join(dir, 'prisma', 'schema.prisma'))
    ) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
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
