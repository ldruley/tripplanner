import { Controller, HttpCode, Post, UseGuards, HttpStatus, Req, Request, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto, SafeUser } from '@trip-planner/types';




@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: SafeUser): Promise<{ access_token: string }> {
    return this.authService.login(req);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto): Promise<SafeUser> {
    return this.authService.register(createUserDto);
  }



}
