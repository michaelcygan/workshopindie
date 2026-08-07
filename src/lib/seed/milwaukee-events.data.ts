/**
 * Verified Milwaukee external-events manifest.
 *
 * Every entry is a real event run by a real Milwaukee organizer. Workshop is
 * the discovery layer only: each row seeds as `source: "external"`,
 * `is_official: false`, and always links the organizer's own page.
 *
 * Rules for adding here:
 *  - The schedule must be published by the organizer (their site, calendar or
 *    Meetup/Eventbrite listing) and was read during implementation.
 *  - `source_note` records where it was read, so it can be re-checked.
 *  - `key` is the stable idempotency key. Never rename one.
 *  - nth-weekday programs ("first Saturday", "second Wednesday") are seeded as
 *    explicit dates: Workshop's MONTHLY rule is numeric day-of-month only.
 */
import type { SeedEvent } from "./city-events.shared";

export const MILWAUKEE_GROUP_SLUG = "milwaukee";
export const MILWAUKEE_TIMEZONE = "America/Chicago";

export const MILWAUKEE_SEED_EVENTS: SeedEvent[] = [
  // ------------------------------------------------------------ writing --
  {
    key: "mke_woodland_readshop",
    cadence: "biweekly",
    anchor_local: "2026-08-19T18:00",
    recurrence_label: "Every other Tuesday",
    duration_minutes: 75,
    title: "Readshop (Woodland Pattern)",
    tagline: "Poet-led online reading group, every other Tuesday.",
    description:
      "Woodland Pattern's Readshop is an online reading group led by a poet: the group reads and talks through work together rather than workshopping their own drafts. Sessions run about 75 minutes on Zoom. Register through Woodland Pattern — they send the meeting link to registrants.",
    kind: "online",
    creative_category: "writing",
    format: "online",
    venue_name: "Online (Zoom)",
    external_url: "https://woodlandpattern.org/events/community-group-readshop-summer-2026",
    external_organizer: "Woodland Pattern",
    source_note:
      "woodlandpattern.org/events — Readshop listed Aug 19, Sep 2, Sep 16, Sep 30 2026, 6:00–7:15pm, online.",
  },
  {
    key: "mke_woodland_poetry_in_the_park",
    cadence: "dated",
    occurrences: ["2026-08-11T18:30", "2026-09-08T18:30"],
    recurrence_label: "Summer series at Juneau Park",
    duration_minutes: 120,
    title: "Poetry in the Park",
    tagline: "Outdoor readings in Juneau Park, summer series.",
    description:
      "Woodland Pattern's summer reading series moves outdoors to Juneau Park, with a different lineup of poets each month. Bring something to sit on. Free and open to anyone; check Woodland Pattern's listing for the current readers and any weather changes.",
    kind: "lineup",
    creative_category: "writing",
    venue_name: "Juneau Park",
    venue_address: "900 N. Prospect Ave., Milwaukee, WI",
    external_url: "https://woodlandpattern.org/events/poetry-reading-poetry-in-the-park-august-2026",
    external_organizer: "Woodland Pattern",
    source_note:
      "woodlandpattern.org/events — Aug 11 2026 and Sep 8 2026, 6:30–8:30pm, Juneau Park.",
  },
  {
    key: "mke_woodland_solitary_plover",
    cadence: "dated",
    occurrences: ["2026-08-13T18:30"],
    recurrence_label: "Occasional online gathering",
    duration_minutes: 60,
    title: "Solitary Plover: Summer 2026",
    tagline: "Online Lorine Niedecker reading, hosted with Woodland Pattern.",
    description:
      "The Friends of Lorine Niedecker host this online gathering around Niedecker's poetry, presented with Woodland Pattern. It runs about an hour on Zoom. Register through Woodland Pattern's event page for the link.",
    kind: "online",
    creative_category: "writing",
    format: "online",
    venue_name: "Online (Zoom)",
    external_url: "https://woodlandpattern.org/events/poetry-reading-solitary-plover-summer-2026",
    external_organizer: "Woodland Pattern / Friends of Lorine Niedecker",
    source_note: "woodlandpattern.org/events — Aug 13 2026, 6:30–7:30pm, online.",
  },
  {
    key: "mke_woodland_over_under_prairie",
    cadence: "dated",
    occurrences: ["2026-09-19T14:00"],
    recurrence_label: "Workshop series session",
    duration_minutes: 120,
    title: "Over the Prairie // Under the Prairie with Lily Lalios",
    tagline: "In-person writing workshop at Woodland Pattern.",
    description:
      "An in-person writing workshop session led by Lily Lalios, part of Woodland Pattern's workshop programming with the 2026 Milwaukee Emerging Poet. Two hours at the bookstore on Locust Street. Registration details are on Woodland Pattern's event page.",
    kind: "workshop_irl",
    creative_category: "writing",
    venue_name: "Woodland Pattern Book Center",
    venue_address: "700 E. Locust St., Milwaukee, WI 53212",
    external_url:
      "https://woodlandpattern.org/events/workshop-series-over-the-prairie-under-the-prairie-with-lily-lalios",
    external_organizer: "Woodland Pattern",
    source_note: "woodlandpattern.org/events — Sep 19 2026, 2:00–4:00pm, Woodland Pattern.",
  },
  {
    key: "mke_lions_tooth_comix_book_club",
    cadence: "dated",
    occurrences: [
      "2026-08-13T18:00",
      "2026-09-10T18:00",
      "2026-10-08T18:00",
      "2026-11-12T18:00",
    ],
    recurrence_label: "Second Thursday of the month",
    duration_minutes: 120,
    title: "Comix Book Club at Lion's Tooth",
    tagline: "Second Thursdays, 6–8pm, free and open to the public.",
    description:
      "Lion's Tooth's comics reading group meets on second Thursdays to talk through one graphic novel per month — recent picks include The Complete Persepolis and How I Make Comics. Free and open to the public; the shop stocks each month's book. No book club in December.",
    kind: "workshop_irl",
    creative_category: "writing",
    secondary_categories: ["visual_art"],
    venue_name: "Lion's Tooth",
    venue_address: "2421 S Kinnickinnic Ave, Milwaukee, WI 53207",
    external_url: "https://www.lionstoothmke.com/book-clubs.html",
    external_organizer: "Lion's Tooth",
    source_note:
      "lionstoothmke.com/book-clubs — 'Comix Book Club, Second Thursday of the month', upcoming Aug 13, Sep 10, Oct 8, Nov 12 2026, Thursdays 6–8PM, free.",
  },

  // -------------------------------------------------------- games / tech --
  {
    key: "mke_miltown_saturday_workgroup",
    cadence: "biweekly",
    anchor_local: "2026-08-08T11:00",
    recurrence_label: "Every two weeks on Saturday",
    duration_minutes: 120,
    title: "Miltown Game Developers: Saturday Workgroup",
    tagline: "Work on your game alongside other Milwaukee developers, online.",
    description:
      "Milwaukee's game-dev community meets online every two weeks to work on projects together and share progress. The usual shape: catch-up, area happenings, then short presentations from whoever wants to show something. Programmers, artists, designers and writers all turn up. RSVP through Meetup — the group posts the joining details there.",
    kind: "online",
    creative_category: "games_tech",
    format: "online",
    venue_name: "Online",
    external_url: "https://www.meetup.com/miltown-game-developers/events/",
    external_organizer: "Miltown Game Developers",
    source_note:
      "meetup.com/miltown-game-developers — Saturday Workgroup (Virtual), Aug 8 and Aug 22 2026, 11:00 AM CDT, every two weeks.",
  },
  {
    key: "mke_mitobyte_code_and_brews",
    cadence: "dated",
    occurrences: [
      "2026-08-12T17:00",
      "2026-09-09T17:00",
      "2026-10-14T17:00",
      "2026-11-11T17:00",
    ],
    recurrence_label: "Second Wednesday of the month",
    duration_minutes: 180,
    title: "Code + Brews",
    tagline: "Second Wednesdays, 5–8pm. Evening coding and community.",
    description:
      "Mitobyte's evening spin on Code & Coffee: bring a laptop and a project, or just come to meet other Milwaukee developers. Informal coding plus networking in a relaxed night setting. Register through Mitobyte's Meetup or Eventbrite — the venue is listed on each event.",
    kind: "networking",
    creative_category: "games_tech",
    venue_name: "Venue announced per event — see Mitobyte's listing",
    external_url: "https://mitobyte.com/events/code-and-brews",
    external_organizer: "Mitobyte",
    source_note:
      "mitobyte.com/events/code-and-brews — 'Occurs: 2nd Wednesday each month', 'Timing: 5pm to 8pm'.",
  },
  {
    key: "mke_mitobyte_code_and_coffee",
    cadence: "dated",
    occurrences: [
      "2026-09-05T09:00",
      "2026-10-03T09:00",
      "2026-11-07T09:00",
      "2026-12-05T09:00",
    ],
    recurrence_label: "First Saturday of the month",
    duration_minutes: 180,
    title: "Code & Coffee",
    tagline: "First Saturdays, 9am–noon. Daytime coding and coworking.",
    description:
      "Milwaukee's chapter of the national Code & Coffee network, run by Mitobyte. A morning of informal coding, coworking and meeting other developers — beginners welcome. Register through Mitobyte's Meetup or Eventbrite, where each month's venue is posted.",
    kind: "networking",
    creative_category: "games_tech",
    venue_name: "Venue announced per event — see Mitobyte's listing",
    external_url: "https://mitobyte.com/events/code-and-coffee",
    external_organizer: "Mitobyte",
    source_note:
      "mitobyte.com/events/code-and-coffee — 'Occurs: 1st Saturday each month', 'Timing: 9am to 12pm'.",
  },
  {
    key: "mke_makerspace_public_meeting_lenox",
    cadence: "dated",
    occurrences: [
      "2026-09-01T19:00",
      "2026-10-06T19:00",
      "2026-11-03T19:00",
      "2026-12-01T19:00",
    ],
    recurrence_label: "First Tuesday of the month — Lenox",
    duration_minutes: 90,
    title: "Milwaukee Makerspace Public Meeting — Lenox",
    tagline: "First Tuesdays. Doors 6:45pm, meeting 7pm. RSVP required.",
    description:
      "Milwaukee Makerspace opens its Lenox building to visitors on first Tuesdays: a public meeting plus a look around the shops — woodworking, metal, electronics, textiles, 3D printing and more. Prospective members must attend a meeting at both buildings before orientation. Guests must RSVP in advance through the Makerspace's form; unregistered walk-ins can't be accommodated.",
    kind: "networking",
    creative_category: "games_tech",
    secondary_categories: ["visual_art"],
    venue_name: "Milwaukee Makerspace — Lenox",
    venue_address: "2555 South Lenox Street, Milwaukee, WI 53207",
    external_url: "https://www.milwaukeemakerspace.org/join/",
    external_organizer: "Milwaukee Makerspace",
    source_note:
      "milwaukeemakerspace.org/join — 'Public meetings are held twice a month on Tuesdays. 1st Tuesday … Lenox Location … Doors open 6:45 pm, Meeting starts 7:00 pm', RSVP required.",
  },
  {
    key: "mke_makerspace_public_meeting_norwich",
    cadence: "dated",
    occurrences: [
      "2026-08-18T19:00",
      "2026-09-15T19:00",
      "2026-10-20T19:00",
      "2026-11-17T19:00",
    ],
    recurrence_label: "Third Tuesday of the month — Norwich",
    duration_minutes: 90,
    title: "Milwaukee Makerspace Public Meeting — Norwich",
    tagline: "Third Tuesdays at the Norwich building in St. Francis. RSVP required.",
    description:
      "The third-Tuesday public meeting happens at Milwaukee Makerspace's second building, on E Norwich Ave in St. Francis — a short drive from the Lenox shop. Doors at 6:45pm, meeting at 7pm, followed by a tour. Visitors must RSVP in advance; check the Makerspace calendar to confirm the location before you go.",
    kind: "networking",
    creative_category: "games_tech",
    secondary_categories: ["visual_art"],
    venue_name: "Milwaukee Makerspace — Norwich",
    venue_address: "2517 E Norwich Ave, St Francis, WI 53235",
    external_url: "https://www.milwaukeemakerspace.org/join/",
    external_organizer: "Milwaukee Makerspace",
    source_note:
      "milwaukeemakerspace.org/join — '3rd Tuesday of the month at our Norwich Location, 2517 E Norwich Ave, St Francis'; calendar confirms Aug 18 2026 '(N)Public Meeting-Norwich'.",
  },

  // ---------------------------------------------------------- visual art --
  {
    key: "mke_sketch_club_public_museum_2026_08_22",
    cadence: "dated",
    occurrences: ["2026-08-22T13:00"],
    recurrence_label: "One of the club's roaming sketch outings",
    duration_minutes: 150,
    title: "Milwaukee Sketch Club: Sketching at the Milwaukee Public Museum",
    tagline: "Meet at 1pm, draw until 3:30pm. Museum admission applies.",
    description:
      "Milwaukee Sketch Club draws its way around the city — museums, gardens, libraries, landmarks — with a different location each outing. This one meets inside the Milwaukee Public Museum near the stairs past the ticketing counter, sketching from 1:00 to 3:30pm. Museum admission is separate and priced by the museum; bring your own sketchbook and supplies.",
    kind: "workshop_irl",
    creative_category: "visual_art",
    venue_name: "Milwaukee Public Museum",
    external_url: "https://www.meetup.com/milwaukee-sketch-club/events/315775180/",
    external_organizer: "Milwaukee Sketch Club",
    source_note:
      "meetup.com/milwaukee-sketch-club — 'Sketching at the Milwaukee Public Museum', Sat Aug 22 2026, 1:00 PM CDT, meet near the stairs, sketch until 3:30PM.",
  },

  // --------------------------------------------------------- film / video --
  {
    key: "mke_mkefilm_cinematic_sisterhood_horsegirls",
    cadence: "dated",
    occurrences: ["2026-08-17T18:30"],
    recurrence_label: "Cinematic Sisterhood series",
    duration_minutes: 150,
    title: "Cinematic Sisterhood: Horsegirls + Q&A",
    tagline: "Aug 17, 6:30pm at the Oriental. Producer and actor Q&A expected.",
    description:
      "Milwaukee Film's Cinematic Sisterhood series screens Horsegirls, Lauren Meyering's comedy about a neurodivergent 22-year-old who finds her footing in the sport of hobbyhorsing. A Q&A with producer Alix Madigan and actor Jerod Haynes, in conversation with local filmmaker/actor Khaula Kai Mahmood, is expected after the screening. Tickets through Milwaukee Film.",
    kind: "screening",
    creative_category: "film_video",
    venue_name: "Oriental Theatre — Lubar Cinema",
    venue_address: "2230 N Farwell Ave, Milwaukee, WI 53202",
    external_url: "https://mkefilm.org/films/6a511642f38a4ea9d809fe4a",
    external_organizer: "Milwaukee Film",
    source_note:
      "mkefilm.org film page — 'Monday, August 17, 2026 … 6:30PM Oriental Theatre - Lubar Cinema (West)', part of the Cinematic Sisterhood series.",
  },
  {
    key: "mke_mkefilm_cinematic_sisterhood_dreams_in_nightmares",
    cadence: "dated",
    occurrences: ["2026-09-16T19:00"],
    recurrence_label: "Cinematic Sisterhood series",
    duration_minutes: 180,
    title: "Cinematic Sisterhood: Dreams in Nightmares + Q&A",
    tagline: "Sep 16, 7pm at the Oriental. Director Q&A expected.",
    description:
      "Shatara Michelle Ford's Dreams in Nightmares follows three queer Black femmes on a road trip across the Midwest, screening as part of Milwaukee Film's Cinematic Sisterhood series. Director Shatara Michelle Ford is expected for a Q&A with local filmmaker and poet Dasha Kelly after the film. Tickets through Milwaukee Film.",
    kind: "screening",
    creative_category: "film_video",
    venue_name: "Oriental Theatre — Herzfeld Cinema",
    venue_address: "2230 N Farwell Ave, Milwaukee, WI 53202",
    external_url: "https://mkefilm.org/films/6a63796871351e97224955d2",
    external_organizer: "Milwaukee Film",
    source_note:
      "mkefilm.org film page — 'Wednesday, September 16, 2026 … 7:00PM Oriental Theatre - Herzfeld Cinema (East)', Cinematic Sisterhood series.",
  },
  {
    key: "mke_mkefilm_dialogues_2026",
    cadence: "dated",
    occurrences: ["2026-09-24T09:00"],
    recurrence_label: "Annual festival — September 24–27, 2026",
    duration_minutes: 5100,
    title: "Dialogues Documentary Festival 2026",
    tagline: "Four days of documentaries and discussion, Sep 24–27.",
    description:
      "Milwaukee Film's documentary festival takes over the Downer and Oriental Theatres for four days of films, Q&As, talkbacks and panels. Passes are on sale now; individual tickets go on sale September 8 for members and September 9 for the general public. The full lineup and film guide are announced by Milwaukee Film ahead of the festival.",
    kind: "screening",
    creative_category: "film_video",
    venue_name: "Oriental and Downer Theatres",
    external_url: "https://mkefilm.org/dialogues-documentary-festival/",
    external_organizer: "Milwaukee Film",
    source_note:
      "mkefilm.org/dialogues-documentary-festival — 'September 24-27, 2026', passes on sale, individual tickets Sep 8/9.",
  },
];
