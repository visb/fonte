import { DataSource } from "typeorm";
import {
  REBASE_TARGETS,
  readFlag,
  rebaseStorageUrls,
  resolveBases,
} from "./rewrite-storage-urls";

const FROM = "https://t3.storageapi.dev/old-bucket";
const TO = "https://static.fontedemisericordia.com.br/fonte";

type Row = { id: string; value: string };

/**
 * DataSource stub whose `query` answers SELECTs from `rowsByTable` and records
 * every UPDATE. Keyed by `<table>.<column>` so a target can be seeded per
 * column.
 */
function makeDataSource(rowsByTable: Record<string, Row[]> = {}) {
  const updates: Array<{ sql: string; params: unknown[] }> = [];
  const selects: string[] = [];

  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("SELECT")) {
        selects.push(sql);
        const match = /FROM (\w+) WHERE "(\w+)"/.exec(sql);
        const key = match ? `${match[1]}.${match[2]}` : "";
        return rowsByTable[key] ?? [];
      }
      updates.push({ sql, params: params ?? [] });
      return [];
    }),
  };

  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => Promise<void>) =>
      cb(manager),
    ),
  } as unknown as DataSource;

  return { dataSource, updates, selects };
}

describe("rebaseStorageUrls (story 188)", () => {
  it("covers every table and column that holds a storage url", () => {
    // Asserting the full list on purpose: a forgotten table would silently
    // leave rows pointing at the decommissioned bucket.
    expect(REBASE_TARGETS).toEqual([
      { table: "activity_attachments", columns: ["file_url"], kind: "url" },
      {
        table: "bible_course_class_photos",
        columns: ["file_url"],
        kind: "url",
      },
      { table: "house_photos", columns: ["url"], kind: "url" },
      { table: "messages", columns: ["attachment_url"], kind: "url" },
      {
        table: "payables",
        columns: ["attachment_url", "payment_receipt_url"],
        kind: "url",
      },
      { table: "relatives", columns: ["photo_url"], kind: "url" },
      { table: "resident_attachments", columns: ["file_url"], kind: "url" },
      { table: "resident_documents", columns: ["signed_file_url"], kind: "url" },
      { table: "resident_follow_ups", columns: ["attachment_url"], kind: "url" },
      { table: "resident_receivables", columns: ["attachment_url"], kind: "url" },
      {
        table: "residents",
        columns: ["photo_url", "photo_thumb_url"],
        kind: "url",
      },
      { table: "staff", columns: ["photo_url", "signature_url"], kind: "url" },
      { table: "staff_attachments", columns: ["file_url"], kind: "url" },
      { table: "document_templates", columns: ["content"], kind: "html" },
    ]);
  });

  it("selects from all 14 tables, every column (16 url + 1 html)", async () => {
    const { dataSource, selects } = makeDataSource();
    const columnCount = REBASE_TARGETS.reduce(
      (acc, t) => acc + t.columns.length,
      0,
    );

    await rebaseStorageUrls(dataSource, FROM, TO);

    expect(REBASE_TARGETS).toHaveLength(14);
    expect(columnCount).toBe(17);
    expect(REBASE_TARGETS.filter((t) => t.kind === "html")).toHaveLength(1);
    expect(selects).toHaveLength(columnCount);
  });

  it("rewrites a url column, keeping the object key", async () => {
    const { dataSource, updates } = makeDataSource({
      "residents.photo_url": [{ id: "r1", value: `${FROM}/residents/a.jpg` }],
    });

    const { updated, total } = await rebaseStorageUrls(dataSource, FROM, TO);

    expect(updates).toHaveLength(1);
    expect(updates[0].params).toEqual([`${TO}/residents/a.jpg`, "r1"]);
    expect(updated["residents.photo_url"]).toBe(1);
    expect(total).toBe(1);
  });

  it("uses the html path for document_templates.content", async () => {
    const { dataSource, updates } = makeDataSource({
      "document_templates.content": [
        { id: "t1", value: `<p>x</p><img src="${FROM}/documents/a.png">` },
      ],
    });

    await rebaseStorageUrls(dataSource, FROM, TO);

    expect(updates[0].params[0]).toBe(
      `<p>x</p><img src="${TO}/documents/a.png">`,
    );
  });

  it("does not UPDATE a row whose value does not change", async () => {
    const { dataSource, updates } = makeDataSource({
      "residents.photo_url": [
        { id: "r1", value: "https://other.cdn/x.png" },
        { id: "r2", value: `${TO}/residents/already.jpg` },
      ],
    });

    const { total } = await rebaseStorageUrls(dataSource, FROM, TO);

    expect(updates).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("counts only the rows it actually rewrote", async () => {
    const { dataSource, updates } = makeDataSource({
      "residents.photo_url": [
        { id: "r1", value: `${FROM}/residents/a.jpg` },
        { id: "r2", value: "https://other.cdn/x.png" },
        { id: "r3", value: `${FROM}/residents/b.jpg` },
      ],
    });

    const { updated, total } = await rebaseStorageUrls(dataSource, FROM, TO);

    expect(updates).toHaveLength(2);
    expect(updated["residents.photo_url"]).toBe(2);
    expect(total).toBe(2);
  });

  it("runs everything inside a single transaction", async () => {
    const { dataSource } = makeDataSource();
    await rebaseStorageUrls(dataSource, FROM, TO);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing, empty or identical base before writing anything", async () => {
    const cases: Array<[string, string]> = [
      ["", TO],
      [FROM, ""],
      [FROM, FROM],
    ];

    for (const [from, to] of cases) {
      const { dataSource, updates } = makeDataSource({
        "residents.photo_url": [{ id: "r1", value: `${FROM}/residents/a.jpg` }],
      });
      await expect(rebaseStorageUrls(dataSource, from, to)).rejects.toThrow();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(updates).toHaveLength(0);
    }
  });
});

describe("readFlag", () => {
  it("reads the value that follows the flag", () => {
    expect(readFlag(["--from", FROM], "--from")).toBe(FROM);
  });

  it("returns undefined when the flag is absent", () => {
    expect(readFlag(["--to", TO], "--from")).toBeUndefined();
  });

  it("returns undefined when the flag has no value", () => {
    expect(readFlag(["--from"], "--from")).toBeUndefined();
  });

  it("does not swallow the next flag as a value", () => {
    expect(readFlag(["--from", "--to", TO], "--from")).toBeUndefined();
  });
});

describe("resolveBases", () => {
  const ENV = {
    AWS_ENDPOINT_URL: "https://static.fontedemisericordia.com.br",
    AWS_S3_BUCKET_NAME: "fonte",
  };

  it("uses --to when given, ignoring the env", () => {
    expect(resolveBases(["--from", FROM, "--to", TO], ENV)).toEqual({
      fromBase: FROM,
      toBase: TO,
    });
  });

  it("falls back to endpoint + bucket from the env", () => {
    expect(resolveBases(["--from", FROM], ENV)).toEqual({
      fromBase: FROM,
      toBase: TO,
    });
  });

  it("throws when --from is missing or has no value", () => {
    expect(() => resolveBases([], ENV)).toThrow(/--from/);
    expect(() => resolveBases(["--from"], ENV)).toThrow(/--from/);
  });

  it("throws when there is no --to and the env is incomplete", () => {
    expect(() => resolveBases(["--from", FROM], {})).toThrow(/AWS_ENDPOINT_URL/);
    expect(() =>
      resolveBases(["--from", FROM], { AWS_ENDPOINT_URL: ENV.AWS_ENDPOINT_URL }),
    ).toThrow(/AWS_S3_BUCKET_NAME/);
  });
});
