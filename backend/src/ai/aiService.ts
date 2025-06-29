import {
  AIProvider,
  TextToTextRequest,
  TextToTextResponse,
} from './interfaces';

export class AIServiceManager {
  private provider: AIProvider | null = null;

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.provider) {
      throw new Error('No AI provider configured');
    }
    return await this.provider.generateText(request);
  }

  hasProvider(): boolean {
    return this.provider !== null;
  }

  getProviderName(): string {
    return this.provider?.name || 'none';
  }
} 