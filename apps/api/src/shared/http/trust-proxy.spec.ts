/** IP klien di belakang nginx (audit keamanan 2026-10-14). */
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import 'reflect-metadata';
import { Controller, Get, Module, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { trustReverseProxy } from './trust-proxy.js';

@Controller()
class IpController {
  @Get('ip')
  ip(@Req() request: { ip?: string }): string {
    return request.ip ?? '';
  }
}

@Module({ controllers: [IpController] })
class IpModule {}

let app: NestExpressApplication;
let port: number;

beforeAll(async () => {
  app = await NestFactory.create<NestExpressApplication>(IpModule, { logger: false });
  trustReverseProxy(app);
  await app.listen(0, '127.0.0.1');
  port = ((app.getHttpServer() as Server).address() as AddressInfo).port;
});
afterAll(() => app.close());

const ipSeenWith = (forwardedFor?: string) =>
  new Promise<string>((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/ip',
        headers: forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(body));
      },
    );
    req.on('error', reject);
    req.end();
  });

describe('trustReverseProxy', () => {
  it('IP yang ditambahkan nginx (ujung kanan) dipakai — bukan IP kontainer nginx', async () => {
    expect(await ipSeenWith('203.0.113.7')).toBe('203.0.113.7');
  });

  it('alamat palsu buatan klien di sebelah kiri diabaikan', async () => {
    expect(await ipSeenWith('1.1.1.1, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('tanpa proxy (smoke dari server sendiri) → alamat koneksi', async () => {
    expect(await ipSeenWith()).toMatch(/127\.0\.0\.1/);
  });
});
