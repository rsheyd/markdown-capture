#!/usr/bin/env bash

set -euo pipefail

script_directory=$(cd "$(dirname "$0")" && pwd)
repository_root=$(cd "$script_directory/.." && pwd)
changelog_path="$repository_root/CHANGELOG.md"
dry_run=false

if [[ ${1:-} == "--dry-run" && $# -eq 1 ]]; then
  dry_run=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 2
fi

for command in awk date gh git grep node npm sed unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

version=$(cd "$repository_root" && node -p "require('./manifest.json').version")
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "manifest.json must contain a three-part numeric version." >&2
  exit 1
fi

release_header=$(awk '/^## / { print; exit }' "$changelog_path")
prepare_version=false
if [[ $release_header == "## Unreleased" ]]; then
  previous_version=$(awk '/^## [0-9]+\.[0-9]+\.[0-9]+ — / { print $2; exit }' "$changelog_path")
  if [[ $previous_version == "$version" ]]; then
    version=$(node -e 'const parts = process.argv[1].split(".").map(Number); parts[2]++; console.log(parts.join("."));' "$version")
  elif [[ -n $previous_version ]] && ! node -e 'const a = process.argv[1].split(".").map(Number), b = process.argv[2].split(".").map(Number); const i = a.findIndex((n, i) => n !== b[i]); process.exit(i >= 0 && a[i] > b[i] ? 0 : 1);' "$version" "$previous_version"; then
    echo "manifest.json version must not be older than the previous changelog version." >&2
    exit 1
  fi
  prepare_version=true
fi
header_prefix="## $version — "
if ! $prepare_version && [[ $release_header != "$header_prefix"* ]]; then
  echo "The newest CHANGELOG.md heading must begin '$header_prefix'." >&2
  exit 1
fi
release_date=${release_header#"$header_prefix"}
if $prepare_version; then release_date="Unreleased"; fi
if [[ $release_date != "Unreleased" && ! $release_date =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "The newest changelog heading must end in 'Unreleased' or YYYY-MM-DD." >&2
  exit 1
fi

remote=$(git -C "$repository_root" remote get-url origin)
case "$remote" in
  https://github.com/rsheyd/markdown-capture|https://github.com/rsheyd/markdown-capture.git|git@github.com:rsheyd/markdown-capture.git) ;;
  *) echo "origin does not point to rsheyd/markdown-capture: $remote" >&2; exit 1 ;;
esac

tag="v$version"
zip_path="$repository_root/dist/markdown-capture-$version.zip"
notes_file=$(mktemp "${TMPDIR:-/tmp}/markdown-capture-release-notes.XXXXXX")
trap 'rm -f "$notes_file"' EXIT
awk -v header="$release_header" '
  $0 == header { found = 1; next }
  found && /^## / { exit }
  found { print }
' "$changelog_path" > "$notes_file"
if ! grep -q '[^[:space:]]' "$notes_file"; then
  echo "The $version changelog section has no release notes." >&2
  exit 1
fi

if $dry_run; then
  echo "GitHub release: $tag"
  if $prepare_version; then
    echo "Manifest version: $version (would be recorded at release time)"
  fi
  echo "Chrome Web Store ZIP: $zip_path"
  if [[ $release_date == "Unreleased" ]]; then
    echo "Changelog date: $(date +%F) (would be recorded at release time)"
  fi
  echo "The script would test, package, commit the release metadata, push, and create or verify the GitHub release."
  echo "Chrome Web Store submission remains manual."
  echo
  sed -e '/./,$!d' "$notes_file"
  exit 0
fi

if [[ -n $(git -C "$repository_root" status --porcelain) ]]; then
  echo "Commit the release changes before creating $tag." >&2
  exit 1
fi
branch=$(git -C "$repository_root" symbolic-ref --quiet --short HEAD) || {
  echo "Check out the branch to release before creating $tag." >&2
  exit 1
}
if [[ $branch != main ]]; then
  echo "Check out main before creating $tag (current branch: $branch)." >&2
  exit 1
fi
if git -C "$repository_root" show-ref --tags --verify --quiet "refs/tags/$tag" && [[ $release_date == "Unreleased" ]]; then
  echo "$tag already exists locally while the changelog is still Unreleased." >&2
  exit 1
fi

(cd "$repository_root" && npm test)

gh auth status >/dev/null
remote_tag=$(git -C "$repository_root" ls-remote origin "refs/tags/$tag" | awk '{ print $1 }')
if [[ -n $remote_tag ]]; then
  if [[ $release_date == "Unreleased" || $remote_tag != "$(git -C "$repository_root" rev-parse HEAD)" ]]; then
    echo "The remote $tag tag already exists at $remote_tag and does not match this release checkout." >&2
    exit 1
  fi
fi

if [[ $release_date == "Unreleased" ]]; then
  release_date=$(date +%F)
  CHANGELOG_PATH="$changelog_path" MANIFEST_PATH="$repository_root/manifest.json" RELEASE_VERSION="$version" RELEASE_HEADER="$release_header" RELEASE_DATE="$release_date" node -e '
    const fs = require("node:fs");
    const path = process.env.CHANGELOG_PATH;
    const before = fs.readFileSync(path, "utf8");
    const header = process.env.RELEASE_HEADER;
    if (!before.split("\n").includes(header)) throw new Error("Release heading changed before dating it.");
    const manifestPath = process.env.MANIFEST_PATH;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.version !== process.env.RELEASE_VERSION) {
      manifest.version = process.env.RELEASE_VERSION;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    }
    const heading = `## ${process.env.RELEASE_VERSION} — ${process.env.RELEASE_DATE}`;
    fs.writeFileSync(path, before.split("\n").map(line => line === header ? heading : line).join("\n"));
  '
fi

(cd "$repository_root" && npm run package)
unzip -tq "$zip_path" >/dev/null
packaged_version=$(unzip -p "$zip_path" manifest.json | node -e "let input = ''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => console.log(JSON.parse(input).version));")
if [[ $packaged_version != "$version" ]]; then
  echo "The packaged manifest version does not match $version." >&2
  exit 1
fi

if [[ -n $(git -C "$repository_root" status --porcelain -- CHANGELOG.md manifest.json) ]]; then
  git -C "$repository_root" add -- CHANGELOG.md manifest.json
  git -C "$repository_root" commit -m "Release $version"
fi

git -C "$repository_root" push origin "$branch"

remote_tag=$(git -C "$repository_root" ls-remote origin "refs/tags/$tag" | awk '{ print $1 }')
target=$(git -C "$repository_root" rev-parse HEAD)
if [[ -n $remote_tag && $remote_tag != "$target" ]]; then
  echo "The remote $tag tag points to $remote_tag, not $target. Refusing to treat it as this release." >&2
  exit 1
fi

if gh release view "$tag" --repo rsheyd/markdown-capture >/dev/null 2>&1; then
  echo "GitHub release $tag already exists."
  if ! gh release view "$tag" --repo rsheyd/markdown-capture --json assets --jq '.assets[].name' | grep -Fxq "$(basename "$zip_path")"; then
    gh release upload "$tag" "$zip_path" --repo rsheyd/markdown-capture
    echo "Uploaded the missing ZIP asset."
  fi
else
  release_url=$(gh release create "$tag" "$zip_path" \
    --repo rsheyd/markdown-capture \
    --target "$target" \
    --title "$tag" \
    --notes-file "$notes_file")
  echo "Created GitHub release $tag: $release_url"
fi

echo "GitHub release complete. Submit $zip_path to the Chrome Web Store separately."
