import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '../../../../lib/supabase/server';

function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body?.phone ?? '');

    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: 'Valid phone number required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to start OTP.' }, { status: 500 });
  }
}
