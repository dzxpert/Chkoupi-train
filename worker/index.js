import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  try {
    // Try to serve the file as-is
    return await getAssetFromKV(event);
  } catch (e) {
    // Fallback to index.html for SPA routing
    try {
      const url = new URL(event.request.url);
      url.pathname = '/index.html';
      const notFoundResponse = await getAssetFromKV(event, {
        mapRequestToAsset: req => new Request(url.toString(), req),
      });
      return new Response(notFoundResponse.body, {
        ...notFoundResponse,
        status: 200,
      });
    } catch (fallbackError) {
      return new Response('Not Found', { status: 404 });
    }
  }
}
