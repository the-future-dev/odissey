/**
 * Frontend Worker for Odissey Expo App
 * Serves the Expo web app with proper SPA routing
 */

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = "https://odissey-backend.andre-ritossa.workers.dev";
      const proxyUrl = new URL(url.pathname + url.search, backendUrl);
      
      return fetch(proxyUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    
    // For all other requests, serve static assets
    // The assets binding will handle SPA routing automatically
    // due to the "single-page-application" not_found_handling setting
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler; 