// Sentry primeiro de tudo — pré-requisito do auto-instrument (@sentry/nestjs).
import "./instrument";
import "reflect-metadata";
import { types } from "pg";
// TIMESTAMP WITHOUT TIME ZONE (OID 1114) — pg lê como string local; forçar UTC
types.setTypeParser(1114, (val: string) => new Date(val + "Z"));
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import { join } from "path";
import { AppModule } from "./app.module";
import { parseCorsOrigin } from "./common/cors-origin";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Limit elevado para suportar conteúdo rico em templates
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  // CORS_ORIGIN é a allow-list de produção (lista separada por vírgula, um host
  // por front-end). Sem a variável, mantém o comportamento aberto — é o que dev
  // e as suítes e2e usam.
  const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN);
  app.enableCors(corsOrigin ? { origin: corsOrigin } : undefined);

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Fallback de disco só quando NÃO há bucket configurado. Em modo S3/MinIO o
  // acervo sai por URL assinada e servir /uploads estático o exporia sem auth.
  if (!process.env.AWS_S3_BUCKET_NAME) {
    app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
