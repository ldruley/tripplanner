import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../../libs/shared/prisma/src';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilesModule } from '../domain/profile/profiles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'libs/shared/prisma/.env',
        '.env.development',
        '.env'
      ],
    }),
    PrismaModule,
    ProfilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
