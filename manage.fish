#!/usr/bin/env fish
#
# Write-Hand: interactive build / deploy management.
#
# The single source of truth for building, testing, shipping and deploying.
# There is no CI and no runner: "push also builds the image" is menu 6, which
# pushes git, then builds + pushes the image, then deploys. Registry- and
# host-agnostic: only deploy.conf changes. (Adapted from Isai's manage.fish.)
#
#   ./manage.fish            # interactive menu
#   ./manage.fish <n>        # run menu item <n> directly
#
# Config lives in ./deploy.conf (gitignored). First run creates it from
# deploy.conf.example. The app has no secrets.

set -g ROOT (realpath (dirname (status filename)))
set -g CONF "$ROOT/deploy.conf"
set -g LOCAL_IMAGE "write-hand-local"

# ---- pretty output -----------------------------------------------------------
function _hd;   set_color -o cyan; echo "▶ $argv"; set_color normal; end
function _ok;   set_color -o green; echo "✓ $argv"; set_color normal; end
function _warn; set_color -o yellow; echo "! $argv"; set_color normal; end
function _err;  set_color -o red; echo "✗ $argv"; set_color normal; end

# ---- config ------------------------------------------------------------------
function load_conf
    if not test -f "$CONF"
        _warn "No deploy.conf — creating from deploy.conf.example"
        cp "$ROOT/deploy.conf.example" "$CONF"
        _warn "Edit it (menu 4) before deploying."
    end
    # deploy.conf is plain `set -gx KEY value` fish lines.
    source "$CONF"
    set -q REGISTRY;    or set -gx REGISTRY git.ducktapespaceship.xyz
    set -q IMAGE_NAME;  or set -gx IMAGE_NAME write-hand
    set -q IMAGE_TAG;   or set -gx IMAGE_TAG latest
    set -q PORT;        or set -gx PORT 8340
end

function image_ref
    # registry/owner/name  (owner optional for some registries)
    if test -n "$IMAGE_OWNER"
        echo "$REGISTRY/$IMAGE_OWNER/$IMAGE_NAME"
    else
        echo "$REGISTRY/$IMAGE_NAME"
    end
end

function git_tag
    git -C "$ROOT" rev-parse --short HEAD 2>/dev/null; or echo manual
end

function app_version
    git -C "$ROOT" describe --tags --always --dirty 2>/dev/null; or git_tag
end

function require_docker
    if not command -q docker
        _err "docker not found on PATH"; return 1
    end
    if not docker info >/dev/null 2>&1
        _err "docker daemon not running (try: sudo systemctl start docker)"; return 1
    end
end

# ---- actions -----------------------------------------------------------------

# 1) Build the image and push it to the configured registry.
function do_build_push
    require_docker; or return 1
    set -l ref (image_ref)
    set -l sha (git_tag)
    if test -n "$(git -C "$ROOT" status --porcelain)"
        _warn "Working tree has uncommitted changes — they will be in the image"
    end
    # A build of a release commit (HEAD exactly on a vX.Y tag) is pushed under
    # that version too, so deploys can pin it.
    set -l ver (git -C "$ROOT" describe --tags --exact-match --match 'v*' 2>/dev/null)
    set -l also ""
    test -n "$ver"; and set also " and :$ver"
    _hd "Building $ref:latest and :$sha$also (tests run inside the build)"
    docker build --build-arg APP_VERSION=(app_version) -t "$ref:latest" -t "$ref:$sha" "$ROOT"; or begin; _err "build failed"; return 1; end
    test -n "$ver"; and docker tag "$ref:$sha" "$ref:$ver"
    _hd "Pushing to $REGISTRY"
    docker push "$ref:latest"; and docker push "$ref:$sha"; and begin; test -z "$ver"; or docker push "$ref:$ver"; end
    or begin; _err "push failed — are you logged in? (menu 8)"; return 1; end
    _ok "Pushed $ref:latest and :$sha$also"
end

# 2) Local dev server (Vite).
function do_local_dev
    command -q npm; or begin; _err "npm not found"; return 1; end
    test -d "$ROOT/node_modules"; or npm --prefix "$ROOT" ci
    _hd "Dev server: http://localhost:5173  (engine/pen lab: /lab/)  Ctrl-C to stop"
    npm --prefix "$ROOT" run dev
end

# 3) Local image test: build, run with the real compose hardening, check it.
function do_local_image
    require_docker; or return 1
    _hd "Building $LOCAL_IMAGE:test"
    docker build --build-arg APP_VERSION=(app_version) -t "$LOCAL_IMAGE:test" "$ROOT"; or begin; _err "build failed"; return 1; end
    _hd "Starting via docker-compose.yml on http://127.0.0.1:$PORT"
    env IMAGE_REF=$LOCAL_IMAGE IMAGE_TAG=test PORT=$PORT docker compose -f "$ROOT/docker-compose.yml" -p write-hand-local up -d --force-recreate
    or begin; _err "compose up failed"; return 1; end

    set -l base "http://127.0.0.1:$PORT"
    for i in (seq 20)
        curl -fs "$base/healthz" >/dev/null 2>&1; and break
        sleep 0.5
    end
    set -l fails 0
    _check "GET /healthz → 200" (curl -s -o /dev/null -w '%{http_code}' "$base/healthz") "200"; or set fails (math $fails + 1)
    _check_hdr "/ is no-cache" "$base/" "cache-control: no-cache"; or set fails (math $fails + 1)
    _check_hdr "/sw.js is no-cache" "$base/sw.js" "cache-control: no-cache"; or set fails (math $fails + 1)
    set -l asset (curl -s "$base/" | string match -r '/assets/index-[^"]+\.js')
    _check_hdr "$asset is immutable" "$base$asset" "immutable"; or set fails (math $fails + 1)
    _check_hdr "CSP is set" "$base/" "content-security-policy: default-src 'self'"; or set fails (math $fails + 1)
    _check "missing asset → 404" (curl -s -o /dev/null -w '%{http_code}' "$base/assets/missing-0000.js") "404"; or set fails (math $fails + 1)
    _check_hdr "$asset served precompressed" "$base$asset" "content-encoding: br"; or set fails (math $fails + 1)
    set -l cid (docker compose -p write-hand-local ps -q write-hand)
    _check "container is read-only" (docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' $cid) "true"; or set fails (math $fails + 1)
    _check "container is non-root" (docker inspect -f '{{.Config.User}}' $cid) "65532:65532"; or set fails (math $fails + 1)
    _check "all capabilities dropped" (docker inspect -f '{{.HostConfig.CapDrop}}' $cid) "[ALL]"; or set fails (math $fails + 1)
    if test $fails -eq 0
        _ok "Image looks good: $base  (stop with: docker compose -p write-hand-local down)"
    else
        _err "$fails check(s) failed"; return 1
    end
end

function _check
    if test "$argv[2]" = "$argv[3]"
        _ok "$argv[1]"
    else
        _err "$argv[1] (got '$argv[2]')"; return 1
    end
end

function _check_hdr
    if curl -sI -H "Accept-Encoding: br, gzip" "$argv[2]" | string lower | string match -q "*"(string lower -- "$argv[3]")"*"
        _ok "$argv[1]"
    else
        _err "$argv[1] — header '$argv[3]' missing on $argv[2]"; return 1
    end
end

# 4) Set DEPLOY config (registry/host/dir/tag/port) in deploy.conf.
function do_set_deploy_conf
    _hd "Deploy config ($CONF)"
    echo "  1) Open in \$EDITOR"
    echo "  2) Guided prompts"
    read -P "choose: " c
    switch $c
        case 1
            eval (set -q EDITOR; and echo $EDITOR; or echo nano) "$CONF"
        case 2
            _conf_prompt REGISTRY "Registry (e.g. git.ducktapespaceship.xyz, ghcr.io)"
            _conf_prompt IMAGE_OWNER "Image owner/namespace (lowercase; blank if none)"
            _conf_prompt IMAGE_NAME "Image name"
            _conf_prompt IMAGE_TAG "Tag to deploy"
            _conf_prompt DEPLOY_HOST "Deploy SSH target (user@host)"
            _conf_prompt DEPLOY_DIR "Compose dir on deploy host"
            _conf_prompt PORT "Host port the host Caddy proxies to"
            _ok "Saved $CONF"
    end
    load_conf
end

function _conf_prompt
    set -l key $argv[1]; set -l label $argv[2]
    set -l cur (eval echo \$$key)
    read -P "$label [$cur]: " val
    test -n "$val"; or set val "$cur"
    if grep -q "^set -gx $key " "$CONF" 2>/dev/null
        sed -i "s|^set -gx $key .*|set -gx $key \"$val\"|" "$CONF"
    else
        echo "set -gx $key \"$val\"" >> "$CONF"
    end
end

function _sh_quote
    set -l s (string replace -a "'" "'\\''" -- "$argv[1]")
    printf "'%s'" "$s"
end

function _remote_path
    set -l path "$argv[1]"
    if test "$path" = "~"
        printf '$HOME'
    else if string match -q "~/*" -- "$path"
        set -l rest (string sub -s 3 -- "$path")
        printf '$HOME/%s' (_sh_quote "$rest")
    else
        _sh_quote "$path"
    end
end

function _remote_compose_env
    printf 'IMAGE_REF=%s IMAGE_TAG=%s PORT=%s' (_sh_quote (image_ref)) (_sh_quote "$IMAGE_TAG") (_sh_quote "$PORT")
    # Only when set, so a BIND in the box's own .env still wins otherwise.
    set -q BIND; and test -n "$BIND"; and printf ' BIND=%s' (_sh_quote "$BIND")
end

# 5) Deploy: copy the compose file, then pull the image and bring it up.
function do_deploy
    _need DEPLOY_HOST; or return 1
    _need DEPLOY_DIR; or return 1
    set -l rdir (_remote_path "$DEPLOY_DIR")
    set -l env (_remote_compose_env)
    _hd "Deploying "(image_ref)":$IMAGE_TAG on $DEPLOY_HOST ($DEPLOY_DIR)"
    ssh "$DEPLOY_HOST" "mkdir -p $rdir && cat > $rdir/docker-compose.yml" < "$ROOT/docker-compose.yml"
    or begin; _err "Could not copy docker-compose.yml to $DEPLOY_HOST:$DEPLOY_DIR"; return 1; end
    ssh "$DEPLOY_HOST" "cd $rdir && $env docker compose pull && $env docker compose up -d"
    and _ok "Deployed"; or begin; _err "Deploy failed (check SSH / compose on the host)"; return 1; end
end

# 6) Ship: git push → build & push image → deploy.
function do_ship
    _hd "git push (branch + tags)"
    git -C "$ROOT" push; and git -C "$ROOT" push --tags
    or begin; _err "git push failed"; return 1; end
    do_build_push; and do_deploy
end

# 7) Tail remote logs.
function do_logs
    _need DEPLOY_HOST; or return 1
    _need DEPLOY_DIR; or return 1
    set -l rdir (_remote_path "$DEPLOY_DIR")
    ssh -t "$DEPLOY_HOST" "cd $rdir && docker compose logs -f --tail=100"
end

# 8) Log in to the configured registry.
function do_login
    _hd "Logging in to $REGISTRY"
    read -P "username: " u
    docker login "$REGISTRY" -u "$u"
end

# 9) Status: config + local images + remote container state.
function do_status
    set -l ref (image_ref)
    _hd "Config"
    echo "  registry : $REGISTRY"
    echo "  image    : $ref"
    echo "  tag      : $IMAGE_TAG  (git: "(git_tag)", version: "(app_version)")"
    echo "  deploy   : $DEPLOY_HOST:$DEPLOY_DIR  (port $PORT)"
    _hd "Local images"
    docker images "$ref" 2>/dev/null
    docker images "$LOCAL_IMAGE" 2>/dev/null
    if test -n "$DEPLOY_HOST"
        _hd "Remote status"
        set -l rdir (_remote_path "$DEPLOY_DIR")
        ssh "$DEPLOY_HOST" "cd $rdir 2>/dev/null && docker compose ps" 2>/dev/null; or _warn "couldn't reach $DEPLOY_HOST"
    end
end

function _need
    set -l key $argv[1]
    if test -z (eval echo \$$key)
        _err "$key not set — run menu 4 (deploy config) first"; return 1
    end
end

# ---- menu --------------------------------------------------------------------
function menu
    echo
    set_color -o; echo "  Write-Hand — build & deploy"; set_color normal
    echo "  image: "(image_ref)":$IMAGE_TAG    deploy: "(test -n "$DEPLOY_HOST"; and echo $DEPLOY_HOST; or echo '—')
    echo
    echo "   1) Build & push image      → $REGISTRY"
    echo "   2) Local dev (npm run dev)"
    echo "   3) Local image test (build + run on :$PORT + checks)"
    echo "   4) Set DEPLOY config (registry/host/…)"
    echo "   5) Deploy to box (pull + up)"
    echo "   6) Ship (git push → build & push → deploy)"
    echo "   7) Tail remote logs"
    echo "   8) Registry login"
    echo "   9) Status"
    echo "   q) Quit"
    echo
end

function run_choice
    switch $argv[1]
        case 1; do_build_push
        case 2; do_local_dev
        case 3; do_local_image
        case 4; do_set_deploy_conf
        case 5; do_deploy
        case 6; do_ship
        case 7; do_logs
        case 8; do_login
        case 9; do_status
        case q quit exit; return 1
        case '*'; _warn "unknown choice: $argv[1]"
    end
    return 0
end

# ---- entry -------------------------------------------------------------------
load_conf

if set -q argv[1]
    run_choice $argv[1]
else
    while true
        menu
        read -P "choose: " choice
        run_choice $choice; or break
    end
end
