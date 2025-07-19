import { 
  createJsonResponse, 
  createErrorResponse, 
  extractBearerToken, 
  parseJsonBody, 
  logRequest
} from '../utils';
import { DatabaseService } from '../database/database';
import { Env } from '../routes';
import { User, GoogleOAuthSession } from '../database/db-types';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleAuthRouter {
  private db: DatabaseService;
  private env: Env;

  constructor(env: Env) {
    this.db = new DatabaseService(env.DB);
    this.env = env;
    this.validateOAuthConfiguration();
  }

  /**
   * Validate OAuth configuration on startup
   */
  private validateOAuthConfiguration(): void {
    const errors: string[] = [];
    
    if (!this.env.GOOGLE_CLIENT_ID) {
      errors.push('GOOGLE_CLIENT_ID environment variable is not set');
    } else if (this.env.GOOGLE_CLIENT_ID.includes('1234567890') || this.env.GOOGLE_CLIENT_ID === 'your-client-id') {
      errors.push('GOOGLE_CLIENT_ID is using a placeholder value');
    }
    
    if (!this.env.GOOGLE_CLIENT_SECRET) {
      errors.push('GOOGLE_CLIENT_SECRET environment variable is not set');
    } else if (this.env.GOOGLE_CLIENT_SECRET.includes('your-secret') || this.env.GOOGLE_CLIENT_SECRET === 'placeholder') {
      errors.push('GOOGLE_CLIENT_SECRET is using a placeholder value');
    }
    
    if (errors.length > 0) {
      console.error('❌ Google OAuth Configuration Errors:');
      errors.forEach(error => console.error(`  - ${error}`));
      console.error('');
      console.error('To fix these issues:');
      console.error('1. Get OAuth credentials from: https://console.cloud.google.com/apis/credentials');
      console.error('2. Set secrets using Wrangler:');
      console.error('   wrangler secret put GOOGLE_CLIENT_ID');
      console.error('   wrangler secret put GOOGLE_CLIENT_SECRET');
      console.error('3. Deploy your changes');
      console.error('');
      console.error('OAuth authentication will fail until these are configured properly!');
    } else {
      console.log('✅ Google OAuth configuration validated successfully');
    }
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);
    
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Google OAuth routes
    if (pathname === '/auth/google' && method === 'GET') {
      return await this.initiateGoogleAuth(request);
    }
    
    if (pathname === '/auth/google/callback' && method === 'GET') {
      return await this.handleGoogleCallback(request);
    }
    
    if (pathname === '/auth/google/mobile-callback' && method === 'POST') {
      return await this.handleMobileCallback(request);
    }
    
    if (pathname === '/auth/validate-google' && method === 'GET') {
      return await this.validateGoogleToken(request);
    }

    if (pathname === '/auth/logout' && method === 'POST') {
      return await this.logout(request);
    }

    if (pathname === '/auth/welcome' && method === 'GET') {
      return await this.getWelcomeInfo(request);
    }

    return null; // Route not handled by this router
  }

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google's authorization server
   */
  private async initiateGoogleAuth(request: Request): Promise<Response> {
    try {
      // Check OAuth configuration before proceeding
      if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) {
        return createErrorResponse(
          'OAuth is not properly configured. Please contact system administrator.',
          500,
          'Configuration Error'
        );
      }

      const url = new URL(request.url);
      const redirectUri = this.getRedirectUri(url);
      
      // Generate state parameter for CSRF protection
      const state = crypto.randomUUID();
      
      // Build Google OAuth URL
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', this.env.GOOGLE_CLIENT_ID || '');
      googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('state', state);
      googleAuthUrl.searchParams.set('access_type', 'offline');
      googleAuthUrl.searchParams.set('prompt', 'consent');

      // Store state in a secure cookie (short-lived)
      const response = new Response(null, {
        status: 302,
        headers: {
          'Location': googleAuthUrl.toString(),
          'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, // 10 minutes
        },
      });

      return response;
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      return createErrorResponse('Failed to initiate authentication', 500);
    }
  }

  /**
   * Handle Google OAuth callback
   * Exchange authorization code for access token and create user session
   */
  private async handleGoogleCallback(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Check for OAuth errors
      if (error) {
        return this.createCallbackErrorPage(`Google OAuth error: ${error}`);
      }

      if (!code || !state) {
        return this.createCallbackErrorPage('Missing authorization code or state parameter');
      }

      // Validate state parameter
      const cookies = request.headers.get('Cookie') || '';
      const stateCookie = this.extractCookieValue(cookies, 'oauth_state');
      
      if (!stateCookie || stateCookie !== state) {
        return this.createCallbackErrorPage('Invalid state parameter - potential CSRF attack');
      }

      // Exchange code for tokens
      const tokenData = await this.exchangeCodeForTokens(code, url);
      
      // Get user info from Google
      const userInfo = await this.fetchGoogleUserInfo(tokenData.access_token);
      
      // Create or update user in our database
      const user = await this.createOrUpdateUser(userInfo);
      
      // Create OAuth session
      const oauthSession = await this.createOAuthSession(user.id, tokenData);
      
      // Create success response with user session token
      return this.createCallbackSuccessPage(oauthSession.access_token, user);

    } catch (error) {
      console.error('Error handling Google callback:', error);
      return this.createCallbackErrorPage('Authentication failed. Please try again.');
    }
  }

  /**
   * Handle mobile OAuth callback
   * Exchange authorization code for tokens and return JSON response
   */
  private async handleMobileCallback(request: Request): Promise<Response> {
    try {
      const body = await parseJsonBody(request) as { code?: string; state?: string; redirectUri?: string; codeVerifier?: string };
      const { code, state, redirectUri, codeVerifier } = body;

      if (!code) {
        return createErrorResponse('Missing authorization code', 400);
      }

      // Exchange code for tokens (using mobile redirect URI and PKCE)
      const tokenData = await this.exchangeCodeForTokensMobile(code, redirectUri || '', codeVerifier);
      
      // Get user info from Google
      const userInfo = await this.fetchGoogleUserInfo(tokenData.access_token);
      
      // Create or update user in our database
      const user = await this.createOrUpdateUser(userInfo);
      
      // Create OAuth session
      const oauthSession = await this.createOAuthSession(user.id, tokenData);
      
      // Return JSON response for mobile
      return createJsonResponse({
        success: true,
        token: oauthSession.access_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture_url: user.picture_url
        }
      });

    } catch (error) {
      console.error('Error handling mobile callback:', error);
      return createErrorResponse('Mobile authentication failed', 500);
    }
  }

  /**
   * Validate Google authentication token
   */
  private async validateGoogleToken(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing or invalid authorization header', 401, 'Unauthorized');
      }

      // Find OAuth session by access token
      const oauthSession = await this.db.getOAuthSessionByToken(token);

      if (!oauthSession) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      // Check if token is expired
      if (new Date(oauthSession.expires_at) <= new Date()) {
        // Try to refresh token if available
        if (oauthSession.refresh_token) {
          try {
            const refreshedTokens = await this.refreshAccessToken(oauthSession.refresh_token);
            await this.updateOAuthSession(oauthSession.id, refreshedTokens);
            
            // Return success with updated user info
            const user = await this.db.getUserById(oauthSession.user_id);
            if (!user) {
              throw new Error('User not found');
            }
            return createJsonResponse({ 
              valid: true, 
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                picture_url: user.picture_url
              }
            });
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            await this.db.deleteOAuthSession(oauthSession.id);
            return createErrorResponse('Token expired and refresh failed', 401, 'Unauthorized');
          }
        } else {
          await this.db.deleteOAuthSession(oauthSession.id);
          return createErrorResponse('Token expired', 401, 'Unauthorized');
        }
      }

      // Token is valid, return user info
      const user = await this.db.getUserById(oauthSession.user_id);
      if (!user) {
        throw new Error('User not found');
      }
      return createJsonResponse({ 
        valid: true, 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture_url: user.picture_url
        }
      });

    } catch (error) {
      console.error('Error validating Google token:', error);
      return createErrorResponse('Token validation failed', 500);
    }
  }

  /**
   * Logout user - revoke tokens and clean up
   */
  private async logout(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (token) {
        const oauthSession = await this.db.getOAuthSessionByToken(token);
        if (oauthSession) {
          // Revoke token with Google
          try {
            await this.revokeGoogleToken(oauthSession.access_token);
          } catch (error) {
            console.warn('Failed to revoke Google token:', error);
          }
          
          // Delete from our database
          await this.db.deleteOAuthSession(oauthSession.id);
        }
      }

      return createJsonResponse({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error during logout:', error);
      return createErrorResponse('Logout failed', 500);
    }
  }

  /**
   * Get welcome information for authenticated user
   */
  private async getWelcomeInfo(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing or invalid authorization header', 401, 'Unauthorized');
      }

      // Find OAuth session by access token
      const oauthSession = await this.db.getOAuthSessionByToken(token);

      if (!oauthSession) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      // Check if token is expired
      if (new Date(oauthSession.expires_at) <= new Date()) {
        await this.db.deleteOAuthSession(oauthSession.id);
        return createErrorResponse('Token expired', 401, 'Unauthorized');
      }

      // Get user info
      const user = await this.db.getUserById(oauthSession.user_id);
      if (!user) {
        return createErrorResponse('User not found', 401, 'Unauthorized');
      }

      // Create welcome response with POC disclaimer
      const welcomeResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture_url: user.picture_url
        },
        welcome: {
          title: `Welcome back, ${user.name}!`,
          message: "Ready to dive into your next AI-powered adventure? Have you ever wanted to be a wizard in the Harry Potter world? Odyssey lets you become the first character in your favorite stories!",
          features: [
            "🎭 Become the main character in famous stories",
            "🤖 AI-powered dynamic storytelling",
            "📚 Multiple world adventures",
            "💾 Persistent story sessions"
          ]
        },
        timestamp: new Date().toISOString()
      };

      return createJsonResponse(welcomeResponse);

    } catch (error) {
      console.error('Error fetching welcome info:', error);
      return createErrorResponse('Failed to fetch welcome information', 500);
    }
  }

  // === HELPER METHODS ===

  private getRedirectUri(requestUrl: URL): string {
    // For development and production
    return `${requestUrl.protocol}//${requestUrl.host}/auth/google/callback`;
  }

  private extractCookieValue(cookies: string, name: string): string | null {
    const match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  private async exchangeCodeForTokens(code: string, requestUrl: URL): Promise<GoogleTokenResponse> {
    const redirectUri = this.getRedirectUri(requestUrl);
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID || '',
        client_secret: this.env.GOOGLE_CLIENT_SECRET || '',
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorData}`);
    }

    return await response.json();
  }

  private async exchangeCodeForTokensMobile(code: string, redirectUri: string, codeVerifier?: string): Promise<GoogleTokenResponse> {
    const tokenParams: Record<string, string> = {
      client_id: this.env.GOOGLE_CLIENT_ID || '',
      client_secret: this.env.GOOGLE_CLIENT_SECRET || '',
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    
    // Add code verifier for PKCE if provided
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Mobile token exchange failed: ${response.status} ${errorData}`);
    }

    return await response.json();
  }

  private async fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    return await response.json();
  }

  private async createOrUpdateUser(userInfo: GoogleUserInfo): Promise<User> {
    const existingUser = await this.db.getUserByGoogleId(userInfo.id);
    
    if (existingUser) {
      // Update existing user
      const updatedUser = await this.db.updateUser(existingUser.id, {
        email: userInfo.email,
        name: userInfo.name,
        picture_url: userInfo.picture,
        last_login_at: new Date().toISOString()
      });
      return updatedUser;
    } else {
      // Create new user
      const newUser = await this.db.createUser({
        google_id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture_url: userInfo.picture
      });
      return newUser;
    }
  }

  private async createOAuthSession(userId: number, tokenData: GoogleTokenResponse): Promise<GoogleOAuthSession> {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    return await this.db.createOAuthSession({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString()
    });
  }

  private async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID || '',
        client_secret: this.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
  }

  private async updateOAuthSession(sessionId: number, tokenData: { access_token: string; expires_in: number }): Promise<void> {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    await this.db.updateOAuthSession(sessionId, {
      access_token: tokenData.access_token,
      expires_at: expiresAt.toISOString()
    });
  }

  private async revokeGoogleToken(accessToken: string): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
    });
  }

  private createCallbackErrorPage(message: string): Response {
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Error - Odyssey</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 2rem;
        max-width: 500px;
        margin: 0 auto;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      }
      .error { color: #dc2626; margin: 1rem 0; }
      .button {
        background: #8B5CF6;
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        text-decoration: none;
        display: inline-block;
        margin-top: 1rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>🚫 Authentication Failed</h2>
      <p class="error">${message}</p>
      <p>Please close this window and try again.</p>
      <a href="/" class="button">Return to App</a>
    </div>
  </body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Set-Cookie': 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', // Clear state cookie
      },
      status: 400,
    });
  }

  private createCallbackSuccessPage(accessToken: string, user: User): Response {
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Success - Odyssey</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 2rem;
        max-width: 500px;
        margin: 0 auto;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      }
      .success { color: #059669; margin: 1rem 0; }
      .user-info { 
        margin: 1rem 0; 
        padding: 1rem; 
        background: #f8fafc; 
        border-radius: 8px; 
      }
      .avatar { 
        width: 64px; 
        height: 64px; 
        border-radius: 50%; 
        margin: 0 auto 1rem; 
        display: block; 
      }
      .disclaimer {
        background: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>🎉 Welcome to Odyssey!</h2>
      <p class="success">Authentication successful!</p>
      
      <div class="user-info">
        ${user.picture_url ? `<img src="${user.picture_url}" alt="Profile" class="avatar">` : ''}
        <h3>Hello, ${user.name}!</h3>
        <p>${user.email}</p>
      </div>

      <p>You can now close this window and enjoy your storytelling adventure!</p>
      
      <script>
        // Store the authentication token in localStorage immediately
        try {
          localStorage.setItem('odyssey_google_token', '${accessToken}');
          localStorage.setItem('odyssey_google_user', JSON.stringify({
            id: ${user.id},
            email: '${user.email}',
            name: '${user.name}',
            picture_url: '${user.picture_url || ''}'
          }));
          
          // Communicate with the parent window (mobile app) immediately
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              token: '${accessToken}',
              user: {
                id: ${user.id},
                email: '${user.email}',
                name: '${user.name}',
                picture_url: '${user.picture_url || ''}'
              }
            }, '*');
          }
          
          // Close immediately after storing data
          setTimeout(() => {
            window.close();
          }, 100);
          
        } catch (err) {
          console.error('Failed to store authentication data:', err);
          // Still try to close even if storage fails
          setTimeout(() => {
            window.close();
          }, 1000);
        }
      </script>
    </div>
  </body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Set-Cookie': 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', // Clear state cookie
      },
    });
  }
} 