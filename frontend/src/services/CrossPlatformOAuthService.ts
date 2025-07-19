import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { API_URL } from '../config';
import { GoogleTokenManager } from '../api/googleAuth';
import { OAUTH_CONFIG, validateOAuthSetup, getOAuthEnvironmentInfo, runOAuthDiagnostics } from '../config/oauth';
import { ErrorHandlingService } from './ErrorHandlingService';

// Configure WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  cancelled?: boolean;
}

export class CrossPlatformOAuthService {
  private static instance: CrossPlatformOAuthService;
  private redirectUri: string;
  private isAuthenticating = false;
  private codeVerifier?: string;
  private errorHandler = ErrorHandlingService.getInstance();

  private constructor() {
    this.redirectUri = this.createRedirectUri();
    this.validateConfiguration();
  }

  static getInstance(): CrossPlatformOAuthService {
    if (!CrossPlatformOAuthService.instance) {
      CrossPlatformOAuthService.instance = new CrossPlatformOAuthService();
    }
    return CrossPlatformOAuthService.instance;
  }

  /**
   * Validate OAuth configuration on initialization
   */
  private validateConfiguration(): void {
    try {
      const diagnostics = runOAuthDiagnostics();
      
      if (!diagnostics.isValid) {
        console.error('');
        console.error('🚨 OAuth Configuration Error Detected!');
        console.error('Authentication will fail with "Access Blocked" error until this is fixed.');
        console.error('See the diagnostic output above for detailed setup instructions.');
        console.error('');
      }
    } catch (error) {
      console.error('❌ OAuth validation failed:', error);
    }
  }

  /**
   * Create platform-specific redirect URI
   */
  private createRedirectUri(): string {
    if (Platform.OS === 'web') {
      return `${API_URL}/auth/google/callback`;
    } else {
      // Mobile: Use deep linking with expo-auth-session
      return AuthSession.makeRedirectUri({
        scheme: 'odissey',
        path: 'auth/callback'
      });
    }
  }

  /**
   * Detect the current platform and return appropriate authentication method
   */
  private getPlatformType(): 'web' | 'mobile' {
    return Platform.OS === 'web' ? 'web' : 'mobile';
  }

  /**
   * Check if authentication is already in progress
   */
  isAuthenticationInProgress(): boolean {
    return this.isAuthenticating;
  }

  /**
   * Main authentication method that routes to platform-specific flows
   */
  async authenticate(): Promise<AuthResult> {
    if (this.isAuthenticating) {
      return {
        success: false,
        error: 'Authentication already in progress'
      };
    }

    // Validate OAuth setup before attempting authentication
    try {
      validateOAuthSetup();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth configuration error'
      };
    }

    try {
      this.isAuthenticating = true;

      return await this.errorHandler.executeWithRetry(async () => {
        const platform = this.getPlatformType();
        
        if (platform === 'web') {
          return await this.authenticateWeb();
        } else {
          return await this.authenticateMobile();
        }
      }, {
        maxRetries: 2,
        retryDelay: 1500,
        retryableErrors: ['network', 'fetch', 'timeout', 'connection']
      });
    } catch (error) {
      this.errorHandler.logError(error, 'oauth_authentication');
      const errorInfo = this.errorHandler.getErrorDisplayInfo(error);
      
      return {
        success: false,
        error: errorInfo.message
      };
    } finally {
      this.isAuthenticating = false;
    }
  }

  /**
   * Web-based authentication using popup
   */
  private async authenticateWeb(): Promise<AuthResult> {
    return new Promise((resolve) => {
      const authUrl = `${API_URL}/auth/google`;
      
      const popup = window.open(
        authUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        resolve({
          success: false,
          error: 'Popup blocked. Please allow popups and try again.'
        });
        return;
      }

      let resolved = false;
      let checkCount = 0;
      const maxChecks = 300; // 5 minutes maximum

      // Listen for postMessage from popup
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== new URL(authUrl).origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          if (!resolved) {
            resolved = true;
            cleanup();
            
            // Store authentication data
            if (event.data.token) {
              GoogleTokenManager.storeToken(event.data.token);
            }
            if (event.data.user) {
              GoogleTokenManager.storeUser(event.data.user);
            }
            
            resolve({
              success: true,
              user: event.data.user
            });
          }
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({
              success: false,
              error: event.data.error || 'Authentication failed'
            });
          }
        }
      };

      // Periodically check authentication status
      const authChecker = setInterval(async () => {
        checkCount++;
        
        if (checkCount > maxChecks) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({
              success: false,
              error: 'Authentication timeout'
            });
          }
          return;
        }

        // Check if popup was closed manually
        try {
          if (popup.closed) {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({
                success: false,
                cancelled: true,
                error: 'Authentication cancelled'
              });
            }
            return;
          }
        } catch (error) {
          // Cross-Origin-Opener-Policy might block access to popup.closed
          // This is normal behavior in some browsers/environments
          // We'll continue with other checks
        }

        // Check if authentication completed
        if (!resolved) {
          try {
            const authResult = await GoogleTokenManager.checkExistingAuth();
            if (authResult.isAuthenticated && authResult.user) {
              resolved = true;
              cleanup();
              resolve({
                success: true,
                user: authResult.user
              });
            }
          } catch (error) {
            // Auth check failed silently, will continue polling
          }
        }
      }, 1000);

      const cleanup = () => {
        window.removeEventListener('message', messageListener);
        clearInterval(authChecker);
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch (error) {
          // Popup close error can be ignored
        }
      };

      window.addEventListener('message', messageListener);

      // Overall timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            success: false,
            error: 'Authentication timed out'
          });
        }
      }, 300000); // 5 minutes
    });
  }

  /**
   * Mobile-based authentication using expo-auth-session
   */
  private async authenticateMobile(): Promise<AuthResult> {
    try {
      // Create the OAuth request
      const request = new AuthSession.AuthRequest({
        clientId: OAUTH_CONFIG.google.clientId,
        scopes: OAUTH_CONFIG.google.scopes,
        redirectUri: this.redirectUri,
        responseType: AuthSession.ResponseType.Code,
        state: Math.random().toString(36).substring(2, 15),
        codeChallenge: await this.generateCodeChallenge(),
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      });

      // Configure the discovery endpoints
      const discovery = OAUTH_CONFIG.google.discovery;

      // Start the authentication flow
      const result = await request.promptAsync(discovery);

      if (result.type === 'success') {
        const { code, state } = result.params;
        
        if (code) {
          // Exchange the code for tokens via our backend
          const tokenResult = await this.exchangeCodeForTokens(code, state);
          
          if (tokenResult.success) {
            return {
              success: true,
              user: tokenResult.user
            };
          } else {
            return {
              success: false,
              error: tokenResult.error || 'Failed to exchange code for tokens'
            };
          }
        } else {
          return {
            success: false,
            error: 'No authorization code received'
          };
        }
      } else if (result.type === 'cancel') {
        return {
          success: false,
          cancelled: true,
          error: 'Authentication cancelled'
        };
      } else {
        return {
          success: false,
          error: `Authentication failed: ${result.type}`
        };
      }
    } catch (error) {
      console.error('Mobile authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mobile authentication failed'
      };
    }
  }

  /**
   * Generate code challenge for PKCE
   */
  private async generateCodeChallenge(): Promise<string> {
    try {
      // Generate random code verifier
      const codeVerifierBytes = Crypto.getRandomBytes(32);
      const codeVerifier = btoa(String.fromCharCode(...codeVerifierBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      // Generate code challenge from verifier (SHA256 hash)
      const codeChallenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        codeVerifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      // Store code verifier for later use
      this.codeVerifier = codeVerifier;
      
      return codeChallenge;
    } catch (error) {
      // Fallback to simpler approach if PKCE generation fails
      console.warn('PKCE code challenge generation failed, using fallback:', error);
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
  }

  /**
   * Exchange authorization code for tokens via backend
   */
  private async exchangeCodeForTokens(code: string, state: string): Promise<{success: boolean, user?: any, error?: string}> {
    try {
      const response = await fetch(`${API_URL}/auth/google/mobile-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          redirectUri: this.redirectUri,
          codeVerifier: this.codeVerifier
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Store tokens
        if (data.token) {
          await GoogleTokenManager.storeToken(data.token);
        }
        if (data.user) {
          await GoogleTokenManager.storeUser(data.user);
        }
        
        return {
          success: true,
          user: data.user
        };
      } else {
        return {
          success: false,
          error: data.error || 'Failed to exchange code for tokens'
        };
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * Check if user is already authenticated
   */
  async checkExistingAuth(): Promise<{isAuthenticated: boolean, user?: any}> {
    try {
      return await GoogleTokenManager.checkExistingAuth();
    } catch (error) {
      console.error('Check existing auth error:', error);
      return { isAuthenticated: false };
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      await GoogleTokenManager.logout();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
}

export default CrossPlatformOAuthService; 