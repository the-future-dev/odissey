import { createJsonResponse, createErrorResponse } from '../utils/response';
import { logRequest } from '../utils/requestLogger';
import { handleServerError } from '../utils/errorHandling';
import { AuthService } from '../utils/authService';
import { User } from '../database/db-types';
import { AIServiceManager, GeminiProvider, CloudflareAIProvider } from '../ai';;

import { AIModality, AIProviderType, TextToTextRequest } from '../ai/interfaces';
import { Env } from '../routes';

import { Logger } from '../utils/logger';

export class WorldGenerationRouter {
  private authService: AuthService;
  private aiService: AIServiceManager;

  constructor(authService: AuthService, env: Env) {
    this.authService = authService;
    this.aiService = new AIServiceManager();

    // Register providers
    if (env.GEMINI_API_KEY && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      this.aiService.registerProvider(
        new GeminiProvider({ apiKey: env.GEMINI_API_KEY })
      );
      this.aiService.registerProvider(
        new CloudflareAIProvider({
          apiToken: env.CLOUDFLARE_API_TOKEN,
          accountId: env.CLOUDFLARE_ACCOUNT_ID
        })
      );
    } else {
      throw new Error('AI provider not configured properly: maybe GEMINI, maybe cloudflare AI');
    }

    // Set default providers for each modality
    this.aiService.setDefaultProviderForModality(AIModality.TextToText, AIProviderType.Gemini);
    this.aiService.setDefaultProviderForModality(AIModality.SpeechToText, AIProviderType.Cloudflare);
    this.aiService.setDefaultProviderForModality(AIModality.TextToSpeech, AIProviderType.Cloudflare);
  }

  async route(request: Request, user: User, ctx: ExecutionContext, env: Env): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // World generation routes
    if (pathname === '/world-generation/interact' && method === 'POST') {
      return await this.interact(request, user, ctx, env);
    }

    return null; // Route not handled by this router
  }

  private async interact(request: Request, user: User, ctx: ExecutionContext, env: Env): Promise<Response> {
    try {
      const audioData = await request.arrayBuffer();
      
      if (!audioData || audioData.byteLength === 0) {
        return createErrorResponse('No audio data provided', 400);
      }

      Logger.info('Step 1: Speech to Text');
      // The parameter is now correctly just the ArrayBuffer
      const transcription = await this.aiService.transcribeAudio(audioData);
      if (!transcription || !transcription.text) {
        return createErrorResponse('Failed to transcribe audio', 500);
      }
      Logger.info('Step 1 [closed]: Text:' + transcription.text);

      Logger.info('Step 2: Text Generation');
      const textRequest: TextToTextRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful narrator. The user is speaking through Speech-to-Text and therefore might be inaccurate in phrasing.' },
          { role: 'user', content: transcription.text }
        ],
        temperature: 0.7,
        maxTokens: 500
      };

      const textResponse = await this.aiService.generateText(textRequest);
      if (!textResponse.content) {
        return createErrorResponse('Failed to generate text response', 500);
      }
      Logger.info('Step 1 [closed]: Text:' + textResponse.content);

      Logger.info('Step 3: Speech Synthesis');
      // The parameter is now correctly just the response string
      const audioBlob = await this.aiService.synthesizeSpeech(textResponse.content);
      Logger.info('Step 3 [closed]: Audio generated' + audioBlob.size + ' bytes');

      // Return the generated audio
      const response = new Response(audioBlob, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBlob.size.toString(),
        },
      });

      return response;
    } catch (error) {
      Logger.error('Error in audio interaction:', error);
      return handleServerError(error, 'process audio interaction', {  
        component: 'WorldGenerationRouter',  
        operation: 'INTERACT',
        userId: user.id  
      });
    }
  }
}