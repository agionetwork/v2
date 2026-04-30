#!/bin/bash

# Install all missing dependencies for the project
echo "📦 Installing all required dependencies..."

# Core dependencies
npm install react-icons date-fns @radix-ui/react-accordion --legacy-peer-deps

# Additional UI dependencies that might be missing
npm install @radix-ui/react-toast @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio --legacy-peer-deps

echo "✅ All dependencies installed successfully!"
