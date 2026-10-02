#!/bin/bash
set -euo pipefail

# Cut a release: bump the version, commit, tag, push. Pushing the tag is what triggers the
# Release workflow (the signed, notarized DMG and the update feed).
# Usage: ./scripts/release.sh <patch|minor|major|x.y.z>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

BUMP="${1:-}"
PROJECT_FILE="LinearQuickEntry.xcodeproj/project.pbxproj"

if [[ ! "$BUMP" =~ ^(patch|minor|major|[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major|x.y.z>"
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "Error: You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

# MARKETING_VERSION in the Xcode project is the source of truth for the version.
CURRENT="$(grep -m1 -oE 'MARKETING_VERSION = [0-9]+\.[0-9]+\.[0-9]+' "$PROJECT_FILE" | awk '{print $3}')"
IFS=. read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP" in
  patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
  minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  *) NEW_VERSION="$BUMP" ;;
esac

if git rev-parse -q --verify "refs/tags/v$NEW_VERSION" > /dev/null; then
  echo "Error: tag v$NEW_VERSION already exists."
  exit 1
fi

# Releasing the version the project already has (e.g. a first 0.1.0) needs no bump commit.
if [ "$NEW_VERSION" != "$CURRENT" ]; then
  echo "Bumping version $CURRENT → $NEW_VERSION..."
  sed -i '' -E "s/MARKETING_VERSION = [0-9]+\.[0-9]+\.[0-9]+;/MARKETING_VERSION = $NEW_VERSION;/g" "$PROJECT_FILE"
  git add "$PROJECT_FILE"
  git commit -m "Release $NEW_VERSION"
fi
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "Pushing to origin..."
git push origin main
git push origin "v$NEW_VERSION"

REPO="$(git remote get-url origin | sed 's/.*github.com[:/]//;s/\.git$//')"
echo ""
echo "✅ Release v$NEW_VERSION created and pushed!"
echo "   The Release workflow builds, notarizes and publishes it: https://github.com/$REPO/actions"
