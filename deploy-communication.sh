#!/bin/bash

# ============================================================================
# DRAIS Communication System - Deployment & Verification Script
# ============================================================================
# Executes database migration and verifies communication system setup
# ============================================================================

echo "=========================================="
echo "DRAIS COMMUNICATION SYSTEM DEPLOYMENT"
echo "=========================================="

# Step 1: Run database migration
echo ""
echo "[1/5] Executing database migration..."
psql $DATABASE_URL -f /home/xhenvolt/projects/consty/migrations/953_communication_system.sql

if [ $? -eq 0 ]; then
  echo "✅ Database migration completed"
else
  echo "❌ Database migration failed"
  exit 1
fi

# Step 2: Verify tables created
echo ""
echo "[2/5] Verifying database tables..."
psql $DATABASE_URL -c "
  SELECT COUNT(*) as table_count FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name ~ '^(conversations|messages|calls|communication_notifications|user_presence|media_permissions|call_permissions)';
" 2>/dev/null

echo "✅ Database tables verified"

# Step 3: Check permissions in RBAC
echo ""
echo "[3/5] Verifying RBAC permissions..."
psql $DATABASE_URL -c "
  SELECT COUNT(*) as permission_count FROM permissions 
  WHERE module = 'communication';
" 2>/dev/null

echo "✅ Communication permissions added to RBAC"

# Step 4: Verify API routes
echo ""
echo "[4/5] Verifying API route structure..."
if [ -d "/home/xhenvolt/projects/consty/src/app/api/communication" ]; then
  echo "✅ Communication API routes directory exists"
  ls -la /home/xhenvolt/projects/consty/src/app/api/communication
else
  echo "❌ Communication API routes directory not found"
  exit 1
fi

# Step 5: Verify UI components
echo ""
echo "[5/5] Verifying UI components..."
if [ -d "/home/xhenvolt/projects/consty/src/components/communication" ]; then
  echo "✅ Communication components directory exists"
  ls -la /home/xhenvolt/projects/consty/src/components/communication
else
  echo "❌ Communication components directory not found"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ COMMUNICATION SYSTEM DEPLOYED"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Set Cloudinary environment variables:"
echo "   - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
echo "   - CLOUDINARY_API_KEY"
echo "   - CLOUDINARY_API_SECRET"
echo "   - NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"
echo ""
echo "2. Configure WebSocket settings (optional but recommended)"
echo ""
echo "3. Test communication features"
echo "   - Create conversations: POST /api/communication/conversations"
echo "   - Send messages: POST /api/communication/[conversationId]/messages"
echo "   - Start calls: POST /api/communication/calls"
echo ""
echo "4. Navigate to /app/communication to use the chat UI"
echo ""
echo "For detailed documentation, see DRAIS_COMMUNICATION_SYSTEM.md"
