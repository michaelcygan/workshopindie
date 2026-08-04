/**
 * Allowlisted starter prompts for member Blog drafts, seeded from the desktop
 * "Now" board. Ids are a closed set — nothing here is user-supplied text.
 */

export const BLOG_SEED_PROMPT_IDS = [
  "process-note",
  "what-changed",
  "five-influences",
  "tools",
  "failed-project",
  "city-scene",
  "medium-essay",
  "work-story",
  "morning-pages",
  "week-plan",
  "teach-technique",
  "interview",
  "review",
  "manifesto",
  "day-in-life",
  "money",
] as const;

export type BlogSeedPromptId = (typeof BLOG_SEED_PROMPT_IDS)[number];

export const BLOG_SEED_PROMPTS: Record<BlogSeedPromptId, { title: string; body: string }> = {
  "process-note": {
    title: "Process note",
    body: "## What I made\n\n## How it actually came together\n\n## What I'd do differently\n",
  },
  "what-changed": {
    title: "What changed in my work",
    body: "## Where I started\n\n## What shifted\n\n## What I believe now\n",
  },
  "five-influences": {
    title: "Five things I'm stealing from",
    body: "1. \n2. \n3. \n4. \n5. \n\nWhy these, right now:\n",
  },
  tools: {
    title: "The tools I actually use",
    body: "## Daily\n\n## Occasionally\n\n## Things I keep meaning to learn\n",
  },
  "failed-project": {
    title: "A project that failed",
    body: "## The idea\n\n## Where it broke\n\n## What it taught me\n",
  },
  "city-scene": {
    title: "Notes on the scene here",
    body: "## Who's making things\n\n## Where it happens\n\n## What's missing\n",
  },
  "medium-essay": {
    title: "Something honest about my medium",
    body: "## The version people talk about\n\n## The version I live with\n",
  },
  "work-story": {
    title: "The story behind this piece",
    body: "## Where it started\n\n## The middle, which was hard\n\n## Where it landed\n",
  },
  "morning-pages": {
    title: "Morning pages",
    body: "Three hundred words before anything else.\n\n",
  },
  "week-plan": {
    title: "The week's one real project",
    body: "## The project\n\n## What done looks like\n\n## What I'm saying no to\n",
  },
  "teach-technique": {
    title: "One technique, explained",
    body: "## The technique\n\n## How to do it\n\n## When not to\n",
  },
  interview: {
    title: "An interview",
    body: "**Who they are:**\n\n**Q.** \n\n**A.** \n\n**Q.** \n\n**A.** \n",
  },
  review: {
    title: "A review",
    body: "## What I saw\n\n## What worked\n\n## What stayed with me\n",
  },
  manifesto: {
    title: "A manifesto for the practice",
    body: "1. \n2. \n3. \n",
  },
  "day-in-life": {
    title: "A day in the working life",
    body: "**Morning**\n\n**Afternoon**\n\n**Evening**\n",
  },
  money: {
    title: "How the work gets paid for",
    body: "## What pays\n\n## What doesn't\n\n## What I'm trying next\n",
  },
};

export function isBlogSeedPromptId(value: string): value is BlogSeedPromptId {
  return (BLOG_SEED_PROMPT_IDS as readonly string[]).includes(value);
}
