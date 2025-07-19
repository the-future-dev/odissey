/**
 * OAuth Configuration
 * Contains OAuth provider settings and client IDs from environment variables
 */

interface OAuthConfig {
  google: {
    clientId: string;
    webClientId: string;
    scopes: string[];
    discovery: {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      revocationEndpoint: string;
    };
  };
}

// Get OAuth configuration from environment variables
// These should be set in your deployment environment
const getGoogleClientId = (): string => {
  // For React Native/Expo, try various environment variable sources
  if (typeof process !== 'undefined' && process.env) {
    return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 
           process.env.GOOGLE_CLIENT_ID || 
           process.env.REACT_APP_GOOGLE_CLIENT_ID || 
           '';
  }
  
  // For web, check if variables are injected at build time
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__.GOOGLE_CLIENT_ID || '';
  }
  
  return '';
};

const getGoogleWebClientId = (): string => {
  // For React Native/Expo, try various environment variable sources
  if (typeof process !== 'undefined' && process.env) {
    return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 
           process.env.GOOGLE_WEB_CLIENT_ID || 
           process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID || 
           getGoogleClientId(); // Fallback to regular client ID
  }
  
  // For web, check if variables are injected at build time
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__.GOOGLE_WEB_CLIENT_ID || getGoogleClientId();
  }
  
  return getGoogleClientId();
};

// Validate that required OAuth credentials are available
const validateOAuthConfig = () => {
  const clientId = getGoogleClientId();
  const webClientId = getGoogleWebClientId();
  
  if (!clientId || clientId.includes('1234567890') || clientId === 'your-client-id') {
    console.error('❌ Google OAuth Client ID is missing or using placeholder value!');
  }
  
  return { clientId, webClientId };
};

// Environment-specific OAuth configuration
const createOAuthConfig = (): OAuthConfig => {
  const { clientId, webClientId } = validateOAuthConfig();
  
  return {
    google: {
      clientId: clientId,
      webClientId: webClientId,
      scopes: ['openid', 'profile', 'email'],
      discovery: {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      }
    }
  };
};

// Simple environment detection
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

// Manual override for easy testing - change this line to switch environments
const FORCE_ENVIRONMENT: 'development' | 'production' | null = 'development';

// Final environment determination
const ENVIRONMENT = FORCE_ENVIRONMENT || (isDevelopment ? 'development' : 'production');

export const OAUTH_CONFIG = createOAuthConfig();

// Development utility
export const getOAuthEnvironmentInfo = () => ({
  environment: ENVIRONMENT,
  config: OAUTH_CONFIG,
  isDevelopment: isDevelopment,
  hasValidClientId: !!(OAUTH_CONFIG.google.clientId && !OAUTH_CONFIG.google.clientId.includes('1234567890')),
  hasValidWebClientId: !!(OAUTH_CONFIG.google.webClientId && !OAUTH_CONFIG.google.webClientId.includes('1234567890'))
});

// Error helper for missing configuration
export const validateOAuthSetup = () => {
  const info = getOAuthEnvironmentInfo();
  
  if (!info.hasValidClientId) {
    throw new Error(
      'Google OAuth Client ID is not configured or using placeholder value. ' +
      'Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable with your real Google OAuth client ID. ' +
      'Get your client ID from: https://console.cloud.google.com/apis/credentials'
    );
  }
  
  return true;
};

// Setup instructions for developers
export const OAUTH_SETUP_INSTRUCTIONS = `
🔧 OAuth Setup Instructions:

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable Google+ API and Google OAuth2 API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure for each platform:
   
   📱 For Mobile (Android/iOS):
   - Application type: "Android" or "iOS"
   - Add your package name and SHA-1 certificate fingerprint
   
   🌐 For Web:
   - Application type: "Web application"
   - Add authorized redirect URIs:
     * http://localhost:8787/auth/google/callback (development)
     * https://your-domain.workers.dev/auth/google/callback (production)

6. Set environment variables:
   - EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-mobile-client-id
   - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id (optional)

7. For backend (Cloudflare Workers), set secrets:
   - wrangler secret put GOOGLE_CLIENT_ID
   - wrangler secret put GOOGLE_CLIENT_SECRET

⚠️ Never commit real OAuth credentials to your repository!
`;

// Get required redirect URIs for Google Console configuration
export const getRequiredRedirectURIs = () => {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
  
  return {
    web: [
      'http://localhost:8787/auth/google/callback', // Development
      'https://odissey-backend.andre-ritossa.workers.dev/auth/google/callback', // Production (update with your domain)
    ],
    mobile: [
      'odissey://auth/callback', // Deep link for mobile app
    ],
    development: isDev
  };
};

// OAuth setup validation and diagnostic helper
export const runOAuthDiagnostics = () => {
  const info = getOAuthEnvironmentInfo();
  const redirects = getRequiredRedirectURIs();
  
  if (!info.hasValidClientId) {
    console.error('❌ CRITICAL: Google OAuth Client ID is not configured or using placeholder value.');
    console.error('Authentication will fail with "Access Blocked" error until this is fixed.');
    console.error('Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable with your real Google OAuth client ID.');
  }
  
  return {
    isValid: info.hasValidClientId,
    redirectUris: redirects,
    environmentInfo: info
  };
}; 