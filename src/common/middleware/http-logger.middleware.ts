import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || 'unknown';
    const start = performance.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const user = (req as any).user;
      const userInfo = user ? `[User: ${user.id} (${user.role})]` : '[Anon]';
      const clientIp = (req.headers['x-forwarded-for'] as string) || ip || req.socket?.remoteAddress || 'unknown';

      const logMsg = `${method} ${originalUrl} ${statusCode} +${durationMs}ms - ${clientIp} ${userInfo} - ${userAgent}`;

      if (statusCode >= 500) {
        this.logger.error(logMsg);
      } else if (statusCode >= 400) {
        this.logger.warn(logMsg);
      } else {
        this.logger.log(logMsg);
      }
    });

    next();
  }
}
