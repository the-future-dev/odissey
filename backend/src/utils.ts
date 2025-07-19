import { ApiError } from './routes/api-types';

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

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private static samplingRate: number = 1.0;
  private static logRequestDetails: boolean = true;

  /**
   * Initialize logger with environment variables
   * Call this once at worker startup
   */
  static initialize(env?: any): void {
    if (env?.LOG_LEVEL) {
      switch (env.LOG_LEVEL.toUpperCase()) {
        case 'DEBUG':
          this.logLevel = LogLevel.DEBUG;
          break;
        case 'INFO':
          this.logLevel = LogLevel.INFO;
          break;
        case 'WARN':
          this.logLevel = LogLevel.WARN;
          break;
        case 'ERROR':
          this.logLevel = LogLevel.ERROR;
          break;
      }
    }

    if (env?.LOG_SAMPLING_RATE) {
      this.samplingRate = parseFloat(env.LOG_SAMPLING_RATE) || 1.0;
    }

    if (env?.LOG_REQUEST_DETAILS !== undefined) {
      this.logRequestDetails = env.LOG_REQUEST_DETAILS === 'true';
    }

    // Log initialization to verify it's working
    console.log(`[LOGGER_INIT] Level: ${LogLevel[this.logLevel]}, Sampling: ${this.samplingRate}, RequestDetails: ${this.logRequestDetails}`);
  }

  private static shouldLog(level: LogLevel): boolean {
    if (level < this.logLevel) return false;
    if (this.samplingRate < 1.0 && Math.random() > this.samplingRate) return false;
    return true;
  }

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

  /**
   * Structured logging for Cloudflare Workers
   * This ensures logs appear in wrangler tail and dashboard
   */
  private static structuredLog(level: string, message: string, context?: LogContext): object {
    const logData = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      component: context?.component,
      operation: context?.operation,
      sessionId: context?.sessionId?.substring(0, 8),
      userId: context?.userId,
      duration: context?.duration,
      metadata: context?.metadata
    };

    // Remove undefined fields for cleaner logs
    Object.keys(logData).forEach(key => {
      if (logData[key as keyof typeof logData] === undefined) {
        delete logData[key as keyof typeof logData];
      }
    });

    return logData;
  }

  static info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const formatted = this.formatMessage('INFO', message, context);
    const structured = this.structuredLog('INFO', message, context);
    
    // Use console.log for INFO level - this appears in wrangler logs
    console.log(formatted);
    
    // Also log structured data for better parsing in Cloudflare dashboard
    if (context) {
      console.log('[STRUCTURED]', JSON.stringify(structured));
    }
  }

  static warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const formatted = this.formatMessage('WARN', message, context);
    const structured = this.structuredLog('WARN', message, context);
    
    // Use console.warn for WARN level - this appears prominently in wrangler logs
    console.warn(formatted);
    console.warn('[STRUCTURED]', JSON.stringify(structured));
  }

  static error(message: string, error?: any, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const errorDetails = error ? ` - ${error.message || error}` : '';
    const formatted = this.formatMessage('ERROR', message + errorDetails, context);
    const structured = this.structuredLog('ERROR', message + errorDetails, context);
    
    // Use console.error for ERROR level - this appears prominently in wrangler logs
    console.error(formatted);
    console.error('[STRUCTURED]', JSON.stringify(structured));
    
    if (error?.stack) {
      console.error('[STACK]', error.stack);
    }
  }

  static debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const formatted = this.formatMessage('DEBUG', message, context);
    const structured = this.structuredLog('DEBUG', message, context);
    
    // Use console.log for DEBUG level
    console.log(formatted);
    console.log('[STRUCTURED]', JSON.stringify(structured));
  }

  static timing(operation: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.info(`${operation} completed`, { ...context, duration });
  }

  /**
   * Request logging specifically designed for Cloudflare Workers
   */
  static logRequest(request: Request, response?: Response, context?: LogContext): void {
    if (!this.logRequestDetails) return;

    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Skip logging for health checks and very frequent requests in production
    const skipLogging = [
      '/health',
      '/auth/validate'
    ];
    
    if (this.logLevel > LogLevel.DEBUG && skipLogging.some(path => pathname === path)) {
      return;
    }
    
    const requestData = {
      method: request.method,
      url: pathname,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry'),
      ray: request.headers.get('CF-Ray'),
      status: response?.status,
      contentType: response?.headers.get('Content-Type')
    };

    this.info(`${request.method} ${pathname}`, {
      ...context,
      component: 'REQUEST',
      metadata: requestData
    });
  }

  /**
   * Performance logging for monitoring
   */
  static performance(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`PERF: ${metric} = ${value}${unit}`, {
      ...context,
      component: 'PERFORMANCE',
      metadata: { metric, value, unit }
    });
  }

  /**
   * Get current log level for external checks
   */
  static getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if request details logging is enabled
   */
  static isRequestLoggingEnabled(): boolean {
    return this.logRequestDetails;
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
      Logger.info(`${method} /sessions/${shortSessionId}/interact ${info}`, {
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