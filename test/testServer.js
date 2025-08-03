const { spawn } = require('child_process')
const path = require('path')

let serverProcess = null
const serverPort = 4318
const startedServers = new Set()

/**
 * Get a unique port for each test file to avoid conflicts
 */
function getUniquePort(testFile) {
  if (startedServers.has(testFile)) {
    return serverPort
  }

  // Increment port for each new test file
  const port = serverPort + startedServers.size
  startedServers.add(testFile)
  return port
}

/**
 * Start a test server with unique port
 */
async function startTestServer(testFile, customEnv = {}) {
  const port = getUniquePort(testFile)
  const baseUrl = `http://127.0.0.1:${port}`

  const env = {
    ...process.env,
    LANGFUSE_PUBLIC_KEY: 'test-public-key',
    LANGFUSE_SECRET_KEY: 'test-secret-key',
    LANGFUSE_HOST: 'http://localhost:3000',
    OTLP_RECEIVER_PORT: port.toString(),
    LOG_LEVEL: 'error',
    NODE_ENV: 'test',
    ...customEnv,
  }

  // Explicitly remove API_KEY if not provided
  if (!customEnv.API_KEY) {
    delete env.API_KEY
  }

  // Start server
  serverProcess = spawn('node', [path.join(__dirname, '..', 'src', 'server.js')], {
    env,
    detached: process.platform !== 'win32',
    stdio: process.env.DEBUG_TESTS ? 'inherit' : 'ignore',
  })

  // Store reference for cleanup
  serverProcess.testFile = testFile
  serverProcess.port = port

  // Wait for server to be ready
  const maxAttempts = 20
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) {
        return { serverProcess, baseUrl, port }
      }
    } catch (e) {
      // Server not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }

  throw new Error(`Server failed to start on port ${port} after ${maxAttempts} attempts`)
}

/**
 * Stop test server and ensure port is freed
 */
async function stopTestServer(serverProcess) {
  if (!serverProcess) return

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t'])
    } else {
      // Try to kill the process group
      process.kill(-serverProcess.pid, 'SIGTERM')
    }
  } catch (err) {
    // Process might already be dead, which is fine
    if (err.code !== 'ESRCH') {
      console.error('Error killing server process:', err)
    }
  }

  // Wait for process to exit
  await new Promise(resolve => {
    if (serverProcess.exitCode !== null) {
      resolve()
      return
    }

    serverProcess.on('exit', resolve)
    // Force kill after timeout
    setTimeout(() => {
      try {
        process.kill(serverProcess.pid, 'SIGKILL')
      } catch (e) {
        // Ignore
      }
      resolve()
    }, 3000)
  })

  // Small delay to ensure port is released
  await new Promise(resolve => setTimeout(resolve, 100))
}

/**
 * Reset for new test run
 */
function resetServers() {
  startedServers.clear()
}

module.exports = {
  startTestServer,
  stopTestServer,
  resetServers,
}
