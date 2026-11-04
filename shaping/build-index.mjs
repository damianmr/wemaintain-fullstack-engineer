// Builds index.html from index.md. Run `pnpm --filter shaping build` after editing index.md.
// Styles and behaviour are in assets/index.css and assets/index.js.
// The page copies the text of index.md as written. It reads these Markdown forms:
// headings, paragraphs, "- " and "1. " lists ("  - " for a sub-list), `code`, URLs, "> [why] note" boxes,
// "> [key] title", "> [questions] title" and "> [decisions] title" boxes, [text](#q4) links, and ```mermaid blocks, which are rendered to assets/<heading>.svg.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Inline Markdown: `code`, [text](link) and bare URLs. A link to "#q4" or "#d1" points at an open question or a decision.
const inline = (text) => {
  const links = [];
  const html = escape(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      links.push(href.startsWith('#') ? `<a class="ref" href="${href}">${label}</a>` : `<a href="${href}" target="_blank" rel="noopener">${label}</a>`);
      return `\u0000${links.length - 1}\u0000`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s<\u0000]+)/g, '<a class="url" href="$1" target="_blank" rel="noopener">$1</a>');
  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => links[index]);
};
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parse(markdown) {
  const root = [];
  const diagrams = [];
  let container = root;
  let paragraph = null;
  let list = null;
  let key = null;
  let fence = null;
  let heading = 'diagram';
  const close = () => { paragraph = null; list = null; };
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let match;
    if (fence) {
      if (line === '```') {
        const used = diagrams.filter((diagram) => diagram.title === heading).length;
        const diagram = { type: 'diagram', title: heading, name: slug(heading) + (used ? `-${used + 1}` : ''), source: fence.join('\n') };
        diagrams.push(diagram);
        root.push(diagram);
        fence = null;
      } else fence.push(raw);
      continue;
    }
    if (key) {
      if ((match = line.match(/^>\s?(.*)$/))) { key.lines.push(match[1]); continue; }
      key = null;
    }
    if (!line.trim()) { close(); continue; }
    if (line === '```mermaid') {
      close(); container = root; fence = [];
    } else if ((match = line.match(/^(#{1,4}) (.*)$/))) {
      close(); container = root; heading = match[2];
      root.push({ type: 'heading', level: match[1].length, text: match[2] });
    } else if ((match = line.match(/^> \[why\]\s*(.*)$/))) {
      // The "> " lines that follow belong to the same note, read like the rest of index.md.
      close();
      key = { type: 'why', lines: [match[1]] };
      container.push(key);
    } else if ((match = line.match(/^> \[(key|questions|decisions)\]\s*(.*)$/))) {
      close(); container = root;
      key = { type: match[1], title: match[2], lines: [] };
      root.push(key);
    } else if ((match = line.match(/^(\d+)\. (.*)$/))) {
      close();
      const last = root[root.length - 1];
      const item = { title: match[2], children: [] };
      if (last?.type === 'ol') last.items.push(item);
      else root.push({ type: 'ol', start: Number(match[1]), items: [item] });
      container = item.children;
    } else if ((match = line.match(/^\s{2,}- (.*)$/)) && list) {
      // An indented "  - " line is a sub-item of the bullet above it.
      list.items[list.items.length - 1].sub.push(match[1]);
    } else if ((match = line.match(/^- (.*)$/))) {
      paragraph = null;
      if (!list) { list = { type: 'ul', items: [] }; container.push(list); }
      list.items.push({ text: match[1], sub: [] });
    } else {
      list = null;
      if (!paragraph) { paragraph = { type: 'p', lines: [] }; container.push(paragraph); }
      paragraph.lines.push(line);
    }
  }
  if (fence) throw new Error('index.md has a ```mermaid block that is not closed.');
  return { blocks: root, diagrams };
}

// Renders every Mermaid block with the same tool and settings as the visual guide.
function renderDiagrams(diagrams) {
  if (!diagrams.length) return;
  const work = mkdtempSync(join(tmpdir(), 'shaping-'));
  try {
    writeFileSync(join(work, 'in.md'), diagrams.map((diagram) => '```mermaid\n' + diagram.source + '\n```\n').join('\n'));
    const args = ['-i', join(work, 'in.md'), '-o', join(work, 'out.md'), '-c', join(here, 'mermaid-config.json'), '--size', '1440'];
    if (process.env.SHAPING_BROWSER_CONFIG) args.push('-p', process.env.SHAPING_BROWSER_CONFIG);
    const result = spawnSync(join(here, 'node_modules/.bin/mmdc'), args, { stdio: 'inherit' });
    if (result.error) throw new Error(`Cannot run the diagram renderer. Run pnpm install first. ${result.error.message}`);
    if (result.status !== 0) throw new Error(`The diagram renderer exited with code ${result.status}.`);
    mkdirSync(join(here, 'assets'), { recursive: true });
    diagrams.forEach((diagram, index) => {
      const svg = readFileSync(join(work, `out-${index + 1}.svg`), 'utf8')
        // Each diagram is placed in the page, so its ids and styles get their own prefix.
        .replace(/my-svg/g, `diagram-${diagram.name}`)
        // Note boxes in data models are entities named NOTE_…; their lines are plain dotted lines, without the symbols for zero, one and many.
        .replace(/<path\b[^>]*_entity-NOTE_[^>]*>/g, (tag) => tag.replace(/\s?marker-(?:start|end)="[^"]*"/g, ''))
        // A note box (a NOTE_… entity or flowchart node) that cites "Q4" or "D1" links to that item in the questions or decisions box.
        .replace(/<g class="node[^"]*" id="[^"]*-(?:entity|flowchart)-NOTE_[^"]*"[^>]*>.*?<\/foreignObject><\/g><\/g>/g, (note) => {
          const ref = note.match(/<p>[^<]*?\b([QD])(\d+)\b/);
          return ref ? `<a href="#${ref[1].toLowerCase()}${ref[2]}" class="question-link"><title>Go to ${ref[1]}${ref[2]}</title>${note}</a>` : note;
        })
        // A field whose comment says "added by C1" gets the green C1 row, like the C1 tables.
        .split('<g class="node ').map((part, index) => index ? markAddedFields(part) : part).join('<g class="node ');
      diagram.file = `assets/${diagram.name}.svg`;
      diagram.width = Math.round(Number(svg.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/)?.[1]) || 1400);
      diagram.svg = svg;
      writeFileSync(join(here, diagram.file), svg);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// Mermaid draws an entity's field rows in the same order as its fields, so the nth row is the nth field.
function markAddedFields(node) {
  const comments = [...node.matchAll(/class="label attribute-comment"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/g)].map((match) => match[1].replace(/<[^>]+>/g, ''));
  const added = comments.flatMap((comment, index) => (/added by C1/i.test(comment) ? [index] : []));
  if (!added.length) return node;
  let row = -1;
  return node.replace(/<g style="" class="row-rect-(?:odd|even)">([\s\S]*?)<\/g>/g, (group, inner) => {
    row += 1;
    if (!added.includes(row)) return group;
    let path = 0;
    const green = inner.replace(/<path\b[^>]*>/g, (tag) => {
      path += 1;
      const fill = path === 1 ? '#e3f5d0' : 'none';
      return tag.replace(/fill="[^"]*"/, `fill="${fill}"`).replace(/stroke="(?!none)[^"]*"/, 'stroke="#5a8f29"').replace(/style="[^"]*"/, `style="fill:${fill} !important;stroke:#5a8f29 !important"`);
    });
    return `<g style="" class="row-rect-added">${green}</g>`;
  });
}

const symbol = (kind) => {
  const stem = '<path d="M8 16H46"/>';
  const many = '<path d="M60 16L77 5M60 16H77M60 16L77 27"/>';
  const circle = '<circle cx="51" cy="16" r="6"/>';
  const bar = '<path d="M51 5V27"/>';
  const endBar = '<path d="M72 5V27"/>';
  const paths = kind === 'one' ? stem + '<path d="M46 16H78M62 5V27M72 5V27"/>' : kind === 'optional' ? stem + '<path d="M57 16H78"/>' + circle + endBar : kind === 'many' ? stem + '<path d="M57 16H60"/>' + circle + many : '<path d="M8 16H60"/>' + bar + many;
  return `<svg viewBox="0 0 86 32" aria-hidden="true" focusable="false">${paths}</svg>`;
};
// Colour words in a [key] box, matched to the diagram colours.
const swatches = { 'blue': 'key-step', 'purple': 'key-person', 'grey': 'key-unused', 'gray': 'key-unused', 'green': 'key-added', 'orange': 'key-decision', 'orange dashed': 'key-proposal', 'magenta': 'key-question', 'red': 'key-limit', 'yellow': 'key-choice', 'teal': 'key-data' };
// Mermaid's own cardinality marks, in either direction.
const symbols = { '||': 'one', 'o|': 'optional', '|o': 'optional', 'o{': 'many', '}o': 'many', '|{': 'requiredMany', '}|': 'requiredMany' };

function renderKey(block) {
  const parts = [];
  let paragraph = null;
  const push = (type, html) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) last.items.push(html);
    else parts.push({ type, items: [html] });
  };
  for (const line of block.lines) {
    let match;
    if (!line.trim()) { paragraph = null; continue; }
    // "[tip] text" is a highlighted line, such as the hint that note boxes can be clicked.
    if ((match = line.match(/^\[tip\] (.*)$/))) {
      paragraph = null;
      parts.push({ type: 'tip', items: [inline(match[1])] });
    } else if ((match = line.match(/^- \[([a-z ]+)\] (.*)$/)) && swatches[match[1]]) {
      paragraph = null;
      push('swatch', `<span class="${swatches[match[1]]}">${inline(match[2])}</span>`);
    } else if ((match = line.match(/^- `([^`]+)` ([^:]+)(?:: (.*))?$/)) && symbols[match[1]]) {
      paragraph = null;
      push('symbol', `<div>${symbol(symbols[match[1]])}<span><b>${inline(match[2])}</b>${match[3] ? `<small>${inline(match[3])}</small>` : ''}</span></div>`);
    } else if ((match = line.match(/^- (.*)$/))) {
      paragraph = null;
      push('swatch', `<span class="key-plain">${inline(match[1])}</span>`);
    } else if (paragraph) {
      paragraph.items.push(inline(line));
    } else {
      paragraph = { type: 'p', items: [inline(line)] };
      parts.push(paragraph);
    }
  }
  const body = parts.map((part) => part.type === 'swatch' ? `<div class="colour-key">${part.items.join('')}</div>`
    : part.type === 'symbol' ? `<div class="symbol-grid">${part.items.join('')}</div>`
    : part.type === 'tip' ? `<p class="key-tip"><span aria-hidden="true">👆</span>${part.items.join('')}</p>`
    : `<p class="key-lines">${part.items.join('<br>')}</p>`).join('');
  return `<aside class="diagram-key" aria-label="${escape(block.title || 'Key')}">${block.title ? `<strong class="key-title">${inline(block.title)}</strong>` : ''}${body}</aside>`;
}

function render(blocks, toc, state = { seenTitle: false }) {
  return blocks.map((block) => {
    switch (block.type) {
      case 'heading': {
        // The first "#" is the page title. Later headings move down one level, so the page keeps one h1.
        if (block.level === 1 && !state.seenTitle) { state.seenTitle = true; return `<h1>${inline(block.text)}</h1>`; }
        const level = Math.min(block.level + 1, 6);
        const id = slug(block.text);
        toc.push({ id, text: block.text, level });
        return `<h${level} id="${id}">${inline(block.text)}</h${level}>`;
      }
      case 'p': return `<p>${block.lines.map(inline).join('<br>')}</p>`;
      case 'ul': return `<ul>${block.items.map((item) => `<li>${inline(item.text)}${item.sub.length ? `<ul>${item.sub.map((sub) => `<li>${inline(sub)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`;
      case 'ol': return `<ol class="paths" start="${block.start}">${block.items.map((item, index) => `<li data-n="${block.start + index}"><p class="path-title">${inline(item.title)}</p>${render(item.children, toc, state)}</li>`).join('')}</ol>`;
      case 'why': return `<details class="why"><summary><span class="why-label">Why</span><span class="why-hint">Show the note</span></summary><div class="why-body">${render(parse(block.lines.join('\n')).blocks, [], state)}</div></details>`;
      case 'key': return renderKey(block);
      // Open questions and decisions: the lines inside the box are read like the rest of index.md. Empty bullets are skipped.
      case 'questions':
      case 'decisions': {
        const inner = parse(block.lines.filter((line) => !/^-\s*$/.test(line)).join('\n')).blocks;
        // An item that starts with "Q4" or "D1" gets the anchor #q4 or #d1, which diagram notes and [text](#q4) links point at.
        const items = render(inner, [], state).replace(/<li>([QD])(\d+)\b/g, (_, kind, number) => `<li id="${kind.toLowerCase()}${number}">${kind}${number}`);
        return `<aside class="${block.type}" aria-label="${escape(block.title || block.type)}">${block.title ? `<strong class="questions-title">${inline(block.title)}</strong>` : ''}${items}</aside>`;
      }
      // The SVG is placed in the page, so links in its note boxes work. Click the diagram or the button to enlarge it.
      case 'diagram': return `<figure id="figure-${block.name}"><div class="diagram-view" data-diagram="${block.file}" data-title="${escape(block.title)}" data-width="${block.width}">${block.svg}</div><figcaption><span>${inline(block.title)}. Click to enlarge. Question and decision boxes link to their text.</span><span class="figure-actions"><button type="button" class="enlarge" aria-label="Enlarge diagram: ${escape(block.title)}">Enlarge</button><a href="${block.file}" target="_blank" rel="noopener">Open full-size diagram</a></span></figcaption></figure>`;
      default: return '';
    }
  }).join('\n');
}

const { blocks, diagrams } = parse(readFileSync(join(here, 'index.md'), 'utf8'));
renderDiagrams(diagrams);
const toc = [];
const body = render(blocks, toc);
const title = blocks.find((block) => block.type === 'heading')?.text ?? 'C1';
const tocHtml = toc.filter((entry) => entry.level <= 4).map((entry) => `<a class="toc-link toc-${entry.level}" href="#${entry.id}">${inline(entry.text)}</a>`).join('');
const whyCount = (body.match(/<details class="why">/g) ?? []).length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<!-- Built from index.md by build-index.mjs. Edit index.md, then run: pnpm --filter shaping build -->
<link rel="stylesheet" href="assets/index.css">
<script defer src="assets/index.js"></script>
</head>
<body>
<a class="skip" href="#main">Skip to the text</a>
<div class="shell">
<aside class="sidebar">
<a class="brand" href="#top"><span class="brand-mark" aria-hidden="true"></span>${inline(title)}</a>
<nav aria-label="On this page"><p class="nav-label">On this page</p>${tocHtml}</nav>
</aside>
<div class="workspace">
<header class="toolbar"><span class="breadcrumb">fullstack-engineer / shaping / index.md</span><div class="toolbar-actions">${whyCount ? '<button id="toggle-why" type="button" aria-pressed="false">Open all notes</button>' : ''}<a class="button" href="index.md" target="_blank" rel="noopener">Source</a><a class="button" href="../README.md" target="_blank" rel="noopener">Challenge brief</a></div></header>
<main id="main"><article id="top" class="doc">
${body}
</article></main>
</div>
</div>
<dialog id="diagram-dialog" aria-labelledby="diagram-title">
<div class="dialog-toolbar"><strong id="diagram-title">Diagram</strong><div class="zoom-actions"><button id="zoom-out" type="button" aria-label="Zoom out">−</button><span id="zoom-status" class="zoom-status">100%</span><button id="zoom-in" type="button" aria-label="Zoom in">+</button><button id="zoom-fit" type="button">Fit</button><a class="button" id="open-svg" href="#" target="_blank" rel="noopener">Open SVG</a><button id="close-diagram" type="button">Close</button></div></div>
<div class="zoom-stage" id="zoom-stage"></div>
</dialog>
</body>
</html>
`;

// Every #link must have a target on the page.
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
const broken = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]).filter((id) => id && !ids.has(id)))];
if (broken.length) console.warn(`Links with no target on the page: ${broken.map((id) => `#${id}`).join(', ')}`);
writeFileSync(join(here, 'index.html'), html);
console.log(`index.html built: ${toc.length} headings, ${whyCount} why notes, ${diagrams.length} diagrams.`);
