import { createErrorResponse } from './response';
import { Logger } from './logger';

/**
 * Standard authentication error types
 */
export const AUTH_ERRORS = {
  MISSING_HEADER: 'Missing authorization header',
  INVALID_TOKEN: 'Invalid or expired token',
  TOKEN_EXPIRED: 'Token expired',
  USER_NOT_FOUND: 'User not found'
} as const;

/**
 * Handle authentication errors consistently
 */
export function handleAuthError(error: Error, context?: any): Response {
  const message = error.message;
  
  if (message.includes('Missing authorization') || message === AUTH_ERRORS.MISSING_HEADER) {
    Logger.warn('Missing authorization header', context);
    return createErrorResponse(AUTH_ERRORS.MISSING_HEADER, 401, 'Unauthorized');
  }
  
  if (message.includes('Invalid or expired token') || message === AUTH_ERRORS.INVALID_TOKEN) {
    Logger.warn('Invalid or expired token', context);
    return createErrorResponse(AUTH_ERRORS.INVALID_TOKEN, 401, 'Unauthorized');
  }
  
  if (message.includes('Token expired') || message === AUTH_ERRORS.TOKEN_EXPIRED) {
    Logger.warn('Token expired', context);
    return createErrorResponse(AUTH_ERRORS.TOKEN_EXPIRED, 401, 'Unauthorized');
  }
  
  if (message.includes('User not found') || message === AUTH_ERRORS.USER_NOT_FOUND) {
    Logger.error('User not found for authenticated session', context);
    return createErrorResponse(AUTH_ERRORS.USER_NOT_FOUND, 401, 'Unauthorized');
  }
  
  // Fallback for unexpected auth errors
  Logger.error('Unexpected authentication error', error, context);
  return createErrorResponse('Authentication failed', 401, 'Unauthorized');
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: Error): boolean {
  const message = error.message;
  return message.includes('Missing authorization') ||
         message.includes('Invalid or expired token') ||
         message.includes('Token expired') ||
         message.includes('User not found');
}

/**
 * Handle generic server errors with consistent logging
 */
export function handleServerError(error: any, operation: string, context?: any): Response {
  Logger.error(`Error during ${operation}`, error, context);
  return createErrorResponse(`Failed to ${operation}`, 500);
}

/**
 * Handle validation errors
 */
export function handleValidationError(message: string, context?: any): Response {
  Logger.warn('Validation error', { ...context, metadata: { error: message } });
  return createErrorResponse(message, 400);
}

/**
 * Handle not found errors
 */
export function handleNotFoundError(resource: string, context?: any): Response {
  Logger.warn(`${resource} not found`, context);
  return createErrorResponse(`${resource} not found`, 404, 'Not Found');
}