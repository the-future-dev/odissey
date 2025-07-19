# Story Agents Architecture

## Overview

The story system uses a multi-agent architecture where specialized agents coordinate to create coherent, engaging interactive stories. Each agent has a specific role in either initializing stories or handling user interactions with continuous feedback mechanisms.

## Agent Roles

### 🎮 [StoryService](../backend/src/story/storyService.ts)
**Main Coordinator** - Orchestrates all story agents and manages the complete story lifecycle. Handles both initialization and user interaction flows while ensuring optimal performance through background operations.

### 🎬 [StoryInitializer](../backend/src/story/storyInitializer.ts) 
**Story Foundation Creator** - Establishes the core story framework using Aristotelian principles. Creates the fundamental StoryModel with theme, genre, setting, protagonist definition, conflicts, and intended impact.

### 🔮 [StoryPredictor](../backend/src/story/storyPredictor.ts)
**Future Planning & Feedback** - Plans story progression and provides continuous feedback to maintain narrative coherence. Uses advanced storytelling techniques and psychological narrative design to adapt the story based on user interactions.

### 🔧 [StoryOptimizer](../backend/src/story/storyOptimizer.ts)
**Emotional Rhythm Control** - Manages story pacing using sinusoidal emotional patterns. Controls when events happen and signals chapter transitions based on climax patterns.

### 🎭 [StoryNarrator](../backend/src/story/storyNarrator.ts)
**Response Generation** - Creates immersive narrative responses and meaningful user choices. Brings the story to life with engaging narration that follows optimizer instructions.

### 📚 [ChapterManager](../backend/src/story/chapterManager.ts)
**Chapter State Management** - Handles chapter transitions and organizes chapters by status (history, current, future). Manages the progression through the story timeline.

## Story Initialization Flow

```mermaid
graph TD
    A["🎮 StoryService<br/>Main Coordinator"] --> B["🎬 StoryInitializer<br/>Creates story foundation"]
    
    B --> B1["🗄️ Database<br/>StoryModel Creation"]
    B --> B2["StoryModel Components:<br/>• Core theme & moral message<br/>• Genre, style & narrative voice<br/>• Setting constraints & world rules<br/>• Protagonist definition<br/>• Primary conflict sources<br/>• Intended emotional impact"]
    
    B1 --> C["🔮 StoryPredictor<br/>Plans future chapters"]
    B2 --> C
    
    C --> C1["🗄️ Database<br/>Chapter Creation"]
    C --> C2["Future Chapters Generated:<br/>• Chapter titles<br/>• Detailed descriptions<br/>• Story progression roadmap<br/>• Complete narrative arc"]
    
    C1 --> D["📚 ChapterManager<br/>Manages chapter states"]
    C2 --> D
    
    D --> D1["🗄️ Database<br/>Chapter Status Management"]
    D --> D2["Chapter Organization:<br/>• Set first chapter as 'current'<br/>• Store remaining as 'future'<br/>• Initialize chapter flow<br/>• Ready for user interaction"]
    
    D1 --> E["✅ Session Ready<br/>Story fully initialized<br/>User can begin adventure"]
    D2 --> E
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#c8e6c9
```

**Process:**
1. **StoryInitializer** creates comprehensive StoryModel with 6 core components
2. **StoryPredictor** generates initial chapter roadmap for complete story arc
3. **ChapterManager** organizes chapters and sets up initial state for user interaction

## User Interaction Flow

```mermaid
graph TD
    A["👤 User Input"] --> B["🎮 StoryService<br/>Main Coordinator"]
    
    B --> C["📚 ChapterManager<br/>Retrieves Context"]
    C --> C1["Context Data:<br/>• Current chapter<br/>• Chapter messages<br/>• Recent messages"]
    
    B --> D["🔄 StoryPredictor<br/>Continuous Feedback"]
    D --> D1["Feedback Analysis:<br/>• Story trajectory<br/>• Character psychology<br/>• Narrative coherence<br/>• Chapter modifications"]
    D1 --> D2["Updates:<br/>• Current chapter description<br/>• Future chapters roadmap<br/>• Story consistency"]
    
    D2 --> E["🔧 StoryOptimizer<br/>Emotional Rhythm Control"]
    E --> E1["Sinusoidal Pacing:<br/>• Emotional intensity<br/>• Chapter decomposition<br/>• Transition signals<br/>• Rhythm phase tracking"]
    E1 --> E2["Optimizer Output:<br/>• What happens next<br/>• Should transition (Y/N)<br/>• Updated decomposition"]
    
    E2 --> F["🎭 StoryNarrator<br/>Response Generation"]
    F --> F1["Narrative Creation:<br/>• Immersive storytelling<br/>• Following decomposition<br/>• Choice generation<br/>• User engagement"]
    F1 --> F2["Response:<br/>• Story narrative<br/>• 3 user choices<br/>• Immediate delivery"]
    
    F2 --> G["🏃‍♂️ Background Operations<br/>(ExecutionContext)"]
    G --> G1["Database Updates:<br/>• Store user message<br/>• Store narrator response<br/>• Update chapter data"]
    G --> H["🔄 Chapter Transition<br/>(If signaled)"]
    H --> H1["Transition Process:<br/>• Move current to history<br/>• Set next future as current<br/>• Update chapter states"]
    
    B --> I["🗄️ Database<br/>Parallel Operations"]
    I --> I1["Data Storage:<br/>• Message persistence<br/>• Chapter updates<br/>• State management"]
    
    style A fill:#ffeb3b
    style B fill:#e1f5fe
    style C fill:#fff3e0
    style D fill:#e8f5e8
    style E fill:#f3e5f5
    style F fill:#fce4ec
    style G fill:#f0f4c3
    style H fill:#e0f2f1
    style I fill:#fce4ec
```

**Process:**
1. **ChapterManager** retrieves current context and messages
2. **StoryPredictor** analyzes trajectory and updates story elements for coherence
3. **StoryOptimizer** determines emotional pacing and next story beats
4. **StoryNarrator** generates immersive response with user choices
5. **Background operations** handle database updates and potential chapter transitions

## Key Features

### Continuous Feedback Loop
The **StoryPredictor** continuously analyzes user interactions to refine the story, ensuring narrative coherence while adapting to user choices. This "greedy optimization" approach follows the most engaging path revealed by user interactions.

### Sinusoidal Pacing
The **StoryOptimizer** uses emotional rhythm patterns (Introduction → Rising → Climax → Resolution → Transition) to create satisfying story beats and determine optimal chapter transition points.

### Performance Optimization
The system uses **ExecutionContext** for background operations, ensuring users receive immediate responses while database operations and chapter transitions happen asynchronously.

### Data Structures

The agents work with key data structures defined in [`db-types.ts`](../backend/src/database/db-types.ts):

- **StoryModel**: Core story framework with theme, genre, setting, conflicts
- **Chapter**: Individual story segments with status tracking (history/current/future)  
- **Message**: User and narrator interactions within chapters
- **Session**: Links users to their active story worlds

## Utilities

The system uses shared utilities in [`mpcUtils.ts`](../backend/src/story/mpcUtils.ts) for parsing AI responses and extracting structured data from natural language outputs. 