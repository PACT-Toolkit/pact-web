import { http, HttpResponse } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const mockUser = {
  id: uuidv4(),
  email: 'dev@pact.local',
  name: 'Dev User',
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  image: null,
};

const mockSession = {
  id: uuidv4(),
  userId: mockUser.id,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  token: uuidv4(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const handlers = [
  http.get('*/api/auth/get-session', () =>
    HttpResponse.json({ user: mockUser, session: mockSession })
  ),
  http.post('*/api/auth/sign-out', () => HttpResponse.json({ success: true })),
];
