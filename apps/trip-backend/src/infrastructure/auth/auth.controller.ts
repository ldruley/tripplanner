import {
  Controller,
  HttpCode,
  Post,
  UseGuards,
  HttpStatus,
  Request,
  Body,
  Logger,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
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
} from '@trip-planner/types';
import {
  CreateUserDto,
  LoginUserDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from '@trip-planner/shared/dtos';

@ApiTags('auth')
@Controller('auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login user', description: 'Authenticate user with email and password' })
  @ApiBody({ type: LoginUserDto, description: 'User login credentials' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ access_token: string }> {
    Logger.log('Login request received ' + loginUserDto.email, 'AuthController');
    return this.authService.login(req.user);
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
