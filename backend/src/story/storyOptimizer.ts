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

    const systemPrompt = `You are the Story Optimizer. Your job is to orchestrate the emotional rhythm of the story using sinusoidal pacing.

You work as part of a team that creates interactive stories. The user is the main character, and they just made a choice or took an action. Your role is to control the story's emotional intensity like a conductor controlling an orchestra.

Your core responsibility: Create a SINUSOIDAL PACING PATTERN
- Each chapter follows: Reflection → Rising Tension → Climax → Resolution → Transition
- Oscillate between moments of calm introspection and intense action
- Build tension gradually, then release it in satisfying peaks
- The climax pattern triggers chapter transitions

SINUSOIDAL RHYTHM GUIDE:
1. RISING PHASE (Build tension):
- Introduce complications or obstacles
- Create anticipation and uncertainty  
- Escalate stakes gradually
- Make the user feel increasing pressure

2. CLIMAX PHASE (Peak intensity):
- Major confrontation or revelation
- High-stakes decision points
- Emotional peaks (fear, triumph, discovery)
- User must act decisively

3. RESOLUTION PHASE (Release tension):
- Consequences of climax unfold
- Brief moment of relief or understanding
- Sets up transition to next chapter

The user is the protagonist driving this rhythm through their choices. Your job is to respond with escalating or de-escalating intensity based on where we are in the cycle.

Based on the current chapter and what the user just did, write ONE LINE that describes what should happen next. This should match the current emotional phase we need to be in.

CHAPTER TRANSITION TRIGGERS (move to next chapter when):
- We've completed a full cycle: reflection → tension → climax → resolution
- A major story beat has reached its natural conclusion
- The emotional intensity has peaked and resolved
- Setting or conflict focus needs to fundamentally shift

CONTINUE CURRENT CHAPTER when:
- We're still building toward the climax
- The current tension cycle isn't complete
- User is in the middle of dealing with immediate consequences

Return your response as:
DECOMPOSITION: [your one-line description matching the needed emotional intensityfor the single next narrator/user interaction]
TRANSITION: [YES or NO]`;

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
      
      if (!decompositionMatch) {
        throw new Error('Could not extract decomposition from response');
      }
      
      const decomposition = decompositionMatch[1].trim();
      const shouldTransition = transitionMatch ? transitionMatch[1] === 'YES' : false;

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