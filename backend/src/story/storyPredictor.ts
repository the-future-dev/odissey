import { StoryModel, Chapter } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils';
import { extractJsonFromResponse } from './mpcUtils';

export interface PredictorInput {
  storyModel: StoryModel;
  historyChapters: Chapter[];
}

export interface PredictorOutput {
  futureChapters: Array<{
    title: string;
    description: string;
  }>;
  nextChapter: {
    title: string;
    description: string;
  };
}

/**
 * Story Predictor Agent - Computes future chapters based on story model and history
 * Role: Plan the story's future direction at initialization or when chapters are completed
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
    const isInitialization = input.historyChapters.length === 0;
    const logContext = isInitialization ? 'session initialization' : `completion of ${input.historyChapters.length} chapters`;
    
    Logger.info(`🔮 STORY PREDICTOR: Computing future chapters at ${logContext}`);

    const systemPrompt = `You are an experienced narrator.
Your job is to plan the future chapters of an interactive story.

Your task:
- Create a comprehensive roadmap of future chapters
- Build the story towards the intended impact
- Provide variety while maintaining genre consistency  
- The user is the protagonist of this story
- Generate as many chapters as needed to complete the story arc
- Each chapter should be substantial enough for meaningful interaction

IMPORTANT: Plan chapters that will come AFTER the current story state. If there are completed chapters, build upon them. If this is initialization, plan the beginning of the story.

Format your response as a JSON array of chapter objects:
[
  {
    "title": "Chapter Title (engaging but not spoiling)",
    "description": "Detailed description of what happens in this chapter and its purpose in the story"
  },
  {
    "title": "Chapter Title", 
    "description": "Description of the next chapter's events and story progression"
  }
]`;

    const historyContext = input.historyChapters.length > 0 
      ? `Completed Chapters:\n${input.historyChapters.map(ch => `Chapter ${ch.chapter_number}: "${ch.title}"\n${ch.description}`).join('\n\n')}`
      : 'No chapters completed yet - this is story initialization.';

    const contextDescription = isInitialization 
      ? 'Plan the opening chapters to begin this interactive adventure.'
      : `Plan the next chapters that should follow after the ${input.historyChapters.length} completed chapters.`;

    const userPrompt = `Story Configuration:
- Core Theme: ${input.storyModel.core_theme_moral_message}
- Genre & Style: ${input.storyModel.genre_style_voice}
- Setting: ${input.storyModel.setting}
- Protagonist: ${input.storyModel.protagonist}
- Main Conflicts: ${input.storyModel.conflict_sources}
- Intended Impact: ${input.storyModel.intended_impact}

Current Story State:
${historyContext}

Task: ${contextDescription}

Create engaging chapters that advance the story meaningfully while maintaining the established tone and direction.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 10000
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

      // Log the FULL chapters list as requested
      console.log('\n🔮 STORY PREDICTOR - FULL CHAPTERS FORWARD:');
      console.log('='.repeat(80));
      console.log(`📍 Context: ${logContext}`);
      console.log(`📚 Generated ${futureChapters.length} future chapters:`);
      console.log('-'.repeat(80));
      
      futureChapters.forEach((chapter, index) => {
        console.log(`📖 Chapter ${index + 1}: "${chapter.title}"`);
        console.log(`   Description: ${chapter.description}`);
        console.log('-'.repeat(80));
      });
      
      console.log(`🎯 NEXT CHAPTER TO ACTIVATE: "${futureChapters[0].title}"`);
      console.log(`   This will be the active chapter for user interaction.`);
      console.log('='.repeat(80));

      const output: PredictorOutput = {
        futureChapters,
        nextChapter: futureChapters[0]
      };

      Logger.info(`✅ Generated ${futureChapters.length} future chapters, next: "${futureChapters[0].title}"`);

      return output;
    } catch (error) {
      Logger.error(`❌ Failed to predict future chapters: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to predict future chapters');
    }
  }
} 