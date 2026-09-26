// Shared room taxonomy used by the header mega menu, collection pages and
// product recommendations. Kept outside the lazy catalog chunk on purpose.

export const roomCollections = {
  "living-room": {
    title: "Living room",
    eyebrow: "THE LIVING EDIT",
    copy: "Pieces for the room that holds the most life.",
    image:
      "https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1800&q=88",
    groups: {
      Sofas: [
        "2-Seater Fabric Sofa",
        "3-Seater Fabric Sofa",
        "Sectional Sofa",
        "Recliner Sofa",
        "Sofa Bed",
      ],
      "Coffee Tables": [
        "Wooden Coffee Table",
        "Glass Coffee Table",
        "Round Coffee Table",
        "Storage Coffee Table",
        "Marble Coffee Table",
      ],
      "TV Stands": [
        "Wooden TV Stand",
        "Floating TV Stand",
        "Corner TV Stand",
        "TV Cart",
        "Modern TV Stand",
      ],
    },
    match: "Living room",
  },
  bedroom: {
    title: "Bedroom",
    eyebrow: "REST, MADE CONSIDERED",
    copy: "A slower start and a softer finish to every day.",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=88",
    groups: {
      Beds: [
        "Single Size Bed",
        "Double Size Bed",
        "Queen Size Bed",
        "King Size Bed",
        "Bunk Bed",
      ],
      Wardrobes: [
        "2-Door Wardrobe",
        "3-Door Wardrobe",
        "Sliding Door Wardrobe",
        "Walk-in Wardrobe",
        "Corner Wardrobe",
      ],
      Nightstands: [
        "Wooden Nightstand",
        "Modern Nightstand",
        "Floating Nightstand",
        "Nightstand with Drawer",
        "Metal Nightstand",
      ],
    },
    match: "Bedroom",
  },
  "dining-room": {
    title: "Dining room",
    eyebrow: "GATHER BEAUTIFULLY",
    copy: "A collection for shared plates, long stories, and everyday ceremony.",
    image:
      "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1800&q=88",
    groups: {
      "Dining Tables": [
        "Extendable Dining Table",
        "Marble Top Dining Table",
        "Glass Dining Table",
        "Wooden Ornate Dining Table",
        "Metal Industrial Dining Table",
      ],
      "Dining Chairs": [
        "Wooden Ornate Dining Chairs",
        "Modern Plastic Dining Chairs",
        "Metal Industrial Dining Chairs",
        "Molded Resin Dining Chairs",
        "Luxury Velvet Dining Chairs",
      ],
      "Dining Storage": [
        "Dining Hutch Cabinet",
        "Buffet Cabinet",
        "Pantry Cabinets",
        "Wine Storage Cabinet",
        "Serving Trolleys",
      ],
    },
    match: "Dining room",
  },
  shop: {
    title: "Shop all",
    eyebrow: "THE FULL COLLECTION",
    copy: "Every CozyCraft piece in one place, ready to filter by room, material and budget.",
    image:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=88",
    groups: {
      "Living room": [],
      Bedroom: [],
      "Dining room": [],
    },
    match: "all",
  },
  "new-arrivals": {
    title: "New arrivals",
    eyebrow: "JUST IN THE ROOM",
    copy: "Fresh forms and thoughtful finishes for a home still becoming itself.",
    image:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88",
    groups: {
      All: [],
      "Living room": [],
      Bedroom: [],
      "Dining room": [],
    },
    match: "new",
  },
} as const;

export const subcategoryProductMap: Record<string, string[]> = {
  "2-Seater Fabric Sofa": ["mara"],
  "3-Seater Fabric Sofa": ["mara"],
  "Sectional Sofa": ["hugo"],
  "Recliner Sofa": ["mara"],
  "Sofa Bed": ["hugo"],
  "Wooden Coffee Table": ["nilo"],
  "Round Coffee Table": ["nilo"],
  "Storage Coffee Table": ["nilo"],
  "Marble Coffee Table": ["nilo"],
  "Wooden TV Stand": ["lino"],
  "Floating TV Stand": ["lino"],
  "Corner TV Stand": ["lino"],
  "TV Cart": ["lino"],
  "Modern TV Stand": ["lino"],
  "Single Size Bed": ["santo"],
  "Double Size Bed": ["santo"],
  "Queen Size Bed": ["santo"],
  "King Size Bed": ["santo"],
  "Bunk Bed": ["santo"],
  "2-Door Wardrobe": ["sola"],
  "3-Door Wardrobe": ["sola"],
  "Sliding Door Wardrobe": ["sola"],
  "Walk-in Wardrobe": ["sola"],
  "Corner Wardrobe": ["sola"],
  "Wooden Nightstand": ["milo"],
  "Modern Nightstand": ["milo"],
  "Floating Nightstand": ["milo"],
  "Nightstand with Drawer": ["milo"],
  "Metal Nightstand": ["milo"],
  "Extendable Dining Table": ["arco"],
  "Marble Top Dining Table": ["arco"],
  "Glass Dining Table": ["arco"],
  "Wooden Ornate Dining Table": ["arco"],
  "Metal Industrial Dining Table": ["arco"],
  "Wooden Ornate Dining Chairs": ["noma"],
  "Modern Plastic Dining Chairs": ["noma"],
  "Metal Industrial Dining Chairs": ["noma"],
  "Molded Resin Dining Chairs": ["noma"],
  "Luxury Velvet Dining Chairs": ["noma"],
  "Dining Hutch Cabinet": ["vera"],
  "Buffet Cabinet": ["vera"],
  "Pantry Cabinets": ["vera"],
  "Wine Storage Cabinet": ["vera"],
  "Serving Trolleys": ["vera"],
};

export type RoomCollectionKey = keyof typeof roomCollections;

/** Rooms shown in navigation, in display order. */
export const navigationRooms = [
  { key: "living-room", path: "/living-room", label: "Living room" },
  { key: "bedroom", path: "/bedroom", label: "Bedroom" },
  { key: "dining-room", path: "/dining-room", label: "Dining room" },
] as const;
