import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken,
  parseJsonBody,
  validateRequiredFields,
  logRequest
} from '../utils';
import { OAuthService, UserDbService } from '../database';
import { Env } from '../routes';
import { User } from '../database/db-types';

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
  private oAuth: OAuthService;
  private userDB: UserDbService;

  constructor(env: Env) {
    this.oAuth = new OAuthService(env.DB);
    this.userDB = new UserDbService(env.DB);
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
   * Authenticate user with Google OAuth token
   * Returns user object if authenticated, throws error if not
   */
  private async authenticateUser(request: Request): Promise<User> {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      throw new Error('Missing authorization header');
    }

    // Get Google OAuth session
    const oauthSession = await this.oAuth.getOAuthSessionByToken(token);
    if (!oauthSession) {
      throw new Error('Invalid or expired token');
    }

    // Check if token is expired
    if (new Date(oauthSession.expires_at) <= new Date()) {
      await this.oAuth.deleteOAuthSession(oauthSession.id);
      throw new Error('Token expired');
    }

    const user = await this.userDB.getUserById(oauthSession.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Get user profile with their worlds
   */
  private async getProfile(request: Request): Promise<Response> {
    try {
      // Authenticate user
      const user = await this.authenticateUser(request);

      // Get user's worlds/sessions
      const userWorlds = await this.userDB.getUserSessionsWithWorlds(user.id);

      const response: ProfileResponse = {
        user,
        userWorlds
      };

      return createJsonResponse(response);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Missing authorization') ||
        error.message.includes('Invalid or expired token') ||
        error.message.includes('Token expired') ||
        error.message.includes('User not found')
      )) {
        return createErrorResponse(error.message, 401, 'Unauthorized');
      }
      
      console.error('Error fetching profile:', error);
      return createErrorResponse('Failed to fetch profile', 500);
    }
  }

  /**
   * Update user profile (name and/or language)
   */
  private async updateProfile(request: Request): Promise<Response> {
    try {
      // Authenticate user
      const user = await this.authenticateUser(request);

      const body = await parseJsonBody<ProfileUpdateRequest>(request);

      // Validate input
      if (!body.name && !body.language) {
        return createErrorResponse('At least one field (name or language) must be provided', 400);
      }

      if (body.name && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
        return createErrorResponse('Name must be a non-empty string', 400);
      }

      if (body.language && !['English', 'French', 'German', 'Italian', 'Swedish', 'Spanish', 'Portuguese'].includes(body.language)) {
        return createErrorResponse('Language must be one of: English, French, German, Italian, Swedish, Spanish, Portuguese', 400);
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
      if (error instanceof Error && (
        error.message.includes('Missing authorization') ||
        error.message.includes('Invalid or expired token') ||
        error.message.includes('Token expired') ||
        error.message.includes('User not found')
      )) {
        return createErrorResponse(error.message, 401, 'Unauthorized');
      }
      
      console.error('Error updating profile:', error);
      return createErrorResponse('Failed to update profile', 500);
    }
  }
} 