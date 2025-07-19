import { API_URL } from '../config';
import { GoogleTokenManager } from './googleAuth';

export { API_URL };

/**
 * Custom API Error class for better error handling
 */
export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Standardized response handler for all API calls
 */
export const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    
    console.error(`API Error [${response.status}]:`, errorMessage);
    throw new ApiError(errorMessage, response.status);
  }
  
  try {
    return await response.json();
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    throw new ApiError('Invalid JSON response from server');
  }
};

/**
 * Enhanced API client with automatic token refresh
 */
export class ApiClient {
  private static instance: ApiClient;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
    config: RequestConfig;
  }> = [];

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Make an authenticated API request with automatic token refresh
   */
  async request<T = any>(config: RequestConfig): Promise<T> {
    try {
      return await this.makeRequest<T>(config);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Token might be expired, try to refresh
        return await this.handleTokenRefresh<T>(config);
      }
      throw error;
    }
  }

  /**
   * Handle token refresh and retry failed requests
   */
  private async handleTokenRefresh<T>(config: RequestConfig): Promise<T> {
    if (this.isRefreshing) {
      // Another request is already refreshing, queue this request
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject, config });
      });
    }

    this.isRefreshing = true;

    try {
      // Attempt to refresh the token
      const refreshed = await GoogleTokenManager.refreshTokenIfPossible();
      
      if (refreshed) {
        // Process the failed queue
        this.processQueue(null);
        
        // Retry the original request
        return await this.makeRequest<T>(config);
      } else {
        // Refresh failed, clear auth and reject all queued requests
        await GoogleTokenManager.clearAuth();
        this.processQueue(new ApiError('Authentication expired. Please login again.', 401));
        throw new ApiError('Authentication expired. Please login again.', 401);
      }
    } catch (error) {
      // Refresh failed, clear auth and reject all queued requests
      await GoogleTokenManager.clearAuth();
      this.processQueue(error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Process the queue of failed requests
   */
  private processQueue(error: any) {
    this.failedQueue.forEach(({ resolve, reject, config }) => {
      if (error) {
        reject(error);
      } else {
        resolve(this.makeRequest(config));
      }
    });
    
    this.failedQueue = [];
  }

  /**
   * Make the actual HTTP request
   */
  private async makeRequest<T>(config: RequestConfig): Promise<T> {
    const { url, method = 'GET', body, headers = {}, requiresAuth = true } = config;
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add authentication header if required
    if (requiresAuth) {
      const token = await GoogleTokenManager.getStoredToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      if (typeof body === 'string') {
        requestConfig.body = body;
      } else {
        requestConfig.body = JSON.stringify(body);
      }
    }

    const response = await fetch(`${API_URL}${url}`, requestConfig);
    return await handleResponse(response);
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'GET', ...config });
  }

  async post<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'POST', body, ...config });
  }

  async put<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'PUT', body, ...config });
  }

  async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'DELETE', ...config });
  }
}

export interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}

// Export singleton instance for convenience
export const apiClient = ApiClient.getInstance();