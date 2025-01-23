
import { HF_API_TOKEN_READ, NARRATOR_MODEL_NAME } from '../constants/Models';
import { HfInference } from '@huggingface/inference';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class Narrator {
  private messages: Message[];
  private maxTokens: number;
  private apiKey: string;
  private narratorInference: HfInference;

  constructor(apiKey: string, maxTokens: number) {
    this.messages = [];
    this.maxTokens = maxTokens;
    this.apiKey = apiKey;
    this.narratorInference = new HfInference(apiKey);
  }

  public setMessages(messages: Message[]): void {
    this.messages = messages;
  }

  private async inferenceEndpoint(): Promise<string> {
    try {
      const response = await this.narratorInference.chatCompletion({
        model: NARRATOR_MODEL_NAME,
        messages: this.messages,
        max_tokens: this.maxTokens,
        stream: false,
      });
      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("Error during inference:", error);
      return "Sorry, I couldn't generate a response.";
    }
  }

  public async chat(): Promise<string> {
    return this.inferenceEndpoint();
  }
}

const narratorInstance = new Narrator(HF_API_TOKEN_READ, 300);
export default narratorInstance;

