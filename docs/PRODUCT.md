# NorthPeak demo — product rules (for testers)

Short reference for **business rules** this sandbox implements. Use it when writing assertions or scenarios.

## Accounts & balances

- **Checking / savings**: normal deposit accounts; balance must not go negative on outbound debits (unless product says otherwise — here it does not).
- **Closed accounts** (`closedAt` set): excluded from normal lists; **cannot send or receive** transfers or bill payments from UI flows that validate accounts.
- **Frozen deposit**: treated as **blocked** for outbound debits (bill pay, transfers source).

## Credit cards

- **Active card**: `CREDIT` type, `cardLifecycle = ACTIVE`, not frozen, not closed.
- **Canceled / lost / frozen credit**: **cannot originate money movement** except where the app exposes a dedicated **pay-down from checking/savings** (`Pay card`) — credit is never a **transfer source** (internal or peer).
- **Credit cannot be the “From” account** on **Transfer** (between accounts or to another person). Use **Pay card** or **Bill pay** for paying from bank accounts.
- **Cancel card**: blocked if the card still has **debt** (negative balance / amount owed). User must **pay the balance first**, then cancel.
- **Report lost**: issues a **replacement** card (new PAN/CVV/expiry), keeps **the same balance**, **moves ledger transactions** to the new card, and **closes** the old card.

## Bill pay

- **Pay from** must be **checking or savings** that is open and not frozen.
- **Schedule**: creates a future-dated **scheduled** row; debits only when **Pay now** runs or an instant payment is created.
- **Pay now (immediate)**: creates an **instant** paid row and debits **immediately** (ledger line on the funding account).
- **Scheduled row invalid “source”**: if the linked account later becomes unusable (closed/frozen) or funds are insufficient for the scheduled amount, the row is marked **invalid** until the user **edits** and fixes pay-from / amount / date.
- **Pay now on a scheduled bill**: requires a valid pay-from and enough balance; otherwise API returns an error—user should **edit** the scheduled payment first.

## Transfers

- **Internal / peer “From”**: **checking or savings only** (matches backend enforcement).
- **“To”**: must be allowed to receive (open; credit destinations must be active & not frozen).

## Payees

- **Delete** requires **confirmation** in the UI; success is acknowledged with a **toast**.

## Activity log

- Records **profile/security actions** (not the full money ledger). Replacement lost-card events appear as structured metadata.

---

For stack and URLs, see the root **README.md**.
