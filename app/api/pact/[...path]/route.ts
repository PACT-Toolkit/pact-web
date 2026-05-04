import { type NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  const target = `${GATEWAY_URL}/api/pact/${path.join('/')}${req.nextUrl.search}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: req.method,
    headers: req.headers,
    ...(hasBody && { body: req.body, duplex: 'half' }),
  } as RequestInit);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

export const GET = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const POST = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const PUT = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const PATCH = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
