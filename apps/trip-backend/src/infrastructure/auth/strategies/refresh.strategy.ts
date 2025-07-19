import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@trip-planner/prisma';
import { SafeUser } from '@trip-planner/types';

interface RefreshJwtPayload {
  sub: string;
  email: string;
  tokenId: string;
  type: 'refresh';
}

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: (request) => {
        return request?.body?.refreshToken || null;
      },
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
    });
  }

  async validate(payload: RefreshJwtPayload): Promise<SafeUser> {
    if (!payload || !payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify the refresh token is still valid and matches stored token
    if (!user.refreshToken || !user.refreshTokenExpiry) {
      throw new UnauthorizedException('No refresh token found for user');
    }

    if (new Date() > user.refreshTokenExpiry) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Extract the stored token ID from the database refresh token
    try {
      const storedTokenPayload = JSON.parse(
        Buffer.from(user.refreshToken.split('.')[1], 'base64').toString()
      );
      
      if (storedTokenPayload.tokenId !== payload.tokenId) {
        throw new UnauthorizedException('Refresh token does not match');
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid stored refresh token');
    }

    const { password, refreshToken, refreshTokenExpiry, ...result } = user;
    return result;
  }
}