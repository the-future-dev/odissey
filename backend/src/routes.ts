import { createErrorResponse, logRequest } from './utils';

// === ENVIRONMENT BINDINGS ===
export interface Env {
  DB: D1Database;
  HUGGINGFACE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

// Import all route modules
import { AuthRouter } from './routes/auth';
import { SessionsRouter } from './routes/sessions';
import { GenerationRouter } from './routes/generation';
import { WorldsRouter } from './routes/worlds';
import { HealthRouter } from './routes/health';

export class ApiRouter {
  private authRouter: AuthRouter;
  private sessionsRouter: SessionsRouter;
  private generationRouter: GenerationRouter;
  private worldsRouter: WorldsRouter;
  private healthRouter: HealthRouter;

  constructor(env: Env) {
    this.authRouter = new AuthRouter(env);
    this.sessionsRouter = new SessionsRouter(env);
    this.generationRouter = new GenerationRouter(env);
    this.worldsRouter = new WorldsRouter(env);
    this.healthRouter = new HealthRouter();
  }

  async route(request: Request): Promise<Response> {
    logRequest(request);

    try {
      // Try each router in order
      const routers = [
        this.authRouter,
        this.sessionsRouter,
        this.generationRouter,
        this.worldsRouter,
        this.healthRouter,
      ];

      for (const router of routers) {
        const response = await router.route(request);
        if (response) {
          return response;
        }
      }

      // If no router handled the request
      return createErrorResponse('Route not found', 404, 'Not Found');

    } catch (error) {
      console.error('Route handler error:', error);
      return createErrorResponse('Internal server error', 500, 'Internal Server Error');
    }
  }
} 