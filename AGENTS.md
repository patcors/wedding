# Agent instructions

Patrick and Amelia's wedding site: Astro, with a React Three Fiber Garden. The
README covers the stack, local development, content and the RSVP backend.
Several agents often work in this repo at once, on one machine, for both
Patrick and Amelia. These rules keep them out of each other's way.

## Before you change anything

1. **Look at where you are.** Run `git status` and `git branch --show-current`.
2. **Work on your own branch off `main`.** Every piece of work gets a new
   branch from an up-to-date `main` (`git fetch origin` first, then branch from
   `origin/main`). Name it in lower case with hyphens, after the work:
   `details-review`, `guest-list`. Don't build on someone else's branch unless
   you're asked to by name.
3. **If the checkout has edits that aren't yours, make a new worktree first.**
   The same goes for a checkout that's on someone else's branch, or one that
   Patrick or Amelia are editing by hand. Leave that checkout exactly as it is
   and work somewhere else:

   ```sh
   git fetch origin
   git worktree add -b <branch> ../wedding-wt/<branch> origin/main
   cd ../wedding-wt/<branch> && corepack pnpm install
   ```

   Worktrees live beside the repo in `../wedding-wt/`. A new one needs its own
   `pnpm install`. Copy `.env` from the main checkout only if you need the
   RSVP endpoint.
4. **A worktree you were handed may have a machine-made branch name.** T3 Code
   starts some sessions on `t3code/<id>`. Rename it to something descriptive
   at the same commit (`git branch -m <name>`) before your first commit.

## Never touch other people's work

- Don't switch branches, reset, rebase, `git checkout -- <file>`, `git clean`
  or `git stash` in a checkout that has edits you didn't make. Uncommitted
  edits there may be Patrick's or Amelia's, made by hand. If they're in your
  way, ask.
- The main checkout (`wedding/`) is where Patrick and Amelia edit by hand, and
  other tools read it. Keep it on `main`. Do your work in a worktree, not
  there.
- If you need a change that's sitting uncommitted in someone else's checkout,
  ask before moving it. If you're told to move it, carry it into your own
  commit, then say exactly what you did. Don't quietly leave a second copy
  behind for it to conflict later.
- Never rewrite a branch someone else has (no force push, no amend or rebase
  of pushed commits). Never delete another agent's branch or worktree.

## Pushing and merging

- **Ask before every push.** A push to `main` deploys patrickandamelia.com
  (README, Deployment). `voyage-poc` is Patrick's preview of the Garden's
  voyage. A yes to one push isn't a yes to the next.
- Don't create branches on GitHub unless you're asked to by name. Branches
  stay local until then.
- Work from another agent is reviewed before it's merged into `main`. Say
  what's ready and where; Patrick or Amelia decide when it goes in.
- Before pushing, check it's a fast-forward of `origin/main`. If `main` has
  moved, merge or rebase your own unpushed branch onto it, re-run the checks,
  and say so.

## Checks

- Use `corepack pnpm` for everything (`corepack pnpm install`,
  `corepack pnpm astro check`), never plain `npm` or `yarn`.
- Before calling work done, run both `node --test tests/*.test.mjs` and
  `corepack pnpm astro check`.
- If a check fails because of your change, fix it. Stop and report instead if
  the fix would mean weakening or deleting a test you weren't asked to
  change, if it also fails on `main`, or if three attempts haven't made
  progress.
- See visual changes in a real browser (desktop and a 390 × 844 phone) before
  saying they work. `docs/VOYAGE.md` (Tools) has the screenshot tooling.

## Shared machine

- **Ports.** `astro dev` defaults to 4321. Don't use 4321, 4341, 4342 or 4343:
  they're the servers Patrick and Amelia, and the review server, run on. Pick
  a free port (`ss -ltnp`) and say which one you started.
- **Processes.** Stop only processes you started, by their exact PID. Never
  `pkill -f`, `pgrep -f` or `killall`: other agents' servers have matching
  command lines.
- **Scratch files.** Keep scratch in a directory of your own, like
  `/tmp/<branch>/`. Delete headless Chrome profiles once you're done with
  them.
- Don't reboot the machine or restart shared services.

## Commits

- One plain sentence about what someone looking at the site will see, then a
  blank line and a `Co-Authored-By:` line for the agent.
- Commit only your own changes: stage the files by name, not
  `git add -A`.

## The content

- `docs/VOYAGE.md` records why the Garden is the way it is, and who asked for
  each choice. Read it before changing the Garden, and add to it when you make
  a choice that should last.
- A story fact you find in someone's uncommitted work, but not in the docs, may
  have come from Patrick or Amelia. Flag it rather than dropping it.
- `src/data/parties.ts` is the guest list, often edited by hand. Invite codes
  are lower case, digits and hyphens, because they're the guests' links. Once
  invitations have gone out, changing a code breaks that Party's link.
- The Apps Script in the README (RSVP backend) is pasted into Google by hand.
  When you change it, say so, so it gets updated before the change is pushed.
- `CONTEXT.md` defines the words the site uses (Party, Guest, Invite code,
  RSVP). Use them.
