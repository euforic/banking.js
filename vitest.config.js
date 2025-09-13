import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test settings
    globals: true,

    // Test file patterns
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],

    // Test timeout
    testTimeout: 30000,

    // Setup files
    setupFiles: ['./test/setup.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', '*.config.js', 'index.d.ts']
    },

    // Concurrent testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  }
});
