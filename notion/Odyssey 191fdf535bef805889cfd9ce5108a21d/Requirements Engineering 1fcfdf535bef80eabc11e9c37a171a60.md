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

- As a new user (age 7–12), I want to take a quick **on-boarding quiz** so the system tailors to my preferences.
- As a returning user, I want to access my **profile**, re-take the basic quiz and execute an extensive quiz.
- As a “Story Creator,” I want to co-create and shape the world (characters, rules, events) by interacting back-and-forth with the “**World Building Engine**”
- As a “Story Creator” I want to feed a book (text, .pdf, …) to the “World Building Engine” and extrapolate from it a world model, that can be used and or refined.
- As a “Story Consumer” I want to shape my own story inside a world/narrative by actively interacting with it.
- As a user, I want immediate feedback (text, animations, audio, video, images) so I feel immersed in the story.
- As a user, I want my session data saved so I can pause and resume stories later.
- As a user I want my experience to be highly personalized: the system remembers my past interactions and personality traits and behaves accordingly.
- As a researcher (developer), I want to view basic analytics (session length, choices made) to assess immersion in the experience and engagement overall.

## Functional Requirements

- R1: “**Onboarding Quiz**” to collect user preferences
- R2: **Profile & Personality** (CRUD - create/read/update/delete) store quiz results and evolving traits trough interaction
- R3: **Story Creation** AI based service to co-create world building artifacts (ex: characters, setting, rules, from user inputs).
- R4: **Story Interaction** - picking a pre-existent story setup, make the user interact with it by narrating with AI and user input for evolution of the experience
- R5: **Story Grounding Repositories** - store the “story grounding” artifacts (world rules, character list, event log) to be used and modified for later usage. persist world state: character profiles, rule sets, and event logs for coherence.
- R6: Render story text + simple media feedback.
- R7: Store chat logs, user choices, session metadata.
- R8: Compute engagement metrics (session duration, frequency).

Perhaps adding:

- System Health Monitoring
- User Management
- Administrative Features
- Content Regulation

## **Non-Functional Requirements**

- NFR1 (Usability): Mobile-first, kid-friendly UI - large touch targets, minimal text per screen.
- NFR2 (Performance): < 2 s latency on AI responses.
- NFR3 (Reliability): ≥ 99% uptime; resume sessions after network loss.
- NFR4 (Security & Privacy): GDPR-compatible; children’s data safely stored and encrypted.
- NFR5 (Maintainability): Modular architecture (profile, AI service, persistence).
- NFR6 (Scalability): Handle 1 000 concurrent sessions.
- NFR7 (Accessibility): Support screen-reader text; high-contrast mode.
- NFR8 (Extensibility): Plug-in interfaces for new AI models or media types.

- Compliance with regulation tailored for Children

## Requirements Prioritization & Categorization

| **Requirement** | **Priority** | **Type** |
| --- | --- | --- |
| R1: Onboarding Quiz | Should Have | Functional |
| R2: Profile and Personality | Should Have | Functional |
| R3: Story Creation | Must Have | Functional |
| R4: Story Interaction | Must Have | Functional |
| R5: Story Grounding Repository | Must Have | Functional |
| R6: Render story with feedback | Must Have  | Functional |
| R7: Store chat logs, user choices, session metadata | Must Have | Functional |
| R8: Compute Engagement metrics | Should Have | Functional |
| NFR1: (Usability): Mobile-first, kid-friendly UI | Should Have | Non-Functional |
| NFR2: (Performance): < 2 s latency on AI responses | Must Have | Non-Functional |
| NFR3: (Reliability): ≥ 99% uptime; resume sessions | Should Have | Non-Functional |
| NFR4 (Security & Privacy): GDPR-compatible; children’s data safely stored and encrypted | Must Have | Non-Functional |
| NFR5 (Maintainability): Modular architecture | Must Have | Non-Functional |
| NFR6 (Scalability): Handle 1 000 concurrent session | Could Have | Non-functional |
| NFR7 (Accessibility) |  |  |
| NFR8 (Extensibility) |  |  |

Priority legend

- **Must have:** Critical for MVP.
- **Should have:** Important but not vital for initial launch.
- **Could have:** Desirable if time and resources permit.
- **Won't have (this time):** Explicitly out of scope for the current iteration/release.

## **Use-Case Modeling**

Show how users interact with the system's key functions through visual diagrams.

![1000132844.jpg](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/1000132844.jpg)

## Model Dictionary

| **Name** | **Meaning** |
| --- | --- |
| Wolrd Artifcats | All such artifacts that ensure that the world generated persists and can be re used (characters, rules, setting, …).  |
| Narrator Utterance | Inputs that the narrator prompts to the user; inherently it is multi-modal: text, audio, videos, images |
| User Utterance | Inputs from the user; inherently multimodal such as: text; audio; (pehaps) multiple choice response |
| User Profile | username, (3rd party sign), age, gender, … |
| User Personality | All such traits that influence what interactions the user might desire from the application: natural behavior, personality, previous experiences, taste, inclinations |
|  |  |

[Odissey.pdf](Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60/Odissey.pdf)