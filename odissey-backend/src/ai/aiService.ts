import {
  AIService,
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
} from './interfaces';

export class AIServiceManager implements AIService {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string | null = null;

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    
    // Set as default if it's the first provider registered
    if (!this.defaultProvider) {
      this.defaultProvider = provider.name;
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getProviderForModality(modality: AIModality): AIProvider | undefined {
    // Return the first provider that supports the modality
    for (const provider of this.providers.values()) {
      if (provider.supportedModalities.includes(modality)) {
        return provider;
      }
    }
    return undefined;
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not registered`);
    }
    this.defaultProvider = name;
  }

  getDefaultProvider(): AIProvider | undefined {
    return this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined;
  }

  async generateText(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse> {
    const provider = this.selectProvider(AIModality.TextToText, providerName);
    
    if (!provider.generateText) {
      throw new UnsupportedModalityError(AIModality.TextToText, provider.name);
    }

    return await provider.generateText(request);
  }

  async generateTextStream(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse> {
    const provider = this.selectProvider(AIModality.TextToText, providerName);
    
    // Prefer streaming method if available, otherwise fall back to regular generation
    if (provider.generateTextStream) {
      return await provider.generateTextStream(request);
    } else if (provider.generateText) {
      // Fallback to regular generation if streaming is not supported
      return await provider.generateText(request);
    } else {
      throw new UnsupportedModalityError(AIModality.TextToText, provider.name);
    }
  }

  async generateAudio(request: TextToAudioRequest, providerName?: string): Promise<TextToAudioResponse> {
    const provider = this.selectProvider(AIModality.TextToAudio, providerName);
    
    if (!provider.generateAudio) {
      throw new UnsupportedModalityError(AIModality.TextToAudio, provider.name);
    }

    return await provider.generateAudio(request);
  }

  async transcribeAudio(request: AudioToTextRequest, providerName?: string): Promise<AudioToTextResponse> {
    const provider = this.selectProvider(AIModality.AudioToText, providerName);
    
    if (!provider.transcribeAudio) {
      throw new UnsupportedModalityError(AIModality.AudioToText, provider.name);
    }

    return await provider.transcribeAudio(request);
  }

  private selectProvider(modality: AIModality, providerName?: string): AIProvider {
    let provider: AIProvider | undefined;

    if (providerName) {
      // Use specific provider if requested
      provider = this.getProvider(providerName);
      if (!provider) {
        throw new AIProviderError(
          `Provider ${providerName} not found`,
          providerName,
          modality
        );
      }
    } else {
      // Use default provider or first available for modality
      provider = this.getDefaultProvider() || this.getProviderForModality(modality);
    }

    if (!provider) {
      throw new AIProviderError(
        `No provider available for ${modality}`,
        'unknown',
        modality
      );
    }

    if (!provider.supportedModalities.includes(modality)) {
      throw new UnsupportedModalityError(modality, provider.name);
    }

    return provider;
  }

  // Utility methods
  listProviders(): Array<{ name: string; supportedModalities: AIModality[] }> {
    return Array.from(this.providers.values()).map(provider => ({
      name: provider.name,
      supportedModalities: provider.supportedModalities
    }));
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  hasModalitySupport(modality: AIModality): boolean {
    return this.getProviderForModality(modality) !== undefined;
  }
} 