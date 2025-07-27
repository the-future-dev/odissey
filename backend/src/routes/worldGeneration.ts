import { createJsonResponse, createErrorResponse } from '../utils/response';
import { logRequest } from '../utils/requestLogger';
import { handleServerError } from '../utils/errorHandling';
import { AuthService } from '../utils/authService';
import { User } from '../database/db-types';

export class WorldGenerationRouter {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // World generation routes
    if (pathname === '/world-generation/interact' && method === 'POST') {
      return await this.interact(request, user, ctx);
    }

    return null; // Route not handled by this router
  }

  private async interact(request: Request, user: User, ctx?: ExecutionContext): Promise<Response> {
    try {
      // Get the audio data from the request
      const audioData = await request.arrayBuffer();
      
      if (!audioData || audioData.byteLength === 0) {
        return createErrorResponse('No audio data provided', 400);
      }

      // For now, just return the same audio data back to the user
      // In the future, this is where we'll process the audio with AI
      const response = new Response(audioData, {
        headers: {
          'Content-Type': 'audio/wav', // or appropriate audio mime type
          'Content-Length': audioData.byteLength.toString(),
        },
      });

      return response;
    } catch (error) {
      return handleServerError(error, 'process audio interaction', { 
        component: 'WorldGenerationRouter', 
        operation: 'INTERACT',
        userId: user.id 
      });
    }
  }
} 