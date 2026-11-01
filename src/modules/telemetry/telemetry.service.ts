import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { AuthUser, isExecRole } from '../../common/types';
import { UserRole } from '@prisma/client';

export interface TelemetryEvent {
  type: 'page_view' | 'api_call';
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  userId?: string;
}

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  /** API-OTH-01: Ingest product telemetry with X-API-Key (other.md §3). */
  async ingest(apiKey: string, events: TelemetryEvent[]) {
    if (!apiKey) throw new UnauthorizedException('TELEMETRY_INVALID_KEY: missing apiKey');
    const product = await this.prisma.product.findUnique({ where: { apiKey } });
    if (!product) throw new UnauthorizedException('TELEMETRY_INVALID_KEY: unknown apiKey');

    if (!Array.isArray(events) || events.length === 0) {
      return { bufferedCount: 0 };
    }

    const recordedHour = new Date();
    recordedHour.setMinutes(0, 0, 0);

    let pageviews = 0;
    let apiRequests = 0;
    let errorCount5xx = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    const distinctUsers = new Set<string>();

    for (const e of events) {
      if (e.type === 'page_view') pageviews++;
      if (e.type === 'api_call') apiRequests++;
      if (e.statusCode && e.statusCode >= 500) errorCount5xx++;
      if (typeof e.latencyMs === 'number' && e.latencyMs >= 0) {
        totalLatency += e.latencyMs;
        latencyCount++;
      }
      if (e.userId) distinctUsers.add(e.userId);
    }

    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
    const uniqueVisitors = distinctUsers.size;

    const existing = await this.prisma.productTelemetryHourly.findUnique({
      where: { productId_recordedHour: { productId: product.id, recordedHour } },
    });

    const prevRequests = existing ? existing.apiRequests : 0;
    const prevLatency = existing ? Number(existing.avgLatencyMs) : 0;
    const combinedRequests = prevRequests + apiRequests;
    const combinedLatency = combinedRequests > 0
      ? (prevRequests * prevLatency + totalLatency) / combinedRequests
      : 0;

    const currentUnique = Math.max(existing?.uniqueVisitors || 0, uniqueVisitors);
    const currentActive = Math.max(existing?.activeUsers || 0, uniqueVisitors);

    const updated = await this.prisma.productTelemetryHourly.upsert({
      where: { productId_recordedHour: { productId: product.id, recordedHour } },
      update: {
        pageviews: { increment: pageviews },
        apiRequests: { increment: apiRequests },
        errorCount5xx: { increment: errorCount5xx },
        uniqueVisitors: currentUnique,
        activeUsers: currentActive,
        avgLatencyMs: new Prisma.Decimal(combinedLatency.toFixed(2)),
      },
      create: {
        productId: product.id,
        recordedHour,
        pageviews,
        apiRequests,
        errorCount5xx,
        uniqueVisitors,
        activeUsers: uniqueVisitors,
        avgLatencyMs: new Prisma.Decimal(avgLatency.toFixed(2)),
      },
    });

    // Automated Incident Alarm: 5xx rate > 2.0% (other.md §3.1)
    const totalRequests = updated.apiRequests + updated.pageviews;
    const totalErrors = updated.errorCount5xx;
    if (totalRequests >= 5 && totalErrors / totalRequests > 0.02) {
      const errorRate = Math.round((totalErrors / totalRequests) * 1000) / 10;
      this.events.emitToStudio('telemetry:alarm', {
        productId: product.id,
        productName: product.name,
        squadId: product.squadId,
        errorRate5xx: errorRate,
        threshold: 0.02,
      });
      this.events.emitToRoom(this.events.squadRoom(product.squadId), 'telemetry:alarm', {
        productId: product.id,
        productName: product.name,
        errorRate5xx: errorRate,
        threshold: 0.02,
      });
    }

    return { bufferedCount: events.length };
  }

  async createProduct(
    user: AuthUser,
    dto: { squadId: string; name: string; liveUrl?: string; isClientProduct?: boolean; clientContractId?: string },
  ) {
    if (!isExecRole(user.role) && !user.squadIds.includes(dto.squadId)) {
      throw new ForbiddenException('AUTHZ_CROSS_SQUAD: cannot create product for another squad');
    }

    const apiKey = 'pfx_' + randomBytes(24).toString('hex');
    return this.prisma.product.create({
      data: {
        squadId: dto.squadId,
        name: dto.name,
        liveUrl: dto.liveUrl,
        apiKey,
        isClientProduct: Boolean(dto.isClientProduct),
        clientContractId: dto.clientContractId,
      },
      include: { squad: { select: { id: true, name: true } } },
    });
  }

  async listProducts(user: AuthUser, squadId?: string) {
    const isExec = isExecRole(user.role);
    const where: Prisma.ProductWhereInput = {};
    if (squadId) {
      if (!isExec && !user.squadIds.includes(squadId)) throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
      where.squadId = squadId;
    } else if (!isExec) {
      where.squadId = { in: user.squadIds.length ? user.squadIds : ['none'] };
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        squad: { select: { id: true, name: true } },
        telemetryHourly: { orderBy: { recordedHour: 'desc' }, take: 1 },
      },
    });

    return products.map((p) => {
      const canSeeKey = isExec || (user.role === UserRole.PM && user.squadIds.includes(p.squadId));
      if (!canSeeKey) {
        const { apiKey, ...safe } = p;
        return safe;
      }
      return p;
    });
  }

  async getProduct(user: AuthUser, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { squad: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    const isExec = isExecRole(user.role);
    const isMember = user.squadIds.includes(product.squadId);
    if (!isExec && !isMember) {
      throw new ForbiddenException('AUTHZ_CROSS_SQUAD: cannot access another squad\'s product');
    }

    const canSeeKey = isExec || (user.role === UserRole.PM && isMember);
    if (!canSeeKey) {
      const { apiKey, ...safe } = product;
      return safe;
    }
    return product;
  }

  async getTelemetry(user: AuthUser, productId: string, hours = 24) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, squadId: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const isExec = isExecRole(user.role);
    const isMember = user.squadIds.includes(product.squadId);
    if (!isExec && !isMember) {
      throw new ForbiddenException('AUTHZ_CROSS_SQUAD: cannot access another squad\'s telemetry');
    }

    return this.prisma.productTelemetryHourly.findMany({
      where: { productId },
      orderBy: { recordedHour: 'desc' },
      take: Math.min(Math.max(hours, 1), 720),
    });
  }
}

