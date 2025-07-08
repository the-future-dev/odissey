import { API_URL } from '../config';

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