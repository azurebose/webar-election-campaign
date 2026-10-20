export async function onRequestPost(context) {
  try {
    const { email } = await context.request.json();

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailIsValid) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = context.env?.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = context.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/auth/v1/otp`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        await fetch(`${supabaseUrl}/rest/v1/users`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ email, scans: 0 })
        });
      } catch (sbErr) {
        console.error('Supabase fetch error:', sbErr);
      }
    }

    return new Response(JSON.stringify({ message: 'Magic link / OTP sent successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
