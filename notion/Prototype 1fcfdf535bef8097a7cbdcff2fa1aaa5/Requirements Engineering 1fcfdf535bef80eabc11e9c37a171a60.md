# Requirements Engineering

## Requirements Gathering

@Tim Köster Your framework for interviewing everybody !

### **User Research**

*Conduct interviews, surveys, focus groups, and observation sessions with potential users.*

### **Stakeholders Discussion**

*Engage internally to gather needs and constraints*

### **Brainstorming & Ideation Sessions**

*Broad list of potential features and ideas*

[Brainstorm](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/Brainstorm%201fcfdf535bef80289d75f0dd8935670e.md)

## User Stories

- As a new user (age 7–12), I want to take a quick **preference discovery quiz** (3-5 visual questions) so the system tailors to my adventure style and interests.
- As a user, I want to **try demo worlds immediately** without any setup so I can experience the magic instantly.
- As a user, I want **30-second story previews** with thumbnails so I can quickly find stories that interest me.
- As a user, I want to **jump into any world in under 10 seconds** so I can start my adventure immediately.
- As a returning user, I want to access my **profile** and re-take preference discovery or access extended personality assessment.

**World Building & Creation**

- As a "Story Creator," I want to **co-create worlds through GenAI conversation** guided by system prompts that help me express my ideas (e.g., "I want a dragon story" → "Are dragons widespread or nearly extinct?").
- As a "Story Creator" I want to **feed text sources** (books, stories) to the World Building Engine and have it extrapolate world artifacts that can be refined.
- As a creator, I want the system to **save all world artifacts** (characters, settings, rules) based on story templates so my world persists and remains consistent.
- As a creator, I want **guided world building** that stimulates my creativity without overwhelming me with too many options.

**Interactive Story Experience**

- As As a "Story Consumer" I want to **shape my story through interactions** while the system maintains world consistency through saved artifacts
- As a user, I want **immediate rewarding moments** embedded in the story flow through system prompts.
- As a user, I want to **unlock new story elements progressively** as I explore, with achievements integrated into the narrator experience.
- As a user, I want **surprise plot twists and discoveries** built into the story flow.
- As a user, I want immediate feedback (text, animations, audio, video, images) so I feel immersed in the story.

**Personalization & Consistency**

- As a user, I want **continuous personality refinement** where the system learns from my interactions and updates my profile through LLM analysis.
- As a user, I want **personality-aware narration** where system prompts incorporate my personal details and preferences.
- As a user, I want **story coherence** maintained through system prompts that ensure age-appropriate, engaging content and character consistency.
- As a user, I want my session data saved so I can pause and resume stories later.

**Content Discovery & Social**

- As a user, I want to **browse a gallery of worlds** created by other kids on the home screen, sorted by recency.
- As a user, I want to **see world showcases** with thumbnails and previews to discover new adventures.
    
    
    **Technical & Access**
    
- As a user, I want to log in as a guest or via Google single sign-on so that I can access the platform quickly without managing separate credentials.
- As a system, I want to detect whether a user is new or returning (via session tokens stored in local storage) so that I can route them to preference discovery or directly to demo mode.
- As a researcher (developer), I want to view analytics on engagement, story coherence effectiveness, and personality assessment accuracy.

## Functional Requirements

**Core Story Engine**

- R1: **"Preference Discovery Quiz"** - 3-5 visual, gamified questions covering adventure style, character preferences, and interests (magic, technology, animals, space)
- R2: **Profile & Personality Management** (CRUD) - store quiz results, implement rolling personality assessment through LLM analysis of interactions, and evolving traits
- R3: **System Prompt Framework** - implement sophisticated prompting strategies for story coherence, age-appropriate content, and personality-aware narration
- R4: **Story Coherence Engine** - maintain narrative consistency through world artifacts (characters, settings, rules) fed to narrator at inference time
    
    
    **World Building System**
    
- R5: **GenAI Co-Creation Pipeline** - step-by-step world creation guided by system prompts that stimulate inventive thinking without overwhelming options
- R6: **Story Template Integration** - implement established storytelling frameworks to ensure minimum viable world requirements are captured and saved as artifacts
- R7: **World Artifact Persistence** - store and manage world grounding artifacts (characters, settings, rules, events) for coherence and reuse
    
    **Interactive Experience**
    
- R8: **Story Interaction Engine** - AI-powered narration with GenAI constrained by world rules, allowing creative branching while maintaining consistency
- R9: **Instant Gratification Features** - 30-second story previews, quick play (<10 second access), progressive element reveals, embedded rewards
- R10: **Achievement Integration** - system prompts unlock new story elements and achievements embedded directly in narrator responses
    
    ### **User Experience & Interface**
    
- R11: **Demo Mode** - pre-built magical worlds accessible immediately without quiz requirements
- R12: **Visual Enhancement Support** - character avatars, world thumbnails, story previews, and animation framework
- R13: **Audio Integration** - voice narration support with multi-modal content rendering
- R14: **World Showcase Home** - scrollable gallery of user-created worlds with preview capabilities
    
    ### **Technical Infrastructure**
    
- R15: **Authentication & Session Management** - support guest login and Google SSO; intelligent routing to demo mode or preference discovery
- R16: **World CRUD API** - create, read, update, delete operations for world artifacts with template validation
- R17: **Rolling Personality Service** - LLM-powered personality analysis and profile updates based on interaction patterns
- R18: **Future Algorithm-Based Matching** - framework for advanced world recommendation beyond timestamp sorting
    
    ### **Analytics & Monitoring**
    
- R19: **Comprehensive Analytics** - track engagement metrics, story coherence effectiveness, personality assessment accuracy, and instant gratification conversion rates
- R20: **System Prompt Effectiveness Monitoring** - measure success of prompting strategies for coherence and user satisfaction

## **Non-Functional Requirements**

### **Performance & Reliability**

- NFR1 (Performance): **< 2 s latency** on AI responses; **< 10 s world access** for quick play functionality
- NFR2 (Reliability): ≥ 99% uptime; resume sessions after network loss with artifact persistence
- NFR3 (Scalability): Handle 1,000 concurrent sessions with efficient system prompt processing

### **User Experience**

- NFR4 (Usability): **Mobile-first, kid-friendly UI** - large touch targets, minimal text per screen, visual card interfaces
- NFR5 (Instant Gratification): **Preview-to-play conversion optimization**, progressive loading for immediate engagement
- NFR6 (Audio Integration): **Voice narration support** with clear audio quality and multiple voice options (should-have)
- NFR7 (Animation Support): Simple character movements and scene transitions (optional enhancement)

### **Safety & Compliance**

- NFR8 (Security & Privacy): GDPR-compatible; children's data safely stored and encrypted with rolling personality updates
- NFR9 (Content Safety): System prompts ensure age-appropriate content generation and maintain safety guardrails

### **Architecture & Maintainability**

- NFR10 (Maintainability): **Modular architecture** with clear separation between story engine, world building, and personality systems
- NFR11 (Extensibility): **Plug-in interfaces** for new AI models, system prompt strategies, and media types
- NFR12 (Accessibility): Support screen-reader text; high-contrast mode for inclusive design

## Requirements Prioritization & Categorization

| **Requirement** | **Priority** | **Type** | **System Component** |
| --- | --- | --- | --- |
| R3: System Prompt Framework | Must Have | Functional | Core Engine |
| R4: Story Coherence Engine | Must Have | Functional | Core Engine |
| R8: Story Interaction Engine | Must Have | Functional | Core Engine |
| R7: World Artifact Persistence | Must Have | Functional | Core Engine |
| R11: Demo Mode | Must Have | Functional | User Experience |
| R9: Instant Gratification Features | Must Have | Functional | User Experience |
| R5: GenAI Co-Creation Pipeline | Must Have | Functional | World Building |
| R1: Preference Discovery Quiz | Should Have | Functional | Onboarding |
| R2: Profile & Personality Management | Should Have | Functional | Personalization |
| R17: Rolling Personality Service | Should Have | Functional | Personalization |
| R12: Visual Enhancement Support | Should Have | Functional | User Interface |
| R14: World Showcase Home | Should Have | Functional | Content Discovery |
| R6: Story Template Integration | Should Have | Functional | World Building |
| R10: Achievement Integration | Should Have | Functional | Engagement |
| R13: Audio Integration | Should Have | Non-Functional | User Experience |
| R15: Authentication & Session Management | Must Have | Functional | Infrastructure |
| R16: World CRUD API | Must Have | Functional | Infrastructure |
| R19: Comprehensive Analytics | Should Have | Functional | Analytics |
| R18: Future Algorithm-Based Matching | Could Have | Functional | Content Discovery |
| R20: System Prompt Effectiveness Monitoring | Could Have | Functional | Analytics |
| NFR1: Performance Requirements | Must Have | Non-Functional | Performance |
| NFR4: Mobile-first UI | Must Have | Non-Functional | User Experience |
| NFR8: Security & Privacy | Must Have | Non-Functional | Safety |
| NFR9: Content Safety | Must Have | Non-Functional | Safety |
| NFR10: Modular Architecture | Must Have | Non-Functional | Architecture |
| NFR6: Audio Integration | Should Have | Non-Functional | User Experience |
| NFR7: Animation Support | Could Have | Non-Functional | User Experience |

Priority legend

- **Must have:** Critical for MVP launch and core functionality
- **Should have:** Important for user engagement and retention
- **Could have:** Desirable enhancements if time and resources permit
- **Won't have (this time):** Explicitly out of scope for current iteration

## **Use-Case Modeling**

Show how users interact with the system's key functions through visual diagrams.

[Odissey.pdf](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/Odissey.pdf)

![image.png](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/image.png)

![image.png](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/image%201.png)

![image.png](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/image%202.png)

![image.png](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/image%203.png)

## Model Dictionary

| **Name** | **Meaning** |
| --- | --- |
| **World Artifacts** | Persistent story elements including characters, settings, rules, and events that ensure world consistency and enable reuse across sessions |
| **System Prompts** | Sophisticated prompting strategies that guide AI behavior for story coherence, age-appropriate content, and personality-aware narration |
| **Narrator Utterance** | Multi-modal AI responses (text, audio, visual) guided by system prompts and informed by world artifacts and user personality |
| **User Utterance** | Multi-modal user inputs (text, audio, choice selections) that shape story direction within world rule constraints |
| **User Profile** | Basic user information including username, authentication method, age, gender, and preferences |
| **User Personality** | Dynamic trait assessment combining initial preference discovery with rolling LLM analysis of interaction patterns |
| **Story Templates** | Established storytelling frameworks defining minimum requirements for viable world creation and narrative structure |
| **GenAI Co-Creator** | AI system guided by prompts to stimulate user creativity and facilitate collaborative world building |
| **Demo Worlds** | Pre-built magical worlds accessible immediately for instant user engagement without setup requirements |
| **Preference Discovery** | Streamlined 3-5 question visual quiz focusing on adventure style, character type, and interest categories |
| **Rolling Assessment** | Continuous personality refinement through LLM analysis of user interactions and story choices |