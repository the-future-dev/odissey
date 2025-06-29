import { Message, World } from '../database/db-types';
import { StoryChapter } from './storyTypes';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger, createTimer, getElapsed } from '../utils';

export class Narrator {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Unified system prompt for both starting and continuing a chapter
   */
  private generateSystemPrompt(world: World, chapter: StoryChapter): string {
    return `You are the omniscient narrator of "${world.title}" and your objective is to shape the story of chapter "${chapter.title}".
Your main character is the user (you don't know how he will act).


Task: Describe the scene, advance the plot based on chapter context, and present exactly 3 meaningful choices for the player.
- Use simple worlds, a friendly tone and a simple phrase format.
- Narrate using the present tense. 
- Structure the full converstion with the user to gradually include:
 1. some space to introduct the scene setting and its characters - drift the user in scene and/or the situation.
 2. Then develop the scene plot. Dont make this plain make it interesting, and engaging: surprise!
 3. After the scene plot takes place shift towards conclusion of the scene
- Make the user gradually involved into the scene: build the conversation with a good peace but do not overwhelm the user with all new elements of the story at once - just one per interaction. 
- Shape each response to be interactive. Give the user 3 non-trivial options to interact with the scene and the events you present.

Format: Respond in 90-120 words and end with a markdown-formatted choice list as follows:
\`\`\`choice
1) Option A
2) Option B
3) Option C
\`\`\`
`;
  }

//   /**
//    * Start a new chapter with scene setting
//    */
//   async startChapter(
//     chapter: StoryChapter,
//     world: World
//   ): Promise<string> {
//     const timer = createTimer();
//     const context = {
//       component: 'Narrator',
//       operation: 'START_CHAPTER',
//       chapterId: chapter.id,
//       worldId: world.id
//     };

//     // Logger.info('Starting new chapter', context);

//     try {
//       const systemPrompt = this.generateSystemPrompt(world, chapter);
//       const assistantInit = `Introduce the chapter: 
// Context of the scene BEFORE THE INTERACTION:
// - Setting: ${chapter.setting}
// - Plot: ${chapter.plot}
// - Characters: ${chapter.character}
// - Theme: ${chapter.theme}
// - Conflict: ${chapter.conflict}
// - A priori outcome: ${chapter.outcome}`;
//       const userPrompt = "Let's start!!"

//       const aiRequest: TextToTextRequest = {
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'assistant', content: assistantInit },
//           { role: 'user', content: userPrompt }
//         ],
//         temperature: 0.1,
//         maxTokens: 3000
//       };

//       const response = await this.generateWithRetry(aiRequest, 3, context);
      
//       // Logger.info('Chapter started successfully', {
//       //   ...context,
//       //   duration: getElapsed(timer)
//       // });

//       return response.content;
//     } catch (error) {
//       Logger.error('Chapter start failed', error, {
//         ...context,
//         duration: getElapsed(timer)
//       });
//       throw new Error('Failed to start chapter');
//     }
//   }

  /**
   * Generate a narrative response within chapter constraints
   */
  async generateResponse(
    userMessage: string,
    currentChapter: StoryChapter,
    world: World,
    recentMessages: Message[]
  ): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'Narrator',
      operation: 'GENERATE_RESPONSE',
      chapterId: currentChapter.id,
      worldId: world.id,
      metadata: {
        messageLength: userMessage.length,
        historyCount: recentMessages.length
      }
    };

    Logger.info(`Narrator generating interaction with ${recentMessages.length} messages`, {
      component: 'Narrator',
      operation: 'GENERATE_RESPONSE',
      metadata: { 
        chapterId: currentChapter.id,
        messageCount: recentMessages.length 
      }
    });

    try {
      const systemPrompt = this.generateSystemPrompt(world, currentChapter);
      const messages = this.buildConversationMessages(
        systemPrompt,
        userMessage,
        recentMessages
      );

      const aiRequest: TextToTextRequest = {
        messages,
        temperature: 0.1,
        maxTokens: 2000
      };

      const response = await this.generateWithRetry(aiRequest, 3, context);
      
      // Logger.info('Response generated successfully', {
      //   ...context,
      //   duration: getElapsed(timer)
      // });

      return response.content;
    } catch (error) {
      Logger.error('Response generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Narrator service is temporarily unavailable');
    }
  }

  private buildConversationMessages(
    systemPrompt: string,
    userMessage: string,
    recentMessages: Message[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add 8 messages of conversation history
    const limitedMessages = recentMessages.slice(-8);
    for (const msg of limitedMessages) {
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

  private mapMessageTypeToRole(messageType: string): 'user' | 'assistant' {
    switch (messageType) {
      case 'user':
        return 'user';
      case 'narrator':
        return 'assistant';
      default:
        Logger.error('Unknown message type encountered', new Error(`Invalid message type: ${messageType}`), {
          component: 'Narrator',
          operation: 'MAP_MESSAGE_TYPE',
          metadata: { messageType }
        });
        throw new Error(`Unknown message type: ${messageType}. Expected 'user' or 'narrator'.`);
    }
  }

  private async generateWithRetry(
    request: TextToTextRequest, 
    maxRetries: number,
    context: any
  ): Promise<{ content: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Logger.info(`AI generation attempt ${attempt}/${maxRetries}`, {
        //   ...context,
        //   metadata: { ...context.metadata, attempt }
        // });
        
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 