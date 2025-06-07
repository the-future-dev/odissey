import {
  AIProvider,
  AIModality,
  TextToTextRequest,
  TextToTextResponse,
  UnsupportedModalityError
} from '../interfaces';

export class LocalFallbackProvider implements AIProvider {
  readonly name = 'local-fallback';
  readonly supportedModalities = [AIModality.TextToText];

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, this.name);
    }

    // Simple fallback responses based on context
    const lastMessage = request.messages[request.messages.length - 1];
    const userInput = lastMessage?.content?.toLowerCase() || '';
    const conversationContext = request.messages.slice(-3); // Look at last 3 messages for context

    let fallbackResponse = '';

    // Generate contextual responses based on user input patterns
    if (userInput.includes('hello') || userInput.includes('hi') || userInput.includes('start')) {
      fallbackResponse = "Welcome, brave adventurer! You stand at the threshold of an epic quest. The path ahead winds through ancient forests and forgotten ruins. What draws your attention first?";
    } else if (userInput.includes('forest') || userInput.includes('trees') || userInput.includes('woods')) {
      fallbackResponse = "You venture deeper into the mystical forest. Ancient oaks tower above you, their branches whispering secrets in the wind. A narrow path splits ahead - one leading toward the sound of flowing water, another climbing toward a distant glow between the trees. Which path calls to you?";
    } else if (userInput.includes('path') || userInput.includes('go') || userInput.includes('walk') || userInput.includes('move')) {
      fallbackResponse = "As you move forward, the world around you seems to shift and change. New possibilities emerge from the shadows. Your journey continues, filled with wonder and mystery. What do you choose to do next?";
    } else if (userInput.includes('look') || userInput.includes('examine') || userInput.includes('search')) {
      fallbackResponse = "You carefully observe your surroundings. Details you hadn't noticed before come into focus - perhaps a glimmer of something valuable, or a clue to the mysteries that lie ahead. Your keen observation skills serve you well. What catches your eye?";
    } else if (userInput.includes('help') || userInput.includes('stuck') || userInput.includes('confused')) {
      fallbackResponse = "Sometimes the greatest adventures require a moment of reflection. Take a breath and consider your options. The world is full of possibilities - you might explore, interact with what you find, or try a completely different approach. What feels right to you?";
    } else if (userInput.includes('fight') || userInput.includes('attack') || userInput.includes('battle')) {
      fallbackResponse = "Your courage is admirable! You ready yourself for whatever challenges lie ahead. The tension in the air is palpable as you prepare to face the unknown. Your heart races with determination. How do you proceed?";
    } else if (userInput.includes('magic') || userInput.includes('spell') || userInput.includes('enchant')) {
      fallbackResponse = "Mystical energies swirl around you, responding to your intent. The very air seems charged with ancient power, waiting to be channeled. You sense great potential in this moment. What magical approach do you wish to try?";
    } else {
      // Generic adventure response based on conversation tone
      const responses = [
        "Your adventure continues to unfold in unexpected ways. Each choice you make shapes the story ahead. What draws your curiosity next?",
        "The world around you pulses with hidden possibilities. Every step reveals new wonders and challenges. How do you wish to explore further?",
        "As your journey progresses, you sense that greater adventures await. The path ahead is yours to choose. What calls to your adventurous spirit?",
        "Mystery and excitement surround you. Your decisions have led you to this moment of possibility. What action speaks to your heart?",
        "The tapestry of your adventure grows richer with each choice. New threads of story are waiting to be woven. What do you do next?"
      ];
      fallbackResponse = responses[Math.floor(Math.random() * responses.length)];
    }

    return {
      content: fallbackResponse,
      model: 'local-fallback-v1',
      finishReason: 'stop'
    };
  }

  async generateTextStream(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, this.name);
    }

    // Get the full response first
    const fullResponse = await this.generateText(request);
    
    // Stream it word by word if onChunk is provided
    if (request.onChunk) {
      const words = fullResponse.content.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        // Simulate realistic typing speed
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70));
        
        const chunk = i === 0 ? words[i] : ' ' + words[i];
        request.onChunk(chunk);
      }
    }

    return fullResponse;
  }
} 