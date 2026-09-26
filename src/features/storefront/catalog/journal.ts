export type JournalEntry = {
  slug: string;
  kicker: string;
  title: string;
  summary: string;
  image: string;
  readMinutes: number;
  /** Rooms whose pieces are suggested at the end of the note. */
  rooms: string[];
  sections: Array<{ heading?: string; paragraphs: string[] }>;
};

// Editorial notes shown on the home page and at /journal/:slug. They are
// static storefront content; edit the copy here without touching the backend.
export const journalEntries: JournalEntry[] = [
  {
    slug: "layering-texture",
    kicker: "GUIDE · LIVING ROOM",
    title: "How to layer texture in a quieter space.",
    summary: "A calm room is rarely a flat one. Here is how to build depth with materials instead of more things.",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=86",
    readMinutes: 3,
    rooms: ["Living room"],
    sections: [
      {
        paragraphs: [
          "Quiet rooms work because the eye still has somewhere to rest. When colour is restrained, texture does the talking: the grain of timber, the weave of a cushion, the soft break of linen over a sofa arm.",
        ],
      },
      {
        heading: "Start with one honest anchor",
        paragraphs: [
          "Choose the largest piece first, usually the sofa, and let its fabric set the tone. A nubby weave or bouclé already carries plenty of texture, so pair it with smoother surfaces nearby.",
          "If the sofa is a flat, tightly woven fabric, bring texture in through a wool throw or a rug with a visible loop.",
        ],
      },
      {
        heading: "Contrast, don't compete",
        paragraphs: [
          "Place rough next to smooth and matte next to soft sheen. An oak coffee table beside a linen sofa feels considered; three heavily textured pieces in a row start to feel busy.",
          "A useful rule: no more than three dominant materials in one sightline.",
        ],
      },
      {
        heading: "Let light finish the job",
        paragraphs: [
          "Texture only shows when light grazes it. Keep a lamp low and to one side of your seating so weaves and wood grain cast small shadows in the evening.",
        ],
      },
    ],
  },
  {
    slug: "evening-light",
    kicker: "JOURNAL · BEDROOM",
    title: "A room shaped around the evening light.",
    summary: "Plan the bedroom for the hours you actually spend in it: the slow ones after sunset.",
    image: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1800&q=86",
    readMinutes: 3,
    rooms: ["Bedroom", "Living room"],
    sections: [
      {
        paragraphs: [
          "Most of us see our bedrooms in the evening, under lamps rather than daylight. Designing for that light changes which finishes, heights and placements feel right.",
        ],
      },
      {
        heading: "Warm the palette, not the brightness",
        paragraphs: [
          "Walnut, smoked oak and warm oat fabrics glow under 2700K bulbs, while cool greys can look flat. If your frame is pale, add warmth through bedding and a darker nightstand.",
        ],
      },
      {
        heading: "Mind the heights",
        paragraphs: [
          "A nightstand that sits level with, or slightly below, the top of the mattress keeps a lamp's light at reading height and out of your eyes.",
          "Leave at least 60 cm of walking space on each side of the bed so the room feels open even when the lights are low.",
        ],
      },
      {
        heading: "Keep surfaces calm",
        paragraphs: [
          "Closed storage — a wardrobe with soft-close doors, a nightstand with a drawer — lets the room settle at night. Fewer objects in view means the light has less to fight with.",
        ],
      },
    ],
  },
];

export const findJournalEntry = (slug: string | undefined) =>
  journalEntries.find((entry) => entry.slug === slug);
