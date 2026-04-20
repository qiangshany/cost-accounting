#!/bin/bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

echo "Building the Next.js project..."
pnpm next build

echo "Build completed successfully!"