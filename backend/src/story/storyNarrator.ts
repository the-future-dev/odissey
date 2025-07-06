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
1. Create an immersive narrative response: the user is LIVING the story!
2. In your narrative, you should follow this instruction: "${input.optimizerOutput.decomposition}"
3. Always end with exactly 3 choices for what the user can do next - be creative and engage the user!

Narrator Style:
- Write in a way that draws the user deeper into the story
- Use the present tense
- Use simple worlds, a friendly tone and a simple phrase format

Format your response as:
NARRATIVE: [Your immersive response describing what happens next]
CHOICES:
1. [Choice 1]
2. [Choice 2]
3. [Choice 3]`;

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
      
      // Extract narrative and choices
      const content = response.content;
      const narrativeMatch = content.match(/NARRATIVE:\s*([\s\S]*?)(?=\n\s*CHOICES:)/);
      const choicesMatch = content.match(/CHOICES:\s*([\s\S]*)/);
      
      if (!narrativeMatch || !choicesMatch) {
        throw new Error('Could not extract narrative and choices from response');
      }
      
      const narrative = narrativeMatch[1].trim();
      const choicesText = choicesMatch[1].trim();
      
      // Parse choices
      const choices = choicesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, ''));
      
      if (choices.length !== 3) {
        throw new Error('Expected exactly 3 choices');
      }

      const output: NarratorOutput = {
        response: narrative,
        choices
      };

      // Log what goes to the narrator
      console.log('\n🎬 NARRATOR INPUT:');
      console.log('='.repeat(60));
      console.log(`📝 Optimizer says: ${input.optimizerOutput.decomposition}`);
      console.log(`👤 User input: ${input.userInput}`);
      console.log(`📖 Chapter: ${input.currentChapter.title}`);
      console.log(`💬 Conversation history: ${input.recentMessages.length} messages`);
      console.log('='.repeat(60));

      Logger.info(`✅ Narrative generated successfully`);

      return output;
    } catch (error) {
      Logger.error(`❌ Failed to generate narrative: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate narrative');
    }
  }
} 