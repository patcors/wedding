# Patrick & Amelia's wedding site

The website guests use to learn about Patrick and Amelia's wedding and to RSVP.

## Language

### Guests and invitations

**Party**:
A group of people invited together who reply with one RSVP, e.g. "Dean & Kelly". Every Party has exactly one Invite code.
_Avoid_: Household, invitee, guest (for the group)

**Guest**:
One named person within a Party. Attendance and dietary needs belong to a Guest, not to the Party.
_Avoid_: Attendee (a Guest who hasn't replied yet isn't attending anything)

**Invite code**:
The short word or phrase that identifies a Party, e.g. `curry`. Guests never type it; it only appears inside their Personal link.
_Avoid_: Slug (implementation word), password

**Personal link**:
The web address on a Party's digital card, made from their Invite code. Opening it shows the Garden greeting that Party by name.
_Avoid_: Invitation link, magic link

**RSVP**:
A Party's reply: for each Guest, whether they're coming and what they can't eat, one email or phone number to reach the Party, plus optional notes for the couple. A Party may reply more than once; the latest reply stands.

**Open RSVP**:
An RSVP sent without a Personal link. The sender types each person's name, and the couple match it to a Party by hand.
_Avoid_: Generic RSVP, anonymous RSVP

### The site

**Garden**:
The interactive 3D landing experience at the root of the site. Opens with the couple's names and the date, then walks through their photographs to the celebration.
_Avoid_: Prototype, garden study, story

**Details page**:
The page guests reach after the Garden, holding everything practical about the day: location, times, getting there, where to stay, questions, and the RSVP.
_Avoid_: Info page

**Review panel**:
Controls for comparing visual variants of the Garden. Exists only while developing; guests never see it.
_Avoid_: Debug menu, proof-of-concept controls

## Relationships

- A **Party** has one **Invite code** and one or more **Guests**
- A **Party** submits zero or more **RSVPs**; the latest one is the answer
- An **RSVP** records a response for every **Guest** in the **Party**
- The **Garden** leads to the **Details page**, which ends with the **RSVP**
- A visitor without a **Personal link** sees the generic **Garden** and **Details page**, and replies with an **Open RSVP**

## Flagged ambiguities

- The code's `Guest` type (`src/data/guests.ts`) describes a **Party**, not a **Guest**. Resolved: a Party is the group, a Guest is one person.
