import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken, 
  parseJsonBody, 
  validateRequiredFields,
  generateSessionId,
  isValidWorldId,
  isValidSessionId,
  logRequest
} from '../utils';
import { DatabaseService } from '../database/database';
import { CreateSessionResponse, GetChaptersResponse } from './api-types';
import { Env } from '../routes';
import { StoryService } from '../story/storyService';
import { AIServiceManager, GeminiProvider, HuggingFaceProvider } from '../ai';
import { Session, World } from '../database/db-types';
import { ChapterManager } from '../story/chapterManager';

export class SessionsRouter {
  private db: DatabaseService;
  private storyService: StoryService;
  private chapterManager: ChapterManager;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
    this.chapterManager = new ChapterManager(this.db);
    
    // Initialize AI service
    const aiService = new AIServiceManager();
    
    // Use Gemini as the primary provider, fallback to HuggingFace
    if (env.GEMINI_API_KEY) {
      const geminiProvider = new GeminiProvider({
        apiKey: env.GEMINI_API_KEY
      });
      aiService.setProvider(geminiProvider);
    } else if (env.HUGGINGFACE_API_KEY && env.HUGGINGFACE_API_KEY.startsWith('hf_')) {
      const huggingFaceProvider = new HuggingFaceProvider({
        apiKey: env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mistral-7B-Instruct-v0.3'
      });
      aiService.setProvider(huggingFaceProvider);
    }
    
    this.storyService = new StoryService(this.db, aiService);
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Session routes
    if ((pathname === '/sessions/new-anonymous' || pathname === '/sessions/new') && method === 'POST') {
      return await this.createSession(request, ctx);
    }

    // Chapters route
    const chaptersMatch = pathname.match(/^\/sessions\/([^\/]+)\/chapters$/);
    if (chaptersMatch && method === 'GET') {
      const sessionId = chaptersMatch[1];
      return await this.getChapters(request, sessionId);
    }

    return null; // Route not handled by this router
  }

  /**
   * Get chapters for a session
   */
  private async getChapters(request: Request, sessionId: string): Promise<Response> {
    try {
      if (!isValidSessionId(sessionId)) {
        return createErrorResponse('Invalid session ID format', 400);
      }

      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing authorization header', 401, 'Unauthorized');
      }

      const user = await this.db.getUserByToken(token);
      if (!user) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      // Verify user has access to this session
      const session = await this.db.getSessionWithUser(sessionId, user.id);
      if (!session) {
        return createErrorResponse('Session not found or access denied', 404, 'Not Found');
      }

      // Get all chapters for the session
      const chapters = await this.chapterManager.getAllChapters(sessionId);

      const response: GetChaptersResponse = {
        history: chapters.history,
        current: chapters.current,
        future: chapters.future
      };

      return createJsonResponse(response);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      return createErrorResponse('Failed to fetch chapters', 500);
    }
  }

  /**
   * Unified session creation logic for both anonymous and personalized sessions
   */
  private async createSession(request: Request, ctx?: ExecutionContext): Promise<Response> {
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

      // Initialize the story session with story model and chapters
      await this.storyService.initializeSession(session, world, ctx);

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