import { Chapter } from './db-types';
import { Logger } from '../utils/logger';

export class ChapterDbService {
  constructor(private db: D1Database) {
    Logger.info('ChapterDbService initialized', {
      component: 'ChapterDbService',
      operation: 'INIT'
    });
  }

  async createChapter(
    sessionId: string,
    chapterNumber: number,
    title: string,
    description: string,
    status: 'history' | 'current' | 'future',
    decomposition?: string
  ): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        INSERT INTO chapters (
          session_id, chapter_number, title, description, status, decomposition
        ) VALUES (?, ?, ?, ?, ?, ?) RETURNING *
      `)
      .bind(sessionId, chapterNumber, title, description, status, decomposition || null)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to create chapter');
    }
    
    return result;
  }

  async getCurrentChapter(sessionId: string): Promise<Chapter | null> {
    return await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? AND status = ? LIMIT 1')
      .bind(sessionId, 'current')
      .first<Chapter>();
  }

  async getChaptersByStatus(sessionId: string, status: 'history' | 'current' | 'future'): Promise<Chapter[]> {
    const result = await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? AND status = ? ORDER BY chapter_number ASC')
      .bind(sessionId, status)
      .all<Chapter>();
    
    return result.results || [];
  }

  async getAllChapters(sessionId: string): Promise<Chapter[]> {
    const result = await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? ORDER BY chapter_number ASC')
      .bind(sessionId)
      .all<Chapter>();
    
    return result.results || [];
  }

  async updateChapterStatus(chapterId: number, status: 'history' | 'current' | 'future'): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(status, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter status');
    }
    
    return result;
  }

  async updateChapterDecomposition(chapterId: number, decomposition: string): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET decomposition = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(decomposition, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter decomposition');
    }
    
    return result;
  }

  async updateChapterDescription(chapterId: number, description: string): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(description, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter description');
    }
    
    return result;
  }

  async updateChapterTitleAndDescription(chapterId: number, title: string, description: string): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(title, description, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter title and description');
    }
    
    return result;
  }

  async completeCurrentChapter(sessionId: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE chapters 
        SET status = 'history', updated_at = CURRENT_TIMESTAMP 
        WHERE session_id = ? AND status = 'current'
      `)
      .bind(sessionId)
      .run();
  }

  async setNextChapterAsCurrent(sessionId: string): Promise<Chapter | null> {
    const nextChapter = await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? AND status = ? ORDER BY chapter_number ASC LIMIT 1')
      .bind(sessionId, 'future')
      .first<Chapter>();
    
    if (nextChapter) {
      return await this.updateChapterStatus(nextChapter.id, 'current');
    }
    
    return null;
  }

  async clearFutureChapters(sessionId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM chapters WHERE session_id = ? AND status = ?')
      .bind(sessionId, 'future')
      .run();
  }
}
