import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // Wallets are provisioned for every existing and newly bootstrapped user.
    // This additive backfill is safe on every application start and handles
    // accounts created before personal wallets were enforced.
    const users = await this.user.findMany({ select: { id: true } });
    if (users.length) {
      await this.account.createMany({
        data: users.map(({ id }) => ({ ownerId: id, type: 'PERSONAL_WALLET', balance: 0, currency: 'BDT' })),
        skipDuplicates: true,
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
