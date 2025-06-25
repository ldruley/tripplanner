import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@trip-planner/prisma';
import { CreateUser, SafeUser } from '@trip-planner/types';

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
  }

  async validateUser(email: string, pass: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && await bcrypt.compare(pass, user.password)) {
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
    return this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 10),
          role: 'user',
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

      const { password: _, ...safeUser } = user;
      return safeUser;
    });
  }
}
