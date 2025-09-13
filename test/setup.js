import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

// Global test setup
beforeAll(() => {
  // Disable real HTTP requests during tests
  nock.disableNetConnect();

  // Allow localhost for local testing
  nock.enableNetConnect('127.0.0.1');
  nock.enableNetConnect('localhost');
});

beforeEach(() => {
  // Clear any existing nock interceptors
  nock.cleanAll();
});

afterEach(() => {
  // Clean up nock interceptors after each test
  nock.cleanAll();
});

afterAll(() => {
  // Restore HTTP connections after all tests
  nock.enableNetConnect();
  nock.restore();
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
