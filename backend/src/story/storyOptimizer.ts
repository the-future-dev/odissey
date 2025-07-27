import { StoryModel, Chapter, Message } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils/logger';
import { User } from '../database/db-types';

export interface OptimizerInput {
  storyModel: StoryModel;
  currentChapter: Chapter;
  recentMessages: Message[];
  userInput: string;
  user: User;
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

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Generate chapter decomposition - what should happen next
   */
  async optimizeStory(input: OptimizerInput): Promise<OptimizerOutput> {
    Logger.info(`🔧 STORY OPTIMIZER: Processing chapter "${input.currentChapter.title}"`);

    const systemPrompt = `You are a story teller.
Your task is to orchestrate the rhythm of a single chapter inside a story.
The user is the main character, and they just made a choice or took an action.

Use a sinusoidal pacing for the rhythm.
- Build tension gradually, then release it in satisfying peaks
- Each chapter follows: Reflection -> Rising Tension -> Climax -> Resolution -> Transition
1. INTRODUCTION: Introduce the chapter. Let the user explore and make him enter the story
2. RISING PHASE: Build tension gradually for the development of the chapter.
3. CLIMAX: The chapter core moment! Maximum engagement and involvement.
4. RESOLUTION: Conclude the chapter by releasing the tension of the climax.
5. TRANSITION: Put transition to YES and decomposition a way to transition to the next chapter!

Trigger chapter transition:
- if the climax will complete its cycle in the next user response
- if the past interaction with the user has diverged enough
- It is an interactive story therefore be flexible in how many back and forth the user has in each part of the rythm.

Your task is to generate ONE INPUT of what should happen in the single next step of the interactive story based on the pacing.


IMPORTANT: use explicitly the keywords DECOMPOSITION, TRANSITION and RYTHM; while you can change language for the content. Return your response as the following:
DECOMPOSITION: [one-line description for the single next narrator/user interaction]
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
      temperature: 0.5,
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