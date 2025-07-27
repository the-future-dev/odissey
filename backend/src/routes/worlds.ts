import { createJsonResponse, createErrorResponse } from '../utils/response';
import { isValidWorldId, validateWorldCreationRequest } from '../utils/validation';
import { logRequest } from '../utils/requestLogger';
import { handleAuthError, handleServerError, handleNotFoundError, isAuthError } from '../utils/errorHandling';
import { OAuthService, WorldDbService, UserDbService } from '../database';
import { Env } from '../routes';
import { AuthService } from '../utils/authService';

export class WorldsRouter {
  private worldDB: WorldDbService;
  private authService: AuthService;

  constructor(env: Env) {
    this.worldDB = new WorldDbService(env.DB);
    const oAuth = new OAuthService(env.DB);
    const userDB = new UserDbService(env.DB);
    this.authService = new AuthService(oAuth, userDB);
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

  private async getWorlds(request: Request): Promise<Response> {
    try {
      // Authenticate user
      await this.authService.authenticateUser(request);

      const worlds = await this.worldDB.getAllWorlds();
      return createJsonResponse(worlds);
    } catch (error) {
      if (error instanceof Error && isAuthError(error)) {
        return handleAuthError(error, { component: 'WorldsRouter', operation: 'GET_WORLDS' });
      }
      
      return handleServerError(error, 'fetch worlds', { component: 'WorldsRouter', operation: 'GET_WORLDS' });
    }
  }

  private async createWorld(request: Request): Promise<Response> {
    try {
      // Authenticate user
      const user = await this.authService.authenticateUser(request);

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
      if (error instanceof Error && isAuthError(error)) {
        return handleAuthError(error, { component: 'WorldsRouter', operation: 'CREATE_WORLD' });
      }
      
      return handleServerError(error, 'create world', { component: 'WorldsRouter', operation: 'CREATE_WORLD' });
    }
  }

  private async getWorld(request: Request, worldId: string): Promise<Response> {
    try {
      // Authenticate user
      await this.authService.authenticateUser(request);

      if (!isValidWorldId(worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const world = await this.worldDB.getWorldById(worldId);
      if (!world) {
        return handleNotFoundError('World', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
      }

      return createJsonResponse(world);
    } catch (error) {
      if (error instanceof Error && isAuthError(error)) {
        return handleAuthError(error, { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
      }
      
      return handleServerError(error, 'fetch world', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
    }
  }
} 