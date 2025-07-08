import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken,
  isValidWorldId,
  logRequest
} from '../utils';
import { DatabaseService } from '../database/database';
import { Env } from '../routes';

export class WorldsRouter {
  private db: DatabaseService;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Worlds routes
    if (pathname === '/worlds' && method === 'GET') {
      return await this.getWorlds(request);
    }

    if (pathname === '/worlds' && method === 'POST') {
      return await this.createWorld(request);
    }

    const worldMatch = pathname.match(/^\/worlds\/([^\/]+)$/);
    if (worldMatch && method === 'GET') {
      const worldId = worldMatch[1];
      return await this.getWorld(request, worldId);
    }

    return null; // Route not handled by this router
  }

  /**
   * Authenticate user with Google OAuth token
   * Returns user object if authenticated, throws error if not
   */
  private async authenticateUser(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      throw new Error('Missing authorization header');
    }

    // Get Google OAuth session
    const oauthSession = await this.db.getOAuthSessionByToken(token);
    if (!oauthSession) {
      throw new Error('Invalid or expired token');
    }

    // Check if token is expired
    if (new Date(oauthSession.expires_at) <= new Date()) {
      await this.db.deleteOAuthSession(oauthSession.id);
      throw new Error('Token expired');
    }

    const user = await this.db.getUserById(oauthSession.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private async getWorlds(request: Request): Promise<Response> {
    try {
      // Authenticate user
      await this.authenticateUser(request);

      const worlds = await this.db.getAllWorlds();
      return createJsonResponse(worlds);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Missing authorization') ||
        error.message.includes('Invalid or expired token') ||
        error.message.includes('Token expired') ||
        error.message.includes('User not found')
      )) {
        return createErrorResponse(error.message, 401, 'Unauthorized');
      }
      
      console.error('Error fetching worlds:', error);
      return createErrorResponse('Failed to fetch worlds', 500);
    }
  }

  private async createWorld(request: Request): Promise<Response> {
    try {
      // Authenticate user
      const user = await this.authenticateUser(request);

      const body = await request.json() as { title?: unknown; description?: unknown };
      const { title, description } = body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return createErrorResponse('Title is required and must be a non-empty string', 400);
      }

      if (description && typeof description !== 'string') {
        return createErrorResponse('Description must be a string', 400);
      }

      // Generate a unique ID based on the title
      const id = title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50) + '-' + Date.now();

      const world = await this.db.createWorld(id, title.trim(), description && typeof description === 'string' ? description.trim() : undefined);
      return createJsonResponse(world);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Missing authorization') ||
        error.message.includes('Invalid or expired token') ||
        error.message.includes('Token expired') ||
        error.message.includes('User not found')
      )) {
        return createErrorResponse(error.message, 401, 'Unauthorized');
      }
      
      console.error('Error creating world:', error);
      return createErrorResponse('Failed to create world', 500);
    }
  }

  private async getWorld(request: Request, worldId: string): Promise<Response> {
    try {
      // Authenticate user
      await this.authenticateUser(request);

      if (!isValidWorldId(worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const world = await this.db.getWorldById(worldId);
      if (!world) {
        return createErrorResponse('World not found', 404, 'Not Found');
      }

      return createJsonResponse(world);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Missing authorization') ||
        error.message.includes('Invalid or expired token') ||
        error.message.includes('Token expired') ||
        error.message.includes('User not found')
      )) {
        return createErrorResponse(error.message, 401, 'Unauthorized');
      }
      
      console.error('Error fetching world:', error);
      return createErrorResponse('Failed to fetch world', 500);
    }
  }
} 