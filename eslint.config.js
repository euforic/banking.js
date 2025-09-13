const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const promise = require('eslint-plugin-promise');
const n = require('eslint-plugin-n');
const stylistic = require('@stylistic/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'test-results.json',
      '*.log',
      '.eslintcache',
      '.env*',
      '.DS_Store',
      'tmp/**',
      'temp/**'
    ]
  },

  // Apply to all JavaScript files
  {
    files: ['**/*.js'],
    plugins: {
      security,
      promise,
      n,
      '@stylistic': stylistic
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      parserOptions: {
        ecmaFeatures: {
          impliedStrict: true
        }
      },
      globals: {
        // Node.js globals
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        fetch: 'readonly', // Node.js 18+ native fetch
        // Test globals for older test frameworks
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        should: 'readonly'
      }
    },
    rules: {
      // Base ESLint recommended rules
      ...js.configs.recommended.rules,

      // Modern JavaScript best practices (relaxed for legacy banking code)
      'prefer-const': 'warn',
      'no-var': 'warn',
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      'template-curly-spacing': ['error', 'never'],

      // Error handling for financial code
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-implicit-coercion': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',

      // Code quality and consistency
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'consistent-return': 'off', // Not always applicable in callback-style APIs
      'default-case-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      radix: 'error',

      // Max line length (Prettier handles formatting, but we keep logical limits)
      'max-len': [
        'error',
        {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true
        }
      ],

      // Financial/Banking specific patterns
      'no-floating-decimal': 'error',
      'no-magic-numbers': [
        'warn',
        {
          ignore: [-1, 0, 1, 2, 3, 5, 8, 10, 16, 19, 20, 32, 36, 100, 200, 1000, 10000000],
          ignoreArrayIndexes: true
        }
      ],

      // Async/await best practices
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-promise-executor-return': 'error',
      'require-atomic-updates': 'error',

      // Disable for complex OFX regex patterns
      'no-useless-escape': 'off',

      // ===== SECURITY RULES (Critical for banking operations) =====
      // Enable all security plugin rules
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'off', // Legitimate use in banking lib for parsing files
      'security/detect-non-literal-regexp': 'error', // Critical for ReDoS prevention
      'security/detect-non-literal-require': 'error',
      'security/detect-object-injection': 'warn', // Warn instead of error for legitimate object access
      'security/detect-possible-timing-attacks': 'error', // Critical for auth/crypto
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'warn', // Critical RegExp safety - warn for legacy patterns

      // ===== NODE.JS BEST PRACTICES =====
      'n/no-deprecated-api': 'warn', // Warn about deprecated APIs but don't fail
      'n/no-extraneous-import': 'error',
      'n/no-missing-import': 'error',
      'n/no-unpublished-import': 'error',
      'n/process-exit-as-throw': 'error',
      'n/no-process-exit': 'warn',

      // ===== PROMISE BEST PRACTICES =====
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-native': 'off',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/avoid-new': 'off', // Allow new Promise for legitimate cases
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'warn',
      'promise/valid-params': 'warn',

      // ===== STYLISTIC RULES (Non-conflicting with Prettier) =====
      // Note: Most stylistic rules are handled by Prettier
      // Only keeping rules that relate to code logic, not formatting
      '@stylistic/no-extra-semi': 'error', // Logical issue, not just formatting
      '@stylistic/no-floating-decimal': 'error' // Important for financial calculations
    }
  },

  // Test files specific configuration
  {
    files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-magic-numbers': 'off',
      'no-console': 'off',
      'no-unused-vars': 'warn', // Allow unused vars in test files
      'max-len': ['error', { code: 150 }]
    }
  },

  // Test fixture files (data files can have long lines)
  {
    files: ['test/fixtures/**/*.js'],
    rules: {
      'max-len': 'off',
      'no-magic-numbers': 'off',
      'no-console': 'off'
    }
  },

  // Configuration files
  {
    files: ['*.config.js', '*.config.mjs'],
    rules: {
      'no-console': 'off',
      'no-magic-numbers': 'off',
      'n/no-unpublished-import': 'off', // Config files need devDependencies
      'max-len': 'off' // Config files can be longer
    }
  },

  // Prettier integration - must be last to override conflicting rules
  prettierConfig
];
