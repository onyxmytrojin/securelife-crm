type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

const C = {
  INFO:  '\x1b[36m',   // cyan
  WARN:  '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',   // red
  DEBUG: '\x1b[35m',   // magenta
  DIM:   '\x1b[2m',
  BOLD:  '\x1b[1m',
  RESET: '\x1b[0m',
}

function stamp() {
  return new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
}

function emit(level: Level, route: string, msg: string, data?: Record<string, unknown>) {
  const badge = `${C[level]}${C.BOLD}[${level}]${C.RESET}`
  const time  = `${C.DIM}${stamp()}${C.RESET}`
  const path  = `${C.BOLD}${route}${C.RESET}`
  const line  = `${badge} ${time} ${path} — ${msg}`
  if (data && Object.keys(data).length) {
    console.log(line, data)
  } else {
    console.log(line)
  }
}

export const logger = {
  info:  (route: string, msg: string, data?: Record<string, unknown>) => emit('INFO',  route, msg, data),
  warn:  (route: string, msg: string, data?: Record<string, unknown>) => emit('WARN',  route, msg, data),
  error: (route: string, msg: string, data?: Record<string, unknown>) => emit('ERROR', route, msg, data),
  debug: (route: string, msg: string, data?: Record<string, unknown>) => emit('DEBUG', route, msg, data),
}
