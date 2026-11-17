// App2 display encoding guard.
// Repairs known UTF-8/Windows-1252 mojibake in UI metadata without touching
// editable fields, code blocks, or document content editors.

import { repairDisplayText } from './utils/repairDisplayText';
const suspicious = /[\u00c2\u00c3\u00c4\u00c5\u00e2\u00f0]/;

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

function mayNeedRepair(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return suspicious.test(node.nodeValue || "");
  if (!(node instanceof HTMLElement)) return false;
  if (suspicious.test(node.textContent || "")) return true;
  return ["title", "aria-label", "placeholder"].some((attribute) =>
    suspicious.test(node.getAttribute(attribute) || ""),
  );
}

function installEncodingGuard(): void {
  const root = document.getElementById('root');
  if (!root) return;
  repairTree(root);

  const pending = new Set<Node>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const roots = [...pending];
    pending.clear();
    roots.forEach(repairTree);
  };
  const schedule = (node: Node) => {
    if (!mayNeedRepair(node)) return;
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(flush);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") schedule(mutation.target);
      for (const node of mutation.addedNodes) schedule(node);
    }
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installEncodingGuard, { once: true });
} else {
  installEncodingGuard();
}
