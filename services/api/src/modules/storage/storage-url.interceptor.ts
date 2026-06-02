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
    if (value && typeof value === "object" && this.isPlainObject(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([k, v]) => [k, await this.signDeep(v)]),
      );
      return Object.fromEntries(entries);
    }
    return value;
  }

  /**
   * Only recurse into plain objects. Dates and other class instances are
   * objects too, but `Object.entries` strips their value (a Date has no own
   * enumerable props), turning it into `{}` and producing "Invalid Date" on
   * the client. Those are left untouched.
   */
  private isPlainObject(value: object): boolean {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
}
