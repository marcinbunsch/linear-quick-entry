import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths: the native app serves the build from lqe://app/, not from a server root.
  base: './',
  server: { port: 5173, strictPort: true },
  // The bundle is read from the app's own Resources once per launch, so its size never crosses a network.
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
