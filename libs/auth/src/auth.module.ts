import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '@trip-planner/prisma';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RequestContextService } from './services/request-context.service';

@Module({
  imports: [ConfigModule, PassportModule, PrismaModule],
  providers: [JwtStrategy, RequestContextService],
  exports: [JwtStrategy, RequestContextService],
})
export class AuthModule {}
