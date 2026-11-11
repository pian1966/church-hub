# 059 – Decisions only people can make (the owner, with an accountant)

**Model:** none – this is a conversation. Any assistant can keep the notes.

Write the answers in `docs/architecture/BILLING-DECISIONS.md`:
1. **Who receives the money:** the owner personally, a company, or a non-profit. Subscription income is taxable
   income unless a registered non-profit runs it. Ask an accountant.
2. **Payment company.** Needs: one-off card payments with our own reference (the church's id) attached; a way for
   the robot to list successful payments; payouts to the owner's country; as many countries and as much mobile
   money as possible. Candidates to compare on their current terms: Paystack (South Africa-based merchants),
   and a "merchant of record" such as Paddle or Lemon Squeezy (they handle other countries' sales tax).
   Do not trust any fee or feature from memory – read each company's own pages on the day.
3. **Terms** a church accepts at setup: what is kept centrally, the price, view-only after 60 days, no refunds or
   refunds, "as is". A lawyer reads it once.
4. The **grant** policy: who may have a free year and how they ask.
5. Does the 30-day trial stand? Is the minimum per church or per site?

**Blocks:** 066 and 067 (payment parts only). Nothing else waits for this.
