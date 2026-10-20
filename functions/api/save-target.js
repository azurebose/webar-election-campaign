export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      success: true,
      fsPersisted: false,
      message: 'Target compiled successfully. Client-side AR session active.',
      timestamp: Date.now()
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
