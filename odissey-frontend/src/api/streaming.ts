import { API_URL } from '../config';
import { ApiError } from './api';

/**
 * Streaming API for real-time story interactions
 */

interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

/**
 * Processes NDJSON streaming data line by line
 */
const processStreamLine = (line: string, callbacks: StreamCallbacks): string => {
  const trimmed = line.trim();
  if (!trimmed) return '';

  try {
    const data = JSON.parse(trimmed);
    
    switch (data.type) {
      case 'chunk':
        const content = data.content || '';
        callbacks.onChunk?.(content);
        return content;
        
      case 'complete':
        const completeContent = data.content || '';
        callbacks.onComplete?.(completeContent);
        return completeContent;
        
      case 'error':
        const errorMsg = data.content || 'Unknown streaming error';
        callbacks.onError?.(errorMsg);
        return '';
        
      default:
        // Handle other data types as content
        if (data.content) {
          callbacks.onChunk?.(data.content);
          return data.content;
        }
        return '';
    }
  } catch {
    // Not JSON - treat as plain text chunk
    callbacks.onChunk?.(trimmed);
    return trimmed;
  }
};

/**
 * Processes streaming response using ReadableStream
 */
const processStreamResponse = async (response: Response, callbacks: StreamCallbacks): Promise<void> => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          fullResponse += processStreamLine(buffer, callbacks);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        fullResponse += processStreamLine(line, callbacks);
      }
    }
  } finally {
    reader.releaseLock();
    
    // Ensure completion callback is called
    if (fullResponse && !fullResponse.includes('"type":"complete"')) {
      callbacks.onComplete?.(fullResponse);
    }
  }
};

/**
 * Fallback: processes text response as simulated stream
 */
const processTextAsStream = (text: string, callbacks: StreamCallbacks): void => {
  const lines = text.split('\n');
  let fullResponse = '';
  
  for (const line of lines) {
    fullResponse += processStreamLine(line, callbacks);
  }
  
  // Call completion if not already called
  if (!text.includes('"type":"complete"')) {
    callbacks.onComplete?.(fullResponse);
  }
};

/**
 * Main streaming function with automatic fallbacks
 */
export const interactWithStoryStream = async (
  token: string,
  sessionId: string,
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  const callbacks: StreamCallbacks = { onChunk, onComplete, onError };
  
  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/interact-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new ApiError(`Streaming failed: ${response.statusText}`, response.status);
    }

    // Use streaming if available, otherwise fallback to text
    if (response.body && typeof response.body.getReader === 'function') {
      await processStreamResponse(response, callbacks);
    } else {
      const text = await response.text();
      processTextAsStream(text, callbacks);
    }
  } catch (error) {
    console.error('Streaming failed:', error);
    onError(error instanceof Error ? error.message : 'Streaming failed');
  }
};

/**
 * Promise-based story interaction with streaming support
 */
export const interactWithStory = async (
  token: string, 
  sessionId: string, 
  message: string,
  options: {
    onChunk?: (chunk: string) => void;
    enableStreaming?: boolean;
  } = {}
): Promise<{ response: string }> => {
  const { onChunk, enableStreaming = true } = options;
  
  return new Promise((resolve, reject) => {
    let hasResolved = false;
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        reject(new Error('Request timeout after 60 seconds'));
      }
    }, 60000);
    
    const cleanup = () => {
      clearTimeout(timeoutId);
    };
    
    interactWithStoryStream(
      token,
      sessionId,
      message,
      onChunk || (() => {}),
      (fullResponse: string) => {
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          resolve({ response: fullResponse });
        }
      },
      (error: string) => {
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          reject(new Error(error));
        }
      }
    ).catch((streamError) => {
      if (!hasResolved) {
        hasResolved = true;
        cleanup();
        reject(streamError);
      }
    });
  });
}; 