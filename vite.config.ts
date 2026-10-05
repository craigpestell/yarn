import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['test/*.test.ts', 'test/agents/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/editor/**/*.test.{ts,tsx}', 'test/app/**/*.test.{ts,tsx}', 'test/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['test/editor/setup.ts'],
          testTimeout: 20000,
        },
      },
    ],
  },
})
