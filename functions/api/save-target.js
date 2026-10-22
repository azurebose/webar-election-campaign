export async function onRequestPost(context) {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    let savedFiles = [];

    if (contentType.includes('multipart/form-data') && context.env?.R2_BUCKET) {
      const formData = await context.request.formData();
      const mind = formData.get('mind');
      const image = formData.get('image');
      const video = formData.get('video');

      if (mind && typeof mind.arrayBuffer === 'function') {
        await context.env.R2_BUCKET.put('posters/targets.mind', await mind.arrayBuffer(), {
          httpMetadata: { contentType: 'application/octet-stream' }
        });
        savedFiles.push('targets.mind');
      }
      if (image && typeof image.arrayBuffer === 'function') {
        await context.env.R2_BUCKET.put('posters/sample_marker.png', await image.arrayBuffer(), {
          httpMetadata: { contentType: image.type || 'image/png' }
        });
        savedFiles.push('sample_marker.png');
      }
      if (video && typeof video.arrayBuffer === 'function') {
        await context.env.R2_BUCKET.put('posters/campaign_speech.mp4', await video.arrayBuffer(), {
          httpMetadata: { contentType: video.type || 'video/mp4' }
        });
        savedFiles.push('campaign_speech.mp4');
      }

      return new Response(
        JSON.stringify({
          success: true,
          fsPersisted: true,
          savedFiles,
          message: 'Target assets successfully synced to Cloudflare R2 bucket.',
          timestamp: Date.now()
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        fsPersisted: false,
        message: 'Target compiled successfully. Client-side AR session active.',
        timestamp: Date.now()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Error processing target upload'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

