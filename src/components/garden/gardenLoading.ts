import { memories } from './gardenAssets';

let media: Promise<void> | undefined;
let deadline: ReturnType<typeof setTimeout> | undefined;
let stopDeadline = () => {};

export function prepareGardenMedia() {
  // Use the same URLs as the mounted photo cards, retaining decoded images
  // until preparation completes. These requests start independently of WebGL.
  return media ??= Promise.all([
    ...memories.map(({ src }) => {
      const image = new Image();
      image.src = src;
      return image.decode();
    }),
    document.fonts.load('300 32px "Cormorant Garamond Variable"'),
    document.fonts.load('italic 300 32px "Cormorant Garamond Variable"'),
    document.fonts.load('400 12px "Montserrat Variable"'),
  ]).then(() => { performance.mark('garden-media-ready'); });
}

export function gardenStage(message: string) {
  if (document.documentElement.dataset.gardenState !== 'loading') return;
  const status = document.getElementById('garden-loading-status');
  if (status) status.textContent = message;
}

export function failGardenLoading() {
  stopDeadline();
  const wasReady = document.documentElement.dataset.gardenState === 'ready';
  document.documentElement.dataset.gardenState = 'error';
  document.getElementById('garden-experience')?.setAttribute('inert', '');
  const loader = document.getElementById('garden-loader');
  loader?.removeAttribute('inert'); loader?.removeAttribute('aria-hidden');
  if (wasReady) loader?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  const status = document.getElementById('garden-loading-status');
  if (status) status.textContent = 'The garden couldn’t open. Your invitation is ready below.';
  document.getElementById('garden-loader')?.removeAttribute('aria-busy');
  window.dispatchEvent(new Event('garden-load-error'));
}

export function revealGarden() {
  if (document.documentElement.dataset.gardenState !== 'loading') return;
  stopDeadline();
  performance.mark('garden-ready');
  performance.measure('garden-preparation', 'garden-start', 'garden-ready');
  document.documentElement.dataset.gardenState = 'ready';
  const experience = document.getElementById('garden-experience');
  experience?.removeAttribute('inert');
  const loader = document.getElementById('garden-loader');
  // Move focus only if the visitor was using the loader's controls.
  if (loader?.contains(document.activeElement)) experience?.focus({ preventScroll: true });
  loader?.setAttribute('inert', '');
  loader?.setAttribute('aria-hidden', 'true');
  loader?.removeAttribute('aria-busy');
}

export function initializeGardenLoading() {
  if (document.documentElement.dataset.gardenState !== 'loading') return;
  performance.mark('garden-start');
  let remaining = 25_000;
  let visibleSince: number | null = null;
  const updateDeadline = () => {
    clearTimeout(deadline);
    const now = performance.now();
    if (visibleSince !== null) remaining -= now - visibleSince;
    visibleSince = document.hidden ? null : now;
    // Background tabs suspend animation frames; that isn't a loading failure.
    if (!document.hidden) deadline = setTimeout(failGardenLoading, Math.max(0, remaining));
  };
  document.addEventListener('visibilitychange', updateDeadline);
  stopDeadline = () => {
    clearTimeout(deadline);
    document.removeEventListener('visibilitychange', updateDeadline);
  };
  updateDeadline();
  void prepareGardenMedia().catch(failGardenLoading);
}
