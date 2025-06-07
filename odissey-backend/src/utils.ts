import { ApiError } from './types';

// CORS headers for cross-origin requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Generate a secure random token for anonymous authentication
 */
export function generateToken(): string {
  // Generate a secure random token using crypto.randomUUID()
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return 'session_' + crypto.randomUUID();
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Create a standardized JSON response
 */
export function createJsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders,
    },
  });
}

/**
 * Create an error response
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  error: string = 'Bad Request'
): Response {
  const errorData: ApiError = {
    error,
    message,
    status,
  };
  
  return createJsonResponse(errorData, status);
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Parse JSON request body safely
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    const body = await request.text();
    if (!body) {
      throw new Error('Request body is empty');
    }
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  obj: any,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!obj || !obj[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Calculate token expiration date (default: 30 days)
 */
export function calculateTokenExpiration(daysFromNow: number = 30): Date {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + daysFromNow);
  return expirationDate;
}

/**
 * Log request information for debugging
 */
export function logRequest(request: Request, info: string = ''): void {
  console.log(`${request.method} ${request.url} ${info}`);
}

/**
 * Validate session ID format
 */
export function isValidSessionId(sessionId: string): boolean {
  return /^session_[a-f0-9-]{36}$/.test(sessionId);
}

/**
 * Sanitize user input to prevent basic XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Basic sanitization - remove potential script tags and limit length
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .substring(0, 2000) // Limit length
    .trim();
}

/**
 * Check if a string is a valid world ID
 */
export function isValidWorldId(worldId: string): boolean {
  // Allow alphanumeric characters, hyphens, and underscores, case insensitive
  return /^[a-zA-Z0-9_-]+$/.test(worldId) && worldId.length >= 1 && worldId.length <= 50;
} 