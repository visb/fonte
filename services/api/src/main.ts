import "reflect-metadata";
import { types } from "pg";
// TIMESTAMP WITHOUT TIME ZONE (OID 1114) — pg lê como string local; forçar UTC
types.setTypeParser(1114, (val: string) => new Date(val + "Z"));
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
