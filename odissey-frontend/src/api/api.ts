import { API_URL } from '../config';

export { API_URL};

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleResponse = async (response: Response) => {
  if (!response.ok) {
    let errorText: string;
    try {
      errorText = await response.text();
    } catch {
      errorText = `HTTP ${response.status}: ${response.statusText}`;
    }
    
    console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
    throw new ApiError(errorText || 'Unknown error', response.status);
  }
  
  try {
    return await response.json();
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    throw new ApiError('Invalid JSON response');
  }
};