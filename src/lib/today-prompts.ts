export const TODAY_PROMPTS: readonly string[] = [
  "Who wants to make a short film this month?",
  "Photo walk today?",
  "Looking for a scene partner to run lines this week",
  "Anyone free to read a 10-page script tonight?",
  "Need a second shooter Saturday — trade favors?",
  "Coffee + co-writing session tomorrow morning?",
  "Who's editing this weekend and wants company?",
  "Open mic tonight — anyone going?",
  "Need a composer for a 3-min short, small budget",
  "Looking for an actor, mid-20s, one-day shoot",
  "Anyone want to swap portfolio feedback?",
  "Free studio time Thursday if someone needs it",
  "Cyanotype / darkroom day — who's in?",
  "Building a table read group, DM me",
  "Want to jam? Bass + drums looking for a guitarist",
  "Anyone shooting on 16mm this month?",
  "Need a location scout partner for a Sunday drive",
  "Looking for a colorist rec that isn't booked out",
  "Who wants to hit a gallery opening tonight?",
  "Free tickets to a screening tomorrow — first two DMs",
  "Anyone up for a writer's room this week?",
  "Need feedback on a 30-sec teaser cut",
  "Looking to co-direct something small this summer",
  "Zine trade — bring one, take one, this weekend",
  "Sound mixer available Saturday if anyone's shooting",
];

export function sampleN<T>(pool: readonly T[], n: number): T[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}
