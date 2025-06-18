import { ApiError } from './types';

// CORS headers for cross-origin requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Comprehensive logging utilities
export interface LogContext {
  sessionId?: string;
  userId?: number;
  operation?: string;
  component?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  private static formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp();
    const sessionId = context?.sessionId ? `[${context.sessionId.substring(0, 8)}...]` : '';
    const component = context?.component ? `[${context.component}]` : '';
    const operation = context?.operation ? `[${context.operation}]` : '';
    const duration = context?.duration ? `(${context.duration}ms)` : '';
    
    let logLine = `${timestamp} ${level} ${component}${operation}${sessionId} ${message} ${duration}`;
    
    if (context?.metadata && Object.keys(context.metadata).length > 0) {
      logLine += ` | ${JSON.stringify(context.metadata)}`;
    }
    
    return logLine.trim();
  }

  static info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  static warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  static error(message: string, error?: any, context?: LogContext): void {
    const errorDetails = error ? ` - ${error.message || error}` : '';
    console.error(this.formatMessage('ERROR', message + errorDetails, context));
    if (error?.stack) {
      console.error(error.stack);
    }
  }

  static debug(message: string, context?: LogContext): void {
    console.log(this.formatMessage('DEBUG', message, context));
  }

  static timing(operation: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.info(`${operation} completed`, { ...context, duration });
  }
}

// Performance timing utilities
export function createTimer(): number {
  return Date.now();
}

export function getElapsed(startTime: number): number {
  return Date.now() - startTime;
}

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
 * Log request information for debugging (optimized to reduce noise)
 */
export function logRequest(request: Request, info: string = ''): void {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Skip logging for health checks and very frequent requests
  const skipLogging = [
    '/health',
    '/auth/validate'
  ];
  
  if (skipLogging.some(path => pathname === path)) {
    return; // Don't log these frequent requests
  }
  
  // Log only the essential info for most requests
  const method = request.method;
  const shortPath = pathname.length > 50 ? pathname.substring(0, 47) + '...' : pathname;
  
  // Special handling for session interactions (just show session ID pattern)
  if (pathname.includes('/interact')) {
    const sessionMatch = pathname.match(/\/sessions\/([^\/]+)\//);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const shortSessionId = sessionId.substring(0, 8) + '...';
      Logger.info(`${method} /sessions/${shortSessionId}/interact${pathname.includes('stream') ? '-stream' : ''} ${info}`, {
        component: 'API',
        operation: 'REQUEST',
        sessionId: sessionId
      });
      return;
    }
  }
  
  Logger.info(`${method} ${shortPath} ${info}`.trim(), {
    component: 'API',
    operation: 'REQUEST'
  });
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