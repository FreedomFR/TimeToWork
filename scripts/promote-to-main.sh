#!/usr/bin/env bash
# Promote the verified state of `dev` to `main`.
#
#   ./scripts/promote-to-main.sh        (from the dev branch, with nothing left uncommitted)
#
# main is the stable version, dev plus everything except the tests. This merges dev into main, then
# drops the test files listed below, including any new ones dev has added since the last promotion.
# If something else conflicts, the merge is left open on main for you to resolve and commit
# (or `git merge --abort`). It never pushes: look at the result, then `git push origin main`.
set -euo pipefail

# Paths that exist on dev only. Add a new test file or folder here if it lives outside these.
TEST_PATHS=(
  backend/tests
  backend/vitest.config.mts
  backend/.env.test
  backend/scripts/create-test-db.ts
  backend/scripts/cleanup-e2e-users.ts
  e2e
  docker-compose.test.yml
  backup/test.sh
)

die() { echo "promote-to-main: $*" >&2; exit 1; }

promote() {
  cd "$(git rev-parse --show-toplevel)"

  [ "$(git rev-parse --abbrev-ref HEAD)" = dev ] || die "run it from the dev branch"
  [ -z "$(git status --porcelain --untracked-files=no)" ] || die "uncommitted changes on dev: commit or stash them first"

  [ "$(git rev-list --count main..dev)" -gt 0 ] || { echo "main already has everything from dev."; return; }
  echo "Commits of dev that are not on main yet:"
  git log --oneline main..dev
  echo
  read -r -p "The tests passed on dev, and you want to put all of this on main? [y/N] " answer
  case "$answer" in y|Y|o|O) ;; *) die "cancelled" ;; esac

  git checkout -q main

  # Conflicts are expected here (a test file changed on dev but deleted on main); the next step clears them
  git merge --no-ff --no-commit dev >/dev/null || true
  git rm -r -q -f --ignore-unmatch -- "${TEST_PATHS[@]}"

  if [ -n "$(git diff --name-only --diff-filter=U)" ]; then
    echo "These files conflict, outside the tests. Resolve them, then 'git commit' (or 'git merge --abort'):" >&2
    git diff --name-only --diff-filter=U >&2
    exit 1
  fi

  git rev-parse -q --verify MERGE_HEAD >/dev/null || { echo "main already has everything from dev."; return; }
  git commit -q -m "Merge dev into main (without the tests)"
  echo
  echo "What this adds to main:"
  git diff --stat HEAD^1 HEAD
  echo
  echo "Done, on the main branch. If it looks right: git push origin main   (then: git checkout dev)"
}

# Run from a copy: checking out main can replace or delete this very file while bash is still reading it
if [ -z "${PROMOTE_FROM_COPY:-}" ]; then
  copy="$(mktemp)"
  cp "$0" "$copy"
  PROMOTE_FROM_COPY=1 exec bash "$copy" "$@"
fi
trap 'rm -f "$0"' EXIT
promote
