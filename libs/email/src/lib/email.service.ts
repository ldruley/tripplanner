import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@trip-planner/bullmq';
import { RedisService } from '@trip-planner/redis';
import { Queue, QueueEvents } from 'bullmq';
import {
  EmailRequest,
  EmailResponse,
  EmailJobData,
  EmailTemplateType,
  WelcomeEmailVariables,
  PasswordResetEmailVariables,
  EmailVerificationVariables,
} from '@trip-planner/types';
import { buildCacheKey } from '@trip-planner/utils';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private emailQueue!: Queue;
  private queueEvents?: QueueEvents;

  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours for email delivery status
  private readonly logger = new Logger(EmailService.name);
  private readonly QUEUE_NAME = 'email-queue';

  constructor(
    private readonly bullmqService: BullMQService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    this.emailQueue = this.bullmqService.createQueue({
      name: this.QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // TODO: This is temporary here until we implement a proper worker process
    this.queueEvents = new QueueEvents(this.QUEUE_NAME, {
      connection: this.redisService.getClient(),
    });
  }

  async sendEmail(emailRequest: EmailRequest): Promise<EmailResponse> {
    const { template, variables = {}, priority = 5, scheduledAt, ...emailData } = emailRequest;

    // Generate email content from template
    const emailContent = await this.generateEmailContent(template, variables);

    const jobData: EmailJobData = {
      to: emailData.to,
      subject: emailData.subject,
      html: emailContent.html,
      text: emailContent.text,
      priority,
      attempt: 0,
      maxAttempts: 3,
    };

    // Create a unique cache key for this email
    const cacheKey = buildCacheKey('email:sent', [emailData.to, emailData.subject, Date.now().toString()], true);

    const jobOptions: { priority: number; delay?: number } = {
      priority,
    };

    if (scheduledAt) {
      jobOptions.delay = scheduledAt.getTime() - Date.now();
    }

    const job = await this.bullmqService.addJob(
      this.QUEUE_NAME,
      'send-email',
      jobData,
      jobOptions
    );

    // For now, return immediately with queued status
    // In production, you might want to wait for completion for critical emails
    const response: EmailResponse = {
      id: job.id?.toString() || 'unknown',
      status: 'queued',
      message: 'Email queued for delivery'
    };

    // Cache the initial response
    await this.redisService.set(cacheKey, response, this.CACHE_TTL);

    return response;
  }

  async sendWelcomeEmail(to: string, variables: WelcomeEmailVariables = {}): Promise<EmailResponse> {
    return this.sendEmail({
      to,
      subject: 'Welcome to Trip Planner!',
      template: 'welcome',
      variables,
      priority: 8, // High priority for welcome emails
    });
  }

  async sendPasswordResetEmail(to: string, variables: PasswordResetEmailVariables): Promise<EmailResponse> {
    return this.sendEmail({
      to,
      subject: 'Reset Your Password - Trip Planner',
      template: 'password-reset',
      variables,
      priority: 9, // Very high priority for security emails
    });
  }

  async sendEmailVerification(to: string, variables: EmailVerificationVariables): Promise<EmailResponse> {
    return this.sendEmail({
      to,
      subject: 'Verify Your Email - Trip Planner',
      template: 'email-verification',
      variables,
      priority: 9, // Very high priority for verification emails
    });
  }

  private async generateEmailContent(
    template: EmailTemplateType,
    variables: WelcomeEmailVariables | PasswordResetEmailVariables | EmailVerificationVariables
  ): Promise<{ html: string; text: string }> {
    // For now, return simple templates. In the future, this could use a template engine
    switch (template) {
      case 'welcome':
        return {
          html: this.getWelcomeEmailHtml(variables),
          text: this.getWelcomeEmailText(variables)
        };
      case 'password-reset':
        return {
          html: this.getPasswordResetEmailHtml(variables as PasswordResetEmailVariables),
          text: this.getPasswordResetEmailText(variables as PasswordResetEmailVariables)
        };
      case 'email-verification':
        return {
          html: this.getEmailVerificationHtml(variables as EmailVerificationVariables),
          text: this.getEmailVerificationText(variables as EmailVerificationVariables)
        };
      default:
        throw new Error(`Unknown email template: ${template}`);
    }
  }

  private getWelcomeEmailHtml(variables: WelcomeEmailVariables): string {
    const firstName = variables.firstName || 'there';
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Welcome to Trip Planner!</h1>
            <p>Hi ${firstName},</p>
            <p>Welcome to Trip Planner! We're excited to help you plan amazing trips.</p>
            <p>Get started by creating your first trip and discovering new destinations.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Happy travels!</p>
            <p>The Trip Planner Team</p>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeEmailText(variables: WelcomeEmailVariables): string {
    const firstName = variables.firstName || 'there';
    return `Hi ${firstName},

Welcome to Trip Planner! We're excited to help you plan amazing trips.

Get started by creating your first trip and discovering new destinations.

If you have any questions, feel free to reach out to our support team.

Happy travels!
The Trip Planner Team`;
  }

  private getPasswordResetEmailHtml(variables: PasswordResetEmailVariables): string {
    const firstName = variables.firstName || 'there';
    const resetToken = variables.resetToken || '';
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Password Reset Request</h1>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password for your Trip Planner account.</p>
            <p>If you made this request, click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:4200/auth/reset-password?token=${resetToken}"
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>This link will expire in 24 hours for security purposes.</p>
            <p>The Trip Planner Team</p>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailText(variables: PasswordResetEmailVariables): string {
    const firstName = variables.firstName || 'there';
    const resetToken = variables.resetToken || '';
    return `Hi ${firstName},

We received a request to reset your password for your Trip Planner account.

If you made this request, visit this link to reset your password:
http://localhost:4200/auth/reset-password?token=${resetToken}

If you didn't request this, you can safely ignore this email.

This link will expire in 24 hours for security purposes.

The Trip Planner Team`;
  }

  private getEmailVerificationHtml(variables: EmailVerificationVariables): string {
    const firstName = variables.firstName || 'there';
    const verificationToken = variables.verificationToken || '';
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Verify Your Email Address</h1>
            <p>Hi ${firstName},</p>
            <p>Thanks for signing up for Trip Planner! Please verify your email address to complete your account setup.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:4200/auth/verify-email?token=${verificationToken}"
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p>If you didn't create an account with us, you can safely ignore this email.</p>
            <p>The Trip Planner Team</p>
          </div>
        </body>
      </html>
    `;
  }

  private getEmailVerificationText(variables: EmailVerificationVariables): string {
    const firstName = variables.firstName || 'there';
    const verificationToken = variables.verificationToken || '';
    return `Hi ${firstName},

Thanks for signing up for Trip Planner! Please verify your email address to complete your account setup.

Visit this link to verify your email:
http://localhost:4200/auth/verify-email?token=${verificationToken}

If you didn't create an account with us, you can safely ignore this email.

The Trip Planner Team`;
  }

  async getEmailStatus(emailId: string): Promise<EmailResponse | null> {
    const job = await this.emailQueue.getJob(emailId);
    if (!job) {
      return null;
    }

    const status = await job.getState();
    return {
      id: emailId,
      status: this.mapJobStatusToEmailStatus(status),
      message: job.failedReason || undefined,
      sentAt: job.processedOn ? new Date(job.processedOn) : undefined,
    };
  }

  private mapJobStatusToEmailStatus(jobStatus: string): 'queued' | 'sent' | 'failed' | 'delivered' {
    switch (jobStatus) {
      case 'waiting':
      case 'delayed':
        return 'queued';
      case 'completed':
        return 'sent'; // We'll update this to 'delivered' when we get webhooks
      case 'failed':
        return 'failed';
      default:
        return 'queued';
    }
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
  }

  async getQueueStats() {
    const waiting = await this.emailQueue.getWaiting();
    const completed = await this.emailQueue.getCompleted();
    const failed = await this.emailQueue.getFailed();

    return {
      waiting: waiting.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}
