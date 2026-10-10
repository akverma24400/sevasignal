# SevaSignal API

All routes use the `/api` prefix. JSON requests use `Content-Type: application/json`. Successful reads return JSON; logout and removal return `204` with no body. The API sends `Cache-Control: no-store`.

## Public routes

| Method | Path                                               | Purpose                                                                    |
| ------ | -------------------------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/health`                                          | Database connectivity and application health.                              |
| GET    | `/config`                                          | Catalogue, distinct city list, default TTL, and demo-help flag.            |
| GET    | `/centres`                                         | Search/filter/paginate centres with active services.                       |
| GET    | `/centres/:id`                                     | One centre, active services, and 15 recent status events.                  |
| GET    | `/centres/:id/alternatives?service=pan-assistance` | Up to 6 other centres currently reporting the requested service Available. |

### Directory query parameters

| Parameter  | Meaning                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `q`        | Text search across English/Hindi centre name, area, city, and PIN; at most 100 characters. |
| `city`     | Exact city name.                                                                           |
| `service`  | Catalogue ID, such as `certificate-printing`.                                              |
| `status`   | `available`, `unavailable`, `closed`, or `unknown`.                                        |
| `page`     | Integer, default 1.                                                                        |
| `pageSize` | Integer 1–24, default 9.                                                                   |

When service and status are both specified, the **same active service** must match both. A status filter without a service matches any active service in that centre. Text search is case-insensitive PostgreSQL `ILIKE`; `%` and `_` act as wildcard characters. All values remain parameterized SQL data.

Example:

```text
GET /api/centres?city=Roorkee&service=pan-assistance&status=available
```

Response shape:

```json
{
  "centres": [],
  "total": 0,
  "page": 1,
  "pageSize": 9,
  "serverTime": "2026-10-06T09:30:00.000Z"
}
```

Actual nonempty results contain centre details and a `services` array. Every service has an internal UUID `id`, catalogue `service_id`, `reported_status`, derived effective `status`, `stale`, `confirmed_at`, `expires_at`, `version`, and public note/reason fields. Consumers should use the effective status and account for expiry while displaying cached results.

`serverTime` supports client clock correction. Dates are ISO 8601 UTC; the interface displays them in the browser's local timezone. Alternative results use the same list shape. They are ordered by city/name, not by geographic distance.

## Authentication

| Method | Path             | JSON body / result                                                                                            |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`    | `{ "email": "...", "password": "..." }` → operator summary and session cookie.                                |
| GET    | `/auth/me`       | Current operator summary, or 401.                                                                             |
| POST   | `/auth/logout`   | Send `{}`; removes the current session and clears its cookie.                                                 |
| POST   | `/auth/password` | `{ "currentPassword": "...", "newPassword": "..." }`; new password 12–128 characters; revokes other sessions. |

Browser calls must include credentials. The provided frontend uses `credentials: 'include'`. No bearer token, API key, or local-storage token is needed. The session cookie is scoped to `/api`, HttpOnly, SameSite=Lax, and Secure when `NODE_ENV=production`.

Login uses a generic error for missing accounts and incorrect passwords. There is no public signup route. Use `operator:create` to assign accounts locally. Session expiry is fixed, not extended on every request.

## Operator routes

All routes require a valid session and operate on its assigned centre. Supplying another `centre_id` in JSON does not change authorization.

| Method | Path                              | Purpose                                                                    |
| ------ | --------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/operator/dashboard`             | Assigned centre, 40 recent updates, and up to 100 recent incident reports. |
| PATCH  | `/operator/services/:uuid/status` | Confirm service status with optimistic concurrency.                        |
| POST   | `/operator/services`              | Add/reactivate a catalogue service at the assigned centre.                 |
| DELETE | `/operator/services/:uuid`        | Archive an active service belonging to the assigned centre.                |
| PATCH  | `/operator/centre`                | Update the assigned centre's public profile.                               |

### Confirm a status

```json
{
  "status": "unavailable",
  "reason": "network",
  "note": "Portal connection is interrupted. Please check again before travelling.",
  "ttlMinutes": 30,
  "version": 1
}
```

- `status`: one of the four lowercase states.
- `reason`: required for Unavailable; one of `network`, `equipment`, `staff`, `scheduled`, `other`. Other states clear the stored reason.
- `note`: optional, trimmed, at most 240 characters. It is publicly visible.
- `ttlMinutes`: required integer 1–240. Unknown ignores the value and has no expiry.
- `version`: the positive integer from the most recently read service. A stale value returns `409 VERSION_CONFLICT` and changes nothing.

Success returns `{ "centre": { ... } }`. The service update, history event, and incident changes happen in one transaction. An unavailable service opens at most one incident. Only Available resolves it. Archiving does not resolve incidents.

### Add a service

```json
{ "serviceId": "document-scanning" }
```

Returns `201` and the updated centre. A new/reactivated service starts Unknown. Re-adding an archived service retains its UUID and previous history; adding an already active service returns 409.

### Edit the centre profile

```json
{
  "name": "Example Seva Centre",
  "name_hi": "उदाहरण सेवा केंद्र",
  "area": "Example Area",
  "city": "Roorkee",
  "pincode": "247667",
  "address": "A sample public address, Example Area",
  "opening_hours": "Mon–Sat, 9:00 am–6:00 pm",
  "description": "Sample description.",
  "phone": ""
}
```

Required fields are name, area, city, PIN, address, and hours. Optional Hindi name, description, and phone default to empty strings if omitted. The PIN must be six digits and not start with zero. Centre ID, sample flag, and operator assignment cannot be changed by this endpoint.

## Errors and limits

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "This service changed in another session. Refresh and try again."
  }
}
```

Validation errors also include a `fields` array with field paths and messages.

| Code | Typical cause                                                 |
| ---- | ------------------------------------------------------------- |
| 400  | Invalid JSON, field value, or current password.               |
| 401  | Missing/expired session or invalid login.                     |
| 403  | Browser mutation from a disallowed Origin.                    |
| 404  | Missing record, wrong API route, or another centre's service. |
| 409  | Stale version or duplicate active record.                     |
| 413  | JSON body exceeds 16 KB.                                      |
| 415  | Mutation request is not JSON; DELETE is exempt.               |
| 429  | API/sign-in request limit reached.                            |
| 500  | Unexpected server error; internal details are not returned.   |

The application limits the API to 300 requests/minute/IP and login to 20 attempts/15 minutes/IP. Automated integration tests disable those limits in test mode. These are process-local limits, not a distributed rate-limiting service. Browser mutations are checked against allowed origins or the application's own origin, in addition to cookie and JSON request controls.
