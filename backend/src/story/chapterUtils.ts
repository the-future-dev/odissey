import { Message, World } from '../database/db-types';
import { StoryChapter } from './storyTypes';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger, createTimer, getElapsed } from '../utils';

export class ChapterUtils {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Analyze recent conversation to determine if current chapter should be completed
   */
  async isChapterComplete (
    currentChapter: StoryChapter,
    recentMessages: Message[],
    world: World
  ): Promise<{ shouldComplete: boolean; reason?: string }> {
    const timer = createTimer();
    const context = {
      component: 'ChapterUtils',
      operation: 'SHOULD_COMPLETE_CHAPTER',
      chapterId: currentChapter.id,
      worldId: world.id
    };

    // Analyzing chapter completion

    try {
      const systemPrompt = this.createAnalysisPrompt(currentChapter, world);
      const conversationSummary = this.buildConversationSummary(recentMessages);

      const aiRequest: TextToTextRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this conversation:\n\n${conversationSummary}` }
        ],
        temperature: 0.0,
        maxTokens: 5000
      };

      const response = await this.aiService.generateText(aiRequest);
      const analysis = this.parseAnalysisResponse(response.content);

      // Chapter analysis completed
      Logger.info("CHAPTER UTILS -> Response: " + response.content);

      return analysis;
    } catch (error) {
      Logger.error('Chapter analysis failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      
      // Default to not completing on error
      return { shouldComplete: false, reason: 'Analysis failed' };
    }
  }

  private createAnalysisPrompt(chapter: StoryChapter, world: World): string {
    return `You are a story analysis expert. Your task is to determine if a chapter should be completed based on the conversation flow.

CHAPTER CONTEXT:
- Title: ${chapter.title}
- Setting: ${chapter.setting}
- Plot: ${chapter.plot}
- Theme: ${chapter.theme}
- Conflict: ${chapter.conflict}
- Expected Outcome: ${chapter.outcome}

WORLD: ${world.title}
${world.description || ''}

ANALYSIS CRITERIA:
A chapter should be completed when:
1. The main conflict of the chapter has been resolved or significantly advanced
2. The expected outcome has been achieved or clearly changed direction
3. The story has reached a natural transition point
4. The user's actions have led to a meaningful conclusion for this chapter's theme

RESPONSE FORMAT:
Respond with ONLY:
COMPLETE: YES/NO
REASON: [brief explanation in 1-2 sentences]

Example:
COMPLETE: YES
REASON: The user has successfully resolved the conflict with the village elder and gained the magical artifact, completing the chapter's main objective.`;
  }

  private buildConversationSummary(messages: Message[]): string {
    // Get the last 8 messages for analysis
    const recentMessages = messages.slice(-8);
    
    let summary = '';
    for (const message of recentMessages) {
      const speaker = message.type === 'user' ? 'USER' : 'NARRATOR';
      summary += `${speaker}: ${message.content}\n\n`;
    }

    return summary;
  }

  private parseAnalysisResponse(response: string): { shouldComplete: boolean; reason?: string } {
    try {
      const lines = response.trim().split('\n');
      let shouldComplete = false;
      let reason = '';

      for (const line of lines) {
        if (line.startsWith('COMPLETE:')) {
          const value = line.replace('COMPLETE:', '').trim().toUpperCase();
          shouldComplete = value === 'YES';
        } else if (line.startsWith('REASON:')) {
          reason = line.replace('REASON:', '').trim();
        }
      }

      return { shouldComplete, reason };
    } catch (error) {
      Logger.error('Failed to parse analysis response', error, {
        component: 'ChapterUtils',
        operation: 'PARSE_ANALYSIS_RESPONSE',
        metadata: { responseLength: response.length }
      });
      
      return { shouldComplete: false, reason: 'Parse error' };
    }
  }

  /**
   * Advance to the next chapter and update session state
   */
  async advanceToNextChapter(
    sessionId: string,
    currentChapterIndex: number,
    chapters: StoryChapter[]
  ): Promise<{ advanced: boolean; nextChapterIndex?: number }> {
    const nextIndex = currentChapterIndex + 1;
    
    if (nextIndex >= chapters.length) {
      // Story completed - no more chapters
      
      return { advanced: false };
    }

    // Advancing to next chapter

    return { advanced: true, nextChapterIndex: nextIndex };
  }
} 