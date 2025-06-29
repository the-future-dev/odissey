import { 
  createJsonResponse, 
  createErrorResponse, 
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

  private async getWorlds(request: Request): Promise<Response> {
    try {
      const worlds = await this.db.getAllWorlds();
      return createJsonResponse(worlds);
    } catch (error) {
      console.error('Error fetching worlds:', error);
      return createErrorResponse('Failed to fetch worlds', 500);
    }
  }

  private async createWorld(request: Request): Promise<Response> {
    try {
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
      console.error('Error creating world:', error);
      return createErrorResponse('Failed to create world', 500);
    }
  }

  private async getWorld(request: Request, worldId: string): Promise<Response> {
    try {
      if (!isValidWorldId(worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const world = await this.db.getWorldById(worldId);
      if (!world) {
        return createErrorResponse('World not found', 404, 'Not Found');
      }

      return createJsonResponse(world);
    } catch (error) {
      console.error('Error fetching world:', error);
      return createErrorResponse('Failed to fetch world', 500);
    }
  }
} 