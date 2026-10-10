# Verification and test commands

## Verified for this delivery

The application was built and exercised on Linux with Node.js 24.19.0, the locked npm dependencies, and PGlite 0.5.8. Browser checks used Chromium at **1440 × 1000** and **390 × 844** viewports.

| Check                                                      | Result                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Frontend build (`npm run build`)                           | Passed                                                    |
| Backend and onboarding integration tests (`npm test`)      | 13 passed, 0 failed                                       |
| Browser walkthrough against the actual built frontend      | Passed all 8 reported check groups                        |
| Uncaught browser errors / HTTP 5xx during the walkthrough  | None                                                      |
| Desktop/mobile page width and modal width                  | No horizontal page overflow in the tested views           |
| English/Hindi screenshots                                  | Inspected; fonts are bundled locally with the application |
| Lockfile consistency (`npm ci --dry-run --ignore-scripts`) | Passed                                                    |

Screenshots: [directory](screenshots/directory.png), [operator dashboard](screenshots/dashboard.png), [mobile directory](screenshots/mobile-directory.png), [Hindi on mobile](screenshots/mobile-hindi.png), and [mobile dashboard](screenshots/mobile-dashboard.png).

These screenshots use isolated fictional data. Their timestamps, notes, and counts are not live service information.

## Backend integration tests

```bash
npm test
```

The tests create isolated in-memory PGlite databases and temporary directories. They do not change your application's local database or require a separately running server.

The 13 tests cover:

1. Health, catalogue, search, combined filters, invalid queries, and out-of-range pagination.
2. Alternatives matching the requested service and excluding the original centre.
3. Incorrect credentials, cookie attributes, and omission of password hashes from API responses.
4. Authentication, cross-centre write rejection, Origin checks, and input validation.
5. Public updates, event history, one open incident, and explicit resolution.
6. Expiry to Unknown without falsely resolving an interruption.
7. Version conflict rejection without appending an incorrect event.
8. Service removal/re-addition preserving history and requiring new confirmation.
9. Profile edits restricted to the operator's centre.
10. Idempotent migration/seed behavior preserving edits.
11. Password changes revoking other sessions and logout invalidating the current token.
12. Disk persistence across closing and reopening the embedded database.
13. Clean catalogue/centre/operator CLI onboarding, successful sign-in, and adding the first service.

## Browser walkthrough

Install Playwright's Chromium once:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run test:ui
```

This builds the frontend, creates a temporary in-memory database, starts Express on a free local port, and runs real browser interactions. It closes the browser/server/database afterward. No cloud or external site is involved.

The walkthrough checks search and empty results, filters, available alternatives, direct-link refresh, protected routes, failed/successful login, cross-browser status updates, incident resolution, service removal/re-addition, profile persistence, client-side expiry, Hindi persistence, mobile filters and dialogs, and logout.

Expiry is tested with a database fixture that sets a confirmation three seconds into the future, then verifies that the open page becomes Unknown before the next 30-second data refresh. There is no artificial “Unknown” response inserted into the frontend.

Optional variables for this test script:

| Variable                     | Purpose                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PLAYWRIGHT_EXECUTABLE_PATH` | Use an already installed compatible Chromium binary. Not needed with a normal Playwright browser installation. |
| `UI_SCREENSHOTS`             | Folder for captured PNGs. If omitted, the test does not write screenshots.                                     |

For example, on macOS/Linux:

```bash
UI_SCREENSHOTS=.artifacts/ui npm run test:ui
```

Playwright may need additional system browser libraries on a minimal Linux installation. Its install/error output identifies those requirements. Browser downloads are optional for ordinary application use; they are needed only for this UI test.

## Remaining verification boundaries

- A separately installed PostgreSQL server was not available in the build environment. The `pg` adapter is included, but its real network/TLS connection path was **not exercised**. The schema, SQL queries, and transactions were exercised through PGlite's PostgreSQL engine.
- No AWS or other deployment was created or tested, as requested.
- No load/scale benchmark, security audit, or comprehensive accessibility audit was performed.
- Browser checks used Chromium; Safari and Firefox were not tested.

The supplied tests verify the local application workflows. They do not establish production capacity or validate any real centre's status reports.
