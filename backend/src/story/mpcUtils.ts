import { Logger } from '../utils/logger';

/**
 * Shared utilities for MPC Story Agents
 */

/**
 * Extract JSON content from markdown-formatted AI responses
 */
export function extractJsonFromResponse(responseContent: string): any {

  try {
    // First, try to parse directly (in case no markdown formatting)
    return JSON.parse(responseContent);
  } catch (directParseError) {
    Logger.debug('Direct JSON parse failed, attempting markdown extraction');

    try {
      // Look for JSON wrapped in markdown code blocks
      const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        Logger.debug('Found JSON in markdown code block');
        return JSON.parse(jsonMatch[1]);
      }

      // Look for JSON array wrapped in markdown code blocks
      const arrayMatch = responseContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (arrayMatch && arrayMatch[1]) {
        Logger.debug('Found JSON array in markdown code block');
        return JSON.parse(arrayMatch[1]);
      }

      // Try to find JSON-like content without markdown wrapper
      const jsonObjectMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        Logger.debug('Found JSON object without markdown wrapper');
        return JSON.parse(jsonObjectMatch[0]);
      }

      const jsonArrayMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        Logger.debug('Found JSON array without markdown wrapper');
        return JSON.parse(jsonArrayMatch[0]);
      }

      Logger.error('No valid JSON found in response', new Error('JSON extraction failed'));
      throw new Error('No valid JSON found in AI response');

    } catch (extractionError) {
      Logger.error('JSON extraction and parsing failed', extractionError);
      throw new Error(`Failed to parse JSON from AI response: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
    }
  }
} 