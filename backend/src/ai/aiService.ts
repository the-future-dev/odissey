import {
  AIModality,
  TextToTextRequest,
  TextToTextResponse,
  AIProvider,
  SupportsTextToText,
  UnsupportedModalityError,
  AIProviderError,
} from './interfaces';

export class AIServiceManager {
  private providers = new Map<string, AIProvider>();
  private defaultProviderName: string | null = null;

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} is not registered`);
    }
    this.defaultProviderName = name;
  }

  private getProvider(name?: string): AIProvider {
    const provider = name
      ? this.providers.get(name)
      : this.defaultProviderName
      ? this.providers.get(this.defaultProviderName)
      : null;

    if (!provider) {
      throw new Error('No provider configured or found');
    }

    return provider;
  }

  async generateText(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse> {
    const provider = this.getProvider(providerName);

    if (!provider.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, provider.name);
    }

    const textProvider = provider as SupportsTextToText;

    try {
      return await textProvider.generateText(request);
    } catch (error) {
      throw new AIProviderError('Text generation failed', provider.name, error);
    }
  }

  listProviders(): Array<{ name: string; supportedModalities: AIModality[] }> {
    return [...this.providers.values()].map(({ name, supportedModalities }) => ({
      name,
      supportedModalities
    }));
  }
}