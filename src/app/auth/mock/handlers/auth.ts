// Auth mocking now lives server-side. /api/auth/* route handlers in
// app/api/auth/ are real code that talks to pact-auth via gRPC; MSW only
// intercepts client-side fetches, so there's nothing to mock here.
//
// The empty export keeps mocks/handlers.ts's spread structure consistent
// with the other feature modules, so adding handlers later (e.g. for a
// passwordless / magic-link client flow) doesn't need an import dance.

import { type RequestHandler } from 'msw';

export const handlers: RequestHandler[] = [];
