import { renderMarkdown } from './markdown';

const PAGES: Array<{ id: string; title: string }> = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'characters', title: 'Characters: seeds → people' },
  { id: 'locomotion', title: 'Locomotion & gaits' },
  { id: 'craft', title: 'IK, gaze, overlays, events' },
  { id: 'assets', title: 'Retargeting, sockets, gear' },
  { id: 'crowds', title: 'VAT crowds at scale' },
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
  sockets: 'sockets',
  'the-crowd': 'crowd',
  'route-following': 'crowd',
  'the-structural-handshake': 'trio',
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
