import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken, 
  parseJsonBody, 
  validateRequiredFields,
  generateToken,
  generateSessionId,
  calculateTokenExpiration,
  sanitizeInput,
  isValidWorldId,
  isValidSessionId,
  logRequest,
  corsHeaders
} from './utils';
import { DatabaseService } from './database';
import { StoryService } from './storyService';
import { AIServiceManager, HuggingFaceProvider, LocalFallbackProvider, GeminiProvider, AIModality } from './ai';
import { 
  CreateAnonymousTokenResponse,
  CreatePersonalizedSessionRequest,
  CreatePersonalizedSessionResponse,
  InteractWithStoryRequest,
  Env,
  Session,
  World,
  Message
} from './types';

export class ApiRouter {
  private db: DatabaseService;
  private storyService: StoryService;
  private aiService: AIServiceManager;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
    
    // Initialize AI service
    this.aiService = new AIServiceManager();
    
    const registeredProviders: string[] = [];
    
    // Register AI providers in priority order
    if (env.GEMINI_API_KEY) {
      const geminiProvider = new GeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash'
      });
      this.aiService.registerProvider(geminiProvider);
      registeredProviders.push('Gemini (primary)');
    }
    
    if (env.HUGGINGFACE_API_KEY && env.HUGGINGFACE_API_KEY.startsWith('hf_')) {
      const huggingFaceProvider = new HuggingFaceProvider({
        apiKey: env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mistral-7B-Instruct-v0.3'
      });
      this.aiService.registerProvider(huggingFaceProvider);
      registeredProviders.push('HuggingFace (secondary)');
    }
    
    // Local fallback always available
    const fallbackProvider = new LocalFallbackProvider();
    this.aiService.registerProvider(fallbackProvider);
    registeredProviders.push('LocalFallback (backup)');
    
    console.log(`AI providers registered: ${registeredProviders.join(', ')}`);
    
    this.storyService = new StoryService(this.aiService, this.db);
  }

  async route(request: Request): Promise<Response> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    try {
      // Authentication routes
      if (pathname === '/auth/anonymous' && method === 'POST') {
        return await this.createAnonymousToken(request);
      }
      
      if (pathname === '/auth/validate' && method === 'GET') {
        return await this.validateToken(request);
      }

      // Session routes
      if (pathname === '/sessions/new-anonymous' && method === 'POST') {
        return await this.createAnonymousSession(request);
      }
      
      if (pathname === '/sessions/new' && method === 'POST') {
        return await this.createPersonalizedSession(request);
      }

      // Streaming session interaction routes
      const sessionStreamMatch = pathname.match(/^\/sessions\/([^\/]+)\/interact-stream$/);
      if (sessionStreamMatch && method === 'POST') {
        const sessionId = sessionStreamMatch[1];
        return await this.interactWithStoryStream(request, sessionId);
      }

      // Worlds routes
      if (pathname === '/worlds' && method === 'GET') {
        return await this.getWorlds(request);
      }

      const worldMatch = pathname.match(/^\/worlds\/([^\/]+)$/);
      if (worldMatch && method === 'GET') {
        const worldId = worldMatch[1];
        return await this.getWorld(request, worldId);
      }

      // Health check
      if (pathname === '/health' && method === 'GET') {
        return createJsonResponse({ status: 'healthy', timestamp: new Date().toISOString() });
      }

      // AI service status check
      if (pathname === '/ai/status' && method === 'GET') {
        return await this.getAIStatus(request);
      }

      return createErrorResponse('Route not found', 404, 'Not Found');

    } catch (error) {
      console.error('Route handler error:', error);
      return createErrorResponse('Internal server error', 500, 'Internal Server Error');
    }
  }

  // Authentication endpoints (unchanged)
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

  // Session endpoints (simplified)
  private async createAnonymousSession(request: Request): Promise<Response> {
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

      const body = await parseJsonBody<CreatePersonalizedSessionRequest>(request);

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
      const worldState = world.initial_state || 'Your adventure begins...';

      const session = await this.db.createSession(sessionId, user.id, world.id, worldState);

      const response: CreatePersonalizedSessionResponse = {
        sessionId: session.id,
        worldId: session.world_id,
        worldState: session.world_state || worldState,
        createdAt: session.created_at
      };

      return createJsonResponse(response, 201);
    } catch (error) {
      console.error('Error creating anonymous session:', error);
      return createErrorResponse('Failed to create session', 500);
    }
  }

  private async createPersonalizedSession(request: Request): Promise<Response> {
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

      const body = await parseJsonBody<CreatePersonalizedSessionRequest>(request);

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
      const worldState = world.initial_state || 'Your adventure begins...';

      const session = await this.db.createSession(sessionId, user.id, world.id, worldState);

      const response: CreatePersonalizedSessionResponse = {
        sessionId: session.id,
        worldId: session.world_id,
        worldState: session.world_state || worldState,
        createdAt: session.created_at
      };

      return createJsonResponse(response, 201);
    } catch (error) {
      console.error('Error creating personalized session:', error);
      return createErrorResponse('Failed to create session', 500);
    }
  }

  // Streaming interaction
  private async interactWithStoryStream(request: Request, sessionId: string): Promise<Response> {
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

      const body = await parseJsonBody<InteractWithStoryRequest>(request);

      const validationError = validateRequiredFields(body, ['message']);
      if (validationError) {
        return createErrorResponse(validationError, 400);
      }

      const userMessage = sanitizeInput(body.message);
      if (!userMessage) {
        return createErrorResponse('Message cannot be empty', 400);
      }

      const session = await this.db.getSessionWithUser(sessionId, user.id);
      if (!session) {
        return createErrorResponse('Session not found or access denied', 404, 'Not Found');
      }

      const world = await this.db.getWorldById(session.world_id);
      if (!world) {
        return createErrorResponse('World not found', 404, 'Not Found');
      }

      // Save user message
      await this.db.createMessage(sessionId, 'user', userMessage);

      // Get recent conversation context
      const recentMessages = await this.db.getRecentSessionMessages(sessionId, 10);

      // Create streaming response
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Start streaming response generation
      this.handleStreamingGeneration(
        writer, 
        encoder, 
        userMessage, 
        session, 
        world, 
        recentMessages, 
        sessionId
      );

      return new Response(readable, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('Error in streaming story interaction:', error);
      return createErrorResponse('Failed to process streaming story interaction', 500);
    }
  }

  private async handleStreamingGeneration(
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder,
    userMessage: string,
    session: Session,
    world: World,
    recentMessages: Message[],
    sessionId: string
  ): Promise<void> {
    try {
      let fullResponse = '';
      
      // Generate streaming AI response
      const narratorResponse = await this.storyService.generateStreamingResponse(
        userMessage,
        session,
        world,
        recentMessages,
        (chunk: string) => {
          fullResponse += chunk;
          const data = JSON.stringify({ type: 'chunk', content: chunk }) + '\n';
          writer.write(encoder.encode(data)).catch(console.error);
        }
      );

      // Send completion signal
      const completeData = JSON.stringify({ type: 'complete', content: narratorResponse }) + '\n';
      await writer.write(encoder.encode(completeData));

      // Save narrator response
      await this.db.createMessage(sessionId, 'narrator', narratorResponse);

      // Simple world state update in background
      setTimeout(async () => {
        try {
          const updatedWorldState = await this.storyService.updateWorldState(
            session.world_state || world.initial_state || '',
            userMessage,
            narratorResponse
          );
          await this.db.updateSessionState(sessionId, updatedWorldState);
        } catch (error) {
          console.warn('Background world state update failed:', error);
        }
      }, 0);

    } catch (error) {
      console.error('Error in streaming response:', error);
      const errorData = JSON.stringify({ 
        type: 'error', 
        content: 'Failed to generate response' 
      }) + '\n';
      await writer.write(encoder.encode(errorData));
    } finally {
      await writer.close();
    }
  }

  // World endpoints (unchanged)
  private async getWorlds(request: Request): Promise<Response> {
    try {
      const worlds = await this.db.getAllWorlds();
      return createJsonResponse(worlds);
    } catch (error) {
      console.error('Error fetching worlds:', error);
      return createErrorResponse('Failed to fetch worlds', 500);
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

  private async getAIStatus(request: Request): Promise<Response> {
    try {
      const providers = this.aiService.listProviders();
      const hasTextToText = this.aiService.hasModalitySupport(AIModality.TextToText);
      
      return createJsonResponse({
        status: hasTextToText ? 'ok' : 'degraded',
        providers: providers,
        modalities: {
          textToText: hasTextToText,
          textToAudio: this.aiService.hasModalitySupport(AIModality.TextToAudio),
          audioToText: this.aiService.hasModalitySupport(AIModality.AudioToText)
        },
        simplified: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking AI status:', error);
      return createErrorResponse('Failed to check AI status', 500);
    }
  }
} 