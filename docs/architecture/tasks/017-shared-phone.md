# 017 – One phone, several people (later)

**Model:** Architect first, then senior.

**Goal:** a household with one phone can link up to four people to it and choose who is using Church Hub – the
same "who is using Church Hub?" as a shared email address.

**Needs:** 016 in use by a real church first. **Escalate to the architect for the rules before starting**: it is an
`update` rule on `devices/{uid}` that adds the invite's person to `also` / `people` (the fields are already in the
document so nothing needs converting), and it must be shown that it cannot be used to add a person without their
own unused code.

**Do not** start this from the sketch alone.
