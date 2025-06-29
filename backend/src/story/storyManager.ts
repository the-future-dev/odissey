import { Message, Session, World } from '../database/db-types';
import { StoryChapter, SessionStoryState } from './storyTypes';
import { StoryChapterGenerator } from './storyChapterGenerator';
import { Narrator } from './narrator';
import { ChapterUtils } from './chapterUtils';
import { StoryService } from './storyService';
import { AIServiceManager } from '../ai/aiService';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';

export class StoryManager {
  private chapterGenerator: StoryChapterGenerator;
  private narrator: Narrator;
  private chapterUtils: ChapterUtils;
  private storyService: StoryService;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.chapterGenerator = new StoryChapterGenerator(aiService);
    this.narrator = new Narrator(aiService);
    this.chapterUtils = new ChapterUtils(aiService);
    this.storyService = new StoryService(aiService, db);
    this.db = db;
    
    // StoryManager initialized
  }

  /**
   * Initialize a new session with story chapters
   */
  async initializeSession(sessionId: string, world: World, ctx?: ExecutionContext): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'StoryManager',
      operation: 'INITIALIZE_SESSION',
      sessionId,
      worldId: world.id
    };

    // Initializing session with chapter structure

    try {
      // Get a session object for the storyService
      const session = await this.db.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Generate fast initial response using storyService
      const fastResponse = await this.storyService.generateResponse(
        "Let's begin this adventure!",
        session,
        world,
        []
      );

      // Launch background chapter generation (non-blocking) with proper waitUntil
      const backgroundPromise = this.generateChaptersInBackground(sessionId, world, context);
      
      if (ctx && ctx.waitUntil) {
        // Properly protect background processing with waitUntil
        ctx.waitUntil(backgroundPromise);
      }

      // Session initialized with fast response

      return fastResponse;
    } catch (error) {
      Logger.error('Session initialization failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to initialize story session');
    }
  }

  /**
   * Background chapter generation (non-blocking)
   */
  private async generateChaptersInBackground(sessionId: string, world: World, parentContext: any): Promise<void> {
    const timer = createTimer();
    const context = {
      ...parentContext,
      operation: 'BACKGROUND_CHAPTER_GENERATION',
    };

    Logger.info('Background chapter generation triggered', {
      ...context,
      sessionId,
      worldId: world.id
    });

    try {
      // Generate story chapters
      const chapters = await this.chapterGenerator.generateChapters(world);
      
      // Create session state
      const sessionState: SessionStoryState = {
        sessionId,
        chapters,
        activeChapterIndex: 0,
        completedChapters: []
      };

      // Save session state to database
      await this.db.saveSessionStoryState(sessionId, sessionState);

      Logger.info('Background chapter generation completed - Full chapters:', {
        ...context,
        sessionId,
        chapters: JSON.stringify(chapters, null, 2),
        duration: getElapsed(timer)
      });
    } catch (error) {
      Logger.error('Background chapter generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      // Don't throw - this is background processing
    }
  }

  /**
   * Process user message within the chapter-based story system
   */
  async processUserMessage(
    sessionId: string, 
    userMessage: string,
    world: World,
    recentMessages: Message[],
    ctx?: ExecutionContext
  ): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'StoryManager',
      operation: 'PROCESS_USER_MESSAGE',
      sessionId,
      worldId: world.id
    };

    // Processing user message
    Logger.info("\n\nINSIDE processUserMessage\n\n\n\n")
    
    try {
      // IMPLEMENTATION OF TODO 2:
      // If sessionState has NOT been initialized: default to storyService
      // Otherwise: use chapter-based system and check for chapter completion

      let sessionState = await this.db.getSessionStoryState(sessionId);
      
      if (!sessionState || !sessionState.chapters || sessionState.chapters.length === 0) {
        // No session state or chapters - use storyService fallback
        // Using storyService fallback - no chapter state available

        Logger.info("\n\nNO SESSION STATE\n\n")

        const session = await this.db.getSessionById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }

        return await this.storyService.generateResponse(
          userMessage,
          session,
          world,
          recentMessages
        );
      }

      Logger.info("\n\nYESSSSS \n\n\ SESSION STATE\n\n")
      // Chapter-based system is available
      const currentChapter = sessionState.chapters[sessionState.activeChapterIndex];
      
      const session = await this.db.getSessionById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
      
      // Generate narrator response for current chapter
      const narratorResponse = await this.storyService.generateResponseInChapter(
        userMessage,
        session,
        world,
        currentChapter,
        recentMessages
      );

      // Launch background chapter completion analysis with proper waitUntil
      const analysisPromise = this.analyzeChapterCompletionInBackground(
        sessionId,
        currentChapter,
        world,
        recentMessages,
        sessionState,
        context
      );
      
      if (ctx && ctx.waitUntil) {
        // Properly protect background processing with waitUntil
        ctx.waitUntil(analysisPromise);
      }

      // User message processed with chapter system

      return narratorResponse;
    } catch (error) {
      Logger.error('User message processing failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to process user message');
    }
  }

  /**
   * Background chapter completion analysis (non-blocking)
   */
  private async analyzeChapterCompletionInBackground(
    sessionId: string,
    currentChapter: StoryChapter,
    world: World,
    recentMessages: Message[],
    sessionState: SessionStoryState,
    parentContext: any
  ): Promise<void> {
    const timer = createTimer();
    const context = {
      ...parentContext,
      operation: 'BACKGROUND_CHAPTER_ANALYSIS',
    };

    // Starting background chapter completion analysis

    try {
      // Analyze if chapter should be completed
      const analysisResult = await this.chapterUtils.isChapterComplete(
        currentChapter,
        recentMessages,
        world
      );

      if (analysisResult.shouldComplete) {
        // Chapter completion detected

        // Advance to next chapter
        const advanceResult = await this.chapterUtils.advanceToNextChapter(
          sessionId,
          sessionState.activeChapterIndex,
          sessionState.chapters
        );

        if (advanceResult.advanced && advanceResult.nextChapterIndex !== undefined) {
          // Update session state with new chapter
          const updatedSessionState: SessionStoryState = {
            ...sessionState,
            activeChapterIndex: advanceResult.nextChapterIndex,
            completedChapters: [
              ...sessionState.completedChapters,
              currentChapter
            ]
          };

          await this.db.saveSessionStoryState(sessionId, updatedSessionState);

          // Chapter advanced successfully
        }
      }

    } catch (error) {
      Logger.error('Background chapter analysis failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      // Don't throw - this is background processing
    }
  }

  /**
   * Get current session state (for debugging/monitoring)
   */
  async getSessionState(sessionId: string): Promise<SessionStoryState | null> {
    return await this.db.getSessionStoryState(sessionId);
  }

  /**
   * Clear session state (cleanup)
   */
  async clearSessionState(sessionId: string): Promise<void> {
    await this.db.deleteSessionStoryState(sessionId);
    // Session state cleared
  }
} 