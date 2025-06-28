import { Controller, HttpCode, Post, UseGuards, HttpStatus, Req, Request, Body, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateUser, SafeUser } from '@trip-planner/types';
import { CreateUserDto } from '@trip-planner/shared/dtos';




@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: any): Promise<{ access_token: string }> {
    Logger.log('Login request received', 'AuthController');
    return this.authService.login(req.user);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto): Promise<SafeUser> {
    return this.authService.register(createUserDto as CreateUser);
  }



}
