import { StoryModel, Chapter, Message, User } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger } from '../utils/logger';

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

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Generate narrative response with 3 choices and determine chapter progression
   */
  async generateNarrative(input: NarratorInput): Promise<NarratorOutput> {
    Logger.info(`🎭 STORY NARRATOR: Creating response for "${input.currentChapter.title}"`);

    const recentEvents = input.recentMessages.slice(-3).map(msg => `${msg.type}: ${msg.content}`).join('\n');

    const systemPrompt = `You are a story narrator.

Your job is to create great interactions for the user, who is the protagonist of your story.
You have a current chapter that you prepared, but as the user interacts this might evolve so adapt accordingly:
Chapter Title: "${input.currentChapter.title}"
Chapter Description: ${input.currentChapter.description}

Your tasks:
- Create the single next interaction to push the chapter forward, following the story pacing guidelines
- Provide 3 choices to the user to continue the story
- Decide if it's time to transition to the next chapter based on pacing

Narration Style:
- Use present tense and a SIMPLE, natural language
- Keep responses between 100-175 words
- **NEVER** repeat the user's choice or speak for the user
- Let the user choose what to say when dialogue is needed

Story Pacing Guidelines:
- Throughout the back and forth from you and the user for this chapter, follow this story rhythm scheme: Introduction > Rising Tension > Climax > Resolution > Transition
- Build the rhythm gradually one step at a time, interaction by interaction
- Do not overload the user with too much new information for each interaction. The user knows only what you tell them!
- Transition when the current chapter's story is complete (after resolution) or if the interaction has diverged from the chapter specifications

Recent events:
${recentEvents}

User just did: "${input.userInput}"

If there are no recent events, this is the start of the chapter. Make an introduction following these 5 key pillars:
1. Setting & Atmosphere – Describe where the user is and what it feels like using sensory details naturally (e.g., the red dust settles on your visor; it's quiet, too quiet).
2. Context & Background – Explain why the user is here and define the purpose of the story in the first sentences.
3. Conflict & Tension – Introduce what's at stake after setting the context, to build urgency.
4. Goal & Progress – Clarify what the user is trying to achieve, either defined here or let the user decide via choices.
5. Tone & Narrative Style – Match the tone to the genre (e.g., simple words for action, playful metaphors for drama). Keep it dynamic to spark curiosity. Offer only story-defining/important options in choices.

For subsequent interactions, continue building on the rhythm while adapting to user input.

FORMAT:
- IMPORTANT: Format your response as valid JSON with these exact English keys: response, choices, shouldTransition
- For the CONTENT of the JSON, use the user's language: ${input.user.language}
- Example (in Italian):
\`\`\`json
{
  "response": "La tua narrazione",
  "choices": [
    "scelta 1",
    "scelta 2",
    "scelta 3"
  ],
  "shouldTransition": true
}
\`\`\``;

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
      console.log(`👤 User input: ${input.userInput}`);
      console.log(`📖 Chapter: ${input.currentChapter.title}`);
      console.log(`💬 Conversation history: ${input.recentMessages.length} messages`);
      console.log('='.repeat(60));
      
      // Log the raw response for debugging
      console.log('\n🔍 RAW AI RESPONSE:');
      console.log('='.repeat(60));
      console.log(response.content);
      console.log('='.repeat(60));
      
      return this.parseNarrativeResponse(response.content);
    } catch (error) {
      Logger.error(`❌ Failed to generate narrative: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate narrative');
    }
  }

  /**
   * Parse the AI response to extract narrative, choices, and transition decision
   */
  private parseNarrativeResponse(content: string): NarratorOutput {
    try {
      // Parse JSON response
      const cleanJson = content.trim().replace(/^```json|```$/g, '').trim();
      const parsedResponse = JSON.parse(cleanJson);

      // Validate required fields
      if (!parsedResponse.response || !Array.isArray(parsedResponse.choices) || parsedResponse.choices.length !== 3) {
        throw new Error('Invalid JSON structure: missing response or exactly 3 choices');
      }

      if (typeof parsedResponse.shouldTransition !== 'boolean') {
        throw new Error('Invalid JSON structure: shouldTransition must be boolean');
      }

      const choices = parsedResponse.choices.map((choice: any) => String(choice).trim());
      const shouldTransition = parsedResponse.shouldTransition;
      const response = String(parsedResponse.response).trim();
      if (!response) {
        throw new Error('Response content is empty');
      }

      Logger.info(`✅ Narrative processed: ${shouldTransition ? 'TRANSITION' : 'CONTINUE'}`);

      return { response, choices, shouldTransition };
    } catch (error) {
      Logger.error(`❌ Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
      Logger.error(`📄 Raw content: ${content}`);
      
      throw new Error('Could not extract narrative from response');
    }
  }
}