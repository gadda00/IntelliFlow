import { NextRequest, NextResponse } from 'next/server';
import { initiateSSO } from '@/lib/auth/sso';

export async function GET(req: NextRequest) {
  return initiateSSO(req);
}
