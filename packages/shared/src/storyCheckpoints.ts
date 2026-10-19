export const storyCheckpointIds = [
  "prologue",
  "shopping",
  "funeral",
  "investigation",
] as const;
export type StoryCheckpointId = (typeof storyCheckpointIds)[number];
export const storyCheckpoints: Record<
  StoryCheckpointId,
  { title: string; description: string }
> = {
  prologue: {
    title: "Prologue",
    description: "Meet Alden and follow Sieg and Coco into the forest.",
  },
  shopping: {
    title: "Shopping",
    description: "Run Papa’s errands through Emberbrook’s market.",
  },
  funeral: {
    title: "Alden’s Funeral",
    description: "Gather stones and flowers, then say goodbye.",
  },
  investigation: {
    title: "Investigate Emberbrook",
    description: "Ask the villagers what happened to Alden.",
  },
};
