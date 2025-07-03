import { Message, Session, World, StoryModel } from '../database/db-types';
import { AIServiceManager } from '../ai/aiService';
import { TextToTextRequest } from '../ai/interfaces';
import { DatabaseService } from '../database/database';
import { Logger, createTimer, getElapsed } from '../utils';

export interface StoryInitializerInput {
  session: Session;
  world: World;
}

export interface StoryOptimizerInput {
  session: Session;
  world: World;
  storyModel: StoryModel;
  userInput: string;
  chatHistory: Message[];
}

export interface StoryNarratorInput {
  session: Session;
  world: World;
  storyModel: StoryModel;
  storyStep: string;
  userInput: string;
  chatHistory: Message[];
}

export interface StoryPredictorInput {
  session: Session;
  world: World;
  storyModel: StoryModel;
  storyStep: string;
  userInput: string;
  narratorResponse: string;
  chatHistory: Message[];
}

export class MPCStoryAgents {
  private aiService: AIServiceManager;
  private db: DatabaseService;

  constructor(aiService: AIServiceManager, db: DatabaseService) {
    this.aiService = aiService;
    this.db = db;
    
    Logger.info('MPCStoryAgents initialized', {
      component: 'MPCStoryAgents',
      operation: 'INIT'
    });
  }

  /**
   * Extract JSON content from markdown-formatted AI responses
   */
  private extractJsonFromResponse(responseContent: string): any {
    const context = {
      component: 'MPCStoryAgents',
      operation: 'EXTRACT_JSON'
    };

    try {
      // First, try to parse directly (in case no markdown formatting)
      return JSON.parse(responseContent);
    } catch (directParseError) {
      Logger.debug('Direct JSON parse failed, attempting markdown extraction', {
        ...context,
        metadata: { responseLength: responseContent.length }
      });

      try {
        // Look for JSON wrapped in markdown code blocks
        const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          Logger.debug('Found JSON in markdown code block', {
            ...context,
            metadata: { extractedLength: jsonMatch[1].length }
          });
          return JSON.parse(jsonMatch[1]);
        }

        // Look for JSON array wrapped in markdown code blocks
        const arrayMatch = responseContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (arrayMatch && arrayMatch[1]) {
          Logger.debug('Found JSON array in markdown code block', {
            ...context,
            metadata: { extractedLength: arrayMatch[1].length }
          });
          return JSON.parse(arrayMatch[1]);
        }

        // Try to find JSON-like content without markdown wrapper
        const jsonObjectMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          Logger.debug('Found JSON object without markdown wrapper', {
            ...context,
            metadata: { extractedLength: jsonObjectMatch[0].length }
          });
          return JSON.parse(jsonObjectMatch[0]);
        }

        const jsonArrayMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
          Logger.debug('Found JSON array without markdown wrapper', {
            ...context,
            metadata: { extractedLength: jsonArrayMatch[0].length }
          });
          return JSON.parse(jsonArrayMatch[0]);
        }

        Logger.error('No valid JSON found in response', new Error('JSON extraction failed'), {
          ...context,
          metadata: { 
            responsePreview: responseContent.substring(0, 200) + '...',
            responseLength: responseContent.length
          }
        });
        throw new Error('No valid JSON found in AI response');

      } catch (extractionError) {
        Logger.error('JSON extraction and parsing failed', extractionError, {
          ...context,
          metadata: { 
            originalError: directParseError instanceof Error ? directParseError.message : String(directParseError),
            responsePreview: responseContent.substring(0, 200) + '...',
            responseLength: responseContent.length
          }
        });
        throw new Error(`Failed to parse JSON from AI response: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
      }
    }
  }

  /**
   * StoryInitializer Agent - Initialize StoryModel from World description
   */
  async initializeStoryModel(input: StoryInitializerInput): Promise<StoryModel> {
    const timer = createTimer();
    const context = {
      component: 'MPCStoryAgents',
      operation: 'STORY_INITIALIZER',
      sessionId: input.session.id,
      metadata: { worldId: input.world.id }
    };

    Logger.info('Starting story model initialization', context);

    const systemPrompt = `You are the StoryInitializer agent. Your role is to analyze a story world and initialize a comprehensive story based on the key elements of tragic storytelling as defined below.

Based on the story title and description provided, you must create seven components of the StoryModel:

1. **Plot** - The structure of incidents of the story:
   - Focus on arrangement of events that will lead to catharsis
   - Consider potential for Peripeteia (reversal of fortune)
   - Plan for Anagnorisis (recognition/discovery moments)
   - Outline path toward Denouement (resolution through knowledge from suffering)

2. **Characters** - Development of the main character and supporting characters:
   - Define the tragic hero as "between extremes" - neither purely good nor evil
   - Identify the hamartia (error or frailty) that will drive the tragedy
   - Establish moral ambiguity that creates compelling conflict
   - Define motivations driven by "inner experience and individual emotion"

3. **Theme/Moral Message** - Central ethical and philosophical framework:
   - Define the moral purpose and cathartic goals
   - Establish what insights about existence the story will reveal
   - Plan how opposing moral claims will create conflict
   - Consider Hegelian reconciliation of ethical positions

4. **Conflict** - Primary tensions driving the narrative:
   - Determine if conflict is primarily internal (Romantic) or external (Classical)
   - Define opposing forces: fate vs. will, conscience vs. law, duty vs. desire
   - Establish how conflict embodies "strife of will with itself"

5. **Setting** - Unities of Time and Place:
   - Define temporal boundaries and constraints
   - Establish physical location and its symbolic significance
   - Consider how setting reinforces thematic elements
   - Plan unity of action within time/place constraints

6. **Style and Genre** - Literary and dramatic approach:
   - Determine if pure tragedy or blended genre elements
   - Define linguistic style (high tragic vs. mixed)
   - Establish tone: Apollonian restraint vs. Dionysian passion
   - Plan narrative voice and perspective

7. **Audience Effect** - Intended emotional and intellectual impact:
   - Plan specific pity and fear elements for catharsis
   - Define what enlightenment the audience should gain
   - Establish how moral purpose will be fulfilled
   - Consider both ethical and artistic satisfaction

RESPONSE FORMAT:
Return ONLY a valid JSON object with these exact keys:
{
  "plot": "detailed plot structure...",
  "characters": "character development plan...", 
  "theme_moral_message": "thematic framework...",
  "conflict": "conflict structure...",
  "setting": "time and place unities...",
  "style_genre": "literary approach...",
  "audience_effect": "intended impact..."
}`;

    const userPrompt = `Initialize a StoryModel for:

Title: "${input.world.title}"
Description: "${input.world.description || 'No description provided'}"

Create a comprehensive tragic narrative framework based on these elements.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      maxTokens: 10000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      Logger.debug('Raw AI response received', {
        ...context,
        metadata: { 
          responseLength: response.content.length,
          responsePreview: response.content.substring(0, 100) + '...'
        }
      });
      
      // Parse the JSON response using the extraction utility
      const storyModelData = this.extractJsonFromResponse(response.content);
      
      Logger.debug('JSON successfully extracted and parsed', {
        ...context,
        metadata: { 
          extractedFields: Object.keys(storyModelData),
          fieldCount: Object.keys(storyModelData).length
        }
      });
      
      // Create the story model in database
      const storyModel = await this.db.createStoryModel(
        input.session.id,
        storyModelData.plot,
        storyModelData.characters,
        storyModelData.theme_moral_message,
        storyModelData.conflict,
        storyModelData.setting,
        storyModelData.style_genre,
        storyModelData.audience_effect
      );

      Logger.info('Story model initialized successfully', {
        ...context,
        duration: getElapsed(timer)
      });

      return storyModel;
    } catch (error) {
      Logger.error('Story model initialization failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to initialize story model');
    }
  }

  /**
   * StoryOptimizer Agent - Generate single next step based on current model and state
   */
  async optimizeStoryStep(input: StoryOptimizerInput): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'MPCStoryAgents',
      operation: 'STORY_OPTIMIZER',
      sessionId: input.session.id,
      metadata: { 
        worldId: input.world.id,
        userInputLength: input.userInput.length,
        historyCount: input.chatHistory.length 
      }
    };

    Logger.info('Starting story optimization', context);

    const systemPrompt = `You are the StoryOptimizer agent in a Model Predictive Control storytelling system. Your role is to analyze the current StoryModel and story state, then output ONLY the single next step that best advances the tragic narrative.

You must consider:
- The current StoryModel elements (Plot, Characters, Theme, Conflict, Setting, Style/Genre, Audience Effect)
- The conversation history and current user input
- The tragic narrative principles (Aristotelian structure, catharsis, moral complexity)
- Future story development potential while focusing ONLY on the immediate next step

CRITICAL: Output only ONE story development step - not a full response or narrative. This step will be passed to the StoryNarrator to craft the actual response.

Your output should be a single, clear directive for the next single moment in the story.

Think strategically about the entire narrative arc but output only the immediate next step.`;

    const recentHistory = input.chatHistory.slice(-6).map(msg => 
      `[${msg.type.toUpperCase()}]: ${msg.content}`
    ).join('\n');

    const userPrompt = `CURRENT STORY MODEL:
Plot: ${input.storyModel.plot}
Characters: ${input.storyModel.characters}
Theme/Moral: ${input.storyModel.theme_moral_message}
Conflict: ${input.storyModel.conflict}
Setting: ${input.storyModel.setting}
Style/Genre: ${input.storyModel.style_genre}
Audience Effect: ${input.storyModel.audience_effect}

RECENT CONVERSATION:
${recentHistory}

CURRENT USER INPUT: "${input.userInput}"

What is the single next step to advance this narrative?`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
      maxTokens: 2000
    };

    try {
      const response = await this.aiService.generateText(request);
      const storyStep = response.content.trim();

      // Save the story step
      await this.db.createStoryStep(
        input.session.id,
        storyStep,
        input.userInput,
        'Generated by StoryOptimizer based on current model and state'
      );

      Logger.info('Story step optimized successfully', {
        ...context,
        duration: getElapsed(timer),
        metadata: { ...context.metadata, stepLength: storyStep.length }
      });

      return storyStep;
    } catch (error) {
      Logger.error('Story optimization failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to optimize story step');
    }
  }

  /**
   * StoryNarrator Agent - Generate narrative response based on story step and user input
   */
  async generateNarrativeResponse(input: StoryNarratorInput): Promise<string> {
    const timer = createTimer();
    const context = {
      component: 'MPCStoryAgents',
      operation: 'STORY_NARRATOR',
      sessionId: input.session.id,
      metadata: { 
        worldId: input.world.id,
        stepLength: input.storyStep.length,
        userInputLength: input.userInput.length 
      }
    };

    Logger.info('Starting narrative response generation', context);

    const systemPrompt = `You are the StoryNarrator agent. Your role is to craft the actual narrative response that the user will read, based on:
1. The optimization step provided by the StoryOptimizer
2. The user's input and choices
3. The current StoryModel framework

You must create an engaging, literary response that:
- Implements the story step provided by the optimizer
- Responds appropriately to the user's input
- Maintains consistency with the StoryModel elements
- Follows tragic narrative principles
- Provides exactly 3 meaningful choices for the user

RESPONSE STRUCTURE REQUIREMENTS:
- 200-300 words per response
- Use sophisticated language befitting the tragic genre
- Structure: Scene Setting → Event Development → Character Response → Choices
- End with exactly 3 numbered choices in the specified format

Your response should embody the StoryModel's:
- Plot development and tragic structure
- Character complexity and moral ambiguity  
- Thematic depth and moral questioning
- Conflict escalation (internal/external)
- Setting atmosphere and symbolic elements
- Style/genre consistency
- Intended audience effect (pity, fear, catharsis)

FORMAT - end with:
\`\`\`choice
1) [Option reflecting one moral/strategic path]
2) [Option reflecting alternative moral/strategic path] 
3) [Option reflecting third moral/strategic path]
\`\`\``;

    const recentHistory = input.chatHistory.slice(-4).map(msg => 
      `[${msg.type.toUpperCase()}]: ${msg.content}`
    ).join('\n');

    const userPrompt = `STORY OPTIMIZATION STEP: "${input.storyStep}"

CURRENT STORY MODEL:
Plot: ${input.storyModel.plot}
Characters: ${input.storyModel.characters}
Theme/Moral: ${input.storyModel.theme_moral_message}
Conflict: ${input.storyModel.conflict}
Setting: ${input.storyModel.setting}
Style/Genre: ${input.storyModel.style_genre}
Audience Effect: ${input.storyModel.audience_effect}

RECENT CONVERSATION:
${recentHistory}

USER INPUT: "${input.userInput}"

Craft a narrative response that implements the optimization step while responding to the user's choice.`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
      maxTokens: 2000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      Logger.info('Narrative response generated successfully', {
        ...context,
        duration: getElapsed(timer),
        metadata: { ...context.metadata, responseLength: response.content.length }
      });

      return response.content;
    } catch (error) {
      Logger.error('Narrative response generation failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      throw new Error('Failed to generate narrative response');
    }
  }

  /**
   * StoryPredictor Agent - Predict and apply model updates based on narrative outcome
   */
  async predictAndUpdateModel(input: StoryPredictorInput): Promise<void> {
    const timer = createTimer();
    const context = {
      component: 'MPCStoryAgents',
      operation: 'STORY_PREDICTOR',
      sessionId: input.session.id,
      metadata: { 
        worldId: input.world.id,
        responseLength: input.narratorResponse.length 
      }
    };

    Logger.info('Starting model prediction and update', context);

    const systemPrompt = `You are the StoryPredictor agent in a Model Predictive Control storytelling system. Your role is to analyze the narrative development and predict necessary updates to the StoryModel.

You must provide exactly 4 updates as a JSON array:
1. **Immediate Update**: Minimal, greedy changes to reflect what has ALREADY happened (user input + narrator response)
2. **Choice 1 Prediction**: Additional changes if the user chooses option 1
3. **Choice 2 Prediction**: Additional changes if the user chooses option 2  
4. **Choice 3 Prediction**: Additional changes if the user chooses option 3

Be GREEDY - only update fields that truly need changing. Minimal updates that reflect the full changes.

Consider for updates:
- Plot development and movement toward climax/resolution
- Character growth, moral development, or degradation
- Thematic reinforcement or evolution
- Conflict escalation or transformation
- Setting changes or symbolic development
- Style/genre consistency or intentional shifts
- Audience effect progression toward catharsis

RESPONSE FORMAT:
Return ONLY a valid JSON array with exactly 4 update objects:
[
  {
    "type": "immediate",
    "plot": "updated plot if changed...",
    "characters": "updated characters if changed...",
    "theme_moral_message": "updated theme if changed...",
    "conflict": "updated conflict if changed...",
    "setting": "updated setting if changed...",
    "style_genre": "updated style if changed...",
    "audience_effect": "updated effect if changed..."
  },
  {
    "type": "choice_1",
    "plot": "additional plot changes for choice 1...",
    "characters": "additional character changes for choice 1..."
  },
  {
    "type": "choice_2", 
    "plot": "additional plot changes for choice 2...",
    "characters": "additional character changes for choice 2..."
  },
  {
    "type": "choice_3",
    "plot": "additional plot changes for choice 3...",
    "characters": "additional character changes for choice 3..."
  }
]

Only include fields that actually need updating in each object. Empty object {} if no changes needed for that update type.`;

    const userPrompt = `IMPLEMENTED STORY STEP: "${input.storyStep}"

CURRENT STORY MODEL:
Plot: ${input.storyModel.plot}
Characters: ${input.storyModel.characters}
Theme/Moral: ${input.storyModel.theme_moral_message}
Conflict: ${input.storyModel.conflict}
Setting: ${input.storyModel.setting}
Style/Genre: ${input.storyModel.style_genre}
Audience Effect: ${input.storyModel.audience_effect}

USER INPUT: "${input.userInput}"

NARRATOR RESPONSE: "${input.narratorResponse}"

What updates to the StoryModel are needed to reflect this story progression?`;

    const request: TextToTextRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
      maxTokens: 2000
    };

    try {
      const response = await this.aiService.generateText(request);
      
      Logger.debug('Raw AI response received for prediction', {
        ...context,
        metadata: { 
          responseLength: response.content.length,
          responsePreview: response.content.substring(0, 100) + '...'
        }
      });
      
      // Parse the JSON response - expecting array of 4 updates
      const allUpdates = this.extractJsonFromResponse(response.content);
      
      Logger.debug('JSON successfully extracted and parsed for prediction', {
        ...context,
        metadata: { 
          updatesCount: Array.isArray(allUpdates) ? allUpdates.length : 0,
          isArray: Array.isArray(allUpdates)
        }
      });
      
      if (!Array.isArray(allUpdates) || allUpdates.length !== 4) {
        throw new Error('Expected exactly 4 updates in array format');
      }

      const [immediateUpdate, choice1Update, choice2Update, choice3Update] = allUpdates;

      // Apply immediate update if any fields need changing
      const immediateFields = Object.keys(immediateUpdate).filter(key => key !== 'type');
      if (immediateFields.length > 0) {
        const updateData = { ...immediateUpdate };
        delete updateData.type; // Remove the type field before updating
        
        await this.db.updateStoryModel(input.session.id, updateData);
        
        Logger.info('Immediate story model update applied', {
          ...context,
          duration: getElapsed(timer),
          metadata: { 
            ...context.metadata, 
            immediateUpdatedFields: immediateFields.length 
          }
        });
      }

      // Store future predictions for choices 1, 2, 3
      const predictions = [
        { choiceNumber: 1 as const, modelUpdate: choice1Update },
        { choiceNumber: 2 as const, modelUpdate: choice2Update },
        { choiceNumber: 3 as const, modelUpdate: choice3Update }
      ].filter(pred => {
        // Only store predictions that have actual updates
        const fields = Object.keys(pred.modelUpdate).filter(key => key !== 'type');
        return fields.length > 0;
      });

      if (predictions.length > 0) {
        await this.db.createStoryPredictions(input.session.id, predictions);
        
        Logger.info('Story predictions stored successfully', {
          ...context,
          duration: getElapsed(timer),
          metadata: { 
            ...context.metadata, 
            storedPredictions: predictions.length 
          }
        });
      }

      Logger.info('Story model prediction and update completed', {
        ...context,
        duration: getElapsed(timer),
        metadata: {
          ...context.metadata,
          immediateFields: immediateFields.length,
          futureChoices: predictions.length
        }
      });

    } catch (error) {
      Logger.error('Story model prediction failed', error, {
        ...context,
        duration: getElapsed(timer)
      });
      // Don't throw - model updates are not critical for user experience
      Logger.warn('Continuing without model updates');
    }
  }
} 