
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types';
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from '@prisma/client';

type Env = {
  DB: D1Database;
};

/**
 * JA4H を作る helper
 * 仕様:  a_b_c  の 3 ブロック (method+count / headerNamesHash / cookieHash)
 */
async function computeJA4H(request: Request): Promise<string> {
  const enc = new TextEncoder();

  // --- block a ---
  const methodChar = request.method.toLowerCase().charAt(0);
  const headerNames = [...request.headers.keys()]
    .filter((h) => h !== "cookie" && h !== "referer");
  const a = `${methodChar}${headerNames.length.toString().padStart(2, "0")}`;

  // --- block b (header name hash・先頭12hex) ---
  const headerConcat = headerNames.join(";");
  const b = await hash12(enc.encode(headerConcat));

  // --- block c (cookie hash・先頭12hex、無い場合は0) ---
  const cookieRaw = request.headers.get("cookie") ?? "";
  const c = cookieRaw ? await hash12(enc.encode(cookieRaw)) : "000000000000";

  return `${a}_${b}_${c}`;
}

/** 文字列を SHA-256 でハッシュし、先頭 12 hex を返す */
async function hash12(buf: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

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
    // 1. Cloudflare が計算した JA4 (Enterprise only)
    const cf: any = (request as any).cf ?? {};
    const ja4 = cf.botManagement?.ja4 ?? "unknown";
    // 2. HTTP ベース JA4H を自分で作る
    const ja4h = await computeJA4H(request);

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
    // const ip24 = ip.split('.').slice(0, 3).join('.');
    const compositeId = crypto.subtle
      ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ja4}|${ja4h}`))))
          .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
      : `${ja4}-${ja4h}`; // fallback (non-secure Workers env)
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
