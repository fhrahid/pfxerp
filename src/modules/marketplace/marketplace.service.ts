import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CertificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CertificationsService } from '../certifications/certifications.service';
import { AuthUser } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Boilerplate Marketplace (cto.md §7):
 * certified authors publish; squads buy with treasury (100% to author wallet);
 * one purchase per squad per asset enforced by a DB unique index.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly certs: CertificationsService,
  ) {}

  async createListing(user: AuthUser, dto: { title: string; description?: string; price: number; repositoryUrl?: string }) {
    await this.certs.assertCertified(user, CertificationType.MARKETPLACE_AUTHOR);
    if (!(dto.price > 0)) throw new BadRequestException('Price must be positive');

    return this.prisma.marketplaceListing.create({
      data: {
        authorId: user.id,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        repositoryUrl: dto.repositoryUrl,
        // CTO-authored assets are auto-verified (BR-CTO-34)
        isCtoVerified: user.role === UserRole.CTO,
        verifiedById: user.role === UserRole.CTO ? user.id : null,
      },
    });
  }

  async listListings(filters: { query?: string; maxPrice?: number }) {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        isDelisted: false,
        ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
        ...(filters.query
          ? { OR: [{ title: { contains: filters.query, mode: 'insensitive' } }, { description: { contains: filters.query, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        _count: { select: { purchases: true } },
      },
    });
    return listings.map((l) => ({
      id: l.id,
      authorId: l.authorId,
      authorName: l.author.fullName,
      title: l.title,
      description: l.description,
      price: Number(l.price),
      repositoryUrl: l.repositoryUrl,
      isCtoVerified: l.isCtoVerified,
      purchaseCount: l._count.purchases,
      createdAt: l.createdAt,
    }));
  }

  /** API-CTO-18: purchase settles SQUAD_TREASURY -> author PERSONAL_WALLET (100%). */
  async purchase(user: AuthUser, listingId: string, buyerSquadId: string, idempotencyKey: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.isDelisted) throw new NotFoundException('Listing not found or delisted');

    // Buyer must be the squad PM (or CTO/CEO)
    if (user.role === UserRole.PM) {
      const m = await this.prisma.squadMembership.findFirst({
        where: { userId: user.id, squadId: buyerSquadId, role: 'PM', leftAt: null },
      });
      if (!m) throw new ForbiddenException('Only the buyer squad PM may authorize purchases');
    }

    const existing = await this.prisma.marketplacePurchase.findUnique({
      where: { listingId_buyerSquadId: { listingId, buyerSquadId } },
    });
    if (existing) throw new AppException('CONFLICT', 'Squad already licensed this asset (BR-CTO-36)');

    const amount = Number(listing.price);
    const treasury = await this.ledger.squadTreasury(buyerSquadId);
    const authorWallet = await this.ledger.personalWallet(listing.authorId);

    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: treasury.id,
      recipientAccountId: authorWallet.id,
      amount,
      referenceType: 'MARKETPLACE_PURCHASE',
      referenceId: listing.id,
      description: `Marketplace purchase: ${listing.title}`,
      idempotencyKey: idempotencyKey || `mkt_${listingId}_${buyerSquadId}`,
      authorizedById: user.id,
    });

    const purchase = await this.prisma.marketplacePurchase.create({
      data: { listingId, buyerSquadId, buyerUserId: user.id, amount },
    });

    return {
      purchaseId: purchase.id,
      listingId,
      amount,
      authorUserId: listing.authorId,
      repositoryAccessGranted: true,
    };
  }

  async verifyListing(ctoUserId: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { isCtoVerified: true, verifiedById: ctoUserId },
    });
  }

  async delist(listingId: string, reason: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { isDelisted: true },
    });
  }
}
