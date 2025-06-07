// AI Provider interfaces for different modalities
export interface TextToTextRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  // Streaming support
  onChunk?: (chunk: string) => void;
  streaming?: boolean;
}

export interface TextToTextResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface TextToAudioRequest {
  text: string;
  voice?: string;
  speed?: number;
  format?: string;
}

export interface TextToAudioResponse {
  audioBuffer: ArrayBuffer;
  format: string;
  duration?: number;
}

export interface AudioToTextRequest {
  audioBuffer: ArrayBuffer;
  format: string;
  language?: string;
}

export interface AudioToTextResponse {
  text: string;
  confidence?: number;
  language?: string;
}

// Base AI Provider interface
export interface AIProvider {
  readonly name: string;
  readonly supportedModalities: AIModality[];
  
  // Text-to-Text
  generateText?(request: TextToTextRequest): Promise<TextToTextResponse>;
  
  // Streaming Text-to-Text
  generateTextStream?(request: TextToTextRequest): Promise<TextToTextResponse>;
  
  // Text-to-Audio (TTS)
  generateAudio?(request: TextToAudioRequest): Promise<TextToAudioResponse>;
  
  // Audio-to-Text (STT)
  transcribeAudio?(request: AudioToTextRequest): Promise<AudioToTextResponse>;
}

export enum AIModality {
  TextToText = 'text-to-text',
  TextToAudio = 'text-to-audio',
  AudioToText = 'audio-to-text'
}

// AI Service interface for managing providers
export interface AIService {
  registerProvider(provider: AIProvider): void;
  getProvider(name: string): AIProvider | undefined;
  getProviderForModality(modality: AIModality): AIProvider | undefined;
  
  // Convenience methods that route to appropriate providers
  generateText(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse>;
  generateAudio?(request: TextToAudioRequest, providerName?: string): Promise<TextToAudioResponse>;
  transcribeAudio?(request: AudioToTextRequest, providerName?: string): Promise<AudioToTextResponse>;
}

// Error types
export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public modality: AIModality,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class UnsupportedModalityError extends Error {
  constructor(modality: AIModality, provider: string) {
    super(`Provider ${provider} does not support ${modality}`);
    this.name = 'UnsupportedModalityError';
  }
} 