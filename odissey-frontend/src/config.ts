// Configuration for API endpoints
// You can easily change this for different environments

const configs = {
  development: {
    apiUrl: 'http://localhost:8787',
    // For Android emulator, use: 'http://10.0.2.2:8787'
  },
  production: {
    apiUrl: 'https://odissey-backend.andre-ritossa.workers.dev',
  }
};

// Auto-detect environment or manually override
const isDevEnvironment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

// Manual override - set this to force a specific environment
// null = auto-detect, 'development' = local backend, 'production' = deployed backend
const MANUAL_ENVIRONMENT: 'development' | 'production' | null = 'production';

const ENVIRONMENT: 'development' | 'production' = MANUAL_ENVIRONMENT || (isDevEnvironment ? 'development' : 'production');

export const API_URL = configs[ENVIRONMENT].apiUrl;

// Easy toggle function for testing
export const setDevelopmentMode = () => {
  console.log('Current environment:', ENVIRONMENT);
  console.log('Current API URL:', API_URL);
  console.log('To use local backend, set MANUAL_ENVIRONMENT to "development" in src/config.ts');
  console.log('To use production backend, set MANUAL_ENVIRONMENT to "production" in src/config.ts');
}; 