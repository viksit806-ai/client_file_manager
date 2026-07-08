import { handleApiRequest } from '@/server/api/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handleApiRequest;
export const POST = handleApiRequest;
export const PUT = handleApiRequest;
export const PATCH = handleApiRequest;
export const DELETE = handleApiRequest;
