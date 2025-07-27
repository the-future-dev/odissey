import { OAuthService } from '../database';
import { UserDbService } from '../database';
import { createErrorResponse } from './response';
import { extractBearerToken } from './auth';
import { Logger } from './logger';
import { User } from '../database/db-types';

export class AuthService {
  private oAuth: OAuthService;
  private userDB: UserDbService;

  constructor(oAuthService: OAuthService, userDbService: UserDbService) {
    this.oAuth = oAuthService;
    this.userDB = userDbService;
  }

  /**
   * Authenticate user with Google OAuth token
   * Returns user object if authenticated, throws error if not
   */
  public async authenticateUser(request: Request): Promise<User> {
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
   * Authenticate and authorize user for a specific context.
   * Returns user and oauthSession objects if successful, or a Response object on error.
   */
  public async authenticateAndAuthorize(request: Request, context: any): Promise<{ user: User, oauthSession: any } | Response> {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);
    if (!token) {
      Logger.warn('Missing authorization header', context);
      return createErrorResponse('Missing authorization header', 401, 'Unauthorized');
    }

    const oauthSession = await this.oAuth.getOAuthSessionByToken(token);
    if (!oauthSession || new Date(oauthSession.expires_at) <= new Date()) {
      if (oauthSession) {
        await this.oAuth.deleteOAuthSession(oauthSession.id);
      }
      Logger.warn('Invalid or expired token', context);
      return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
    }

    const user = await this.userDB.getUserById(oauthSession.user_id);
    if (!user) {
      Logger.error('User not found for authenticated session', context);
      return createErrorResponse('User not found', 401, 'Unauthorized');
    }
    return { user, oauthSession };
  }
}
