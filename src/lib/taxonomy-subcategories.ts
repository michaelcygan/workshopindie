/**
 * Workshop subcategories — the optional specialization layer beneath a Field.
 *
 * IDs are `<field_id>.<snake_case_label>` and are derived deterministically
 * from the label so the two can never drift. Labels are the single authored
 * source; changing a label changes its id, so treat this list as append-only
 * once shipped.
 *
 * General (`other`) intentionally has no subcategories.
 *
 * This module is imported and re-exported by `@/lib/taxonomy`; import from
 * there, not from here.
 */
import type { FieldId } from "@/lib/taxonomy";

/** Label -> id fragment. Deterministic, stable, url/query safe. */
export function subcategorySlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const LABELS: Record<Exclude<FieldId, "other">, string[]> = {
  music: [
    "Songwriting",
    "Composition",
    "Music Production",
    "Recording",
    "Mixing & Mastering",
    "Musicianship & Instruments",
    "Electronic Music",
    "DJing",
    "Sound Design",
    "Live Sound",
    "Scores & Soundtracks",
    "Podcasting & Radio",
    "Field Recording",
    "Experimental Audio",
    "Remixing & Sampling",
  ],
  film_video: [
    "Narrative Film",
    "Documentary",
    "Animation",
    "Experimental Film",
    "Video Art",
    "Music Videos",
    "Video Essays",
    "Directing",
    "Cinematography",
    "Editing & Post-production",
    "Visual Effects",
    "Production & Crewing",
    "Commercial & Branded Video",
    "Film Festivals & Distribution",
    "Online Video & Streaming",
    "Trailers & Promos",
    "Visualizers",
    "Color Grading",
    "Live Visuals & VJing",
  ],
  writing: [
    "Fiction",
    "Creative Nonfiction",
    "Poetry",
    "Memoir & Biography",
    "Playwriting",
    "Screenwriting",
    "Comics & Graphic Narrative",
    "Writing Craft",
    "Editing",
    "Literary Criticism",
    "Translation",
    "Copywriting",
    "Zines & Independent Publishing",
    "Book Publishing & Self-Publishing",
    "Newsletters & Digital Publishing",
  ],
  visual_art: [
    "Painting",
    "Drawing",
    "Illustration",
    "Photography",
    "Sculpture",
    "Ceramics",
    "Printmaking",
    "Collage & Assemblage",
    "Textile & Fiber Art",
    "Mixed Media",
    "Installation Art",
    "Digital Art",
    "Generative Art",
    "3D Art",
    "Conceptual Art",
    "Public Art & Murals",
    "Street Art",
    "Curating & Exhibitions",
    "Art History & Criticism",
    "Conservation & Restoration",
    "Tattoo Art",
  ],
  design: [
    "Graphic Design",
    "Brand & Identity",
    "Typography",
    "Editorial Design",
    "Web Design",
    "UX/UI Design",
    "Interaction Design",
    "Product Design",
    "Industrial Design",
    "Motion Design",
    "Fashion Design",
    "Interior Design",
    "Packaging Design",
    "Information Design",
    "Data Visualization",
    "Service Design",
    "Design Systems",
    "Accessibility & Inclusive Design",
    "Design Research & Strategy",
    "Exhibition & Environmental Design",
  ],
  performance: [
    "Theatre",
    "Acting",
    "Stage Direction",
    "Dance",
    "Choreography",
    "Performance Art",
    "Spoken Word & Readings",
    "Comedy",
    "Improv",
    "Drag",
    "Musical Theatre",
    "Circus & Clown",
    "Puppetry",
    "Stagecraft & Production",
    "Experimental & Live Art",
    "Voice Acting",
  ],
  journalism_media: [
    "Reporting",
    "Investigative Journalism",
    "Local Journalism",
    "Arts & Culture Journalism",
    "Public-interest Journalism",
    "Photojournalism",
    "Data Journalism",
    "Audio Journalism",
    "Broadcast & Video Journalism",
    "Interviews & Profiles",
    "Criticism & Reviews",
    "Commentary & Opinion",
    "Magazines & Editorial",
    "Independent Media",
    "Media Criticism & Ethics",
    "Verification & Misinformation",
  ],
  software_ai: [
    "Web Development",
    "Mobile Applications",
    "Software Engineering",
    "Creative Coding",
    "Game Development",
    "Artificial Intelligence & Machine Learning",
    "Generative AI",
    "Data Science",
    "Open Source",
    "No-Code & Low-Code",
    "Developer Tools",
    "Automation",
    "APIs & Integrations",
    "Databases",
    "Cloud & Infrastructure",
    "Cybersecurity & Privacy",
    "AR/VR & Spatial Computing",
    "Human-Computer Interaction",
    "AI Ethics & Governance",
  ],
  making_engineering: [
    "Woodworking",
    "Furniture Making",
    "Metalworking",
    "Jewelry & Metalsmithing",
    "Glasswork",
    "Textiles & Sewing",
    "Knitting & Crochet",
    "Leathercraft",
    "Paper & Book Arts",
    "Electronics & Hardware",
    "Robotics",
    "3D Printing",
    "CNC & Digital Fabrication",
    "Model Making",
    "Product Prototyping",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Open Hardware",
    "Repair & Restoration",
    "DIY & Workshop Practice",
    "Culinary & Food Craft",
  ],
  science_research: [
    "Biology & Life Sciences",
    "Physics",
    "Chemistry & Materials",
    "Earth Science",
    "Astronomy & Space",
    "Mathematics & Statistics",
    "Psychology & Cognitive Science",
    "Social Science",
    "Anthropology & Archaeology",
    "History & Archival Research",
    "Medicine & Public Health",
    "Research Methods",
    "Data & Analysis",
    "Field Research",
    "Citizen Science",
    "Open Science",
    "Independent & Academic Research",
    "Research Communication",
  ],
  architecture_cities: [
    "Architecture",
    "Urban Planning",
    "Urban Design",
    "Landscape Architecture",
    "Interior Architecture",
    "Housing",
    "Public Space",
    "Transportation & Mobility",
    "Infrastructure",
    "Construction & Building Systems",
    "Preservation & Adaptive Reuse",
    "Sustainable Architecture",
    "Placemaking",
    "Civic Design",
    "Community Development",
    "Land Use & Development",
    "Maps & Cartography",
    "Architecture History & Criticism",
    "Universal Design",
  ],
  environment_nature: [
    "Ecology",
    "Climate",
    "Conservation",
    "Sustainability",
    "Environmental Justice",
    "Gardening & Horticulture",
    "Agriculture & Food Systems",
    "Community Gardens",
    "Landscape & Land Stewardship",
    "Wildlife",
    "Water & Oceans",
    "Forestry",
    "Renewable Energy",
    "Waste & Circular Systems",
    "Natural History",
    "Nature Observation & Field Notes",
    "Regenerative Design",
    "Environmental Research",
  ],
};

export type Subcategory = {
  /** `<field_id>.<snake_case>` */
  id: string;
  label: string;
  field: FieldId;
};

export const SUBCATEGORIES: readonly Subcategory[] = Object.entries(LABELS).flatMap(
  ([field, labels]) =>
    labels.map((label) => ({
      id: `${field}.${subcategorySlug(label)}`,
      label,
      field: field as FieldId,
    })),
);

export const SUBCATEGORIES_BY_FIELD: Record<FieldId, readonly Subcategory[]> = (() => {
  const out = {} as Record<FieldId, Subcategory[]>;
  for (const s of SUBCATEGORIES) (out[s.field] ??= []).push(s);
  out.other = [];
  return out;
})();

export const SUBCATEGORY_BY_ID: ReadonlyMap<string, Subcategory> = new Map(
  SUBCATEGORIES.map((s) => [s.id, s]),
);
