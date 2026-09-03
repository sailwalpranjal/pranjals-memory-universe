import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/on-this-day
export async function GET() {
  const supabase = getSupabase();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();

  try {
    const { data: allPhotos, error } = await supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .or('is_archived.is.null,is_archived.eq.false')
      .order('captured_at', { ascending: false });

    if (error) throw error;

    // Match photos on this month and day from previous years
    // Or fallback to same calendar month from previous years if none on exact day
    let matching = (allPhotos || []).filter((p) => {
      if (!p.captured_at) return false;
      const d = new Date(p.captured_at);
      return (
        d.getMonth() + 1 === currentMonth &&
        d.getDate() === currentDay &&
        d.getFullYear() < currentYear
      );
    });

    let isMonthFallback = false;
    if (matching.length === 0) {
      // Fallback: any photos from this month across past years
      matching = (allPhotos || []).filter((p) => {
        if (!p.captured_at) return false;
        const d = new Date(p.captured_at);
        return d.getMonth() + 1 === currentMonth && d.getFullYear() < currentYear;
      });
      isMonthFallback = true;
    }

    if (matching.length === 0 && (allPhotos || []).length > 0) {
      // If none from past years, surface latest memorable photos as archival flashback
      matching = (allPhotos || []).slice(0, 4);
      isMonthFallback = true;
    }

    const signedMap = await getSignedUrlsForPhotos(
      supabase,
      matching.filter((p) => !p.cloudinary_url && p.storage_path),
      3600
    );

    const enriched = matching.map((p) => {
      let finalUrl = p.cloudinary_url || null;
      if (!finalUrl && p.storage_path) {
        const cleanPath = p.storage_path.trim().replace(/^\/+/, '');
        finalUrl = signedMap.get(cleanPath) || signedMap.get(p.storage_path) || null;
      }

      const captureYear = p.captured_at ? new Date(p.captured_at).getFullYear() : currentYear;
      const yearsDiff = currentYear - captureYear;
      const yearsAgo = yearsDiff > 0 ? yearsDiff : 0;

      return {
        ...p,
        url: finalUrl,
        yearsAgo,
        isRecent: yearsAgo === 0,
      };
    });

    return NextResponse.json({
      memories: enriched,
      isMonthFallback,
      dateString: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
