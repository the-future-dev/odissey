import { createErrorResponse } from './utils/response';
import { logRequest } from './utils/requestLogger';
import { Logger } from './utils/logger';

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
import { GoogleAuthRouter } from './routes/googleAuth';
import { StoryInteractionRouter } from './routes/storyInteraction';
import { WorldsRouter } from './routes/worlds';
import { ProfileRouter } from './routes/profile';
import { HealthRouter } from './routes/health';

export class ApiRouter {
  private googleAuthRouter: GoogleAuthRouter;
  private storyInteractionRouter: StoryInteractionRouter;
  private worldsRouter: WorldsRouter;
  private profileRouter: ProfileRouter;
  private healthRouter: HealthRouter;

  constructor(env: Env) {
    this.googleAuthRouter = new GoogleAuthRouter(env);
    this.storyInteractionRouter = new StoryInteractionRouter(env);
    this.worldsRouter = new WorldsRouter(env);
    this.profileRouter = new ProfileRouter(env);
    this.healthRouter = new HealthRouter();
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response> {
    logRequest(request);

    try {
      // Try each router in order
      const routers = [
        this.googleAuthRouter,
        this.storyInteractionRouter,
        this.worldsRouter,
        this.profileRouter,
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