import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { switchMap } from "rxjs/operators";
import { StorageService } from "./storage.service";

@Injectable()
export class StorageUrlInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      switchMap(async (data) => {
        if (!this.storage.isS3Mode() || data == null) return data;
        return this.signDeep(data);
      }),
    );
  }

  private async signDeep(value: unknown): Promise<unknown> {
    if (typeof value === "string") {
      return this.storage.isS3Url(value) ? this.storage.signUrl(value) : value;
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.signDeep(item)));
    }
    // Leaf value types that are objects but must not be recursed into.
    // `Object.entries(new Date())` is `[]`, which would collapse the date to
    // `{}` and produce "Invalid Date" on the client.
    if (value instanceof Date || Buffer.isBuffer(value)) {
      return value;
    }
    if (value && typeof value === "object") {
      const entries = await Promise.all(
        Object.entries(value).map(async ([k, v]) => [k, await this.signDeep(v)]),
      );
      return Object.fromEntries(entries);
    }
    return value;
  }
}
