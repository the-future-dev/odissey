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
import { Logger, createTimer, getElapsed } from '../utils';

export class AIServiceManager implements AIService {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string | null = null;

  constructor() {
    Logger.info('AIServiceManager initialized', {
      component: 'AIServiceManager',
      operation: 'INIT'
    });
  }

  registerProvider(provider: AIProvider): void {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'REGISTER_PROVIDER',
      metadata: {
        providerName: provider.name,
        supportedModalities: provider.supportedModalities,
        isFirstProvider: this.providers.size === 0
      }
    };

    Logger.info('Registering AI provider', logContext);

    this.providers.set(provider.name, provider);
    
    // Set as default if it's the first provider registered
    if (!this.defaultProvider) {
      this.defaultProvider = provider.name;
      Logger.info('Set as default provider', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          setAsDefault: true
        }
      });
    }

    Logger.timing('AI provider registered', timer, {
      ...logContext,
      metadata: {
        ...logContext.metadata,
        totalProviders: this.providers.size,
        defaultProvider: this.defaultProvider
      }
    });
  }

  getProvider(name: string): AIProvider | undefined {
    const provider = this.providers.get(name);
    Logger.debug('Provider lookup', {
      component: 'AIServiceManager',
      operation: 'GET_PROVIDER',
      metadata: {
        requestedProvider: name,
        found: !!provider,
        availableProviders: Array.from(this.providers.keys())
      }
    });
    return provider;
  }

  getProviderForModality(modality: AIModality): AIProvider | undefined {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'GET_PROVIDER_FOR_MODALITY',
      metadata: {
        requestedModality: modality,
        totalProviders: this.providers.size
      }
    };

    Logger.debug('Finding provider for modality', logContext);

    // Return the first provider that supports the modality
    for (const provider of this.providers.values()) {
      if (provider.supportedModalities.includes(modality)) {
        Logger.timing('Provider found for modality', timer, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            found: true
          }
        });
        return provider;
      }
    }

    Logger.timing('No provider found for modality', timer, {
      ...logContext,
      metadata: {
        ...logContext.metadata,
        found: false,
        availableProviders: Array.from(this.providers.keys()),
        providerModalities: Array.from(this.providers.values()).map(p => ({
          name: p.name,
          modalities: p.supportedModalities
        }))
      }
    });
    return undefined;
  }

  setDefaultProvider(name: string): void {
    const logContext = {
      component: 'AIServiceManager',
      operation: 'SET_DEFAULT_PROVIDER',
      metadata: {
        newDefaultProvider: name,
        oldDefaultProvider: this.defaultProvider,
        providerExists: this.providers.has(name)
      }
    };

    Logger.info('Setting default provider', logContext);

    if (!this.providers.has(name)) {
      const error = new Error(`Provider ${name} not registered`);
      Logger.error('Failed to set default provider - not registered', error, logContext);
      throw error;
    }
    
    this.defaultProvider = name;
    Logger.info('Default provider updated', {
      ...logContext,
      metadata: {
        ...logContext.metadata,
        success: true
      }
    });
  }

  getDefaultProvider(): AIProvider | undefined {
    const provider = this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined;
    Logger.debug('Default provider lookup', {
      component: 'AIServiceManager',
      operation: 'GET_DEFAULT_PROVIDER',
      metadata: {
        defaultProviderName: this.defaultProvider,
        found: !!provider
      }
    });
    return provider;
  }

  async generateText(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse> {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'GENERATE_TEXT',
      metadata: {
        requestedProvider: providerName,
        messagesCount: request.messages.length,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        hasStopSequences: !!request.stopSequences?.length,
        streaming: !!request.streaming
      }
    };

    Logger.info('Starting text generation', logContext);

    try {
      const provider = this.selectProvider(AIModality.TextToText, providerName);
      
      if (!provider.generateText) {
        const error = new UnsupportedModalityError(AIModality.TextToText, provider.name);
        Logger.error('Provider does not support text generation', error, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            supportedModalities: provider.supportedModalities
          }
        });
        throw error;
      }

      Logger.info('Selected provider for text generation', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          selectedProvider: provider.name
        }
      });

      const providerTimer = createTimer();
      const response = await provider.generateText(request);
      
      Logger.timing('Text generation completed', timer, {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          selectedProvider: provider.name,
          responseLength: response.content.length,
          providerDuration: getElapsed(providerTimer),
          model: response.model,
          finishReason: response.finishReason,
          usage: response.usage,
          success: true
        }
      });

      return response;
    } catch (error) {
      Logger.error('Text generation failed', error, {
        ...logContext,
        duration: getElapsed(timer)
      });
      throw error;
    }
  }

  async generateTextStream(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse> {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'GENERATE_TEXT_STREAM',
      metadata: {
        requestedProvider: providerName,
        messagesCount: request.messages.length,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        hasOnChunk: !!request.onChunk,
        hasStopSequences: !!request.stopSequences?.length
      }
    };

    Logger.info('Starting streaming text generation', logContext);

    try {
      const provider = this.selectProvider(AIModality.TextToText, providerName);
      
      // Prefer streaming method if available, otherwise fall back to regular generation
      if (provider.generateTextStream) {
        Logger.info('Using native streaming', {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            streamingMethod: 'native'
          }
        });

        const providerTimer = createTimer();
        const response = await provider.generateTextStream(request);
        
        Logger.timing('Streaming text generation completed', timer, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            responseLength: response.content.length,
            providerDuration: getElapsed(providerTimer),
            model: response.model,
            finishReason: response.finishReason,
            usage: response.usage,
            streamingMethod: 'native',
            success: true
          }
        });

        return response;
      } else if (provider.generateText) {
        Logger.info('Falling back to regular generation', {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            streamingMethod: 'fallback'
          }
        });

        // Fallback to regular generation if streaming is not supported
        const providerTimer = createTimer();
        const response = await provider.generateText(request);
        
        Logger.timing('Fallback text generation completed', timer, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            responseLength: response.content.length,
            providerDuration: getElapsed(providerTimer),
            model: response.model,
            finishReason: response.finishReason,
            usage: response.usage,
            streamingMethod: 'fallback',
            success: true
          }
        });

        return response;
      } else {
        const error = new UnsupportedModalityError(AIModality.TextToText, provider.name);
        Logger.error('Provider does not support text generation', error, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            supportedModalities: provider.supportedModalities
          }
        });
        throw error;
      }
    } catch (error) {
      Logger.error('Streaming text generation failed', error, {
        ...logContext,
        duration: getElapsed(timer)
      });
      throw error;
    }
  }

  async generateAudio(request: TextToAudioRequest, providerName?: string): Promise<TextToAudioResponse> {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'GENERATE_AUDIO',
      metadata: {
        requestedProvider: providerName,
        textLength: request.text.length,
        voice: request.voice,
        speed: request.speed,
        format: request.format
      }
    };

    Logger.info('Starting audio generation', logContext);

    try {
      const provider = this.selectProvider(AIModality.TextToAudio, providerName);
      
      if (!provider.generateAudio) {
        const error = new UnsupportedModalityError(AIModality.TextToAudio, provider.name);
        Logger.error('Provider does not support audio generation', error, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            supportedModalities: provider.supportedModalities
          }
        });
        throw error;
      }

      const providerTimer = createTimer();
      const response = await provider.generateAudio(request);
      
      Logger.timing('Audio generation completed', timer, {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          selectedProvider: provider.name,
          providerDuration: getElapsed(providerTimer),
          audioBufferSize: response.audioBuffer.byteLength,
          outputFormat: response.format,
          duration: response.duration,
          success: true
        }
      });

      return response;
    } catch (error) {
      Logger.error('Audio generation failed', error, {
        ...logContext,
        duration: getElapsed(timer)
      });
      throw error;
    }
  }

  async transcribeAudio(request: AudioToTextRequest, providerName?: string): Promise<AudioToTextResponse> {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'TRANSCRIBE_AUDIO',
      metadata: {
        requestedProvider: providerName,
        audioBufferSize: request.audioBuffer.byteLength,
        inputFormat: request.format,
        language: request.language
      }
    };

    Logger.info('Starting audio transcription', logContext);

    try {
      const provider = this.selectProvider(AIModality.AudioToText, providerName);
      
      if (!provider.transcribeAudio) {
        const error = new UnsupportedModalityError(AIModality.AudioToText, provider.name);
        Logger.error('Provider does not support audio transcription', error, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            selectedProvider: provider.name,
            supportedModalities: provider.supportedModalities
          }
        });
        throw error;
      }

      const providerTimer = createTimer();
      const response = await provider.transcribeAudio(request);
      
      Logger.timing('Audio transcription completed', timer, {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          selectedProvider: provider.name,
          providerDuration: getElapsed(providerTimer),
          transcribedTextLength: response.text.length,
          confidence: response.confidence,
          detectedLanguage: response.language,
          success: true
        }
      });

      return response;
    } catch (error) {
      Logger.error('Audio transcription failed', error, {
        ...logContext,
        duration: getElapsed(timer)
      });
      throw error;
    }
  }

  private selectProvider(modality: AIModality, providerName?: string): AIProvider {
    const timer = createTimer();
    const logContext = {
      component: 'AIServiceManager',
      operation: 'SELECT_PROVIDER',
      metadata: {
        modality,
        requestedProvider: providerName,
        totalProviders: this.providers.size,
        defaultProvider: this.defaultProvider
      }
    };

    Logger.debug('Selecting provider', logContext);

    let provider: AIProvider | undefined;

    if (providerName) {
      // Use specific provider if requested
      provider = this.getProvider(providerName);
      if (!provider) {
        const error = new AIProviderError(
          `Provider ${providerName} not found`,
          providerName,
          modality
        );
        Logger.error('Requested provider not found', error, {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            availableProviders: Array.from(this.providers.keys())
          }
        });
        throw error;
      }
    } else {
      // Use default provider or first available for modality
      provider = this.getDefaultProvider() || this.getProviderForModality(modality);
    }

    if (!provider) {
      const error = new AIProviderError(
        `No provider available for ${modality}`,
        'unknown',
        modality
      );
      Logger.error('No provider available for modality', error, {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          availableProviders: Array.from(this.providers.keys()),
          providersWithModality: Array.from(this.providers.values())
            .filter(p => p.supportedModalities.includes(modality))
            .map(p => p.name)
        }
      });
      throw error;
    }

    if (!provider.supportedModalities.includes(modality)) {
      const error = new UnsupportedModalityError(modality, provider.name);
      Logger.error('Selected provider does not support modality', error, {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          selectedProvider: provider.name,
          supportedModalities: provider.supportedModalities
        }
      });
      throw error;
    }

    Logger.timing('Provider selected', timer, {
      ...logContext,
      metadata: {
        ...logContext.metadata,
        selectedProvider: provider.name,
        selectionMethod: providerName ? 'explicit' : 'automatic',
        success: true
      }
    });

    return provider;
  }

  // Utility methods
  listProviders(): Array<{ name: string; supportedModalities: AIModality[] }> {
    const providers = Array.from(this.providers.values()).map(provider => ({
      name: provider.name,
      supportedModalities: provider.supportedModalities
    }));

    Logger.debug('Listed providers', {
      component: 'AIServiceManager',
      operation: 'LIST_PROVIDERS',
      metadata: {
        providersCount: providers.length,
        providers: providers
      }
    });

    return providers;
  }

  hasProvider(name: string): boolean {
    const exists = this.providers.has(name);
    Logger.debug('Provider existence check', {
      component: 'AIServiceManager',
      operation: 'HAS_PROVIDER',
      metadata: {
        providerName: name,
        exists
      }
    });
    return exists;
  }

  hasModalitySupport(modality: AIModality): boolean {
    const hasSupport = this.getProviderForModality(modality) !== undefined;
    Logger.debug('Modality support check', {
      component: 'AIServiceManager',
      operation: 'HAS_MODALITY_SUPPORT',
      metadata: {
        modality,
        hasSupport
      }
    });
    return hasSupport;
  }
} 