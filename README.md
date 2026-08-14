# Krajden Grid

## Local vault testing setup

The server reads vault assets from `<UPLOADS_DIR>/vault` (`tokens`, `maps`, `effects`).

By default, `UPLOADS_DIR` is `uploads` in the repository root.  
To use a local test vault folder instead, set `UPLOADS_DIR` before starting the app:

- Example target folder: `/home/runner/work/Krajden-Grid/Krajden-Grid/test-data`
- Expected vault structure under it:
  - `vault/tokens`
  - `vault/maps`
  - `vault/effects`

Run with env var:

```bash
UPLOADS_DIR=/home/runner/work/Krajden-Grid/Krajden-Grid/test-data npm run dev
```
