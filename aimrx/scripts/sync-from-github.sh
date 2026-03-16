#!/bin/bash
# Sync Replit workspace with latest code from GitHub main branch
# Usage: bash scripts/sync-from-github.sh

REPO="Smartconnect2025/AimRX"
BRANCH="main"
TOKEN="${GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN not set"
  exit 1
fi

echo "🔄 Syncing Replit with GitHub ${REPO}@${BRANCH}..."

# Get the latest commit SHA
LATEST_SHA=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://api.github.com/repos/${REPO}/commits/${BRANCH}" | \
  node -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{console.log(JSON.parse(Buffer.concat(c).toString()).sha);})")

echo "Latest commit: ${LATEST_SHA}"

# Get the full tree
TREE_SHA=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://api.github.com/repos/${REPO}/git/commits/${LATEST_SHA}" | \
  node -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{console.log(JSON.parse(Buffer.concat(c).toString()).tree.sha);})")

# Get all files recursively
echo "Fetching file tree..."
FILES=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://api.github.com/repos/${REPO}/git/trees/${TREE_SHA}?recursive=1")

CHANGED=0
CHECKED=0

# Compare and update each file
echo "$FILES" | node -e "
const fs = require('fs');
const path = require('path');
const c=[]; 
process.stdin.on('data',d=>c.push(d)); 
process.stdin.on('end',()=>{
  const data = JSON.parse(Buffer.concat(c).toString());
  const blobs = data.tree.filter(t => t.type === 'blob');
  const output = blobs.map(b => b.path + '|' + b.sha).join('\n');
  console.log(output);
});" | while IFS='|' read -r filepath ghsha; do
  if [ -f "$filepath" ]; then
    localsha=$(git hash-object "$filepath" 2>/dev/null)
    if [ "$localsha" != "$ghsha" ]; then
      echo "  📥 Updated: $filepath"
      CHANGED=$((CHANGED+1))
    fi
  else
    echo "  📥 New: $filepath"
  fi
  CHECKED=$((CHECKED+1))
done

echo ""
echo "✅ Sync check complete."
