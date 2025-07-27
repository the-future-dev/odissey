import { StoryModel, Chapter, Message, User } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils/logger';
import { OptimizerOutput } from './storyOptimizer';

export interface NarratorInput {
  storyModel: StoryModel;
  currentChapter: Chapter;
  recentMessages: Message[];
  userInput: string;
  optimizerOutput: OptimizerOutput;
  user: User;
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

Your role is to generate the next interaction in the story, following this instruction for the next step of the narration: "${input.optimizerOutput.decomposition}".
End by prompting the user with three choices to engage the user and further develop the story.

Narrator Style:
- Use the present tense
- Use simple worlds, a friendly tone and a simple phrase format, but draw the user attention!
- **NEVER** repeat the user choice
- **NEVER** speak for the user inside your narration. ANY time the user is involved in a dialogue, make him DIRECTLY speak in it - prompt options of phrases to say!
- Use around 100-175 words


IMPORTANT: ANSWER IN ${input.user.language}!

FORMAT - at the end of the message use this exact format:

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
    // Find all lines that match the pattern "1.", "2.", "3."
    const lines = content.split('\n');
    const choicePattern = /^\s*(\d+)\.\s*(.+)$/;
    
    // Find the last occurrence of choices 1, 2, 3
    let lastChoice1Index = -1;
    let lastChoice2Index = -1;
    let lastChoice3Index = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(choicePattern);
      if (match) {
        const choiceNumber = parseInt(match[1]);
        if (choiceNumber === 1) lastChoice1Index = i;
        else if (choiceNumber === 2) lastChoice2Index = i;
        else if (choiceNumber === 3) lastChoice3Index = i;
      }
    }
    
    // Validate that we found all three choices and they appear consecutively
    if (lastChoice1Index === -1 || lastChoice2Index === -1 || lastChoice3Index === -1) {
      Logger.error(`❌ Failed to parse choices - not all choices found. Content: ${content}`);
      throw new Error('Could not find all three choices (1., 2., 3.) in response');
    }
    
    // Check if choices appear in order and consecutively
    if (lastChoice2Index !== lastChoice1Index + 1 || lastChoice3Index !== lastChoice2Index + 1) {
      Logger.error(`❌ Failed to parse choices - choices not consecutive. Content: ${content}`);
      throw new Error('Choices must appear consecutively in order 1., 2., 3.');
    }
    
    // Extract the choices
    const choices: string[] = [];
    for (let i = lastChoice1Index; i <= lastChoice3Index; i++) {
      const match = lines[i].match(choicePattern);
      if (match) {
        choices.push(match[2].trim());
      }
    }
    
    if (choices.length !== 3) {
      Logger.error(`❌ Failed to parse choices - expected 3 choices, got ${choices.length}. Content: ${content}`);
      throw new Error('Could not extract exactly 3 choices from response');
    }
    
    // Extract narrative (everything before the last choice block)
    const narrativeLines = lines.slice(0, lastChoice1Index);
    const narrative = narrativeLines.join('\n').trim();
    
    if (!narrative) {
      Logger.error(`❌ Failed to parse narrative - narrative is empty. Content: ${content}`);
      throw new Error('Narrative is empty');
    }
    
    Logger.info(`✅ Narrative parsed successfully`);
    return { response: narrative, choices };
  }


}