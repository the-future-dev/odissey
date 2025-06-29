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
    
    Logger.info('StoryService', {
      component: 'StoryService',
      operation: 'INIT'
    });
  }

  /**
   * Generate a narrative response
   */
  async generateResponse(
    userMessage: string,
    session: Session,
    world: World,
    recentMessages: Message[]
  ): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'StoryService',
      operation: 'GENERATE_RESPONSE',
      sessionId: session.id,
      metadata: {
        worldId: world.id,
        messageLength: userMessage.length,
        historyCount: recentMessages.length
      }
    };

    Logger.info('Starting story response generation', context);

    try {
      // Generate dynamic system prompt
      const systemPrompt = this.generateSystemPrompt(world);

      // Build conversation messages for AI
      const messages = this.buildConversationMessages(
        systemPrompt,
        userMessage,
        recentMessages
      );

      // Generate AI response
      const aiRequest: TextToTextRequest = {
        messages,
        temperature: 0.1,
        maxTokens: 5000
      };

      const response = await this.generateWithRetry(aiRequest, 3, context);
      
      return response.content;
    } catch (error) {
      Logger.error('Response generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('AI service is temporarily unavailable. Please check your API configuration and try again.');
    }
  }

  /**
   * Generate a system prompt
   */
  private generateSystemPrompt(world: World): string {
    return `You are a narrator. Your objective is to shape the story "${world.title}", where the user is the main character.
You are the omniscient narrator: your objective is to shape the best story for the user. You only don't know how the user will act in your story!

WORLD DESCRIPTION:
${world.description || ''}

TASK - RESPONSE STRUCTURE REQUIREMENTS:
- 200-300 words per response
- Use simple worlds, a friendly tone and a simple phrase format.
- Structure each response to generally include:
  1. SCENE SETTING: describe the scene and/or the situation.
  2. EVENT: Something happening to get the user interested.
  3. CHOICES: Give 3 options the user can pick from.

FORMAT - at the end of the message use a numbered list with format:
\`\`\`choice
1) ... 
2) ... 
3) ... 
\`\`\``;
  }

  /**
   * Generate response with retry logic
   */
  private async generateWithRetry(
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

        return response;
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
   * Sleep utility
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

    // Add recent conversation history
    for (const msg of recentMessages) {
      const role = this.mapMessageTypeToRole(msg.type);
      messages.push({
        role,
        content: msg.content
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * Map database message types to AI role types with validation
   */
  private mapMessageTypeToRole(messageType: string): 'user' | 'assistant' {
    switch (messageType) {
      case 'user':
        return 'user';
      case 'narrator':
        return 'assistant';
      default:
        Logger.error('Unknown message type encountered', new Error(`Invalid message type: ${messageType}`), {
          component: 'StoryService',
          operation: 'MAP_MESSAGE_TYPE',
          metadata: {
            messageType
          }
        });
        throw new Error(`Unknown message type: ${messageType}. Expected 'user' or 'narrator'.`);
    }
  }
} 