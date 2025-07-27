import { API_URL } from './api';
import { GoogleTokenManager } from './googleAuth';

export interface WorldGenerationResponse {
  success: boolean;
  audioData?: Blob;
  error?: string;
}

/**
 * World Generation API Service
 */
export class WorldGenerationAPI {
  /**
   * Send audio data to the world generation endpoint and receive audio response
   */
  static async interact(audioBlob: Blob): Promise<Blob> {
    try {
      // Convert blob to FormData or direct body
      const response = await fetch(`${API_URL}/world-generation/interact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await GoogleTokenManager.getStoredToken()}`,
          'Content-Type': 'audio/wav', // Set appropriate content type for audio
        },
        body: audioBlob,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Return the audio blob directly
      return await response.blob();
    } catch (error) {
      console.error('World Generation API Error:', error);
      throw error;
    }
  }
} 