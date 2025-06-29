// === STORY TYPES AND INTERFACES ===

export interface StoryChapter {
  id: string;
  title: string;
  setting: string;        // Where the chapter takes place  
  plot: string;          // What happens (Aristotelian plot element)
  character: string;     // Characters involved
  theme: string;         // Thematic elements
  conflict: string;      // The conflict/tension
  outcome: string;       // Expected resolution/transition
}

export interface SessionStoryState {
  sessionId: string;
  chapters: StoryChapter[];
  activeChapterIndex: number;
  completedChapters: StoryChapter[];
} 