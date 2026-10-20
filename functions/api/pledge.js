export async function onRequestPost(context) {
  try {
    const { email } = await context.request.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'No email supplied' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = context.env?.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = context.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/pledges`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            timestamp: new Date().toISOString()
          })
        });
      } catch (sbErr) {
        console.error('Supabase pledge error:', sbErr);
      }
    }

    return new Response(JSON.stringify({ message: 'Pledge recorded successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
