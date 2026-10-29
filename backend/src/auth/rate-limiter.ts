import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class AuthRateLimiter {
  private readonly ipRequests = new Map<string, RateLimitRecord>();
  private readonly accountRequests = new Map<string, RateLimitRecord>();

  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxIpAttempts = 5;
  private readonly maxAccountAttempts = 3;

  checkForgotPasswordLimit(ip: string, email: string): void {
    const now = Date.now();
    this.cleanExpired(this.ipRequests, now);
    this.cleanExpired(this.accountRequests, now);

    const ipRecord = this.ipRequests.get(ip) || { timestamps: [] };
    const validIpTimestamps = ipRecord.timestamps.filter((t) => now - t < this.windowMs);
    if (validIpTimestamps.length >= this.maxIpAttempts) {
      throw new HttpException(
        'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const accountRecord = this.accountRequests.get(normalizedEmail) || { timestamps: [] };
    const validAccountTimestamps = accountRecord.timestamps.filter((t) => now - t < this.windowMs);
    if (validAccountTimestamps.length >= this.maxAccountAttempts) {
      throw new HttpException(
        'Tài khoản này đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    validIpTimestamps.push(now);
    validAccountTimestamps.push(now);
    this.ipRequests.set(ip, { timestamps: validIpTimestamps });
    this.accountRequests.set(normalizedEmail, { timestamps: validAccountTimestamps });
  }

  reset(): void {
    this.ipRequests.clear();
    this.accountRequests.clear();
  }

  private cleanExpired(map: Map<string, RateLimitRecord>, now: number): void {
    for (const [key, record] of map.entries()) {
      const active = record.timestamps.filter((t) => now - t < this.windowMs);
      if (active.length === 0) {
        map.delete(key);
      } else {
        record.timestamps = active;
      }
    }
  }
}

