// =============================================================================
// VAULT PRESETS — PROTECTED FILE
// =============================================================================
// DO NOT overwrite DEFAULT_VAULT_CLIPARTS with /uploads/cliparts/... file paths.
// Those files are stored on the server filesystem and are wiped on every redeploy.
// Vault cliparts must be base64 data URLs (data:image/...) to survive redeployments.
//
// HOW THE VAULT WORKS:
//   - DEFAULT_VAULT_CLIPARTS below = hardcoded fallback (SVG base64 only)
//   - Admin uploads via the Admin panel → stored in MongoDB as base64 → served via /api/library/cliparts
//   - The ClipartLibrary component fetches /api/library/cliparts at runtime and merges with this fallback
//   - Never write /uploads/cliparts/... paths into this file — they will 404 after redeploy
//
// TO ADD PERMANENT VAULT ITEMS: use the Admin panel in the running app.
// The admin panel stores items in MongoDB as base64 — they persist across deploys.
// =============================================================================

export const DEFAULT_VAULT_CLIPARTS = [];

// Effect vault — video/GIF effects for the Effects drawing tool
// Add entries here as base64 data URLs or stable external URLs (not /uploads/...)
export const DEFAULT_VAULT_EFFECTS = [];

export const DEFAULT_VAULT_BATTLEMAPS = [];
