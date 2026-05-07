export const CS2_MAPS = [
  "de_mirage",
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_ancient",
  "de_anubis", 
  "de_overpass",
  "de_cache",
  "de_train" 
];

// ```
// Adding a map later = one line. That's it.

// **Pages needed:**
// ```
// /match/create          ← pick game
// /match/create/cs2      ← pick mode + map
// /match/[id]            ← ready up → creating → ready → connect info
// ```

// **API routes needed:**
// ```
// POST /api/matches      ← creates match + spins up server
// GET  /api/matches/[id] ← polls match status
// ```

// **The flow:**
// ```
// User fills form → POST /api/matches
// → Match created as "pending" in DB
// → Redirect to /match/[id]
// → Page polls GET /api/matches/[id] every 3 seconds
// → When status = "live" → show connect info