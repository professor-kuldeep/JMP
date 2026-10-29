import { NextResponse } from 'next/server';
import { getAdminSession, userPayload } from '../../../lib/auth';
export async function GET(request) {
  const session = await getAdminSession(request);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user: userPayload(session), csrfToken: session.csrfToken, session: { id: session.id, createdAt: session.createdAt, lastSeenAt: session.lastSeenAt, absoluteExpiresAt: session.absoluteExpiresAt, idleExpiresAt: session.idleExpiresAt } });
}
