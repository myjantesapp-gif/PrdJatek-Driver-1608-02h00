#!/bin/bash
set -e

echo "Running post-merge setup..."
pnpm install --no-frozen-lockfile
echo "Done."
