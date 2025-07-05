import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';
import { createLoggerContext } from './mpcUtils';

export interface StoryNarratorInput {
  session: Session;
  world: World;
  storyModel: StoryModel;
  storyStep: string;
  userInput: string;
  chatHistory: Message[];
}

/**
 * StoryNarrator Agent - Responsible for generating narrative response based on story step and user input
 */
export class StoryNarrator {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    Logger.info('StoryNarrator initialized', {
      component: 'StoryNarrator',
      operation: 'INIT'
    });
  }

  /**
   * Generate narrative response based on story step and user input
   */
  async generateNarrativeResponse(input: StoryNarratorInput): Promise<string> {
    const timer = createTimer();
    const context = createLoggerContext(
      'StoryNarrator',
      'GENERATE_NARRATIVE_RESPONSE',
      input.session.id,
      { 
        worldId: input.world.id,
        stepLength: input.storyStep.length,
        userInputLength: input.userInput.length 
      }
    );

    Logger.info('Starting narrative response generation', context);

    const systemPrompt = `You are the StoryNarrator agent. Your role is to craft the actual narrative response that the user will read, based on:
1. The optimization step provided by the StoryOptimizer
2. The user's input and choices
3. The current StoryModel framework

You must create an engaging, literary response that:
- Implements the story step provided by the optimizer
- Responds appropriately to the user's input
- Maintains consistency with the StoryModel elements
- Follows tragic narrative principles
- Provides exactly 3 meaningful choices for the user

RESPONSE STRUCTURE REQUIREMENTS:
- 200-300 words per response
- Use sophisticated language befitting the tragic genre
- Structure: Scene Setting → Event Development → Character Response → Choices
- End with exactly 3 numbered choices in the specified format

Your response should embody the StoryModel's:
- Plot development and tragic structure
- Character complexity and moral ambiguity  
- Thematic depth and moral questioning
- Conflict escalation (internal/external)
- Setting atmosphere and symbolic elements
- Style/genre consistency
- Intended audience effect (pity, fear, catharsis)

FORMAT - end with:
\`\`\`choice
1) [Option reflecting one moral/strategic path]
2) [Option reflecting alternative moral/strategic path] 
3) [Option reflecting third moral/strategic path]
\`\`\``;

    const recentHistory = input.chatHistory.slice(-4).map(msg => 
      `[${msg.type.toUpperCase()}]: ${msg.content}`
    ).join('\n');

    const userPrompt = `STORY OPTIMIZATION STEP: "${input.storyStep}"
    
RECENT CONVERSATION:
${recentHistory}

USER INPUT: "${input.userInput}"

Craft a narrative response that implements the optimization step while responding to the user's choice.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
      maxTokens: 2000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      Logger.info('Narrative response generated successfully', {
        ...context,
        duration: getElapsed(timer),
        metadata: { ...context.metadata, responseLength: response.content.length }
      });

      return response.content;
    } catch (error) {
      Logger.error('Narrative response generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to generate narrative response');
    }
  }
} 