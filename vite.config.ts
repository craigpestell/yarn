import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['test/*.test.ts', 'test/agents/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/editor/**/*.test.{ts,tsx}', 'test/app/**/*.test.{ts,tsx}'],
          setupFiles: ['test/editor/setup.ts'],
          testTimeout: 20000,
        },
      },
    ],
  },
})
