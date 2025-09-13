# Banking.js Integration Test Suite

This directory contains comprehensive integration tests for the Banking.js
library, providing reliable testing coverage for OFX connectivity and parsing
across multiple major financial institutions.

## Overview

The test suite includes:

- **Integration tests** for 5 major banks (Wells Fargo, Discover, Chase, Bank of
  America, US Bank)
- **Comprehensive error handling** tests for network, OFX protocol, and parsing
  errors
- **Edge case testing** for boundary conditions, special characters, and unusual
  scenarios
- **Mock HTTP server** setup for reliable CI/CD testing
- **Sandbox mode support** for testing against real bank environments

## Quick Start

```bash
# Run all integration tests (mock mode)
npm test

# Run integration tests only
npm run test:integration

# Run with coverage report
npm run test:coverage

# Run in watch mode for development
npm run test:watch

# Open Vitest UI
npm run test:ui

# Run legacy Mocha tests
npm run test:legacy
```

## Test Structure

```
test/
├── README.md                      # This file
├── setup.js                       # Global test setup and configuration
├── test-runner.js                 # Custom test runner with advanced options
├── fixtures/
│   ├── data.js                    # Legacy test data
│   ├── responses.js               # Mock OFX responses for all banks
│   ├── sample.ofx                 # Sample OFX files
│   └── sample-with-end-tags.ofx
├── integration/
│   ├── wells-fargo.test.js        # Wells Fargo integration tests
│   ├── discover.test.js           # Discover Financial tests
│   ├── chase.test.js              # Chase Bank tests
│   ├── bank-of-america.test.js    # Bank of America tests
│   ├── us-bank.test.js            # US Bank tests
│   ├── error-handling.test.js     # Comprehensive error scenarios
│   └── edge-cases.test.js         # Edge cases and boundary testing
└── parsing.js                     # Legacy parsing tests (Mocha)
```

## Test Modes

### Mock Mode (Default)

Uses [nock](https://github.com/nock/nock) to intercept HTTP requests and return
predefined responses. This mode:

- ✅ Runs completely offline
- ✅ Fast and reliable for CI/CD
- ✅ No real bank credentials required
- ✅ Tests OFX parsing and error handling

### Sandbox Mode

Attempts to connect to real bank sandbox environments (where available):

- 🏖️ Tests actual network connectivity
- 🏖️ Validates real OFX endpoints
- ⚠️ Requires sandbox credentials
- ⚠️ May be slower and less reliable

```bash
# Run in sandbox mode
node test/test-runner.js --sandbox

# Run specific bank in sandbox mode
node test/test-runner.js --sandbox --bank wells-fargo
```

## Supported Banks

Each bank has comprehensive test coverage including:

| Bank               | FID  | Test Coverage | Sandbox Support |
| ------------------ | ---- | ------------- | --------------- |
| Wells Fargo        | 3001 | ✅ Full       | 🔶 Limited      |
| Discover Financial | 7101 | ✅ Full       | 🔶 Limited      |
| Chase Bank         | 636  | ✅ Full       | ❌ No           |
| Bank of America    | 5959 | ✅ Full       | ❌ No           |
| US Bank            | 1001 | ✅ Full       | 🔶 Limited      |

### Test Coverage Per Bank

- ✅ Statement retrieval (`getStatement`)
- ✅ Account listing (`getAccounts`)
- ✅ Authentication error handling
- ✅ Network error scenarios
- ✅ OFX parsing validation
- ✅ Bank-specific features
- ✅ Edge cases and boundary conditions

## Advanced Usage

### Custom Test Runner

The `test-runner.js` script provides advanced options:

```bash
# Show all available options
node test/test-runner.js --help

# Run specific bank with verbose output
node test/test-runner.js --bank chase --verbose

# Run with coverage and timeout adjustment
node test/test-runner.js --coverage --timeout 60000

# Serial execution for debugging
node test/test-runner.js --serial --verbose
```

### Environment Variables

Configure test behavior with environment variables:

```bash
# Enable debug logging
DEBUG=banking:* npm test

# Set custom timeout
BANKING_REQUEST_TIMEOUT=30000 npm test

# CI mode (affects output format)
CI=true npm test

# Sandbox mode with credentials
BANKING_TEST_MODE=sandbox npm test
```

## Writing New Tests

### Adding a New Bank

1. **Create test file**: `test/integration/new-bank.test.js`
2. **Add bank config**: Update `bankConfigs` in `fixtures/responses.js`
3. **Create mock responses**: Add OFX response fixtures
4. **Update test runner**: Add bank name to `supportedBanks` array

### Test Structure Template

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import { bankConfigs } from '../fixtures/responses.js';

describe('New Bank Integration Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.newBank);
  });

  describe('getStatement', () => {
    it('should successfully retrieve statement', done => {
      nock('https://bank-ofx-endpoint.com')
        .post('/ofx')
        .reply(200, mockResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        // Add specific assertions
        done();
      });
    });
  });
});
```

## Best Practices

### Test Isolation

- Each test cleans up HTTP mocks automatically
- No shared state between tests
- Deterministic test execution

### Error Handling

- Test both success and failure scenarios
- Verify specific error codes and messages
- Test network timeouts and retries

### Mock Responses

- Use realistic OFX data structures
- Include edge cases in fixtures
- Maintain consistency with real bank responses

### Performance

- Tests run in parallel by default
- Use `--serial` flag for debugging
- Timeout configuration for slow connections

## Troubleshooting

### Common Issues

**Tests failing with connection errors:**

```bash
# Check if nock is properly mocking requests
DEBUG=nock* npm test
```

**Timeout errors:**

```bash
# Increase timeout
node test/test-runner.js --timeout 60000
```

**Parsing errors:**

```bash
# Run with verbose output
node test/test-runner.js --verbose
```

### Debugging

1. **Enable debug logging:**

   ```bash
   DEBUG=banking:* npm test
   ```

2. **Run single test file:**

   ```bash
   npx vitest run test/integration/wells-fargo.test.js
   ```

3. **Use Vitest UI for interactive debugging:**
   ```bash
   npm run test:ui
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Integration Tests
  run: |
    npm run test:coverage
  env:
    CI: true
    NODE_ENV: test
```

### Test Reports

Coverage reports are generated in:

- `coverage/` directory (HTML)
- Console output (text)
- JSON format for CI tools

## Contributing

When contributing new tests:

1. Follow existing patterns and structure
2. Add both positive and negative test cases
3. Include comprehensive error handling
4. Update this README if adding new features
5. Ensure all tests pass in both mock and sandbox modes

## Security Notes

- **Never commit real bank credentials**
- Use environment variables for sandbox testing
- Mock sensitive data in fixtures
- Follow responsible disclosure for security issues

---

For more information about the Banking.js library, see the main
[README.md](../README.md).
