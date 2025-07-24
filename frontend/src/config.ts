/**
 * Application Configuration
 * Simplified environment management for API endpoints
 */

interface Config {
  apiUrl: string;
  oauth: {
    retryAttempts: number;
    retryDelay: number;
    requestTimeout: number;
    fallbackEnabled: boolean;
  };
}

const configs: Record<string, Config> = {
  development: {
    apiUrl: 'http://localhost:8787',
    // For Android emulator, use: 'http://10.0.2.2:8787'
    oauth: {
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      requestTimeout: 10000, // 10 seconds
      fallbackEnabled: true // Enable fallback auth when requests are blocked
    }
  },
  production: {
    apiUrl: 'https://odissey-backend.andre-ritossa.workers.dev',
    oauth: {
      retryAttempts: 2,
      retryDelay: 2000, // 2 seconds
      requestTimeout: 30000, // 30 seconds
      fallbackEnabled: false // Disable fallback in production
    }
  }
};

// Simple environment detection
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

// Manual override for easy testing - change this line to switch environments
const FORCE_ENVIRONMENT: 'development' | 'production' | null = 'production';

// Final environment determination
const ENVIRONMENT = FORCE_ENVIRONMENT || (isDevelopment ? 'development' : 'production');

export const API_URL = configs[ENVIRONMENT].apiUrl;
export const OAUTH_CONFIG = configs[ENVIRONMENT].oauth;

// Development utility
export const getEnvironmentInfo = () => ({
  environment: ENVIRONMENT,
  apiUrl: API_URL,
  oauthConfig: OAUTH_CONFIG,
  isDevelopment: isDevelopment
}); 