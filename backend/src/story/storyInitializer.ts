import { Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';
import { extractJsonFromResponse } from './mpcUtils';

export interface StoryInitializerInput {
  session: Session;
  world: World;
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

    const systemPrompt = `You are the Story Initializer. Your job is to create the foundation for an interactive story where the user is the main character.

You're setting up the world, theme, and structure that will guide the entire adventure. Think of yourself as a storyteller who needs to establish the key elements before the story begins.

The user will be the protagonist in this story - they'll make choices and drive the narrative forward. Your job is to create a solid foundation that makes their journey interesting and meaningful.

Based on the story title and description, create these six components, following the Aristotelian framework:

1. **Core Theme and Moral Message**: What's this story really about? What life lesson or truth will the user discover through their adventure?

2. **Genre, Style, and Voice**: What kind of story is this? Adventure? Mystery? Romance? How should it feel when someone experiences it?

3. **Setting**: Where and when does this take place? What are the rules of this world that everyone must follow?

4. **Protagonist**: The user is the main character. What's their starting situation and potential for growth in this world?

5. **Primary Conflict Sources**: What are the main challenges and obstacles the user will face? What creates tension and drives the story forward?

6. **Intended Impact**: How should the user feel during and after this story? What should they take away from the experience?

Write like you're explaining to a friend, not like you're writing a textbook. Be specific and concrete - give examples and details that paint a clear picture.

Return your response as a JSON object with these exact keys:
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