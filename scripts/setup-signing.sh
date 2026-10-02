#!/bin/bash
set -euo pipefail

# One-time setup for signed, notarized, auto-updating releases. Run it on the Mac that
# holds the Developer ID certificate. It:
#   1. exports that one certificate (with its private key) and stores it as a GitHub secret,
#   2. stores the notarization login from .env as secrets,
#   3. creates the Sparkle update-signing key (or reuses it), stores the private half as a
#      secret and writes the public half into Support/Info.plist.
# Values come from the local .env (see .env.example). Nothing secret is written anywhere
# but the GitHub secret store. Safe to run again; it replaces the secrets.
# Usage: ./scripts/setup-signing.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

REPO="$(git remote get-url origin | sed 's/.*github.com[:/]//;s/\.git$//')"
SPARKLE_ACCOUNT="linear-quick-entry"

set -a
# shellcheck source=/dev/null
source .env
set +a
: "${SIGN_IDENTITY:?Set SIGN_IDENTITY in .env first}"
: "${SIGN_APPLE_ID:?Set SIGN_APPLE_ID in .env first}"
: "${SIGN_APP_PASSWORD:?Set SIGN_APP_PASSWORD in .env first}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "1/3 Exporting \"$SIGN_IDENTITY\" from the keychain."
echo "    macOS will ask for your login keychain password to release the private key."
# A random password: it only protects the .p12 between here and the GitHub secret store.
CERT_PASSWORD="$(openssl rand -base64 32)"
EXPORT_PASSWORD="$CERT_PASSWORD" swift scripts/export-identity.swift "$SIGN_IDENTITY" "$WORK_DIR/signing.p12"

echo "2/3 Preparing the Sparkle update-signing key (account \"$SPARKLE_ACCOUNT\")."
GENERATE_KEYS="$(find build/DerivedData/SourcePackages/artifacts -path '*/Sparkle/bin/generate_keys' -print -quit 2>/dev/null || true)"
if [ -z "$GENERATE_KEYS" ]; then
  echo "    Sparkle's tools aren't downloaded yet; resolving packages first."
  xcodebuild -resolvePackageDependencies -project LinearQuickEntry.xcodeproj -derivedDataPath build/DerivedData > /dev/null
  GENERATE_KEYS="$(find build/DerivedData/SourcePackages/artifacts -path '*/Sparkle/bin/generate_keys' -print -quit)"
fi
# Creates the key on first run and reuses it after; it lives in the login keychain.
"$GENERATE_KEYS" --account "$SPARKLE_ACCOUNT" > /dev/null
SPARKLE_PUBLIC_KEY="$("$GENERATE_KEYS" --account "$SPARKLE_ACCOUNT" -p)"
"$GENERATE_KEYS" --account "$SPARKLE_ACCOUNT" -x "$WORK_DIR/sparkle-private-key"
/usr/libexec/PlistBuddy -c "Set :SUPublicEDKey $SPARKLE_PUBLIC_KEY" Support/Info.plist

echo "3/3 Setting secrets on $REPO."
gh secret set SIGN_CERT_P12 --repo "$REPO" --body "$(base64 -i "$WORK_DIR/signing.p12")"
gh secret set SIGN_CERT_PASSWORD --repo "$REPO" --body "$CERT_PASSWORD"
gh secret set SIGN_IDENTITY --repo "$REPO" --body "$SIGN_IDENTITY"
gh secret set SIGN_APPLE_ID --repo "$REPO" --body "$SIGN_APPLE_ID"
gh secret set SIGN_APP_PASSWORD --repo "$REPO" --body "$SIGN_APP_PASSWORD"
gh secret set SPARKLE_PRIVATE_KEY --repo "$REPO" --body "$(cat "$WORK_DIR/sparkle-private-key")"

echo
gh secret list --repo "$REPO"
echo
if git diff --quiet -- Support/Info.plist; then
  echo "✅ Done. The next release (./scripts/release.sh patch) builds signed and notarized."
else
  echo "✅ Done. Support/Info.plist now has the Sparkle public key; commit it, then"
  echo "   ./scripts/release.sh patch builds a signed, notarized, auto-updating release."
fi
