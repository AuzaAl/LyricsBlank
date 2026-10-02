import { NextRequest, NextResponse } from 'next/server';

// Ensure TLS certificate validation doesn't fail on external API proxy in Node
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get('track')?.trim();
  const artist = searchParams.get('artist')?.trim();
  const query = searchParams.get('q')?.trim();
  const duration = searchParams.get('duration')?.trim();

  if (!track && !query) {
    return NextResponse.json({ error: 'Missing track or query parameter' }, { status: 400 });
  }

  try {
    const urlsToTry: string[] = [];

    // 1. If track and artist provided, try exact lookup
    if (track && artist) {
      let url = `https://lyrics-api.binimum.org/?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}`;
      if (duration) url += `&duration=${encodeURIComponent(duration)}`;
      urlsToTry.push(url);

      // Fallback 1a: Combined search
      urlsToTry.push(`https://lyrics-api.binimum.org/?q=${encodeURIComponent(`${artist} ${track}`)}`);
      // Fallback 1b: Track alone search
      urlsToTry.push(`https://lyrics-api.binimum.org/?q=${encodeURIComponent(track)}`);
    } else if (query) {
      urlsToTry.push(`https://lyrics-api.binimum.org/?q=${encodeURIComponent(query)}`);
    } else if (track) {
      urlsToTry.push(`https://lyrics-api.binimum.org/?q=${encodeURIComponent(track)}`);
    }

    let biniData: { total?: number; results?: Array<{ timing_type: string; lyricsUrl?: string; track_name?: string; artist_name?: string }> } | null = null;
    let results: Array<{ timing_type: string; lyricsUrl?: string; track_name?: string; artist_name?: string }> = [];

    for (const apiUrl of urlsToTry) {
      try {
        const biniRes = await fetch(apiUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          next: { revalidate: 3600 },
        });

        if (biniRes.ok) {
          const data = await biniRes.json();
          if (data.results && data.results.length > 0) {
            biniData = data;
            results = data.results;
            break;
          }
        }
      } catch (err) {
        console.warn(`Fetch error for ${apiUrl}:`, err);
      }
    }

    if (!biniData || results.length === 0) {
      return NextResponse.json({ total: 0, results: [], ttml: '' });
    }

    // Prioritize word-level timing, then line-level
    const bestMatch =
      results.find((r) => r.timing_type === 'word') ||
      results.find((r) => r.timing_type === 'line') ||
      results[0];

    // Fetch the actual TTML file from lyricsUrl (e.g. https://lrc.red/s/FR96X1903505.ttml)
    let ttmlContent = '';
    if (bestMatch && bestMatch.lyricsUrl) {
      try {
        const ttmlRes = await fetch(bestMatch.lyricsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/xml, text/xml, */*',
          },
          next: { revalidate: 86400 },
        });

        if (ttmlRes.ok) {
          ttmlContent = await ttmlRes.text();
        }
      } catch (ttmlErr) {
        console.warn('Failed to fetch TTML file from lyricsUrl:', ttmlErr);
      }
    }

    return NextResponse.json({
      total: biniData.total ?? results.length,
      match: bestMatch,
      ttml: ttmlContent,
      allResults: results.slice(0, 5),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
