import { Message, Session, World } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';

interface StoryChapter {
  id: string;
  title: string;
  description?: string;
  setting?: string;
  plot?: string;
  characters?: string[];
  worldId: string;
}

export class StoryService {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    // StoryService initialized
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

    // Starting story response generation
    Logger.info(`StoryService generating interaction with ${recentMessages.length} messages`, {
      component: 'StoryService',
      operation: 'GENERATE_RESPONSE',
      sessionId: session.id,
      metadata: { messageCount: recentMessages.length }
    });

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
   * Generate a narrative response within a specific chapter context
   */
  async generateResponseInChapter(
    userMessage: string,
    session: Session,
    world: World,
    chapter: StoryChapter,
    recentMessages: Message[]
  ): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'StoryService',
      operation: 'GENERATE_RESPONSE_IN_CHAPTER',
      sessionId: session.id,
      metadata: {
        worldId: world.id,
        chapterId: chapter.id,
        messageLength: userMessage.length,
        historyCount: recentMessages.length
      }
    };

    // Starting chapter-based story response generation
    Logger.info(`StoryService generating chapter-based interaction with ${recentMessages.length} messages`, {
      component: 'StoryService',
      operation: 'GENERATE_RESPONSE_IN_CHAPTER',
      sessionId: session.id,
      metadata: { 
        messageCount: recentMessages.length,
        chapterId: chapter.id,
        chapterTitle: chapter.title
      }
    });

    try {
      // Generate dynamic system prompt with chapter context
      const systemPrompt = this.generateChapterSystemPrompt(world, chapter);

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
      Logger.error('Chapter-based response generation failed', error, {
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
   * Generate a system prompt with chapter context
   */
  private generateChapterSystemPrompt(world: World, chapter: StoryChapter): string {
    return `You are a narrator. Your objective is to shape the story "${world.title}", where the user is the main character.
You are the omniscient narrator: your objective is to shape the best story for the user. You only don't know how the user will act in your story!

WORLD DESCRIPTION:
${world.description || ''}

CHAPTER CONTEXT:
Title: ${chapter.title}
${chapter.description ? `Description: ${chapter.description}` : ''}
${chapter.setting ? `Setting: ${chapter.setting}` : ''}
${chapter.plot ? `Plot Elements: ${chapter.plot}` : ''}
${chapter.characters && chapter.characters.length > 0 ? `Key Characters: ${chapter.characters.join(', ')}` : ''}

TASK - RESPONSE STRUCTURE REQUIREMENTS:
- 200-300 words per response
- Use simple worlds, a friendly tone and a simple phrase format.
- Incorporate the chapter's setting, plot elements, and characters naturally into the narrative
- Add new elements of the narration gradually - NOT ALL AT ONCE
- Structure each response to generally include:
  1. SCENE SETTING: describe the scene and/or the situation, incorporating chapter context.
  2. EVENT: Something happening to get the user interested, related to the chapter's plot.
  3. CHOICES: Give 3 options the user can pick from, considering the chapter's context.

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
        // AI generation attempt
        
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
          // Retrying generation
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