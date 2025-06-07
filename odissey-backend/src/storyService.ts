import { Message, Session, World } from './types';
import { AIServiceManager } from './ai/aiService';
import { SystemPromptService } from './prompts/systemPromptService';
import { TextToTextRequest } from './ai/interfaces';

export class StoryService {
  private aiService: AIServiceManager;
  private systemPromptService: SystemPromptService;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
    this.systemPromptService = new SystemPromptService();
  }

  /**
   * Generate a narrative response based on user input and session context
   */
  async generateResponse(
    userMessage: string,
    session: Session,
    world: World,
    recentMessages: Message[]
  ): Promise<string> {
    // Generate system prompt based on world and context
    const systemPrompt = this.systemPromptService.generateSystemPrompt({
      world,
      worldState: session.world_state || world.initial_state || '',
      recentMessages
    });

    // Build conversation messages for AI
    const messages = this.buildConversationMessages(
      systemPrompt,
      userMessage,
      recentMessages
    );

    // Generate AI response with retry logic
    const aiRequest: TextToTextRequest = {
      messages,
      temperature: 0.6, // Reduced temperature for more focused storytelling
      maxTokens: 500    // Reduced tokens to prevent rambling
    };

    try {
      const response = await this.generateWithRetry(aiRequest, 3);
      return response.content;
    } catch (error) {
      console.error('AI generation failed after retries:', error);
      throw new Error('Unable to generate story response. Please try again later.');
    }
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
    // Generate system prompt based on world and context
    const systemPrompt = this.systemPromptService.generateSystemPrompt({
      world,
      worldState: session.world_state || world.initial_state || '',
      recentMessages
    });

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

    try {
      const response = await this.generateStreamingWithRetry(aiRequest, 3);
      return response.content;
    } catch (error) {
      console.error('AI streaming generation failed after retries:', error);
      throw new Error('Unable to generate story response. Please try again later.');
    }
  }

  private async generateWithRetry(
    request: TextToTextRequest, 
    maxRetries: number
  ): Promise<{ content: string }> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`AI generation attempt ${attempt}/${maxRetries}`);
        const response = await this.aiService.generateText(request);
        
        // Validate response quality
        if (this.isValidResponse(response.content)) {
          return response;
        } else {
          throw new Error('Generated response did not meet quality standards');
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`AI generation attempt ${attempt} failed:`, error);
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError!;
  }

  private async generateStreamingWithRetry(
    request: TextToTextRequest, 
    maxRetries: number
  ): Promise<{ content: string }> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`AI streaming generation attempt ${attempt}/${maxRetries}`);
        const response = await this.aiService.generateTextStream(request);
        
        // Validate response quality
        if (this.isValidResponse(response.content)) {
          return response;
        } else {
          throw new Error('Generated response did not meet quality standards');
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`AI streaming generation attempt ${attempt} failed:`, error);
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError!;
  }

  private isValidResponse(content: string): boolean {
    // Ensure the response meets minimum quality standards for story content
    const trimmedContent = content.trim();
    
    // Basic length checks
    if (!trimmedContent || trimmedContent.length < 20 || trimmedContent.length > 2000) {
      return false;
    }
    
    // Check for obvious error indicators
    if (trimmedContent.includes('[ERROR]') || 
        trimmedContent.includes('503 Service Unavailable') ||
        trimmedContent.includes('Internal Server Error')) {
      return false;
    }
    
    // Check for meta-commentary that wasn't cleaned properly
    const problematicPatterns = [
      /^(Okay, so I|Let me think about|I need to)/i,
      /^The player (says|responds|chooses)/i,
      /^So now it's my job/i
    ];
    
    for (const pattern of problematicPatterns) {
      if (pattern.test(trimmedContent)) {
        return false;
      }
    }
    
    // Check that it contains narrative content (not just thinking)
    const narrativeIndicators = [
      /\b(you|your)\b/i,  // Second person narrative
      /\b(step|walk|see|hear|find|notice|feel)\b/i,  // Action verbs
      /\b(path|forest|door|room|light|sound)\b/i,  // Story elements
    ];
    
    const hasNarrative = narrativeIndicators.some(pattern => pattern.test(trimmedContent));
    
    return hasNarrative;
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
    
    // Add system prompt
    messages.push({
      role: 'system' as const,
      content: systemPrompt
    });

    // Add recent conversation history (last 8 messages for better context)
    const relevantMessages = recentMessages.slice(-8);
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
   * Update the world state based on the conversation using AI analysis
   */
  async updateWorldState(
    currentState: string,
    userMessage: string,
    narratorResponse: string
  ): Promise<string> {
    try {
      // Use AI to intelligently update world state
      const stateUpdatePrompt = {
        messages: [
          {
            role: 'system' as const,
            content: `You are a world state manager. Given the current world state and recent story events, provide an updated world state that captures important changes, character locations, inventory, relationships, and plot progression. Keep it concise but comprehensive.`
          },
          {
            role: 'user' as const,
            content: `Current World State: ${currentState}

Recent Events:
Player action: "${userMessage}"
Story response: "${narratorResponse}"

Please provide an updated world state that incorporates these events:`
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent state management
        maxTokens: 400
      };

      const response = await this.aiService.generateText(stateUpdatePrompt);
      return response.content;
    } catch (error) {
      console.error('Failed to update world state with AI, using simple append:', error);
      // Simple fallback that just appends recent events
      const stateUpdate = `\nRecent: Player "${userMessage}" -> ${narratorResponse.substring(0, 100)}...`;
      return currentState + stateUpdate;
    }
  }
} 