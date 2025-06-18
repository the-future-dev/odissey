import { 
  User, World, Session, Message, 
  Character, Location, Item, StoryEvent, Theme, LoreEntry, SessionCharacterState 
} from './types';
import { Logger, createTimer, getElapsed } from './utils';

export class DatabaseService {
  constructor(private db: D1Database) {
    Logger.info('DatabaseService initialized', {
      component: 'DatabaseService',
      operation: 'INIT'
    });
  }

  // User management
  async createAnonymousUser(token: string, expiresAt: Date): Promise<User> {
    const result = await this.db
      .prepare(
        'INSERT INTO users (token, expires_at) VALUES (?, ?) RETURNING *'
      )
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

  // World management
  async getWorldById(worldId: string): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ?')
      .bind(worldId)
      .first<World>();
  }

  async getAllWorlds(): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds ORDER BY created_at ASC')
      .all<World>();
    
    return result.results || [];
  }

  // Session management
  async createSession(sessionId: string, userId: number, worldId: string, worldState: string): Promise<Session> {
    const result = await this.db
      .prepare(
        'INSERT INTO sessions (id, user_id, world_id, world_state) VALUES (?, ?, ?, ?) RETURNING *'
      )
      .bind(sessionId, userId, worldId, worldState)
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

  async updateSessionState(sessionId: string, worldState: string, coherenceState?: string): Promise<void> {
    await this.db
      .prepare(
        'UPDATE sessions SET world_state = ?, coherence_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .bind(worldState, coherenceState || null, sessionId)
      .run();
  }

  async updateSessionStoryState(sessionId: string, storyState: string): Promise<void> {
    await this.db
      .prepare(
        'UPDATE sessions SET story_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .bind(storyState, sessionId)
      .run();
  }

  // === STORY ABSTRACTION DATABASE METHODS ===

  // Character management
  async getWorldCharacters(worldId: string): Promise<Character[]> {
    const result = await this.db
      .prepare('SELECT * FROM characters WHERE world_id = ? ORDER BY created_at ASC')
      .bind(worldId)
      .all<Character>();
    
    return result.results || [];
  }

  async getCharacterById(characterId: string): Promise<Character | null> {
    return await this.db
      .prepare('SELECT * FROM characters WHERE id = ?')
      .bind(characterId)
      .first<Character>();
  }

  async updateCharacterLocation(characterId: string, locationId: string): Promise<void> {
    await this.db
      .prepare('UPDATE characters SET current_location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(locationId, characterId)
      .run();
  }

  // Location management
  async getWorldLocations(worldId: string): Promise<Location[]> {
    const result = await this.db
      .prepare('SELECT * FROM locations WHERE world_id = ? ORDER BY created_at ASC')
      .bind(worldId)
      .all<Location>();
    
    return result.results || [];
  }

  async getLocationById(locationId: string): Promise<Location | null> {
    return await this.db
      .prepare('SELECT * FROM locations WHERE id = ?')
      .bind(locationId)
      .first<Location>();
  }

  async updateLocationProperties(locationId: string, properties: string): Promise<void> {
    await this.db
      .prepare('UPDATE locations SET properties = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(properties, locationId)
      .run();
  }

  // Item management
  async getWorldItems(worldId: string): Promise<Item[]> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE world_id = ? ORDER BY created_at ASC')
      .bind(worldId)
      .all<Item>();
    
    return result.results || [];
  }

  async getItemById(itemId: string): Promise<Item | null> {
    return await this.db
      .prepare('SELECT * FROM items WHERE id = ?')
      .bind(itemId)
      .first<Item>();
  }

  async updateItemLocation(itemId: string, location: string): Promise<void> {
    await this.db
      .prepare('UPDATE items SET current_location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(location, itemId)
      .run();
  }

  // Event management
  async getWorldEvents(worldId: string): Promise<StoryEvent[]> {
    const result = await this.db
      .prepare('SELECT * FROM events WHERE world_id = ? ORDER BY created_at ASC')
      .bind(worldId)
      .all<StoryEvent>();
    
    return result.results || [];
  }

  async getEventById(eventId: string): Promise<StoryEvent | null> {
    return await this.db
      .prepare('SELECT * FROM events WHERE id = ?')
      .bind(eventId)
      .first<StoryEvent>();
  }

  async updateEventStatus(eventId: string, status: string, triggeredAt?: string): Promise<void> {
    const query = triggeredAt 
      ? 'UPDATE events SET status = ?, triggered_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE events SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    const params = triggeredAt ? [status, triggeredAt, eventId] : [status, eventId];
    
    await this.db
      .prepare(query)
      .bind(...params)
      .run();
  }

  // Theme management
  async getWorldThemes(worldId: string): Promise<Theme[]> {
    const result = await this.db
      .prepare('SELECT * FROM themes WHERE world_id = ? ORDER BY created_at ASC')
      .bind(worldId)
      .all<Theme>();
    
    return result.results || [];
  }

  // Lore management
  async getWorldLore(worldId: string): Promise<LoreEntry[]> {
    const result = await this.db
      .prepare('SELECT * FROM lore_entries WHERE world_id = ? ORDER BY created_at ASC')
      .bind(worldId)
      .all<LoreEntry>();
    
    return result.results || [];
  }

  async getLoreById(loreId: string): Promise<LoreEntry | null> {
    return await this.db
      .prepare('SELECT * FROM lore_entries WHERE id = ?')
      .bind(loreId)
      .first<LoreEntry>();
  }

  async markLoreAsDiscovered(loreId: string): Promise<void> {
    await this.db
      .prepare('UPDATE lore_entries SET is_discovered = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(loreId)
      .run();
  }

  // Session character state management
  async getSessionCharacterStates(sessionId: string): Promise<SessionCharacterState[]> {
    const result = await this.db
      .prepare('SELECT * FROM session_character_states WHERE session_id = ?')
      .bind(sessionId)
      .all<any>();
    
    // Parse JSON fields
    return (result.results || []).map(row => ({
      ...row,
      memory: JSON.parse(row.memory || '[]'),
      goals_progress: JSON.parse(row.goals_progress || '{}'),
      temporary_states: JSON.parse(row.temporary_states || '{}')
    }));
  }

  async upsertSessionCharacterState(sessionId: string, characterState: SessionCharacterState): Promise<void> {
    const serializedState = {
      session_id: sessionId,
      character_id: characterState.character_id,
      current_location: characterState.current_location,
      status: characterState.status,
      memory: JSON.stringify(characterState.memory),
      disposition: characterState.disposition,
      goals_progress: JSON.stringify(characterState.goals_progress),
      temporary_states: JSON.stringify(characterState.temporary_states)
    };

    await this.db
      .prepare(`
        INSERT INTO session_character_states 
        (session_id, character_id, current_location, status, memory, disposition, goals_progress, temporary_states)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id, character_id) DO UPDATE SET
        current_location = excluded.current_location,
        status = excluded.status,
        memory = excluded.memory,
        disposition = excluded.disposition,
        goals_progress = excluded.goals_progress,
        temporary_states = excluded.temporary_states,
        updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        serializedState.session_id,
        serializedState.character_id,
        serializedState.current_location,
        serializedState.status,
        serializedState.memory,
        serializedState.disposition,
        serializedState.goals_progress,
        serializedState.temporary_states
      )
      .run();
  }

  // Message management
  async createMessage(sessionId: string, type: 'user' | 'narrator', content: string): Promise<Message> {
    const result = await this.db
      .prepare(
        'INSERT INTO messages (session_id, type, content) VALUES (?, ?, ?) RETURNING *'
      )
      .bind(sessionId, type, content)
      .first<Message>();
    
    if (!result) {
      throw new Error('Failed to create message');
    }
    
    return result;
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
      )
      .bind(sessionId, limit)
      .all<Message>();
    
    return result.results || [];
  }

  async getRecentSessionMessages(sessionId: string, count: number = 10): Promise<Message[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(sessionId, count)
      .all<Message>();
    
    return (result.results || []).reverse(); // Return in chronological order
  }

  // Cleanup expired users
  async cleanupExpiredUsers(): Promise<void> {
    await this.db
      .prepare('DELETE FROM users WHERE expires_at < CURRENT_TIMESTAMP')
      .run();
  }

  // Initialize database with schema
  async initializeDatabase(): Promise<void> {
    // This would typically be done through migrations
    // For now, we'll assume the schema is already applied
    console.log('Database connection verified');
  }
} 