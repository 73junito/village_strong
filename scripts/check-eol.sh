#!/usr/bin/env bash
# Repo EOL & final-newline guard (diff-scoped).
#
# Fails if any *text* file changed on this branch (relative to a base ref)
# contains CRLF line endings or is missing a final newline. Binary files are
# skipped automatically (per .gitattributes). Because the check is scoped to
# the branch diff, pre-existing legacy files are not flagged; a separate
# renormalization PR brings those up to standard.
#
# Usage:
#   scripts/check-eol.sh             # auto-detect base (origin/main | origin/HEAD | HEAD~1)
#   scripts/check-eol.sh origin/dev  # explicit base ref
set -euo pipefail

BASE="${1:-}"

if [[ -z "$BASE" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    BASE="origin/main"
  elif git rev-parse --verify --quiet origin/HEAD >/dev/null; then
    BASE="origin/HEAD"
  else
    BASE="HEAD~1"
  fi
fi

MERGE_BASE="$(git merge-base "$BASE" HEAD 2>/dev/null || echo "$BASE")"

# Files added/copied/modified/renamed on this branch (deletions excluded).
mapfile -t CHANGED < <(git diff --name-only --diff-filter=ACMR "$MERGE_BASE" HEAD)

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "EOL guard: no changed files to check."
  exit 0
fi

fail=0
checked=0
skipped=0

for file in "${CHANGED[@]}"; do
  # Skip anything git treats as binary (honors .gitattributes). `git grep
  # --cached -I` searches the *stored blob* and finds no match in binary
  # files, so a zero exit here means "text". Inspecting the blob (not the
  # working tree) keeps the verdict identical on Windows and CI, independent
  # of core.autocrlf and the checkout representation.
  if ! git grep --cached -I --name-only -e '' -- "$file" >/dev/null 2>&1; then
    skipped=$((skipped + 1))
    continue
  fi

  checked=$((checked + 1))
  problems=""

  # CRLF: any carriage-return byte in the stored blob.
  if git cat-file -p ":$file" | LC_ALL=C grep -qU $'\r'; then
    problems+=" CRLF"
  fi

  # Final newline: the last byte of the stored blob must be a newline.
  if [[ -n "$(git cat-file -p ":$file" | tail -c 1)" ]]; then
    problems+=" missing-final-newline"
  fi

  if [[ -n "$problems" ]]; then
    echo "::error file=${file}::EOL guard:${problems} in ${file}"
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo "EOL guard: FAILED. Normalize line endings to LF and ensure a final newline."
  echo "See orchestration/CONTRIBUTING.md and the root .gitattributes / .editorconfig."
  exit 1
fi

echo "EOL guard: OK (${checked} text file(s) checked, ${skipped} binary/other skipped)."
