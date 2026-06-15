#!/bin/sh

# Xcode Cloud runs this immediately after cloning the repo, before resolving
# packages or building. A Capacitor app needs its web bundle built and native
# project synced first — otherwise the SPM packages referenced by path into
# node_modules (see ios/App/CapApp-SPM/Package.swift) don't exist and the build
# fails during dependency resolution.

set -e

# Xcode Cloud images ship Homebrew. Install Node (vite 8 needs Node 20+).
brew install node

# Build from the repository root.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install JS deps, build the web bundle (dist/), and copy it + native deps into iOS.
npm ci
npm run build
npx cap sync ios
