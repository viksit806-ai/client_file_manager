export const runtime = 'nodejs';

export function GET() {
  return Response.json({ success: true, message: 'CA Portal API running' });
}
