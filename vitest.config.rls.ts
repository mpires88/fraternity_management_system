import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * RLS persona suite — runs against the LIVE dev database with real logins.
 * Kept out of `npm run check` (which must pass offline); run explicitly with
 * `npm run test:rls`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/rls/setup-env.ts'],
    include: ['test/rls/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
