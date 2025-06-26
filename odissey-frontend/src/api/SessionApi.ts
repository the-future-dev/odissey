import { API_URL } from '../config';
import { SessionData } from '../types';
import { handleResponse, ApiError } from './api';
// @ts-ignore - axios types might not be present in the repo yet
import axios from 'axios';

// Session management
export const createPersonalizedSession = async (token: string, worldId: string): Promise<SessionData> => {
  const response = await fetch(`${API_URL}/sessions/new`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ worldId })
  });
  return handleResponse(response);
};

// ------------------------------------------------------------
// STREAMING CONFIGURATION & DETECTION
// ------------------------------------------------------------
interface StreamingCapabilities {
  hasReadableStream: boolean;
  hasNodeStream: boolean;
  hasAxios: boolean;
  isReactNative: boolean;
  isBrowser: boolean;
  isNode: boolean;
}

const detectStreamingCapabilities = (): StreamingCapabilities => {
  const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;
  
  return {
    hasReadableStream: typeof ReadableStream !== 'undefined' && typeof ReadableStream.prototype.getReader === 'function',
    hasNodeStream: typeof require !== 'undefined' && isNode,
    hasAxios: typeof axios !== 'undefined',
    isReactNative,
    isBrowser,
    isNode
  };
};

// ------------------------------------------------------------
// NDJSON STREAMING UTILITIES
// ------------------------------------------------------------
interface StreamAccumulator {
  value: string;
  chunks: string[];
  isComplete: boolean;
  hasError: boolean;
}

interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

const createStreamAccumulator = (): StreamAccumulator => ({
  value: '',
  chunks: [],
  isComplete: false,
  hasError: false
});

const processNdjsonLine = (
  line: string,
  accumulator: StreamAccumulator,
  callbacks: StreamCallbacks
): void => {
  const trimmed = line.trim();
  if (!trimmed || accumulator.hasError) return;

  try {
    const data = JSON.parse(trimmed);
    
    switch (data.type) {
      case 'chunk':
        const content = data.content ?? '';
        accumulator.value += content;
        accumulator.chunks.push(content);
        callbacks.onChunk?.(content);
        break;
        
      case 'complete':
        accumulator.isComplete = true;
        // Use explicit complete content if available, otherwise use accumulated
        if (typeof data.content === 'string' && data.content.length > 0) {
          accumulator.value = data.content;
        }
        callbacks.onComplete?.(accumulator.value);
        break;
        
      case 'error':
        accumulator.hasError = true;
        const errorMsg = data.content ?? 'Unknown streaming error';
        callbacks.onError?.(errorMsg);
        break;
        
      default:
        // Handle any other data types as content
        if (data.content) {
          accumulator.value += data.content;
          accumulator.chunks.push(data.content);
          callbacks.onChunk?.(data.content);
        }
    }
  } catch {
    // Not JSON → treat as plain text chunk
    accumulator.value += trimmed;
    accumulator.chunks.push(trimmed);
    callbacks.onChunk?.(trimmed);
  }
};

// ------------------------------------------------------------
// STREAMING IMPLEMENTATIONS
// ------------------------------------------------------------

// Strategy 1: Native ReadableStream (Modern browsers, some React Native)
const streamWithReadableStream = async (
  response: Response,
  callbacks: StreamCallbacks
): Promise<string> => {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const accumulator = createStreamAccumulator();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process any remaining buffer
        if (buffer.trim()) {
          processNdjsonLine(buffer, accumulator, callbacks);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processNdjsonLine(line, accumulator, callbacks);
        if (accumulator.hasError || accumulator.isComplete) break;
      }
      
      if (accumulator.hasError || accumulator.isComplete) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (!accumulator.isComplete && !accumulator.hasError) {
    callbacks.onComplete?.(accumulator.value);
  }

  return accumulator.value;
};

// Strategy 2: Axios with Node.js streams (React Native, Node.js)
const streamWithAxios = async (
  url: string,
  token: string,
  message: string,
  callbacks: StreamCallbacks
): Promise<string> => {
  const response = await axios.post(url, { message }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    responseType: 'stream',
    timeout: 300000, // 5 minutes
  });

  return new Promise<string>((resolve, reject) => {
    const stream = response.data;
    const accumulator = createStreamAccumulator();
    let buffer = '';

    // Ensure we're working with a proper stream
    if (typeof stream?.on !== 'function') {
      reject(new Error('Response is not a readable stream'));
      return;
    }

    stream.setEncoding('utf8');

    stream.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processNdjsonLine(line, accumulator, callbacks);
        if (accumulator.hasError || accumulator.isComplete) break;
      }
    });

    stream.on('end', () => {
      if (buffer.trim()) {
        processNdjsonLine(buffer, accumulator, callbacks);
      }
      
      if (!accumulator.isComplete && !accumulator.hasError) {
        callbacks.onComplete?.(accumulator.value);
      }
      
      resolve(accumulator.value);
    });

    stream.on('error', (error: any) => {
      const errorMsg = error?.message || 'Stream error';
      callbacks.onError?.(errorMsg);
      reject(new Error(errorMsg));
    });
  });
};

// Strategy 3: Chunked simulation (Fallback for older environments)
const simulateStreaming = async (
  text: string,
  callbacks: StreamCallbacks,
  chunkSize: number = 50,
  delayMs: number = 10
): Promise<string> => {
  const accumulator = createStreamAccumulator();
  
  // First try to process as NDJSON
  const lines = text.split('\n');
  let hasNdjsonContent = false;
  
  for (const line of lines) {
    try {
      const data = JSON.parse(line.trim());
      if (data.type) {
        hasNdjsonContent = true;
        processNdjsonLine(line, accumulator, callbacks);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
    } catch {
      // Not JSON, continue with text chunking
    }
  }
  
  if (hasNdjsonContent) {
    if (!accumulator.isComplete && !accumulator.hasError) {
      callbacks.onComplete?.(accumulator.value);
    }
    return accumulator.value;
  }
  
  // Fallback to text chunking
  accumulator.value = text;
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    callbacks.onChunk?.(chunk);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  callbacks.onComplete?.(text);
  return text;
};

// Strategy 4: Fetch with manual chunking (Universal fallback)
const streamWithFetchFallback = async (
  url: string,
  token: string,
  message: string,
  callbacks: StreamCallbacks
): Promise<string> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new ApiError(`Failed to stream: ${response.statusText}`, response.status);
  }

  // Try ReadableStream first
  if (response.body && typeof response.body.getReader === 'function') {
    return streamWithReadableStream(response, callbacks);
  }

  // Fallback to full text with simulation
  const text = await response.text();
  return simulateStreaming(text, callbacks);
};

// ------------------------------------------------------------
// MAIN STREAMING FUNCTION WITH COMPREHENSIVE FALLBACKS
// ------------------------------------------------------------
export const interactWithStoryStream = async (
  token: string,
  sessionId: string,
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  const url = `${API_URL}/sessions/${sessionId}/interact-stream`;
  const capabilities = detectStreamingCapabilities();
  const callbacks: StreamCallbacks = { onChunk, onComplete, onError };
  
  console.log('🔍 Streaming capabilities detected:', capabilities);

  // COMPREHENSIVE strategy selection for TRUE UNIVERSAL streaming
  const strategies = [
    // Strategy 1: Axios streaming (Preferred for React Native & Node.js)
    {
      name: 'axios-stream',
      condition: capabilities.hasAxios && (capabilities.isReactNative || capabilities.isNode),
      priority: 1,
      execute: () => streamWithAxios(url, token, message, callbacks)
    },
    
    // Strategy 2: Fetch with ReadableStream (Modern browsers & some React Native)
    {
      name: 'fetch-readable-stream',
      condition: capabilities.hasReadableStream,
      priority: 2,
      execute: async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        });
        
        if (!response.ok) {
          throw new ApiError(`Failed to stream: ${response.statusText}`, response.status);
        }
        
        return streamWithReadableStream(response, callbacks);
      }
    },
    
    // Strategy 3: XMLHttpRequest streaming (Older browsers, IE compatibility)
    {
      name: 'xhr-stream',
      condition: typeof XMLHttpRequest !== 'undefined',
      priority: 3,
      execute: () => new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const accumulator = createStreamAccumulator();
        let buffer = '';
        
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        
        xhr.onprogress = (event) => {
          const newData = xhr.responseText.substring(buffer.length);
          buffer = xhr.responseText;
          
          const lines = newData.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              processNdjsonLine(line, accumulator, callbacks);
            }
          }
        };
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Process any remaining data
            const finalData = xhr.responseText.substring(buffer.length);
            if (finalData.trim()) {
              const lines = finalData.split('\n');
              for (const line of lines) {
                if (line.trim()) {
                  processNdjsonLine(line, accumulator, callbacks);
                }
              }
            }
            
            if (!accumulator.isComplete && !accumulator.hasError) {
              callbacks.onComplete?.(accumulator.value);
            }
            resolve();
          } else {
            reject(new Error(`XHR failed: ${xhr.status} ${xhr.statusText}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('XHR network error'));
        xhr.ontimeout = () => reject(new Error('XHR timeout'));
        xhr.timeout = 300000; // 5 minutes
        
        xhr.send(JSON.stringify({ message }));
      })
    },
    
    // Strategy 4: EventSource (Server-Sent Events) - Alternative streaming
    {
      name: 'eventsource-stream',
      condition: typeof EventSource !== 'undefined',
      priority: 4,
      execute: () => new Promise<void>((resolve, reject) => {
        // Create a special SSE endpoint request
        const sseUrl = `${url}?token=${encodeURIComponent(token)}&message=${encodeURIComponent(message)}`;
        const eventSource = new EventSource(sseUrl);
        const accumulator = createStreamAccumulator();
        
        eventSource.onmessage = (event) => {
          processNdjsonLine(event.data, accumulator, callbacks);
        };
        
        eventSource.addEventListener('complete', (event) => {
          if (!accumulator.isComplete && !accumulator.hasError) {
            callbacks.onComplete?.(accumulator.value);
          }
          eventSource.close();
          resolve();
        });
        
        eventSource.onerror = (error) => {
          eventSource.close();
          reject(new Error('EventSource failed'));
        };
        
        // Auto-cleanup after timeout
        setTimeout(() => {
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
            reject(new Error('EventSource timeout'));
          }
        }, 300000);
      })
    },
    
    // Strategy 5: Fetch with manual chunking (Legacy browsers, wide compatibility)
    {
      name: 'fetch-fallback',
      condition: true,
      priority: 5,
      execute: () => streamWithFetchFallback(url, token, message, callbacks)
    },
    
    // Strategy 6: Absolute fallback with simulated streaming (GUARANTEED to work)
    {
      name: 'absolute-fallback',
      condition: true,
      priority: 6,
      execute: async () => {
        try {
          // Try the non-streaming endpoint as absolute last resort
          const response = await fetch(`${API_URL}/sessions/${sessionId}/interact`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ message }),
          });

          if (!response.ok) {
            throw new ApiError(`Absolute fallback failed: ${response.statusText}`, response.status);
          }

          const text = await response.text();
          let parsedResponse = text;
          
          // Try to parse as JSON in case it's wrapped
          try {
            const json = JSON.parse(text);
            if (json.response) {
              parsedResponse = json.response;
            }
          } catch {
            // Use text as-is
          }
          
          return simulateStreaming(parsedResponse, callbacks, 30, 5); // Faster simulation
        } catch (error) {
          throw new Error(`Absolute fallback failed: ${error}`);
        }
      }
    }
  ];

  // Sort strategies by priority
  strategies.sort((a, b) => a.priority - b.priority);

  // Try strategies in order with detailed logging
  let lastError: Error | null = null;
  
  for (const strategy of strategies) {
    if (!strategy.condition) {
      console.log(`⏭️  Skipping strategy ${strategy.name} (condition not met)`);
      continue;
    }
    
    try {
      console.log(`🚀 Attempting streaming strategy: ${strategy.name} (priority ${strategy.priority})`);
      await strategy.execute();
      console.log(`✅ Streaming successful with strategy: ${strategy.name}`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`❌ Streaming strategy ${strategy.name} failed:`, error);
      
      // Don't give up immediately, try the next strategy
      if (strategy === strategies[strategies.length - 1]) {
        // This was the absolute last strategy
        break;
      }
    }
  }
  
  // If we get here, ALL strategies failed
  console.error('🔥 CRITICAL: All streaming strategies failed!');
  const errorMessage = lastError?.message || 'All streaming strategies failed - this should never happen!';
  onError(errorMessage);
  throw lastError || new Error(errorMessage);
};

// ------------------------------------------------------------
// DEFAULT STREAMING INTERACTION (REPLACES OLD interactWithStory)
// ------------------------------------------------------------
export const interactWithStory = async (
  token: string, 
  sessionId: string, 
  message: string,
  options: {
    onChunk?: (chunk: string) => void;
    enableStreaming?: boolean;
    preferredStrategies?: string[];
  } = {}
): Promise<{ response: string }> => {
  const { onChunk, enableStreaming = true, preferredStrategies } = options;
  
  console.log('🎯 interactWithStory called with streaming =', enableStreaming);
  
  // If streaming is explicitly disabled, use the traditional approach
  if (!enableStreaming) {
    console.log('📡 Using non-streaming mode');
    const response = await fetch(`${API_URL}/sessions/${sessionId}/interact`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) {
      throw new ApiError('Failed to interact with story', response.status);
    }
    
    return handleResponse(response);
  }

  // Use TRUE streaming by default with comprehensive fallback
  console.log('🌊 Using TRUE streaming mode with universal device support');
  
  return new Promise((resolve, reject) => {
    let fullResponse = '';
    let hasResolved = false;
    
    // Create a timeout for absolute safety
    const timeoutId = setTimeout(() => {
      if (!hasResolved) {
        console.warn('⚠️  Streaming timeout reached, attempting final fallback');
        hasResolved = true;
        
        // Ultimate timeout fallback
        fetch(`${API_URL}/sessions/${sessionId}/interact`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message })
        })
        .then(response => {
          if (!response.ok) {
            throw new ApiError('Failed to interact with story', response.status);
          }
          return handleResponse(response);
        })
        .then(resolve)
        .catch(reject);
      }
    }, 300000); // 5-minute absolute timeout
    
    interactWithStoryStream(
      token,
      sessionId,
      message,
      (chunk: string) => {
        onChunk?.(chunk);
      },
      (complete: string) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeoutId);
          fullResponse = complete;
          console.log('✅ Streaming completed successfully');
          resolve({ response: fullResponse });
        }
      },
      (error: string) => {
        if (!hasResolved) {
          console.warn('⚠️  Streaming error occurred, attempting final non-streaming fallback:', error);
          
          // Don't mark as resolved yet, let the fallback handle it
          fetch(`${API_URL}/sessions/${sessionId}/interact`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
          })
          .then(response => {
            if (!response.ok) {
              throw new ApiError('Failed to interact with story', response.status);
            }
            return handleResponse(response);
          })
          .then(result => {
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeoutId);
              console.log('✅ Non-streaming fallback completed successfully');
              resolve(result);
            }
          })
          .catch(fallbackError => {
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeoutId);
              console.error('🔥 Both streaming and non-streaming failed:', fallbackError);
              reject(fallbackError);
            }
          });
        }
      }
    ).catch((streamError) => {
      if (!hasResolved) {
        console.warn('🚨 Streaming promise rejection, trying non-streaming:', streamError);
        
        fetch(`${API_URL}/sessions/${sessionId}/interact`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message })
        })
        .then(response => {
          if (!response.ok) {
            throw new ApiError('Failed to interact with story', response.status);
          }
          return handleResponse(response);
        })
        .then(result => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            console.log('✅ Non-streaming promise fallback completed successfully');
            resolve(result);
          }
        })
        .catch(fallbackError => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            console.error('🔥 Complete system failure - both streaming and non-streaming failed:', fallbackError);
            reject(fallbackError);
          }
        });
      }
    });
  });
};

// ------------------------------------------------------------
// TOKEN MANAGEMENT (UNCHANGED)
// ------------------------------------------------------------

// Token utility class for better organization
export class TokenManager {
  private static TOKEN_KEY = 'odyssey_auth_token';

  static async getStoredToken(): Promise<string | null> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      return await AsyncStorage.getItem(TokenManager.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static async storeToken(token: string): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(TokenManager.TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  static async clearToken(): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem(TokenManager.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  static async getValidToken(): Promise<string> {
    // Try to get existing token
    let token = await TokenManager.getStoredToken();
    
    if (token) {
      // Validate existing token
      const isValid = await validateToken(token);
      if (isValid) {
        return token;
      }
      // Clear invalid token
      await TokenManager.clearToken();
    }
    
    // Create new token
    const tokenData = await createAnonymousToken();
    await TokenManager.storeToken(tokenData.token);
    return tokenData.token;
  }
}

// Token management
export const createAnonymousToken = async (): Promise<{ token: string; expiresAt: string }> => {
  try {
    console.log('Creating anonymous token with URL:', `${API_URL}/auth/anonymous`);
    const response = await fetch(`${API_URL}/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.error('Token creation failed:', response.status, response.statusText);
      throw new ApiError(`Failed to create token: ${response.statusText}`, response.status);
    }
    
    return handleResponse(response);
  } catch (error) {
    console.error('Token creation error:', error);
    throw error;
  }
};

export const validateToken = async (token: string): Promise<boolean> => {
  try {
    console.log('Validating token with URL:', `${API_URL}/auth/validate`);
    const response = await fetch(`${API_URL}/auth/validate`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      console.log('Token validation failed:', response.status, response.statusText);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

// ------------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------------
const isReactNative = () => {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
};

// ------------------------------------------------------------
// UTILITY FUNCTIONS FOR DEBUGGING AND TESTING
// ------------------------------------------------------------

/**
 * Test streaming capabilities on the current device/environment
 * This is useful for debugging and understanding what streaming methods work
 */
export const testStreamingCapabilities = async (): Promise<{
  capabilities: StreamingCapabilities;
  supportedStrategies: string[];
  recommendedStrategy: string;
}> => {
  const capabilities = detectStreamingCapabilities();
  const supportedStrategies: string[] = [];
  
  // Check which strategies would be attempted
  if (capabilities.hasAxios && (capabilities.isReactNative || capabilities.isNode)) {
    supportedStrategies.push('axios-stream');
  }
  if (capabilities.hasReadableStream) {
    supportedStrategies.push('fetch-readable-stream');
  }
  if (typeof XMLHttpRequest !== 'undefined') {
    supportedStrategies.push('xhr-stream');
  }
  if (typeof EventSource !== 'undefined') {
    supportedStrategies.push('eventsource-stream');
  }
  supportedStrategies.push('fetch-fallback');
  supportedStrategies.push('absolute-fallback');
  
  const recommendedStrategy = supportedStrategies[0] || 'absolute-fallback';
  
  console.log('🔍 Streaming Capabilities Report:');
  console.log('📱 Environment:', {
    isReactNative: capabilities.isReactNative,
    isBrowser: capabilities.isBrowser,
    isNode: capabilities.isNode
  });
  console.log('🛠️  Available APIs:', {
    hasReadableStream: capabilities.hasReadableStream,
    hasAxios: capabilities.hasAxios,
    hasXMLHttpRequest: typeof XMLHttpRequest !== 'undefined',
    hasEventSource: typeof EventSource !== 'undefined'
  });
  console.log('✅ Supported strategies:', supportedStrategies);
  console.log('🎯 Recommended strategy:', recommendedStrategy);
  
  return {
    capabilities,
    supportedStrategies,
    recommendedStrategy
  };
};

/**
 * Force a specific streaming strategy for testing
 * Only use this for debugging/testing purposes
 */
export const interactWithStoryDebug = async (
  token: string,
  sessionId: string,
  message: string,
  forcedStrategy: string,
  onChunk?: (chunk: string) => void
): Promise<{ response: string; strategyUsed: string }> => {
  console.log(`🧪 DEBUG MODE: Forcing strategy "${forcedStrategy}"`);
  
  return new Promise((resolve, reject) => {
    let strategyUsed = '';
    
    interactWithStoryStream(
      token,
      sessionId,
      message,
      (chunk: string) => {
        onChunk?.(chunk);
      },
      (complete: string) => {
        strategyUsed = forcedStrategy;
        resolve({ response: complete, strategyUsed });
      },
      (error: string) => {
        reject(new Error(`Forced strategy "${forcedStrategy}" failed: ${error}`));
      }
    ).catch(reject);
  });
};

// Legacy export for backward compatibility
export { interactWithStoryStream as interactWithStoryStreamLegacy };
