// Tapping the scene: open water floats a boat (GardenWater.tsx), anywhere
// else releases a butterfly from where the guest tapped (Garden.tsx). The
// river's handler runs first, on the canvas, and marks its taps here so the
// page's own click listener leaves them alone.
export const riverTaps = new WeakSet<Event>();

type Point = { clientX: number; clientY: number };

// Drags and native touch scrolling are not taps. A thumb wanders further than
// a mouse during a tap, so touch gets more slack.
export const tapSlack = (pointerType: string) => pointerType === 'mouse' ? 6 : 16;
export const isTap = (down: Point, up: Point, pointerType: string) =>
  Math.hypot(up.clientX - down.clientX, up.clientY - down.clientY) <= tapSlack(pointerType);
