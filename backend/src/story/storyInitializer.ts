import { Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';
import { extractJsonFromResponse } from './mpcUtils';

export interface StoryInitializerInput {
  session: Session;
  world: World;
  user: User;
}

/**
 * StoryInitializer Agent - Creates the StoryModel for a new session
 * Role: Set up the story framework that guides the entire adventure
 */
export class StoryInitializer {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
  }

  /**
   * Initialize StoryModel from World description
   */
  async initializeStoryModel(input: StoryInitializerInput): Promise<StoryModel> {
    Logger.info(`🎬 STORY INITIALIZER: Creating story model for "${input.world.title}"`);

    const systemPrompt = `You are a narrator.
Your job is to create the foundation for an interactive story where the user is the main character.
The user's name is ${input.user.name}. Use it only when it naturally fits.

Your task:
- Establish the story framework that will guide the entire adventure
- Create six key components following the Aristotelian framework
- Make the user's journey interesting and meaningful
- Be specific and concrete with details

Required Components:
1. Core Theme and Moral Message: What the story is about and what truth the user will discover
2. Genre, Style, and Voice: Story type and how it should feel to experience
3. Setting: Where and when this takes place, including world rules
4. Protagonist: The user's starting situation and potential for growth
5. Primary Conflict Sources: Main challenges and obstacles that drive the story
6. Intended Impact: How the user should feel and what they should take away

Format your response as JSON with simple string values:
{
  "core_theme_moral_message": "...",
  "genre_style_voice": "...",
  "setting": "...",
  "protagonist": "...",
  "conflict_sources": "...",
  "intended_impact": "..."
}`;

    const userPrompt = `Create a story framework for:

Title: "${input.world.title}"
Description: "${input.world.description || 'No description provided'}"

Remember: The user will be the main character in this story. Make it engaging!`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      maxTokens: 8000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      // Parse the JSON response
      const storyModelData = extractJsonFromResponse(response.content);
      
      // Create the story model in database
      const storyModel = await this.db.createStoryModel(
        input.session.id,
        storyModelData.core_theme_moral_message,
        storyModelData.genre_style_voice,
        storyModelData.setting,
        storyModelData.protagonist,
        storyModelData.conflict_sources,
        storyModelData.intended_impact
      );

      // Log the complete StoryModel
      console.log('\n🎯 STORY MODEL CREATED:');
      console.log('='.repeat(80));
      console.log(`📖 Core Theme: ${storyModel.core_theme_moral_message}`);
      console.log(`🎭 Genre/Style: ${storyModel.genre_style_voice}`);
      console.log(`🌍 Setting: ${storyModel.setting}`);
      console.log(`👤 Protagonist: ${storyModel.protagonist}`);
      console.log(`⚔️ Conflicts: ${storyModel.conflict_sources}`);
      console.log(`💫 Impact: ${storyModel.intended_impact}`);
      console.log('='.repeat(80));

      Logger.info(`✅ Story model created successfully for session ${input.session.id}`);

      return storyModel;
    } catch (error) {
      Logger.error(`❌ Failed to initialize story model: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize story model');
    }
  }
} 