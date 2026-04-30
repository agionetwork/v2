#!/usr/bin/env node

/**
 * Vercel Build Script
 * Custom build script to handle dependency conflicts and ensure proper deployment
 */

const { execSync } = require('child_process');

console.log('🚀 Starting Vercel build process...');

try {
  // Step 1: Install dependencies with legacy peer deps
  console.log('📦 Installing dependencies...');
  execSync('npm install --legacy-peer-deps --force', { stdio: 'inherit' });

  // Step 2: Verify critical dependencies
  console.log('🔍 Verifying dependencies...');
  try {
    execSync('npm list lucide-react', { stdio: 'pipe' });
    console.log('✅ lucide-react verified');
  } catch (error) {
    console.log('⚠️ lucide-react not found, reinstalling...');
    execSync('npm install lucide-react@^0.400.0 --legacy-peer-deps', { stdio: 'inherit' });
  }

  // Step 3: Build the application
  console.log('🏗️ Building application...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('✅ Vercel build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
