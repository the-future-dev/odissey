import { StoryModel, Chapter, Message, User } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger } from '../utils';

export interface NarratorInput {
  storyModel: StoryModel;
  currentChapter: Chapter;
  recentMessages: Message[];
  userInput: string;
  user: User;
}

export interface NarratorOutput {
  response: string;
  choices: string[];
  shouldTransition: boolean;
}

/**
 * Story Narrator Agent - Provides engaging responses with 3 choice options and manages story flow
 * Role: Bring the story to life with immersive narration, meaningful choices, and simple interactions
 */
export class StoryNarrator {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
  }

  /**
   * Generate narrative response with 3 choices and determine chapter progression
   */
  async generateNarrative(input: NarratorInput): Promise<NarratorOutput> {
    Logger.info(`🎭 STORY NARRATOR: Creating response for "${input.currentChapter.title}"`);

    const systemPrompt = `You are a story narrator.

Your job is to create great interactions for the user, who is the protagonist of your story.
You have a current chapter that you prepared, but as the user interacts this might evolve so adapt accordingly:
Chapter Title: "${input.currentChapter.title}"
Chapter Description: ${input.currentChapter.description}

Your tasks:
- Create the single next interaction to push the chapter forward, following the story pacing guidelines
- Provide 3 choices to the user to continue the story
- When the chapter the interact

Narration Style:
- Use present tense and a SIMPLE, natural language
- Keep responses between 100-175 words
- **NEVER** repeat the user's choice or speak for the user
- Let the user choose what to say when the dialogue is needed

Story Pacing Guidelines:
- Troughout the back and forth from you and the user for this chapter, follow the following story rithm scheme: Introduction > Rising Tension > Climax > Resolution > Transition
- Build the rithm gradually one step at a time interation by iteration
- do not overload the user with too much new information for each interaction. The user knows only what you tell him!
- Transition when the current chapter's story is complete or the interaction has diverged from the chapter specifications

FORMAT:
- IMPORTANT: Format your response as valid JSON with these exact English keys: response, choices, shouldTransition
- for the CONTENT of the JSON use **language ${input.user.language}**
- follow this example (language italian):
\`\`\`json
{
  "response": "La tua narrazione",
  "choices": [
    "scelta 1 ",
    "scelta 2 ",
    "scelta 3 "
  ],
  "shouldTransition": true/false,
}
\`\`\`

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

    conversationMessages.push({ role: 'user', content: input.userInput });

    const request: TextToTextRequest = {
      messages: conversationMessages,
      temperature: 0.8,
      maxTokens: 1500
    };

    try {
      const response = await this.aiService.generateText(request);
      const content = response.content;

      console.log('\n🎭 NARRATOR OUTPUT:');
      console.log('='.repeat(60));
      console.log(`👤 User: ${input.userInput}`);
      console.log(`📖 Chapter: ${input.currentChapter.title}`);
      console.log('='.repeat(60));
      console.log(content);
      console.log('='.repeat(60));

      return await this.parseNarrativeResponse(content, input.currentChapter.id);
    } catch (error) {
      Logger.error(`❌ Failed to generate narrative: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate narrative');
    }
  }

  /**
   * Parse the AI response to extract narrative, choices, and transition decision
   */
  private async parseNarrativeResponse(content: string, chapterId: number): Promise<NarratorOutput> {
    try {
      // Parse JSON response
      const cleanJson = content.trim().replace(/^```json|```$/g, '').trim();
      const parsedResponse = JSON.parse(cleanJson);

      // Validate required fields
      if (!parsedResponse.response || !Array.isArray(parsedResponse.choices) || parsedResponse.choices.length !== 3) {
        throw new Error('Invalid JSON structure: missing narrative or choices');
      }

      if (typeof parsedResponse.shouldTransition !== 'boolean') {
        throw new Error('Invalid JSON structure: shouldTransition must be boolean');
      }

      const choices = parsedResponse.choices.map((choice: any) => String(choice).trim());
      const shouldTransition = parsedResponse.shouldTransition;
      const narrative = String(parsedResponse.response).trim();
      if (!narrative) {
        throw new Error('Narrative content is empty');
      }

      Logger.info(`✅ Narrative processed: ${shouldTransition ? 'TRANSITION' : 'CONTINUE'}`);

      return {
        response: narrative,
        choices,
        shouldTransition
      };

    } catch (error) {
      Logger.error(`❌ Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
      Logger.error(`📄 Raw content: ${content}`);
      
      throw new Error('Could not extract narrative from response');
    }
  }
}