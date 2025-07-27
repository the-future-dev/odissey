import { StoryModel } from './db-types';
import { Logger } from '../utils/logger';

export class StoryModelDbService {
  constructor(private db: D1Database) {
    Logger.info('StoryModelDbService initialized', {
      component: 'StoryModelDbService',
      operation: 'INIT'
    });
  }
  
  async createStoryModel(
    sessionId: string,
    coreThemeMoralMessage: string,
    genreStyleVoice: string,
    setting: string,
    protagonist: string,
    conflictSources: string,
    intendedImpact: string
  ): Promise<StoryModel> {
    const result = await this.db
      .prepare(`
        INSERT INTO story_models (
          session_id, core_theme_moral_message, genre_style_voice, 
          setting, protagonist, 
          conflict_sources, intended_impact
        ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *
      `)
      .bind(sessionId, coreThemeMoralMessage, genreStyleVoice, setting, protagonist, conflictSources, intendedImpact)
      .first<StoryModel>();
    
    if (!result) {
      throw new Error('Failed to create story model');
    }
    
    return result;
  }

  async getStoryModelBySessionId(sessionId: string): Promise<StoryModel | null> {
    return await this.db
      .prepare('SELECT * FROM story_models WHERE session_id = ?')
      .bind(sessionId)
      .first<StoryModel>();
  }
}
