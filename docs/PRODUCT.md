# NorthPeak demo — product rules (for testers)

Short reference for **business rules** this sandbox implements. Use it when writing assertions or scenarios.

## Accounts & balances

- **Checking / savings**: normal deposit accounts; balance must not go negative on outbound debits (unless product says otherwise — here it does not).
- **Closed accounts** (`closedAt` set): remain visible in accounts UI as closed/disabled rows; **cannot send or receive** transfers or bill payments.
- **Frozen deposit**: treated as **blocked** for outbound debits (bill pay, transfers source).
- **Insufficient funds**: any operation that debits a checking/savings account will be rejected if it would bring the account below **$0.00**.

## Credit cards

- **Active card**: `CREDIT` type, `cardLifecycle = ACTIVE`, not frozen, not closed.
- **Canceled / lost / frozen credit**: not usable in transfer flows and excluded from dashboard account cards.
- **Credit cannot be the “From” account** on **Transfer** and cannot be transfer destination in internal/peer transfer selection.
- **Primary card**: optional; at most one active card can be marked primary. If that card is cancelled/lost, primary is automatically cleared.
- **Frozen tag**: frozen cards remain `ACTIVE` lifecycle but show an additional **Frozen** indicator in the UI.
- **Cancel card**: requires explicit confirmation and card balance must be exactly **$0.00** (cannot cancel with debt or positive balance).
- **Report lost**: issues a **replacement** card (new PAN/CVV/expiry), keeps **the same balance**, **moves ledger transactions** to the new card, and **closes** the old card.
- **Pay card**: payments can only come from checking/savings and are rejected if the funding account has insufficient funds.

## Bill pay

- **Pay from** can be **checking/savings** or **active credit cards**; frozen sources are shown but disabled.
- **Schedule**: creates a future-dated **scheduled** row. A schedule request is validated at creation time (valid pay-from + enough available funds/credit for the amount).
- **Pay now (immediate)**: creates an **instant** paid row and debits **immediately** (ledger line on the funding account).
- **Scheduled row invalid “source”**: if the linked account later becomes unusable (closed/frozen) or funds are insufficient for the scheduled amount, the row is marked **invalid** until the user **edits** and fixes pay-from / amount / date.
- **Pay now on a scheduled bill**: requires a valid pay-from and enough balance; otherwise API returns an error—user should **edit** the scheduled payment first.
- **Credit-card pay-from**: bill pay from a card is constrained by available credit (credit limit unless “Allow over limit” is enabled).

## Transfers

- **Internal / peer “From”**: checking/savings only; frozen/closed sources are not actionable.
- **Internal “To”**: open checking/savings accounts only (cards excluded).
- **Peer “To”**: recipient open checking/savings only (cards excluded).
- **Insufficient funds**: transfers are rejected when the source checking/savings account doesn’t have enough balance.

## Payees

- **Edit** supports nickname + reference changes.
- **Delete** requires confirmation in the UI; success is acknowledged with a toast.

## Activity log

- Records profile/security and payee management actions (not the full money ledger). Activity details prefer nickname/context over raw metadata where possible.

---

For stack and URLs, see the root **README.md**.
