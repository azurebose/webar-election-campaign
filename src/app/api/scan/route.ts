import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';

export async function POST(request: Request) {
  try {
    const { increment = 1, email } = await request.json();

    if (email && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const { data, error: fetchErr } = await supabase
        .from('users')
        .select('scans')
        .eq('email', email)
        .single();

      if (!fetchErr && data) {
        const newScans = (data.scans || 0) + increment;
        await supabase
          .from('users')
          .update({ scans: newScans })
          .eq('email', email);

        return NextResponse.json({ scans: newScans, authenticated: true });
      }
    }

    return NextResponse.json({ scans: increment, authenticated: !!email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
