/**
 * URL Proxy API
 * 
 * Fetches data from a URL server-side to avoid CORS issues.
 * Only allows http/https protocols and enforces a size limit.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS = 15000; // 15 seconds

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Only allow http/https
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http/https URLs are allowed' }, { status: 400 });
  }

  // Block localhost and private IPs (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('172.17.') ||
    hostname.startsWith('172.18.') ||
    hostname.startsWith('172.19.') ||
    hostname.startsWith('172.2') ||
    hostname.startsWith('192.168.') ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return NextResponse.json({ error: 'Blocked: private/internal IP range' }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Busara-AI/1.0 (data-fetcher)',
        'Accept': 'text/csv, application/json, text/plain, */*',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Fetch failed: HTTP ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${contentLength} bytes, max ${MAX_SIZE} bytes)` },
        { status: 413 }
      );
    }

    const text = await response.text();

    // Enforce size limit on actual content
    if (text.length > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${text.length} bytes, max ${MAX_SIZE} bytes)` },
        { status: 413 }
      );
    }

    const contentType = response.headers.get('content-type') || '';

    return NextResponse.json({
      data: text,
      contentType,
      size: text.length,
      url: parsedUrl.toString(),
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    return NextResponse.json(
      { error: `Fetch failed: ${err.message || 'Unknown error'}` },
      { status: 502 }
    );
  }
}
