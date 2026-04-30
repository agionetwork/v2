#!/bin/bash

# Install all missing dependencies for the project
echo "📦 Installing all required dependencies..."

# UI Dependencies
npm install embla-carousel-react recharts --legacy-peer-deps

# Additional dependencies that might be missing
npm install @radix-ui/react-toast @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio --legacy-peer-deps

echo "✅ All dependencies installed successfully!"
