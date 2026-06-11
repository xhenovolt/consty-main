#!/bin/bash

# DRAIS Connection Setup Helper
# This script helps you set up your DRAIS connection with the provided credentials

set -e

echo "=========================================="
echo "DRAIS Connection Setup Helper"
echo "=========================================="
echo ""

# Step 1: Check for ENCRYPTION_KEY
echo "📋 Step 1: Checking ENCRYPTION_KEY..."
if [ -z "$ENCRYPTION_KEY" ]; then
    echo "⚠️  ENCRYPTION_KEY not set"
    echo ""
    echo "Generating new ENCRYPTION_KEY..."
    NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo ""
    echo "✨ New ENCRYPTION_KEY (copy this):"
    echo "ENCRYPTION_KEY=$NEW_KEY"
    echo ""
    echo "Add this to your .env.local file"
    echo ""
    export ENCRYPTION_KEY=$NEW_KEY
else
    echo "✅ ENCRYPTION_KEY is set"
fi

echo ""
echo "=========================================="
echo "📝 Step 2: Database Setup"
echo "=========================================="
echo ""
echo "To create the external_connections table, run:"
echo "  npm run migrate -- --target=951"
echo "or"
echo "  psql \$DATABASE_URL -f migrations/951_external_connections.sql"
echo ""

echo "=========================================="
echo "🔑 Step 3: DRAIS Credentials"
echo "=========================================="
echo ""
echo "These credentials are ready to use:"
echo "  CONTROL_API_KEY: 40d73eb668bab8307e9958c8cfff29a7a34fb9d0933587f6ce0512bb7ad58b23"
echo "  CONTROL_API_SECRET: af2cee8c7d9f507808dbb1fedbc74142aa68703f28d365ee2e00f878b79cb02a2ff5845df52ffb486871eebdd3e5d424"
echo ""

echo "=========================================="
echo "🌐 Step 4: Create Connection"
echo "=========================================="
echo ""
echo "Next, create the connection:"
echo "  1. Go to Dashboard → DRAIS Control → Integrations"
echo "  2. Click 'New Connection'"
echo "  3. Fill in:"
echo "     • Name: DRAIS Production"
echo "     • Base URL: https://drais.example.com (your DRAIS URL)"
echo "     • API Key: 40d73eb668bab8307e9958c8cfff29a7a34fb9d0933587f6ce0512bb7ad58b23"
echo "     • API Secret: af2cee8c7d9f507808dbb1fedbc74142aa68703f28d365ee2e00f878b79cb02a2ff5845df52ffb486871eebdd3e5d424"
echo "     • Set as Active: ✓"
echo "  4. Click 'Test Connection'"
echo "  5. Click 'Create Connection'"
echo ""

echo "=========================================="
echo "✨ Setup Complete!"
echo "=========================================="
echo ""
echo "Your DRAIS integration is ready to use!"
echo "Next steps:"
echo "  • Apply database migration"
echo "  • Restart your development server"
echo "  • Create connection via UI"
echo "  • Test DRAIS Control pages"
echo ""
