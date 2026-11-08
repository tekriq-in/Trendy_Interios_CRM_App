import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = ['res.cloudinary.com', 'storage.googleapis.com'];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status });
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const body = await upstream.arrayBuffer();

  const fileName = parsed.pathname.split('/').pop() ?? 'file';

  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      // inline = display in browser, not download
      'Content-Disposition': `inline; filename="${fileName}"`,
      // Intentionally omit X-Frame-Options so the browser can embed this in an iframe
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
