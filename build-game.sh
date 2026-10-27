#!/bin/bash
# Rebuild one beta game into site/games/<slug>/.
#
#   ./build-game.sh spraklydoo        # SpraklyDoo       <- ../spraklydoo       (or $SPRAKLYDOO_DIR)
#   ./build-game.sh lezen-met-olli   # OllyReads  <- ../lezenmetollie   (or $LEZENMETOLLI_DIR)
#   ./build-game.sh all              # both
#
# Run this whenever a game changes and you want the website copy updated.
# Both games build with a RELATIVE base (vite.config.ts: base: './'), so they work
# under /games/<slug>/ as-is and need no path patching. The game checkout is copied
# to a temp dir and built there, so the game repos (their node_modules and dist/)
# are left untouched. The only things added to the built game are the site's
# Content-Security-Policy, canonical URL and social-preview metadata.
#
# The game repos have no package-lock.json, so the first build records one in
# tools/locks/<slug>.package-lock.json and later builds install exactly those
# versions with `npm ci`. Delete a lockfile there to pick up newer dependencies, or when
# `npm ci` stops with "not in sync" because a game's package.json changed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SITE="$ROOT/site"
ORIGIN="https://monkotorix.com"

# The site's own policy, adapted for the games (SpraklyDoo shipped the same one in _headers).
CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"

# A subshell function, so the EXIT trap cleans the temp dir up on success and on failure.
build() (
  slug="$1" src="$2" title_marker="$3" og_title="$4" og_desc="$5" og_image="$6"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  echo "Building $slug from $src"
  rsync -a --exclude node_modules --exclude dist --exclude .git --exclude 'tests/output' "$src/" "$tmp/src/"
  (
    cd "$tmp/src"
    lock="$ROOT/tools/locks/$slug.package-lock.json"
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund --loglevel=error
    elif [ -f "$lock" ]; then
      cp "$lock" package-lock.json
      npm ci --no-audit --no-fund --loglevel=error
    else
      echo "note: no lockfile for $slug yet; recording one in tools/locks/" >&2
      npm install --no-audit --no-fund --loglevel=error
      mkdir -p "$ROOT/tools/locks"
      cp package-lock.json "$lock"
    fi
    # The flags land on the `vite build` at the end of the package's build script.
    npm run build -- --outDir "$tmp/out" --emptyOutDir
  )

  # Hosting files for other platforms (Netlify, IIS, Azure, Apache) only apply at a
  # site root; under /games/<slug>/ they would just be served as public files.
  rm -f "$tmp/out/_headers" "$tmp/out/web.config" "$tmp/out/staticwebapp.config.json" "$tmp/out/.htaccess"

  python3 - "$tmp/out/index.html" "$title_marker" "$ORIGIN/games/$slug/" "$og_title" "$og_desc" "$ORIGIN/assets/$og_image" "$CSP" <<'PY'
import html, sys
path, marker, url, title, desc, image, csp = sys.argv[1:]
page = open(path, encoding="utf-8").read()
esc = lambda s: html.escape(s, quote=True)
# Injected right after <title>, which comes before the game's own script and stylesheet.
extra = f'''
    <meta http-equiv="Content-Security-Policy" content="{csp}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <link rel="canonical" href="{url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Monkotorix" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(desc)}" />
    <meta property="og:url" content="{url}" />
    <meta property="og:image" content="{image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />'''
assert marker in page, f"title marker {marker!r} not found in built index.html"
page = page.replace(marker, marker + extra, 1)
open(path, "w", encoding="utf-8").write(page)
PY

  mkdir -p "$SITE/games"
  rm -rf "$SITE/games/$slug"
  mv "$tmp/out" "$SITE/games/$slug"
  echo "Updated $SITE/games/$slug"
)

build_spraklydoo() {
  build spraklydoo \
    "${SPRAKLYDOO_DIR:-$ROOT/../spraklydoo}" \
    "<title>SpraklyDoo – Coordination practice games</title>" \
    "SpraklyDoo (beta) — play in your browser" \
    "Playful coordination practice games for neurodivergent children aged 4 to 8, in English and Dutch. No accounts, no ads, no tracking. A Monkotorix beta." \
    "og-spraklydoo.jpg"
}

build_lezen_met_olli() {
  build lezen-met-olli \
    "${LEZENMETOLLI_DIR:-$ROOT/../lezenmetollie}" \
    "<title>OllyReads</title>" \
    "OllyReads (beta) — Dutch reading game" \
    "A playful Dutch reading game for beginning readers, with Olli the owl. Calm, inclusive activities build confidence with letters, sounds, rhymes and words. More languages are planned, with practice adapted to each language. No account, no ads, no tracking." \
    "og-lezen-met-olli.jpg"
}

case "${1:-all}" in
  spraklydoo) build_spraklydoo ;;
  lezen-met-olli) build_lezen_met_olli ;;
  all) build_spraklydoo; build_lezen_met_olli ;;
  *) echo "usage: $0 [spraklydoo|lezen-met-olli|all]" >&2; exit 2 ;;
esac
