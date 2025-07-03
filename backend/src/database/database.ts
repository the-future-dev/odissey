import { User, World, Session, Message, StoryModel, StoryStep, StoryPrediction } from './db-types';
import { Logger } from '../utils';

export class DatabaseService {
  constructor(private db: D1Database) {
    Logger.info('DatabaseService initialized', {
      component: 'DatabaseService',
      operation: 'INIT'
    });
  }

  // === USER MANAGEMENT ===

  async createAnonymousUser(token: string, expiresAt: Date): Promise<User> {
    const result = await this.db
      .prepare('INSERT INTO users (token, expires_at) VALUES (?, ?) RETURNING *')
      .bind(token, expiresAt.toISOString())
      .first<User>();
    
    if (!result) {
      throw new Error('Failed to create user');
    }
    
    return result;
  }

  async getUserByToken(token: string): Promise<User | null> {
    const user = await this.db
      .prepare('SELECT * FROM users WHERE token = ? AND expires_at > CURRENT_TIMESTAMP')
      .bind(token)
      .first<User>();
    
    if (user) {
      // Update last_seen_at
      await this.db
        .prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(user.id)
        .run();
    }
    
    return user;
  }

  async validateUserToken(token: string): Promise<boolean> {
    const user = await this.getUserByToken(token);
    return user !== null;
  }

  async cleanupExpiredUsers(): Promise<void> {
    await this.db
      .prepare('DELETE FROM users WHERE expires_at < CURRENT_TIMESTAMP')
      .run();
  }

  // === WORLD MANAGEMENT ===

  async getWorldById(worldId: string): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ?')
      .bind(worldId)
      .first<World>();
  }

  async getAllWorlds(): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds ORDER BY id ASC')
      .all<World>();
    
    return result.results || [];
  }

  async createWorld(id: string, title: string, description?: string): Promise<World> {
    const result = await this.db
      .prepare('INSERT INTO worlds (id, title, description) VALUES (?, ?, ?) RETURNING *')
      .bind(id, title, description || null)
      .first<World>();
    
    if (!result) {
      throw new Error('Failed to create world');
    }
    
    return result;
  }

  // === SESSION MANAGEMENT ===

  async createSession(sessionId: string, userId: number, worldId: string): Promise<Session> {
    const result = await this.db
      .prepare('INSERT INTO sessions (id, user_id, world_id) VALUES (?, ?, ?) RETURNING *')
      .bind(sessionId, userId, worldId)
      .first<Session>();
    
    if (!result) {
      throw new Error('Failed to create session');
    }
    
    return result;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<Session>();
  }

  async getSessionWithUser(sessionId: string, userId: number): Promise<Session | null> {
    return await this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .first<Session>();
  }


  // === MESSAGE MANAGEMENT ===

  async createMessage(sessionId: string, type: 'user' | 'narrator', content: string): Promise<Message> {
    const result = await this.db
      .prepare('INSERT INTO messages (session_id, type, content) VALUES (?, ?, ?) RETURNING *')
      .bind(sessionId, type, content)
      .first<Message>();
    
    if (!result) {
      throw new Error('Failed to create message');
    }
    
    return result;
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
      .bind(sessionId, limit)
      .all<Message>();
    
    return result.results || [];
  }

  async getRecentSessionMessages(sessionId: string, count: number = 10): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(sessionId, count)
      .all<Message>();
    
    return (result.results || []).reverse(); // Return in chronological order
  }

  // === STORY MODEL MANAGEMENT ===

  async createStoryModel(
    sessionId: string,
    plot: string,
    characters: string,
    themeMoralMessage: string,
    conflict: string,
    setting: string,
    styleGenre: string,
    audienceEffect: string
  ): Promise<StoryModel> {
    const result = await this.db
      .prepare(`
        INSERT INTO story_models (
          session_id, plot, characters, theme_moral_message, conflict, 
          setting, style_genre, audience_effect
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
      `)
      .bind(sessionId, plot, characters, themeMoralMessage, conflict, setting, styleGenre, audienceEffect)
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

  async updateStoryModel(
    sessionId: string,
    updates: Partial<Omit<StoryModel, 'id' | 'session_id' | 'created_at' | 'updated_at'>>
  ): Promise<StoryModel> {
    const updateFields = [];
    const updateValues = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(sessionId);
    
    const query = `
      UPDATE story_models 
      SET ${updateFields.join(', ')} 
      WHERE session_id = ? 
      RETURNING *
    `;
    
    const result = await this.db
      .prepare(query)
      .bind(...updateValues)
      .first<StoryModel>();
    
    if (!result) {
      throw new Error('Failed to update story model');
    }
    
    return result;
  }

  // === STORY STEP MANAGEMENT ===

  async createStoryStep(
    sessionId: string,
    storyStep: string,
    contextUserInput: string,
    reasoning?: string
  ): Promise<StoryStep> {
    const result = await this.db
      .prepare(`
        INSERT INTO story_step (session_id, story_step, context_user_input, reasoning) 
        VALUES (?, ?, ?, ?) RETURNING *
      `)
      .bind(sessionId, storyStep, contextUserInput, reasoning || null)
      .first<StoryStep>();
    
    if (!result) {
      throw new Error('Failed to create story step');
    }
    
    return result;
  }

  // === STORY PREDICTION MANAGEMENT ===

  async clearStoryPredictions(sessionId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM story_predictions WHERE session_id = ?')
      .bind(sessionId)
      .run();
  }

  async createStoryPredictions(
    sessionId: string,
    predictions: Array<{ choiceNumber: 1 | 2 | 3; modelUpdate: any }>
  ): Promise<void> {
    // Clear existing predictions first
    await this.clearStoryPredictions(sessionId);

    // Insert new predictions
    for (const prediction of predictions) {
      await this.db
        .prepare(`
          INSERT INTO story_predictions (session_id, choice_number, predicted_model_update) 
          VALUES (?, ?, ?)
        `)
        .bind(sessionId, prediction.choiceNumber, JSON.stringify(prediction.modelUpdate))
        .run();
    }
  }

  async getStoryPredictionByChoice(sessionId: string, choiceNumber: 1 | 2 | 3): Promise<StoryPrediction | null> {
    return await this.db
      .prepare('SELECT * FROM story_predictions WHERE session_id = ? AND choice_number = ?')
      .bind(sessionId, choiceNumber)
      .first<StoryPrediction>();
  }

  // === UTILITY METHODS ===

  async initializeDatabase(): Promise<void> {
    Logger.info('Database initialization completed', {
      component: 'DatabaseService',
      operation: 'INIT_DB'
    });
  }
} 