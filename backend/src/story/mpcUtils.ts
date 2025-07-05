import { Logger } from '../utils';

/**
 * Shared utilities for MPC Story Agents
 */

export interface LoggerContext {
  component: string;
  operation: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a logger context for MPC agents
 */
export function createLoggerContext(
  component: string, 
  operation: string, 
  sessionId?: string,
  metadata?: Record<string, any>
): LoggerContext {
  return {
    component,
    operation,
    sessionId,
    metadata
  };
}

/**
 * Extract JSON content from markdown-formatted AI responses
 */
export function extractJsonFromResponse(responseContent: string): any {
  const context = createLoggerContext('MPCUtils', 'EXTRACT_JSON');

  try {
    // First, try to parse directly (in case no markdown formatting)
    return JSON.parse(responseContent);
  } catch (directParseError) {
    Logger.debug('Direct JSON parse failed, attempting markdown extraction', {
      ...context,
      metadata: { responseLength: responseContent.length }
    });

    try {
      // Look for JSON wrapped in markdown code blocks
      const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        Logger.debug('Found JSON in markdown code block', {
          ...context,
          metadata: { extractedLength: jsonMatch[1].length }
        });
        return JSON.parse(jsonMatch[1]);
      }

      // Look for JSON array wrapped in markdown code blocks
      const arrayMatch = responseContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (arrayMatch && arrayMatch[1]) {
        Logger.debug('Found JSON array in markdown code block', {
          ...context,
          metadata: { extractedLength: arrayMatch[1].length }
        });
        return JSON.parse(arrayMatch[1]);
      }

      // Try to find JSON-like content without markdown wrapper
      const jsonObjectMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        Logger.debug('Found JSON object without markdown wrapper', {
          ...context,
          metadata: { extractedLength: jsonObjectMatch[0].length }
        });
        return JSON.parse(jsonObjectMatch[0]);
      }

      const jsonArrayMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        Logger.debug('Found JSON array without markdown wrapper', {
          ...context,
          metadata: { extractedLength: jsonArrayMatch[0].length }
        });
        return JSON.parse(jsonArrayMatch[0]);
      }

      Logger.error('No valid JSON found in response', new Error('JSON extraction failed'), {
        ...context,
        metadata: { 
          responsePreview: responseContent.substring(0, 200) + '...',
          responseLength: responseContent.length
        }
      });
      throw new Error('No valid JSON found in AI response');

    } catch (extractionError) {
      Logger.error('JSON extraction and parsing failed', extractionError, {
        ...context,
        metadata: { 
          originalError: directParseError instanceof Error ? directParseError.message : String(directParseError),
          responsePreview: responseContent.substring(0, 200) + '...',
          responseLength: responseContent.length
        }
      });
      throw new Error(`Failed to parse JSON from AI response: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
    }
  }
} 