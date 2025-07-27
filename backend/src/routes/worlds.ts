import { createJsonResponse, createErrorResponse } from '../utils/response';
import { isValidWorldId, validateWorldCreationRequest } from '../utils/validation';
import { logRequest } from '../utils/requestLogger';
import { handleAuthError, handleServerError, handleNotFoundError, isAuthError } from '../utils/errorHandling';
import { OAuthService, WorldDbService, UserDbService } from '../database';
import { Env } from '../routes';
import { AuthService } from '../utils/authService';
import { User } from '../database/db-types';

export class WorldsRouter {
  private worldDB: WorldDbService;
  private authService: AuthService;

  constructor(env: Env, authService: AuthService, userDB: UserDbService) {
    this.worldDB = new WorldDbService(env.DB);
    this.authService = authService;
  }

  async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // Worlds routes
    if (pathname === '/worlds' && method === 'GET') {
      return await this.getWorlds(request, user);
    }

    if (pathname === '/worlds' && method === 'POST') {
      return await this.createWorld(request, user);
    }

    const worldMatch = pathname.match(/^\/worlds\/([^\/]+)$/);
    if (worldMatch && method === 'GET') {
      const worldId = worldMatch[1];
      return await this.getWorld(request, user, worldId);
    }

    return null; // Route not handled by this router
  }

  private async getWorlds(request: Request, user: User): Promise<Response> {
    try {
      const worlds = await this.worldDB.getAllWorlds();
      return createJsonResponse(worlds);
    } catch (error) {
      return handleServerError(error, 'fetch worlds', { component: 'WorldsRouter', operation: 'GET_WORLDS' });
    }
  }

  private async createWorld(request: Request, user: User): Promise<Response> {
    try {
      const body = await request.json() as { title?: unknown; description?: unknown };
      
      // Validate input using utils
      const validationResult = validateWorldCreationRequest(body);
      if (validationResult.error) {
        return createErrorResponse(validationResult.error, 400);
      }

      const { title, description } = validationResult.validatedData!;

      // Generate a unique ID based on the title
      const id = title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50) + '-' + Date.now();

      const world = await this.worldDB.createWorld(id, title, description);
      return createJsonResponse(world);
    } catch (error) {
      return handleServerError(error, 'create world', { component: 'WorldsRouter', operation: 'CREATE_WORLD' });
    }
  }

  private async getWorld(request: Request, user: User, worldId: string): Promise<Response> {
    try {
      if (!isValidWorldId(worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const world = await this.worldDB.getWorldById(worldId);
      if (!world) {
        return handleNotFoundError('World', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
      }

      return createJsonResponse(world);
    } catch (error) {
      return handleServerError(error, 'fetch world', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
    }
  }
} 