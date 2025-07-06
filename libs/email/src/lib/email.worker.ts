import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { BullMQService } from '@trip-planner/bullmq';
import { Job, Worker } from 'bullmq';
import { ValidationConfigService } from '@trip-planner/config';
import { EmailJobData, EmailJobDataSchema } from '@trip-planner/types';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';

@Injectable()
export class EmailWorker implements OnModuleInit {
  private worker!: Worker;
  private mailgun!: ReturnType<typeof Mailgun.prototype.client>;
  private readonly domain!: string;
  private readonly from!: string;
  private readonly testEmail?: string;
  private readonly QUEUE_NAME = 'email-queue';
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    private readonly bullmqService: BullMQService,
    private readonly configService: ValidationConfigService,
  ) {
    const apiKeys = this.configService.getApiKeys();
    const emailConfig = this.configService.getEmail();
    const apiUrls = this.configService.getApiUrls();
    
    const apiKey = apiKeys.MAILGUN_API_KEY;
    this.domain = emailConfig.MAILGUN_DOMAIN;
    this.from = emailConfig.MAILGUN_FROM;
    this.testEmail = emailConfig.MAILGUN_TEST_EMAIL;

    // Initialize Mailgun client
    const mailgunClient = new Mailgun(FormData);
    this.mailgun = mailgunClient.client({
      username: 'api',
      key: apiKey,
      url: apiUrls.MAILGUN_BASE_URL,
    });
  }

  async onModuleInit() {
    this.worker = this.bullmqService.createWorker({
      name: this.QUEUE_NAME,
      processor: this.processEmailJob.bind(this),
      concurrency: 2, // Process up to 2 emails simultaneously
      limiter: {
        max: 300, // Mailgun allows 300 emails per hour on sandbox
        duration: 60 * 60 * 1000, // Per hour (in milliseconds)
      },
    });

    this.logger.log('Email worker started');
  }

  private async processEmailJob(job: Job<EmailJobData>): Promise<{
    messageId: string;
    status: string;
    recipient: string;
    originalRecipient: string;
    sentAt: string;
  }> {
    const jobData = EmailJobDataSchema.parse(job.data);

    try {
      this.logger.debug(`Processing email job ${job.id} for ${jobData.to}`);

      // Override recipient with test email if configured and not in production
      const recipient = this.shouldUseTestEmail() ? (this.testEmail ?? jobData.to) : jobData.to;

      if (this.shouldUseTestEmail() && this.testEmail) {
        this.logger.log(`Redirecting email from ${jobData.to} to test email ${this.testEmail}`);
      }

      const messageData = {
        from: this.from,
        to: recipient,
        subject: jobData.subject,
        html: jobData.html,
        text: jobData.text || this.stripHtmlTags(jobData.html),
        'o:tracking': 'yes' as const,
        'o:tracking-clicks': 'yes' as const,
        'o:tracking-opens': 'yes' as const,
      };

      const result = await this.mailgun.messages.create(this.domain, messageData);

      this.logger.log(`Email sent successfully: ${result.id} to ${recipient}`);

      // Add processing delay to respect rate limits
      await this.delay(200);

      return {
        messageId: result.id || 'unknown',
        status: 'sent',
        recipient,
        originalRecipient: jobData.to,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Email job ${job.id} failed:`, error);

      // Increment attempt counter
      const attempt = (jobData.attempt || 0) + 1;
      const maxAttempts = jobData.maxAttempts || 3;

      if (attempt >= maxAttempts) {
        this.logger.error(`Email job ${job.id} failed permanently after ${attempt} attempts`);
        throw new BadGatewayException(`Email delivery failed after ${attempt} attempts: ${error}`);
      }

      // Re-throw for BullMQ retry mechanism
      throw error;
    }
  }

  private shouldUseTestEmail(): boolean {
    return !this.configService.isProduction() && !!this.testEmail;
  }

  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getWorkerStats() {
    if (!this.worker) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'running',
      concurrency: 2,
      isRunning: !this.worker.isRunning(),
      isPaused: this.worker.isPaused(),
    };
  }

  async pauseWorker() {
    if (this.worker) {
      await this.worker.pause();
      this.logger.log('Email worker paused');
    }
  }

  async resumeWorker() {
    if (this.worker) {
      await this.worker.resume();
      this.logger.log('Email worker resumed');
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Email worker stopped');
    }
  }
}
