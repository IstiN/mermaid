import { defineConfig } from 'vitest/config';
import jison from '../../.vite/jisonPlugin.js';
import jsonSchemaPlugin from '../../.vite/jsonSchemaPlugin.js';

export default defineConfig({
  define: {
    'injected.version': "'0.0.0-headless'",
    'injected.includeLargeFeatures': 'true',
  },
  resolve: {
    alias: {
      mermaid: new URL('../mermaid/src/mermaid.ts', import.meta.url).pathname,
    },
  },
  plugins: [
    jison(),
    jsonSchemaPlugin(),
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
