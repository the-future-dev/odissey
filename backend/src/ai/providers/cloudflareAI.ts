import {
  AIModality,
  SupportsSpeechToText,
  SupportsTextToSpeech,
  AIProviderError,
} from '../interfaces';

export interface CloudflareAIConfig {
  apiToken: string;
  accountId: string;
  baseUrl?: string;
}

import { Logger } from '../../utils/logger';
export class CloudflareAIProvider implements SupportsSpeechToText, SupportsTextToSpeech {
  readonly name = 'cloudflare';
  readonly supportedModalities = [AIModality.SpeechToText, AIModality.TextToSpeech];

  private config: CloudflareAIConfig;
  private baseUrl: string;

  constructor(config: CloudflareAIConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run`;
  }

  /**
   * Transcribes audio using the Cloudflare Whisper API.
   * The API expects the raw audio file in the body, not JSON.
   */
  async transcribeAudio(audio: Blob | ArrayBuffer): Promise<{ text: string }> {
    // Note: Using the base 'whisper' model for broad compatibility.
    const url = `${this.baseUrl}/@cf/openai/whisper-large-v3-turbo`;
    try {
      // Convert audio to base64 string
      let base64Audio: string;
      let uint8Array: Uint8Array;
      if (audio instanceof Blob) {
        uint8Array = new Uint8Array(await audio.arrayBuffer());
      } else if (audio instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(audio);
      } else {
        throw new AIProviderError('Unsupported audio type for transcription', this.name);
      }
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      base64Audio = btoa(binary);

      // Prepare request body
      const requestBody: any = {
        audio: base64Audio,
        task: 'transcribe',
        language: 'en',
        // You can add language, vad_filter, initial_prompt, prefix if needed
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(`Cloudflare Whisper API error: ${errorText}`, this.name, { status: response.status });
      }

      const data = await response.json() as { result?: { text?: string } };
      if (!data.result || !data.result.text) {
        throw new AIProviderError('Invalid or empty transcription response from Cloudflare', this.name, data);
      }
      return { text: data.result.text };
    } catch (err) {
      console.error('[CloudflareAIProvider] Transcription error:', err);
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError('Speech transcription failed', this.name, err);
    }
  }

  /**
   * Synthesizes speech using a Cloudflare TTS model.
   * The API expects JSON input and returns a raw audio file.
   */
  async synthesizeSpeech(text: string): Promise<Blob> {
    // Note: Using a standard Meta model. You can swap this for others like '@cf/microsoft/speecht5-tts'.
    const url = `${this.baseUrl}/@cf/myshell-ai/melotts`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text,
          lang: "en"
        }),
      });

      // Check for error response
      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(`Cloudflare TTS API error: ${errorText}`, this.name, { status: response.status });
      }

      // Handle JSON (base64-encoded audio) or raw audio
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json() as { result?: { audio?: string } };
        if (!data.result || !data.result.audio) {
          throw new AIProviderError('Cloudflare TTS API returned JSON without audio field', this.name, data);
        }
        const base64Audio = data.result.audio;
        const binaryString = atob(base64Audio);
        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          byteArray[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([byteArray], { type: 'audio/wav' });
        if (audioBlob.size === 0) {
          throw new AIProviderError('Received empty audio blob from Cloudflare TTS API (base64)', this.name);
        }
        return audioBlob;
      }
      // Otherwise, return raw audio blob
      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        throw new AIProviderError('Received empty audio blob from Cloudflare TTS API', this.name);
      }
      return audioBlob;
    } catch (err) {
      console.error('[CloudflareAIProvider] Text-to-speech error:', err);
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError('Text-to-speech synthesis failed', this.name, err);
    }
  }
}