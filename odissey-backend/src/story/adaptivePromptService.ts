import { Message, World } from '../types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { StoryMetrics } from './systemPromptService';
import { Logger } from '../utils';

export interface AdaptivePromptRequest {
  world: World;
  recentMessages: Message[];
  storyMetrics: StoryMetrics;
  currentPhase: string;
}

export class AdaptivePromptService {
  private aiService: AIServiceManager;

  constructor(aiService: AIServiceManager) {
    this.aiService = aiService;
  }

  /**
   * Generate adaptive prompt instructions based on story context
   */
  async generateAdaptiveInstructions(request: AdaptivePromptRequest): Promise<string> {
    try {
      const prompt = this.buildAnalysisPrompt(request);
      
      const aiRequest: TextToTextRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are a master narrative advisor who analyzes interactive stories and provides precise storytelling guidance.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent advice
        maxTokens: 200,
        streaming: false
      };

      const response = await this.aiService.generateText(aiRequest);
      return this.formatAdaptiveInstructions(response.content);
      
    } catch (error) {
      Logger.warn('Failed to generate adaptive instructions, using fallback', {
        component: 'AdaptivePromptService',
        operation: 'GENERATE_ADAPTIVE_INSTRUCTIONS',
        metadata: { error: (error as Error).message }
      });
      return this.generateFallbackInstructions(request);
    }
  }

  private buildAnalysisPrompt(request: AdaptivePromptRequest): string {
    const { world, recentMessages, storyMetrics, currentPhase } = request;
    
    // Get recent story content
    const recentContent = recentMessages
      .slice(-4)
      .map(m => `${m.type}: ${m.content}`)
      .join('\n');

    return `Analyze this interactive story and provide 3 specific narrative instructions:

WORLD: ${world.title}
GENRE: ${world.description?.substring(0, 100) || 'Adventure'}

CURRENT PHASE: ${currentPhase}
%

RECENT STORY CONTENT:
${recentContent}

Based on this analysis, provide exactly 3 specific instructions for the AI narrator to improve the next response. Focus on:
1. Pacing and tension management
2. Character/world element utilization  
3. Player engagement techniques

Format as:
- [Instruction 1]
- [Instruction 2] 
- [Instruction 3]

Keep each instruction under 20 words and actionable.`;
  }

  private formatAdaptiveInstructions(content: string): string {
    // Clean and format the AI response
    const lines = content.split('\n').filter(line => line.trim().startsWith('-'));
    
    if (lines.length === 0) {
      return '- Increase narrative engagement and sensory detail\n- Reference established world elements\n- Create compelling choice consequences';
    }
    
    return lines.slice(0, 3).join('\n');
  }

  private generateFallbackInstructions(request: AdaptivePromptRequest): string {
    const { storyMetrics, currentPhase } = request;
    const instructions = [];

    // Phase-based instructions
    switch (currentPhase.toLowerCase()) {
      case 'opening':
        instructions.push('- Establish vivid setting details');
        break;
      case 'rising':
        instructions.push('- Develop the story based on the world setting and the genre');
        break;
      case 'climax':
        instructions.push('- Climax the story around its themes');
        break;
      default:
        instructions.push('- Build momentum toward next major story beat');
    }
    
    return instructions.slice(0, 3).join('\n');
  }
} 