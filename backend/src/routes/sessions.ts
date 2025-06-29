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
import { AIServiceManager, GeminiProvider, HuggingFaceProvider } from '../ai';
import { StoryManager } from '../story/storyManager';

export class SessionsRouter {
  private db: DatabaseService;
  private storyManager: StoryManager;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
    
    // Initialize AI service (same pattern as GenerationRouter)
    const aiService = new AIServiceManager();
    
    if (env.GEMINI_API_KEY) {
      const geminiProvider = new GeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash'
      });
      aiService.setProvider(geminiProvider);
    } else if (env.HUGGINGFACE_API_KEY && env.HUGGINGFACE_API_KEY.startsWith('hf_')) {
      const huggingFaceProvider = new HuggingFaceProvider({
        apiKey: env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mistral-7B-Instruct-v0.3'
      });
      aiService.setProvider(huggingFaceProvider);
    }
    
    this.storyManager = new StoryManager(aiService, this.db);
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

    // Get session messages
    const messagesMatch = pathname.match(/^\/sessions\/([^\/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      const sessionId = messagesMatch[1];
      return await this.getSessionMessages(request, sessionId);
    }

    return null; // Route not handled by this router
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

      // Initialize the session with story chapters
      try {
        const welcomeMessage = await this.storyManager.initializeSession(sessionId, world, ctx);
        
        // Save the initial narrator message
        await this.db.createMessage(sessionId, 'narrator', welcomeMessage);
      } catch (error) {
        console.error('Failed to initialize story session:', error);
        // Continue with session creation even if story initialization fails
      }

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

  /**
   * Get session messages
   */
  private async getSessionMessages(request: Request, sessionId: string): Promise<Response> {
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

      // Verify user has access to this session
      const session = await this.db.getSessionWithUser(sessionId, user.id);
      if (!session) {
        return createErrorResponse('Session not found or access denied', 404, 'Not Found');
      }

      // Get session messages
      const messages = await this.db.getSessionMessages(sessionId, 50);

      return createJsonResponse({ messages });
    } catch (error) {
      console.error('Error fetching session messages:', error);
      return createErrorResponse('Failed to fetch session messages', 500);
    }
  }
} 