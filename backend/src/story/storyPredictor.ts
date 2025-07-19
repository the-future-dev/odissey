import { StoryModel, Chapter, Message } from '../database/db-types';
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

export interface FeedbackInput {
  storyModel: StoryModel;
  historyChapters: Chapter[];
  currentChapter: Chapter;
  futureChapters: Chapter[];
  recentMessages: Message[];
  userInput: string;
}

export interface FeedbackOutput {
  updatedCurrentChapter: {
    title: string;
    description: string;
  };
  updatedFutureChapters: Array<{
    title: string;
    description: string;
  }>;
  modifications: {
    currentChapterModified: boolean;
    futureChaptersModified: boolean;
    reasoning: string;
  };
}

/**
 * Story Predictor Agent - Computes future chapters and provides continuous feedback
 * Role: Plan the story's future direction and ensure coherence through feedback loops
 */
export class StoryPredictor {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Continuous feedback method for story refinement
   * Uses a greedy approach to ensure following the interactive storytelling path
   * while minimizing deviations from the initially defined story
   */
  async provideFeedback(input: FeedbackInput): Promise<FeedbackOutput> {
    Logger.info(`🔄 STORY PREDICTOR: Providing feedback for current chapter "${input.currentChapter.title}"`);

    const systemPrompt = `You are a master story architect and psychological narrative designer.

Your role is to continuously refine and enhance the story as it unfolds through user interactions. You are the guardian of narrative coherence and the architect of psychological depth.

CORE PRINCIPLES:
1. **Narrative Coherence**: Ensure the story remains true to its original vision while adapting to user choices
2. **Psychological Evolution**: Develop characters with authentic psychological arcs and growth
3. **Greedy Optimization**: Follow the most engaging path that user interactions are revealing
4. **Suspense Engineering**: Use advanced storytelling techniques (escamotages) to create compelling tension
5. **Adaptive Consistency**: Maintain thematic consistency while allowing organic story evolution

STORYTELLING ESCAMOTAGES (Advanced Techniques):
- **Foreshadowing Layers**: Plant subtle hints that pay off later
- **Psychological Mirrors**: Use secondary characters to reflect protagonist's internal conflicts
- **Dramatic Irony**: Create situations where the reader knows more than the character
- **Chekhov's Gun**: Introduce elements that will become crucial later
- **Red Herrings**: Mislead while maintaining fair play
- **Emotional Anchoring**: Tie plot developments to character emotional states
- **Symbolic Threading**: Weave symbolic elements throughout the narrative
- **Tension Oscillation**: Balance moments of relief with escalating stakes

ANALYSIS FRAMEWORK:
1. **Story Trajectory**: Where is the interactive story naturally heading?
2. **Character Psychology**: How should characters evolve based on recent interactions?
3. **Thematic Resonance**: Are we staying true to the core theme while exploring its depths?
4. **Pacing Dynamics**: How can we enhance the emotional rhythm?
5. **Narrative Gaps**: What elements need reinforcement or adjustment?

MODIFICATION RULES:
- NEVER alter completed chapters (history)
- CAN modify current chapter description to better serve the emerging narrative
- CAN restructure future chapters to follow the path user interactions are revealing
- MUST maintain overall story coherence and intended impact
- MUST enhance psychological depth and character development

Based on the user's latest action and the story's current trajectory, analyze if the current chapter and future chapters need adjustment to create a more compelling, coherent, and psychologically rich narrative.

Return your response as JSON:
{
  "updatedCurrentChapter": {
    "title": "Current chapter title (keep same if no change needed)",
    "description": "Enhanced description that better serves the emerging narrative"
  },
  "updatedFutureChapters": [
    {
      "title": "Future chapter title",
      "description": "Refined description that follows the interactive path"
    }
  ],
  "modifications": {
    "currentChapterModified": true/false,
    "futureChaptersModified": true/false,
    "reasoning": "Detailed explanation of why modifications were made and how they enhance the story"
  }
}`;

    const userPrompt = `STORY ANALYSIS REQUEST:

Original Story Framework:
- Core Theme: ${input.storyModel.core_theme_moral_message}
- Genre & Style: ${input.storyModel.genre_style_voice}
- Setting: ${input.storyModel.setting}
- Protagonist: ${input.storyModel.protagonist}
- Conflicts: ${input.storyModel.conflict_sources}
- Intended Impact: ${input.storyModel.intended_impact}

Story History (Completed Chapters):
${input.historyChapters.map(ch => `Chapter ${ch.chapter_number}: "${ch.title}"\n${ch.description}`).join('\n\n')}

Current Chapter:
Title: "${input.currentChapter.title}"
Description: ${input.currentChapter.description}

Future Chapters (Planned):
${input.futureChapters.map((ch, i) => `Chapter ${input.historyChapters.length + i + 2}: "${ch.title}"\n${ch.description}`).join('\n\n')}

Recent User Interactions:
${input.recentMessages.slice(-5).map(msg => `${msg.type}: ${msg.content}`).join('\n')}

Latest User Action: "${input.userInput}"

TASK: Analyze the story's current trajectory and provide feedback on whether the current chapter and future chapters need adjustment to create a more compelling, coherent, and psychologically rich narrative that follows the path the user interactions are revealing.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 8000
    };

    try {
      const response = await this.aiService.generateText(request);
      const feedbackData = extractJsonFromResponse(response.content);
      
      // Validate response structure
      if (!feedbackData.updatedCurrentChapter || !feedbackData.updatedFutureChapters || !feedbackData.modifications) {
        throw new Error('Invalid feedback response structure');
      }

      const output: FeedbackOutput = {
        updatedCurrentChapter: feedbackData.updatedCurrentChapter,
        updatedFutureChapters: feedbackData.updatedFutureChapters,
        modifications: feedbackData.modifications
      };

      // Log feedback results
      if (output.modifications.currentChapterModified || output.modifications.futureChaptersModified) {
        console.log('\n🔄 STORY PREDICTOR FEEDBACK:');
        console.log('='.repeat(70));
        console.log(`📝 Reasoning: ${output.modifications.reasoning}`);
        console.log(`🔄 Current Chapter Modified: ${output.modifications.currentChapterModified}`);
        console.log(`📚 Future Chapters Modified: ${output.modifications.futureChaptersModified}`);
        
        if (output.modifications.currentChapterModified) {
          console.log(`\n📖 Updated Current Chapter: "${output.updatedCurrentChapter.title}"`);
          console.log(`   Description: ${output.updatedCurrentChapter.description}`);
        }
        
        if (output.modifications.futureChaptersModified) {
          console.log(`\n📚 Updated Future Chapters: ${output.updatedFutureChapters.length} chapters`);
          output.updatedFutureChapters.forEach((ch, i) => {
            console.log(`   Chapter ${i + 1}: "${ch.title}"`);
            console.log(`   Description: ${ch.description}`);
          });
        }
        console.log('='.repeat(70));
      } else {
        Logger.info('✅ No story modifications needed - current trajectory is optimal');
      }

      return output;
    } catch (error) {
      Logger.error(`❌ Failed to provide story feedback: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to provide story feedback');
    }
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