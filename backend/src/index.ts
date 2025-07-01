/**
 * Odissey Backend - Cloudflare Worker with D1 Database
 *
 * This worker provides the backend API for the Odissey interactive storytelling app.
 * It handles anonymous authentication, session management, and AI-powered story interactions.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { ApiRouter } from './routes';
import { handleCorsPreflightRequest, corsHeaders } from './utils';
import { Env } from './routes';

// Global router cache to avoid recreating for every request
let cachedRouter: ApiRouter | null = null;
let cacheKey: string | null = null;

function getCachedRouter(env: Env): ApiRouter {
	// Create a cache key based on environment variables that matter
	const currentCacheKey = `${env.GEMINI_API_KEY || ''}_${env.HUGGINGFACE_API_KEY || ''}_${env.OPENAI_API_KEY || ''}`;
	
	// Return cached router if env hasn't changed
	if (cachedRouter && cacheKey === currentCacheKey) {
		return cachedRouter;
	}
	
	// Create new router and cache it
	console.log('Initializing ApiRouter (environment changed or first load)');
	cachedRouter = new ApiRouter(env);
	cacheKey = currentCacheKey;
	
	return cachedRouter;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight requests first
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400', // 24 hours
				},
			});
		}

		try {
			// Get cached router (only creates new one if needed)
			const router = getCachedRouter(env);
			
			// Route the request
			const response = await router.route(request, ctx);
			
			// Ensure all responses have CORS headers
			const headers = new Headers(response.headers);
			headers.set('Access-Control-Allow-Origin', '*');
			headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers,
			});
			
		} catch (error) {
			console.error('Worker error:', error);
			
			// Return a generic error response with CORS headers
			return new Response(
				JSON.stringify({
					error: 'Internal Server Error',
					message: 'An unexpected error occurred',
					status: 500
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					},
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;
