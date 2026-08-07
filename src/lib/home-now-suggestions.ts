/**
 * Curated suggestion catalog for the desktop "Now" board.
 *
 * Every entry is hand-written, deterministic, and allowlisted — nothing here
 * is generated at runtime. Copy may reference {city}, {medium}, {group},
 * {work} and {daypart}; an entry is dropped when a token it uses has no value,
 * so the board never renders a broken placeholder.
 */

import type { HomeNowAction, HomeNowItem, HomeNowLane, HomeNowSource } from "./home-now-types";

export type NowContext = {
  city: string | null;
  cityGroupSlug: string | null;
  medium: string | null;
  group: string | null;
  groupSlug: string | null;
  work: string | null;
  workSlug: string | null;
  citySlug: string | null;
  daypart: string;
  hasWork: boolean;
  hasGroups: boolean;
  /** 0 = Sunday. */
  day: number;
  /** Local hour, 0–23. */
  hour: number;
};

type Need = "city" | "cityGroup" | "medium" | "group" | "work";

export type NowSeed = {
  id: string;
  lane: HomeNowLane;
  source: HomeNowSource;
  status: string;
  title: string;
  detail?: string;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, string | number | boolean>;
  action?: HomeNowAction;
  weight?: number;
  needs?: Need[];
  /** Restrict to these weekdays (0 = Sunday). */
  days?: number[];
  /** Restrict to [startHour, endHour) local time. */
  hours?: [number, number];
};

/* ─────────────────────────── LIVE lane ─────────────────────────── */

const LIVE: NowSeed[] = [
  {
    id: "live-today-open",
    lane: "live",
    source: "today",
    status: "TODAY",
    title: "Post what you're working on today",
    detail: "One line in {group} is enough.",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 6,
  },
  {
    id: "live-today-city",
    lane: "live",
    source: "city",
    status: "TODAY",
    title: "See what {city} is making today",
    detail: "Your city's board.",
    to: "/g/$slug",
    params: { slug: "{cityGroupSlug}" },
    needs: ["cityGroup"],
    weight: 5,
  },
  {
    id: "live-audio-open",
    lane: "live",
    source: "audio",
    status: "AUDIO",
    title: "Open an audio room in {group}",
    detail: "Work out loud for twenty minutes.",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 4,
  },
  {
    id: "live-audio-city",
    lane: "live",
    source: "audio",
    status: "AUDIO",
    title: "Start a room for {city}",
    detail: "Someone else is probably up too.",
    to: "/g/$slug",
    params: { slug: "{cityGroupSlug}" },
    needs: ["cityGroup"],
    hours: [20, 24],
    weight: 4,
  },
  {
    id: "live-events-tonight",
    lane: "live",
    source: "event",
    status: "TONIGHT",
    title: "What's on tonight",
    detail: "Events happening in the next few hours.",
    to: "/events",
    search: { when: "upcoming" },
    weight: 4,
  },
  {
    id: "live-events-week",
    lane: "live",
    source: "event",
    status: "THIS WEEK",
    title: "This week's events",
    to: "/events",
    search: { when: "upcoming" },
    weight: 3,
  },
  {
    id: "live-events-city",
    lane: "live",
    source: "event",
    status: "{city}",
    title: "Events near you in {city}",
    to: "/events",
    needs: ["city"],
    weight: 3,
  },
  {
    id: "live-events-online",
    lane: "live",
    source: "event",
    status: "ONLINE",
    title: "Online sessions you can join from anywhere",
    to: "/events",
    search: { format: "online" },
    weight: 2,
  },
  {
    id: "live-groups-browse",
    lane: "live",
    source: "group",
    status: "GROUPS",
    title: "Find a room that's actually talking",
    to: "/groups",
    weight: 2,
  },
  {
    id: "live-today-checkin",
    lane: "live",
    source: "today",
    status: "CHECK IN",
    title: "{daypart} check-in: what changed today?",
    detail: "Two sentences, then back to work.",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 3,
  },
  {
    id: "live-today-blocker",
    lane: "live",
    source: "today",
    status: "TODAY",
    title: "Name the thing that's blocking you",
    detail: "Someone in {group} has hit it before.",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 3,
  },
  {
    id: "live-today-wip",
    lane: "live",
    source: "today",
    status: "WIP",
    title: "Drop a work-in-progress frame",
    detail: "Unfinished is the point.",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 3,
  },
  {
    id: "live-weekend-plan",
    lane: "live",
    source: "event",
    status: "WEEKEND",
    title: "Make a weekend plan with people",
    to: "/events",
    search: { when: "upcoming" },
    days: [4, 5, 6],
    weight: 4,
  },
  {
    id: "live-monday-set",
    lane: "live",
    source: "today",
    status: "MONDAY",
    title: "Set one goal for the week",
    detail: "Post it so it's real.",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    days: [1],
    weight: 4,
  },
  {
    id: "live-friday-recap",
    lane: "live",
    source: "today",
    status: "FRIDAY",
    title: "Recap the week in three lines",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    days: [5],
    weight: 4,
  },
  {
    id: "live-morning-open",
    lane: "live",
    source: "today",
    status: "MORNING",
    title: "Say what you're starting today",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    hours: [5, 11],
    weight: 3,
  },
  {
    id: "live-late-shift",
    lane: "live",
    source: "today",
    status: "LATE",
    title: "Late shift — who else is up?",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    hours: [22, 24],
    weight: 3,
  },
  {
    id: "live-city-groups",
    lane: "live",
    source: "city",
    status: "{city}",
    title: "Groups organising in {city}",
    to: "/groups",
    needs: ["city"],
    weight: 2,
  },
  {
    id: "live-mine-events",
    lane: "live",
    source: "event",
    status: "YOURS",
    title: "Events you said you'd go to",
    to: "/events",
    search: { mine: true },
    weight: 2,
  },
  {
    id: "live-irl",
    lane: "live",
    source: "event",
    status: "IN PERSON",
    title: "Something to leave the house for",
    to: "/events",
    search: { format: "in_person" },
    weight: 2,
  },
];

/* ─────────────────────────── MAKE lane ─────────────────────────── */

const MAKE: NowSeed[] = [
  {
    id: "make-publish-work",
    lane: "make",
    source: "continue",
    status: "PUBLISH",
    title: "Publish something you've been sitting on",
    detail: "It doesn't have to be finished.",
    to: "/works/new",
    weight: 6,
  },
  {
    id: "make-publish-medium",
    lane: "make",
    source: "medium",
    status: "{medium}",
    title: "Post a new piece of {medium}",
    to: "/works/new",
    needs: ["medium"],
    weight: 5,
  },
  {
    id: "make-publish-group",
    lane: "make",
    source: "group",
    status: "{group}",
    title: "Share your latest work with {group}",
    to: "/works/new",
    search: { group: "{groupSlug}" },
    needs: ["group"],
    weight: 4,
  },
  {
    id: "make-process-note",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "Write the process note nobody asked for",
    detail: "How you actually made the thing.",
    action: { kind: "blog-prompt", seedPromptId: "process-note" },
    weight: 5,
  },
  {
    id: "make-what-changed",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "What changed in your work this year",
    action: { kind: "blog-prompt", seedPromptId: "what-changed" },
    weight: 4,
  },
  {
    id: "make-five-things",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "Five things you're stealing from right now",
    action: { kind: "blog-prompt", seedPromptId: "five-influences" },
    weight: 4,
  },
  {
    id: "make-tools",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "The tools you actually use",
    detail: "Not the ones you meant to use.",
    action: { kind: "blog-prompt", seedPromptId: "tools" },
    weight: 3,
  },
  {
    id: "make-failed",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "A project that failed, and what it taught you",
    action: { kind: "blog-prompt", seedPromptId: "failed-project" },
    weight: 3,
  },
  {
    id: "make-city-scene",
    lane: "make",
    source: "city",
    status: "WRITE",
    title: "Write about the scene in {city}",
    action: { kind: "blog-prompt", seedPromptId: "city-scene" },
    needs: ["city"],
    weight: 4,
  },
  {
    id: "make-medium-essay",
    lane: "make",
    source: "medium",
    status: "WRITE",
    title: "Say something honest about {medium}",
    action: { kind: "blog-prompt", seedPromptId: "medium-essay" },
    needs: ["medium"],
    weight: 4,
  },
  {
    id: "make-work-story",
    lane: "make",
    source: "continue",
    status: "WRITE",
    title: "Tell the story behind \u201c{work}\u201d",
    action: { kind: "blog-prompt", seedPromptId: "work-story" },
    needs: ["work"],
    weight: 5,
  },
  {
    id: "make-collab-open",
    lane: "make",
    source: "evergreen",
    status: "COLLAB",
    title: "Open a call for collaborators",
    to: "/collab/new",
    weight: 5,
  },
  {
    id: "make-collab-weekend-film",
    lane: "make",
    source: "evergreen",
    status: "COLLAB",
    title: "Weekend short film — find a crew",
    action: { kind: "collab-prompt", prompt: "weekend-short-film" },
    days: [3, 4, 5],
    weight: 4,
  },
  {
    id: "make-collab-remix",
    lane: "make",
    source: "evergreen",
    status: "COLLAB",
    title: "One-night remix swap",
    action: { kind: "collab-prompt", prompt: "one-night-remix" },
    weight: 3,
  },
  {
    id: "make-collab-feedback",
    lane: "make",
    source: "evergreen",
    status: "COLLAB",
    title: "Portfolio feedback swap",
    detail: "You read theirs, they read yours.",
    action: { kind: "collab-prompt", prompt: "portfolio-feedback-swap" },
    weight: 4,
  },
  {
    id: "make-collab-table-read",
    lane: "make",
    source: "evergreen",
    status: "COLLAB",
    title: "Table read for a draft script",
    action: { kind: "collab-prompt", prompt: "table-read" },
    weight: 3,
  },
  {
    id: "make-collab-photo-walk",
    lane: "make",
    source: "city",
    status: "COLLAB",
    title: "Photo walk in {city}",
    action: { kind: "collab-prompt", prompt: "photo-walk" },
    needs: ["city"],
    weight: 4,
  },
  {
    id: "make-ask-feedback",
    lane: "make",
    source: "group",
    status: "FEEDBACK",
    title: "Ask {group} for one hard note",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 4,
  },
  {
    id: "make-give-feedback",
    lane: "make",
    source: "evergreen",
    status: "FEEDBACK",
    title: "Give someone a real note today",
    to: "/gallery",
    search: { sort: "recent" },
    weight: 4,
  },
  {
    id: "make-timebox-20",
    lane: "make",
    source: "evergreen",
    status: "20 MIN",
    title: "Twenty minutes, one small piece, publish it",
    to: "/works/new",
    weight: 3,
  },
  {
    id: "make-timebox-60",
    lane: "make",
    source: "evergreen",
    status: "1 HOUR",
    title: "One hour of undistracted work, then post the result",
    to: "/works/new",
    weight: 3,
  },
  {
    id: "make-b-side",
    lane: "make",
    source: "evergreen",
    status: "B-SIDE",
    title: "Publish the version you rejected",
    to: "/works/new",
    weight: 3,
  },
  {
    id: "make-archive",
    lane: "make",
    source: "evergreen",
    status: "ARCHIVE",
    title: "Dig out something from two years ago",
    to: "/works/new",
    weight: 2,
  },
  {
    id: "make-series",
    lane: "make",
    source: "medium",
    status: "SERIES",
    title: "Turn your {medium} into a series",
    to: "/works/new",
    needs: ["medium"],
    weight: 3,
  },
  {
    id: "make-constraint",
    lane: "make",
    source: "evergreen",
    status: "EXERCISE",
    title: "Make something using only one constraint",
    detail: "One colour, one take, one instrument.",
    to: "/works/new",
    weight: 3,
  },
  {
    id: "make-collab-group",
    lane: "make",
    source: "group",
    status: "COLLAB",
    title: "Start a project with {group}",
    to: "/collab/new",
    search: { group: "{groupSlug}" },
    needs: ["group"],
    weight: 4,
  },
  {
    id: "make-morning-page",
    lane: "make",
    source: "evergreen",
    status: "MORNING",
    title: "Write 300 words before anything else",
    action: { kind: "blog-prompt", seedPromptId: "morning-pages" },
    hours: [5, 11],
    weight: 3,
  },
  {
    id: "make-sunday-reset",
    lane: "make",
    source: "evergreen",
    status: "SUNDAY",
    title: "Plan the week's one real project",
    action: { kind: "blog-prompt", seedPromptId: "week-plan" },
    days: [0],
    weight: 4,
  },
  {
    id: "make-teach",
    lane: "make",
    source: "medium",
    status: "TEACH",
    title: "Teach one {medium} technique in 400 words",
    action: { kind: "blog-prompt", seedPromptId: "teach-technique" },
    needs: ["medium"],
    weight: 3,
  },
  {
    id: "make-interview",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "Interview someone whose work you like",
    action: { kind: "blog-prompt", seedPromptId: "interview" },
    weight: 3,
  },
  {
    id: "make-review",
    lane: "make",
    source: "city",
    status: "WRITE",
    title: "Review a show you saw in {city}",
    action: { kind: "blog-prompt", seedPromptId: "review" },
    needs: ["city"],
    weight: 3,
  },
  {
    id: "make-manifesto",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "Write the manifesto for your practice",
    action: { kind: "blog-prompt", seedPromptId: "manifesto" },
    weight: 2,
  },
  {
    id: "make-day-in-life",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "A day in your working life, hour by hour",
    action: { kind: "blog-prompt", seedPromptId: "day-in-life" },
    weight: 2,
  },
  {
    id: "make-money",
    lane: "make",
    source: "evergreen",
    status: "WRITE",
    title: "How you actually pay for the work",
    action: { kind: "blog-prompt", seedPromptId: "money" },
    weight: 2,
  },
  {
    id: "make-collab-browse",
    lane: "make",
    source: "evergreen",
    status: "JOIN",
    title: "Answer someone else's open call",
    to: "/collab",
    weight: 4,
  },
  {
    id: "make-collab-medium",
    lane: "make",
    source: "medium",
    status: "{medium}",
    title: "Open calls looking for {medium}",
    to: "/collab",
    needs: ["medium"],
    weight: 4,
  },
  {
    id: "make-collab-city",
    lane: "make",
    source: "city",
    status: "{city}",
    title: "Collaborators in {city}",
    to: "/collab",
    needs: ["city"],
    weight: 4,
  },
  {
    id: "make-collab-online",
    lane: "make",
    source: "evergreen",
    status: "REMOTE",
    title: "Remote-friendly collaborations",
    to: "/collab",
    search: { online: true },
    weight: 2,
  },
  {
    id: "make-finish",
    lane: "make",
    source: "continue",
    status: "FINISH",
    title: "Finish \u201c{work}\u201d instead of starting something new",
    needs: ["work"],
    to: "/works/$slug",
    params: { slug: "{workSlug}" },
    weight: 4,
  },
  {
    id: "make-caption",
    lane: "make",
    source: "continue",
    status: "EDIT",
    title: "Give \u201c{work}\u201d the description it deserves",
    needs: ["work"],
    to: "/works/$slug/edit",
    params: { slug: "{workSlug}" },
    weight: 3,
  },
  {
    id: "make-night-session",
    lane: "make",
    source: "evergreen",
    status: "NIGHT",
    title: "One quiet hour on the thing you keep avoiding",
    to: "/works/new",
    hours: [21, 24],
    weight: 3,
  },
  {
    id: "make-sketch",
    lane: "make",
    source: "evergreen",
    status: "SKETCH",
    title: "Post a sketch, not a finished piece",
    to: "/works/new",
    weight: 3,
  },
  {
    id: "make-remake",
    lane: "make",
    source: "evergreen",
    status: "EXERCISE",
    title: "Remake something you love, badly, on purpose",
    to: "/works/new",
    weight: 2,
  },
  {
    id: "make-collab-mentor",
    lane: "make",
    source: "evergreen",
    status: "COLLAB",
    title: "Offer an hour of your expertise",
    to: "/collab/new",
    weight: 3,
  },
  {
    id: "make-group-today",
    lane: "make",
    source: "group",
    status: "{group}",
    title: "Answer today's thread in {group}",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 4,
  },
];

/* ────────────────────────── EXPLORE lane ────────────────────────── */

const EXPLORE: NowSeed[] = [
  {
    id: "exp-gallery-new",
    lane: "explore",
    source: "evergreen",
    status: "GALLERY",
    title: "Newest work on Workshop",
    to: "/gallery",
    search: { sort: "recent" },
    weight: 5,
  },
  {
    id: "exp-gallery-medium",
    lane: "explore",
    source: "medium",
    status: "{medium}",
    title: "The best new {medium} this week",
    to: "/gallery",
    needs: ["medium"],
    weight: 5,
  },
  {
    id: "exp-gallery-city",
    lane: "explore",
    source: "city",
    status: "{city}",
    title: "Work being made in {city}",
    to: "/gallery",
    needs: ["city"],
    weight: 5,
  },
  {
    id: "exp-blog-latest",
    lane: "explore",
    source: "evergreen",
    status: "READ",
    title: "Latest stories from the Workshop blog",
    to: "/blog",
    weight: 5,
  },
  {
    id: "exp-blog-members",
    lane: "explore",
    source: "evergreen",
    status: "READ",
    title: "What members are writing",
    to: "/blog",
    weight: 4,
  },
  {
    id: "exp-groups-browse",
    lane: "explore",
    source: "group",
    status: "GROUPS",
    title: "Find your people",
    to: "/groups",
    weight: 4,
  },
  {
    id: "exp-groups-city",
    lane: "explore",
    source: "city",
    status: "{city}",
    title: "Groups based in {city}",
    to: "/groups",
    needs: ["city"],
    weight: 4,
  },
  {
    id: "exp-cities",
    lane: "explore",
    source: "city",
    status: "CITIES",
    title: "See what other cities are building",
    to: "/cities",
    weight: 3,
  },
  {
    id: "exp-events",
    lane: "explore",
    source: "event",
    status: "EVENTS",
    title: "Everything coming up",
    to: "/events",
    weight: 4,
  },
  {
    id: "exp-collabs",
    lane: "explore",
    source: "evergreen",
    status: "OPEN CALLS",
    title: "Who needs help right now",
    to: "/collab",
    weight: 4,
  },
  {
    id: "exp-network",
    lane: "explore",
    source: "network",
    status: "PEOPLE",
    title: "People whose work you should know",
    to: "/me/network",
    weight: 3,
  },
  {
    id: "exp-friends",
    lane: "explore",
    source: "network",
    status: "CIRCLE",
    title: "What your circle has been posting",
    to: "/me/friends",
    weight: 3,
  },
  {
    id: "exp-workshops",
    lane: "explore",
    source: "evergreen",
    status: "WORKSHOPS",
    title: "Workshops you can sit in on",
    to: "/workshops",
    weight: 3,
  },
  {
    id: "exp-gallery-photo",
    lane: "explore",
    source: "evergreen",
    status: "PHOTO",
    title: "Photography worth ten minutes",
    to: "/gallery",
    search: { cat: "visual" },
    weight: 2,
  },
  {
    id: "exp-gallery-music",
    lane: "explore",
    source: "evergreen",
    status: "MUSIC",
    title: "New music from members",
    to: "/gallery",
    search: { cat: "music" },
    weight: 2,
  },
  {
    id: "exp-gallery-film",
    lane: "explore",
    source: "evergreen",
    status: "FILM",
    title: "Short film and video",
    to: "/gallery",
    search: { cat: "film" },
    weight: 2,
  },
  {
    id: "exp-gallery-writing",
    lane: "explore",
    source: "evergreen",
    status: "WRITING",
    title: "Writing from the community",
    to: "/gallery",
    search: { cat: "writing" },
    weight: 2,
  },
  {
    id: "exp-gallery-design",
    lane: "explore",
    source: "evergreen",
    status: "DESIGN",
    title: "Design and visual identity work",
    to: "/gallery",
    search: { cat: "visual" },
    weight: 2,
  },
  {
    id: "exp-gallery-art",
    lane: "explore",
    source: "evergreen",
    status: "ART",
    title: "Painting, drawing, and mixed media",
    to: "/gallery",
    search: { cat: "visual" },
    weight: 2,
  },
  {
    id: "exp-group-mine",
    lane: "explore",
    source: "group",
    status: "{group}",
    title: "Catch up on {group}",
    to: "/g/$slug",
    params: { slug: "{groupSlug}" },
    needs: ["group"],
    weight: 4,
  },
  {
    id: "exp-city-group",
    lane: "explore",
    source: "city",
    status: "{city}",
    title: "The {city} group board",
    to: "/g/$slug",
    params: { slug: "{cityGroupSlug}" },
    needs: ["cityGroup"],
    weight: 4,
  },
  {
    id: "exp-events-weekend",
    lane: "explore",
    source: "event",
    status: "WEEKEND",
    title: "Weekend plans, sorted",
    to: "/events",
    search: { when: "upcoming" },
    days: [3, 4, 5, 6],
    weight: 3,
  },
  {
    id: "exp-blog-long",
    lane: "explore",
    source: "evergreen",
    status: "LONG READ",
    title: "Something longer than a feed post",
    to: "/blog",
    weight: 3,
  },
  {
    id: "exp-gallery-random",
    lane: "explore",
    source: "evergreen",
    status: "WANDER",
    title: "Scroll the gallery with no agenda",
    to: "/gallery",
    weight: 2,
  },
  {
    id: "exp-pricing",
    lane: "explore",
    source: "evergreen",
    status: "PLUS",
    title: "What Workshop Plus unlocks",
    to: "/pricing",
    weight: 1,
  },
  {
    id: "exp-refer",
    lane: "explore",
    source: "network",
    status: "INVITE",
    title: "Bring someone whose work deserves an audience",
    to: "/refer",
    weight: 2,
  },
  {
    id: "exp-profile",
    lane: "explore",
    source: "continue",
    status: "PROFILE",
    title: "Your profile could say more about the work",
    to: "/me/edit",
    weight: 2,
  },
  {
    id: "exp-mycollabs",
    lane: "explore",
    source: "continue",
    status: "YOURS",
    title: "Check in on your open calls",
    to: "/me/collabs",
    weight: 2,
  },
  {
    id: "exp-myblog",
    lane: "explore",
    source: "continue",
    status: "DRAFTS",
    title: "You have writing waiting in drafts",
    to: "/me/blog",
    weight: 3,
  },
  {
    id: "exp-gallery-city-new",
    lane: "explore",
    source: "city",
    status: "{city}",
    title: "Newest from {city} makers",
    to: "/gallery",
    search: { sort: "recent" },
    needs: ["city"],
    weight: 3,
  },
  {
    id: "exp-collab-cat",
    lane: "explore",
    source: "evergreen",
    status: "CREW",
    title: "Projects looking for crew",
    to: "/collab",
    weight: 3,
  },
  {
    id: "exp-morning-read",
    lane: "explore",
    source: "evergreen",
    status: "MORNING",
    title: "One story with your coffee",
    to: "/blog",
    hours: [5, 11],
    weight: 3,
  },
  {
    id: "exp-evening-read",
    lane: "explore",
    source: "evergreen",
    status: "EVENING",
    title: "Wind down with someone's process notes",
    to: "/blog",
    hours: [19, 24],
    weight: 3,
  },
  {
    id: "exp-groups-new",
    lane: "explore",
    source: "group",
    status: "NEW",
    title: "Groups that just opened up",
    to: "/groups",
    weight: 2,
  },
  {
    id: "exp-workshops-join",
    lane: "explore",
    source: "evergreen",
    status: "LEARN",
    title: "Learn something from another maker",
    to: "/workshops",
    weight: 2,
  },
  {
    id: "exp-events-online",
    lane: "explore",
    source: "event",
    status: "ONLINE",
    title: "Join from wherever you are",
    to: "/events",
    search: { format: "online" },
    weight: 2,
  },
  {
    id: "exp-tickets",
    lane: "explore",
    source: "continue",
    status: "TICKETS",
    title: "Your tickets and RSVPs",
    to: "/me/tickets",
    weight: 1,
  },
  {
    id: "exp-gallery-medium-deep",
    lane: "explore",
    source: "medium",
    status: "{medium}",
    title: "Go deep on {medium} today",
    to: "/gallery",
    needs: ["medium"],
    weight: 3,
  },
  {
    id: "exp-neighbours",
    lane: "explore",
    source: "city",
    status: "NEARBY",
    title: "Makers near you in {city}",
    to: "/cities/$slug",
    params: { slug: "{citySlug}" },
    needs: ["city"],
    weight: 3,
  },
  {
    id: "exp-blog-city",
    lane: "explore",
    source: "city",
    status: "READ",
    title: "Stories out of {city}",
    to: "/blog",
    needs: ["city"],
    weight: 3,
  },
];

export const NOW_SEEDS: NowSeed[] = [...LIVE, ...MAKE, ...EXPLORE];

/* ───────────────────────── substitution ───────────────────────── */

const TOKEN = /\{(city|citySlug|cityGroupSlug|medium|group|groupSlug|work|workSlug|daypart)\}/g;

function fill(text: string, ctx: NowContext): string | null {
  let ok = true;
  const out = text.replace(TOKEN, (_m, key: string) => {
    const value = (ctx as unknown as Record<string, string | null>)[key];
    if (!value) {
      ok = false;
      return "";
    }
    return value;
  });
  return ok ? out : null;
}

function meetsNeeds(seed: NowSeed, ctx: NowContext): boolean {
  for (const need of seed.needs ?? []) {
    if (need === "city" && !ctx.city) return false;
    if (need === "city" && seed.to === "/cities/$slug" && !ctx.citySlug) return false;
    if (need === "cityGroup" && !ctx.cityGroupSlug) return false;
    if (need === "medium" && !ctx.medium) return false;
    if (need === "group" && !(ctx.group && ctx.groupSlug)) return false;
    if (need === "work" && !(ctx.work && ctx.workSlug)) return false;
  }
  if (seed.days && !seed.days.includes(ctx.day)) return false;
  if (seed.hours) {
    const [start, end] = seed.hours;
    if (ctx.hour < start || ctx.hour >= end) return false;
  }
  return true;
}

/** Resolve a seed against context, or return null when it cannot be rendered. */
export function resolveSeed(seed: NowSeed, ctx: NowContext): HomeNowItem | null {
  if (!meetsNeeds(seed, ctx)) return null;
  const full = ctx;

  const title = fill(seed.title, full);
  if (!title) return null;
  const status = fill(seed.status, full);
  if (!status) return null;
  const detail = seed.detail ? fill(seed.detail, full) : null;
  if (seed.detail && !detail) return null;

  let params: Record<string, string> | undefined;
  if (seed.params) {
    params = {};
    for (const [k, v] of Object.entries(seed.params)) {
      const filled = fill(v, full);
      if (!filled) return null;
      params[k] = filled;
    }
  }
  let search: Record<string, string | number | boolean> | undefined;
  if (seed.search) {
    search = {};
    for (const [k, v] of Object.entries(seed.search)) {
      if (typeof v === "string") {
        const filled = fill(v, full);
        if (!filled) return null;
        search[k] = filled;
      } else {
        search[k] = v;
      }
    }
  }
  let action = seed.action;
  if (action?.kind === "collab-prompt" && ctx.groupSlug) {
    action = { ...action, groupSlug: ctx.groupSlug };
  }

  return {
    id: seed.id,
    lane: seed.lane,
    source: seed.source,
    status: status.toUpperCase(),
    title,
    detail,
    to: seed.to,
    params,
    search,
    action,
    weight: seed.weight ?? 2,
  };
}

export function resolveSeeds(ctx: NowContext, lane?: HomeNowLane): HomeNowItem[] {
  return NOW_SEEDS.filter((s) => !lane || s.lane === lane)
    .map((s) => resolveSeed(s, ctx))
    .filter((i): i is HomeNowItem => !!i);
}
