
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types';
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from '@prisma/client';

type Env = {
  DB: D1Database;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      // Handle CORS preflight request
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, CF-Connecting-IP, x-real-ip',
          'Access-Control-Max-Age': '86400' // Cache preflight response for 1 day
        }
      });
    }
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });
    const body = await request.json() as {
      id: string;
      ua?: string;
      lang?: string;
      tz?: string;
    };
    const fpId = body.id;
    const ua = body.ua ?? '';
    const lang = body.lang ?? '';
    const tz = body.tz ?? '';
    const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-real-ip') ?? '0.0.0.0';
    const ip24 = ip.split('.').slice(0, 3).join('.');
    const compositeId = crypto.subtle
      ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${fpId}|${ip24}`))))
          .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
      : `${fpId}-${ip24}`; // fallback (non-secure Workers env)
    await prisma.deviceFingerprint.upsert({
      where: { compositeId },
      update: { lastSeen: new Date() },
      create: {
        compositeId,
        fpId,
        ip,
        ua,
        lang,
        tz
      }
    });
    return new Response(null, { status: 204 }); // No Content
  }
}
