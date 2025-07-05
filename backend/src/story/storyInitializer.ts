import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';
import { extractJsonFromResponse, createLoggerContext } from './mpcUtils';

export interface StoryInitializerInput {
  session: Session;
  world: World;
}

/**
 * StoryInitializer Agent - Responsible for initializing StoryModel from World description
 */
export class StoryInitializer {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    Logger.info('StoryInitializer initialized', {
      component: 'StoryInitializer',
      operation: 'INIT'
    });
  }

  /**
   * Initialize StoryModel from World description using tragic storytelling principles
   */
  async initializeStoryModel(input: StoryInitializerInput): Promise<StoryModel> {
    const timer = createTimer();
    const context = createLoggerContext(
      'StoryInitializer',
      'INITIALIZE_STORY_MODEL',
      input.session.id,
      { worldId: input.world.id }
    );

    Logger.info('Starting story model initialization', context);

    const systemPrompt = `You are the StoryInitializer agent. Your role is to analyze a story world and initialize a comprehensive story based on the key elements of tragic storytelling as defined below.

Based on the story title and description provided, you must create seven components of the StoryModel:

1. **Plot** - The structure of incidents of the story:
   - Focus on arrangement of events that will lead to catharsis
   - Consider potential for Peripeteia (reversal of fortune)
   - Plan for Anagnorisis (recognition/discovery moments)
   - Outline path toward Denouement (resolution through knowledge from suffering)

2. **Characters** - Development of the main character and supporting characters:
   - Define the tragic hero as "between extremes" - neither purely good nor evil
   - Identify the hamartia (error or frailty) that will drive the tragedy
   - Establish moral ambiguity that creates compelling conflict
   - Define motivations driven by "inner experience and individual emotion"

3. **Theme/Moral Message** - Central ethical and philosophical framework:
   - Define the moral purpose and cathartic goals
   - Establish what insights about existence the story will reveal
   - Plan how opposing moral claims will create conflict
   - Consider Hegelian reconciliation of ethical positions

4. **Conflict** - Primary tensions driving the narrative:
   - Determine if conflict is primarily internal (Romantic) or external (Classical)
   - Define opposing forces: fate vs. will, conscience vs. law, duty vs. desire
   - Establish how conflict embodies "strife of will with itself"

5. **Setting** - Unities of Time and Place:
   - Define temporal boundaries and constraints
   - Establish physical location and its symbolic significance
   - Consider how setting reinforces thematic elements
   - Plan unity of action within time/place constraints

6. **Style and Genre** - Literary and dramatic approach:
   - Determine if pure tragedy or blended genre elements
   - Define linguistic style (high tragic vs. mixed)
   - Establish tone: Apollonian restraint vs. Dionysian passion
   - Plan narrative voice and perspective

7. **Audience Effect** - Intended emotional and intellectual impact:
   - Plan specific pity and fear elements for catharsis
   - Define what enlightenment the audience should gain
   - Establish how moral purpose will be fulfilled
   - Consider both ethical and artistic satisfaction

RESPONSE FORMAT:
Return ONLY a valid JSON object with these exact keys:
{
  "plot": "detailed plot structure...",
  "characters": "character development plan...", 
  "theme_moral_message": "thematic framework...",
  "conflict": "conflict structure...",
  "setting": "time and place unities...",
  "style_genre": "literary approach...",
  "audience_effect": "intended impact..."
}`;

    const userPrompt = `Initialize a StoryModel for:

Title: "${input.world.title}"
Description: "${input.world.description || 'No description provided'}"

Create a comprehensive tragic narrative framework based on these elements.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      maxTokens: 10000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      Logger.info("\n\nSTORY MODEL:"+ response.content, {
        ...context,
      });

      Logger.debug('Raw AI response received', {
        ...context,
        metadata: { 
          responseLength: response.content.length,
          responsePreview: response.content.substring(0, 100) + '...'
        }
      });
      
      // Parse the JSON response using the extraction utility
      const storyModelData = extractJsonFromResponse(response.content);
      
      Logger.debug('JSON successfully extracted and parsed', {
        ...context,
        metadata: { 
          extractedFields: Object.keys(storyModelData),
          fieldCount: Object.keys(storyModelData).length
        }
      });
      
      // Create the story model in database
      const storyModel = await this.db.createStoryModel(
        input.session.id,
        storyModelData.plot,
        storyModelData.characters,
        storyModelData.theme_moral_message,
        storyModelData.conflict,
        storyModelData.setting,
        storyModelData.style_genre,
        storyModelData.audience_effect
      );

      Logger.info('Story model initialized successfully', {
        ...context,
        duration: getElapsed(timer)
      });

      return storyModel;
    } catch (error) {
      Logger.error('Story model initialization failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to initialize story model');
    }
  }
} 