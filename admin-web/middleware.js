export const config = {
  matcher: ['/((?!.*\\.).*)'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const indexUrl = new URL('/index.html', url.origin);
  const response = await fetch(indexUrl, { headers: { 'accept-encoding': 'identity' } });
  let html = await response.text();
  const origin = url.origin.replace(/\/$/, '');
  if (html.includes('__SITE_ORIGIN__')) {
    html = html.replaceAll('__SITE_ORIGIN__', origin);
  }

  const headers = new Headers(response.headers);
  // fetch() already decoded the file. Leaving content-encoding makes the browser fail with ERR_CONTENT_DECODING_FAILED.
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');

  return new Response(html, {
    status: response.status,
    headers,
  });
}
