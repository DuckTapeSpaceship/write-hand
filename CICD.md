# Write-Hand: Build & Deployment

How a code change becomes the site on the public hostname. Two machines:

- **Dev box** (where you write code and run `./manage.fish`).
- **Web box** (runs Docker, the host Caddy and cloudflared; pulls the image and runs it).

**There is no CI and no runner.** Build, push, deploy and the local image test all go through one interactive script, **`./manage.fish`**, the single source of truth. It is registry- and host-agnostic (config in `deploy.conf`). "Push also builds the image" is menu **6, Ship**: `git push` → build & push → deploy.

```
  dev box ──./manage.fish 1 (build & push)──▶  git.ducktapespaceship.xyz/arun/write-hand
           (tests run inside docker build)        :latest  :<sha>  :vX.Y (on a tag)
                                                     │  ./manage.fish 5: compose pull + up -d
                                                     ▼
  internet ─▶ Cloudflare ─▶ cloudflared ─▶ host Caddy :80 ─▶ 127.0.0.1:8340 ─▶ container :8080
                                                                (Caddy, static files only)
```

**Still serverless.** The container only serves the built static files. There is no app server, no endpoint that accepts data and no upload: all font building happens in the visitor's browser, and drawings live in their IndexedDB. Docker only changes how the files are shipped.

---

## 0. The files that make it work

`manage.fish` (the driver) + `deploy.conf` (its config) + `Dockerfile` + `docker/Caddyfile` + `docker-compose.yml` (+ `.dockerignore`).

### `Dockerfile` (multi-stage)
- **Stage 1** (`node:22-slim`): `npm ci`, then `npm test && npm run build`, so **failing unit/integration tests stop the image build**. `APP_VERSION` comes in as a build arg (`git describe`) and shows in the footer.
- **Stage 2** (`caddy:2-alpine`): copies `dist/` to `/srv` and runs as UID 65532. The stock Caddy binary carries a `cap_net_bind_service` file capability, which the kernel refuses to exec under `no-new-privileges` with every capability dropped. The image copies the binary without it and listens on unprivileged **:8080**.

### `docker/Caddyfile`
- `file_server` from `/srv`, `encode zstd gzip`, SPA fallback to `index.html`.
- `/assets/*` (hashed): `Cache-Control: public, max-age=31536000, immutable`.
- `/`, `index.html`, `sw.js`, `registerSW.js`, `workbox-*.js`, `manifest.webmanifest`, `theme.js`: `no-cache`, so updates and the service worker land at once (Cloudflare respects it).
- `GET /healthz` → `200 ok`.
- Security headers, and a strict **Content-Security-Policy** for the page: scripts only from self plus `wasm-unsafe-eval` for HarfBuzz, no inline scripts. The WOFF2 encoder's worker (`/assets/woff2.worker-*.js`) gets its own narrower policy that allows `unsafe-eval`, because Emscripten's embind needs it. Workers take their CSP from their own script's response, so the page itself never allows eval.

### `docker-compose.yml`
`image: ${IMAGE_REF:-git.ducktapespaceship.xyz/arun/write-hand}:${IMAGE_TAG:-latest}`, `restart: unless-stopped`, published on `${BIND:-127.0.0.1}:${PORT:-8340}` → 8080 (localhost only: the host Caddy is the front door). Hardening: `read_only: true`, `user: 65532:65532`, `cap_drop: [ALL]`, `no-new-privileges`, a small tmpfs at `/tmp` for Caddy's runtime dirs. Healthcheck: `wget -qO- http://127.0.0.1:8080/healthz`. **No volumes** and no `.env`: there is no server-side state and there are no secrets.

### `deploy.conf` (gitignored; template `deploy.conf.example`)
Plain fish `set -gx KEY value` lines: `REGISTRY`, `IMAGE_OWNER`, `IMAGE_NAME`, `IMAGE_TAG` (`latest`), `DEPLOY_HOST` (the web box), `DEPLOY_DIR`, `PORT` (8340).

---

## 1. One-time setup

1. **Dev box:** `./manage.fish 4` (or copy `deploy.conf.example` → `deploy.conf`) and set the registry, `DEPLOY_HOST` (SSH target of the web box) and `DEPLOY_DIR`.
2. **Registry login (dev box):** `./manage.fish 8` (`docker login git.ducktapespaceship.xyz` with a Forgejo token that has package **write**).
3. **Web box:** Docker + the compose plugin, and a registry login with a token that has package **read**:
   ```bash
   docker login git.ducktapespaceship.xyz
   ```
   `./manage.fish 5` creates `DEPLOY_DIR` and copies `docker-compose.yml` on every deploy.
4. **Host Caddy** (on the web box) proxies the hostname to the container. TLS terminates at Cloudflare, so this site block is plain HTTP:
   ```caddyfile
   http://write-hand.example.com {
   	reverse_proxy 127.0.0.1:8340
   }
   ```
5. **cloudflared ingress** points the hostname at the host Caddy (`/etc/cloudflared/config.yml`, then `sudo systemctl restart cloudflared`):
   ```yaml
   ingress:
     - hostname: write-hand.example.com
       service: http://localhost:80
     # … other hostnames …
     - service: http_status:404
   ```
   Add the hostname as a CNAME to the tunnel (`cloudflared tunnel route dns <tunnel> write-hand.example.com`). Replace `write-hand.example.com` with the real hostname in both places.

---

## 2. The developer loop: `./manage.fish`

```bash
cd ~/Projects/write-hand
./manage.fish            # interactive menu
./manage.fish 3          # or run an item directly
```

| # | Action |
|---|--------|
| 1 | **Build & push** the image (`:latest` + `:<git-sha>`, plus `:vX.Y` when HEAD is on a `v*` tag). Tests run inside the build. |
| 2 | **Local dev**: `npm run dev` (the lab is at `/lab/`). |
| 3 | **Local image test**: build, run it via the real `docker-compose.yml` on `:8340`, then check `/healthz`, `no-cache` on `/` and `sw.js`, `immutable` on an asset, the CSP, and that the container is read-only, non-root and has all capabilities dropped. |
| 4 | Set **DEPLOY** config (`deploy.conf`). |
| 5 | **Deploy**: copy `docker-compose.yml` over SSH, then `docker compose pull && up -d`. |
| 6 | **Ship**: `git push` (branch and tags) → build & push → deploy. |
| 7 | Tail **remote logs**. |
| 8 | **Registry login**. |
| 9 | **Status**: config, local images, remote `compose ps`. |

Menu 1 builds whatever is in the working tree (it warns about uncommitted changes), so the box can briefly run uncommitted code.

After menu 3, the whole e2e suite can run against the built image (CSP, service worker and Caddy headers included):

```bash
PW_BASE_URL=http://127.0.0.1:8340 npm run e2e
docker compose -p write-hand-local down
```

## 2b. Cutting a release (vX.Y)

1. Commit on `main`, then `git tag -a vX.Y -m "vX.Y"`.
2. `./manage.fish 6` (Ship): pushes `main` and the tag, builds with HEAD on the tag (so `:vX.Y` is pushed as well as `:latest` and `:<sha>`), and deploys `IMAGE_TAG` from `deploy.conf` (`latest`).
3. To pin the box to a release instead, set `IMAGE_TAG` in `deploy.conf` to `vX.Y` and run `./manage.fish 5`.

---

## 3. Health checks

```bash
curl -s  https://write-hand.example.com/healthz            # ok
curl -sI https://write-hand.example.com/ | grep -i cache    # cache-control: no-cache
ssh <web box> 'cd ~/Applications/write-hand && docker compose ps'   # (healthy)
```

## 4. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| Container restarts with `exec /usr/bin/caddy: operation not permitted` | A Caddy binary that still has its file capability. The Dockerfile strips it; rebuild rather than running a stock `caddy` image with this compose file. |
| `docker push` → 403/denied | Not logged in, or the token lacks package write → `./manage.fish 8`. |
| `compose pull` → not found/denied | The web box isn't logged in → `docker login git.ducktapespaceship.xyz`. |
| Deployed but browsers show the old version | The service worker updates in the background and offers **Reload** in a toast. Check that `sw.js` and `/` return `Cache-Control: no-cache`. |
| WOFF2 export does nothing | Its worker's CSP. `curl -sI .../assets/woff2.worker-*.js` must show the worker policy with `'unsafe-eval'`. A proxy that overwrites CSP headers breaks it. |
| 502 from the hostname | The container isn't listening on `127.0.0.1:${PORT}` → `./manage.fish 9`, then `docker compose logs`. |
| WebKit e2e won't start locally | Arch/CachyOS lacks Ubuntu's libicu/libxml2/libflite. Use `npm run e2e` (the Playwright Docker image). |
