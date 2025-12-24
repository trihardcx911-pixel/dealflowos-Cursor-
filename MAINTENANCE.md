# Maintenance Notes

## Canonical layout
- Backend lives at the repo root (`src/`, `prisma/`, `scripts/`, `package.json`). Use this backend when wiring up API services or Docker builds.
- Frontend lives exclusively in `web/` (Vite + React). Treat it as the only supported SPA.

## Legacy / duplicated artifacts
- `server/`: legacy Node backend kept from earlier iterations. **TODO:** audit endpoints/config before removing or merging into the canonical backend.
- `dealflow-frontend/`: older frontend experiment. **TODO:** confirm no flows still rely on this bundle before archival.
- `dist/` (root) and `dealflow-frontend/dist`: previously generated assets. **TODO:** delete only after the teams above confirm they are not referenced by deployments or docs.

Until the TODOs above are resolved, keep these folders but avoid editing them to reduce confusion about the active stack.






