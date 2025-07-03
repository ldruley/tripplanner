import { Test, TestingModule } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import {
  createMockLogger,
  createTestLogger,
  mockLoggerClass,
  restoreLoggerClass,
} from './logger-mock';

/**
 * Creates a TestingModule with suppressed logging to prevent console pollution
 * Use this instead of Test.createTestingModule() for cleaner test output
 * This also mocks the Logger class to suppress new Logger() instances
 */
export const createSilentTestModule = async (metadata: ModuleMetadata): Promise<TestingModule> => {
  // Mock Logger class before module compilation
  mockLoggerClass();

  const module = await Test.createTestingModule(metadata).setLogger(createMockLogger()).compile();

  return module;
};

/**
 * Creates a TestingModule with environment-aware logging
 * Respects TEST_VERBOSE and TEST_DEBUG environment variables
 */
export const createTestModuleWithLogger = async (
  metadata: ModuleMetadata,
  customLogger?: any,
): Promise<TestingModule> => {
  const logger = customLogger || createTestLogger();

  return await Test.createTestingModule(metadata).setLogger(logger).compile();
};

/**
 * Creates a TestingModule with a custom mock logger injected as a provider
 * Use this when services have Logger dependency injection
 */
export const createTestModuleWithLoggerDI = async (
  metadata: ModuleMetadata,
  customLogger?: any,
): Promise<TestingModule> => {
  const logger = customLogger || createMockLogger();

  return await Test.createTestingModule({
    ...metadata,
    providers: [
      ...(metadata.providers || []),
      {
        provide: Logger,
        useValue: logger,
      },
    ],
  })
    .setLogger(logger)
    .compile();
};

/**
 * Utility function to suppress console output during test execution
 * Use this in describe blocks to wrap test suites
 */
export const withSuppressedConsole = (testFn: () => void) => {
  const consoleMethods = ['log', 'warn', 'error', 'debug'] as const;
  const spies: jest.SpyInstance[] = [];

  beforeAll(() => {
    consoleMethods.forEach(method => {
      spies.push(jest.spyOn(console, method).mockImplementation());
    });
  });

  afterAll(() => {
    spies.forEach(spy => spy.mockRestore());
  });

  return testFn;
};
