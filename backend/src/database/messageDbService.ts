import { Message } from './db-types';
import { Logger } from '../utils';
// type D1Database should be provided by your environment (e.g., Cloudflare D1)

export class MessageDbService {
  constructor(private db: D1Database) {
    Logger.info('MessageDbService initialized', {
      component: 'MessageDbService',
      operation: 'INIT'
    });
  }
  async createMessage(sessionId: string, type: 'user' | 'narrator', content: string, chapterNumber: number): Promise<Message> {
    const result = await this.db
      .prepare('INSERT INTO messages (session_id, type, content, chapter_number) VALUES (?, ?, ?, ?) RETURNING *')
      .bind(sessionId, type, content, chapterNumber)
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
    return (result.results || []).reverse();
  }

  async getChapterMessages(sessionId: string, chapterNumber: number): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? AND chapter_number = ? ORDER BY created_at ASC')
      .bind(sessionId, chapterNumber)
      .all<Message>();
    return result.results || [];
  }
}
