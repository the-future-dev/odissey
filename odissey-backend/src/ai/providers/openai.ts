import {
  AIProvider,
  AIModality,
  TextToTextRequest,
  TextToTextResponse,
  TextToAudioRequest,
  TextToAudioResponse,
  AudioToTextRequest,
  AudioToTextResponse,
  AIProviderError,
  UnsupportedModalityError
} from '../interfaces';

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly supportedModalities = [
    AIModality.TextToText,
    AIModality.TextToAudio,
    AIModality.AudioToText
  ];

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4';
  }

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, this.name);
    }

    try {
      const payload = {
        model: this.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 500,
        ...(request.stopSequences && { stop: request.stopSequences })
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(
          `OpenAI API error: ${errorText}`,
          this.name,
          AIModality.TextToText,
          response.status
        );
      }

      const data = await response.json() as any;
      
      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        model: data.model,
        finishReason: data.choices[0].finish_reason
      };

    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AIProviderError(
        `Failed to generate text: ${errorMessage}`,
        this.name,
        AIModality.TextToText
      );
    }
  }

  async generateAudio(request: TextToAudioRequest): Promise<TextToAudioResponse> {
    if (!this.supportedModalities.includes(AIModality.TextToAudio)) {
      throw new UnsupportedModalityError(AIModality.TextToAudio, this.name);
    }

    // Placeholder implementation - would integrate with OpenAI TTS API
    throw new AIProviderError(
      'OpenAI TTS integration not yet implemented',
      this.name,
      AIModality.TextToAudio
    );
  }

  async transcribeAudio(request: AudioToTextRequest): Promise<AudioToTextResponse> {
    if (!this.supportedModalities.includes(AIModality.AudioToText)) {
      throw new UnsupportedModalityError(AIModality.AudioToText, this.name);
    }

    // Placeholder implementation - would integrate with OpenAI Whisper API
    throw new AIProviderError(
      'OpenAI Whisper integration not yet implemented',
      this.name,
      AIModality.AudioToText
    );
  }
} 