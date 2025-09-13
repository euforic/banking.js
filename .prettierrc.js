module.exports = {
  // Core formatting options aligned with ESLint rules
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'none',

  // Indentation and line length
  tabWidth: 2,
  useTabs: false,
  printWidth: 120, // Matches ESLint max-len rule

  // Bracket and spacing configuration
  bracketSpacing: true,
  bracketSameLine: false, // Also applies to JSX (replaces deprecated jsxBracketSameLine)

  // Arrow function parentheses - consistent style
  arrowParens: 'avoid',

  // End of line consistency (important for cross-platform banking systems)
  endOfLine: 'lf',

  // Prose wrapping for documentation
  proseWrap: 'preserve',

  // HTML and template formatting
  htmlWhitespaceSensitivity: 'css',

  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',

  // JSX configuration (if needed for React components in the future)
  jsxSingleQuote: true,

  // File-specific overrides for banking/financial code
  overrides: [
    {
      // Test files can have slightly longer lines for readability
      files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
      options: {
        printWidth: 150
      }
    },
    {
      // Fixture files may contain long data strings - minimal formatting
      files: ['test/fixtures/**/*.js'],
      options: {
        printWidth: 200,
        // Preserve exact formatting for financial data fixtures
        proseWrap: 'never'
      }
    },
    {
      // Configuration files
      files: ['*.config.js', '*.config.mjs', 'eslint.config.js', 'vitest.config.js'],
      options: {
        printWidth: 120,
        // Allow longer expressions in config files
        arrowParens: 'always'
      }
    },
    {
      // Markdown documentation files
      files: ['*.md', '*.markdown'],
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2
      }
    },
    {
      // JSON configuration files
      files: ['*.json', '.prettierrc', '.eslintrc'],
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      // Package.json formatting
      files: ['package.json'],
      options: {
        printWidth: 120,
        tabWidth: 2,
        // Keep package.json organized and readable
        trailingComma: 'none'
      }
    }
  ]
};
