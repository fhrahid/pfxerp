import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Converts Prisma Decimal / BigInt values into JSON-friendly primitives,
 * then wraps every response in the standard success envelope (main.md §7.1).
 */
function normalize(value: any, depth = 0): any {
  if (value == null || depth > 8) return value;
  if (value instanceof Prisma.Decimal) return Number(value);
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => normalize(v, depth + 1));
  if (typeof value === 'object') {
    if (value.constructor && value.constructor.name !== 'Object') {
      // Class instances (e.g. entities) — leave primitives untouched
      return value;
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v, depth + 1);
    return out;
  }
  return value;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: normalize(data),
        meta: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
