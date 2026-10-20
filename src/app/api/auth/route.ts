import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailIsValid) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        console.error('Supabase OTP error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await supabase.from('users').upsert({ email, scans: 0 }, { onConflict: 'email' });
    }

    return NextResponse.json({ message: 'Magic link / OTP sent successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
