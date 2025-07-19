import { 
  createErrorResponse, 
  logRequest
} from '../utils';
import { DatabaseService } from '../database/database';
import { Env } from '../routes';

export class AuthRouter {
  private db: DatabaseService;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Legacy authentication routes - now disabled in favor of Google OAuth
    if (pathname === '/auth/anonymous' && method === 'POST') {
      return this.createDeprecatedRouteResponse('Anonymous authentication has been replaced with Google OAuth. Please use /auth/google to authenticate.');
    }
    
    if (pathname === '/auth/validate' && method === 'GET') {
      return this.createDeprecatedRouteResponse('Anonymous token validation has been replaced with Google OAuth. Please use /auth/validate-google to validate your authentication.');
    }

    return null; // Route not handled by this router
  }

  /**
   * Return a helpful error message for deprecated routes
   */
  private createDeprecatedRouteResponse(message: string): Response {
    return createErrorResponse(message, 410, 'Gone - Use Google OAuth');
  }


} 