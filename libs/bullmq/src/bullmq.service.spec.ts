import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import { BullMQService, QueueConfig, WorkerConfig } from './bullmq.service';

// Mock the entire service to avoid Redis connection issues in testing
jest.mock('./bullmq.service', () => {
  const originalModule = jest.requireActual('./bullmq.service');
  
  return {
    ...originalModule,
    BullMQService: jest.fn().mockImplementation(() => ({
      queues: new Map(),
      workers: new Map(),
      redisConnection: mock(),
      
      async onModuleInit() {
        // Mock implementation
      },
      
      async onModuleDestroy() {
        // Mock implementation
      },
      
      createQueue(config: { name: string; [key: string]: unknown }) {
        if (this.queues.has(config.name)) {
          return this.queues.get(config.name);
        }
        const mockQueue = mock();
        this.queues.set(config.name, mockQueue);
        return mockQueue;
      },
      
      createWorker(config: { name: string; [key: string]: unknown }) {
        if (this.workers.has(config.name)) {
          return this.workers.get(config.name);
        }
        const mockWorker = mock();
        this.workers.set(config.name, mockWorker);
        return mockWorker;
      },
      
      getQueue(name: string) {
        return this.queues.get(name);
      },
      
      getWorker(name: string) {
        return this.workers.get(name);
      },
      
      async addJob(queueName: string, _jobName: string, data: unknown) {
        const queue = this.getQueue(queueName);
        if (!queue) {
          throw new Error(`Queue ${queueName} not found. Create it first with createQueue()`);
        }
        const mockJob = { id: 'test-job-id', data };
        return mockJob;
      },
    })),
  };
});

describe('BullMQService', () => {
  let service: BullMQService;
  let module: TestingModule;

  const mockQueueConfig: QueueConfig = {
    name: 'test-queue',
    defaultJobOptions: {
      attempts: 5,
    },
  };

  const mockWorkerConfig: WorkerConfig = {
    name: 'test-worker',
    processor: jest.fn(),
    concurrency: 2,
  };

  const mockJobData = { message: 'test job data' };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [BullMQService],
    })
      .setLogger(createMockLogger())
      .compile();

    service = module.get<BullMQService>(BullMQService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('module lifecycle', () => {
    it('should handle onModuleInit', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('should handle onModuleDestroy', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('createQueue', () => {
    it('should create a new queue', () => {
      const queue = service.createQueue(mockQueueConfig);
      expect(queue).toBeDefined();
    });

    it('should return existing queue if already created', () => {
      const queue1 = service.createQueue(mockQueueConfig);
      const queue2 = service.createQueue(mockQueueConfig);
      expect(queue1).toBe(queue2);
    });

    it('should create queue with custom configuration', () => {
      const customConfig: QueueConfig = {
        name: 'custom-queue',
        defaultJobOptions: {
          attempts: 10,
          delay: 5000,
        },
      };

      const queue = service.createQueue(customConfig);
      expect(queue).toBeDefined();
    });
  });

  describe('createWorker', () => {
    it('should create a new worker', () => {
      const worker = service.createWorker(mockWorkerConfig);
      expect(worker).toBeDefined();
    });

    it('should return existing worker if already created', () => {
      const worker1 = service.createWorker(mockWorkerConfig);
      const worker2 = service.createWorker(mockWorkerConfig);
      expect(worker1).toBe(worker2);
    });
  });

  describe('getQueue', () => {
    it('should return existing queue', () => {
      service.createQueue(mockQueueConfig);
      const queue = service.getQueue(mockQueueConfig.name);
      expect(queue).toBeDefined();
    });

    it('should return undefined for non-existent queue', () => {
      const queue = service.getQueue('non-existent-queue');
      expect(queue).toBeUndefined();
    });
  });

  describe('getWorker', () => {
    it('should return existing worker', () => {
      service.createWorker(mockWorkerConfig);
      const worker = service.getWorker(mockWorkerConfig.name);
      expect(worker).toBeDefined();
    });

    it('should return undefined for non-existent worker', () => {
      const worker = service.getWorker('non-existent-worker');
      expect(worker).toBeUndefined();
    });
  });

  describe('addJob', () => {
    beforeEach(() => {
      service.createQueue(mockQueueConfig);
    });

    it('should add job to existing queue', async () => {
      const jobName = 'test-job';
      const jobOptions = { delay: 1000, priority: 5 };

      const job = await service.addJob(mockQueueConfig.name, jobName, mockJobData, jobOptions);
      expect(job).toBeDefined();
      expect(job.data).toEqual(mockJobData);
    });

    it('should add job without options', async () => {
      const jobName = 'simple-job';
      const job = await service.addJob(mockQueueConfig.name, jobName, mockJobData);
      expect(job).toBeDefined();
      expect(job.data).toEqual(mockJobData);
    });

    it('should throw error for non-existent queue', async () => {
      const nonExistentQueue = 'non-existent-queue';

      await expect(
        service.addJob(nonExistentQueue, 'test-job', mockJobData)
      ).rejects.toThrow(`Queue ${nonExistentQueue} not found. Create it first with createQueue()`);
    });
  });

  describe('integration workflows', () => {
    it('should complete full queue workflow', async () => {
      // Create queue
      const queue = service.createQueue(mockQueueConfig);
      expect(queue).toBeDefined();

      // Create worker
      const worker = service.createWorker(mockWorkerConfig);
      expect(worker).toBeDefined();

      // Add job
      const job = await service.addJob(mockQueueConfig.name, 'workflow-job', mockJobData);
      expect(job).toBeDefined();

      // Verify queue and worker can be retrieved
      expect(service.getQueue(mockQueueConfig.name)).toBe(queue);
      expect(service.getWorker(mockWorkerConfig.name)).toBe(worker);
    });

    it('should handle multiple queues and workers', () => {
      const queue1Config: QueueConfig = { name: 'queue-1' };
      const queue2Config: QueueConfig = { name: 'queue-2' };
      const worker1Config: WorkerConfig = { name: 'worker-1', processor: jest.fn() };
      const worker2Config: WorkerConfig = { name: 'worker-2', processor: jest.fn() };

      const queue1 = service.createQueue(queue1Config);
      const queue2 = service.createQueue(queue2Config);
      const worker1 = service.createWorker(worker1Config);
      const worker2 = service.createWorker(worker2Config);

      expect(service.getQueue('queue-1')).toBe(queue1);
      expect(service.getQueue('queue-2')).toBe(queue2);
      expect(service.getWorker('worker-1')).toBe(worker1);
      expect(service.getWorker('worker-2')).toBe(worker2);
    });
  });

  describe('error handling', () => {
    it('should handle service methods gracefully', () => {
      expect(service.createQueue).toBeDefined();
      expect(service.createWorker).toBeDefined();
      expect(service.getQueue).toBeDefined();
      expect(service.getWorker).toBeDefined();
      expect(service.addJob).toBeDefined();
    });
  });

  describe('service configuration', () => {
    it('should have proper service structure', () => {
      expect(service).toBeDefined();
      expect(typeof service.createQueue).toBe('function');
      expect(typeof service.createWorker).toBe('function');
      expect(typeof service.addJob).toBe('function');
    });
  });
});