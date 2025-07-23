import { StoryModel, Chapter, Message } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils';
import { OptimizerOutput } from './storyOptimizer';

export interface NarratorInput {
  storyModel: StoryModel;
  currentChapter: Chapter;
  recentMessages: Message[];
  userInput: string;
  optimizerOutput: OptimizerOutput;
}

export interface NarratorOutput {
  response: string;
  choices: string[];
}

/**
 * Story Narrator Agent - Provides engaging responses with 3 choice options
 * Role: Bring the story to life with immersive narration and meaningful choices
 */
export class StoryNarrator {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Generate narrative response with 3 choices
   */
  async generateNarrative(input: NarratorInput): Promise<NarratorOutput> {
    Logger.info(`🎭 STORY NARRATOR: Creating response for "${input.currentChapter.title}"`);

    const systemPrompt = `You are the story narrator. Your job is to shape the story for the user that is the protagonist in this story!

Your role is to:
1. Create an immersive response: the user is LIVING the story!
2. Follow this instruction for the next step of the narration: "${input.optimizerOutput.decomposition}"
3. End by prompting the user with three choices to engage the user and further develop the story:
for example you can propose to expand the instruction: "${input.optimizerOutput.decomposition}" or propose interesting evolvements or actions that would be natural to take in this environment.

Narrator Style:
- Write in a way that draws the user deeper into the story
- Use the present tense
- Use simple worlds, a friendly tone and a simple phrase format
- **NEVER** repeat the user choice
- **NEVER** speak for the user inside your narration. ANY time the user is involved in a dialogue, make him DIRECTLY speak in it - prompt options of phrases to say!
- Use around 100-175 words

FORMAT - at the end of the message use this exact format:
**Choose your next action:**
1. [choice 1]
2. [choice 2]
3. [choice 3]
`;

    // Build conversation history with proper message format
    const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add the full conversation history as user/assistant messages
    for (const msg of input.recentMessages) {
      if (msg.type === 'user') {
        conversationMessages.push({ role: 'user', content: msg.content });
      } else if (msg.type === 'narrator') {
        conversationMessages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Add the current user input
    conversationMessages.push({ role: 'user', content: input.userInput });

    const request: TextToTextRequest = {
      messages: conversationMessages,
      temperature: 0.8,
      maxTokens: 1500
    };

    try {
      const response = await this.aiService.generateText(request);
      
      // Log what goes to the narrator
      console.log('\n🎬 NARRATOR INPUT:');
      console.log('='.repeat(60));
      console.log(`📝 Optimizer says: ${input.optimizerOutput.decomposition}`);
      console.log(`👤 User input: ${input.userInput}`);
      console.log(`📖 Chapter: ${input.currentChapter.title}`);
      console.log(`💬 Conversation history: ${input.recentMessages.length} messages`);
      console.log('='.repeat(60));

      // Extract narrative and choices with robust parsing
      const content = response.content;
      
      // Log the raw response for debugging
      console.log('\n🔍 RAW AI RESPONSE:');
      console.log('='.repeat(60));
      console.log(content);
      console.log('='.repeat(60));
      
      return this.parseNarrativeResponse(content);
    } catch (error) {
      Logger.error(`❌ Failed to generate narrative: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate narrative');
    }
  }

  /**
   * Parse narrative response using the actual AI model format
   */
  private parseNarrativeResponse(content: string): NarratorOutput {
    // The AI model consistently outputs this format:
    // [narrative text]
    // **Choose your next action:**
    // 1. [choice 1]
    // 2. [choice 2]
    // 3. [choice 3]
    
    // Split on the choice header
    const parts = content.split(/\*\*Choose your next action:\*\*/i);
    
    if (parts.length !== 2) {
      Logger.error(`❌ Failed to parse narrative - expected format not found. Content: ${content}`);
      throw new Error('Could not extract narrative and choices from response');
    }
    
    // Extract narrative (everything before the choice header)
    const narrative = parts[0].trim();
    
    // Extract choices (everything after the choice header)
    const choicesText = parts[1].trim();
    
    // Parse numbered choices (1., 2., 3.)
    const choiceLines = choicesText.split('\n')
      .map(line => line.trim())
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(choice => choice.length > 0);
    
    if (choiceLines.length !== 3) {
      Logger.error(`❌ Failed to parse choices - expected 3 choices, got ${choiceLines.length}. Content: ${content}`);
      throw new Error('Could not extract exactly 3 choices from response');
    }
    
    if (!narrative) {
      Logger.error(`❌ Failed to parse narrative - narrative is empty. Content: ${content}`);
      throw new Error('Narrative is empty');
    }
    
    Logger.info(`✅ Narrative parsed successfully`);
    return { response: narrative, choices: choiceLines };
  }


} 