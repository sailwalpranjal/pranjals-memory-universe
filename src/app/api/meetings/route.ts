import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/meetings
export async function GET() {
  const supabase = getSupabase();
  try {
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*, people(id, name)')
      .order('scheduled_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ meetings: meetings || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/meetings
export async function POST(request: Request) {
  const supabase = getSupabase();
  try {
    const body = await request.json();
    const { title, person_id, scheduled_at, duration_minutes, notes } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data: newMeeting, error } = await supabase
      .from('meetings')
      .insert({
        title: title.trim(),
        person_id: person_id || null,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : new Date().toISOString(),
        duration_minutes: typeof duration_minutes === 'number' ? duration_minutes : 30,
        notes: notes || null,
        status: 'scheduled',
      })
      .select('*, people(id, name)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
