import {
    createErrorResponse,
    extractBearerToken,
    parseJsonBody,
    validateRequiredFields,
    sanitizeInput,
    isValidSessionId,
    logRequest,
    corsHeaders,
    Logger,
    createTimer,
    getElapsed
} from "../utils";

import { AIServiceManager, HuggingFaceProvider, GeminiProvider } from '../ai';
import { DatabaseService } from '../database/database';
import { StoryService } from '../story/storyService';

import { Env } from "../routes";
import { InteractWithStoryRequest } from "./api-types";
export class GenerationRouter {
  private db: DatabaseService;
  private aiService: AIServiceManager;
  private storyService: StoryService;

  constructor(env: Env) {
    const timer = createTimer();
    const context = {
      component: 'GenerationRouter',
      operation: 'INIT'
    };

    Logger.info('Initializing GenerationRouter', context);

    this.db = new DatabaseService(env.DB);
    
    // Initialize AI service
    this.aiService = new AIServiceManager();
    
    // Use Gemini as the primary provider, fallback to HuggingFace
    if (env.GEMINI_API_KEY) {
      const geminiProvider = new GeminiProvider({
        apiKey: env.GEMINI_API_KEY
      });
      this.aiService.setProvider(geminiProvider);
      Logger.info('AI provider configured', {
        ...context,
        metadata: { provider: 'Gemini' }
      });
    } else if (env.HUGGINGFACE_API_KEY && env.HUGGINGFACE_API_KEY.startsWith('hf_')) {
      const huggingFaceProvider = new HuggingFaceProvider({
        apiKey: env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mistral-7B-Instruct-v0.3'
      });
      this.aiService.setProvider(huggingFaceProvider);
      Logger.info('AI provider configured', {
        ...context,
        metadata: { provider: 'HuggingFace', model: 'mistralai/Mistral-7B-Instruct-v0.3' }
      });
    } else {
      Logger.warn('No AI provider configured - service will not work properly', {
        ...context,
        metadata: { 
          geminiKeyExists: !!env.GEMINI_API_KEY,
          huggingfaceKeyExists: !!env.HUGGINGFACE_API_KEY,
          huggingfaceKeyValid: env.HUGGINGFACE_API_KEY?.startsWith('hf_') || false
        }
      });
    }
    
    this.storyService = new StoryService(this.db, this.aiService);

    Logger.info('GenerationRouter initialized successfully', {
      ...context,
      duration: getElapsed(timer)
    });
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    const timer = createTimer();
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    const context = {
      component: 'GenerationRouter',
      operation: 'ROUTE',
      metadata: { method, pathname }
    };

    Logger.debug('Processing route request', context);
    logRequest(request);

    // Session interaction route
    const sessionMatch = pathname.match(/^\/sessions\/([^\/]+)\/interact$/);
    if (sessionMatch && method === 'POST') {
        const sessionId = sessionMatch[1];
        Logger.info('Routing to story interaction', {
          ...context,
          sessionId,
          operation: 'ROUTE_TO_INTERACT',
          duration: getElapsed(timer)
        });
        return await this.interactWithStory(request, sessionId, ctx);
    }

    Logger.debug('Route not handled by GenerationRouter', {
      ...context,
      duration: getElapsed(timer)
    });
    return null; // Route not handled by this router
  }

  // Interaction with JSON response
  private async interactWithStory(request: Request, sessionId: string, ctx?: ExecutionContext): Promise<Response> {
    const timer = createTimer();
    const context = {
      component: 'GenerationRouter',
      operation: 'INTERACT_WITH_STORY',
      sessionId
    };

    Logger.info('Starting story interaction', context);

    try {
      if (!isValidSessionId(sessionId)) {
        Logger.warn('Invalid session ID format provided', {
          ...context,
          metadata: { sessionIdLength: sessionId?.length || 0 }
        });
        return createErrorResponse('Invalid session ID format', 400);
      }

      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        Logger.warn('Missing authorization header', context);
        return createErrorResponse('Missing authorization header', 401, 'Unauthorized');
      }

      Logger.debug('Authenticating user', context);
      
      // Get Google OAuth session
      const oauthSession = await this.db.getOAuthSessionByToken(token);
      if (!oauthSession) {
        Logger.warn('Invalid or expired token provided', {
          ...context,
          metadata: { tokenLength: token?.length || 0 }
        });
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      // Check if token is expired
      if (new Date(oauthSession.expires_at) <= new Date()) {
        await this.db.deleteOAuthSession(oauthSession.id);
        Logger.warn('Token expired', {
          ...context,
          metadata: { tokenLength: token?.length || 0 }
        });
        return createErrorResponse('Token expired', 401, 'Unauthorized');
      }

      const user = await this.db.getUserById(oauthSession.user_id);
      if (!user) {
        Logger.warn('User not found for OAuth session', {
          ...context,
          metadata: { oauthSessionId: oauthSession.id }
        });
        return createErrorResponse('User not found', 401, 'Unauthorized');
      }

      Logger.debug('User authenticated successfully', {
        ...context,
        userId: user.id,
        metadata: { userEmail: user.email, userName: user.name }
      });

      const body = await parseJsonBody<InteractWithStoryRequest>(request);

      const validationError = validateRequiredFields(body, ['message']);
      if (validationError) {
        Logger.warn('Request validation failed', {
          ...context,
          userId: user.id,
          metadata: { validationError }
        });
        return createErrorResponse(validationError, 400);
      }

      const userMessage = sanitizeInput(body.message);
      if (!userMessage) {
        Logger.warn('Empty message after sanitization', {
          ...context,
          userId: user.id,
          metadata: { originalLength: body.message?.length || 0 }
        });
        return createErrorResponse('Message cannot be empty', 400);
      }

      Logger.info('Processing user message', {
        ...context,
        userId: user.id,
        metadata: { messageLength: userMessage.length }
      });

      const session = await this.db.getSessionWithUser(sessionId, user.id);
      if (!session) {
        Logger.warn('Session not found or access denied', {
          ...context,
          userId: user.id
        });
        return createErrorResponse('Session not found or access denied', 404, 'Not Found');
      }

      const world = await this.db.getWorldById(session.world_id);
      if (!world) {
        Logger.error('World not found for session', new Error('World not found'), {
          ...context,
          userId: user.id,
          metadata: { worldId: session.world_id }
        });
        return createErrorResponse('World not found', 404, 'Not Found');
      }

      Logger.info('Session and world validated', {
        ...context,
        userId: user.id,
        metadata: { 
          worldId: world.id,
          worldTitle: world.title,
          sessionCreatedAt: session.created_at
        }
      });

      Logger.info('Generating AI response', {
        ...context,
        userId: user.id,
        metadata: { 
          worldId: world.id
        }
      });

      // Generate AI response (handles message saving internally)
      // Pass ExecutionContext to enable background operations
      const narratorResponse = await this.storyService.processUserInput(sessionId, userMessage, user, ctx);

      Logger.info('Story interaction completed successfully', {
        ...context,
        userId: user.id,
        duration: getElapsed(timer),
        metadata: { 
          messageLength: userMessage.length,
          responseLength: narratorResponse.length
        }
      });

      return new Response(JSON.stringify({ 
        response: narratorResponse 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error) {
      Logger.error('Story interaction failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      return createErrorResponse('Failed to process story interaction', 500);
    }
  }
}
