import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/'
const buildId = process.env.GITHUB_SHA
  ? `${process.env.GITHUB_SHA.slice(0, 8)}-${Date.now().toString(36)}`
  : Date.now().toString(36)

function emitBuildVersionPlugin(currentBuildId: string): Plugin {
  const payload = JSON.stringify({ buildId: currentBuildId })

  const serveVersionJson = (
    reqUrl: string | undefined,
    res: { setHeader: (k: string, v: string) => void; end: (body: string) => void },
    next: () => void,
  ) => {
    const pathname = reqUrl?.split('?')[0] ?? ''
    if (pathname.endsWith('/version.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      res.end(payload)
      return
    }
    next()
  }

  return {
    name: 'emit-build-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payload,
      })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => serveVersionJson(req.url, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => serveVersionJson(req.url, res, next))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), emitBuildVersionPlugin(buildId)],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'data-vendor': ['@tanstack/react-query', 'axios'],
        },
      },
    },
  },
})
