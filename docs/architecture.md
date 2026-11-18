# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Build route components around the shared `src/api/client.ts` fetch helper. Keep rendering and user-facing state in React components, and display explicit loading, success/empty, and accessible error states for each capability.
- Logic tier decision: Keep HTTP concerns in `src/routes/api.ts` and validation, aggregation, and data orchestration in `src/services/octofitService.ts`. Return deliberate 4xx responses for bad IDs or missing resources, and use an error middleware rather than allowing Mongoose cast errors to become 500 responses.
- Data tier decision: Define all required fields and references in Mongoose schemas, use the shared database configuration, and preserve unrelated records during idempotent seeding. Seed demo teams, users, activities, and workouts with upserts and reconcile existing demo users' team memberships.
- Activity tracking approach: Validate `userId`, `teamId`, `type`, and `minutes`; require valid ObjectIds and existing User and Team documents. Compute positive points and set `occurredAt` on create. Return a 201 for creation and list activities through the same service layer.
- Team management approach: Validate a required `name`, preserve the submitted `mascot` and `members`, and return 400 for missing names or invalid team input. Support creation and listing through team service functions.
- Leaderboard approach: Aggregate Activity points by team, sort totals descending, and assign a 1-based rank in the returned team-name entries. Include only teams represented by the aggregate result.
- Workout suggestions approach: Decode and look up the submitted email as a User. Select workouts whose focus matches the user's fitness goal or recent activity type, explain the match in `reason`, and return a deliberate 4xx when no user exists.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Verifies Mongoose validation and idempotent seed behavior.
  - **Current result:** 4 failures and 1 pass. User, Team, Activity, and Workout schema validation is missing; the representative seed test already passes.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Verifies activity/team request contracts, leaderboard ordering, and workout matching.
  - **Current result:** 4 failures. Activity and team validation are unimplemented, leaderboard aggregation is absent, and workout suggestions ignore user activity/goal data.
- Frontend command: `npm test --prefix octofit-tracker/frontend -- --run`
  - Verifies route rendering, the Mona workout request, loading states, empty states, and accessible API errors.
  - **Current result:** 15 failures. The presentation components do not yet satisfy the shared API and accessible-state contracts.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
  - Verifies Express and TypeScript type correctness after the data and service implementation. A failure here means the implementation is not type-safe even if runtime tests pass.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  - Verifies React/TypeScript compilation and the Vite production bundle after presentation implementation. A failure here means a component, API-client, or import issue remains.
