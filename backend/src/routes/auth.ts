import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken, 
  generateToken,
  calculateTokenExpiration,
  logRequest
} from '../utils';
import { DatabaseService } from '../database/database';
import { CreateAnonymousTokenResponse } from './api-types';
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

  // === DEPRECATED METHODS - No longer used ===
  // These methods are kept for reference but should not be used
  
  /*
  private async createAnonymousToken(request: Request): Promise<Response> {
    try {
      const token = generateToken();
      const expiresAt = calculateTokenExpiration(30);

      const user = await this.db.createAnonymousUser(token, expiresAt);

      const response: CreateAnonymousTokenResponse = {
        token: user.token,
        expiresAt: user.expires_at
      };

      return createJsonResponse(response, 201);
    } catch (error) {
      console.error('Error creating anonymous token:', error);
      return createErrorResponse('Failed to create authentication token', 500);
    }
  }

  private async validateToken(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing or invalid authorization header', 401, 'Unauthorized');
      }

      const user = await this.db.getUserByToken(token);

      if (!user) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      return createJsonResponse({ valid: true });
    } catch (error) {
      console.error('Error validating token:', error);
      return createErrorResponse('Token validation failed', 500);
    }
  }
  */
} 