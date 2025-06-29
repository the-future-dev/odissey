import { World } from '../database/db-types';
import { StoryChapter } from './storyTypes';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { Logger, createTimer, getElapsed } from '../utils';

export class StoryChapterGenerator {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Generate initial story chapters from world context
   */
  async generateChapters(
    world: World, 
    completedChapters?: StoryChapter[]
  ): Promise<StoryChapter[]> {
    const timer = createTimer();
    const context = {
      component: 'StoryChapterGenerator',
      operation: 'GENERATE_CHAPTERS',
      worldId: world.id
    };

    // Generating story chapters

    try {
      const systemPrompt = this.createChapterGenerationPrompt();
      const userPrompt = this.createUserPrompt(world, completedChapters);

      const aiRequest: TextToTextRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        maxTokens: 5000
      };

      const response = await this.aiService.generateText(aiRequest);
      const chapters = this.parseChaptersFromResponse(response.content);

      // Story chapters generated successfully
      Logger.info(`StoryChapterGenerator completed - Generated ${chapters.length} chapters`, {
        component: 'StoryChapterGenerator',
        operation: 'GENERATE_CHAPTERS',
        metadata: { 
          worldId: world.id,
          chapterCount: chapters.length,
          chapters: chapters.map(ch => ({ id: ch.id, title: ch.title }))
        }
      });

      return chapters;
    } catch (error) {
      Logger.error('Chapter generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to generate story chapters');
    }
  }

  private createChapterGenerationPrompt(): string {
    return `You are a story author. Your objective is to immagine beforehead the next chapters of a story based on the story title, description and optionally past chapters.
The story you are narrating has the user as main character. Your objective is to maximize engagement with the best story for the user!
You are omniscent but you don't know how the user will act in your story therefore shape the chapters accordingly!
Shape an engaging story with some structure:
 - give some space to introduct the story and its characters via initial engagements
 - then develop the plot with its core evolution and challenges. Dont make this plain make it interesting, and engaging: surprise!
 - Finally the realization of the main challenge of the story.

Each chapter must follow this EXACT JSON format:
{
  "id": "chapter_X",
  "title": "Brief Title",
  "setting": "Location/environment",
  "plot": "Events / interactions / engagements / ... ",
  "character": "who does the user interacts with?",
  "theme": "Core theme",
  "conflict": "Main challenge",
  "outcome": "Chapter conclusion hypothesis"
}

CRITICAL REQUIREMENTS:
- Keep each field SHORT (30-40 words max)
- Generate exactly 4-12 chapters
- Create complete narrative arc - (beginning, evolution, conclusion)
- Return ONLY valid JSON array - no other text
- Ensure JSON is properly closed/terminated`;
  }

  private createUserPrompt(world: World, completedChapters?: StoryChapter[]): string {
    let prompt = `Create story chapters for: "${world.title}"\n\nWorld Description:\n${world.description || ''}`;
    
    if (completedChapters && completedChapters.length > 0) {
      prompt += `\n\nCompleted Chapters:\n${JSON.stringify(completedChapters, null, 2)}`;
    }
    
    return prompt;
  }

  private parseChaptersFromResponse(response: string): StoryChapter[] {
    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Handle truncated JSON by trying to fix common issues
      if (!cleanResponse.endsWith(']')) {
        // Try to find the last complete chapter object
        const lastBraceIndex = cleanResponse.lastIndexOf('}');
        if (lastBraceIndex > 0) {
          cleanResponse = cleanResponse.substring(0, lastBraceIndex + 1) + ']';
        }
      }

      const chapters = JSON.parse(cleanResponse);
      
      if (!Array.isArray(chapters)) {
        throw new Error('Response is not an array');
      }

      // Validate chapter structure
      return chapters.map((chapter, index) => {
        if (!chapter.id) chapter.id = `chapter_${index + 1}`;
        if (!chapter.title) chapter.title = `Chapter ${index + 1}`;
        if (!chapter.setting) chapter.setting = 'Unknown setting';
        if (!chapter.plot) chapter.plot = 'Plot to be determined';
        if (!chapter.character) chapter.character = 'Main character';
        if (!chapter.theme) chapter.theme = 'Adventure';
        if (!chapter.conflict) chapter.conflict = 'Unknown challenge';
        if (!chapter.outcome) chapter.outcome = 'To be continued';
        
        return chapter as StoryChapter;
      });
    } catch (error) {
      Logger.error('Failed to parse chapters from AI response', error, {
        component: 'StoryChapterGenerator',
        operation: 'PARSE_CHAPTERS',
        metadata: { responseLength: response.length }
      });

      throw error;
    }
  }
} 