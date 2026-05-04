import { betterAuth } from 'better-auth';

// Database adapter to be wired up when backend is ready.
// For now auth API routes are stubs — the login page UI works without them.
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
