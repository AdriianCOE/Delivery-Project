import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const port = process.env.PLAYWRIGHT_PORT || '5174'
const viteBin = resolve('node_modules/vite/bin/vite.js')

const vite = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', port],
  {
    env: {
      ...process.env,
      VITE_PLAYWRIGHT_FIXTURES: process.env.VITE_PLAYWRIGHT_FIXTURES || 'true',
    },
    stdio: 'inherit',
    windowsHide: true,
  }
)

let shuttingDown = false

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true

  if (!vite.killed) {
    vite.kill(signal)
  }

  setTimeout(() => {
    process.exit(0)
  }, 500).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

vite.on('exit', (code, signal) => {
  if (shuttingDown) {
    process.exit(0)
  }

  if (signal) {
    process.exit(0)
  }

  process.exit(code ?? 1)
})
