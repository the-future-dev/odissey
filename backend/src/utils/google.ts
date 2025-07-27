import { Env } from '../routes';

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

function getRedirectUri(requestUrl: URL): string {
  // For development and production
  return `${requestUrl.protocol}//${requestUrl.host}/auth/google/callback`;
}

export async function exchangeCodeForTokens(code: string, requestUrl: URL, env: Env): Promise<GoogleTokenResponse> {
  const redirectUri = getRedirectUri(requestUrl);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
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

export async function exchangeCodeForTokensMobile(code: string, redirectUri: string, env: Env, codeVerifier?: string): Promise<GoogleTokenResponse> {
  const tokenParams: Record<string, string> = {
    client_id: env.GOOGLE_CLIENT_ID || '',
    client_secret: env.GOOGLE_CLIENT_SECRET || '',
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

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
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

export async function refreshAccessToken(refreshToken: string, env: Env): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return await response.json();
}

export async function revokeGoogleToken(accessToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
    method: 'POST',
  });
}
