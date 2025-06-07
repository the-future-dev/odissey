# Repository Structure

- `/`
  - `.gitignore`: Specifies files and directories to be ignored by Git.
  - `app.json`: Expo configuration for the app (name, slug, platform settings).
  - `App.tsx`: Main entry point for the React Native application with all context providers.
  - `index.ts`: Registers the root component with Expo.
  - `package.json`: Lists project dependencies, scripts, and metadata.
  - `package-lock.json`: Automatically generated lockfile for npm dependencies.
  - `tsconfig.json`: TypeScript compiler configuration.
  - `node_modules/`: Contains all installed npm packages.
  - `.expo/`: Expo platform-specific configuration and build caches.
  - `assets/`: Static assets (images, icons, splash screens).
  - `notion/`: Project documentation and design artifacts (MD files).
  - `src/`: Application source code.
    - `api.ts`: API client functions for communicating with the backend (authentication, world management, sessions).
    - `config.ts`: Configuration constants (e.g., API base URL with environment switching).
    - `types.ts`: Shared TypeScript type definitions (User, World, Session, Personality, etc.).
    - `contexts/`: React Context providers for state management.
      - `AuthContext.tsx`: ✅ React context provider for authentication state and session management.
      - `PersonalityContext.tsx`: ✅ Context provider for personality profile retrieval, rolling updates, and preference discovery.
      - `WorldContext.tsx`: ✅ Context provider for world artifacts management, creation, co-creation, and fetching details.
      - `SessionContext.tsx`: ✅ Context provider for managing active story sessions, message history, and interactions.
    - `navigation/`:
      - `AppNavigator.tsx`: ✅ Defines navigation stacks and screen routing with authentication and personality-based flow control.
    - `screens/`: User interface components for different app features.
      - `LoginScreen.tsx`: ✅ UI for user login and authentication with guest login support.
      - `DemoWorldsScreen.tsx`: ✅ Browse and launch demo worlds instantly with quick play functionality.
      - `PreferenceDiscoveryScreen.tsx`: ✅ Visual quiz for capturing user preferences (adventure style, character type, interests).
      - `WorldGalleryScreen.tsx`: ✅ Gallery view of available worlds with previews, quick play badges, and navigation to create/profile.
      - `WorldCreationScreen.tsx`: ✅ UI to initiate new world creation with initial concept input and example suggestions.
      - `CoCreationScreen.tsx`: ✅ Conversational world co-creation interface guided by AI with finalization workflow.
      - `SessionScreen.tsx`: ✅ Interactive story session with cohesive narrative using SessionContext for state management.
      - `ProfileScreen.tsx`: ✅ Displays user personality profile, trait scores, preferences, and allows recalibration.

## Implementation Status

### ✅ Completed Features:
- **Authentication System**: Guest login with session management and token validation
- **Personality System**: Rolling assessment, preference discovery, trait scoring, and recalibration
- **World Management**: Gallery browsing, creation initiation, co-creation workflow, and demo worlds
- **Session Management**: Story interactions, message history, persistence, and coherence tracking
- **Navigation Flow**: Intelligent routing based on authentication and personality completion status
- **Context Architecture**: Comprehensive state management with AuthContext, PersonalityContext, WorldContext, and SessionContext

### 🚧 Partially Implemented:
- **World Co-Creation**: Basic conversational interface implemented, needs backend integration for streaming responses
- **Rolling Personality Assessment**: Framework in place, needs LLM-powered analysis integration
- **Quick Play**: UI ready, needs <10 second optimization and personality-aware initialization

### 📋 TODO:
- **Audio Integration**: Voice narration support
- **Visual Enhancements**: Character avatars, world thumbnails, animations
- **Advanced Analytics**: Engagement metrics, prompt effectiveness tracking
- **Content Safety**: Age-appropriate content validation
- **Algorithm-Based Matching**: Advanced world recommendation system

*This `tree.md` tracks the implementation progress and will be updated as features are completed and refined.* 