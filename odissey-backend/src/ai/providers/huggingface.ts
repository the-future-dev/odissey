import {
  AIProvider,
  AIModality,
  TextToTextRequest,
  TextToTextResponse,
  AIProviderError,
  UnsupportedModalityError
} from '../interfaces';

export interface HuggingFaceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class HuggingFaceProvider implements AIProvider {
  readonly name = 'huggingface';
  readonly supportedModalities = [AIModality.TextToText];

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: HuggingFaceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api-inference.huggingface.co';
    this.model = config.model || 'mistralai/Mistral-7B-Instruct-v0.3';
  }

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, this.name);
    }

    try {
      // For Mistral models, we need to format as chat completion
      const messages = request.messages;
      const payload = {
        inputs: this.formatForMistral(messages),
        parameters: {
          max_new_tokens: request.maxTokens || 500,
          temperature: request.temperature || 0.7,
          do_sample: true,
          return_full_text: false,
          repetition_penalty: 1.1,
          ...(request.stopSequences && { stop: request.stopSequences })
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      };

      console.log(`Calling HuggingFace API with model: ${this.model}`);
      
      const response = await fetch(`${this.baseUrl}/models/${this.model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.text();
          console.error('HuggingFace API Error Response:', errorData);
          
          // Parse JSON error if possible
          try {
            const jsonError = JSON.parse(errorData);
            if (jsonError.error) {
              errorMessage = jsonError.error;
            }
          } catch {
            // Use text response if not JSON
            errorMessage = errorData || errorMessage;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }

        // Handle specific error cases
        if (response.status === 404) {
          errorMessage = `Model "${this.model}" not found or not available via Inference API. Try a different model.`;
        } else if (response.status === 401) {
          errorMessage = "Invalid or missing HuggingFace API key";
        } else if (response.status === 503) {
          errorMessage = "Model is currently loading, please retry in a few seconds";
        }

        throw new AIProviderError(
          `HuggingFace API error: ${errorMessage}`,
          this.name,
          AIModality.TextToText,
          response.status
        );
      }

      const data = await response.json() as any;
      console.log('HuggingFace API Response:', JSON.stringify(data, null, 2));
      
      // Handle different response formats
      let content: string;
      if (Array.isArray(data) && data.length > 0) {
        content = data[0].generated_text || '';
      } else if (data.generated_text) {
        content = data.generated_text;
      } else if (data[0] && data[0].generated_text) {
        content = data[0].generated_text;
      } else {
        console.error('Unexpected response format:', data);
        throw new AIProviderError(
          'Unexpected response format from HuggingFace',
          this.name,
          AIModality.TextToText
        );
      }

      return {
        content: this.cleanResponse(content.trim()),
        model: this.model,
        finishReason: 'stop'
      };

    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('HuggingFace Provider Error:', errorMessage, error);
      
      throw new AIProviderError(
        `Failed to generate text: ${errorMessage}`,
        this.name,
        AIModality.TextToText
      );
    }
  }

  async generateTextStream(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, this.name);
    }

    try {
      // HuggingFace Inference API doesn't support true streaming for most models
      // So we get the full response and then stream it at the provider level
      console.log(`HuggingFace: Generating full response then streaming for model: ${this.model}`);
      
      // Get the full response first using the regular generate method
      const fullResponse = await this.generateText({
        ...request,
        onChunk: undefined, // Remove the chunk callback for the full generation
        streaming: false
      });

      // Now stream the response word by word if onChunk is provided
      if (request.onChunk && fullResponse.content) {
        const words = fullResponse.content.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          // Simulate realistic AI typing speed
          await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 80));
          
          const chunk = i === 0 ? words[i] : ' ' + words[i];
          request.onChunk(chunk);
        }
      }

      return fullResponse;

    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('HuggingFace Streaming Provider Error:', errorMessage, error);
      
      throw new AIProviderError(
        `Failed to generate streaming text: ${errorMessage}`,
        this.name,
        AIModality.TextToText
      );
    }
  }

  private formatForMistral(messages: Array<{ role: string; content: string }>): string {
    // Format messages for Mistral Instruct model using the proper chat format
    let formatted = '';
    
    for (const message of messages) {
      switch (message.role) {
        case 'system':
          // Mistral doesn't have explicit system role, so incorporate into first user message
          formatted += `[INST] ${message.content}\n\n`;
          break;
        case 'user':
          if (formatted.includes('[INST]')) {
            // Continue existing instruction
            formatted += `${message.content} [/INST]`;
          } else {
            // Start new instruction
            formatted += `[INST] ${message.content} [/INST]`;
          }
          break;
        case 'assistant':
          formatted += ` ${message.content}</s>\n`;
          break;
      }
    }
    
    // If we didn't close the instruction, close it now
    if (formatted.includes('[INST]') && !formatted.includes('[/INST]')) {
      formatted += ' [/INST]';
    }
    
    return formatted;
  }

  private cleanResponse(rawResponse: string): string {
    // Remove the model's internal reasoning and extract only the story content
    let content = rawResponse.trim();
    
    // Look for patterns that indicate the start of actual story content
    const storyStartPatterns = [
      /As you step into/i,
      /You find yourself/i,
      /The adventure begins/i,
      /Your journey/i,
      /Standing at/i,
      /Walking through/i,
      /In front of you/i,
      /The path/i,
      /Suddenly/i
    ];
    
    // Try to find where the actual story starts
    for (const pattern of storyStartPatterns) {
      const match = content.match(pattern);
      if (match) {
        content = content.substring(content.indexOf(match[0]));
        break;
      }
    }
    
    // Remove any remaining thinking tags or meta-commentary
    content = content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^(Okay, so I|Let me think|I need to|I should|Now,|Wait,|So maybe)[\s\S]*?(?=As you|You find|The adventure|Your journey|Standing|Walking|In front|The path|Suddenly)/i, '')
      .replace(/\n\nEach choice$/i, '') // Remove incomplete endings
      .trim();
    
    // If we still have meta-commentary at the start, try to extract the story part
    const lines = content.split('\n');
    let storyStartIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0 && !line.match(/^(I |The player |So |Now |But |Another |In terms of|Probably)/i)) {
        storyStartIndex = i;
        break;
      }
    }
    
    content = lines.slice(storyStartIndex).join('\n').trim();
    
    return content;
  }
} 