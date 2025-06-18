import { Message, Session, World } from './types';
import { AIServiceManager } from './ai/aiService';
import { SystemPromptService } from './story/systemPromptService';
import { AdaptivePromptService } from './story/adaptivePromptService';
import { TextToTextRequest } from './ai/interfaces';
import { DatabaseService } from './database';
import { Logger, createTimer, getElapsed } from './utils';

export interface WorldContext {
  world: World;
  characters: any[];
  locations: any[];
  items: any[];
  events: any[];
  themes: any[];
  loreEntries: any[];
}

export class StoryService {
  private aiService: AIServiceManager;
  private systemPromptService: SystemPromptService;
  private adaptivePromptService: AdaptivePromptService;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.adaptivePromptService = new AdaptivePromptService(aiService);
    this.systemPromptService = new SystemPromptService(this.adaptivePromptService);
    this.db = db;
    
    Logger.info('StoryService initialized (simplified)', {
      component: 'StoryService',
      operation: 'INIT'
    });
  }

  /**
   * Generate a streaming narrative response with comprehensive world context
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

    Logger.info('Starting simplified streaming story response', context);

    try {
      // Load all world context once at the beginning
      const worldContext = await this.loadWorldContext(world.id);
      
      // Generate dynamic system prompt based on story evolution
      const systemPrompt = await this.generateComprehensiveSystemPrompt(
        worldContext,
        recentMessages
      );

      // Build conversation messages for AI
      const messages = this.buildConversationMessages(
        systemPrompt,
        userMessage,
        recentMessages
      );

      // Generate streaming AI response with retry logic
      const aiRequest: TextToTextRequest = {
        messages,
        temperature: 0.6,
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
      
      Logger.timing('Simplified streaming response completed', timer, {
        ...context,
        metadata: {
          ...context.metadata,
          finalResponseLength: response.content.length
        }
      });
      
      return response.content;
    } catch (error) {
      Logger.error('Simplified streaming response failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Unable to generate story response. Please try again later.');
    }
  }

  /**
   * Load complete world context for comprehensive prompting
   */
  private async loadWorldContext(worldId: string): Promise<WorldContext> {
    const timer = createTimer();
    Logger.info('Loading complete world context', {
      component: 'StoryService',
      operation: 'LOAD_WORLD_CONTEXT',
      metadata: { worldId }
    });

    try {
      const [world, characters, locations, items, events, themes, loreEntries] = await Promise.all([
        this.db.getWorldById(worldId),
        this.db.getWorldCharacters(worldId),
        this.db.getWorldLocations(worldId),
        this.db.getWorldItems(worldId),
        this.db.getWorldEvents(worldId),
        this.db.getWorldThemes(worldId),
        this.db.getWorldLore(worldId)
      ]);

      if (!world) {
        throw new Error('World not found');
      }

      const context = {
        world,
        characters,
        locations,
        items,
        events,
        themes,
        loreEntries
      };

      Logger.timing('World context loaded', timer, {
        component: 'StoryService',
        operation: 'LOAD_WORLD_CONTEXT',
        metadata: {
          worldId,
          charactersCount: characters.length,
          locationsCount: locations.length,
          itemsCount: items.length,
          eventsCount: events.length,
          themesCount: themes.length,
          loreEntriesCount: loreEntries.length
        }
      });

      return context;
    } catch (error) {
      Logger.error('Failed to load world context', error, {
        component: 'StoryService',
        operation: 'LOAD_WORLD_CONTEXT',
        duration: getElapsed(timer),
        metadata: { worldId }
      });
      throw error;
    }
  }

  /**
   * Generate a dynamic system prompt that adapts to story evolution
   */
  private async generateComprehensiveSystemPrompt(
    worldContext: WorldContext,
    recentMessages: Message[]
  ): Promise<string> {
    const { world, characters, locations, items, events, themes, loreEntries } = worldContext;

    // Get dynamic system prompt from service
    const basePrompt = await this.systemPromptService.generateSystemPrompt({
      world,
      worldState: world.initial_state || '',
      recentMessages
    });

    // Build FOCUSED world information (much shorter to avoid overwhelming model)
    let worldInfo = '\n\n=== KEY WORLD ELEMENTS ===\n\n';

    // Key Characters (limit to 3 most important)
    if (characters.length > 0) {
      worldInfo += 'MAIN CHARACTERS:\n';
      const keyCharacters = characters.slice(0, 3); // Limit to first 3
      keyCharacters.forEach(char => {
        worldInfo += `- ${char.name} (${char.role}): ${char.description.substring(0, 100)}...\n`;
      });
      worldInfo += '\n';
    }

    // Key Locations (limit to 4 most important)
    if (locations.length > 0) {
      worldInfo += 'KEY LOCATIONS:\n';
      const keyLocations = locations.slice(0, 4); // Limit to first 4
      keyLocations.forEach(loc => {
        worldInfo += `- ${loc.name}: ${loc.description.substring(0, 120)}...\n`;
      });
      worldInfo += '\n';
    }

    // Important Items (limit to 3)
    if (items.length > 0) {
      worldInfo += 'NOTABLE ITEMS:\n';
      const keyItems = items.slice(0, 3); // Limit to first 3
      keyItems.forEach(item => {
        worldInfo += `- ${item.name}: ${item.description.substring(0, 80)}...\n`;
      });
      worldInfo += '\n';
    }

    // Current Themes
    if (themes.length > 0) {
      worldInfo += 'STORY THEMES:\n';
      themes.slice(0, 2).forEach(theme => { // Limit to 2 themes
        worldInfo += `- ${theme.name}: ${theme.description.substring(0, 100)}...\n`;
      });
      worldInfo += '\n';
    }

    worldInfo += '=== END WORLD ELEMENTS ===\n\n';

    worldInfo += 'INSTRUCTIONS: Create immersive, narrative responses that reference the world elements naturally. Focus on advancing the story and engaging the player. Keep responses vivid but concise.';

    return basePrompt + worldInfo;
  }

  private async generateStreamingWithRetry(
    request: TextToTextRequest, 
    maxRetries: number,
    context: any
  ): Promise<{ content: string }> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptTimer = createTimer();
      try {
        Logger.info(`AI streaming attempt ${attempt}/${maxRetries}`, {
          ...context,
          operation: 'AI_STREAMING_ATTEMPT',
          metadata: {
            ...context.metadata,
            attempt,
            maxRetries
          }
        });
        
        const response = await this.aiService.generateTextStream(request);
        
        // Validate response quality
        if (this.isValidResponse(response.content)) {
          Logger.timing(`AI streaming attempt ${attempt} succeeded`, attemptTimer, {
            ...context,
            metadata: {
              ...context.metadata,
              attempt,
              responseLength: response.content.length,
              success: true
            }
          });
          return response;
        } else {
          Logger.warn(`AI response failed validation`, {
            ...context,
            metadata: {
              ...context.metadata,
              attempt,
              responseLength: response.content.length,
              responseSample: response.content.substring(0, 100)
            }
          });
          throw new Error(`Generated response did not meet quality standards. Sample: "${response.content.substring(0, 100)}..."`);
        }
      } catch (error) {
        lastError = error as Error;
        Logger.warn(`AI streaming attempt ${attempt} failed`, {
          ...context,
          operation: 'AI_STREAMING_ATTEMPT_FAILED',
          duration: getElapsed(attemptTimer),
          metadata: {
            ...context.metadata,
            attempt,
            error: (error as Error)?.message || 'Unknown error'
          }
        });
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          Logger.info(`Waiting ${backoffMs}ms before streaming retry`, {
            ...context,
            metadata: { ...context.metadata, backoffMs }
          });
          await this.sleep(backoffMs);
        }
      }
    }
    
    Logger.error('All AI streaming attempts failed', lastError, {
      ...context,
      operation: 'AI_STREAMING_ALL_ATTEMPTS_FAILED',
      metadata: {
        ...context.metadata,
        totalAttempts: maxRetries
      }
    });
    throw lastError || new Error('All AI streaming attempts failed');
  }

  private isValidResponse(content: string): boolean {
    const trimmedContent = content.trim();
    
    // Basic length checks (more strict for quality)
    if (!trimmedContent || trimmedContent.length < 30 || trimmedContent.length > 2000) {
      return false;
    }
    
    // Check for obvious error indicators
    if (trimmedContent.includes('[ERROR]') || 
        trimmedContent.includes('503 Service Unavailable') ||
        trimmedContent.includes('Internal Server Error')) {
      return false;
    }
    
    // Check for garbled streaming indicators
    if (trimmedContent.includes('replacesWith') ||
        trimmedContent.includes('undefined') ||
        trimmedContent.includes('null') ||
        /^(of |with |and |the )/i.test(trimmedContent)) { // Starts with fragments
      return false;
    }
    
    // Check for meta-commentary that wasn't cleaned properly
    const problematicPatterns = [
      /^(Okay, so I|Let me think about|I need to)/i,
      /^The player (says|responds|chooses)/i,
      /^So now it's my job/i,
      /\*\*[^*]*\*\*.*\*\*[^*]*\*\*/i, // Multiple markdown formatting in one line (often indicates streaming issues)
    ];
    
    for (const pattern of problematicPatterns) {
      if (pattern.test(trimmedContent)) {
        return false;
      }
    }
    
    // Check for reasonable sentence structure
    const sentences = trimmedContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) {
      return false;
    }
    
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildConversationMessages(
    systemPrompt: string,
    userMessage: string,
    recentMessages: Message[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages = [];
    
    // Add comprehensive system prompt
    messages.push({
      role: 'system' as const,
      content: systemPrompt
    });

    // Add recent conversation history (last 6 messages for context)
    const relevantMessages = recentMessages.slice(-6);
    for (const message of relevantMessages) {
      messages.push({
        role: message.type === 'user' ? 'user' as const : 'assistant' as const,
        content: message.content
      });
    }

    // Add current user message
    messages.push({
      role: 'user' as const,
      content: userMessage
    });

    return messages;
  }

  /**
   * Simple world state update - just append the interaction
   */
  async updateWorldState(
    currentState: string,
    userMessage: string,
    narratorResponse: string
  ): Promise<string> {
    // TODO: the idea would be to summarize the key events with AI inference.
    /*
     * Perhaps a good workflow could be to wait for 2-3 interactions back and forth and then add a call to the LLM.
     * the core problem could be forgetting of details of previous interactions.
    */ 
    return currentState;
  }
} 