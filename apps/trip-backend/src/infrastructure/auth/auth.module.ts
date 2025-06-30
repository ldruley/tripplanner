import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '@trip-planner/prisma';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule as SharedAuthModule } from '@trip-planner/auth';
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
    SharedAuthModule, // Import shared auth components
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy], // JwtStrategy now comes from SharedAuthModule
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
