import { Env } from '../routes';

/**
 * Validate OAuth configuration on startup
 */
export function validateOAuthConfiguration(env: Env): void {
  const errors: string[] = [];

  if (!env.GOOGLE_CLIENT_ID) {
    errors.push('GOOGLE_CLIENT_ID environment variable is not set');
  } else if (env.GOOGLE_CLIENT_ID.includes('1234567890') || env.GOOGLE_CLIENT_ID === 'your-client-id') {
    errors.push('GOOGLE_CLIENT_ID is using a placeholder value');
  }

  if (!env.GOOGLE_CLIENT_SECRET) {
    errors.push('GOOGLE_CLIENT_SECRET environment variable is not set');
  } else if (env.GOOGLE_CLIENT_SECRET.includes('your-secret') || env.GOOGLE_CLIENT_SECRET === 'placeholder') {
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
