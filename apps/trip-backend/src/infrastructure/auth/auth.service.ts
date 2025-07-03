import {
  ConflictException,
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@trip-planner/prisma';
import {
  CreateUser,
  SafeUser,
  RequestPasswordReset,
  ResetPassword,
  VerifyEmail,
  ResendVerification,
} from '@trip-planner/types';
import { DistanceUnit } from '@prisma/client';
import { EmailService } from '@trip-planner/email';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: SafeUser): Promise<{ access_token: string }> {
    const payload = { sub: user.id, email: user.email, roles: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(createUser: CreateUser): Promise<SafeUser> {
    const { email, password, firstName, lastName } = createUser;
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Generate verification token
    const verificationToken = this.generateSecureToken();
    const verificationTokenExpiry = this.getTokenExpiry(24); // 24 hours expiry

    const result = await this.prisma.$transaction(async tx => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 10),
          role: 'user',
          verificationToken,
          verificationTokenExpiry,
        },
      });

      // Create corresponding profile
      await tx.profile.create({
        data: {
          userId: user.id,
          status: 'pending', // Requires email verification
          firstName: firstName,
          lastName: lastName,
          displayName: `${firstName} ${lastName}`,
        },
      });

      await tx.userSettings.create({
        data: {
          userId: user.id,
          timezone: 'UTC', // Default timezone
          distanceUnit: DistanceUnit.MILES,
          darkMode: false,
        },
      });

      const { password: _, ...safeUser } = user;
      return safeUser;
    });

    // Send verification email (outside transaction to avoid issues if email fails)
    try {
      await this.emailService.sendEmailVerification(email, {
        verificationToken,
        firstName,
      });
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error);
    }

    return result;
  }

  // Password reset methods
  async requestPasswordReset(
    requestPasswordReset: RequestPasswordReset,
  ): Promise<{ message: string }> {
    const { email } = requestPasswordReset;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return {
        message: 'If an account with that email exists, you will receive a password reset email.',
      };
    }

    // Generate reset token
    const resetToken = this.generateSecureToken();
    const resetTokenExpiry = this.getTokenExpiry(1); // 1 hour expiry

    // Update user with reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(email, {
      resetToken,
      firstName: user.profile?.firstName ?? undefined,
    });

    return {
      message: 'If an account with that email exists, you will receive a password reset email.',
    };
  }

  async resetPassword(resetPasswordData: ResetPassword): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordData;

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password has been reset successfully' };
  }

  // Email verification methods
  async verifyEmail(verifyEmailData: VerifyEmail): Promise<{ message: string }> {
    const { token } = verifyEmailData;

    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: {
          gt: new Date(),
        },
      },
      include: { profile: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user as verified and clear verification token
    await this.prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });

      // Update profile status to active
      if (user.profile) {
        await tx.profile.update({
          where: { id: user.profile.id },
          data: {
            status: 'active',
          },
        });
      }
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(resendData: ResendVerification): Promise<{ message: string }> {
    const { email } = resendData;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      // Don't reveal if email exists
      return {
        message:
          'If an account with that email exists and is unverified, a verification email has been sent.',
      };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = this.generateSecureToken();
    const verificationTokenExpiry = this.getTokenExpiry(24); // 24 hours expiry

    // Update user with new verification token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Send verification email
    await this.emailService.sendEmailVerification(email, {
      verificationToken,
      firstName: user.profile?.firstName ?? undefined,
    });

    return {
      message:
        'If an account with that email exists and is unverified, a verification email has been sent.',
    };
  }

  // Token management helper methods
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getTokenExpiry(hours: number): Date {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hours);
    return expiry;
  }

  private isTokenExpired(expiry: Date | null): boolean {
    if (!expiry) return true;
    return new Date() > expiry;
  }

  private async clearUserTokens(
    userId: string,
    tokenType: 'reset' | 'verification' | 'both' = 'both',
  ): Promise<void> {
    const updateData: any = {};

    if (tokenType === 'reset' || tokenType === 'both') {
      updateData.resetToken = null;
      updateData.resetTokenExpiry = null;
    }

    if (tokenType === 'verification' || tokenType === 'both') {
      updateData.verificationToken = null;
      updateData.verificationTokenExpiry = null;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }
}
