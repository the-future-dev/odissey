import { Session, Chapter } from '../database/db-types';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';

/**
 * Chapter Manager - Handles chapter transitions and stores future chapters
 * Role: Manages the chapter flow and triggers future chapter generation
 */
export class ChapterManager {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Get current chapter for a session
   */
  async getCurrentChapter(sessionId: string): Promise<Chapter | null> {
    Logger.info(`📚 CHAPTER MANAGER: Getting current chapter for session ${sessionId}`);

    try {
      const chapter = await this.db.getCurrentChapter(sessionId);
      
      if (chapter) {
        Logger.info(`✅ Found current chapter: "${chapter.title}"`);
      } else {
        Logger.info(`ℹ️  No current chapter found for session ${sessionId}`);
      }
      
      return chapter;
    } catch (error) {
      Logger.error(`❌ Failed to get current chapter: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get current chapter');
    }
  }

  /**
   * Get all chapters organized by status
   */
  async getAllChapters(sessionId: string): Promise<{ history: Chapter[], current: Chapter | null, future: Chapter[] }> {
    const [historyChapters, currentChapters, futureChapters] = await Promise.all([
      this.db.getChaptersByStatus(sessionId, 'history'),
      this.db.getChaptersByStatus(sessionId, 'current'),
      this.db.getChaptersByStatus(sessionId, 'future')
    ]);

    return {
      history: historyChapters,
      current: currentChapters[0] || null,
      future: futureChapters
    };
  }

  /**
   * Handle chapter transition - move current to history and next future to current
   */
  async handleChapterTransition(sessionId: string): Promise<{ completed: Chapter | null, newCurrent: Chapter | null }> {
    Logger.info(`🔄 CHAPTER MANAGER: Handling chapter transition for session ${sessionId}`);

    try {
      // Get current chapter before transition
      const currentChapter = await this.getCurrentChapter(sessionId);
      
      if (!currentChapter) {
        Logger.warn('No current chapter found for transition');
        return { completed: null, newCurrent: null };
      }

      // Complete current chapter (move to history)
      await this.db.completeCurrentChapter(sessionId);

      // Set next chapter as current
      const newCurrentChapter = await this.db.setNextChapterAsCurrent(sessionId);

      Logger.info(`✅ Chapter transition: "${currentChapter.title}" → ${newCurrentChapter ? `"${newCurrentChapter.title}"` : 'No next chapter'}`);

      return {
        completed: currentChapter,
        newCurrent: newCurrentChapter
      };
    } catch (error) {
      Logger.error(`❌ Failed to handle chapter transition: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to handle chapter transition');
    }
  }

  /**
   * Store future chapters in the database
   */
  async storeFutureChapters(sessionId: string, chapters: Array<{ title: string, description: string }>): Promise<Chapter[]> {
    Logger.info(`📝 CHAPTER MANAGER: Storing ${chapters.length} future chapters`);

    try {
      // Clear existing future chapters first
      await this.db.clearFutureChapters(sessionId);

      // Get current highest chapter number
      const allChapters = await this.db.getAllChapters(sessionId);
      const nextChapterNumber = allChapters.length + 1;

      const createdChapters: Chapter[] = [];

      for (let i = 0; i < chapters.length; i++) {
        const chapterData = chapters[i];
        const chapter = await this.db.createChapter(
          sessionId,
          nextChapterNumber + i,
          chapterData.title,
          chapterData.description,
          'future'
        );
        createdChapters.push(chapter);
      }

      console.log('\n📖 FUTURE CHAPTERS STORED:');
      console.log('='.repeat(60));
      createdChapters.forEach(chapter => {
        console.log(`Chapter ${chapter.chapter_number}: ${chapter.title}`);
        console.log(`  └─ ${chapter.description}`);
      });
      console.log('='.repeat(60));

      Logger.info(`✅ Stored ${createdChapters.length} future chapters`);
      return createdChapters;
    } catch (error) {
      Logger.error(`❌ Failed to store future chapters: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to store future chapters');
    }
  }
} 