# Problem Analysis

### Functionality Analysis

| **Flow Name** | **User Interface** | **Input** | **Output** | **Description** | **System Prompts Integration** |
| --- | --- | --- | --- | --- | --- |
| **Preference Discovery** | Visual Card Quiz | 3-5 gamified visual selections (adventure style, character type, interests) | Profile creation; initial personality traits | Quick preference capture through visual, kid-friendly interface | System prompts adapt based on discovered preferences for personalized onboarding |
| **Demo Mode Access** | Home Screen Quick Access | No input required | Instant world loading | Immediate magical world experience without setup | Pre-configured system prompts ensure age-appropriate, engaging demo content |
| Authentication | Login Screen | Guest or Google SSO | Session token; routing to demo or discovery | Intelligent user identification and flow routing | System prompts guide appropriate content based on returning vs new user status |
| **GenAI World Co-Creation** | Create → Co-Creation Flow | Initial concept ("dragon story"); iterative responses to GenAI questions | Progressive world artifact generation | AI-guided collaborative world building that stimulates creativity | Sophisticated system prompts guide GenAI to ask stimulating questions and extract story elements |
| **Story Template Processing** | Background Service | User responses during co-creation | Structured world artifacts based on storytelling frameworks | Ensures minimum viable world requirements are captured | System prompts enforce template compliance while maintaining creative freedom |
| Upload World Source | Create → Upload Tab | Text file input (TXT); future PDF/DOCX support | Parsed world artifacts → structured story elements | Extract and structure existing story content into interactive worlds | System prompts guide content extraction and age-appropriate adaptation |
| Refine Existing World | Create → Refine Tab | Existing world artifacts + user modification prompts | Updated world artifacts with version tracking | Iterative world improvement through AI-assisted conversation | System prompts maintain world consistency during refinement |
| **World Showcase Gallery** | Home Screen Feed | Scroll/pagination; filter preferences | Curated world previews with thumbnails and 30-second teasers | Discovery of community-created worlds with instant preview | System prompts generate engaging world summaries and preview content |
| **Quick Play Access** | World Card Double-Click | World ID + user personality data | <10 second world loading with personalized setup | Instant world entry with personality-aware initialization | System prompts rapidly configure world state based on user personality and preferences |
| **Story Interaction with Coherence** | Odyssey Screen | User utterance (text/audio/choice) + world artifacts + personality profile | Coherent narrator response with embedded rewards/achievements | AI conversation constrained by world rules with personality-aware narration | Advanced system prompts ensure character consistency, age-appropriate content, and personality integration |
| **Rolling Personality Assessment** | Background Analytics | Chat logs; interaction patterns; choice analysis | LLM-generated personality updates; refined trait scores | Continuous personality refinement through interaction analysis | System prompts analyze user behavior and update personality models for better personalization |
| **Instant Gratification Engine** | Integrated across all flows | User engagement patterns; story progression | Progressive reveals; surprise moments; quick wins | Embedded rewarding experiences and achievement unlocks | System prompts strategically place rewards and surprises to maintain engagement |
| Profile Management | Profile Screen | Basic info updates; personality quiz retake | Profile updates; personality recalibration | User control over personal data and trait assessment | System prompts guide personality recalibration and preference updates |

### Enhanced Information Flow

**Core Data Streams:**

- **Preference Discovery** → User Profile → System Prompt Personalization
- **User Personality** (rolling updates) → System Prompt Configuration → Personalized Narration
- **World Artifacts** (characters, settings, rules) → Narrator Context → Story Coherence
- **Story Templates** → World Validation → Minimum Viable World Requirements
- **Interaction Patterns** → LLM Personality Analysis → Rolling Assessment Updates

**System Prompt Integration:**

- **Story Creation Prompts** → GenAI Co-Creator → Stimulated User Creativity
- **Coherence Prompts** + World Artifacts → Narrator → Consistent Story Experience
- **Age-Appropriate Prompts** + User Age → Content Filter → Safe Content Generation
- **Engagement Prompts** → Instant Gratification Engine → Rewarding Moments

**Advanced Flows:**

- Session Metadata + Chat Logs + Personality → Analytics Engine → Engagement Optimization
- World Artifacts + User Preferences → Recommendation Engine (future) → Personalized World Discovery
- System Prompt Effectiveness → Analytics → Prompt Strategy Optimization

### Domain Model (Enhanced)

**Core Entities:**

- **User** {id, name, avatar, age, gender, language, thirdPartyAuth, preferenceDiscovery[], traitScores[], sessionTokens[], personalityHistory[]}
- **World** {id, creatorId, title, description, genre, thumbnailUrl, previewContent, privacyFlag, artifacts{characters[], settings[], rules[], events[], storyTemplate}, coherenceVersion, createdAt, updatedAt}
- **WorldArtifacts** {characters[], settings[], rules[], events[], storyTemplate, minimumRequirements, consistencyHash}
- **Session** {id, userId, worldId, startTime, endTime, status, personalitySnapshot, coherenceLevel}
- **ChatLog** {id, sessionId, speaker['user'|'narrator'], content, timestamp, systemPromptUsed, coherenceScore}
- **SystemPrompt** {id, type['creation'|'narration'|'coherence'|'engagement'], template, variables[], effectivenessScore}
- **PersonalityAssessment** {id, userId, traitScores, confidenceLevel, assessmentMethod['quiz'|'interaction'], timestamp}
- **PreferenceDiscovery** {id, userId, adventureStyle, characterType, interests[], responses[], timestamp}
- **DemoWorld** {id, worldId, previewContent, accessLevel, targetPersonality[]}

**New Relationships:**

- User ←→ PersonalityAssessment (rolling updates)
- World ←→ WorldArtifacts (composition with versioning)
- Session ←→ SystemPrompt (tracking prompt effectiveness)
- ChatLog ←→ PersonalityAssessment (triggers for updates)

### Roles Table (Enhanced)

| Role | Functionality Access | Information Access | System Prompt Access |
| --- | --- | --- | --- |
| **New User** | Preference discovery, demo worlds, quick play | Write: preferenceDiscovery, basic profile | Read: demo-specific prompts |
| **Returning User** | Full system access, rolling personality updates | Read/Write: Profile, World (own + public), personality history | Read/Write: personalized prompt configurations |
| **Creator User** | GenAI co-creation, template-based world building | Read/Write: World artifacts, story templates | Read/Write: creation and refinement prompts |
| **Consumer User** | World browsing, story interaction, instant gratification | Read: World gallery; Write: ChatLog, Session, personality updates | Read: narration and engagement prompts |
| **System (Analytics)** | Rolling personality assessment, prompt optimization | Read/Write: All interaction data, personality models | Read/Write: System prompt effectiveness data |
| **Admin/Researcher** | Analytics dashboard, content moderation | Read: All metrics, chat logs, world quality scores | Read/Write: System prompt strategies and safety configurations |

### External Systems & Services (Enhanced)

**AI & Generation Services:**

- **GenAI Co-Creation Service** (system prompt-guided world building)
- **Narrator Service** (coherence + personality-aware storytelling)
- **Personality Analysis Service** (LLM-powered rolling assessment)
- **Content Safety Service** (age-appropriate content validation)

**Data & Analytics:**

- **World Artifact Repository** (versioned story element storage)
- **System Prompt Management** (prompt templates and optimization)
- **Rolling Analytics Engine** (personality and engagement analysis)
- **Instant Gratification Engine** (reward and surprise generation)

**Integration Services:**

- **Story Template Library** (established storytelling frameworks)
- **Audio Generation Service** (voice narration support)
- **Visual Asset Service** (avatars, thumbnails, animations)

## High-Level Architecture (Enhanced)

### **1. Presentation Layer (Mobile/Web)**

**Core Screens with System Prompt Integration:**

- **Demo Mode Landing**: Instant world access with pre-configured prompts
- **Preference Discovery**: Visual card-based quiz (3-5 questions max)
- **World Showcase Home**: Gallery with 30-second previews and quick play
- **GenAI Co-Creation Interface**: Conversational world building with guided prompts
- **Odyssey Experience**: Chat UI with personality-aware narration and instant rewards

### **2. Application Orchestration Layer**

**Enhanced Services:**

- **System Prompt Orchestrator**: Manages prompt selection and personalization
- **Coherence Manager**: Ensures story consistency through artifact integration
- **Instant Gratification Controller**: Embeds rewards and progressive reveals
- **Personality Integration Service**: Applies rolling assessment to user experience

### **3. Core Domain Services**

**System Prompt-Enhanced Services:**

- **AuthService**: Intelligent routing to demo mode vs preference discovery
- **ProfileService**: Rolling personality updates with LLM analysis
- **WorldService**: Template-based creation with GenAI co-creation support
- **InteractionService**: Coherence-aware narration with personality integration
- **DiscoveryService**: Preference-based quiz with visual, gamified interface

### **4. AI Integration Layer**

**Advanced AI Services:**

- **GenAI Co-Creator**: System prompt-guided collaborative world building
- **Coherence Engine**: Artifact-aware story generation with consistency validation
- **Personality Analyzer**: Rolling assessment through interaction pattern analysis
- **Engagement Optimizer**: Instant gratification and achievement integration

### **5. Data & Infrastructure Layer**

**Enhanced Datastores:**

- **World Artifact Repository**: Versioned storage with template validation
- **System Prompt Library**: Categorized prompts with effectiveness tracking
- **Personality Evolution Database**: Rolling assessment history and trend analysis
- **Engagement Analytics Store**: Instant gratification effectiveness and user satisfaction metrics

## UI Components & Navigation (Enhanced)

**Core Navigation:**

- **NavBar**: Home (World Gallery) | Create (GenAI Co-Creation) | Profile (Rolling Assessment)

**Enhanced Components:**

- **Demo Mode Launcher**: One-click access to magical worlds
- **Preference Discovery Cards**: Visual, gamified personality assessment
- **World Preview Player**: 30-second teasers with quick play integration
- **GenAI Co-Creation Chat**: Guided conversation for world building
- **Coherence-Aware Story Interface**: Personality-integrated narrative experience
- **Rolling Personality Dashboard**: Visual trait evolution and recalibration options

## Non-Functional & Compliance (Enhanced)

### **Performance with System Prompts:**

- **Prompt Processing**: ≤ 0.5s system prompt configuration and application
- **Quick Play**: < 10s world initialization with personality and coherence setup
- **Rolling Assessment**: Background personality analysis without user experience impact

### **Content Safety & Coherence:**

- **System Prompt Safety**: Age-appropriate content guardrails integrated into all AI interactions
- **Coherence Validation**: Real-time consistency checking against world artifacts
- **Personality Privacy**: Rolling assessment data anonymization and GDPR compliance

### **Architecture Scalability:**

- **System Prompt Caching**: Efficient prompt template storage and retrieval
- **Artifact Versioning**: Scalable world consistency management
- **Rolling Analytics**: Efficient personality pattern analysis without performance degradation

### **Future-Proofing:**

- **Algorithm-Based World Matching**: Framework for advanced recommendation beyond timestamp sorting
- **Advanced Audio Integration**: Multi-voice narration and ambient sound support
- **Animation Framework**: Simple character movements and scene transition capabilities