import { NextRequest, NextResponse } from 'next/server';

// In-memory cache: domain → { buffer, contentType, cachedAt }
const cache = new Map<string, { buffer: ArrayBuffer; contentType: string; cachedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam

const FAVICON_SOURCES = (domain: string) => [
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
    `https://icon.horse/icon/${domain}`,
    `https://${domain}/favicon.ico`,
    `https://www.${domain}/favicon.ico`,
];

export async function GET(req: NextRequest) {
    const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase().trim();

    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        return new NextResponse(null, { status: 400 });
    }

    const cached = cache.get(domain);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
        return new NextResponse(cached.buffer, {
            headers: {
                'Content-Type': cached.contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
                'X-Cache': 'HIT',
            },
        });
    }

    for (const url of FAVICON_SOURCES(domain)) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FaviconProxy/1.0)' },
                signal: AbortSignal.timeout(4000),
            });

            if (!res.ok) continue;

            const contentType = res.headers.get('content-type') ?? 'image/x-icon';
            if (contentType.includes('text/html')) continue;

            const buffer: ArrayBuffer = await res.arrayBuffer();
            if (buffer.byteLength < 64) continue;

            cache.set(domain, { buffer, contentType, cachedAt: Date.now() });

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
                    'X-Cache': 'MISS',
                },
            });
        } catch {
            continue;
        }
    }

    return new NextResponse(null, { status: 404 });
}