---
title: "AI-Powered Roofing Estimate Pipeline"
subtitle: "JobNimbus Hackathon - 20-Hour Execution Plan"
date: "May 2026"
---

# Mission

Build a working AI-powered roofing estimate pipeline in under 20 hours that takes an address and produces an interactive estimate with a 3D visualization, AI-generated property intelligence, and a one-click handoff to JobNimbus.

**Demo win condition:** A judge types in an address, watches the system pull property data and generate a confident estimate range in under 10 seconds, sees a 3D model of the actual home with selectable roof facets, makes a few changes that update the estimate live, talks to the AI to refine the scope, and clicks "Send to JobNimbus" to push the final estimate to a deal.

\newpage

# Core Workflow

The single happy path the demo must execute flawlessly:

```
1. CONTRACTOR ENTERS ADDRESS
   - Google Places autocomplete returns lat/lon
   
2. PARALLEL PIPELINE FIRES (T = 0)
   |
   +-- Tier 1: Fast Ballpark (target: 5-8 seconds)
   |   - Google Solar API: roof segments + pitch + area
   |   - Google Maps Static: top-down imagery
   |   - Claude vision: material, condition, attributes
   |   - Internal pricing tables: regional costs
   |   - Calculation engine: range estimate
   |
   +-- Tier 2: Background Verification (simulated for demo)
       - 90-second timer triggers swap to "verified" mock data
       - Confidence range tightens visibly

3. CONTRACTOR SEES 3D VIEW + ESTIMATE
   - Google Photorealistic 3D Tiles loads property
   - Roof facets rendered as colored overlay planes
   - Estimate breakdown panel populated
   - Confidence visualization shows data sources

4. CONTRACTOR INTERACTS
   - Clicks facets to toggle replace/repair/skip
   - Picks material from dropdown
   - Estimate updates live
   - Asks AI questions in chat sidebar ("what if metal?")

5. T = ~90s: VERIFICATION ARRIVES
   - "Measurements verified" UI moment
   - Confidence range tightens (e.g., +/-18% to +/-6%)
   - Subtle animation confirms upgrade

6. CONTRACTOR SENDS TO JOBNIMBUS
   - Click "Send to JobNimbus"
   - Estimate posts to deal/job (mocked or real)
   - Success confirmation

7. VIEW TOGGLE (bonus)
   - Switch to "homeowner mode" to show same estimate
     in friendly, customer-facing presentation
```

\newpage

# Required APIs (Critical Path Only)

Three APIs on the critical path. Two of them share a Google Cloud project, so signup is one place.

| API | What It Provides | Signup Path | Free Tier? |
|---|---|---|---|
| Google Places | Address autocomplete, lat/lon | Google Cloud Console | Yes, generous |
| Google Maps Static | Top-down satellite imagery | Same project | Yes |
| Google Solar API | Roof segments, pitch, azimuth, area | Same project | Yes, hackathon-friendly |
| Google 3D Tiles | Photorealistic 3D mesh of property | Same project | Yes |
| Anthropic API | Claude vision (material, condition, attributes) + chat | console.anthropic.com | Trial credits or hackathon credits |

**Setup all of these in the first 30 minutes.** All four Google APIs share one Cloud project. Get one Cloud API key, enable the four APIs, and you're done. Anthropic key is a separate signup but is even faster.

## What's NOT on the critical path

These are deferred to "if time permits" or simulated entirely for the demo:

- **EagleView API** — simulate Tier 2 verification with a 90-second timer that swaps in pre-prepared mock data. Real integration is multi-day waiting on credentials.
- **JobNimbus API** — mock the integration with a fake POST and success confirmation, OR if the hackathon provides sandbox access, use it. Don't gate the build on this.
- **Nearmap** — cut entirely. Claude vision replaces its functionality.
- **ATTOM / Estated** — cut entirely. Ask the homeowner / use defaults.
- **NOAA storm history, image generation APIs, etc.** — bonus features only.

\newpage

# Hour-by-Hour Milestones

The plan assumes a single developer working ~20 active hours over a 24-hour hackathon window. Adjust if working with a teammate.

## Phase 1: Foundation (Hours 1-4)

**By end of Hour 4:** App skeleton runs locally. All API keys provisioned. Address input works.

### Hour 1 - Setup & Account Provisioning

- Create Google Cloud project; enable Places, Maps Static, Solar, and Map Tiles APIs
- Generate API key, restrict to localhost for safety
- Sign up for Anthropic API; generate key
- Init git repo; create `.env.example` with placeholder keys
- Scaffold project: `npm create vite@latest` (React + TypeScript) for frontend, `mkdir backend && npm init` for Express, OR a single Next.js app if you prefer monorepo
- Install core deps: `react`, `three`, `@react-three/fiber`, `@react-three/drei`, `axios`, `tailwindcss`, `@anthropic-ai/sdk`, `express` (or Next API routes)

**Milestone check:** `npm run dev` shows a Hello World page. API keys are in `.env`. Repo is committed.

### Hour 2 - Address Input + Google Places

- Add Places autocomplete input component using Google Maps JS SDK
- On selection, capture: formatted_address, lat, lng, place_id
- Display selected address in a sidebar
- Set up basic two-pane layout: left sidebar (controls + estimate), right pane (will hold 3D view)

**Milestone check:** User types an address, picks one from dropdown, sees the formatted address echoed back.

### Hour 3 - Backend API Routes Skeleton

- Set up Express server (or Next API routes) with three stub endpoints:
  - `POST /api/estimate/start` (kicks off Tier 1)
  - `GET /api/estimate/:id` (returns current estimate state)
  - `POST /api/estimate/:id/refine` (handles facet selection changes)
- Wire up CORS for local dev
- Add a simple in-memory store keyed by estimate_id (no DB needed for hackathon)
- Return mock data from each endpoint for now

**Milestone check:** Frontend can hit backend, backend returns hardcoded JSON, no errors in console.

### Hour 4 - Pricing Tables + Calculation Engine

- Create `pricing.json` with Salt Lake City regional prices: shingles $/sq, underlayment, ice & water, ridge cap, drip edge, starter, flashing, labor base rate, tear-off rates by material+layers, dump fee per ton, permit cost
- Implement calculation engine in `calc.ts`: takes the unified payload, returns `{subtotal, with_overhead, final, low, high, breakdown[]}`
- Unit-test with one fixed input to verify it returns sensible numbers (~$27k for the SLC example from the spec)

**Milestone check:** Calling `calculate(mockPayload)` returns numbers within 5% of the spec example. Confidence range works.

---

## Phase 2: Tier 1 Pipeline (Hours 5-9)

**By end of Hour 9:** Address in, real estimate out. Pipeline runs end-to-end with real Google Solar + Claude vision data.

### Hour 5 - Google Solar API Integration

- Backend: implement `getSolarData(lat, lng)` that calls Solar API's `buildingInsights:findClosest` endpoint
- Parse response to extract: roof segments (each with pitch_degrees, azimuth, area_meters2, polygon vertices)
- Convert square meters to square feet, degrees to rise/run notation
- Handle the no-coverage error case gracefully (return null, frontend falls back to mock)

**Milestone check:** Hit the endpoint with a known SLC address (verify coverage first), get back structured roof segment data.

### Hour 6 - Linear Measurement Derivation

- Write `deriveLinearMeasurements(segments)` function
- For each pair of segments, find shared edges (within tolerance) - those are ridges or hips
- For perimeter edges (not shared), classify as eave (horizontal-ish) or rake (sloped)
- Return totals: `{ridge_lf, hip_lf, valley_lf, rake_lf, eave_lf}`
- This is the trickiest geometry work in the project; budget the full hour

**Milestone check:** Run on real Solar API output, verify the linear totals are within reasonable range for the property (eyeball check against satellite view).

### Hour 7 - Claude Vision Integration

- Backend: implement `getRoofAttributes(imageUrl)` that calls Claude API with a vision prompt
- Use the structured prompt from the spec: returns JSON with material, shape, condition, overhang, solar panels, complexity, stories
- Parse and validate the JSON response
- Add error handling for low-confidence cases

**Milestone check:** Send a real Google Maps Static image to Claude, get back well-structured JSON attributes within 5 seconds.

### Hour 8 - Tier 1 Pipeline Orchestration

- Wire up `POST /api/estimate/start`:
  1. Take address + lat/lng
  2. Fetch satellite image URL from Google Maps Static
  3. In parallel: call Solar API + Claude vision
  4. Derive linear measurements from Solar segments
  5. Build unified payload (use the mock JSON shape from the spec)
  6. Run calculation engine
  7. Return: `{estimate_id, payload, breakdown, confidence_range}`
- Add timing logs to verify <10 second total

**Milestone check:** End-to-end: enter address, backend returns full estimate in 5-10 seconds. Print the JSON to console; verify it looks right.

### Hour 9 - Estimate Breakdown UI

- Frontend: build the estimate panel (sidebar)
- Show: address, total estimate range ($X - $Y), confidence indicator, line item breakdown
- Show: data source badges (Google Solar [verified], Claude vision [94% confidence], etc.)
- Style with Tailwind; clean and professional
- Add loading state during pipeline execution

**Milestone check:** Type address, hit Start, see real estimate appear in the sidebar within 10 seconds. This is the first "demo-able" milestone - if you stopped here, you'd still have something to show.

---

## Phase 3: 3D Visualization (Hours 10-13)

**By end of Hour 13:** Photorealistic 3D model of the property displays with interactive roof facet overlays.

### Hour 10 - Google 3D Tiles in three.js

- Install `@googlemaps/three` or use Cesium (3D Tiles is easier with Cesium for hackathon speed)
- Create scene that loads 3D tiles centered on the property's lat/lng
- Set initial camera angle to look down at ~45 degrees on the roof
- Test with one demo address; verify the actual house renders

**Milestone check:** Right pane of UI shows a recognizable 3D model of the actual property entered.

### Hour 11 - Facet Polygon Overlays

- For each Solar API roof segment, create a three.js plane geometry
- Position each plane at the segment's polygon coordinates, angled by the pitch
- Color them semi-transparent (e.g., gray, 50% opacity) so the 3D house shows through
- Render on top of the Google 3D tiles

**Milestone check:** 3D model of house shows with translucent colored planes overlaid where each roof facet is.

### Hour 12 - Facet Interaction

- Add raycaster for click detection on facet planes
- On click, cycle through three states: leave (gray), repair (yellow), replace (red)
- Update plane material color per state
- Hover effect: lighten the plane and show tooltip with facet info (area, pitch)
- Maintain selection state in React state, sync to backend

**Milestone check:** Click a facet on the 3D model, watch it turn red. Click again, yellow. Click again, gray.

### Hour 13 - Live Estimate Updates

- When facet selection changes, recalculate estimate with the subset of selected facets
- Logic: replace = full cost, repair = ~40% of replace cost for that facet's portion, leave = $0 for that area
- Sum proportional materials, accessories, tear-off, labor for selected facets only
- Push updated breakdown to UI sidebar
- Animate the total cost number changing (use a smooth count-up)

**Milestone check:** Click facets to toggle, watch the total estimate update live in the sidebar. This is the "wow" moment of the demo.

---

## Phase 4: AI Features + Polish (Hours 14-17)

**By end of Hour 17:** Conversational refinement works. Plain-English explanations populate. Tier 2 verification simulation works. View toggle works.

### Hour 14 - Conversational Refinement (Chat Sidebar)

- Add a chat sidebar with input box and message history
- Wire up `POST /api/chat` endpoint
- Backend: send the current estimate payload + conversation history + user message to Claude with a prompt: "You are an AI roofing assistant. Here's the current estimate. The user asked: {message}. Respond conversationally, and if your response should change the estimate, return a structured action JSON."
- Parse Claude response; if it includes `{action: "update_material", to: "metal"}`, apply it and recalculate
- Display Claude's text response in the chat

**Milestone check:** Type "what if we used metal?", watch Claude respond AND the estimate update with new material costs.

### Hour 15 - Plain-English Explanation + Confidence Visualization

- Add "Explain this estimate" button below the breakdown
- On click, send full payload to Claude with prompt: "Explain this roofing estimate to a homeowner in 3-4 sentences. Highlight the key cost drivers and why this number is reasonable for this specific property."
- Display response in a card
- Build the confidence visualization: small badges showing each input source ("Pitch: measured ✓", "Material: AI-detected 94%", "Layers: assumed 1", "Pricing: SLC, fresh")
- Click any badge to see what changes if that assumption is wrong

**Milestone check:** Click "Explain", see Claude's friendly explanation. Click confidence badges, see contextual detail.

### Hour 16 - Tier 2 Verification Simulation

- After Tier 1 completes, start a 90-second timer in the backend
- After 90 seconds, swap in pre-prepared "verified" mock data for the demo property (slightly different facet polygons, refined linear measurements, tighter confidence)
- Push update to frontend via websocket OR polling (polling is simpler for hackathon)
- Frontend shows "Verifying measurements..." badge initially
- On swap: animate badge to "Measurements verified", animate confidence range tightening, subtly redraw any facets whose polygons changed
- Map old facet selections to new facets by centroid proximity (handle edge cases by keeping selections sticky)

**Milestone check:** Start an estimate, work on it for 90 seconds, watch the "Measurements verified" moment trigger and confidence visibly improve.

### Hour 17 - View Toggle + JobNimbus Mock

- Add a toggle in the top right: "Contractor view" / "Homeowner view"
- Homeowner view: hide labor/margin breakdown, show big-picture range, highlight financing, friendlier copy, the AI-generated explanation prominent
- Contractor view: full takeoff details, line items, margin assumptions, JobNimbus button visible
- "Send to JobNimbus" button: fake POST that returns success after 1 second, show confirmation modal "Estimate sent to JobNimbus deal #1234"
- If JobNimbus sandbox access is available, wire up the real call

**Milestone check:** Toggle between views, both look polished. Send to JobNimbus button works.

---

## Phase 5: Demo Prep (Hours 18-20)

**By end of Hour 20:** Demo is rehearsed, scripted, and bug-free. Two backup demo addresses ready.

### Hour 18 - One Bonus Feature (Pick One)

Pick the highest-leverage bonus feature based on remaining time and energy:

- **Photorealistic material preview** (best wow): swap shingle texture on facet planes when material changes; show "your home with metal roof" preview
- **Damage detection from photos**: file upload component, send to Claude vision, display detected issues mapped to roof location
- **Three-tier estimate cards**: Budget/Standard/Premium side-by-side
- **AI proposal PDF**: one-click generate a polished customer-facing PDF

**Pick exactly one.** Don't try to ship two and end up with neither working.

**Milestone check:** Bonus feature works on the primary demo address.

### Hour 19 - Polish + Bug Fixing

- Run through the demo flow start to finish 3 times
- Fix anything that breaks, looks janky, or feels slow
- Verify it works on at least 2 different addresses (in case primary fails on demo day)
- Pre-cache the 3D tiles for those addresses if possible (load them once before demo so they're warm)
- Ensure error states have friendly fallbacks ("Solar API doesn't have coverage here, here's an estimate based on AI analysis only")
- Make sure all numbers are realistic and self-consistent

**Milestone check:** End-to-end demo runs in under 4 minutes with zero glitches on 2 different addresses.

### Hour 20 - Demo Script + Pitch

- Write a 4-minute demo script with timestamps:
  - 0:00-0:30 The problem (existing tools are slow, expensive, locked behind enterprise APIs)
  - 0:30-1:00 Type address, watch instant ballpark generate
  - 1:00-1:45 Click facets in 3D, show live estimate updates
  - 1:45-2:30 Conversational refinement (the "what if metal" moment)
  - 2:30-3:00 The "Measurements verified" moment + confidence visualization
  - 3:00-3:30 View toggle to homeowner mode + Send to JobNimbus
  - 3:30-4:00 The architecture story: 3 APIs, real AI doing real work, pennies per estimate
- Practice the script out loud 3 times
- Prepare for likely judge questions: "How accurate is this?", "What about EagleView?", "How does it scale?", "What's the biz model?"

**Milestone check:** You can deliver the pitch confidently with the demo running. You have answers ready for predictable questions.

\newpage

# Risk Mitigation

## Primary Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Google Solar API has no coverage for chosen demo address | Medium | Test 5 SLC addresses in Hour 1; pick 2 confirmed working |
| 3D tiles don't load for chosen address | Medium | Same as above; verify in Hour 10 |
| Claude vision returns inconsistent JSON | Low | Use structured output mode; have a fallback parser |
| Linear measurement derivation is harder than expected | High | If Hour 6 runs over, fall back to shape-based ratios from a lookup table |
| 3D facet overlays don't align with the actual roof | Medium | Acceptable for demo; explain as "AI extraction with human verification step" |
| EagleView/JobNimbus API access doesn't materialize | High | Both are mocked in this plan, no risk to demo |
| Live demo glitches | Always | Record a backup video at end of Hour 20 |

## Cut Glide Path

If you fall behind, cut features in this order (lowest priority first):

1. Bonus feature (Hour 18)
2. Tier 2 verification simulation (Hour 16) — the demo still works without it, just no "verified" moment
3. View toggle (Hour 17 partial) — keep contractor view only
4. Plain-English explanation (Hour 15 partial) — confidence badges alone are fine
5. Conversational refinement (Hour 14) — the demo loses an AI feature but core still works

**Do not cut from the foundation phases (Hours 1-13).** Those are non-negotiable for any working demo.

\newpage

# Quick Reference: API Endpoints Cheat Sheet

## Google Solar API

```
GET https://solar.googleapis.com/v1/buildingInsights:findClosest
   ?location.latitude={lat}
   &location.longitude={lng}
   &requiredQuality=HIGH
   &key={API_KEY}
```

Returns: `solarPotential.roofSegmentStats[]` with pitchDegrees, azimuthDegrees, planeHeightAtCenterMeters, stats.areaMeters2, boundingBox.

## Google Maps Static API

```
GET https://maps.googleapis.com/maps/api/staticmap
   ?center={lat},{lng}
   &zoom=20
   &size=800x800
   &maptype=satellite
   &key={API_KEY}
```

Returns: PNG image of the property top-down.

## Google 3D Tiles

```
Endpoint: https://tile.googleapis.com/v1/3dtiles/root.json?key={API_KEY}
```

Use with Cesium or three.js Google 3D Tiles loader. See Google's docs for camera positioning.

## Claude Vision (via Anthropic SDK)

```javascript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: [
      { type: "image", source: { type: "url", url: imageUrl } },
      { type: "text", text: ROOF_ANALYSIS_PROMPT }
    ]
  }]
});
```

## Claude Chat (for refinement)

Same SDK, text-only messages, include conversation history + estimate context in system prompt.

\newpage

# Definition of Done

The project is "demo ready" when all of these are true:

- Address autocomplete works for any US address
- Pipeline produces an estimate in under 10 seconds for a known SLC address
- 3D model loads and shows the actual property
- Roof facets are clickable and change color
- Estimate updates live as facets change
- Chat sidebar accepts questions and responds with relevant updates
- "Measurements verified" simulation triggers around 90 seconds in
- Confidence visualization shows data sources clearly
- View toggle switches between contractor and homeowner modes
- Send to JobNimbus shows a success state
- The demo runs end-to-end without manual recovery on 2+ addresses
- A backup demo video exists in case live demo fails
- The 4-minute pitch is rehearsed and delivered confidently

If all of the above are true by Hour 20, you're ready. Anything beyond is bonus.
