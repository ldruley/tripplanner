import { PrismaService } from './prisma.service';

export type PrismaTransaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
export type PrismaClient = PrismaService | PrismaTransaction;
