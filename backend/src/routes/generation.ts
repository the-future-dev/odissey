import {
    createErrorResponse,
    extractBearerToken,
    parseJsonBody,
    validateRequiredFields,
    sanitizeInput,
    isValidSessionId,
    logRequest,
    corsHeaders
} from "../utils";

import { AIServiceManager, HuggingFaceProvider, GeminiProvider } from '../ai';
import { DatabaseService } from '../database/database';
import { StoryService } from '../story/storyService';

import { Env } from "../routes";
import { Session, World } from "../database/db-types";
import { InteractWithStoryRequest } from "./api-types";

export class GenerationRouter {
  private db: DatabaseService;
  private aiService: AIServiceManager;
  private storyService: StoryService;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
    
    // Initialize AI service
    this.aiService = new AIServiceManager();
    
    // Use Gemini as the primary provider, fallback to HuggingFace
    if (env.GEMINI_API_KEY) {
      const geminiProvider = new GeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash'
      });
      this.aiService.setProvider(geminiProvider);
      console.log('AI provider: Gemini');
    } else if (env.HUGGINGFACE_API_KEY && env.HUGGINGFACE_API_KEY.startsWith('hf_')) {
      const huggingFaceProvider = new HuggingFaceProvider({
        apiKey: env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mistral-7B-Instruct-v0.3'
      });
      this.aiService.setProvider(huggingFaceProvider);
      console.log('AI provider: HuggingFace');
    } else {
      console.warn('No AI provider configured - service will not work properly');
    }
    
    this.storyService = new StoryService(this.aiService, this.db);
  }

  async route(request: Request): Promise<Response | null> {
    logRequest(request);

    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Session interaction route
    const sessionMatch = pathname.match(/^\/sessions\/([^\/]+)\/interact$/);
    if (sessionMatch && method === 'POST') {
        const sessionId = sessionMatch[1];
        return await this.interactWithStory(request, sessionId);
    }

    return null; // Route not handled by this router
  }

  // Interaction with JSON response
  private async interactWithStory(request: Request, sessionId: string): Promise<Response> {
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

      // Generate AI response
      const narratorResponse = await this.storyService.generateResponse(
        userMessage,
        session,
        world,
        recentMessages
      );

      // Save narrator response
      await this.db.createMessage(sessionId, 'narrator', narratorResponse);

      return new Response(JSON.stringify({ 
        response: narratorResponse 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('Error in story interaction:', error);
      return createErrorResponse('Failed to process story interaction', 500);
    }
  }
}
