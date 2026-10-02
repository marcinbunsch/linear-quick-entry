#!/bin/bash
# Xcode build phase: copies the web panel build (web/dist) into the app's Resources/web.
# Build it first with `pnpm --dir web build`. Debug builds can run without it: they load the
# Vite dev server (`pnpm --dir web dev`) and only fall back to the bundled copy.
set -euo pipefail

source_dir="${SRCROOT}/web/dist"
destination_dir="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/web"

if [ ! -f "${source_dir}/index.html" ]; then
  if [ "${CONFIGURATION}" = "Release" ]; then
    echo "error: web/dist is missing. Run: pnpm --dir web install && pnpm --dir web build"
    exit 1
  fi
  echo "warning: web/dist is missing; the Debug app will only work with the Vite dev server running (pnpm --dir web dev)"
  exit 0
fi

rm -rf "${destination_dir}"
mkdir -p "${destination_dir}"
cp -R "${source_dir}/" "${destination_dir}/"
