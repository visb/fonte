import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { BackupService } from "./backup.service";

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    BACKUP_S3_BUCKET_NAME: "backup-bucket",
    AWS_S3_BUCKET_NAME: "prod-bucket",
    AWS_ENDPOINT_URL: "https://s3.example.dev",
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const dataSource = {} as DataSource;

function obj(key: string) {
  return { key, size: 1, lastModified: "2026-01-01T00:00:00.000Z" };
}

describe("BackupService.pruneOldDumps", () => {
  it("mantém só os N dumps mais recentes e apaga o resto", async () => {
    const service = new BackupService(makeConfig(), dataSource); // retenção default = 4
    const dumps = [
      obj("db/2026-01-01.dump"),
      obj("db/2026-01-02.dump"),
      obj("db/2026-01-03.dump"),
      obj("db/2026-01-04.dump"),
      obj("db/2026-01-05.dump"),
      obj("db/2026-01-06.dump"),
    ];
    jest.spyOn(service as any, "listKeys").mockResolvedValue(dumps);
    const del = jest
      .spyOn(service as any, "deleteObject")
      .mockResolvedValue(undefined);

    const pruned = await service.pruneOldDumps();

    expect(pruned).toEqual(["db/2026-01-02.dump", "db/2026-01-01.dump"]);
    expect(del).toHaveBeenCalledTimes(2);
  });

  it("respeita BACKUP_RETENTION_COUNT configurado", async () => {
    const service = new BackupService(
      makeConfig({ BACKUP_RETENTION_COUNT: 2 }),
      dataSource,
    );
    const dumps = [obj("db/a.dump"), obj("db/b.dump"), obj("db/c.dump")];
    jest.spyOn(service as any, "listKeys").mockResolvedValue(dumps);
    const del = jest
      .spyOn(service as any, "deleteObject")
      .mockResolvedValue(undefined);

    await service.pruneOldDumps();
    expect(del).toHaveBeenCalledTimes(1); // mantém 2, apaga 1
  });
});

describe("BackupService.syncFiles", () => {
  it("copia só os arquivos ausentes no destino (incremental)", async () => {
    const service = new BackupService(makeConfig(), dataSource);
    jest.spyOn(service as any, "listKeys").mockImplementation((...args: any[]) => {
      const prefix = args[0] as string;
      if (prefix === "files/") return Promise.resolve([obj("files/a.jpg")]); // já existe
      return Promise.resolve([obj("a.jpg"), obj("b.jpg")]); // origem
    });
    const copy = jest
      .spyOn(service as any, "copyObject")
      .mockResolvedValue(undefined);

    const result = await service.syncFiles();

    expect(result).toEqual({ copied: 1, total: 2 });
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith("prod-bucket", "b.jpg", "files/b.jpg");
  });

  it("usa fallback download+put quando CopyObject falha", async () => {
    const service = new BackupService(makeConfig(), dataSource);
    jest.spyOn(service as any, "listKeys").mockImplementation((...args: any[]) => {
      const prefix = args[0] as string;
      if (prefix === "files/") return Promise.resolve([]);
      return Promise.resolve([obj("x.jpg")]);
    });
    jest
      .spyOn(service as any, "copyObject")
      .mockRejectedValue(new Error("not supported"));
    const get = jest
      .spyOn(service as any, "getObject")
      .mockResolvedValue(Buffer.from("data"));
    const put = jest
      .spyOn(service as any, "putObject")
      .mockResolvedValue(undefined);

    const result = await service.syncFiles();

    expect(result).toEqual({ copied: 1, total: 1 });
    expect(get).toHaveBeenCalledWith("prod-bucket", "x.jpg");
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("BackupService.runBackup", () => {
  it("pula quando não configurado", async () => {
    const service = new BackupService(
      makeConfig({ BACKUP_S3_BUCKET_NAME: undefined }),
      dataSource,
    );
    const result = await service.runBackup();
    expect(result.skipped).toBe(true);
  });
});
