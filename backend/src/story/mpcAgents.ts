import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';

// Import individual agents
import { StoryInitializer, StoryInitializerInput } from './storyInitializer';
import { StoryOptimizer, StoryOptimizerInput } from './storyOptimizer';
import { StoryNarrator, StoryNarratorInput } from './storyNarrator';
import { StoryPredictor, StoryPredictorInput } from './storyPredictor';

// Re-export interfaces for backward compatibility
export type { StoryInitializerInput, StoryOptimizerInput, StoryNarratorInput, StoryPredictorInput };

export class MPCStoryAgents {
  private aiService: AIServiceManager;
  private db: DatabaseService;
  
  // Individual agent instances
  private storyInitializer: StoryInitializer;
  private storyOptimizer: StoryOptimizer;
  private storyNarrator: StoryNarrator;
  private storyPredictor: StoryPredictor;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    // Initialize individual agents
    this.storyInitializer = new StoryInitializer(aiService, db);
    this.storyOptimizer = new StoryOptimizer(aiService, db);
    this.storyNarrator = new StoryNarrator(aiService, db);
    this.storyPredictor = new StoryPredictor(aiService, db);
    
    Logger.info('MPCStoryAgents initialized with individual agents', {
      component: 'MPCStoryAgents',
      operation: 'INIT'
    });
  }

  // Utility methods have been moved to mpcUtils.ts

  /**
   * StoryInitializer Agent - Initialize StoryModel from World description
   */
  async initializeStoryModel(input: StoryInitializerInput): Promise<StoryModel> {
    return await this.storyInitializer.initializeStoryModel(input);
  }

  /**
   * StoryOptimizer Agent - Generate single next step based on current model and state
   */
  async optimizeStoryStep(input: StoryOptimizerInput): Promise<string> {
    return await this.storyOptimizer.optimizeStoryStep(input);
  }

  /**
   * StoryNarrator Agent - Generate narrative response based on story step and user input
   */
  async generateNarrativeResponse(input: StoryNarratorInput): Promise<string> {
    return await this.storyNarrator.generateNarrativeResponse(input);
  }

  /**
   * StoryPredictor Agent - Predict and apply model updates based on narrative outcome
   */
  async predictAndUpdateModel(input: StoryPredictorInput): Promise<void> {
    return await this.storyPredictor.predictAndUpdateModel(input);
  }
} 