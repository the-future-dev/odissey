interface StoryControllerProps {
  genre: string;
  epoch: string;
  context: string;
  characterRole: string;
  characterAge: number;
  numberOfSentences: number;
  storyLength: number;
  realismOrFiction: 'Realism' | 'Fiction';
  interactionStyle: 'Free Answers' | 'A-D';
  ending: 'Happy End' | 'Open End';
}

export default class StoryController {
  private currentInteraction: number;
  private storyStage: 'beginning' | 'development' | 'conclusion';
  private parameters: StoryControllerProps;

  constructor(parameters: StoryControllerProps) {
    this.currentInteraction = 0;
    this.storyStage = 'beginning';
    this.parameters = parameters;
  }

  initializeStory(): string {
    const {
      genre,
      epoch,
      context,
      characterRole,
      characterAge,
      numberOfSentences,
      realismOrFiction,
      interactionStyle,
    } = this.parameters;

    return `You are a skilled storyteller. Your task is to create an engaging ${genre} story set in the ${epoch} era, within the context of ${context}.
The user will play the role of a ${characterAge}-year-old ${characterRole}. Refer to the user in the first person. Each of your responses must be a maximum of ${numberOfSentences} sentences.
The story should be ${
      realismOrFiction === 'Realism'
        ? 'grounded in reality'
        : 'imaginative and fantastical'
    }.
Begin the story by setting the scene and introducing the main character. Then prompt the user to make a choice that will influence the story's direction.
${
  interactionStyle === 'A-D'
    ? 'Present these choices as options A through D.'
    : 'Allow the user to respond freely to your prompts.'
}
Remember to gradually introduce supporting characters, including a friend named Troy and a love interest named Laila.
Ensure the narrative is consistent and builds logically without contradictions or unnecessary repetitions.
Your first task is to craft an engaging opening that draws the user into the world you're creating. Begin by setting the stage for our adventure.`;
  }

  private updateStoryProgress(): void {
    this.currentInteraction++;
    const progressRatio = this.currentInteraction / this.parameters.storyLength;

    if (progressRatio < 0.3) {
      this.storyStage = 'beginning';
    } else if (progressRatio < 0.7) {
      this.storyStage = 'development';
    } else {
      this.storyStage = 'conclusion';
    }
  }

  private generateSystemPrompt(): string {
    const {
      genre,
      ending,
      numberOfSentences,
      interactionStyle,
    } = this.parameters;

    let stagePrompt = '';
    switch (this.storyStage) {
      case 'beginning':
        stagePrompt =
          "Continue developing the story's setting and characters. Introduce the first major plot point or challenge for the protagonist.";
        break;
      case 'development':
        stagePrompt =
          'Escalate the conflict and introduce unexpected twists. Deepen character relationships and raise the stakes for the protagonist.';
        break;
      case 'conclusion':
        stagePrompt = `Begin wrapping up the story threads. Prepare for a ${
          ending === 'Happy End'
            ? 'satisfying conclusion'
            : 'thought-provoking open end'
        } that meets the expectations of the ${genre} genre.`;
        break;
    }

    return `As the storyteller, guide the narrative based on the user's choices. ${stagePrompt}
Ensure that the narrative remains consistent and builds upon previous events without contradictions or unnecessary repetition.
Remember to maintain a consistent tone and style appropriate for the ${genre} genre.
After each significant story beat, provide the user with meaningful choices that will shape upcoming events.
Each of your responses must be a maximum of ${numberOfSentences} sentences.
${
  interactionStyle === 'A-D'
    ? 'Present these choices as options A through D.'
    : 'Allow the user to respond freely to your prompts.'
}
Keep the story engaging, and ensure the pacing is appropriate for this stage of the narrative.`;
  }

  getNextPrompt(): { role: 'system'; content: string } {
    this.updateStoryProgress();
    const systemPrompt = this.generateSystemPrompt();
    return { role: 'system', content: systemPrompt };
  }
} 