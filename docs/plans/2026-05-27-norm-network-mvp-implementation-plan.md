# Norm Network MVP Implementation Plan (Lightweight)

> **For Hermes:** Execute this in small PR-sized commits. Keep infra minimal. No heavy architecture.

**Goal:** Ship a phone-first, privacy-safe, mobile MVP people can use today.

**Architecture:** Next.js App Router on Vercel + Supabase (Phone OTP, Postgres, RLS). Coarse location + simple discovery query + consent-based connection requests.

**Tech Stack:** Next.js 16, TypeScript, Supabase Auth (phone), Supabase Postgres, server actions/API routes, Vercel.

---

## Guardrails (Non-BS Rules)
- No feed
- No follower system
- No complex recommendation engine
- No exact-location exposure
- No overbuilt microservices
- No background workers unless absolutely required

---

## Task 1: Add env contract and config checks

**Objective:** Define required runtime env vars and fail fast when missing.

**Files:**
- Create: `lib/env.ts`
- Modify: `README.md`

**Implementation:**
- Add `lib/env.ts` typed loader for:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `NEXT_PUBLIC_APP_URL`
- Throw clear startup error if missing.

**Verify:**
- `npm run build` passes with vars set.

---

## Task 2: Add Supabase clients (server + browser)

**Objective:** Centralize auth/database access.

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`

**Implementation:**
- Browser client for client-side session checks.
- Server client for API routes/actions.
- Keep helper functions tiny.

**Verify:**
- Build passes.

---

## Task 3: Create MVP SQL schema

**Objective:** Create only core tables needed for v1.

**Files:**
- Create: `supabase/migrations/0001_mvp.sql`

**SQL (core):**
- `profiles` (user_id, display_name, photo_url, city, bio, what_building, skills[], interests[], open_to[], updated_at)
- `availability` (user_id unique, status enum, is_visible bool, visibility_expires_at, updated_at)
- `presence_locations` (user_id, geohash, lat_approx, lng_approx, accuracy_m, captured_at)
- `connection_requests` (sender, receiver, status enum, message, updated_at)
- `connections` (canonical pair)
- `messages` (connection_id, sender, body, created_at)
- `blocks` (blocker, blocked)

**RLS:**
- User can read/write own profile.
- Discovery only returns users with `is_visible=true` and not blocked.
- Messages only visible to connection participants.

**Verify:**
- Migration applies cleanly in Supabase SQL editor.

---

## Task 4: Phone OTP endpoints

**Objective:** Complete phone-first auth path.

**Files:**
- Create: `app/api/auth/start/route.ts`
- Create: `app/api/auth/verify/route.ts`

**Implementation:**
- `/api/auth/start`: normalize phone, trigger OTP.
- `/api/auth/verify`: verify OTP, establish session, upsert minimal profile shell.

**Verify:**
- Enter phone → receive code → verify → session active.

---

## Task 5: Session + onboarding gate

**Objective:** Force auth first, then onboarding if profile incomplete.

**Files:**
- Modify: `app/page.tsx`
- Create: `app/onboarding/page.tsx`

**Implementation:**
- If no session: show phone auth screen.
- If session and no profile name/city: route to onboarding.
- Else route to home.

**Verify:**
- New user: login -> onboarding -> home.
- Returning user: login -> home.

---

## Task 6: Profile persistence + explicit Save

**Objective:** Keep profile simple and fast.

**Files:**
- Modify: `app/profile/page.tsx` (or existing profile section in `app/page.tsx`)
- Create: `app/api/profile/route.ts`

**Fields only:**
- Name
- Bio
- Location (city)
- Photo URL/upload

**Implementation:**
- Save button persists to `profiles`.
- Toast: “Saved”.

**Verify:**
- Refresh page and data remains.

---

## Task 7: Availability state + privacy toggle

**Objective:** Make presence explicit and reversible.

**Files:**
- Create: `app/api/availability/route.ts`
- Modify: `app/home/page.tsx` (or home section)

**Implementation:**
- Status options: `open_connect`, `focus`, `hidden`.
- Toggle visibility ON/OFF.
- Optional quick expiry: visible for 60 mins.

**Verify:**
- Status updates reflected in DB.

---

## Task 8: Coarse location update endpoint

**Objective:** Store approximate location only.

**Files:**
- Create: `app/api/location/update/route.ts`

**Implementation:**
- Accept lat/lng from client.
- Round/coarsen before DB storage.
- Compute low-precision geohash.
- Never return exact coordinates publicly.

**Verify:**
- Row inserted with rounded coords/geohash.

---

## Task 9: Lightweight discovery endpoint

**Objective:** Return nearby visible builders only.

**Files:**
- Create: `app/api/discover/route.ts`

**Implementation:**
- Input: current coarse geohash.
- Query same/adjacent geohashes + visible users.
- Exclude blocked users and self.
- Return: name, photo, bio, what_building, status, distance_band.

**Verify:**
- Hidden users not returned.

---

## Task 10: Connection requests (consent layer)

**Objective:** No DM before mutual acceptance.

**Files:**
- Create: `app/api/connection-requests/route.ts`
- Create: `app/api/connection-requests/[id]/respond/route.ts`
- Modify: home/discover UI request button

**Implementation:**
- Send request -> pending.
- Accept -> create `connections` row.
- Decline/ignore supported.

**Verify:**
- Only accepted pairs appear in connections.

---

## Task 11: Minimal chat

**Objective:** Keep chat simple and private.

**Files:**
- Create: `app/chat/[connectionId]/page.tsx`
- Create: `app/api/messages/[connectionId]/route.ts`

**Implementation:**
- Send text only.
- Load latest messages (paginate later if needed).

**Verify:**
- Non-participants cannot read/write messages.

---

## Task 12: Safety basics

**Objective:** Add practical abuse controls.

**Files:**
- Create: `app/api/block/route.ts`
- Create: `app/api/report/route.ts`
- Modify: profile/discover/chat menus

**Implementation:**
- Block removes visibility between users.
- Report stores reason + IDs.

**Verify:**
- Blocked user disappears from discover + cannot message.

---

## Task 13: Mobile polish + copy trim

**Objective:** Keep UX clean and fast.

**Files:**
- Modify: `app/product.css`, `app/globals.css`, relevant pages

**Implementation:**
- Keep bottom tabs: Home / Chat / Profile.
- Use short labels only.
- Ensure tap targets >= 44px.

**Verify:**
- Manual iPhone + Android browser test.

---

## Task 14: Deploy + smoke test checklist

**Objective:** Ship safely without ceremony.

**Files:**
- Create: `docs/release-checklist.md`

**Checklist:**
- OTP login works
- Returning session works
- Profile save persists
- Visibility toggle works
- Discover returns nearby users
- Connection request flow works
- Chat works for accepted users only
- Block/report works

---

## First 10 Commits (recommended)
1. `chore: add env contract and supabase clients`
2. `feat: add mvp database migration and rls`
3. `feat: implement otp start/verify routes`
4. `feat: add auth and onboarding gates`
5. `feat: add profile persistence endpoint and ui save`
6. `feat: add availability endpoint and home controls`
7. `feat: add coarse location update endpoint`
8. `feat: add lightweight discover endpoint`
9. `feat: add connection request send/respond flow`
10. `feat: add minimal chat with participant-only access`

---

## What to Build First (Strict)
1. Auth
2. Profile persistence
3. Visibility
4. Discovery
5. Connection consent
6. Chat

## Don’t Build Yet
- Feed
- AI ranking
- Public profile pages
- Group chat
- Event system
- Notifications backend

---

## Success Metric for v1
- A new user can install/open on phone, verify by OTP, set signal, discover someone nearby, send a request, get accepted, and start chat in under 3 minutes.
