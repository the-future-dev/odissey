import { Session, World, StoryModel, Chapter } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';

import { StoryInitializer } from './storyInitializer';
import { ChapterManager } from './chapterManager';
import { StoryPredictor } from './storyPredictor';
import { StoryOptimizer } from './storyOptimizer';
import { StoryNarrator } from './storyNarrator';

/**
 * StoryService - Main interface for story interactions with integrated MPC agents
 * Role: Coordinate all story agents and handle user interactions
 */
export class StoryService {
  private db: DatabaseService;
  private aiService: AIServiceManager;
  
  // Agent instances
  private storyInitializer: StoryInitializer;
  private chapterManager: ChapterManager;
  private storyPredictor: StoryPredictor;
  private storyOptimizer: StoryOptimizer;
  private storyNarrator: StoryNarrator;

  constructor(db: DatabaseService, aiService: AIServiceManager) {
    this.db = db;
    this.aiService = aiService;
    
    // Initialize agents
    this.storyInitializer = new StoryInitializer(aiService, db);
    this.chapterManager = new ChapterManager(db);
    this.storyPredictor = new StoryPredictor(aiService);
    this.storyOptimizer = new StoryOptimizer(aiService, db);
    this.storyNarrator = new StoryNarrator(aiService);
    
    Logger.info('🎮 StoryService initialized with integrated MPC agents');
  }

  /**
   * Initialize new story session with complete setup
   */
  async initializeSession(session: Session, world: World, ctx?: ExecutionContext): Promise<void> {
    Logger.info(`🚀 INITIALIZING SESSION: ${session.id} with world "${world.title}"`);

    try {
      // Initialize StoryModel
      const storyModel = await this.storyInitializer.initializeStoryModel({
        session,
        world
      });

      // Generate initial chapters synchronously - user needs the first chapter to start
      const predictorOutput = await this.storyPredictor.predictFutureChapters({
        storyModel,
        historyChapters: []
      });

      // Store chapters and set first as current
      await this.initializeChaptersWithFirstAsCurrent(session.id, predictorOutput.futureChapters);

      Logger.info(`✅ Session initialized with ${predictorOutput.futureChapters.length} chapters (first chapter set as current)`);
    } catch (error) {
      Logger.error(`❌ Failed to initialize story session: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize story session');
    }
  }

  /**
   * Initialize chapters with first chapter set as current
   */
  private async initializeChaptersWithFirstAsCurrent(sessionId: string, chapters: Array<{ title: string, description: string }>): Promise<void> {
    if (chapters.length === 0) {
      throw new Error('No chapters generated for initialization');
    }

    Logger.info(`📚 INITIALIZING ${chapters.length} chapters with first as current`);

    try {
      // Create the first chapter as current
      const firstChapter = await this.db.createChapter(
        sessionId,
        1,
        chapters[0].title,
        chapters[0].description,
        'current'
      );

      Logger.info(`✅ First chapter created as current: "${firstChapter.title}"`);

      // Create remaining chapters as future
      const remainingChapters = chapters.slice(1);
      if (remainingChapters.length > 0) {
        const futureChapters: Chapter[] = [];
        for (let i = 0; i < remainingChapters.length; i++) {
          const chapterData = remainingChapters[i];
          const chapter = await this.db.createChapter(
            sessionId,
            i + 2, // Start from chapter 2
            chapterData.title,
            chapterData.description,
            'future'
          );
          futureChapters.push(chapter);
        }

        console.log('\n📖 CHAPTERS INITIALIZED:');
        console.log('='.repeat(60));
        console.log(`📚 CURRENT Chapter 1: ${firstChapter.title}`);
        console.log(`  └─ ${firstChapter.description}`);
        console.log('\n📚 FUTURE CHAPTERS:');
        futureChapters.forEach(chapter => {
          console.log(`Chapter ${chapter.chapter_number}: ${chapter.title}`);
          console.log(`  └─ ${chapter.description}`);
        });
        console.log('='.repeat(60));

        Logger.info(`✅ Initialized ${futureChapters.length} future chapters`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to initialize chapters: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize chapters');
    }
  }

  /**
   * Process user input and generate story response with future chapter updates
   */
  async processUserInput(sessionId: string, userInput: string, ctx?: ExecutionContext): Promise<string> {
    Logger.info(`💬 PROCESSING USER INPUT: "${userInput.substring(0, 50)}..."`);

    try {
      // Get required data in parallel
      const [storyModel, currentChapter] = await Promise.all([
        this.db.getStoryModelBySessionId(sessionId),
        this.chapterManager.getCurrentChapter(sessionId)
      ]);

      if (!storyModel) {
        throw new Error('Story model not found');
      }

      if (!currentChapter) {
        throw new Error('Current chapter not found');
      }

      // Get current chapter number for message storage
      const currentChapterNumber = currentChapter.chapter_number;

      // Get all messages from the current chapter
      const chapterMessages = await this.db.getChapterMessages(sessionId, currentChapterNumber);

      // Store user input immediately
      const userMessagePromise = this.db.createMessage(sessionId, 'user', userInput, currentChapterNumber);

      // Start optimizer and wait for it (this is critical for response generation)
      const optimizerOutput = await this.storyOptimizer.optimizeStory({
        storyModel,
        currentChapter,
        recentMessages: chapterMessages,
        userInput
      });

      // Generate narrative response (this is critical for user response)
      const narratorOutput = await this.storyNarrator.generateNarrative({
        storyModel,
        currentChapter,
        recentMessages: chapterMessages,
        userInput,
        optimizerOutput
      });

      // Format response immediately
      const response = `${narratorOutput.response}\n\n**Choose your next action:**\n1. ${narratorOutput.choices[0]}\n2. ${narratorOutput.choices[1]}\n3. ${narratorOutput.choices[2]}`;

      // Return response immediately for fastest user experience
      // Handle background operations asynchronously with ExecutionContext
      if (ctx) {
        Logger.info(`🔄 Scheduling background operations with ExecutionContext for session ${sessionId}`);
        ctx.waitUntil(this.handleBackgroundOperations(sessionId, response, currentChapterNumber, optimizerOutput.shouldTransition, userMessagePromise));
      } else {
        Logger.warn(`⚠️  No ExecutionContext provided - background operations may be interrupted for session ${sessionId}`);
        // Fallback to fire-and-forget (not recommended for production)
        this.handleBackgroundOperations(sessionId, response, currentChapterNumber, optimizerOutput.shouldTransition, userMessagePromise);
      }

      Logger.info(`✅ User input processed successfully`);
      return response;
    } catch (error) {
      Logger.error(`❌ Failed to process user input: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to process user input');
    }
  }

  /**
   * Handle background operations including future chapter updates at each step
   */
  private async handleBackgroundOperations(
    sessionId: string, 
    response: string, 
    currentChapterNumber: number, 
    shouldTransition: boolean,
    userMessagePromise: Promise<any>
  ): Promise<void> {
    try {
      // Ensure user message is stored before narrator response
      await userMessagePromise;

      // Store narrator response
      const narratorResponsePromise = this.db.createMessage(sessionId, 'narrator', response, currentChapterNumber);

      // Update future chapters at each step (not just on transitions)
      await this.updateFutureChaptersAtStep(sessionId);

      // Handle chapter transition if needed
      if (shouldTransition) {
        // Wait for narrator response to be stored first
        await narratorResponsePromise;
        await this.handleChapterTransition(sessionId);
      } else {
        // Just wait for narrator response to be stored
        await narratorResponsePromise;
      }

      Logger.info(`✅ Background operations completed for session ${sessionId}`);
    } catch (error) {
      Logger.error(`❌ Background operations failed for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      // Background operations failing shouldn't affect user experience
    }
  }

  /**
   * Update future chapters at each step based on current story progression
   */
  private async updateFutureChaptersAtStep(sessionId: string): Promise<void> {
    Logger.info(`🔮 UPDATING FUTURE CHAPTERS at step for session ${sessionId}`);

    try {
      // Get current story state
      const [storyModel, chapters] = await Promise.all([
        this.db.getStoryModelBySessionId(sessionId),
        this.chapterManager.getAllChapters(sessionId)
      ]);

      if (!storyModel || !chapters.current) {
        Logger.warn('Required data not found for future chapter update');
        return;
      }

      // Get current chapter progression to inform future planning
      const currentChapterMessages = await this.db.getChapterMessages(sessionId, chapters.current.chapter_number);
      
      // Only update if there's meaningful progression (at least a few exchanges)
      if (currentChapterMessages.length >= 2) {
        // Use current story progression to re-predict future chapters
        const predictorOutput = await this.storyPredictor.predictFutureChapters({
          storyModel,
          historyChapters: chapters.history
        });

        // Store updated future chapters
        await this.chapterManager.storeFutureChapters(sessionId, predictorOutput.futureChapters);

        Logger.info(`✅ Future chapters updated: ${predictorOutput.futureChapters.length} chapters planned`);
      } else {
        Logger.debug('Skipping future chapter update - not enough progression yet');
      }
    } catch (error) {
      Logger.error(`❌ Failed to update future chapters: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw - this is background operation
    }
  }

  /**
   * Handle chapter transition when signaled by optimizer
   */
  private async handleChapterTransition(sessionId: string): Promise<void> {
    Logger.info(`🔄 HANDLING CHAPTER TRANSITION for session ${sessionId}`);

    try {
      // Get data before transition
      const [storyModel, chapters] = await Promise.all([
        this.db.getStoryModelBySessionId(sessionId),
        this.chapterManager.getAllChapters(sessionId)
      ]);

      if (!storyModel || !chapters.current) {
        throw new Error('Required data not found for chapter transition');
      }

      // Transition to next chapter
      const { completed, newCurrent } = await this.chapterManager.handleChapterTransition(sessionId);

      if (completed && newCurrent) {
        // Update history and re-predict future chapters with new context
        const updatedHistory = [...chapters.history, completed];
        
        const predictorOutput = await this.storyPredictor.predictFutureChapters({
          storyModel,
          historyChapters: updatedHistory
        });

        // Store new future chapters
        await this.chapterManager.storeFutureChapters(sessionId, predictorOutput.futureChapters);

        Logger.info(`✅ Chapter transition complete: "${completed.title}" → "${newCurrent.title}"`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to handle chapter transition: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to handle chapter transition');
    }
  }

  /**
   * Get session status and information
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    const [storyModel, chapters] = await Promise.all([
      this.db.getStoryModelBySessionId(sessionId),
      this.chapterManager.getAllChapters(sessionId)
    ]);

    // Get messages from current chapter if available
    const currentChapterMessages = chapters.current 
      ? await this.db.getChapterMessages(sessionId, chapters.current.chapter_number)
      : [];

    return {
      storyModel,
      chapters,
      currentChapterMessages,
      currentChapter: chapters.current,
      historyCount: chapters.history.length,
      futureCount: chapters.future.length
    };
  }
} 