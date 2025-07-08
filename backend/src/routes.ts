import { createErrorResponse, logRequest, Logger } from './utils';

// === ENVIRONMENT BINDINGS ===
export interface Env {
  DB: D1Database;
  HUGGINGFACE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  // Google OAuth configuration
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Logging configuration
  LOG_LEVEL?: string;
  LOG_SAMPLING_RATE?: string;
  LOG_REQUEST_DETAILS?: string;
}

// Import all route modules
import { AuthRouter } from './routes/auth';
import { GoogleAuthRouter } from './routes/googleAuth';
import { SessionsRouter } from './routes/sessions';
import { GenerationRouter } from './routes/generation';
import { WorldsRouter } from './routes/worlds';
import { HealthRouter } from './routes/health';

export class ApiRouter {
  private authRouter: AuthRouter;
  private googleAuthRouter: GoogleAuthRouter;
  private sessionsRouter: SessionsRouter;
  private generationRouter: GenerationRouter;
  private worldsRouter: WorldsRouter;
  private healthRouter: HealthRouter;

  constructor(env: Env) {
    this.authRouter = new AuthRouter(env);
    this.googleAuthRouter = new GoogleAuthRouter(env);
    this.sessionsRouter = new SessionsRouter(env);
    this.generationRouter = new GenerationRouter(env);
    this.worldsRouter = new WorldsRouter(env);
    this.healthRouter = new HealthRouter();
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response> {
    logRequest(request);

    try {
      // Try each router in order
      const routers = [
        this.authRouter,
        this.googleAuthRouter,
        this.sessionsRouter,
        this.generationRouter,
        this.worldsRouter,
        this.healthRouter,
      ];

      for (const router of routers) {
        const response = await router.route(request, ctx);
        if (response) {
          return response;
        }
      }

      // If no router handled the request
      return createErrorResponse('Route not found', 404, 'Not Found');

    } catch (error) {
      Logger.error('Route handler error', error, {
        component: 'ApiRouter',
        operation: 'ROUTE'
      });
      return createErrorResponse('Internal server error', 500, 'Internal Server Error');
    }
  }
} 