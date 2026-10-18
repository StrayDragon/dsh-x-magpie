# Task entry points. Bare `just` prints this list; each recipe is one command.
# CI mirrors `just check`; release artifacts come from `just pack`.

_default:
    @just --list

# Install devDependencies exactly as locked
install:
    bun install --frozen-lockfile

# Strict TypeScript check, no emit
typecheck:
    bun run typecheck

# Build all runtime halves into dist/ (index.js, client.js, types)
build:
    bun run scripts/build.ts

# Behavioral smoke: host half against an in-process mock gateway (builds first)
smoke: build
    bun scripts/smoke.mjs

# Smoke only, reusing the existing dist/ artifacts
smoke-fast:
    bun scripts/smoke.mjs

# Full local gate, same steps CI runs: typecheck + build + smoke
check: typecheck build smoke

# Day-to-day loop: deps, build, quick smoke
dev: install smoke-fast

# Remove build artifacts and packed tarballs
clean:
    rm -rf dist *.tgz

# Pack the published tree into a .tgz (the form `dsh plugin add ./x.tgz` installs)
pack: build
    bun pm pack

# Cut a release: bump the version in package.json, commit, tag vX.Y.Z, push
release version:
    @bun run scripts/release.ts {{version}}
