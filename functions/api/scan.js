export async function onRequestPost(context) {
  try {
    const { increment = 1, email } = await context.request.json();
    const supabaseUrl = context.env?.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = context.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (email && supabaseUrl && supabaseKey) {
      try {
        const getRes = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=scans`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`
            }
          }
        );
        const data = await getRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const newScans = (data[0].scans || 0) + increment;
          await fetch(
            `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ scans: newScans })
            }
          );
          return new Response(
            JSON.stringify({ scans: newScans, authenticated: true }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (sbErr) {
        console.error('Supabase scan sync error:', sbErr);
      }
    }

    return new Response(
      JSON.stringify({ scans: increment, authenticated: !!email }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
