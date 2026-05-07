import 'server-only';

import { createClient, type Client } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';

import { AuthService } from '@/src/__codegen__/proto/auth_pb';

let cached: Client<typeof AuthService> | undefined;

// Server-side typed pact-auth client. Speaks raw gRPC over h2c against
// PACT_AUTH_GRPC_ADDR (e.g. "http://localhost:9090"). Cached at module
// scope so we don't open a new HTTP/2 connection per request.
//
// Never import this from a Client Component — credentials and gRPC errors
// must stay server-side. The `server-only` import enforces it at build time.
export const getPactAuthClient = (): Client<typeof AuthService> => {
  if (cached) return cached;

  const addr = process.env.PACT_AUTH_GRPC_ADDR;
  if (!addr) {
    throw new Error('PACT_AUTH_GRPC_ADDR is not set');
  }

  const baseUrl =
    addr.startsWith('http://') || addr.startsWith('https://')
      ? addr
      : `http://${addr}`;

  // gRPC transport always uses HTTP/2; plaintext h2c locally, TLS in prod
  // once we add mTLS at the gateway.
  cached = createClient(AuthService, createGrpcTransport({ baseUrl }));

  return cached;
};
