import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';
import { createLoggerContext } from './mpcUtils';

export interface StoryOptimizerInput {
  session: Session;
  world: World;
  storyModel: StoryModel;
  userInput: string;
  chatHistory: Message[];
}

export interface Scene {
  id: number;
  title: string;
  setting: string;
  purpose: string;
  keyCharacters: string[];
  emotionalTone: string;
  conflictLevel: string;
  timeframe: string;
  objectives: string[];
  expectedOutcome: string;
  transitionTrigger: string;
}

/**
 * StoryOptimizer Agent - Responsible for generating complete scene breakdown and returning first scene
 */
export class StoryOptimizer {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    Logger.info('StoryOptimizer initialized', {
      component: 'StoryOptimizer',
      operation: 'INIT'
    });
  }

  /**
   * Generate complete scene breakdown and return first scene for immediate narration
   */
  async optimizeStoryStep(input: StoryOptimizerInput): Promise<string> {
    const timer = createTimer();
    const context = createLoggerContext(
      'StoryOptimizer',
      'OPTIMIZE_STORY_SCENES',
      input.session.id,
      { 
        worldId: input.world.id,
        userInputLength: input.userInput.length,
        historyCount: input.chatHistory.length 
      }
    );

    Logger.info('Starting full story scene optimization', context);

    const systemPrompt = `You are the StoryOptimizer agent in a Model Predictive Control storytelling system. Your role is to analyze the current StoryModel and story state, then output a complete breakdown of ALL scenes needed to tell this tragic narrative.

You must consider the story elements and create a comprehensive scene structure following these principles:

SCENE DETERMINANTS:
- Setting/Location Shift or Focus Shift within Location
- Significant Time Jump
- Introduction or Exit of Key Characters
- Introduction of New Information/Revelation
- Shift in Narrative Purpose/Objective
- Change in Conflict/Tension
- Emotional Arc/Atmospheric Shift
- Resolution of Mini-Objective or Immediate Question

Each scene should be a distinct narrational unit that serves a specific purpose in the tragic arc.

OUTPUT FORMAT: Return ONLY a valid JSON array of scene objects. Each scene object must have:
{
  "id": number,
  "title": "Brief descriptive title",
  "setting": "Location and time context",
  "purpose": "What this scene accomplishes in the narrative",
  "keyCharacters": ["Character1", "Character2"],
  "emotionalTone": "Dominant emotion/atmosphere",
  "conflictLevel": "Low/Medium/High/Climactic",
  "timeframe": "When this occurs relative to story",
  "objectives": ["Specific goals within scene"],
  "expectedOutcome": "How the scene should conclude",
  "transitionTrigger": "What prompts the next scene"
}

Create the FULL list of scenes that cover the complete tragic narrative arc. Follow Aristotelian structure with proper exposition, rising action, climax, falling action, and denouement.

CRITICAL: Output ONLY the JSON array, no other text.`;

    const recentHistory = input.chatHistory.slice(-10).map(msg => 
      `[${msg.type.toUpperCase()}]: ${msg.content}`
    ).join('\n');

    const userPrompt = `CURRENT STORY MODEL:
Plot: ${input.storyModel.plot}
Characters: ${input.storyModel.characters}
Theme/Moral: ${input.storyModel.theme_moral_message}
Conflict: ${input.storyModel.conflict}
Setting: ${input.storyModel.setting}
Style/Genre: ${input.storyModel.style_genre}
Audience Effect: ${input.storyModel.audience_effect}

CONVERSATION HISTORY:
${recentHistory}

CURRENT USER INPUT: "${input.userInput}"

Generate the complete scene breakdown for this tragic narrative.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      maxTokens: 4000
    };

    try {
      const response = await this.aiService.generateText(request);

      Logger.info("Raw StoryOptimizer response:", {
        ...context,
        metadata: { ...context.metadata, response: response.content }
      });

      // Parse the JSON response
      let scenes: Scene[];
      try {
        // Clean the response in case there's extra text
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : response.content.trim();
        scenes = JSON.parse(jsonString);
      } catch (parseError) {
        Logger.error('Failed to parse scenes JSON', parseError, context);
        throw new Error('Failed to parse scene breakdown from AI response');
      }

      // Log the complete scene breakdown to console
      console.log('\n=== COMPLETE STORY SCENE BREAKDOWN ===');
      console.log(JSON.stringify(scenes, null, 2));
      console.log('=====================================\n');

      Logger.info('Full scene breakdown generated', {
        ...context,
        metadata: { 
          ...context.metadata, 
          sceneCount: scenes.length,
          scenes: scenes.map(s => ({ id: s.id, title: s.title, purpose: s.purpose }))
        }
      });

      // Get the first scene for immediate use
      if (!scenes || scenes.length === 0) {
        throw new Error('No scenes generated in the breakdown');
      }

      const firstScene = scenes[0];
      const firstSceneDescription = `SCENE: ${firstScene.title}
SETTING: ${firstScene.setting}
PURPOSE: ${firstScene.purpose}
EMOTIONAL TONE: ${firstScene.emotionalTone}
CONFLICT LEVEL: ${firstScene.conflictLevel}
OBJECTIVES: ${firstScene.objectives.join(', ')}
EXPECTED OUTCOME: ${firstScene.expectedOutcome}`;

      // Save the complete scene breakdown
      await this.db.createStoryStep(
        input.session.id,
        JSON.stringify(scenes, null, 2),
        input.userInput,
        'Complete scene breakdown generated by StoryOptimizer'
      );

      // Save the first scene being used
      await this.db.createStoryStep(
        input.session.id,
        firstSceneDescription,
        input.userInput,
        'First scene selected for immediate narration'
      );

      Logger.info('Scene optimization completed successfully', {
        ...context,
        duration: getElapsed(timer),
        metadata: { 
          ...context.metadata, 
          totalScenes: scenes.length,
          firstSceneTitle: firstScene.title,
          firstSceneLength: firstSceneDescription.length
        }
      });

      return firstSceneDescription;
    } catch (error) {
      Logger.error('Story scene optimization failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to optimize story scenes');
    }
  }
} 