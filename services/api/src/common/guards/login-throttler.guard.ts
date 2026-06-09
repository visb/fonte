import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Throttle de login (força bruta, LGPD art. 46), exceto em ambiente de teste —
// suítes e2e fazem muitos logins do mesmo IP e seriam bloqueadas indevidamente.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(): Promise<boolean> {
    return process.env.NODE_ENV === 'test';
  }
}
