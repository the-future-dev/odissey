import { createJsonResponse, createErrorResponse, parseJsonBody } from '../utils/response';
import { validateProfileUpdateRequest } from '../utils/validation';
import { logRequest } from '../utils/requestLogger';
import { handleAuthError, handleServerError, isAuthError } from '../utils/errorHandling';
import { OAuthService, UserDbService } from '../database';
import { Env } from '../routes';
import { User } from '../database/db-types';
import { AuthService } from '../utils/authService';

export interface ProfileUpdateRequest {
  name?: string;
  language?: string;
}

export interface ProfileResponse {
  user: User;
  userWorlds: Array<{
    session_id: string;
    world_id: string;
    world_title: string;
    world_description: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

export class ProfileRouter {
  private userDB: UserDbService;
  private authService: AuthService;

  constructor(env: Env) {
    const oAuth = new OAuthService(env.DB);
    this.userDB = new UserDbService(env.DB);
    this.authService = new AuthService(oAuth, this.userDB);
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Profile routes
    if (pathname === '/profile' && method === 'GET') {
      return await this.getProfile(request);
    }

    if (pathname === '/profile' && method === 'PUT') {
      return await this.updateProfile(request);
    }

    return null; // Route not handled by this router
  }

  /**
   * Get user profile with their worlds
   */
  private async getProfile(request: Request): Promise<Response> {
    try {
      // Authenticate user
      const user = await this.authService.authenticateUser(request);

      // Get user's worlds/sessions
      const userWorlds = await this.userDB.getUserSessionsWithWorlds(user.id);

      const response: ProfileResponse = {
        user,
        userWorlds
      };

      return createJsonResponse(response);
    } catch (error) {
      if (error instanceof Error && isAuthError(error)) {
        return handleAuthError(error, { component: 'ProfileRouter', operation: 'GET_PROFILE' });
      }
      
      return handleServerError(error, 'fetch profile', { component: 'ProfileRouter', operation: 'GET_PROFILE' });
    }
  }

  /**
   * Update user profile (name and/or language)
   */
  private async updateProfile(request: Request): Promise<Response> {
    try {
      // Authenticate user
      const user = await this.authService.authenticateUser(request);

      const body = await parseJsonBody<ProfileUpdateRequest>(request);

      // Validate input using utils
      const validationError = validateProfileUpdateRequest(body);
      if (validationError) {
        return createErrorResponse(validationError, 400);
      }
      
      // Prepare updates
      const updates: { name?: string; language?: string } = {};
      if (body.name) {
        updates.name = body.name.trim();
      }
      if (body.language) {
        updates.language = body.language;
      }

      // Update user
      const updatedUser = await this.userDB.updateUser(user.id, updates);

      // Get updated user's worlds
      const userWorlds = await this.userDB.getUserSessionsWithWorlds(user.id);

      const response: ProfileResponse = {
        user: updatedUser,
        userWorlds
      };

      return createJsonResponse(response);
    } catch (error) {
      if (error instanceof Error && isAuthError(error)) {
        return handleAuthError(error, { component: 'ProfileRouter', operation: 'UPDATE_PROFILE' });
      }
      
      return handleServerError(error, 'update profile', { component: 'ProfileRouter', operation: 'UPDATE_PROFILE' });
    }
  }
}
 