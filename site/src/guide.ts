import { renderMarkdown } from './markdown';

const PAGES: Array<{ id: string; title: string }> = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'characters', title: 'Characters: seeds → people' },
  { id: 'locomotion', title: 'Locomotion & gaits' },
  { id: 'craft', title: 'IK, gaze, overlays, events' },
  { id: 'assets', title: 'Retargeting, sockets, gear' },
  { id: 'crowds', title: 'VAT crowds at scale' },
  { id: 'dance', title: 'Dancing & the beat' },
  { id: 'yoga', title: 'Yoga: asanas & breath' },
  { id: 'cricket', title: 'Cricket: actions & the two-handed grip' },
  { id: 'reactions', title: 'Reactions: flinch, KO & the get-up' },
  { id: 'skate', title: 'Foot skate: the gate' },
  { id: 'climbing', title: 'Climbing: the contact gate' },
  { id: 'parkour', title: 'Parkour: reach and contact' },
  { id: 'mood', title: 'Mood: the layer, not the pose' },
  { id: 'lifting', title: 'Lifting: the rep that decays' },
  { id: 'dining', title: 'Dining: the utensil is the mechanism' },
  { id: 'archery', title: 'Archery: the anchor decides the group' },
  { id: 'striking', title: 'Striking: the mass is measured' },
  { id: 'guard', title: 'Guard: coverage is geometry' },
  { id: 'grappling', title: 'Grappling: no kuzushi, no throw' },
  { id: 'fightstyle', title: 'FightStyle: a style is where the feet are' },
  { id: 'sparring', title: 'Sparring: the reach advantage emerges' },
  { id: 'tameshiwari', title: 'The tameshiwari handshake: two libraries, one physics' },
  { id: 'blade', title: 'Blade: a weapon is a mass distribution' },
  { id: 'cut', title: 'Cut: sharpness starts it, toughness pays for it' },
  { id: 'handshake', title: 'GAMA & SCENA: the trio' },
];

/** Playground examples relevant to sections, keyed by heading id. */
const SECTION_PLAYGROUNDS: Record<string, string> = {
  'a-character-in-six-lines': 'gallery',
  'body-types': 'wardrobe',
  'the-wardrobe': 'wardrobe',
  faces: 'faces',
  'the-creator-api-describehumanoid': 'creator',
  'the-locomotion-controller': 'locomotion',
  'footstep-events': 'locomotion',
  'foot-ik-terrain-planting': 'craft',
  'lookat-gaze-chains': 'craft',
  'overlays-bone-masks': 'craft',
  'strapped-into-an-aeroplane-cockpit': 'sortie',
  'what-the-sortie-found-out-about-g': 'sortie',
  sockets: 'sockets',
  'the-crowd': 'crowd',
  'route-following': 'crowd',
  'the-structural-handshake': 'trio',
  'the-beat-clock-free-runs': 'club',
  'the-moves-are-skills-not-clips': 'club',
  'a-crowd-not-a-chorus-line': 'club',
  'styles-the-count-is-not-the-beat': 'club',
  'street-the-hit-and-the-freeze': 'club',
  'the-two-classicals-where-the-dance-keeps-its-time': 'club',
  'the-illusions-and-the-house': 'club',
  'routines-choreography-as-data': 'club',
  'vogue-and-krump': 'club',
  'the-couple-one-dance-two-bodies': 'club',
  'the-cypher-the-floor-becomes-a-social-structure': 'club',
  'stepping-on-and-off-the-floor': 'club',
  'a-pose-is-one-frame-held-alive': 'yoga',
  'flows-a-vinyasa-is-a-list-of-breaths': 'yoga',
  'the-class-one-practice-many-bodies': 'yoga',
  'the-breath-turns-and-you-can-hear-them': 'yoga',
  'strikepose-the-single-frame-api': 'yoga',
};

const sidebar = document.getElementById('sidebar') as HTMLElement;
const content = document.getElementById('content') as HTMLElement;
const current = new URLSearchParams(location.search).get('page') ?? PAGES[0].id;

async function load(): Promise<void> {
  const page = PAGES.find((p) => p.id === current) ?? PAGES[0];
  const response = await fetch(`./docs/${page.id}.md`);
  if (!response.ok) {
    content.innerHTML = `<p>Could not load <code>${page.id}</code>.</p>`;
    return;
  }
  const { html, headings } = renderMarkdown(await response.text());
  content.innerHTML = html;

  for (const heading of content.querySelectorAll('h2[id], h3[id]')) {
    const example = SECTION_PLAYGROUNDS[heading.id];
    if (!example) continue;
    const link = document.createElement('a');
    link.className = 'try';
    link.href = `playground.html?example=${example}`;
    link.textContent = '▸ open a live example in the playground';
    heading.after(link);
  }

  const pagesHtml = PAGES.map(
    (p) =>
      `<a class="${p.id === page.id ? 'active' : ''}" href="guide.html?page=${p.id}">${p.title}</a>`
  ).join('');
  const tocHtml = headings
    .filter((h) => h.level === 2)
    .map((h) => `<a class="toc" href="#${h.id}">${h.text}</a>`)
    .join('');
  sidebar.innerHTML =
    `<h4>Guides</h4>${pagesHtml}` + (tocHtml ? `<h4>On this page</h4>${tocHtml}` : '');

  document.title = `${page.title} · ANIMA`;
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

load();
