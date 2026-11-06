export const config = {
  matcher: ['/((?!.*\\.).*)'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const indexUrl = new URL('/index.html', url.origin);
  const response = await fetch(indexUrl);
  const html = await response.text();
  if (!html.includes('__SITE_ORIGIN__')) return response;

  const origin = url.origin.replace(/\/$/, '');
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');

  return new Response(html.replaceAll('__SITE_ORIGIN__', origin), {
    status: response.status,
    headers,
  });
}
