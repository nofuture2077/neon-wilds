import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'client',
    include: ['src/**/*.test.ts'],
    // Simulation-heavy tests run several times slower on shared CI runners.
    testTimeout: 30_000,
    environment: 'node',
  },
});
