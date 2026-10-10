# A three-minute SevaSignal walkthrough

## Prepare

1. Run `npm ci`, then `npm run demo` from the project root.
2. Open `http://127.0.0.1:5173` in a regular window and a private/incognito window. Use one as the operator and the other as the citizen.
3. In the operator window, sign in as `roorkee@sevasignal.demo` with `SevaDemo2026!` (or your custom password).
4. If the seed was run more than an hour ago, reconfirm a few services. Existing sample records are intentionally not refreshed by re-seeding.

## 0:00 — Explain the problem

“People travel to local centres without knowing whether the specific service they need is working. SevaSignal lets a centre share a recent confirmation before someone starts that journey.”

Search for **247667**. Choose **Certificate printing**, then **Find centres**. Point out that the sample centres are clearly labelled as fictional.

## 0:30 — Show a citizen's decision

Open **Civil Lines Seva Centre**. Point out the individual service status, last confirmation, validity, and operator note. Use **Find alternatives** for an unavailable/unknown/closed service.

If the alternative list is empty because all confirmations have expired, say so; the app should never invent availability. You can sign in to another sample operator ahead of time and confirm the same service there.

## 1:00 — Publish a real application update

In the operator window, open **My dashboard**. On **Certificate printing**, click **Update status**:

- Select **Unavailable**.
- Select **Equipment issue**.
- Enter “Printer maintenance is in progress.”
- Keep a 60-minute validity and save.

In the citizen window, click **Refresh**. The changed state and note are read from the database. Without a manual refresh, open pages fetch new data every 30 seconds while visible.

## 1:40 — Show the recovery trail

Open **Activity & incidents** in the operator dashboard. Show the report and history entry. Then set Certificate printing to **Available** with “Printer checked; service restored.” The report becomes Resolved and its restoration time is recorded.

Explain that Unknown or Closed does not falsely resolve an interruption.

## 2:15 — Show freshness and Hindi

Set a different service to Available for **1 minute**. Open its public page and continue the presentation; after expiry it becomes **Unknown** without a background scheduler.

Switch to **हिंदी**. Show the translated service names and interface, then use a narrow/mobile window to demonstrate the layout.

## 2:50 — Explain the implementation

“The React interface talks to an Express API. PostgreSQL stores confirmations, permissions, and history. Operators only control their assigned centre, and version checks prevent stale tabs from overwriting a newer update. I built and verified the application locally; my deployment work is a separate next step.”

Only claim cloud deployment after you have actually completed it. The included project contains no cloud resources or deployment automation.

## Useful questions to anticipate

**Is this live government data?** No. Centres manually report the availability of their own assistance services. All seeded listings are fictional.

**What happens if an operator forgets to update?** The confirmation expires to Unknown. The app does not assume the service is working.

**Are alternatives always nearby?** They are other participating centres with a fresh confirmation. City and PIN are shown; distance ranking is not implemented.

**Is it instant across browsers?** The saving operator sees the result immediately. Other open browsers poll every 30 seconds or can use Refresh.

**What is the application's main differentiator?** Freshness is part of the data model: explicit expiry, honest Unknown states, service-specific confirmations, and a recovery history.
