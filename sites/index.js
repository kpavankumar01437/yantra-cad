/**
 * Static asset worker for the YantraLab CAD frontend.
 *
 * The app is a client-only Vite/React bundle: no server code, no Node APIs, no bindings.
 * The worker serves the built assets and falls back to index.html so client-side
 * navigation (or a deep link) still boots the app.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    // A missing hashed build asset must be a real 404, never the HTML shell:
    // serving HTML here turns a stale chunk into a confusing MIME-type failure.
    if (url.pathname.startsWith('/assets/')) {
      const type = response.headers.get('content-type') ?? '';
      if (type.includes('text/html')) {
        return new Response('Asset not found', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
      return response;
    }

    if (response.status !== 404) return response;

    url.pathname = '/';
    url.search = '';
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
