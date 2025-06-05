import { Controller, HttpCode, Post, UseGuards, HttpStatus, Req, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { SafeUser } from '@trip-planner/types';




@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: SafeUser): Promise<{ access_token: string }> {
    return this.authService.login(req);
  }



}
