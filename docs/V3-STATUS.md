# v3 Phase 1 / Phase 2 foundation

## Run
Web: `npm install`, `npm run build`. Deploy uses Sites and D1 migrations.
Tests: `node --test tests/*.test.mjs`; `python tests/database_test.py`; `npx tsc --noEmit`.
Native backend: `pip install -r backend/requirements.txt`; provision PostgreSQL with pgvector; set DATABASE_URL; `alembic -c backend/alembic.ini upgrade head`; `uvicorn backend.app.main:app`. DEV_BEARER_TOKEN/DEV_OWNER are development-only authentication. No production auth or native simulation adapter is implemented.
Godot: open godot/project.godot in Godot 4. Connectivity starter only, not a completed native port. Native binaries and PostgreSQL integration have not been tested in this environment.

## Architecture and authority
UI sends action proposals to the authenticated API. The interpreter parses supported intents; map, time, progression and event engines validate them. D1 owns the canonical world aggregate and revision. A batch atomically commits revision, idempotency receipt, immutable event ledger and per-actor knowledge. Memory queries join actor knowledge, never return GM truths. Historical branch copies a snapshot into a new isolated world. NPC schedules run on elapsed world time, not LLM calls.
L1 rules and L2 world geography are code/data; L3 personalities are in data/taixu.json; L4/L5 canonical state; L6 immutable event_ledger; L7 actor_knowledge plus NPC state. PostgreSQL models/migration are a separate foundation, not the live storage. Semantic embeddings, graph traversal, formal promises and memory summaries remain pending.

## Protocol
POST /api/game `{op:'turn',world,revision,requestId,action:{type,...}}` or `{text,talkTarget}`. Client request UUID survives retries. Server verifies ownership, revision, adjacency, collision, proximity, resource availability. Result is player-visible state. Unknown natural-language actions explicitly report unsupported/offline; they are not fabricated AI output. Structured LLM interpretation/narration is Phase 3.
POST /api/ai `{op:'test',provider,model}` performs a real server-side model-list request with environment-provided key. No credentials are sent from the browser or recorded in memory. Dialogue generation is not yet connected even when the provider test succeeds.

## Visual implementation
Original generated landscape, courtyard and five-character atlas; muted teal, indigo, gold. No copied Witchbrook assets. Full-screen responsive HUD, circular minimap, animated nine-item radial menu, memory filter/details, worldline selection. Canvas actors interpolate actual persisted positions. Sprite directional frames, terrain-specific collision mask aligned to detailed artwork, unique scene art per location, advanced weather/light animation, building interior scenes and all four map levels remain incomplete. Current courtyard is a shared prototype environment; authoritative map and collision geometry are the existing engine template.

## Roadmap
1. Validate browser interactions, refine scene navigation mask and four-direction sprite animation; improve art per location.
2. Port D1 transactional simulation to PostgreSQL, add complete layered schema, knowledge sources, graph/semantic retrieval, real PG integration tests.
3. Provider structured output, failure-safe intent interpretation, constrained NPC narration and server-side cost limits.
4. NPC plans, multidimensional relations, economy/faction clocks and long-term interruptions.
5. Godot full native client and maps; account auth and encrypted player keys.
6. Windows/macOS/Web/Android/iOS actual packaging and device tests.

## Limits
Live account flow is ChatGPT platform auth; custom registration and guest mode pending. Basic routine NPCs and seeded new area/people are persisted; generation is procedural, not LLM. AI is offline until server keys are configured. Native clients, all-platform validation and full freeform actions are not complete. Automated engine checks do not substitute for browser or real PostgreSQL testing.

## Validation in this release
21 engine/spatial/projection tests and 8 real SQLite migration/transaction tests passed (29 total). TypeScript check and production build passed. Seven PostgreSQL table definitions compile against the PostgreSQL dialect; FastAPI imports successfully. This is not a running PostgreSQL integration test. Browser click testing and native/device tests remain pending.
