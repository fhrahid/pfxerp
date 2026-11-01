import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dynamic SystemSettings key-value configuration (main.md §8).
 * Values are cached in-memory and invalidated on write.
 */
@Injectable()
export class SettingsService {
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  private async raw(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row) return null;
    this.cache.set(key, row.value);
    return row.value;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const v = await this.raw(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  async getString(key: string, fallback: string): Promise<string> {
    const v = await this.raw(key);
    return v === null ? fallback : v;
  }

  async getJSON<T>(key: string, fallback: T): Promise<T> {
    const v = await this.raw(key);
    if (v === null) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }

  async upsert(key: string, value: string, type: string) {
    const row = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, type },
      create: { key, value, type },
    });
    this.cache.set(key, value);
    return row;
  }

  invalidate() {
    this.cache.clear();
  }

  async currentSprint(): Promise<number> {
    return this.getNumber('CURRENT_SPRINT', 1);
  }
}
