// Lightweight client for direct Supabase REST synchronization without external bundle bloat
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function syncPledgeToSupabase(email: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/pledges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ email, timestamp: new Date().toISOString() })
    });
  } catch (err) {
    console.warn('Supabase pledge sync notice:', err);
  }
}

export async function syncUserToSupabase(email: string, scans?: number): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    const payload: { email: string; scans?: number } = { email };
    if (scans !== undefined) {
      payload.scans = scans;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Supabase user sync notice:', err);
  }
}
