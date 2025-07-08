import { StoryModel, Chapter, Message } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';

export interface OptimizerInput {
  storyModel: StoryModel;
  currentChapter: Chapter;
  recentMessages: Message[];
  userInput: string;
}

export interface OptimizerOutput {
  decomposition: string;
  shouldTransition: boolean;
}

/**
 * Story Optimizer Agent - Reads current chapter and generates what should happen next
 * Role: Decide what happens next in the story and signal when to move to next chapter
 */
export class StoryOptimizer {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
  }

  /**
   * Generate chapter decomposition - what should happen next
   */
  async optimizeStory(input: OptimizerInput): Promise<OptimizerOutput> {
    Logger.info(`🔧 STORY OPTIMIZER: Processing chapter "${input.currentChapter.title}"`);

    const systemPrompt = `You are the Story Optimizer. Your job is to orchestrate the emotional rhythm of the story using sinusoidal pacing and close the chapter after the climax.
You work as part of a team that creates interactive stories. The user is the main character, and they just made a choice or took an action. Your role is to control the story's emotional intensity like a conductor controlling an orchestra.

Your core responsibility: Create a SINUSOIDAL PACING PATTERN
- Each chapter follows: Reflection → Rising Tension → Climax → Resolution → Transition
- Oscillate between moments of calm introspection and intense action
- Build tension gradually, then release it in satisfying peaks
- The climax pattern triggers chapter transitions

SINUSOIDAL RHYTHM GUIDE:
1. INTRODUCTION: Introduce the chapter, perhaps more description, no hurry, let the user explore and make him enter the story
2. RISING PHASE: Build tension, gradually but constantly, start the development of the chapter.
3. CLIMAX: Time to get to the chapter core, act on it! Maximum engagement and involvement.
4. RESOLUTION: Solve the suspense!
5. TRANSITION: Put transition to YES and decomposition a way to transition to the next chapter!

- New characters in the chapter can be introduced at any time.
- It is an interactive story therefore be flexible in how many back and forth the user has in each part of the rythm.

Based on the current chapter history, write ONE INPUT to describe what should happen next.

Return your response as:
DECOMPOSITION: [your one-line description matching the needed emotional intensityfor the single next narrator/user interaction]
TRANSITION: [YES or NO]
RYTHM: [INTRODUCTION or RISING or CLIMAX or RESOLUTION or TRANSITION]`;

    const userPrompt = `Current Chapter: "${input.currentChapter.title}"
Chapter Description: ${input.currentChapter.description}

Current Story Context:
${input.storyModel.setting}

User just did: "${input.userInput}"

Recent events:
${input.recentMessages.slice(-3).map(msg => `${msg.type}: ${msg.content}`).join('\n')}

What should happen next?`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      maxTokens: 1000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      // Extract decomposition and transition decision
      const content = response.content;
      const decompositionMatch = content.match(/DECOMPOSITION:\s*(.+)/);
      const transitionMatch = content.match(/TRANSITION:\s*(YES|NO)/);
      const rhythmMatch = content.match(/RYTHM:\s*(INTRODUCTION|RISING|CLIMAX|RESOLUTION|TRANSITION)/);
      
      if (!decompositionMatch) {
        throw new Error('Could not extract decomposition from response');
      }
      
      const decomposition = decompositionMatch[1].trim();
      const shouldTransition = transitionMatch ? transitionMatch[1] === 'YES' : false;
      const rhythm = rhythmMatch ? rhythmMatch[1] : '-UNDEFINED-';

      // Update the chapter with the new decomposition
      await this.db.updateChapterDecomposition(input.currentChapter.id, decomposition);

      const output: OptimizerOutput = {
        decomposition,
        shouldTransition
      };

      // Log the optimizer output
      console.log('\n🎯 OPTIMIZER OUTPUT:');
      console.log('='.repeat(50));
      console.log(`📝 Decomposition: ${decomposition}`);
      console.log(`📈 Rhythm: ${rhythm}`);
      console.log(`🔄 Should Transition: ${shouldTransition ? 'YES' : 'NO'}`);
      console.log('='.repeat(50));

      Logger.info(`✅ Story optimization complete: ${shouldTransition ? 'TRANSITION' : 'CONTINUE'}`);

      return output;
    } catch (error) {
      Logger.error(`❌ Failed to optimize story: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to optimize story');
    }
  }
} 