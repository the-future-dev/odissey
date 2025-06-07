// Configuration for API endpoints
// You can easily change this for different environments

const configs = {
  development: {
    apiUrl: 'http://localhost:8787',
    // For Android emulator, use: 'http://10.0.2.2:8787'
  },
  production: {
    apiUrl: 'https://backend-api.andre-ritossa.workers.dev',
  }
};

// Simple way to switch environments - change this line:
// Set to 'development' for local testing, 'production' for deployed backend
const ENVIRONMENT: 'development' | 'production' = 'development';

// Or use __DEV__ if you prefer:
// const ENVIRONMENT = __DEV__ ? 'development' : 'production';

export const API_URL = configs[ENVIRONMENT].apiUrl;

// Easy toggle function for testing
export const setDevelopmentMode = () => {
  // This would require a restart, but useful for quick switching
  console.log('Current API URL:', API_URL);
}; 