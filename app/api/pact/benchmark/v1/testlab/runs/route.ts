import { type NextRequest, NextResponse } from 'next/server';

// Proxy for /api/pact/benchmark/v1/testlab/runs → pact-benchmark internal server.
//
// Extracts the pact_session cookie and passes it as X-Pact-Actor so
// pact-benchmark can scope runs per user without decoding the JWT itself.
// In mock mode MSW intercepts before this handler is reached.

const BENCHMARK_URL =
  process.env.PACT_BENCHMARK_URL ?? 'http://localhost:10093';
const SESSION_COOKIE = 'pact_session';

function headers(req: NextRequest): Headers {
  const h = new Headers();
  h.set('content-type', 'application/json');
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) h.set('x-pact-actor', token);

  return h;
}

export async function GET(req: NextRequest) {
  const upstream = await fetch(
    `${BENCHMARK_URL}/v1/benchmark/testlab/runs${req.nextUrl.search}`,
    { method: 'GET', headers: headers(req) }
  );

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${BENCHMARK_URL}/v1/benchmark/testlab/runs`, {
    method: 'POST',
    headers: headers(req),
    body: req.body,
    duplex: 'half',
  } as RequestInit);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
