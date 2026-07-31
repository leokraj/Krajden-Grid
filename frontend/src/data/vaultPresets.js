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

export const DEFAULT_VAULT_BATTLEMAPS = [
  {
    "id": "preset_map_catacombs_001",
    "name": "Catacombs 0001",
    "theme": "Dungeon",
    "url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgODAwIDYwMCI+CiAgPGRlZnM+CiAgICA8cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHBhdGggZD0iTSA1MCAwIEwgMCAwIDAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMxZTFiMTgiLz4KICAgICAgICA8ZyBvcGFjaXR5PSIwLjE1Ij4KICAgICAgICAgIDxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMzODMxMmIiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgICAgICAgICA8cmVjdCB4PSI0NTAiIHk9IjEwMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMyZDI3MjIiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgICAgICAgICA8cmVjdCB4PSIyMDAiIHk9IjMwMCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyNTAiIGZpbGw9IiMzODMxMmIiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgICAgICAgPC9nPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2dyaWQpIi8+CiAgPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjM2IiByeD0iNiIgZmlsbD0iIzAwMDAwMCIgb3BhY2l0eT0iMC43NSIgc3Ryb2tlPSIjZjU5ZTBiIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDx0ZXh0IHg9IjMyIiB5PSI0MyIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmZmZmYiIGxldHRlci1zcGFjaW5nPSIxIj5DQVRBQ09NQlMgMDAwMTwvdGV4dD4KPC9zdmc+",
    "description": "Tactical Dungeon Catacombs Map",
    "created_at": "2026-07-29T18:00:00.000Z",
    "isVault": true
  },
  {
    "id": "preset_map_cavern_001",
    "name": "Cavern River 0001",
    "theme": "Cavern",
    "url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgODAwIDYwMCI+CiAgPGRlZnM+CiAgICA8cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHBhdGggZD0iTSA1MCAwIEwgMCAwIDAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMwZjE3MmEiLz4KICAgICAgICA8cGF0aCBkPSJNIDEwMCAwIFEgMjAwIDE1MCAxNTAgMzAwIFQgMjUwIDYwMCIgc3Ryb2tlPSIjMDI4NGM3IiBzdHJva2Utd2lkdGg9IjYwIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjYiLz4KICAgICAgICA8cGF0aCBkPSJNIDAgMjAwIFEgMzAwIDI1MCA1MDAgMjAwIFQgODAwIDM1MCIgc3Ryb2tlPSIjMDM2OWExIiBzdHJva2Utd2lkdGg9IjQwIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0idXJsKCNncmlkKSIvPgogIDxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjIyMCIgaGVpZ2h0PSIzNiIgcng9IjYiIGZpbGw9IiMwMDAwMDAiIG9wYWNpdHk9IjAuNzUiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8dGV4dCB4PSIzMiIgeT0iNDMiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmZmZmIiBsZXR0ZXItc3BhY2luZz0iMSI+Q0FWRVJOIFJJVkVSIDAwMDE8L3RleHQ+Cjwvc3ZnPg==",
    "description": "Subterranean Cavern & River Map",
    "created_at": "2026-07-29T18:00:00.000Z",
    "isVault": true
  },
  {
    "id": "preset_map_docks_001",
    "name": "Docks 0001",
    "theme": "Urban",
    "url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgODAwIDYwMCI+CiAgPGRlZnM+CiAgICA8cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHBhdGggZD0iTSA1MCAwIEwgMCAwIDAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY3ZThmOSIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMwYzRhNmUiLz4KICAgICAgICA8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzc4MzUwZiIgb3BhY2l0eT0iMC44Ii8+CiAgICAgICAgPHJlY3QgeD0iMjgwIiB5PSIxNTAiIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAiIGZpbGw9IiM5MjQwMGUiIG9wYWNpdHk9IjAuOSIvPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2dyaWQpIi8+CiAgPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjM2IiByeD0iNiIgZmlsbD0iIzAwMDAwMCIgb3BhY2l0eT0iMC43NSIgc3Ryb2tlPSIjZmJiZjI0IiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDx0ZXh0IHg9IjMyIiB5PSI0MyIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmZmZmYiIGxldHRlci1zcGFjaW5nPSIxIj5ET0NLUyAwMDAxPC90ZXh0Pgo8L3N2Zz4=",
    "description": "Waterfront Harbor & Wooden Pier Map",
    "created_at": "2026-07-29T18:00:00.000Z",
    "isVault": true
  },
  {
    "id": "preset_map_forest_001",
    "name": "Forest Crossing 0001",
    "theme": "Wilderness",
    "url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgODAwIDYwMCI+CiAgPGRlZnM+CiAgICA8cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHBhdGggZD0iTSA1MCAwIEwgMCAwIDAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzg2ZWZhYyIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMxNDUzMmQiLz4KICAgICAgICA8cGF0aCBkPSJNIDAgMzAwIFEgNDAwIDIwMCA4MDAgMzAwIiBzdHJva2U9IiM3ODM1MGYiIHN0cm9rZS13aWR0aD0iNTAiIGZpbGw9Im5vbmUiIG9wYWNpdHk9IjAuNyIvPgogICAgICAgIDxjaXJjbGUgY3g9IjE1MCIgY3k9IjE1MCIgcj0iNzAiIGZpbGw9IiMxNjY1MzQiIG9wYWNpdHk9IjAuOCIvPgogICAgICAgIDxjaXJjbGUgY3g9IjY1MCIgY3k9IjQ1MCIgcj0iOTAiIGZpbGw9IiMxNjY1MzQiIG9wYWNpdHk9IjAuOCIvPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2dyaWQpIi8+CiAgPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjM2IiByeD0iNiIgZmlsbD0iIzAwMDAwMCIgb3BhY2l0eT0iMC43NSIgc3Ryb2tlPSIjNGFkZTgwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDx0ZXh0IHg9IjMyIiB5PSI0MyIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmZmZmYiIGxldHRlci1zcGFjaW5nPSIxIj5GT1JFU1QgQ1JPU1NJTkcgMDAwMTwvdGV4dD4KPC9zdmc+",
    "description": "Lush Woodland Dirt Path Battle Map",
    "created_at": "2026-07-29T18:00:00.000Z",
    "isVault": true
  },
  {
    "id": "preset_map_tavern_001",
    "name": "Tavern Hall 0001",
    "theme": "Urban",
    "url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgODAwIDYwMCI+CiAgPGRlZnM+CiAgICA8cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHBhdGggZD0iTSA1MCAwIEwgMCAwIDAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZkZTA0NyIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiM0NTFhMDMiLz4KICAgICAgICA8cmVjdCB4PSI1MCIgeT0iNTAiIHdpZHRoPSI3MDAiIGhlaWdodD0iNTAwIiBmaWxsPSIjNzgzNTBmIiBzdHJva2U9IiMyNzI3MmEiIHN0cm9rZS13aWR0aD0iOCIvPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2dyaWQpIi8+CiAgPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjM2IiByeD0iNiIgZmlsbD0iIzAwMDAwMCIgb3BhY2l0eT0iMC43NSIgc3Ryb2tlPSIjZjU5ZTBiIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDx0ZXh0IHg9IjMyIiB5PSI0MyIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmZmZmYiIGxldHRlci1zcGFjaW5nPSIxIj5UQVZFUk4gSEFMTCAwMDAxPC90ZXh0Pgo8L3N2Zz4=",
    "description": "Warm Oak Tavern & Hearth Map",
    "created_at": "2026-07-29T18:00:00.000Z",
    "isVault": true
  },
  {
    "id": "preset_map_lava_001",
    "name": "Lava Chasm 0001",
    "theme": "Dungeon",
    "url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgODAwIDYwMCI+CiAgPGRlZnM+CiAgICA8cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHBhdGggZD0iTSA1MCAwIEwgMCAwIDAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y4NzE3MSIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMxODE4MWIiLz4KICAgICAgICA8cGF0aCBkPSJNIDAgMTAwIFEgMzAwIDQwMCA4MDAgMjAwIiBzdHJva2U9IiNkYzI2MjYiIHN0cm9rZS13aWR0aD0iODAiIGZpbGw9Im5vbmUiIG9wYWNpdHk9IjAuOCIvPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2dyaWQpIi8+CiAgPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjM2IiByeD0iNiIgZmlsbD0iIzAwMDAwMCIgb3BhY2l0eT0iMC43NSIgc3Ryb2tlPSIjZWY0NDQ0IiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDx0ZXh0IHg9IjMyIiB5PSI0MyIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmZmZmYiIGxldHRlci1zcGFjaW5nPSIxIj5MQVZBIENIQVNNIDAwMDE8L3RleHQ+Cjwvc3ZnPg==",
    "description": "Volcanic Obsidian & Lava Chasm Map",
    "created_at": "2026-07-29T18:00:00.000Z",
    "isVault": true
  }
];
