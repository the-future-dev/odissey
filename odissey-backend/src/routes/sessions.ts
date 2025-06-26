import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken, 
  parseJsonBody, 
  validateRequiredFields,
  generateSessionId,
  isValidWorldId,
  logRequest
} from '../utils';
import { DatabaseService } from '../database/database';
import { CreateSessionResponse } from './api-types';
import { Env } from '../routes';

export class SessionsRouter {
  private db: DatabaseService;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
  }

  async route(request: Request): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Session routes
    if ((pathname === '/sessions/new-anonymous' || pathname === '/sessions/new') && method === 'POST') {
      return await this.createSession(request);
    }

    return null; // Route not handled by this router
  }

  /**
   * Unified session creation logic for both anonymous and personalized sessions
   */
  private async createSession(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing authorization header', 401, 'Unauthorized');
      }

      const user = await this.db.getUserByToken(token);
      if (!user) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      const body = await parseJsonBody<CreateSessionResponse>(request);

      const validationError = validateRequiredFields(body, ['worldId']);
      if (validationError) {
        return createErrorResponse(validationError, 400);
      }

      if (!isValidWorldId(body.worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const world = await this.db.getWorldById(body.worldId);
      if (!world) {
        return createErrorResponse('World not found', 404, 'Not Found');
      }

      const sessionId = generateSessionId();

      const session = await this.db.createSession(sessionId, user.id, world.id);

      const response: CreateSessionResponse = {
        sessionId: session.id,
        worldId: session.world_id,
        createdAt: session.created_at
      };

      return createJsonResponse(response, 201);
    } catch (error) {
      console.error('Error creating session:', error);
      return createErrorResponse('Failed to create session', 500);
    }
  }
} 