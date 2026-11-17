type WorkspaceTabSetter<T extends string> = (tab: T) => void;

function resetWorkspaceScroll(source: HTMLElement | null) {
  const workspace = source?.closest<HTMLElement>(".governed-workspace");
  if (!workspace) return;

  const scrollTargets = new Set<HTMLElement>();
  scrollTargets.add(workspace);
  workspace
    .querySelectorAll<HTMLElement>(
      ".assignment-phase4, .section-document-stage, .workspace-section-outline",
    )
    .forEach((element) => scrollTargets.add(element));

  let parent = workspace.parentElement;
  while (parent && parent !== document.body) {
    if (parent.scrollHeight > parent.clientHeight + 2) scrollTargets.add(parent);
    parent = parent.parentElement;
  }

  scrollTargets.forEach((element) => {
    element.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });

  const header = workspace.querySelector<HTMLElement>(".workspace-command-header");
  header?.scrollIntoView({ behavior: "auto", block: "start" });
}

export function navigateWorkspaceTab<T extends string>(
  tab: T,
  setTab: WorkspaceTabSetter<T>,
  source: HTMLElement | null,
) {
  // Commit the screen first. Scrolling the outgoing screen before React has
  // applied the new data-tab value allowed legacy sticky/overflow layers to
  // retain focus and intercept the click on some browsers.
  setTab(tab);

  // Wait for React to commit the selected screen before resetting its scroll
  // owners. Two frames also covers panels mounted by the tab change.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => resetWorkspaceScroll(source));
  });
}
