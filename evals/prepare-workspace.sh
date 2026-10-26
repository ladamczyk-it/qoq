#!/usr/bin/env bash
# Build the fullstack eval workspace for one eval: a parent dir (no .git, no
# qoq.config) holding api/ and web/, each its own repo on master.
#
# Usage: evals/prepare-workspace.sh <empty scratch dir> <eval id>
set -euo pipefail

dest=$1
id=$2
here=$(cd "$(dirname "$0")" && pwd)
states=$here/fixtures/workspace-states

mkdir -p "$dest"
cp -r "$here/fixtures/workspace/." "$dest/"

case $id in
  37 | 42) ;;
  38) rm -rf "$dest/web" ;;
  39 | 40) cp -r "$states/trip-tags-approved/." "$dest/" ;;
  41) cp -r "$states/trip-tags-approved/." "$states/trip-tags-web-m1-delivered/." "$dest/" ;;
  *) echo "eval $id has no workspace setup" >&2 && exit 2 ;;
esac

for repo in "$dest"/*/; do
  [ -f "$repo/package.json" ] || continue
  (
    cd "$repo"
    git init -q -b master
    npm install --silent --prefer-offline > /dev/null
    git add -A && git commit -qm fixture
  )
done

# 41: web has delivered Milestone 1 on its plan branch; api hasn't started.
if [ "$id" = 41 ]; then
  git -C "$dest/web" checkout -qb feat/trip-tags
fi
