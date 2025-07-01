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

    // Authentication routes
    if (pathname === '/auth/anonymous' && method === 'POST') {
      return await this.createAnonymousToken(request);
    }
    
    if (pathname === '/auth/validate' && method === 'GET') {
      return await this.validateToken(request);
    }

    return null; // Route not handled by this router
  }

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

      const isValid = await this.db.validateUserToken(token);

      if (!isValid) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      return createJsonResponse({ valid: true });
    } catch (error) {
      console.error('Error validating token:', error);
      return createErrorResponse('Token validation failed', 500);
    }
  }
} 