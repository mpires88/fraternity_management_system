/**
 * Structured logger with child scoping.
 *
 * Dev:  pretty console output with context
 * Prod: JSON lines (ready for log aggregation)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
const IS_PROD = process.env.NODE_ENV === 'production'

interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(error: unknown, context?: LogContext): void
  child(defaultContext: LogContext): Logger
}

function createLogger(defaultContext: LogContext = {}): Logger {
  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
  }

  function log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level)) return
    const merged = { ...defaultContext, ...context }

    if (IS_PROD) {
      const entry = { timestamp: new Date().toISOString(), level, message, ...merged }
      if (level === 'error') console.error(JSON.stringify(entry))
      else if (level === 'warn') console.warn(JSON.stringify(entry))
      else console.log(JSON.stringify(entry))
    } else {
      const prefix = Object.keys(merged).length
        ? `[${Object.entries(merged)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')}]`
        : ''
      const tag = `[${level.toUpperCase()}]`
      if (level === 'error') console.error(tag, prefix, message)
      else if (level === 'warn') console.warn(tag, prefix, message)
      else console.log(tag, prefix, message)
    }
  }

  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (error, ctx) => {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      log('error', message, { ...ctx, ...(stack ? { stack } : {}) })
      // Forward to Sentry if available
      forwardToSentry(error, { ...defaultContext, ...ctx })
    },
    child: (childContext) => createLogger({ ...defaultContext, ...childContext }),
  }
}

async function forwardToSentry(error: unknown, extra: Record<string, unknown>): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs')
    if (error instanceof Error) Sentry.captureException(error, { extra })
    else Sentry.captureMessage(String(error), { level: 'error', extra })
  } catch {
    // Sentry not available
  }
}

export const logger = createLogger()
export type { LogContext, Logger }
