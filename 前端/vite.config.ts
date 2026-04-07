import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vite'

const currentDir = dirname(fileURLToPath(import.meta.url))

function createMediaProxy(): ProxyOptions {
  return {
    target: 'http://127.0.0.1:8889',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/media/, ''),
    configure: (proxy) => {
      proxy.on('proxyRes', (proxyRes) => {
        const location = proxyRes.headers.location
        if (typeof location !== 'string' || !location.trim()) return

        proxyRes.headers.location = rewriteMediaLocation(location)
      })
    }
  }
}

function rewriteMediaLocation(location: string): string {
  try {
    const parsed = new URL(location, 'http://127.0.0.1:8889')
    const rewrittenPath = parsed.pathname.startsWith('/media/')
      ? parsed.pathname
      : `/media${parsed.pathname}`
    return `${rewrittenPath}${parsed.search}${parsed.hash}`
  } catch {
    if (location.startsWith('/media/')) return location
    if (location.startsWith('/')) return `/media${location}`
    return location
  }
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(currentDir, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: 'ws://localhost:9000',
        ws: true
      },
      '/media': createMediaProxy()
    }
  }
})
