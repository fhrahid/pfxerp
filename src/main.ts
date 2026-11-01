import 'reflect-metadata';
import './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaClient } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Serve the static test console (public/) — works for ts-node dev and the Docker runtime
  app.useStaticAssets(join(process.cwd(), 'public'));

  const config = new DocumentBuilder()
    .setTitle('Pointfex ERP API')
    .setDescription('Pointfex Venture Studio ERP — v1. "From an idea to a greater impact."')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // AUTO_SEED=true: populate genesis state on first boot (e.g. fresh Dokploy deployment)
  if (process.env.AUTO_SEED === 'true') {
    try {
      const check = new PrismaClient();
      const users = await check.user.count();
      await check.$disconnect();
      if (users === 0) {
        const { runSeed } = await import('../prisma/seed');
        await runSeed();
      }
    } catch (e) {
      console.warn('AUTO_SEED skipped:', (e as Error).message);
    }
  }

  await app.listen(Number(process.env.PORT) || 3000);
  console.log(`Pointfex ERP v1 running on http://localhost:${process.env.PORT || 3000}/api/v1 (docs: /api/docs)`);
}
bootstrap();
