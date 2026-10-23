import { onRequestPost as handleScanPost } from './functions/api/scan.js';
import { onRequestPost as handleAuthPost } from './functions/api/auth.js';
import { onRequestPost as handlePledgePost } from './functions/api/pledge.js';
import { onRequestPost as handleSaveTargetPost } from './functions/api/save-target.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight for all API endpoints
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. Health Check Endpoint
    if (url.pathname === '/api/health' || (url.pathname === '/api/scan' && request.method === 'GET')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'WebAR Election Campaign API',
          timestamp: new Date().toISOString(),
          r2Bound: !!env.R2_BUCKET,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 2.5 Live R2 dynamic asset streaming for wards.json & targets.mind
    if (env.R2_BUCKET) {
      if (url.pathname === '/wards.json' || url.pathname === '/posters/wards.json' || url.pathname === '/api/wards') {
        const obj = await env.R2_BUCKET.get('posters/wards.json');
        if (obj) {
          const body = await obj.text();
          return new Response(body, {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      }

      if (url.pathname === '/targets.mind' || url.pathname === '/posters/targets.mind' || url.pathname === '/api/targets') {
        const obj = await env.R2_BUCKET.get('posters/targets.mind');
        if (obj) {
          return new Response(obj.body, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      }

      if (url.pathname.startsWith('/ward_') && url.pathname.endsWith('_targets.mind')) {
        const rawName = url.pathname.replace(/^\/+/, '');
        const obj = (await env.R2_BUCKET.get(`posters/${rawName}`)) || (await env.R2_BUCKET.get('posters/targets.mind'));
        if (obj) {
          return new Response(obj.body, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      }
    }

    // 3. Admin Upload URL Generator & Direct Cloudflare R2 Upload
    if (url.pathname === '/api/admin/upload-url' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { filename = 'targets.mind', contentType = 'application/octet-stream' } = body;
        const cleanFilename = filename.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
        const key = cleanFilename.startsWith('posters/') ? cleanFilename : `posters/${cleanFilename}`;
        const publicDomain = env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'pub-2a862321b71a474f8dfa575716c82ab4.r2.dev';

        // Direct upload endpoint routed through this Worker
        const uploadUrl = `${url.origin}/api/admin/direct-upload?key=${encodeURIComponent(key)}&type=${encodeURIComponent(contentType)}`;
        const publicUrl = `https://${publicDomain}/${key}`;

        return new Response(
          JSON.stringify({
            uploadUrl,
            publicUrl,
            key,
            expiresIn: 300,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    // 4. Handle Direct Cloudflare R2 Upload PUT
    if (url.pathname === '/api/admin/direct-upload' && request.method === 'PUT') {
      try {
        const key = url.searchParams.get('key') || 'posters/targets.mind';
        const contentType = url.searchParams.get('type') || request.headers.get('content-type') || 'application/octet-stream';

        if (env.R2_BUCKET) {
          const bodyData = await request.arrayBuffer();
          await env.R2_BUCKET.put(key, bodyData, {
            httpMetadata: { contentType },
          });
          return new Response(JSON.stringify({ success: true, key }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        return new Response(JSON.stringify({ success: true, notice: 'R2 simulated' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    // 5. Route incoming API requests to Cloudflare function handlers
    const context = {
      request,
      env,
      params: {},
      waitUntil: ctx?.waitUntil ? ctx.waitUntil.bind(ctx) : () => {},
    };

    let apiResponse = null;
    try {
      if (url.pathname === '/api/scan' && request.method === 'POST') {
        apiResponse = await handleScanPost(context);
      } else if (url.pathname === '/api/auth' && request.method === 'POST') {
        apiResponse = await handleAuthPost(context);
      } else if (url.pathname === '/api/pledge' && request.method === 'POST') {
        apiResponse = await handlePledgePost(context);
      } else if (url.pathname === '/api/save-target' && request.method === 'POST') {
        apiResponse = await handleSaveTargetPost(context);
      }
    } catch (err) {
      console.error('[Worker API Error]:', err);
      apiResponse = new Response(
        JSON.stringify({ error: err?.message || 'Worker Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (apiResponse) {
      const newHeaders = new Headers(apiResponse.headers);
      if (!newHeaders.has('Access-Control-Allow-Origin')) {
        newHeaders.set('Access-Control-Allow-Origin', '*');
      }
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: newHeaders,
      });
    }

    // 6. Fallback: serve static site export assets (HTML, CSS, JS, images, targets.mind)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
