import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/og-image?url=https://example.org
 *
 * Fetches a website and extracts the best representative image
 * (og:image, twitter:image, or first large <img>).
 * Used by the CreditLedger dashboard to auto-discover images for new orgs.
 */

const cache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET(request: NextRequest) {
  const siteUrl = request.nextUrl.searchParams.get('url');

  if (!siteUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Normalize the URL
  let normalizedUrl: string;
  try {
    const u = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
    normalizedUrl = u.origin; // just the homepage
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(normalizedUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ image: cached.url });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CreditLedger/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      cache.set(normalizedUrl, { url: null, ts: Date.now() });
      return NextResponse.json({ image: null });
    }

    const html = await res.text();

    // Extract image from meta tags (priority order)
    const image = extractImage(html, normalizedUrl);

    cache.set(normalizedUrl, { url: image, ts: Date.now() });
    return NextResponse.json({ image });
  } catch {
    cache.set(normalizedUrl, { url: null, ts: Date.now() });
    return NextResponse.json({ image: null });
  }
}

function extractImage(html: string, baseUrl: string): string | null {
  // 1. og:image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], baseUrl);

  // 2. twitter:image
  const twMatch = html.match(/<meta[^>]*(?:name|property)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']twitter:image["']/i);
  if (twMatch?.[1]) return resolveUrl(twMatch[1], baseUrl);

  // 3. First hero/banner image (large image in header area)
  const heroRegex = new RegExp('<img[^>]*class=["\'][^"\']*(?:hero|banner|header|featured)[^"\']*["\'][^>]*src=["\']([^"\']+)["\']', 'i');
  const heroMatch = html.match(heroRegex);
  if (heroMatch?.[1]) return resolveUrl(heroMatch[1], baseUrl);

  // 4. First reasonably-sized image
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1];
    // Skip tiny images, icons, tracking pixels, svgs
    if (/\.(svg|ico|gif)$/i.test(src)) continue;
    if (/logo|icon|favicon|pixel|track|badge|button|avatar/i.test(src)) continue;
    // Check for size hints suggesting a substantial image
    const widthMatch = m[0].match(/width=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 200) continue;
    return resolveUrl(src, baseUrl);
  }

  return null;
}

function resolveUrl(url: string, base: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}
