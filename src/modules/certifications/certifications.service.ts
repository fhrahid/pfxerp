import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CertificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthUser } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * CTO Quality Gate & Provider Certification (cto.md §5):
 * score >= 80 => APPROVED (90d validity); score < 80 => REJECTED (7d cooldown).
 */
@Injectable()
export class CertificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async apply(user: AuthUser, dto: { certificationType: CertificationType; portfolioUrl?: string; applicationNotes?: string }) {
    const existing = await this.prisma.ctoProviderCertification.findUnique({
      where: { userId_certificationType: { userId: user.id, certificationType: dto.certificationType } },
    });

    if (existing?.cooldownUntil && existing.cooldownUntil > new Date()) {
      const hours = Math.ceil((existing.cooldownUntil.getTime() - Date.now()) / 3_600_000);
      throw new AppException('CERT_COOLDOWN_ACTIVE', `Application locked in cooldown for another ${hours} hours (BR-CTO-18)`);
    }
    if (existing?.isPreapproved && (!existing.expiresAt || existing.expiresAt > new Date())) {
      throw new AppException('CONFLICT', 'An active certification of this type already exists');
    }

    return this.prisma.ctoProviderCertification.upsert({
      where: { userId_certificationType: { userId: user.id, certificationType: dto.certificationType } },
      update: {
        isPreapproved: false,
        qualityScore: null,
        reviewedById: null,
        certifiedAt: null,
        expiresAt: null,
        cooldownUntil: null,
        portfolioUrl: dto.portfolioUrl,
        applicationNotes: dto.applicationNotes,
        ctoReviewNotes: null,
      },
      create: {
        userId: user.id,
        certificationType: dto.certificationType,
        portfolioUrl: dto.portfolioUrl,
        applicationNotes: dto.applicationNotes,
      },
    });
  }

  async queue() {
    const pending = await this.prisma.ctoProviderCertification.findMany({
      where: { reviewedById: null, qualityScore: null, isPreapproved: false },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, fullName: true, email: true, role: true, squadMemberships: { where: { leftAt: null }, select: { squad: { select: { name: true } } } } } } },
    });
    return {
      pendingCount: pending.length,
      queue: pending.map((c) => ({
        id: c.id,
        userId: c.user.id,
        applicantName: c.user.fullName,
        applicantSquad: c.user.squadMemberships[0]?.squad?.name ?? null,
        certificationType: c.certificationType,
        portfolioUrl: c.portfolioUrl,
        applicationNotes: c.applicationNotes,
        createdAt: c.createdAt,
      })),
    };
  }

  async review(ctoUserId: string, certificationId: string, dto: { qualityScore: number; action: 'APPROVE' | 'REJECT'; notes?: string }) {
    if (dto.qualityScore < 0 || dto.qualityScore > 100) {
      throw new BadRequestException('qualityScore must be within 0..100');
    }
    const cert = await this.prisma.ctoProviderCertification.findUnique({ where: { id: certificationId } });
    if (!cert) throw new BadRequestException('Certification application not found');
    if (cert.isPreapproved && cert.reviewedById) throw new AppException('CONFLICT', 'Application already reviewed');

    const threshold = await this.settings.getNumber('CERTIFICATION_PASS_THRESHOLD', 80);
    if (dto.action === 'APPROVE' && dto.qualityScore < threshold) {
      throw new BadRequestException(`APPROVE requires a score >= ${threshold}`);
    }
    if (dto.action === 'REJECT' && dto.qualityScore >= threshold) {
      throw new BadRequestException(`REJECT requires a score < ${threshold}`);
    }

    if (dto.action === 'APPROVE') {
      const validityDays = await this.settings.getNumber('CERTIFICATION_VALIDITY_DAYS', 90);
      return this.prisma.ctoProviderCertification.update({
        where: { id: certificationId },
        data: {
          qualityScore: dto.qualityScore,
          isPreapproved: true,
          reviewedById: ctoUserId,
          ctoReviewNotes: dto.notes,
          certifiedAt: new Date(),
          expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
          cooldownUntil: null,
        },
      });
    }

    const cooldownDays = await this.settings.getNumber('CERTIFICATION_COOLDOWN_DAYS', 7);
    return this.prisma.ctoProviderCertification.update({
      where: { id: certificationId },
      data: {
        qualityScore: dto.qualityScore,
        isPreapproved: false,
        reviewedById: ctoUserId,
        ctoReviewNotes: dto.notes,
        cooldownUntil: new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000),
      },
    });
  }

  /** Public: active consultants (CTO + certified users) for booking UIs. */
  async consultants() {
    const certs = await this.prisma.ctoProviderCertification.findMany({
      where: { certificationType: CertificationType.CONSULTANT, isPreapproved: true },
      include: { user: { select: { id: true, fullName: true, role: true } } },
    });
    const out = certs
      .filter((c) => !c.expiresAt || c.expiresAt > new Date())
      .map((c) => ({ id: c.user.id, fullName: c.user.fullName, role: c.user.role }));
    // The CTO is auto-certified, but guarantee presence even before seeding refresh
    const cto = await this.prisma.user.findFirst({ where: { role: UserRole.CTO, isActive: true } });
    if (cto && !out.some((u) => u.id === cto.id)) {
      out.push({ id: cto.id, fullName: cto.fullName, role: cto.role });
    }
    return out;
  }

  async userCertifications(userId: string) {
    return this.prisma.ctoProviderCertification.findMany({
      where: { userId },
      include: { reviewedBy: { select: { id: true, fullName: true } } },
    });
  }

  /** Guard used by marketplace + consultancy (BR-CTO-21). CTO auto-passes (BR-CTO-34/40). */
  async assertCertified(user: AuthUser, type: CertificationType) {
    if (user.role === UserRole.CTO || user.role === UserRole.CEO) return true;

    const cert = await this.prisma.ctoProviderCertification.findUnique({
      where: { userId_certificationType: { userId: user.id, certificationType: type } },
    });
    const active = cert?.isPreapproved && (!cert.expiresAt || cert.expiresAt > new Date());
    if (!active) {
      throw new AppException('CERT_REQUIRED', `Active ${type} certification required (BR-CTO-21)`);
    }
    return true;
  }

  /** Public check used to render marketplace/consultancy catalogs. */
  async isCertified(userId: string, type: CertificationType) {
    const cert = await this.prisma.ctoProviderCertification.findUnique({
      where: { userId_certificationType: { userId, certificationType: type } },
    });
    return Boolean(cert?.isPreapproved && (!cert.expiresAt || cert.expiresAt > new Date()));
  }
}
