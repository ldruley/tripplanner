import { LoggerService, Logger } from '@nestjs/common';

/**
 * Creates a mock logger that suppresses all console output during tests
 * Use this to prevent console pollution during test execution
 */
export const createMockLogger = (): LoggerService => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  fatal: jest.fn(),
});

/**
 * Creates a selective mock logger that allows certain log levels to pass through
 * Useful for debugging specific test scenarios
 */
export const createSelectiveLogger = (allowLevels: string[] = []): LoggerService => ({
  log: allowLevels.includes('log') ? console.log : jest.fn(),
  error: allowLevels.includes('error') ? console.error : jest.fn(),
  warn: allowLevels.includes('warn') ? console.warn : jest.fn(),
  debug: allowLevels.includes('debug') ? console.debug : jest.fn(),
  verbose: allowLevels.includes('verbose') ? console.log : jest.fn(),
  fatal: allowLevels.includes('fatal') ? console.error : jest.fn(),
});

/**
 * Creates a logger that respects TEST_VERBOSE environment variable
 * Set TEST_VERBOSE=true to enable console output during tests
 */
export const createTestLogger = (): LoggerService => {
  const isVerbose = process.env['TEST_VERBOSE'] === 'true';
  const isDebug = process.env['TEST_DEBUG'] === 'true';

  return {
    log: isVerbose ? console.log : jest.fn(),
    error: isDebug ? console.error : jest.fn(),
    warn: isDebug ? console.warn : jest.fn(),
    debug: isDebug ? console.debug : jest.fn(),
    verbose: jest.fn(), // Always suppress verbose
    fatal: isDebug ? console.error : jest.fn(),
  };
};

/**
 * Mocks the NestJS Logger class to suppress all new Logger() instances
 * Call this in beforeAll to suppress logger output from services that create their own Logger instances
 */
export const mockLoggerClass = () => {
  // Mock the constructor by replacing the prototype methods
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

  // Mock static methods that might be called
  jest.spyOn(Logger, 'log').mockImplementation();
  jest.spyOn(Logger, 'error').mockImplementation();
  jest.spyOn(Logger, 'warn').mockImplementation();
  jest.spyOn(Logger, 'debug').mockImplementation();
  jest.spyOn(Logger, 'verbose').mockImplementation();
};

/**
 * Restores the original Logger class behavior
 * Call this in afterAll to restore normal logging
 */
export const restoreLoggerClass = () => {
  jest.restoreAllMocks();
};
