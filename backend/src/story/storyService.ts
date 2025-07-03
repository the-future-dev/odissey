import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';
import { MPCStoryAgents } from './mpcAgents';

export class StoryService {
  private aiService: AIServiceManager;
  private db: DatabaseService;
  private mpcAgents: MPCStoryAgents;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    this.mpcAgents = new MPCStoryAgents(aiService, db);
    
    Logger.info('StoryService', {
      component: 'StoryService',
      operation: 'INIT'
    });
  }

  /**
   * Initialize story model for a new session
   */
  async initializeSession(session: Session, world: World): Promise<StoryModel> {
    const timer = createTimer();
    const context = {
      component: 'StoryService',
      operation: 'INITIALIZE_SESSION',
      sessionId: session.id,
      metadata: { worldId: world.id }
    };

    Logger.info('Initializing session with story model', context);

    try {
      // Check if story model already exists
      const existingModel = await this.db.getStoryModelBySessionId(session.id);
      if (existingModel) {
        Logger.info('Story model already exists for session', {
          ...context,
          duration: getElapsed(timer)
        });
        return existingModel;
      }

      // Initialize story model using StoryInitializer agent
      const storyModel = await this.mpcAgents.initializeStoryModel({
        session,
        world
      });

      Logger.info('Session initialized successfully', {
        ...context,
        duration: getElapsed(timer)
      });

      return storyModel;
    } catch (error) {
      Logger.error('Session initialization failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to initialize session with story model');
    }
  }

  /**
   * Generate a narrative response using MPC approach
   */
  async generateResponse(
    userMessage: string,
    session: Session,
    world: World,
    recentMessages: Message[],
    ctx?: ExecutionContext
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

    Logger.info('Starting MPC story response generation', context);

    try {
      // Get or initialize story model
      let storyModel = await this.db.getStoryModelBySessionId(session.id);
      if (!storyModel) {
        storyModel = await this.initializeSession(session, world);
      }

      // Check for and apply predicted model updates if user made a choice
      await this.applyPredictedUpdates(session.id, userMessage);

      // Refresh story model after potential updates
      storyModel = await this.db.getStoryModelBySessionId(session.id) || storyModel;

      // Step 1: StoryOptimizer - Get the next optimization step
      const storyStep = await this.mpcAgents.optimizeStoryStep({
        session,
        world,
        storyModel,
        userInput: userMessage,
        chatHistory: recentMessages
      });

      // Step 2: StoryNarrator - Generate the narrative response
      const narratorResponse = await this.mpcAgents.generateNarrativeResponse({
        session,
        world,
        storyModel,
        storyStep,
        userInput: userMessage,
        chatHistory: recentMessages
      });

      // Step 3: StoryPredictor - Update model based on narrative outcome (async)
      this.backgroundModelUpdate(session, world, storyModel, storyStep, userMessage, narratorResponse, recentMessages, ctx);

      Logger.info('MPC story response generated successfully', {
        ...context,
        duration: getElapsed(timer),
        metadata: {
          ...context.metadata,
          responseLength: narratorResponse.length,
          stepLength: storyStep.length
        }
      });

      return narratorResponse;
    } catch (error) {
      Logger.error('MPC response generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('AI service is temporarily unavailable. Please check your API configuration and try again.');
    }
  }

    /**
   * Apply predicted model updates based on user choice
   */
  private async applyPredictedUpdates(sessionId: string, userMessage: string): Promise<void> {
    const context = {
      component: 'StoryService',
      operation: 'APPLY_PREDICTED_UPDATE',
      sessionId
    };

    try {
      Logger.debug('Analyzing user message for choice detection', {
        ...context,
        metadata: { 
          messageLength: userMessage.length,
          messagePreview: userMessage.substring(0, 50) + '...'
        }
      });

      // Detect which choice the user made (1, 2, or 3)
      const choiceNumber = this.detectUserChoice(userMessage);
      
      Logger.debug('Choice detection completed', {
        ...context,
        metadata: { 
          detectedChoice: choiceNumber,
          userMessage: userMessage.trim()
        }
      });
      
      if (choiceNumber) {
        Logger.info('User choice detected, looking for prediction', {
          ...context,
          metadata: { choiceNumber }
        });

        // Get the prediction for this choice
        const prediction = await this.db.getStoryPredictionByChoice(sessionId, choiceNumber);
        
        if (prediction) {
          Logger.debug('Found matching prediction', {
            ...context,
            metadata: { 
              choiceNumber,
              predictionLength: prediction.predicted_model_update.length
            }
          });

          // Parse and apply the predicted updates
          const updateData = JSON.parse(prediction.predicted_model_update);
          
          // Remove the type field if present
          const cleanUpdateData = { ...updateData };
          delete cleanUpdateData.type;
          
          // Only apply if there are actual fields to update
          const fieldsToUpdate = Object.keys(cleanUpdateData);
          if (fieldsToUpdate.length > 0) {
            Logger.info('Applying predicted model updates', {
              ...context,
              metadata: {
                choiceNumber,
                fieldsToUpdate,
                updateCount: fieldsToUpdate.length
              }
            });

            await this.db.updateStoryModel(sessionId, cleanUpdateData);
            
            Logger.info('Applied predicted model update', {
              ...context,
              metadata: {
                choiceNumber,
                updatedFields: fieldsToUpdate.length
              }
            });
          } else {
            Logger.debug('No fields to update in prediction', {
              ...context,
              metadata: { choiceNumber }
            });
          }
          
          // Clear all predictions after applying one
          await this.db.clearStoryPredictions(sessionId);
          Logger.debug('Cleared all story predictions', context);
        } else {
          Logger.debug('No prediction found for detected choice', {
            ...context,
            metadata: { choiceNumber }
          });
        }
      } else {
        Logger.debug('No choice detected in user message', {
          ...context,
          metadata: { userMessage: userMessage.trim() }
        });
      }
    } catch (error) {
      Logger.warn('Failed to apply predicted updates', {
        ...context,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          userMessage: userMessage.substring(0, 100) + '...'
        }
      });
      // Don't throw - continue with normal flow
    }
  }

  /**
   * Detect which choice (1, 2, or 3) the user made from their message
   */
  private detectUserChoice(userMessage: string): 1 | 2 | 3 | null {
    const message = userMessage.toLowerCase().trim();
    const context = {
      component: 'StoryService',
      operation: 'DETECT_USER_CHOICE'
    };
    
    Logger.debug('Starting choice detection', {
      ...context,
      metadata: { 
        originalMessage: userMessage,
        normalizedMessage: message
      }
    });
    
    // Check for explicit choice patterns
    if (message.match(/^1\)|^choice\s*1|^option\s*1|^1$/)) {
      Logger.debug('Detected choice 1 via explicit pattern', {
        ...context,
        metadata: { pattern: 'explicit_start', message }
      });
      return 1;
    }
    if (message.match(/^2\)|^choice\s*2|^option\s*2|^2$/)) {
      Logger.debug('Detected choice 2 via explicit pattern', {
        ...context,
        metadata: { pattern: 'explicit_start', message }
      });
      return 2;
    }
    if (message.match(/^3\)|^choice\s*3|^option\s*3|^3$/)) {
      Logger.debug('Detected choice 3 via explicit pattern', {
        ...context,
        metadata: { pattern: 'explicit_start', message }
      });
      return 3;
    }
    
    // Check for numbered patterns anywhere in message
    if (message.includes('1)') || message.includes('choice 1') || message.includes('option 1')) {
      Logger.debug('Detected choice 1 via keyword pattern', {
        ...context,
        metadata: { pattern: 'keyword_anywhere', message }
      });
      return 1;
    }
    if (message.includes('2)') || message.includes('choice 2') || message.includes('option 2')) {
      Logger.debug('Detected choice 2 via keyword pattern', {
        ...context,
        metadata: { pattern: 'keyword_anywhere', message }
      });
      return 2;
    }
    if (message.includes('3)') || message.includes('choice 3') || message.includes('option 3')) {
      Logger.debug('Detected choice 3 via keyword pattern', {
        ...context,
        metadata: { pattern: 'keyword_anywhere', message }
      });
      return 3;
    }
    
    // If only a single digit, use it
    const singleDigit = message.match(/^\s*([123])\s*$/);
    if (singleDigit) {
      const choice = parseInt(singleDigit[1]) as 1 | 2 | 3;
      Logger.debug(`Detected choice ${choice} via single digit pattern`, {
        ...context,
        metadata: { pattern: 'single_digit', message, match: singleDigit[1] }
      });
      return choice;
    }
    
    // No clear choice detected
    Logger.debug('No choice detected in message', {
      ...context,
      metadata: { message }
    });
    return null;
  }

  /**
   * Background model update (non-blocking)
   */
  private backgroundModelUpdate(
    session: Session,
    world: World,
    storyModel: StoryModel,
    storyStep: string,
    userInput: string,
    narratorResponse: string,
    recentMessages: Message[],
    ctx?: ExecutionContext
  ): void {
    const context = {
      component: 'StoryService',
      operation: 'BACKGROUND_MODEL_UPDATE',
      sessionId: session.id
    };

    Logger.info('Starting background model update', context);

    // Run StoryPredictor in background
    this.mpcAgents.predictAndUpdateModel({
      session,
      world,
      storyModel,
      storyStep,
      userInput,
      narratorResponse,
      chatHistory: recentMessages
    }).then(() => {
      Logger.info('Background model update completed successfully', context);
    }).catch(error => {
      Logger.warn('Background model update failed', {
        ...context,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    });
  }


  /**
   * Trigger background story analysis (legacy)
   */
  private backgroundStoryGuidance(
    session: Session,
    world: World,
    recentMessages: Message[],
    ctx?: ExecutionContext
  ): void {
    Logger.info("Legacy Story Guidance - consider using MPC model updates instead")
  }

  /**
   * Generate a system prompt (legacy)
   */
  private LegacySystemPromptOfStoryService(world: World): string {
    return `You are a narrator. Your objective is to shape the story "${world.title}", where the user is the main character.
You are the omniscient narrator: your objective is to shape the best story for the user. You only don't know how the user will act in your story!

// WORLD DESCRIPTION:
// ${world.description || ''}

TASK - RESPONSE STRUCTURE REQUIREMENTS:
- 200-300 words per response
- Use simple worlds and a simple phrase format.
- Do not shallowly feed the user with the world description, develop the interaction based on those themes instead.
- Structure each response to generally include:
  1. SCENE SETTING: describe the scene and/or the situation
  2. EVENT: develop the story with the event the scene event
  3. CHOICES: Give 3 options the user can pick from.

FORMAT - at the end of the message use a numbered list with format:
\`\`\`choice
1) ... 
2) ... 
3) ... 
\`\`\``;
  }

} 