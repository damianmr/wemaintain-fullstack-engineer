// Behaviour for index.html: the "Open all notes" button, the table of contents highlight, and the diagram zoom.
(() => {
  const notes = [...document.querySelectorAll('details.why')];
  const toggle = document.getElementById('toggle-why');
  const syncToggle = () => {
    if (!toggle) return;
    const allOpen = notes.every((note) => note.open);
    toggle.textContent = allOpen ? 'Close all notes' : 'Open all notes';
    toggle.setAttribute('aria-pressed', String(allOpen));
  };
  notes.forEach((note) => note.addEventListener('toggle', syncToggle));
  toggle?.addEventListener('click', () => {
    const open = !notes.every((note) => note.open);
    notes.forEach((note) => { note.open = open; });
    syncToggle();
  });
  // Printed copies show every note.
  let openedForPrint = [];
  window.addEventListener('beforeprint', () => { openedForPrint = notes.filter((note) => !note.open); openedForPrint.forEach((note) => { note.open = true; }); });
  window.addEventListener('afterprint', () => { openedForPrint.forEach((note) => { note.open = false; }); });

  const links = [...document.querySelectorAll('.toc-link')];
  const headings = links.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const markActive = () => {
    let current = headings[0];
    for (const heading of headings) if (heading.getBoundingClientRect().top < 120) current = heading;
    // At the end of the page the last headings cannot reach the top, so mark the last one.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = headings[headings.length - 1];
    links.forEach((link) => link.classList.toggle('active', current && link.hash === `#${current.id}`));
  };
  document.addEventListener('scroll', markActive, { passive: true });
  markActive();

  // The zoom dialog borrows the diagram's SVG and gives it back on close, so the page has one copy and its links keep working.
  const dialog = document.getElementById('diagram-dialog');
  const stage = document.getElementById('zoom-stage');
  const status = document.getElementById('zoom-status');
  let view = null;
  let svg = null;
  let fitWidth = 1;
  let scale = 1;
  let maxWidth = 1400;
  const resize = () => { svg.style.width = `${Math.round(fitWidth * scale)}px`; status.textContent = `${Math.round(scale * 100)}%`; };
  const fit = () => {
    const box = svg.viewBox.baseVal;
    const aspect = box && box.height ? box.width / box.height : 1.6;
    fitWidth = Math.min(maxWidth, Math.max(1, stage.clientWidth - 48), Math.max(1, stage.clientHeight - 48) * aspect);
    scale = 1;
    resize();
    stage.scrollTo(0, 0);
  };
  const open = (target) => {
    view = target;
    svg = view.querySelector('svg');
    if (!svg) return;
    maxWidth = Number(view.dataset.width) || 1400;
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    stage.append(svg);
    document.getElementById('diagram-title').textContent = view.dataset.title;
    document.getElementById('open-svg').href = view.dataset.diagram;
    dialog.showModal();
    fit();
  };
  dialog.addEventListener('close', () => {
    if (!svg || !view) return;
    svg.style.width = '';
    svg.style.maxWidth = '1440px';
    svg.style.maxHeight = '1440px';
    view.append(svg);
    svg = null;
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a.question-link');
    if (link) {
      // A question link inside the dialog closes it first, so the diagram is back in the page before the jump.
      if (dialog.open) {
        event.preventDefault();
        dialog.close();
        const href = link.getAttribute('href');
        if (location.hash === href) document.querySelector(href)?.scrollIntoView();
        else location.hash = href;
      }
      return;
    }
    const enlarge = event.target.closest('.enlarge');
    const target = enlarge ? enlarge.closest('figure').querySelector('.diagram-view') : event.target.closest('.diagram-view');
    if (target && !dialog.open) open(target);
  });
  document.getElementById('zoom-in').addEventListener('click', () => { scale = Math.min(5, scale * 1.25); resize(); });
  document.getElementById('zoom-out').addEventListener('click', () => { scale = Math.max(0.25, scale / 1.25); resize(); });
  document.getElementById('zoom-fit').addEventListener('click', fit);
  document.getElementById('close-diagram').addEventListener('click', () => dialog.close());
})();
