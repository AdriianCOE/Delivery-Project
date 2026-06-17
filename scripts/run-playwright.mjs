import { spawn } from 'node:child_process'
import net from 'node:net'
import { resolve } from 'node:path'

const port = process.env.PLAYWRIGHT_PORT || '5174'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`
const viteBin = resolve('node_modules/vite/bin/vite.js')
const playwrightCli = resolve('node_modules/@playwright/test/cli.js')
const args = ['test', ...process.argv.slice(2)]

function waitForPort(host, targetPort, timeoutMs = 30_000) {
  const startedAt = Date.now()

  return new Promise((resolveReady, rejectReady) => {
    function tryConnect() {
      const socket = net.createConnection({ host, port: Number(targetPort) })

      socket.once('connect', () => {
        socket.end()
        resolveReady()
      })

      socket.once('error', () => {
        socket.destroy()

        if (Date.now() - startedAt > timeoutMs) {
          rejectReady(new Error(`Timed out waiting for ${host}:${targetPort}`))
          return
        }

        setTimeout(tryConnect, 250)
      })
    }

    tryConnect()
  })
}

function stopChild(child) {
  if (!child || child.killed) return Promise.resolve()

  return new Promise((resolveStop) => {
    const timer = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
      resolveStop()
    }, 1_000)

    child.once('exit', () => {
      clearTimeout(timer)
      resolveStop()
    })

    child.kill('SIGTERM')
  })
}

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

let stopping = false

async function shutdown(exitCode) {
  if (stopping) return
  stopping = true
  await stopChild(vite)
  process.exit(exitCode)
}

process.on('SIGINT', () => shutdown(130))
process.on('SIGTERM', () => shutdown(143))

try {
  await waitForPort('127.0.0.1', port)

  const playwright = spawn(process.execPath, [playwrightCli, ...args], {
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseURL,
      PLAYWRIGHT_SKIP_WEBSERVER: '1',
      VITE_PLAYWRIGHT_FIXTURES: process.env.VITE_PLAYWRIGHT_FIXTURES || 'true',
    },
    stdio: 'inherit',
    windowsHide: true,
  })

  playwright.on('exit', (code, signal) => {
    if (signal) {
      shutdown(1)
      return
    }

    shutdown(code ?? 1)
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await shutdown(1)
}
