import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '@trip-planner/prisma';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PrismaModule, // To inject PrismaService into AuthService
    ConfigModule, // Ensure ConfigModule is available if not global
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // Your secret key for signing JWTs
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '3600s', // Token expiration time
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy], // Add LocalStrategy
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
