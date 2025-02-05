import { HF_API_TOKEN, NARRATOR_MODEL_NAME } from '../constants/ModelConstants';
import { HfInference } from '@huggingface/inference';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class Narrator {
  private messages: Message[];
  private maxTokens: number;
  private narratorInference: HfInference;

  constructor() {
    this.messages = [];
    this.maxTokens = 300;
    this.narratorInference = new HfInference(HF_API_TOKEN);
    
  }

  public setMessages(messages: Message[]): void {
    this.messages = messages.filter(msg => msg && msg.content);
  }

  public getMessages(): Message[] {
    return this.messages;
  }

  private async inferenceEndpoint(): Promise<AsyncGenerator<string>> {
    try {
      const stream = this.narratorInference.chatCompletionStream({
        model: NARRATOR_MODEL_NAME,
        messages: this.messages,
        max_tokens: this.maxTokens,
        // temperature: 0.1,
      });

      async function* generateText() {
        let text = '';
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0 && chunk.choices[0].delta.content) {
            text += chunk.choices[0].delta.content;
            yield text;
          }
        }
      }

      return generateText();
    } catch (error) {
      console.error("Error during inference:", error);
      async function* errorGenerator() {
        yield "Sorry, I couldn't generate a response.";
      }
      return errorGenerator();
    }
  }

  public async chat(): Promise<AsyncGenerator<string>> {
    return this.inferenceEndpoint();
  }
}

const narratorInstance = new Narrator();
export default narratorInstance;

