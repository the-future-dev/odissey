# AI-Powered Storytelling Setup

This guide explains how to set up and use the new AI-powered storytelling system.

## Architecture Overview

The system uses an abstract AI service architecture that supports multiple providers and modalities:

### Supported Providers
- **Hugging Face** (implemented) - Using DeepSeek-R1-0528 model
- **OpenAI** (placeholder ready) - GPT models, TTS, Whisper
- **Gemini** (placeholder ready) - Google's language models

### Supported Modalities
- **Text-to-Text** - Main storytelling generation
- **Text-to-Audio** - Future support for voice narration
- **Audio-to-Text** - Future support for voice input

## Environment Setup

Add these environment variables to your `wrangler.toml` or environment:

```toml
[env.development.vars]
HUGGINGFACE_API_KEY = "your_huggingface_api_key_here"
# OPENAI_API_KEY = "your_openai_api_key_here"  # Optional
# GEMINI_API_KEY = "your_gemini_api_key_here"  # Optional
```

## System Features

### 1. Abstract AI Service
- Provider-agnostic interface
- Easy to add new AI providers
- Automatic fallback to rule-based responses
- Support for multiple modalities

### 2. World-Specific System Prompts
The system includes sophisticated prompts for each story world:

#### Fantasy Adventure
- Epic fantasy tone with magic and creatures
- Classic adventure story structure
- Rich atmospheric descriptions

#### Sci-Fi Explorer
- Scientifically grounded space exploration
- First contact scenarios
- Technical challenges and ethical dilemmas

#### Mystery Detective
- Noir-influenced crime investigation
- Complex character motivations
- Clue-based puzzle solving

### 3. Coherent Conversation Flow
- Maintains conversation history
- World state tracking
- Context-aware responses
- Consistent character and story continuity

## How to Add New Providers

### 1. Create Provider Class
```typescript
export class NewAIProvider implements AIProvider {
  readonly name = 'newprovider';
  readonly supportedModalities = [AIModality.TextToText];

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    // Implementation here
  }
}
```

### 2. Register in Routes
```typescript
if (env.NEW_PROVIDER_API_KEY) {
  const newProvider = new NewAIProvider({
    apiKey: env.NEW_PROVIDER_API_KEY
  });
  this.aiService.registerProvider(newProvider);
}
```

## How to Add New World Prompts

### 1. Create Template
```typescript
this.registerTemplate({
  worldId: 'new-world',
  basePrompt: 'You are a master storyteller for this world type.',
  roleDescription: 'Guide players through unique adventures.',
  worldContext: 'Detailed world background...',
  interactionGuidelines: 'How to interact with players...',
  storyStructure: 'Story progression patterns...',
  toneAndStyle: 'Narrative voice and atmosphere...'
});
```

### 2. Add to Database
Ensure your world exists in the `worlds` table with the corresponding `id`.

## API Usage

### Create Session (Multiple endpoints available)
```http
# Anonymous session (original endpoint)
POST /sessions/new-anonymous
Authorization: Bearer your_token
Content-Type: application/json

{
  "worldId": "fantasy-adventure"
}

# Personalized session (for frontend compatibility)
POST /sessions/personalized
Authorization: Bearer your_token
Content-Type: application/json

{
  "worldId": "fantasy-adventure"
}
```

### Check AI Service Status
```http
GET /ai/status

Response:
{
  "status": "ok",
  "providers": [
    {
      "name": "huggingface",
      "supportedModalities": ["text-to-text"]
    }
  ],
  "modalities": {
    "textToText": true,
    "textToAudio": false,
    "audioToText": false
  },
  "fallbackAvailable": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Interact with Story
```http
POST /sessions/{sessionId}/interact
Authorization: Bearer your_token
Content-Type: application/json

{
  "message": "I want to explore the mysterious forest ahead."
}
```

## Response Examples

### Fantasy World
**User Input:** "I examine the ancient runes on the stone marker"

**AI Response:** "As you approach the weathered stone marker, the ancient runes begin to glow with a soft blue light at your touch. The symbols seem to shift and dance before your eyes, slowly resolving into readable text in a language you somehow understand: 'Three paths diverge where heroes choose their fate - the Trial of Strength leads to glory or doom, the Path of Wisdom reveals secrets untold, and the Way of Heart binds souls to destiny.' As you read, you feel a strange resonance, as if the marker is responding to something within you. What do you do?"

### Sci-Fi World
**User Input:** "I scan the alien structure for energy signatures"

**AI Response:** "Your tricorder reveals fascinating readings from the crystalline structure. The material is composed of an unknown mineral that seems to exist in a quantum superposition - simultaneously solid and energy. Massive power signatures emanate from deep within, suggesting a technology far beyond current human understanding. Your scans detect what appears to be a transportation matrix - possibly a portal system. The structure is definitely artificial, and recent energy fluctuations indicate it may have been recently activated. Your science officer's voice crackles through the comm: 'Captain, I'm detecting similar structures across the planet. This might be part of a vast network.' What are your orders?"

## Fallback System

If AI generation fails, the system automatically falls back to the original rule-based responses, ensuring the user experience is never interrupted.

## Performance Considerations

- AI responses may take 2-10 seconds depending on the provider
- System prompts are optimized for context efficiency
- Conversation history is limited to recent messages to manage token usage
- Automatic retry logic for transient AI service failures 