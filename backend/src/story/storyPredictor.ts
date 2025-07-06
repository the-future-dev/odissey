import { StoryModel, Chapter } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils';
import { extractJsonFromResponse } from './mpcUtils';

export interface PredictorInput {
  storyModel: StoryModel;
  historyChapters: Chapter[];
  currentChapter: Chapter | null;
}

export interface PredictorOutput {
  futureChapters: Array<{
    title: string;
    description: string;
  }>;
}

/**
 * Story Predictor Agent - Computes future chapters based on story model and history
 * Role: Plan the story's future direction when chapters are completed
 */
export class StoryPredictor {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Predict future chapters based on story progression
   */
  async predictFutureChapters(input: PredictorInput): Promise<PredictorOutput> {
    const logTitle = input.currentChapter ? `"${input.currentChapter.title}"` : 'initial session setup';
    Logger.info(`🔮 STORY PREDICTOR: Computing future chapters after ${logTitle}`);

    const systemPrompt = `You are the Story Predictor. Your job is to plan what chapters should come next in the story.

You work as part of a team that creates interactive stories. ${input.currentChapter ? 'When a chapter is completed, you need to figure out what chapters should come next to continue the story properly.' : 'You\'re setting up the initial chapter plan for a new story session.'}

Story Framework you're working with:
- Core Theme: ${input.storyModel.core_theme_moral_message}
- Genre & Style: ${input.storyModel.genre_style_voice}
- Setting: ${input.storyModel.setting}
- Protagonist: ${input.storyModel.protagonist}
- Main Conflicts: ${input.storyModel.conflict_sources}
- Intended Impact: ${input.storyModel.intended_impact}

The user is the main character in this story. You're planning their future adventures to serve this story framework.

Your role in the bigger picture:
- You create the roadmap for future chapters
- You ensure the story builds toward the intended impact
- You provide variety and escalating stakes that match the genre and style
- You set up meaningful choices that develop the protagonist

Plan as many future chapters as needed to:
1. Continue the story naturally from where it currently stands
2. Build toward the story's intended impact and theme
3. Create escalating tension and stakes appropriate to the genre
4. Give the user meaningful choices and character growth
5. Lead to a satisfying conclusion that delivers the intended impact

Generate as many or as few chapters as the story naturally requires - don't limit yourself to a specific number. Some stories need more chapters, some need fewer.

For each chapter, provide:
- A compelling title that hints at what will happen
- A description that explains the chapter's purpose and main events

Write like you're planning an adventure for a friend, not like you're writing a textbook. Make each chapter sound exciting and important.

Return your response as a JSON array:
[
  {
    "title": "Chapter Title",
    "description": "What happens in this chapter and why it matters"
  }
]`;

    const historyContext = input.historyChapters.length > 0 
      ? input.historyChapters.map(ch => `"${ch.title}": ${ch.description}`).join('\n')
      : 'No previous chapters completed yet.';

    const currentChapterContext = input.currentChapter 
      ? `Current Chapter: "${input.currentChapter.title}"
Description: ${input.currentChapter.description}

Plan the next chapters that should come after the current chapter.`
      : `This is initial story setup - plan the first chapters to begin the adventure.`;

    const userPrompt = `${currentChapterContext}

Previous Chapters Completed:
${historyContext}

Make sure they build naturally toward the story's intended impact and give the user exciting challenges to face. Generate the right number of chapters for this story - no artificial limits.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 2000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      const futureChapters = extractJsonFromResponse(response.content);
      
      if (!Array.isArray(futureChapters) || futureChapters.length === 0) {
        throw new Error('Expected array of future chapters');
      }
      
      // Validate each chapter has required fields
      for (const chapter of futureChapters) {
        if (!chapter.title || !chapter.description) {
          throw new Error('Each chapter must have title and description');
        }
      }

      const output: PredictorOutput = {
        futureChapters
      };

      // Log the predictor output
      console.log('\n🔮 PREDICTOR OUTPUT:');
      console.log('='.repeat(70));
      futureChapters.forEach((chapter, index) => {
        console.log(`📚 Chapter ${index + 1}: ${chapter.title}`);
        console.log(`   └─ ${chapter.description}`);
      });
      console.log('='.repeat(70));

      Logger.info(`✅ Predicted ${futureChapters.length} future chapters`);

      return output;
    } catch (error) {
      Logger.error(`❌ Failed to predict future chapters: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to predict future chapters');
    }
  }
} 