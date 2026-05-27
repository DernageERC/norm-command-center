import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '../../../../lib/supabase/server';

function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body?.phone ?? '');
    const code = String(body?.code ?? '').trim();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });

    if (error || !data.user || !data.session) {
      return NextResponse.json({ error: error?.message || 'Invalid code.' }, { status: 400 });
    }

    const profileUpsert = await supabase
      .from('profiles')
      .upsert({ user_id: data.user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (profileUpsert.error) {
      return NextResponse.json({ error: profileUpsert.error.message }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true, user: { id: data.user.id, phone: data.user.phone } });
    const maxAge = data.session.expires_in ?? 60 * 60 * 24 * 7;

    res.cookies.set('nn-access-token', data.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    res.cookies.set('nn-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Failed to verify OTP.' }, { status: 500 });
  }
}
