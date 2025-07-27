import { GoogleTokenResponse, GoogleUserInfo } from './google';
import { OAuthService, UserDbService } from '../database';
import { User, GoogleOAuthSession } from '../database/db-types';
import { Env } from '../routes';

export interface OAuthUrlConfig {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
  accessType?: string;
  prompt?: string;
}

export class OAuthUtils {
  private oAuth: OAuthService;
  private userDB: UserDbService;
  private env: Env;

  constructor(oAuth: OAuthService, userDB: UserDbService, env: Env) {
    this.oAuth = oAuth;
    this.userDB = userDB;
    this.env = env;
  }

  public generateGoogleAuthUrl(config: OAuthUrlConfig): string {
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', config.clientId);
    googleAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', config.scope || 'openid email profile');
    googleAuthUrl.searchParams.set('state', config.state);
    googleAuthUrl.searchParams.set('access_type', config.accessType || 'offline');
    googleAuthUrl.searchParams.set('prompt', config.prompt || 'consent');
    
    return googleAuthUrl.toString();
  }

  public generateOAuthState(): string {
    return crypto.randomUUID();
  }

  public createOAuthStateResponse(authUrl: string, state: string): Response {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': authUrl,
        'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      },
    });
  }

  public async createOrUpdateUser(userInfo: GoogleUserInfo): Promise<User> {
    // Try to find user by google_id first
    let user = await this.userDB.getUserByGoogleId(userInfo.id);

    if (user) {
      // User found by google_id, do not update name, email, or picture_url
      // Only update last_login_at
      await this.userDB.updateUser(user.id, { last_login_at: new Date().toISOString() });
      return user;
    }

    // If not found by google_id, try to find by email (for existing users who might not have google_id yet, or if google_id was not set initially)
    user = await this.userDB.getUserByEmail(userInfo.email);

    if (user) {
      // User found by email, update google_id if it's missing, and update last_login_at
      const updates: { google_id?: string; last_login_at?: string } = {
        last_login_at: new Date().toISOString()
      };
      if (!user.google_id) {
        updates.google_id = userInfo.id;
      }
      if (Object.keys(updates).length > 0) {
        user = await this.userDB.updateUser(user.id, updates);
      }
      return user;
    }

    // If no user found by google_id or email, create a new user
    user = await this.userDB.createUser({
      google_id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture_url: userInfo.picture,
      language: 'English' // Default language, can be updated later if needed
    });

    return user;
  }

  public async createOAuthSession(userId: string, tokenData: GoogleTokenResponse): Promise<GoogleOAuthSession> {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    
    return await this.oAuth.createOAuthSession({
      user_id: parseInt(userId),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || undefined,
      expires_at: expiresAt.toISOString()
    });
  }

  public async updateOAuthSession(sessionId: string, tokenData: { access_token: string; expires_in: number }): Promise<void> {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await this.oAuth.updateOAuthSession(parseInt(sessionId), {
      access_token: tokenData.access_token,
      expires_at: expiresAt.toISOString()
    });
  }

  public validateOAuthConfiguration(): void {
    if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('OAuth is not properly configured. Please contact system administrator.');
    }
  }

  public async createOrUpdateUserFromGoogleInfo(userInfo: GoogleUserInfo): Promise<User> {
    return this.createOrUpdateUser(userInfo);
  }

  public async createOAuthSessionFromTokens(userId: string, tokenData: GoogleTokenResponse): Promise<GoogleOAuthSession> {
    return this.createOAuthSession(userId, tokenData);
  }

  public async updateOAuthSessionFromTokens(sessionId: string, tokenData: { access_token: string; expires_in: number }): Promise<void> {
    return this.updateOAuthSession(sessionId, tokenData);
  }
}