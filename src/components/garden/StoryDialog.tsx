// "Our story": the whole story to read, on a sheet of paper over the scene
// (storyText.ts holds the words; docs/VOYAGE.md, "Our story"). A native modal
// <dialog>, so focus moves in and stays there, Esc closes it, the rest of the
// page is inert and screen readers hear it as a dialog named by its heading.
// It is portalled to <body>, outside the Garden's scrolling <main>, so nothing
// scrolled inside it can carry on into the story behind, and none of the
// copy's sky colours or halo reach it. Focus goes back to the link that
// opened it. "See it" closes it and takes the scene to that milestone's stop.
import { useEffect, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { STORY } from './storyText';
import './gardenStory.css';

const BASE = import.meta.env.BASE_URL;

// The page's "Our story" links, which reopen it, and where focus returns if
// the one that opened it has since gone (a loading screen's link, once the
// scene is up).
export const STORY_LINK = 'garden-story-open';

export default function StoryDialog({ opener, onClose, onSee }: {
  // The link that opened it, or null while it is closed.
  opener: HTMLElement | null;
  onClose: () => void;
  // Takes the scene to a stop; absent while there is no scene to see.
  onSee?: (stop: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const seeing = useRef<number | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !opener || element.open) return;
    element.scrollTop = 0;
    // Browsers without <dialog> (Safari before 15.4) would throw and take the page with it; there it simply opens in place.
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
  }, [opener]);
  const closed = () => {
    onClose();
    // Back to the link that opened it, or, if it has gone (hidden or inert), the header's.
    opener?.focus({ preventScroll: true });
    if (document.activeElement !== opener) document.querySelector<HTMLElement>(`.garden-header .${STORY_LINK}`)?.focus({ preventScroll: true });
    if (seeing.current !== null) onSee?.(seeing.current);
    seeing.current = null;
  };
  // A click on the dim around the sheet closes it too (but not one on its scrollbar).
  const clickedOutside = (event: MouseEvent<HTMLDialogElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (event.target === event.currentTarget && outside) event.currentTarget.close();
  };
  const see = (stop: number) => {
    seeing.current = stop;
    dialog.current?.close();
  };
  return createPortal(<dialog ref={dialog} className="garden-story" aria-labelledby="garden-story-title" onClose={closed} onClick={clickedOutside}>
    <div className="garden-story-sheet">
      <div className="garden-story-bar">
        <button className="garden-story-close" onClick={() => dialog.current?.close()}>Close <span aria-hidden="true">×</span></button>
      </div>
      <p className="garden-story-eyebrow">The journey so far</p>
      <h2 id="garden-story-title">Our <em>story.</em></h2>
      <ol className="garden-story-list">
        {STORY.map(entry => <li key={entry.id}>
          <h3><time dateTime={entry.datetime}>{entry.date}</time></h3>
          <p>{entry.words}</p>
          {onSee && <button className="garden-story-see" onClick={() => see(entry.stop)}>
            See it<span className="garden-visually-hidden"> in the garden, {entry.date}</span> <span aria-hidden="true">→</span>
          </button>}
        </li>)}
      </ol>
      <a className="garden-story-details" href={`${BASE}details/`}>The details &amp; RSVP <span aria-hidden="true">→</span></a>
    </div>
  </dialog>, document.body);
}
