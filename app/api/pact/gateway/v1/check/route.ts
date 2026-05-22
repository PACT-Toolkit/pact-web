import { type NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${GATEWAY_URL}/v1/check`, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
    duplex: 'half',
  } as RequestInit);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
