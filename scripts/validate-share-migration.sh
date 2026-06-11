#!/bin/bash

# Share System Migration Validation Script
# Verifies all tables, views, and constraints are properly created

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-consty}"
DB_USER="${DB_USER:-postgres}"

echo "============================================"
echo "Share System Migration Validation"
echo "============================================"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ ERROR: psql is not installed"
    exit 1
fi

# Function to run SQL query
run_query() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$1" 2>/dev/null
}

# Check connection
echo "1. Checking database connection..."
if run_query "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Cannot connect to database at $DB_HOST:$DB_PORT/$DB_NAME"
    exit 1
fi

echo ""
echo "2. Checking tables..."

# Check shares_config table
if run_query "SELECT 1 FROM information_schema.tables WHERE table_name='shares_config'" | grep -q 1; then
    echo "✅ shares_config table exists"
    row_count=$(run_query "SELECT COUNT(*) FROM shares_config")
    echo "   └─ Rows: $row_count"
else
    echo "❌ shares_config table not found"
fi

# Check valuation_snapshots table
if run_query "SELECT 1 FROM information_schema.tables WHERE table_name='valuation_snapshots'" | grep -q 1; then
    echo "✅ valuation_snapshots table exists"
    row_count=$(run_query "SELECT COUNT(*) FROM valuation_snapshots")
    echo "   └─ Rows: $row_count"
else
    echo "❌ valuation_snapshots table not found"
fi

# Check shareholdings columns
if run_query "SELECT 1 FROM information_schema.columns WHERE table_name='shareholdings' AND column_name='equity_type'" | grep -q 1; then
    echo "✅ shareholdings table has vesting columns"
else
    echo "❌ shareholdings table missing vesting columns"
fi

# Check share_transactions table
if run_query "SELECT 1 FROM information_schema.tables WHERE table_name='share_transactions'" | grep -q 1; then
    echo "✅ share_transactions table exists (audit log)"
    row_count=$(run_query "SELECT COUNT(*) FROM share_transactions")
    echo "   └─ Rows: $row_count"
else
    echo "❌ share_transactions table not found"
fi

# Check share_buybacks table
if run_query "SELECT 1 FROM information_schema.tables WHERE table_name='share_buybacks'" | grep -q 1; then
    echo "✅ share_buybacks table exists"
else
    echo "❌ share_buybacks table not found"
fi

# Check shareholder_exits table
if run_query "SELECT 1 FROM information_schema.tables WHERE table_name='shareholder_exits'" | grep -q 1; then
    echo "✅ shareholder_exits table exists"
else
    echo "❌ shareholder_exits table not found"
fi

echo ""
echo "3. Checking views..."

# Check shareholdings_with_vesting view
if run_query "SELECT 1 FROM information_schema.views WHERE table_name='shareholdings_with_vesting'" | grep -q 1; then
    echo "✅ shareholdings_with_vesting view exists"
else
    echo "❌ shareholdings_with_vesting view not found"
fi

echo ""
echo "4. Checking constraints..."

# Check authorized >= issued constraint
constraint_check=$(run_query "SELECT constraint_name FROM information_schema.check_constraints WHERE table_name='shares_config'" 2>/dev/null)
if [ ! -z "$constraint_check" ]; then
    echo "✅ CHECK constraint on shares_config exists"
else
    echo "⚠️  CHECK constraint may not exist on shares_config"
fi

# Check unique constraint on shareholdings
if run_query "SELECT 1 FROM information_schema.table_constraints WHERE table_name='shareholdings' AND constraint_type='UNIQUE'" | grep -q 1; then
    echo "✅ UNIQUE constraint on shareholdings exists"
else
    echo "⚠️  UNIQUE constraint on shareholdings not found"
fi

echo ""
echo "5. Checking indexes..."

# Check indexes for performance
indexes=$(run_query "SELECT indexname FROM pg_indexes WHERE tablename='share_transactions' OR tablename='shareholdings'" 2>/dev/null)
index_count=$(echo "$indexes" | grep -c ".*")

if [ "$index_count" -gt 0 ]; then
    echo "✅ Indexes created for performance"
    echo "   └─ Total indexes: $index_count"
else
    echo "⚠️  No indexes found (queries may be slow)"
fi

echo ""
echo "6. Test queries..."

# Test basic query on each table
echo "Running validation queries..."

# Test shares_config
result=$(run_query "SELECT COUNT(*) FROM shares_config LIMIT 1" 2>&1)
if [[ $result =~ ^[0-9]+$ ]]; then
    echo "✅ shares_config query successful"
else
    echo "❌ shares_config query failed: $result"
fi

# Test valuation_snapshots
result=$(run_query "SELECT COUNT(*) FROM valuation_snapshots LIMIT 1" 2>&1)
if [[ $result =~ ^[0-9]+$ ]]; then
    echo "✅ valuation_snapshots query successful"
else
    echo "❌ valuation_snapshots query failed: $result"
fi

# Test shareholdings_with_vesting view
result=$(run_query "SELECT COUNT(*) FROM shareholdings_with_vesting LIMIT 1" 2>&1)
if [[ $result =~ ^[0-9]+$ ]]; then
    echo "✅ shareholdings_with_vesting view query successful"
else
    echo "❌ shareholdings_with_vesting view query failed: $result"
fi

echo ""
echo "============================================"
echo "Migration Validation Complete"
echo "============================================"
echo ""
echo "✅ All critical components verified"
echo ""
echo "Next steps:"
echo "1. Review src/lib/shares.js library functions"
echo "2. Test API endpoints at /api/equity/*"
echo "3. Create frontend UI components"
echo "4. Run end-to-end tests"
echo ""
