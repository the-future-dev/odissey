import { Session, World, User } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';

import { StoryInitializer } from './storyInitializer';
import { ChapterManager } from './chapterManager';
import { StoryPredictor } from './storyPredictor';
import { StoryNarrator } from './storyNarrator';

/**
 * StoryService - Main interface for story interactions with flattened logic
 * Role: Coordinate all story agents and handle user interactions with continuous feedback
 */
export class StoryService {
  private db: DatabaseService;
  private aiService: AIServiceManager;
  
  // Agent instances
  private storyInitializer: StoryInitializer;
  private chapterManager: ChapterManager;
  private storyPredictor: StoryPredictor;
  private storyNarrator: StoryNarrator;

  constructor(db: DatabaseService, aiService: AIServiceManager) {
    this.db = db;
    this.aiService = aiService;
    
    // Initialize agents
    this.storyInitializer = new StoryInitializer(aiService, db);
    this.chapterManager = new ChapterManager(db);
    this.storyPredictor = new StoryPredictor(aiService);
    this.storyNarrator = new StoryNarrator(aiService, db);
    
    Logger.info('🎮 StoryService initialized with flattened logic');
  }

  /**
   * FIRST ENDPOINT: STORY INTITIALIZATION
   * Initialize new story session:
   * 1. generate new Story Model in the aristotelian way (see StoryModel)
   * 2. generate the new chapters
   * 3. execute DB operations
   */
  async initializeSession(session: Session, world: World, user: User, ctx?: ExecutionContext): Promise<void> {
    Logger.info(`🚀 INITIALIZING SESSION: ${session.id} with world "${world.title}"`);

    try {
      // Initialize StoryModel
      const storyModel = await this.storyInitializer.initializeStoryModel({
        session,
        world,
        user
      });

      // Generate initial chapters synchronously - user needs the first chapter to start
      const storyOutput = await this.storyPredictor.initializeChapters({
        storyModel,
        user
      });

      // Store chapters and set first as current
      await this.initializeChaptersWithFirstAsCurrent(session.id, storyOutput.currentChapter, storyOutput.futureChapters);

      Logger.info(`✅ Session initialized with current chapter + ${storyOutput.futureChapters.length} future chapters`);
    } catch (error) {
      Logger.error(`❌ Failed to initialize session: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize session');
    }
  }

  /**
   * SECOND ENDPOINT: STORY INTERACTION
   * 1. get the user choice
   * 2. generate story narration with simple, good interactions
   * 3. return story narration to the user
   * 4. in the background: feedback -> update current and future chapters
   */
  async processUserInput(sessionId: string, userInput: string, user: User, ctx?: ExecutionContext): Promise<string> {
    Logger.info(`💬 PROCESSING INPUT for session ${sessionId}`);

    try {
      // retrieve data of the current story session from the database
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

      // Get all messages from the current chapter and recent messages for feedback
      const [chapterMessages, recentMessages] = await Promise.all([
        this.db.getChapterMessages(sessionId, currentChapterNumber),
        this.db.getRecentSessionMessages(sessionId, 5)
      ]);

      const userMessagePromise = this.db.createMessage(sessionId, 'user', userInput, currentChapterNumber);

      const narratorOutput = await this.storyNarrator.generateNarrative({
        storyModel,
        currentChapter,
        recentMessages: chapterMessages,
        userInput,
        user
      });

      // Format response immediately
      const response = `${narratorOutput.response}\n\n1. ${narratorOutput.choices[0]}\n2. ${narratorOutput.choices[1]}\n3. ${narratorOutput.choices[2]}`;

      // FEEDBACK LOOP:
      // Run updateFutureChapters with the new: user input and narrator response
      const chapters = await this.chapterManager.getAllChapters(sessionId);
      const storyOutput = await this.storyPredictor.updateFutureChapters({
        storyModel,
        historyChapters: chapters.history,
        currentChapter: chapters.current || currentChapter,
        futureChapters: chapters.future,
        recentMessages,
        userInput,
        narratorResponse: narratorOutput.response,
        user
      });

      // Return response immediately for fastest user experience
      // Handle background operations asynchronously with ExecutionContext
      if (ctx) {
        Logger.info(`🔄 Scheduling background operations with ExecutionContext for session ${sessionId}`);
        ctx.waitUntil(this.handleBackgroundOperations(sessionId, response, currentChapterNumber, narratorOutput.shouldTransition, userMessagePromise, storyOutput));
      } else {
        Logger.warn(`⚠️  No ExecutionContext provided - background operations may be interrupted for session ${sessionId}`);
        // Fallback to fire-and-forget (not recommended for production)
        this.handleBackgroundOperations(sessionId, response, currentChapterNumber, narratorOutput.shouldTransition, userMessagePromise, storyOutput);
      }

      Logger.info(`✅ Generated response for session ${sessionId} with feedback loop`);
      return response;
    } catch (error) {
      Logger.error(`❌ Failed to process user input: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to process user input');
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

  /**
   * Initialize chapters with first chapter set as current
   */
  private async initializeChaptersWithFirstAsCurrent(
    sessionId: string, 
    currentChapter: { title: string, description: string }, 
    futureChapters: Array<{ title: string, description: string }>
  ): Promise<void> {
    Logger.info(`📚 INITIALIZING current chapter + ${futureChapters.length} future chapters`);

    try {
      // Create the first chapter as current
      const firstChapter = await this.db.createChapter(
        sessionId,
        1,
        currentChapter.title,
        currentChapter.description,
        'current'
      );

      Logger.info(`✅ First chapter created as current: "${firstChapter.title}"`);

      // Create remaining chapters as future
      if (futureChapters.length > 0) {
        const createdFutureChapters = [];
        for (let i = 0; i < futureChapters.length; i++) {
          const chapterData = futureChapters[i];
          const chapter = await this.db.createChapter(
            sessionId,
            i + 2, // Start from chapter 2
            chapterData.title,
            chapterData.description,
            'future'
          );
          createdFutureChapters.push(chapter);
        }

        Logger.info(`✅ Initialized ${createdFutureChapters.length} future chapters`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to initialize chapters: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize chapters');
    }
  }

  /**
   * Handle non-blocking background operations after response is sent
   */
  private async handleBackgroundOperations(
    sessionId: string, 
    response: string, 
    currentChapterNumber: number, 
    shouldTransition: boolean,
    userMessagePromise: Promise<any>,
    storyOutput?: any
  ): Promise<void> {
    try {
      // Ensure user message is stored before narrator response
      await userMessagePromise;

      // Store narrator response
      const narratorResponsePromise = this.db.createMessage(sessionId, 'narrator', response, currentChapterNumber);

      // Apply story modifications if provided
      if (storyOutput) {
        // Apply any current chapter modifications
        if (storyOutput.modifications.currentChapterModified) {
          await this.db.updateChapterTitleAndDescription(
            (await this.chapterManager.getCurrentChapter(sessionId))?.id!,
            storyOutput.currentChapter.title,
            storyOutput.currentChapter.description
          );
          Logger.info(`✅ Applied story feedback: Updated current chapter`);
        }

        // Apply future chapter modifications
        if (storyOutput.modifications.futureChaptersModified || storyOutput.modifications.newChaptersAdded) {
          await this.db.clearFutureChapters(sessionId);
          await this.chapterManager.storeFutureChapters(sessionId, storyOutput.futureChapters);
          Logger.info(`✅ Applied story feedback: Updated all future chapters`);
        }
      }

      // Handle chapter transition if needed (most expensive operation)
      if (shouldTransition) {
        // Wait for narrator response to be stored first
        await narratorResponsePromise;
        // Then handle chapter transition
        await this.handleChapterTransition(sessionId);
      } else {
        // Just wait for narrator response to complete
        await narratorResponsePromise;
      }

      Logger.info(`✅ Background operations completed for session ${sessionId}`);
    } catch (error) {
      Logger.error(`❌ Background operations failed for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      // Background operations failing shouldn't affect user experience
    }
  }

  /**
   * Handle chapter transition when signaled by optimizer
   * Now simplified - no longer calls StoryPredictor
   */
  private async handleChapterTransition(sessionId: string): Promise<void> {
    Logger.info(`🔄 HANDLING CHAPTER TRANSITION for session ${sessionId}`);

    try {
      // Transition to next chapter
      const { completed, newCurrent } = await this.chapterManager.handleChapterTransition(sessionId);

      if (completed && newCurrent) {
        Logger.info(`✅ Chapter transition complete: "${completed.title}" → "${newCurrent.title}"`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to handle chapter transition: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to handle chapter transition');
    }
  }
} 