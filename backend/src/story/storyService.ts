import { Session, World } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';
import { MPCStoryAgents } from './mpcAgents';

/**
 * StoryService - Main interface for story interactions
 * Role: Coordinate the MPC agents and handle user interactions
 */
export class StoryService {
  private db: DatabaseService;
  private aiService: AIServiceManager;
  private mpcAgents: MPCStoryAgents;

  constructor(db: DatabaseService, aiService: AIServiceManager) {
    this.db = db;
    this.aiService = aiService;
    this.mpcAgents = new MPCStoryAgents(db, aiService);
    
    Logger.info('🎮 StoryService initialized');
  }

  /**
   * Initialize new story session
   */
  async initializeSession(session: Session, world: World, ctx?: ExecutionContext): Promise<void> {
    Logger.info(`🎬 INITIALIZING STORY SESSION: ${session.id}`);
    
    try {
      await this.mpcAgents.initializeSessionWithChapters(session, world, ctx);
      Logger.info(`✅ Story session initialized successfully`);
    } catch (error) {
      Logger.error(`❌ Failed to initialize story session: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize story session');
    }
  }

  /**
   * Process user input and generate story response
   */
  async processUserInput(sessionId: string, userInput: string, ctx?: ExecutionContext): Promise<string> {
    Logger.info(`💬 PROCESSING USER INPUT: "${userInput.substring(0, 50)}..."`);
    
    try {
      const response = await this.mpcAgents.processUserInput(sessionId, userInput, ctx);
      Logger.info(`✅ User input processed successfully`);
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
    return await this.mpcAgents.getSessionStatus(sessionId);
  }
} 