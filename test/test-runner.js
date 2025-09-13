#!/usr/bin/env node
/**
 * Comprehensive Banking.js Test Runner
 *
 * This script runs all integration tests for the banking.js library,
 * supporting both mock mode (default) and sandbox mode with real bank connections.
 *
 * Usage:
 *   npm run test:integration                    # Run all tests in mock mode
 *   node test/test-runner.js --sandbox         # Run tests against sandbox environments
 *   node test/test-runner.js --bank wells      # Run tests for specific bank only
 *   node test/test-runner.js --verbose         # Run with detailed logging
 *   node test/test-runner.js --help            # Show help
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

// Configuration
const config = {
  timeout: 30000,
  retries: 2,
  parallel: true,
  coverage: false,
  ui: false,
  watch: false,
  sandbox: false,
  verbose: false,
  bank: null,
  environment: 'test'
};

// Supported banks
const supportedBanks = ['wells-fargo', 'discover', 'chase', 'bank-of-america', 'us-bank'];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;

      case '--sandbox':
        config.sandbox = true;
        console.log('🏖️  Running in SANDBOX mode - will attempt real bank connections');
        break;

      case '--mock':
        config.sandbox = false;
        console.log('🎭 Running in MOCK mode - using mocked responses');
        break;

      case '--verbose':
      case '-v':
        config.verbose = true;
        break;

      case '--coverage':
        config.coverage = true;
        break;

      case '--ui':
        config.ui = true;
        break;

      case '--watch':
        config.watch = true;
        break;

      case '--parallel':
        config.parallel = true;
        break;

      case '--serial':
        config.parallel = false;
        break;

      case '--bank':
        if (i + 1 < args.length) {
          const bankName = args[i + 1];
          if (supportedBanks.includes(bankName)) {
            config.bank = bankName;
            i++; // Skip next argument
          } else {
            console.error(`❌ Unknown bank: ${bankName}`);
            console.log(`Supported banks: ${supportedBanks.join(', ')}`);
            process.exit(1);
          }
        }
        break;

      case '--timeout':
        if (i + 1 < args.length) {
          config.timeout = parseInt(args[i + 1]);
          i++;
        }
        break;

      case '--retries':
        if (i + 1 < args.length) {
          config.retries = parseInt(args[i + 1]);
          i++;
        }
        break;

      default:
        if (arg.startsWith('--')) {
          console.warn(`⚠️  Unknown option: ${arg}`);
        }
    }
  }
}

function showHelp() {
  console.log(`
Banking.js Integration Test Runner v${packageJson.version}

USAGE:
  npm run test:integration                    Run all integration tests in mock mode
  node test/test-runner.js [OPTIONS]         Run with specific options

OPTIONS:
  --help, -h              Show this help message
  --sandbox               Run tests against sandbox/demo bank environments
  --mock                  Run tests with mocked responses (default)
  --verbose, -v           Enable verbose logging
  --coverage              Generate coverage reports
  --ui                    Open Vitest UI
  --watch                 Watch mode for development
  --parallel              Run tests in parallel (default)
  --serial                Run tests serially
  --bank <name>           Run tests for specific bank only
  --timeout <ms>          Set test timeout in milliseconds (default: 30000)
  --retries <num>         Set number of retries for failed tests (default: 2)

SUPPORTED BANKS:
  ${supportedBanks.map(bank => `  ${bank}`).join('\n')}

EXAMPLES:
  node test/test-runner.js --bank wells-fargo --verbose
  node test/test-runner.js --sandbox --coverage
  node test/test-runner.js --watch --ui

ENVIRONMENT VARIABLES:
  NODE_ENV                Set to 'test' for testing environment
  DEBUG                   Enable debug logging for banking module
  CI                      Continuous Integration mode (affects output format)

TESTING MODES:
  Mock Mode (default):    Uses nock to mock HTTP responses, runs offline
  Sandbox Mode:           Attempts to connect to bank sandbox environments
                         (requires valid sandbox credentials)

For more information, see: https://github.com/euforic/banking.js
`);
}

function buildVitestArgs() {
  const args = [];

  // Basic command
  if (config.watch) {
    args.push('watch');
  } else {
    args.push('run');
  }

  // Test pattern
  if (config.bank) {
    args.push(`test/integration/${config.bank}.test.js`);
  } else {
    args.push('test/integration/');
  }

  // Coverage
  if (config.coverage) {
    args.push('--coverage');
  }

  // UI mode
  if (config.ui) {
    args.push('--ui');
  }

  // Parallel execution
  if (!config.parallel) {
    args.push('--pool', 'forks', '--poolOptions.forks.singleFork');
  }

  // Timeout
  args.push('--testTimeout', config.timeout.toString());

  // Retries
  if (config.retries > 0) {
    args.push('--retry', config.retries.toString());
  }

  // Reporter
  if (process.env.CI) {
    args.push('--reporter', 'json', '--reporter', 'verbose');
  } else if (config.verbose) {
    args.push('--reporter', 'verbose');
  } else {
    args.push('--reporter', 'default');
  }

  return args;
}

function setEnvironmentVariables() {
  // Set test environment
  process.env.NODE_ENV = config.environment;

  // Set sandbox mode flag for tests to read
  if (config.sandbox) {
    process.env.BANKING_TEST_MODE = 'sandbox';
    console.log('⚠️  WARNING: Sandbox mode requires valid bank credentials');
    console.log('   Set environment variables for bank credentials if testing live connections');
  } else {
    process.env.BANKING_TEST_MODE = 'mock';
  }

  // Enable debug logging if verbose
  if (config.verbose) {
    process.env.DEBUG = 'banking:*';
  }

  // Set timeout for HTTP requests
  process.env.BANKING_REQUEST_TIMEOUT = config.timeout.toString();
}

function runTests() {
  return new Promise((resolve, reject) => {
    console.log(`\n🏦 Banking.js Integration Test Suite v${packageJson.version}`);
    console.log(`📊 Running ${config.bank || 'all banks'} tests in ${config.sandbox ? 'SANDBOX' : 'MOCK'} mode\n`);

    const vitestArgs = buildVitestArgs();

    if (config.verbose) {
      console.log('🔧 Vitest command:', 'npx vitest', vitestArgs.join(' '));
    }

    const child = spawn('npx', ['vitest', ...vitestArgs], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', code => {
      if (code === 0) {
        console.log('\n✅ All tests passed!');
        if (config.sandbox) {
          console.log('🏖️  Sandbox tests completed successfully');
        }
        resolve(code);
      } else {
        console.log(`\n❌ Tests failed with exit code ${code}`);
        if (config.sandbox) {
          console.log('🏖️  Note: Sandbox failures may be due to network or credential issues');
        }
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    child.on('error', error => {
      console.error('❌ Failed to run tests:', error.message);
      reject(error);
    });
  });
}

// Main execution
async function main() {
  try {
    parseArgs();
    setEnvironmentVariables();
    await runTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Test runner interrupted');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Test runner terminated');
  process.exit(143);
});

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { config, supportedBanks, buildVitestArgs };
