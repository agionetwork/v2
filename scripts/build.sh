#!/bin/bash

# Build script for Vercel deployment
# Handles dependency conflicts and ensures proper build

set -e  # Exit on any error

echo "🔧 Verifying dependencies are installed..."
# TypeScript should already be installed by installCommand, but verify
if ! npm list typescript > /dev/null 2>&1; then
  echo "⚠️ typescript not found, installing..."
  npm install --save-dev --legacy-peer-deps typescript@^5.0.0 @types/react@^19 @types/react-dom@^19 @types/node@^20.0.0
fi

echo "📦 Verifying critical dependencies..."
if ! npm list lucide-react > /dev/null 2>&1; then
  echo "⚠️ lucide-react not found, reinstalling..."
  npm install lucide-react@^0.400.0 --legacy-peer-deps
fi

# Verify TypeScript is accessible
echo "📋 TypeScript packages:"
npm list typescript @types/react @types/react-dom @types/node 2>/dev/null || echo "⚠️ Installing missing packages..."
if [ ! -f node_modules/typescript/bin/tsc ] && [ ! -f node_modules/.bin/tsc ]; then
  echo "⚠️ TypeScript binary not found, installing..."
  npm install --save-dev --legacy-peer-deps typescript@^5.0.0
fi

echo "🔍 Verifying component files exist..."
test -f components/ui/tabs.tsx || (echo "❌ tabs.tsx not found" && exit 1)
test -f components/ui/card.tsx || (echo "❌ card.tsx not found" && exit 1)
test -f components/borrow-loan-creation.tsx || (echo "❌ borrow-loan-creation.tsx not found" && exit 1)
test -f components/lend-loan-creation.tsx || (echo "❌ lend-loan-creation.tsx not found" && exit 1)
test -f components/dashboard/dashboard-header.tsx || (echo "❌ dashboard-header.tsx not found" && exit 1)
echo "✅ All component files verified"

echo "🏗️ Building application..."
npm run build

echo "✅ Build completed successfully!"
