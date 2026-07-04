#!/bin/bash

# Busara Setup Script
# ===================
# This script helps set up the Busara development environment

set -e

echo "🚀 Busara AI Setup Script"
echo "=========================="
echo ""

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | tr -d 'v')

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. You have $NODE_VERSION"
    echo "   Install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION is supported"
echo ""

# Check if pnpm is installed
echo "🔍 Checking pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm $PNPM_VERSION is installed"
else
    echo "⚠️  pnpm not found. Installing..."
    npm install -g pnpm
    echo "✅ pnpm installed"
fi
echo ""

# Check current directory
echo "🔍 Checking current directory..."
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the Busara root directory"
    exit 1
fi

echo "✅ Running from Busara root directory"
echo ""

# Ask for setup mode
echo "📋 Setup Mode"
echo "------------"
echo "1. Full setup (recommended) - Uses pnpm, monorepo structure"
echo "2. Legacy setup - Uses npm, single package (for memory-constrained environments)"
echo ""
read -p "Choose setup mode [1/2]: " SETUP_MODE

if [ -z "$SETUP_MODE" ]; then
    SETUP_MODE=1
fi

echo ""

case $SETUP_MODE in
    1)
        echo "🛠️  Full Setup (Monorepo with pnpm)"
        echo "=================================="
        
        # Install dependencies
        echo "📦 Installing dependencies..."
        if pnpm install; then
            echo "✅ Dependencies installed"
        else
            echo "⚠️  Trying with increased memory..."
            NODE_OPTIONS=--max-old-space-size=4096 pnpm install
        fi
        echo ""
        
        # Generate Prisma client
        echo "🗃️  Generating Prisma client..."
        pnpm db:generate || echo "⚠️  Prisma client generation skipped (no database configured)"
        echo ""
        
        # Build
        echo "🏗️  Building packages..."
        pnpm build || echo "⚠️  Build skipped or failed"
        echo ""
        
        echo "✅ Full setup complete!"
        echo ""
        echo "🚀 To start development:"
        echo "   pnpm dev"
        echo ""
        echo "📚 Documentation:"
        echo "   - Development Guide: ./DEVELOPMENT.md"
        echo "   - Migration Guide: ./MIGRATION.md"
        echo "   - Transformation Plan: ./TRANSFORMATION_PLAN.md"
        ;;
    
    2)
        echo "🛠️  Legacy Setup (Single Package with npm)"
        echo "=========================================="
        
        # Temporarily modify package.json to remove workspace references
        echo "📝 Modifying package.json for npm compatibility..."
        
        # Backup original
        cp package.json package.json.backup
        
        # Create npm-compatible package.json
        cat > package.json << 'EOF'
{
  "name": "busara",
  "version": "8.0.0-alpha.1",
  "private": true,
  "description": "Busara AI - Multi-Agent Data Intelligence Platform",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint src --ext .ts,.tsx",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.1.1",
    "@prisma/client": "^6.11.1",
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.2",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-context-menu": "^2.2.15",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-hover-card": "^1.1.14",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.15",
    "@radix-ui/react-navigation-menu": "^1.2.13",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.7",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-toggle": "^1.1.9",
    "@radix-ui/react-toggle-group": "^1.1.10",
    "@radix-ui/react-tooltip": "^1.2.7",
    "@supabase/ssr": "^0.12.0",
    "@supabase/supabase-js": "^2.108.2",
    "@tanstack/react-query": "^5.82.0",
    "@tanstack/react-table": "^8.21.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "framer-motion": "^12.42.2",
    "lucide-react": "^0.525.0",
    "next": "15",
    "next-auth": "^4.24.11",
    "next-intl": "^4.3.4",
    "next-themes": "^0.4.6",
    "pg": "^8.22.0",
    "prisma": "^6.11.1",
    "react": "^19.0.0",
    "react-day-picker": "^9.8.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.60.0",
    "react-markdown": "^10.1.0",
    "react-resizable-panels": "^3.0.3",
    "react-syntax-highlighter": "^15.6.1",
    "reactflow": "^11.11.4",
    "recharts": "^2.15.4",
    "sonner": "^2.0.6",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "uuid": "^11.1.0",
    "vaul": "^1.1.2",
    "z-ai-web-dev-sdk": "^0.0.18",
    "zod": "^4.0.2",
    "zustand": "^5.0.6"
  },
  "devDependencies": {
    "@netlify/plugin-nextjs": "^5.15.12",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20.10.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.3.5",
    "typescript": "^5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
        
        echo "✅ package.json modified for npm"
        echo ""
        
        # Install with npm
        echo "📦 Installing dependencies with npm..."
        npm install
        echo "✅ Dependencies installed"
        echo ""
        
        # Restore original package.json
        echo "🔄 Restoring original package.json..."
        mv package.json.backup package.json
        echo "✅ Original package.json restored"
        echo ""
        
        # Generate Prisma client
        echo "🗃️  Generating Prisma client..."
        npx prisma generate || echo "⚠️  Prisma client generation skipped"
        echo ""
        
        echo "✅ Legacy setup complete!"
        echo ""
        echo "🚀 To start development:"
        echo "   npm run dev"
        echo ""
        echo "⚠️  Note: This setup uses the legacy structure."
        echo "   For full monorepo features, use pnpm (Option 1)"
        ;;
    
    *)
        echo "❌ Invalid option. Please choose 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "📚 Next Steps:"
echo "------------"
echo "1. Review the changes: git log --oneline -10"
echo "2. Read the documentation: ./DEVELOPMENT.md"
echo "3. Start developing: pnpm dev (or npm run dev for legacy)"
echo "4. Join the community: https://github.com/gadda00/IntelliFlow/discussions"
echo ""
echo "🎉 Happy coding with Busara AI!"
