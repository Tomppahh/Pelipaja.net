import { getServerStatus } from '@/src/backend/services/gameServerService';

export async function GET() {
  const status = await getServerStatus();
  return Response.json(status);
}