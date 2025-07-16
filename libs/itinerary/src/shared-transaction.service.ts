import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';

export interface TransactionOptions {
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  timeout?: number;
}

export interface TransactionContext {
  operationType: string;
  entityId: string;
  userId?: string;
}

@Injectable()
export class SharedTransactionService {
  private readonly logger = new Logger(SharedTransactionService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Execute a function within a transaction with standardized error handling and logging.
   * Provides consistent transaction management across all batch operations.
   */
  async executeInTransaction<T>(
    operation: (prismaClient: PrismaClientOrTransaction) => Promise<T>,
    context: TransactionContext,
    options: TransactionOptions = {},
  ): Promise<T> {
    const startTime = Date.now();
    this.logger.debug(
      `[TRANSACTION] Starting ${context.operationType} for ${context.entityId}${
        context.userId ? ` (user: ${context.userId})` : ''
      }`,
    );

    try {
      const result = await this.prismaService.$transaction(operation, {
        isolationLevel: options.isolationLevel,
        timeout: options.timeout || 30000, // 30 second default timeout
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[TRANSACTION] Completed ${context.operationType} for ${context.entityId} in ${duration}ms`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[TRANSACTION] Failed ${context.operationType} for ${context.entityId} after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Execute multiple operations within a single transaction with atomic rollback.
   * Useful for complex batch operations that need all-or-nothing semantics.
   */
  async executeMultipleInTransaction<T>(
    operations: Array<{
      name: string;
      operation: (prismaClient: PrismaClientOrTransaction) => Promise<any>;
    }>,
    context: TransactionContext,
    options: TransactionOptions = {},
  ): Promise<T[]> {
    return this.executeInTransaction(
      async (prismaClient) => {
        const results: T[] = [];
        
        for (const { name, operation } of operations) {
          this.logger.debug(`[TRANSACTION] Executing ${name} for ${context.entityId}`);
          const result = await operation(prismaClient);
          results.push(result);
        }
        
        return results;
      },
      {
        ...context,
        operationType: `${context.operationType} (${operations.length} operations)`,
      },
      options,
    );
  }

  /**
   * Execute operations in parallel within a transaction when order doesn't matter.
   * Provides better performance for independent operations.
   */
  async executeParallelInTransaction<T>(
    operations: Array<{
      name: string;
      operation: (prismaClient: PrismaClientOrTransaction) => Promise<any>;
    }>,
    context: TransactionContext,
    options: TransactionOptions = {},
  ): Promise<T[]> {
    return this.executeInTransaction(
      async (prismaClient) => {
        this.logger.debug(
          `[TRANSACTION] Executing ${operations.length} parallel operations for ${context.entityId}`,
        );
        
        const promises = operations.map(({ operation }) => operation(prismaClient));
        return Promise.all(promises);
      },
      {
        ...context,
        operationType: `${context.operationType} (${operations.length} parallel ops)`,
      },
      options,
    );
  }
}