/**
 * Application Configuration
 * Simplified environment management for API endpoints
 */

interface Config {
  apiUrl: string;
}

const configs: Record<string, Config> = {
  development: {
    apiUrl: 'http://localhost:8787',
    // For Android emulator, use: 'http://10.0.2.2:8787'
  },
  production: {
    apiUrl: 'https://odissey-backend.andre-ritossa.workers.dev',
  }
};

// Simple environment detection
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

// Manual override for easy testing - change this line to switch environments
const FORCE_ENVIRONMENT: 'development' | 'production' | null = 'development';

// Final environment determination
const ENVIRONMENT = FORCE_ENVIRONMENT || (isDevelopment ? 'development' : 'production');

export const API_URL = configs[ENVIRONMENT].apiUrl;

// Development utility
export const getEnvironmentInfo = () => ({
  environment: ENVIRONMENT,
  apiUrl: API_URL,
  isDevelopment: ENVIRONMENT === 'development'
}); 