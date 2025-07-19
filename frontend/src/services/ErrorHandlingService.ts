import { Platform } from 'react-native';
import { ApiError } from '../api/api';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ErrorDisplayInfo {
  title: string;
  message: string;
  actionable: boolean;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userFriendlyCode?: string;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    retryableErrors: [
      'Network request failed',
      'TypeError: Network request failed',
      'TypeError: Failed to fetch',
      'timeout',
      'NETWORK_ERROR',
      'CONNECTION_ERROR'
    ]
  };

  private constructor() {}

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Execute a function with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on last attempt or if error is not retryable
        if (attempt === retryConfig.maxRetries || !this.isRetryableError(lastError, retryConfig)) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
        console.warn(`Operation failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), retrying in ${delay}ms:`, lastError.message);
        
        await this.wait(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if an error should trigger a retry
   */
  private isRetryableError(error: Error, config: RetryConfig): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Check if error message contains any retryable error patterns
    const isRetryable = config.retryableErrors.some(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );

    // Don't retry authentication errors (401/403)
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return false;
    }

    // Don't retry client errors (400-499) except 408 (timeout) and 429 (rate limit)
    if (error instanceof ApiError && error.status) {
      if (error.status >= 400 && error.status < 500) {
        return error.status === 408 || error.status === 429;
      }
      // Retry server errors (500+)
      return error.status >= 500;
    }

    return isRetryable;
  }

  /**
   * Get user-friendly error information for display
   */
  getErrorDisplayInfo(error: Error | unknown): ErrorDisplayInfo {
    if (error instanceof ApiError) {
      return this.getApiErrorDisplayInfo(error);
    }

    if (error instanceof Error) {
      return this.getGenericErrorDisplayInfo(error);
    }

    return {
      title: 'Unexpected Error',
      message: 'An unexpected error occurred. Please try again.',
      actionable: true,
      retryable: true,
      severity: 'medium',
      userFriendlyCode: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Get display info for API errors
   */
  private getApiErrorDisplayInfo(error: ApiError): ErrorDisplayInfo {
    const status = error.status || 0;

    // Authentication errors
    if (status === 401) {
      return {
        title: 'Authentication Required',
        message: 'Your session has expired. Please sign in again to continue.',
        actionable: true,
        retryable: false,
        severity: 'high',
        userFriendlyCode: 'AUTH_EXPIRED'
      };
    }

    if (status === 403) {
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        actionable: false,
        retryable: false,
        severity: 'medium',
        userFriendlyCode: 'ACCESS_DENIED'
      };
    }

    // Client errors
    if (status >= 400 && status < 500) {
      const isRetryable = status === 408 || status === 429;
      return {
        title: 'Request Error',
        message: error.message || 'There was an issue with your request. Please check your input and try again.',
        actionable: true,
        retryable: isRetryable,
        severity: 'medium',
        userFriendlyCode: `CLIENT_ERROR_${status}`
      };
    }

    // Server errors
    if (status >= 500) {
      return {
        title: 'Server Error',
        message: 'Our servers are experiencing issues. Please try again in a few moments.',
        actionable: true,
        retryable: true,
        severity: 'high',
        userFriendlyCode: `SERVER_ERROR_${status}`
      };
    }

    // Unknown API error
    return {
      title: 'Connection Error',
      message: error.message || 'Unable to connect to our servers. Please check your internet connection and try again.',
      actionable: true,
      retryable: true,
      severity: 'medium',
      userFriendlyCode: 'CONNECTION_ERROR'
    };
  }

  /**
   * Get display info for generic errors
   */
  private getGenericErrorDisplayInfo(error: Error): ErrorDisplayInfo {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        title: 'Connection Problem',
        message: 'Please check your internet connection and try again.',
        actionable: true,
        retryable: true,
        severity: 'medium',
        userFriendlyCode: 'NETWORK_ERROR'
      };
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
        actionable: true,
        retryable: true,
        severity: 'medium',
        userFriendlyCode: 'TIMEOUT_ERROR'
      };
    }

    // JSON parsing errors
    if (message.includes('json') || message.includes('parse')) {
      return {
        title: 'Data Error',
        message: 'There was an issue processing the response. Please try again.',
        actionable: true,
        retryable: true,
        severity: 'medium',
        userFriendlyCode: 'DATA_ERROR'
      };
    }

    // Permission/security errors
    if (message.includes('permission') || message.includes('access') || message.includes('denied')) {
      return {
        title: 'Permission Error',
        message: 'You don\'t have permission to perform this action.',
        actionable: false,
        retryable: false,
        severity: 'medium',
        userFriendlyCode: 'PERMISSION_ERROR'
      };
    }

    // Generic error
    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      actionable: true,
      retryable: true,
      severity: 'medium',
      userFriendlyCode: 'GENERIC_ERROR'
    };
  }

  /**
   * Log error with appropriate level and context
   */
  logError(error: Error | unknown, context?: string, additionalInfo?: Record<string, any>) {
    const errorInfo = this.getErrorDisplayInfo(error);
    const logLevel = this.getLogLevel(errorInfo.severity);
    
    const logData = {
      error: error instanceof Error ? error.message : String(error),
      context,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      userFriendlyCode: errorInfo.userFriendlyCode,
      severity: errorInfo.severity,
      ...additionalInfo
    };

    if (logLevel === 'error') {
      console.error('Error:', logData);
    } else if (logLevel === 'warn') {
      console.warn('Warning:', logData);
    } else {
      console.log('Info:', logData);
    }

    // In a production app, you might want to send critical errors to a logging service
    if (errorInfo.severity === 'critical') {
      this.sendToAnalytics(logData);
    }
  }

  /**
   * Get appropriate log level for error severity
   */
  private getLogLevel(severity: string): 'error' | 'warn' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Send critical errors to analytics (placeholder for production implementation)
   */
  private sendToAnalytics(logData: any) {
    // In a real app, you would send this to Crashlytics, Sentry, etc.
    console.error('CRITICAL ERROR - would send to analytics:', logData);
  }

  /**
   * Handle authentication errors specifically
   */
  async handleAuthError(error: Error, retryCallback?: () => Promise<void>): Promise<boolean> {
    this.logError(error, 'authentication');

    if (error instanceof ApiError && error.status === 401) {
      // Clear authentication state
      try {
        const { GoogleTokenManager } = await import('../api/googleAuth');
        await GoogleTokenManager.clearAuth();
      } catch (clearError) {
        this.logError(clearError, 'auth_clear_failure');
      }

      // Try to retry if callback provided
      if (retryCallback) {
        try {
          await retryCallback();
          return true;
        } catch (retryError) {
          this.logError(retryError, 'auth_retry_failure');
        }
      }
    }

    return false;
  }

  /**
   * Wait for specified duration
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a wrapped version of an async function with error handling
   */
  wrapWithErrorHandling<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string,
    retryConfig?: Partial<RetryConfig>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await this.executeWithRetry(() => fn(...args), retryConfig);
      } catch (error) {
        this.logError(error, context);
        throw error;
      }
    };
  }
}

export default ErrorHandlingService; 