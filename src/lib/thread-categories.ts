// Forum-style category tree used for community threads (order-book / post-listing).
// Stored as plain text in listings.category as "Section · Subcategory" or just "Section".

export type ThreadSubcategory = { value: string; label: string; blurb?: string };
export type ThreadSection = {
  key: string;
  label: string;
  tagline?: string;
  subcategories: ThreadSubcategory[];
};

export const THREAD_SECTIONS: ThreadSection[] = [
  {
    key: "cracking",
    label: "Cracking",
    tagline: "Where the law starts from.",
    subcategories: [
      { value: "Cracking · Freebie Bases",      label: "Freebie Bases",       blurb: "Mostly public & free combos by local members." },
      { value: "Cracking · Tools",              label: "Tools",               blurb: "Cracking & brute-forcing tools." },
      { value: "Cracking · Paid Tools (Pro)",   label: "Paid Tools (Pro)",    blurb: "Paid tools sold by Pro / Staff members." },
      { value: "Cracking · Configs",            label: "Configs",             blurb: "OpenBullet, Silverbullet, Storm configs." },
      { value: "Cracking · Paid Configs",       label: "Paid Configs",        blurb: "Paid configs by verified members." },
      { value: "Cracking · Account/Logs",       label: "Account / Logs",      blurb: "Cracked accounts and stealer logs." },
      { value: "Cracking · CraxTube",           label: "CraxTube",            blurb: "Learn cracking — guides & videos." },
    ],
  },
  {
    key: "nsfw",
    label: "NSFW",
    subcategories: [
      { value: "NSFW · Leaks",        label: "Leaks" },
      { value: "NSFW · Deepfake AI",  label: "Deepfake AI" },
      { value: "NSFW · Requests",     label: "Requests" },
    ],
  },
  {
    key: "spamming",
    label: "Spamming",
    tagline: "Where we use the law!",
    subcategories: [
      { value: "Spamming · Scama / Letter",            label: "Scama / Letter",          blurb: "Scampages & letters." },
      { value: "Spamming · Mailing",                   label: "Mailing",                 blurb: "Tools to send spam mail / messages." },
      { value: "Spamming · Tools/Bots/Validators",     label: "Tools / Bots / Validators" },
      { value: "Spamming · SMTP/Shell/CP/WP",          label: "SMTP / Shell / cPanel / WP" },
      { value: "Spamming · SpamTube",                  label: "SpamTube",                blurb: "Methods, videos & eBooks." },
    ],
  },
  {
    key: "carding",
    label: "Carding",
    tagline: "Carding techniques, tips & resources.",
    subcategories: [
      { value: "Carding · Bins/CC",            label: "BINs / CC",          blurb: "Freebie BINs, CCs, CVV, AMEX, IBAN." },
      { value: "Carding · Gen/Checkers",       label: "Gen / Checkers",     blurb: "Credit-card checkers & validators." },
      { value: "Carding · Cardable Sites",     label: "Cardable Sites" },
      { value: "Carding · CardTube",           label: "CardTube",           blurb: "Carding lessons & methods." },
      { value: "Carding · Fake ID/Passport",   label: "Fake ID / Passport" },
    ],
  },
  {
    key: "hacking",
    label: "Hacking",
    tagline: "Where there is no LAW!",
    subcategories: [
      { value: "Hacking · General Hacking",  label: "General Hacking" },
      { value: "Hacking · Hacking Tools",    label: "Hacking Tools" },
      { value: "Hacking · HackTube",         label: "HackTube",          blurb: "Ethical hacking guides & courses." },
    ],
  },
  {
    key: "web",
    label: "Web & Courses",
    tagline: "Web scripts, software & courses.",
    subcategories: [
      { value: "Web & Courses · Web Scripts",  label: "Web Scripts" },
      { value: "Web & Courses · Software",     label: "Software" },
      { value: "Web & Courses · Courses",      label: "Courses" },
    ],
  },
  {
    key: "others",
    label: "Others",
    subcategories: [
      { value: "Others", label: "Others", blurb: "Everything that doesn't fit a category above." },
    ],
  },
];

// Flat list of all valid thread category values
export const ALL_THREAD_CATEGORIES: { value: string; label: string; section: string }[] =
  THREAD_SECTIONS.flatMap((s) =>
    s.subcategories.map((sub) => ({ value: sub.value, label: sub.label, section: s.label })),
  );

// Top-level section labels for tabs / filters
export const THREAD_SECTION_LABELS = ["All", ...THREAD_SECTIONS.map((s) => s.label)] as const;
export type ThreadSectionLabel = (typeof THREAD_SECTION_LABELS)[number];

// Given a stored category value, return its top-level section label (or "Others")
export function sectionOf(category: string | null | undefined): string {
  if (!category) return "Others";
  const found = THREAD_SECTIONS.find((s) =>
    s.subcategories.some((sub) => sub.value === category),
  );
  if (found) return found.label;
  // Legacy values (BIN/Enroll/etc) — bucket as Others
  return "Others";
}
