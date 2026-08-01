import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.d.ts',
        '**/types/**',
        '**/index.ts',
        '**/*.test.ts',
        '**/dist/**',
        '**/node_modules/**',
        'vitest.config.ts',
        'prisma/**',
        'src/main.ts',
        // Controllers and gateways with heavy NestJS/WS infra — cover via service tests
        'src/gateways/chat.gateway.ts',
        'src/gateways/socket-auth.guard.ts',
        'src/gateways/message-handlers/**',
        'src/**/dto/**',
        'src/**/*.dto.ts',
        'src/**/constants.ts',
        'src/**/*.controller.ts',
        'src/**/*.module.ts',
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
