// App2 display encoding guard.
// Repairs known UTF-8/Windows-1252 mojibake in UI metadata without touching
// editable fields, code blocks, or document content editors.

const DISPLAY_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["\u00c3\u201a\u00c2\u00b7", "\u00b7"],
  ["\u00c2\u00b7", "\u00b7"],
  ["\u00c3\u2014", "\u00d7"],
  ["\u00e2\u20ac\u201c", "\u2013"],
  ["\u00e2\u20ac\u201d", "\u2014"],
  ["\u00e2\u20ac\u0153", "\u201c"],
  ["\u00e2\u20ac\u009d", "\u201d"],
  ["\u00e2\u20ac\u2122", "\u2019"],
  ["\u00e2\u20ac\u02dc", "\u2018"],
  ["\u00e2\u20ac\u00a2", "\u2022"],
  ["\u00e2\u20ac\u00a6", "\u2026"],
  ["\u00e2\u2020\u0090", "\u2190"],
  ["\u00e2\u2020\u2018", "\u2191"],
  ["\u00e2\u2020\u2019", "\u2192"],
  ["\u00e2\u2020\u0153", "\u2193"],
  ["\u00e2\u0153\u201c", "\u2713"],
  ["\u00e2\u0153\u2022", "\u2715"],
  ["\u00c2\u00a0", " "],
];

const suspicious = /[\u00c2\u00c3\u00e2]/;

function repairDisplayText(value: string): string {
  if (!suspicious.test(value)) return value;
  let out = value;
  for (let round = 0; round < 3; round += 1) {
    const before = out;
    for (const [bad, good] of DISPLAY_REPLACEMENTS) {
      if (out.includes(bad)) out = out.split(bad).join(good);
    }
    if (out === before) break;
  }
  return out;
}

function shouldSkip(node: Node): boolean {
  const parent = node.parentElement;
  return Boolean(parent?.closest('input, textarea, pre, code, [contenteditable="true"], [data-preserve-text-encoding="true"]'));
}

function repairNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE && node.nodeValue && !shouldSkip(node)) {
    const repaired = repairDisplayText(node.nodeValue);
    if (repaired !== node.nodeValue) node.nodeValue = repaired;
    return;
  }

  if (node instanceof HTMLElement) {
    for (const attr of ['title', 'aria-label', 'placeholder']) {
      const value = node.getAttribute(attr);
      if (!value) continue;
      const repaired = repairDisplayText(value);
      if (repaired !== value) node.setAttribute(attr, repaired);
    }
  }
}

function repairTree(root: Node): void {
  repairNode(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null;
  while ((current = walker.nextNode())) repairNode(current);
}

function installEncodingGuard(): void {
  const root = document.getElementById('root');
  if (!root) return;
  repairTree(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') repairNode(mutation.target);
      for (const node of mutation.addedNodes) repairTree(node);
    }
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installEncodingGuard, { once: true });
} else {
  installEncodingGuard();
}
