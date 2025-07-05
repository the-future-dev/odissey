import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';
import { extractJsonFromResponse, createLoggerContext } from './mpcUtils';

export interface StoryPredictorInput {
  session: Session;
  world: World;
  storyModel: StoryModel;
  storyStep: string;
  userInput: string;
  narratorResponse: string;
  chatHistory: Message[];
}

/**
 * StoryPredictor Agent - Responsible for predicting and applying model updates based on narrative outcome
 * IMPORTANT: This agent preserves all predictions and generated content for analysis
 */
export class StoryPredictor {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    Logger.info('StoryPredictor initialized', {
      component: 'StoryPredictor',
      operation: 'INIT'
    });
  }

  /**
   * Predict and apply model updates based on narrative outcome
   * NOTE: Does not remove any predictions - preserves all generated content for analysis
   */
  async predictAndUpdateModel(input: StoryPredictorInput): Promise<void> {
    const timer = createTimer();
    const context = createLoggerContext(
      'StoryPredictor',
      'PREDICT_AND_UPDATE_MODEL',
      input.session.id,
      { 
        worldId: input.world.id,
        responseLength: input.narratorResponse.length 
      }
    );

    Logger.info('Starting model prediction and update', context);

    const systemPrompt = `You are the StoryPredictor agent in a Model Predictive Control storytelling system. Your role is to analyze the narrative development and predict necessary updates to the StoryModel.

You must provide exactly 4 updates as a JSON array:
1. **Immediate Update**: Minimal, greedy changes to reflect what has ALREADY happened (user input + narrator response)
2. **Choice 1 Prediction**: Additional changes if the user chooses option 1
3. **Choice 2 Prediction**: Additional changes if the user chooses option 2  
4. **Choice 3 Prediction**: Additional changes if the user chooses option 3

Be GREEDY - only update fields that truly need changing. Minimal updates that reflect the full changes.

Consider for updates:
- Plot development and movement toward climax/resolution
- Character growth, moral development, or degradation
- Thematic reinforcement or evolution
- Conflict escalation or transformation
- Setting changes or symbolic development
- Style/genre consistency or intentional shifts
- Audience effect progression toward catharsis

RESPONSE FORMAT:
Return ONLY a valid JSON array with exactly 4 update objects:
[
  {
    "type": "immediate",
    "plot": "updated plot if changed...",
    "characters": "updated characters if changed...",
    "theme_moral_message": "updated theme if changed...",
    "conflict": "updated conflict if changed...",
    "setting": "updated setting if changed...",
    "style_genre": "updated style if changed...",
    "audience_effect": "updated effect if changed..."
  },
  {
    "type": "choice_1",
    "plot": "additional plot changes for choice 1...",
    "characters": "additional character changes for choice 1..."
  },
  {
    "type": "choice_2", 
    "plot": "additional plot changes for choice 2...",
    "characters": "additional character changes for choice 2..."
  },
  {
    "type": "choice_3",
    "plot": "additional plot changes for choice 3...",
    "characters": "additional character changes for choice 3..."
  }
]

Only include fields that actually need updating in each object. Empty object {} if no changes needed for that update type.`;

    const userPrompt = `IMPLEMENTED STORY STEP: "${input.storyStep}"

CURRENT STORY MODEL:
Plot: ${input.storyModel.plot}
Characters: ${input.storyModel.characters}
Theme/Moral: ${input.storyModel.theme_moral_message}
Conflict: ${input.storyModel.conflict}
Setting: ${input.storyModel.setting}
Style/Genre: ${input.storyModel.style_genre}
Audience Effect: ${input.storyModel.audience_effect}

USER INPUT: "${input.userInput}"

NARRATOR RESPONSE: "${input.narratorResponse}"

What updates to the StoryModel are needed to reflect this story progression?`;

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
      
      Logger.info("\n\nSTORY PREDICTOR:"+ response.content, {
        ...context,
      });

      Logger.debug('Raw AI response received for prediction', {
        ...context,
        metadata: { 
          responseLength: response.content.length,
          responsePreview: response.content.substring(0, 100) + '...'
        }
      });
      
      // Parse the JSON response - expecting array of 4 updates
      const allUpdates = extractJsonFromResponse(response.content);
      
      Logger.debug('JSON successfully extracted and parsed for prediction', {
        ...context,
        metadata: { 
          updatesCount: Array.isArray(allUpdates) ? allUpdates.length : 0,
          isArray: Array.isArray(allUpdates)
        }
      });
      
      if (!Array.isArray(allUpdates) || allUpdates.length !== 4) {
        throw new Error('Expected exactly 4 updates in array format');
      }

      const [immediateUpdate, choice1Update, choice2Update, choice3Update] = allUpdates;

      // Apply immediate update if any fields need changing
      const immediateFields = Object.keys(immediateUpdate).filter(key => key !== 'type');
      if (immediateFields.length > 0) {
        const updateData = { ...immediateUpdate };
        delete updateData.type; // Remove the type field before updating
        
        await this.db.updateStoryModel(input.session.id, updateData);
        
        Logger.info('Immediate story model update applied', {
          ...context,
          duration: getElapsed(timer),
          metadata: { 
            ...context.metadata, 
            immediateUpdatedFields: immediateFields.length 
          }
        });
      }

      // Store future predictions for choices 1, 2, 3
      // IMPORTANT: We preserve ALL predictions for analysis - no deletions
      const predictions = [
        { choiceNumber: 1 as const, modelUpdate: choice1Update },
        { choiceNumber: 2 as const, modelUpdate: choice2Update },
        { choiceNumber: 3 as const, modelUpdate: choice3Update }
      ].filter(pred => {
        // Only store predictions that have actual updates
        const fields = Object.keys(pred.modelUpdate).filter(key => key !== 'type');
        return fields.length > 0;
      });

      if (predictions.length > 0) {
        await this.db.createStoryPredictions(input.session.id, predictions);
        
        Logger.info('Story predictions stored successfully - all predictions preserved for analysis', {
          ...context,
          duration: getElapsed(timer),
          metadata: { 
            ...context.metadata, 
            storedPredictions: predictions.length 
          }
        });
      }

      Logger.info('Story model prediction and update completed', {
        ...context,
        duration: getElapsed(timer),
        metadata: {
          ...context.metadata,
          immediateFields: immediateFields.length,
          futureChoices: predictions.length
        }
      });

    } catch (error) {
      Logger.error('Story model prediction failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      // Don't throw - model updates are not critical for user experience
      Logger.warn('Continuing without model updates');
    }
  }
} 