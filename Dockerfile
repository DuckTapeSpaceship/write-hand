# Write-Hand: a static site. Stage 1 tests and builds it; stage 2 serves the
# files with Caddy. No app server, no endpoints that accept data: all font
# building happens in the visitor's browser.

# --- Stage 1: test + build ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# manage.fish passes `git describe` (shown in the footer).
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
# Failing unit/integration tests stop the image build.
RUN npm test && npm run build          # -> /app/dist

# --- Stage 2: static file server ---
FROM caddy:2-alpine
# The stock binary carries cap_net_bind_service as a file capability, which the
# kernel refuses to exec under no-new-privileges + cap_drop ALL. We listen on
# 8080 and don't need it: a plain copy drops the xattr.
RUN cp /usr/bin/caddy /usr/bin/caddy.nocap && mv /usr/bin/caddy.nocap /usr/bin/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
# Runs as an unprivileged user; Caddy's runtime dirs point at /tmp (a tmpfs
# when the root filesystem is read-only, see docker-compose.yml).
ENV XDG_CONFIG_HOME=/tmp/caddy/config XDG_DATA_HOME=/tmp/caddy/data
USER 65532:65532
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
