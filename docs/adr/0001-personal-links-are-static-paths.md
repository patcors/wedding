# Personal links are static paths, and codes are never typed

Each Party's personal link is `patrickandamelia.com/<invite-code>`, a pre-built page that greets them and carries them to their RSVP. We chose a path over a `?invite=` query string because the link is printed on digital cards and can't change once they go out, and because a static page per Party means the browser never receives the full guest list. Guests can't type a code anywhere: without their link they see the generic Garden and Details page and can send an Open RSVP by typing their names.

## Consequences

- Invite codes share the URL namespace with real pages. A code can never be `details`, or the name of any other page.
- Invite codes are guessable words, so anyone who guesses one can RSVP as that Party. Accepted for a 54-party wedding.
