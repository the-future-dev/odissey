import { StoryModel, Chapter, Message, User } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils';
import { extractJsonFromResponse } from './mpcUtils';

export interface InitializeChaptersInput {
  storyModel: StoryModel;
  user: User;
}

export interface UpdateFutureChaptersInput {
  storyModel: StoryModel;
  historyChapters: Chapter[];
  currentChapter: Chapter;
  futureChapters: Chapter[];
  recentMessages: Message[];
  userInput: string;
  narratorResponse: string;
  user: User;
}

export interface StoryPredictorOutput {
  currentChapter: {
    title: string;
    description: string;
  };
  futureChapters: Array<{
    title: string;
    description: string;
  }>;
  modifications: {
    currentChapterModified: boolean;
    futureChaptersModified: boolean;
    newChaptersAdded: boolean;
    reasoning: string;
  };
}

/**
 * Story Predictor Agent - Manages the chapters of the story
 * Functionality:
 * - Initialize story chapters
 * - Update them based on user interactions
 */
export class StoryPredictor {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Unified system prompt for full functionality
   */
  private getSystemPrompt(): string {
    return `You are an narrator.
Your job is to manage the chapters of an interactive story!

Your tasks:
- For story initialization: Create a complete roadmap of all chapters for the story
- For story updates: Update the current chapter and all future chapters based on user interactions

Task Guidelines:
- The user is the protagonist of this story therefore its input is fundamental for the specifics inside a chapter
- For the bigger picture, instead build the story towards the intended impact with non-trivial story development!
- Each chapter should be substantial enough for meaningful interaction
- Add/remove chapters naturally as the story demands
- inside the current chapter: make MINIMAL changes to encompass ALL what actually changed
- Process the user inputs to be meaningful in the story: with great impact on the current chapter but also with the next ones
- Given the interactive nature of the current story telling be flexible: ex: allow for new character introduction.

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no markdown, no additional text.

Format your response as valid JSON with double-quoted property names:
{
  "currentChapter": {
    "title": "Current/First chapter title",
    "description": "Description of the current/first chapter"
  },
  "futureChapters": [
    {
      "title": "Future chapter title",
      "description": "Description of future chapter"
    }
  ],
  "modifications": {
    "currentChapterModified": true,
    "futureChaptersModified": false,
    "newChaptersAdded": false,
    "reasoning": "Brief explanation of what changed and why"
  }
}`;
  }

  /**
   * Update future chapters based on story progression and user interactions
   */
  async updateFutureChapters(input: UpdateFutureChaptersInput): Promise<StoryPredictorOutput> {
    Logger.info(`🔄 STORY PREDICTOR: Updating future chapters for current chapter "${input.currentChapter.title}"`);

    const userPrompt = `STORY UPDATE REQUEST:

Original Story Framework:
- Core Theme: ${input.storyModel.core_theme_moral_message}
- Genre & Style: ${input.storyModel.genre_style_voice}
- Setting: ${input.storyModel.setting}
- Protagonist: ${input.storyModel.protagonist}
- Conflicts: ${input.storyModel.conflict_sources}
- Intended Impact: ${input.storyModel.intended_impact}

Previously Completed Chapters:
${input.historyChapters.map(ch => `Chapter ${ch.chapter_number}: "${ch.title}"\n${ch.description}`).join('\n\n')}

Current Chapter:
Title: "${input.currentChapter.title}"
Description: ${input.currentChapter.description}

Future Chapters (Planned):
${input.futureChapters.map((ch, i) => `Chapter ${input.historyChapters.length + i + 2}: "${ch.title}"\n${ch.description}`).join('\n\n')}

Recent User Interactions:
${input.recentMessages.slice(-5).map(msg => `${msg.type}: ${msg.content}`).join('\n')}

New information:
- Latest User Action: "${input.userInput}"
- Latest Narrator Response: "${input.narratorResponse}"

TASK: Update the current chapter to encompass the new interactions and adjust all future chapters to ensure story coherence. Add or remove chapters as naturally needed for the story progression.`;

    return await this.processStoryRequest(userPrompt, 'update', input.user);
  }

  /**
   * Initialize chapters for a new story
   */
  async initializeChapters(input: InitializeChaptersInput): Promise<StoryPredictorOutput> {
    Logger.info(`🔮 STORY PREDICTOR: Initializing chapters for new story`);

    const userPrompt = `STORY INITIALIZATION REQUEST:

Story Configuration:
- Core Theme: ${input.storyModel.core_theme_moral_message}
- Genre & Style: ${input.storyModel.genre_style_voice}
- Setting: ${input.storyModel.setting}
- Protagonist: ${input.storyModel.protagonist}
- Main Conflicts: ${input.storyModel.conflict_sources}
- Intended Impact: ${input.storyModel.intended_impact}

TASK: Create a complete chapter roadmap for this interactive story. The first chapter will be the current chapter where the user begins their adventure, and the future chapters should provide a comprehensive path to achieve the story's intended impact.`;

    return await this.processStoryRequest(userPrompt, 'initialization', input.user);
  }

  /**
   * Unified processing method for both initialization and updates
   */
  private async processStoryRequest(userPrompt: string, context: 'initialization' | 'update', user: User): Promise<StoryPredictorOutput> {
    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 10000
    };

    try {
      const response = await this.aiService.generateText(request);
      const storyData = extractJsonFromResponse(response.content);
      
      // Validate response structure
      if (!storyData.currentChapter || !storyData.futureChapters || !storyData.modifications) {
        throw new Error('Invalid story response structure');
      }

      // Validate each future chapter has required fields
      if (!Array.isArray(storyData.futureChapters)) {
        throw new Error('Future chapters must be an array');
      }
      
      for (const chapter of storyData.futureChapters) {
        if (!chapter.title || !chapter.description) {
          throw new Error('Each chapter must have title and description');
        }
      }

      const output: StoryPredictorOutput = {
        currentChapter: storyData.currentChapter,
        futureChapters: storyData.futureChapters,
        modifications: storyData.modifications
      };

      // Log the results
      if (context === 'initialization') {
        console.log('\n🔮 STORY PREDICTOR - STORY INITIALIZATION:');
        console.log('='.repeat(80));
        console.log(`📖 CURRENT Chapter: "${output.currentChapter.title}"`);
        console.log(`   Description: ${output.currentChapter.description}`);
        console.log(`\n📚 Generated ${output.futureChapters.length} future chapters:`);
        console.log('-'.repeat(80));
        
        output.futureChapters.forEach((chapter, index) => {
          console.log(`📖 Chapter ${index + 2}: "${chapter.title}"`);
          console.log(`   Description: ${chapter.description}`);
          console.log('-'.repeat(80));
        });
        console.log('='.repeat(80));
      } else {
        // Update context logging
        if (output.modifications.currentChapterModified || output.modifications.futureChaptersModified || output.modifications.newChaptersAdded) {
          console.log('\n🔄 STORY PREDICTOR - FUTURE CHAPTERS UPDATE:');
          console.log('='.repeat(70));
          console.log(`📝 Reasoning: ${output.modifications.reasoning}`);
          console.log(`🔄 Current Chapter Modified: ${output.modifications.currentChapterModified}`);
          console.log(`📚 Future Chapters Modified: ${output.modifications.futureChaptersModified}`);
          console.log(`✨ New Chapters Added: ${output.modifications.newChaptersAdded}`);
          
          if (output.modifications.currentChapterModified) {
            console.log(`\n📖 Updated Current Chapter: "${output.currentChapter.title}"`);
            console.log(`   Description: ${output.currentChapter.description}`);
          }
          
          // console.log(`\n📚 All Future Chapters (${output.futureChapters.length} total):`);
          // output.futureChapters.forEach((ch, i) => {
          //   console.log(`   Chapter ${i + 1}: "${ch.title}"`);
          //   console.log(`   Description: ${ch.description}`);
          // });
          // console.log('='.repeat(70));
        } else {
          Logger.info('✅ No story modifications needed - current trajectory is optimal');
        }
      }

      Logger.info(`✅ Story ${context} completed: Current + ${output.futureChapters.length} future chapters`);
      return output;
    } catch (error) {
      Logger.error(`❌ Failed to process story ${context}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to process story ${context}`);
    }
  }
} 