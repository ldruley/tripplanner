import {
  Controller,
  HttpCode,
  Post,
  UseGuards,
  HttpStatus,
  Request as NestRequest,
  Body,
  Logger,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';

// Extend Express Request to include cookies
interface RequestWithCookies extends ExpressRequest {
  cookies: Record<string, any>;
}
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CreateUser,
  SafeUser,
  AuthenticatedRequest,
  RequestPasswordReset,
  ResetPassword,
  VerifyEmail,
  ResendVerification,
  RefreshToken,
  AuthResponse,
} from '@trip-planner/types';
import {
  CreateUserDto,
  LoginUserDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  RefreshTokenDto,
  AuthResponseDto,
} from '@trip-planner/shared/dtos';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Production: secure cookies with lax sameSite
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    } else {
      // Development: no sameSite restriction to avoid cross-site issues
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }
  }

  private clearRefreshTokenCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Production: match the secure settings used when setting
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    } else {
      // Development: match the settings used when setting (no sameSite)
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: false,
        path: '/',
      });
    }
  }

  @ApiOperation({ summary: 'Login user', description: 'Authenticate user with email and password' })
  @ApiBody({ type: LoginUserDto, description: 'User login credentials' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @NestRequest() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponse, 'refresh_token'>> {
    Logger.log('Login request received ' + loginUserDto.email, 'AuthController');
    const authResponse = await this.authService.login(req.user);

    // Set refresh token as HTTP-only cookie
    this.setRefreshTokenCookie(res, authResponse.refresh_token);

    // Return response without refresh_token
    const { refresh_token, ...responseWithoutRefreshToken } = authResponse;
    return responseWithoutRefreshToken;
  }

  @ApiOperation({
    summary: 'Refresh tokens',
    description: 'Get new access and refresh tokens using refresh token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired refresh token' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponse, 'refresh_token'>> {
    Logger.log('Refresh token request received', 'AuthController');

    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found in cookies');
    }

    const authResponse = await this.authService.refreshTokens({ refreshToken: refreshToken });

    // Set new refresh token as HTTP-only cookie
    this.setRefreshTokenCookie(res, authResponse.refresh_token);

    // Return response without refresh_token
    const { refresh_token, ...responseWithoutRefreshToken } = authResponse;
    return responseWithoutRefreshToken;
  }

  @ApiOperation({ summary: 'Logout user', description: 'Revoke refresh token and logout user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Logout successful' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @NestRequest() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    Logger.log('Logout request received for user ' + req.user.email, 'AuthController');

    // Clear refresh token cookie
    this.clearRefreshTokenCookie(res);

    return this.authService.revokeRefreshToken(req.user.id);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto): Promise<SafeUser> {
    return this.authService.register(createUserDto as CreateUser);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    return this.authService.requestPasswordReset(requestPasswordResetDto as RequestPasswordReset);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(resetPasswordDto as ResetPassword);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    return this.authService.verifyEmail(verifyEmailDto as VerifyEmail);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(resendVerificationDto as ResendVerification);
  }
}
