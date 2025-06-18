import { World, Message } from '../types';
import { AdaptivePromptService, AdaptivePromptRequest } from './adaptivePromptService';

export interface SystemPromptContext {
  world: World;
  worldState: string;
  recentMessages: Message[];
  sessionDuration?: number;
}

export interface StoryPhase {
  name: string;
  description: string;
  responseStructure: string;
  lengthGuidance: string;
  focusAreas: string[];
}

export interface DynamicPromptContext {
  currentPhase: StoryPhase;
  storyMetrics: StoryMetrics;
  adaptiveInstructions: string;
}

export interface StoryMetrics {
  totalExchanges: number;
}

export class SystemPromptService {
  private storyPhases: Map<string, StoryPhase> = new Map();
  private adaptivePromptService?: AdaptivePromptService;

  constructor(adaptivePromptService?: AdaptivePromptService) {
    this.adaptivePromptService = adaptivePromptService;
    this.initializeStoryPhases();
  }

  /**
   * Generate a dynamic system prompt based on story evolution
   */
  async generateSystemPrompt(context: SystemPromptContext): Promise<string> {
    // Analyze current story state to determine phase
    const storyMetrics = this.analyzeStoryMetrics(context);
    const currentPhase = this.detectStoryPhase(storyMetrics);
    
    // Build layered prompt
    const basePrompt = this.generateBasePrompt(context);
    const phasePrompt = this.generatePhasePrompt(currentPhase);
    const adaptivePrompt = await this.generateAdaptivePrompt(context, storyMetrics);
    
    return this.combinePromptLayers(basePrompt, phasePrompt, adaptivePrompt);
  }

  /**
   * Generate base storytelling framework
   */
  private generateBasePrompt(context: SystemPromptContext): string {
    const stateContext = this.generateStateContext(context.worldState);

    return `You are a master storyteller guiding the user through an interactive adventure in the world of "${context.world.title}".

WORLD DESCRIPTION:
${context.world.description || 'An interactive adventure world'}

CURRENT WORLD STATE:
${stateContext}

CORE STORYTELLING PRINCIPLES:

NARRATOR IDENTITY & PERSPECTIVE:
- You are the omniscient narrator speaking directly to the reader as "you"
- Break the fourth wall - address the audience directly and include them in the story
- Create immediate immersion through second-person perspective
- Make the reader feel they are the protagonist of this world
- Tease and challenge the reader about what comes next

RESPONSE STRUCTURE REQUIREMENTS:
- MINIMUM 150 words, MAXIMUM 400 words per response
- Structure each response in 3-4 paragraphs:
  1. SCENE SETTING: Vivid environmental/situational description
  2. THEMATIC ENGAGEMENT: Build engagement by developing the story's core themes, events, and world elements that draw the reader deeper into the narrative.
  3. ACTION/DIALOGUE: Events, and optionally character interactions
  4. CHOICE PRESENTATION: Exactly 3 meaningful options

INTERACTIVE MECHANICS:
- Always end with EXACTLY 3 meaningful choices for the reader.
- Each choice should lead to distinctly different narrative paths
- Present choices that feel consequential and intriguing
- Build on whichever choice the reader selects in your next response

CHOICE FORMATTING REQUIREMENTS - YOUR LIFE DEPENDS ON YOU FOLLOWING THIS INSTRUCTIONS:
- ALWAYS format choices EXACTLY as: "\n1) [choice text]"
- ALWAYS format choices EXACTLY as: "\n2) [choice text]"  
- ALWAYS format choices EXACTLY as: "\n3) [choice text]"
- Use newline + number + closing parenthesis + space + choice description
`;
  }

  /**
   * Analyze story metrics to understand current narrative state
   */
  private analyzeStoryMetrics(context: SystemPromptContext): StoryMetrics {
    const totalExchanges = context.recentMessages.length / 2; // Approximate user-AI pairs
    
    return {
      totalExchanges,
     };
  }

  /**
   * Determine current story phase based on metrics
   */
  private detectStoryPhase(metrics: StoryMetrics): StoryPhase {
    // Opening phase: First few exchanges, world building
    if (metrics.totalExchanges <= 3) {
      return this.storyPhases.get('opening')!;
    }
    
    // Rising action: Building complexity and conflict
    if (metrics.totalExchanges <= 8) {
      return this.storyPhases.get('rising')!;
    }

    // Resolution approach: Winding down or building to finale
    if (metrics.totalExchanges > 16) {
      return this.storyPhases.get('resolution')!;
    }
    
    // Default to development phase
    return this.storyPhases.get('development')!;
  }

  /**
   * Generate phase-specific prompt guidance
   */
  private generatePhasePrompt(phase: StoryPhase): string {
    return `
CURRENT STORY PHASE: ${phase.name.toUpperCase()}
${phase.description}

RESPONSE STRUCTURE FOR THIS PHASE:
${phase.responseStructure}

LENGTH GUIDANCE:
${phase.lengthGuidance}

FOCUS AREAS:
${phase.focusAreas.map(area => `- ${area}`).join('\n')}`;
  }

  /**
   * Generate adaptive prompt instructions using AI-powered analysis
   */
  private async generateAdaptivePrompt(
    context: SystemPromptContext, 
    metrics: StoryMetrics
  ): Promise<string> {
    let adaptiveInstructions = '\nADAPTIVE INSTRUCTIONS:\n';
    
    // Use AI-powered adaptive prompting if available
    if (this.adaptivePromptService) {
      try {
        const currentPhase = this.detectStoryPhase(metrics);
        const aiInstructions = await this.adaptivePromptService.generateAdaptiveInstructions({
          world: context.world,
          recentMessages: context.recentMessages,
          storyMetrics: metrics,
          currentPhase: currentPhase.name
        });
        
        adaptiveInstructions += aiInstructions + '\n';
      } catch (error) {
        // Fall back to rule-based instructions if AI fails
        adaptiveInstructions += this.generateRuleBasedInstructions(metrics);
      }
    } else {
      // Use rule-based instructions as fallback
      adaptiveInstructions += this.generateRuleBasedInstructions(metrics);
    }
    
    return adaptiveInstructions;
  }

  /**
   * Generate rule-based adaptive instructions as fallback
   */
  private generateRuleBasedInstructions(metrics: StoryMetrics): string {
    let instructions = '';
    
    instructions += '- Maintain rich sensory descriptions and emotional depth\n';
    instructions += '- Reference established world elements naturally\n';
    
    return instructions;
  }

  /**
   * Combine all prompt layers into final system prompt
   */
  private combinePromptLayers(
    basePrompt: string, 
    phasePrompt: string, 
    adaptivePrompt: string
  ): string {
    return `${basePrompt}

${phasePrompt}

${adaptivePrompt}

CRITICAL FINAL REMINDERS:
- ALWAYS write in vivid, immersive second person ("you")
- NEVER write single sentences - aim for 150-400 words 
- ALWAYS end with exactly 3 numbered choices in format: "\n1) text", "\n2) text", "\n3) text"
- CREATE atmosphere and engagement in every response
- MAINTAIN story continuity and world consistency

Remember: You're crafting an experience, not just telling events. Make every word count toward immersion and engagement.`;
  }

  /**
   * Initialize story phase definitions
   */
  private initializeStoryPhases(): void {
    this.storyPhases = new Map();
    
    this.storyPhases.set('opening', {
      name: 'Opening',
      description: 'World introduction and character establishment phase',
      responseStructure: 'Focus on vivid scene setting, introduce key elements, establish tone and atmosphere',
      lengthGuidance: 'Target 200-300 words to establish rich context',
      focusAreas: [
        'Immersive world-building and sensory details',
        'Character introduction and initial intrigue',
        'Establishing story tone and genre conventions',
        'Setting up initial mysteries or conflicts'
      ]
    });
    
    this.storyPhases.set('rising', {
      name: 'Rising Action',
      description: 'Complexity building and character development phase',
      responseStructure: 'Balance action with character moments, introduce complications',
      lengthGuidance: 'Target 180-250 words with good pacing',
      focusAreas: [
        'Character development and relationship dynamics',
        'Plot complication and obstacle introduction',
        'World expansion and detail layering',
        'Building toward major conflicts'
      ]
    });
    
    this.storyPhases.set('development', {
      name: 'Development',
      description: 'Story deepening and subplot exploration phase',
      responseStructure: 'Explore consequences of choices, develop subplots',
      lengthGuidance: 'Target 150-280 words with subplot focus',
      focusAreas: [
        'Exploring consequences of previous choices',
        'Subplot development and character arcs',
        'Mystery deepening and clue revelation',
        'Emotional stakes escalation'
      ]
    });
    
    this.storyPhases.set('climax', {
      name: 'Climax',
      description: 'High tension and major conflict resolution phase',
      responseStructure: 'Intense action, major revelations, high stakes decisions',
      lengthGuidance: 'Target 200-350 words with high intensity',
      focusAreas: [
        'Maximum tension and dramatic intensity',
        'Major revelations and plot twists',
        'Character defining moments and choices',
        'Stakes at their highest point'
      ]
    });
    
    this.storyPhases.set('resolution', {
      name: 'Resolution',
      description: 'Conflict resolution and story conclusion phase',
      responseStructure: 'Resolve major conflicts, provide closure while maintaining engagement',
      lengthGuidance: 'Target 180-320 words balancing resolution with continuation',
      focusAreas: [
        'Major conflict resolution',
        'Character arc completion',
        'Mystery and question answering',
        'Setting up potential new adventures'
      ]
    });
  }

  private generateStateContext(worldState: string): string {
    if (!worldState || worldState.trim() === '') {
      return 'The adventure is just beginning, but already, you sense that nothing here is quite what it seems...';
    }

    return worldState;
  }
}