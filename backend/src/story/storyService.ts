import { Session, World, User, StoryModel, Chapter, Message } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { Logger } from '../utils';

import { StoryInitializer, StoryInitializerInput, StoryInitializerOutput } from './storyInitializer';
import { StoryPredictor, InitializeChaptersInput, UpdateFutureChaptersInput, StoryPredictorOutput } from './storyPredictor';
import { StoryOptimizer, OptimizerInput, OptimizerOutput } from './storyOptimizer';
import { StoryNarrator, NarratorInput, NarratorOutput } from './storyNarrator';

export interface ProcessUserInputOutput {
  narratorResponse: string;
  storyOutput: StoryPredictorOutput;
  optimizerOutput: OptimizerOutput;
}

export interface InitializeStoryOutput {
  storyModelData: StoryInitializerOutput;
  chapters: StoryPredictorOutput;
}

/**
 * StoryService - orchestrates the agents for the story interaction.
 */
export class StoryService {
  private storyInitializer: StoryInitializer;
  private storyPredictor: StoryPredictor;
  private storyOptimizer: StoryOptimizer;
  private storyNarrator: StoryNarrator;

  constructor(aiService: AIServiceManager) {
    this.storyInitializer = new StoryInitializer(aiService);
    this.storyPredictor = new StoryPredictor(aiService);
    this.storyOptimizer = new StoryOptimizer(aiService);
    this.storyNarrator = new StoryNarrator(aiService);
    
    Logger.info('🎮 StoryService initialized');
  }

  /**
   * Generates the story model and chapters for a new session.
   */
  async initializeStory(
    initializerInput: StoryInitializerInput
  ): Promise<InitializeStoryOutput> {
    Logger.info(`🚀 INITIALIZING STORY for session: ${initializerInput.session.id}`);

    try {
      // 1. Create the story model foundation
      const storyModelData = await this.storyInitializer.initializeStoryModel(initializerInput);

      // 2. Immediately generate the initial chapters based on the new model
      // We create a temporary, in-memory StoryModel to satisfy the predictor's input requirements.
      const tempStoryModel: StoryModel = {
        id: 0, // Not yet saved
        session_id: initializerInput.session.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...storyModelData
      };

      const chapters = await this.storyPredictor.initializeChapters({
        storyModel: tempStoryModel,
        user: initializerInput.user
      });

      Logger.info(`✅ Story initialized with current chapter + ${chapters.futureChapters.length} future chapters`);
      
      return { storyModelData, chapters };
    } catch (error) {
      Logger.error(`❌ Failed to initialize story: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize story');
    }
  }

  /**
   * Process user input by orchestrating the optimizer, narrator, and predictor agents.
   */
  async processUserInput(
    storyModel: StoryModel,
    allChapters: { history: Chapter[], current: Chapter | null, future: Chapter[] },
    recentMessages: Message[],
    userInput: string,
    user: User
  ): Promise<ProcessUserInputOutput> {
    Logger.info(`💬 PROCESSING INPUT for session`);

    try {
      if (!allChapters.current) {
        throw new Error('Current chapter not found');
      }
      const currentChapter = allChapters.current;

      const optimizerInput: OptimizerInput = {
        storyModel,
        currentChapter,
        recentMessages,
        userInput,
        user
      };
      const optimizerOutput = await this.storyOptimizer.optimizeStory(optimizerInput);

      const narratorInput: NarratorInput = {
        storyModel,
        currentChapter,
        recentMessages,
        userInput,
        optimizerOutput,
        user
      };
      const narratorOutput = await this.storyNarrator.generateNarrative(narratorInput);

      const narratorResponse = `${narratorOutput.response}\n\n1. ${narratorOutput.choices[0]}\n2. ${narratorOutput.choices[1]}\n3. ${narratorOutput.choices[2]}`;

      // FEEDBACK LOOP: Update future chapters based on the latest interaction.
      const predictorInput: UpdateFutureChaptersInput = {
        storyModel,
        historyChapters: allChapters.history,
        currentChapter: currentChapter,
        futureChapters: allChapters.future,
        recentMessages,
        userInput,
        narratorResponse: narratorOutput.response,
        user
      };
      const storyOutput = await this.storyPredictor.updateFutureChapters(predictorInput);

      Logger.info(`✅ Generated response and story feedback`);
      return {
        narratorResponse,
        storyOutput,
        optimizerOutput
      };
    } catch (error) {
      Logger.error(`❌ Failed to process user input: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to process user input');
    }
  }
} 