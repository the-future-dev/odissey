import { Message, Session, World } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';

export class StoryService {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    Logger.info('StoryService initialized (simplified)', {
      component: 'StoryService',
      operation: 'INIT'
    });
  }

  /**
   * Generate a streaming narrative response
   */
  async generateStreamingResponse(
    userMessage: string,
    session: Session,
    world: World,
    recentMessages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'StoryService',
      operation: 'GENERATE_STREAMING',
      sessionId: session.id,
      metadata: {
        worldId: world.id,
        messageLength: userMessage.length,
        historyCount: recentMessages.length
      }
    };

    Logger.info('Starting streaming story response', context);

    try {
      // Generate dynamic system prompt
      const systemPrompt = this.generateSystemPrompt(world);

      // Build conversation messages for AI
      const messages = this.buildConversationMessages(
        systemPrompt,
        userMessage,
        recentMessages
      );

      // Generate streaming AI response
      const aiRequest: TextToTextRequest = {
        messages,
        temperature: 0.7,
        maxTokens: 500,
        onChunk: onChunk,
        streaming: true
      };

      const aiTimer = createTimer();
      Logger.info('Requesting streaming AI generation', {
        ...context,
        metadata: {
          ...context.metadata,
          messagesCount: messages.length,
          systemPromptLength: systemPrompt.length
        }
      });

      const response = await this.generateStreamingWithRetry(aiRequest, 3, context);
      
      Logger.timing('Streaming AI response completed', aiTimer, {
        ...context,
        metadata: {
          ...context.metadata,
          responseLength: response.content.length
        }
      });
      
      Logger.timing('Streaming response completed', timer, {
        ...context,
        metadata: {
          ...context.metadata,
          finalResponseLength: response.content.length
        }
      });
      
      return response.content;
    } catch (error) {
      Logger.error('Streaming response failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('AI service is temporarily unavailable. Please check your API configuration and try again.');
    }
  }

  /**
   * Generate a simple system prompt based on world information
   */
  private generateSystemPrompt(world: World): string {
    return `You are a storyteller guiding the user through the interactive adventure: "${world.title}".
The user is the protagonist of your story, while you are the omniscient narrator speaking directly to the reader as "you".
Omniscent with the limitation of not knowing what the user wants to do!

WORLD DESCRIPTION:
${world.description || ''}

TASK - RESPONSE STRUCTURE REQUIREMENTS:
- 200-300 words per response
- Use simple worlds, a friendly tone and be clear.
- Structure each response that generally include:
  1. SCENE SETTING: describe the scene and/or the situation.
  2. EVENT: Show something happening to get the user interested.
  3. CHOICES: Give 3 options the user can pick from.

  Use a numbered list with format:
  1) ... \n
  2) ... \n
  3) ... \n`;
  }

  /**
   * Generate streaming response with retry logic
   */
  private async generateStreamingWithRetry(
    request: TextToTextRequest, 
    maxRetries: number,
    context: any
  ): Promise<{ content: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.info(`AI generation attempt ${attempt}/${maxRetries}`, {
          ...context,
          metadata: { ...context.metadata, attempt }
        });

        const response = await this.aiService.generateText(request);
        
        if (this.isValidResponse(response.content)) {
          Logger.info(`AI generation successful on attempt ${attempt}`, {
            ...context,
            metadata: { 
              ...context.metadata, 
              attempt, 
              responseLength: response.content.length 
            }
          });
          return response;
        } else {
          throw new Error('Invalid response format received');
        }
      } catch (error) {
        lastError = error as Error;
        Logger.warn(`AI generation attempt ${attempt} failed`, {
          error: lastError.message,
          ...context,
          metadata: { ...context.metadata, attempt }
        });

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          Logger.info(`Retrying in ${delay}ms...`, {
            ...context,
            metadata: { ...context.metadata, attempt, retryDelay: delay }
          });
          await this.sleep(delay);
        }
      }
    }

    Logger.error(`All AI generation attempts failed`, lastError, {
      ...context,
      metadata: { ...context.metadata, maxRetries }
    });
    throw lastError || new Error('AI generation failed after retries');
  }

  /**
   * Validate AI response content
   */
  private isValidResponse(content: string): boolean {
    return !!content && 
           content.trim().length > 10 && 
           content.trim().length < 2000 &&
           !content.includes('[ERROR]') &&
           !content.includes('undefined');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build conversation messages for AI context
   */
  private buildConversationMessages(
    systemPrompt: string,
    userMessage: string,
    recentMessages: Message[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history (limit to last 8 messages to avoid token limits)
    const limitedHistory = recentMessages.slice(-8);
    for (const msg of limitedHistory) {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }


} 