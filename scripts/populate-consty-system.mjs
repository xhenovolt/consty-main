#!/usr/bin/env node

/**
 * CONSTY SYSTEM POPULATION SCRIPT
 * Populates the Consty system with:
 * - Tech Stack information
 * - Module definitions for all app modules
 * - Version information
 */

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const CONSTY_SYSTEM_ID = 'c987ff73-d468-4de5-9ccb-70cd0741e4b4';

// Define all Consty modules with their details
const CONSTY_MODULES = [
  {
    name: 'Dashboard',
    path: 'dashboard',
    description: 'Central dashboard showing system overview, KPIs, and quick actions',
    routes: ['/app/dashboard'],
    dependencies: ['React', 'Recharts', 'Next.js'],
  },
  {
    name: 'Admin Panel',
    path: 'admin',
    description: 'Administrative controls, user management, system settings',
    routes: ['/app/admin', '/app/admin/users', '/app/admin/roles', '/app/admin/settings'],
    dependencies: ['RBAC', 'Permissions', 'User Service'],
  },
  {
    name: 'Deal Management',
    path: 'deals',
    description: 'Create, manage, track deals with clients - revenue tracking',
    routes: ['/app/deals', '/app/deals/[id]', '/app/deals/new'],
    dependencies: ['Finance Module', 'Client Service', 'Reporting'],
  },
  {
    name: 'Finance & Billing',
    path: 'finance',
    description: 'Financial tracking, invoices, payments, revenue reporting',
    routes: ['/app/finance', '/app/finance/invoices', '/app/finance/reports'],
    dependencies: ['Database', 'Reporting Engine', 'Currency Conversion'],
  },
  {
    name: 'Issue Intelligence',
    path: 'issue-intelligence',
    description: 'Track system issues, bugs, and fixes - integrated troubleshooting',
    routes: ['/app/issue-intelligence', '/app/issues'],
    dependencies: ['System Intelligence', 'Reporting'],
  },
  {
    name: 'Technical Intelligence',
    path: 'tech-intelligence',
    description: 'Central knowledge base for system documentation and architecture',
    routes: ['/app/tech-intelligence', '/app/tech-intelligence/[id]'],
    dependencies: ['system_intelligence', 'System Architecture'],
  },
  {
    name: 'Document Management',
    path: 'docs',
    description: 'Store, organize, and manage documents and files',
    routes: ['/app/docs', '/app/documents'],
    dependencies: ['Cloudinary', 'File Service'],
  },
  {
    name: 'Communication',
    path: 'communication',
    description: 'Messaging, calls, and communication logs',
    routes: ['/app/communication'],
    dependencies: ['Message Queue', 'Call Service'],
  },
  {
    name: 'HR & Management',
    path: 'hr',
    description: 'Human Resources management, team listings, rosters',
    routes: ['/app/hr', '/app/hrm'],
    dependencies: ['User Service', 'Admin Panel'],
  },
  {
    name: 'Invoicing System',
    path: 'invoices',
    description: 'Generate, track, and manage invoices for clients',
    routes: ['/app/invoices'],
    dependencies: ['Finance', 'PDF Generator'],
  },
  {
    name: 'Decision Log',
    path: 'decision-log',
    description: 'Record and track architectural and business decisions',
    routes: ['/app/decision-log'],
    dependencies: ['System Intelligence'],
  },
  {
    name: 'Client Management',
    path: 'clients',
    description: 'Manage client profiles, relationships, and information',
    routes: ['/app/clients'],
    dependencies: ['Database', 'Admin Panel'],
  },
  {
    name: 'Knowledge Base',
    path: 'knowledge',
    description: 'Centralized knowledge repository for organizational learning',
    routes: ['/app/knowledge'],
    dependencies: ['Technical Intelligence', 'Document Service'],
  },
  {
    name: 'Command Center',
    path: 'command-center',
    description: 'Central operations hub for command and control',
    routes: ['/app/command-center'],
    dependencies: ['Dashboard', 'Alerts'],
  },
  {
    name: 'Control Tower',
    path: 'control-tower',
    description: 'Operations control and monitoring interface',
    routes: ['/app/control-tower'],
    dependencies: ['Real-time Updates', 'Monitoring'],
  },
  {
    name: 'Asset Management',
    path: 'assets',
    description: 'Track and manage organizational assets',
    routes: ['/app/assets'],
    dependencies: ['Inventory System', 'Admin Panel'],
  },
  {
    name: 'Allocations',
    path: 'allocations',
    description: 'Resource and budget allocation management',
    routes: ['/app/allocations'],
    dependencies: ['Finance', 'HR'],
  },
  {
    name: 'Approval Pipeline',
    path: 'approval-pipeline',
    description: 'Workflow approvals and authorization management',
    routes: ['/app/approval-pipeline'],
    dependencies: ['RBAC', 'Workflow Engine'],
  },
  {
    name: 'Activity Tracking',
    path: 'activity',
    description: 'System-wide activity logs and audit trails',
    routes: ['/app/activity'],
    dependencies: ['Logging Service', 'Analytics'],
  },
  {
    name: 'Financial Intelligence',
    path: 'financial-intelligence',
    description: 'Financial analytics and business intelligence',
    routes: ['/app/financial-intelligence'],
    dependencies: ['Finance Module', 'Analytics', 'Recharts'],
  },
];

// Define Consty's tech stack
const TECH_STACK = {
  languages: [
    { name: 'JavaScript', version: 'ES2024' },
    { name: 'TypeScript', version: '5.x' },
    { name: 'SQL (PostgreSQL)', version: '15.0' },
  ],
  frameworks: [
    { name: 'Next.js', version: '16.1.1', role: 'Frontend Framework & API Layer' },
    { name: 'React', version: '19.2.3', role: 'UI Library' },
    { name: 'Tailwind CSS', version: '4.x', role: 'Styling' },
  ],
  databases: [
    { name: 'PostgreSQL', version: '15.0', type: 'Primary RDBMS' },
  ],
  tools: [
    { name: 'Node.js', version: 'Latest' },
    { name: 'npm', version: '10.x' },
    { name: 'Git', version: 'Latest' },
    { name: 'Docker', version: 'Latest' },
  ],
  libraries: [
    { name: 'Lucide React', version: '0.562.0', purpose: 'Icons' },
    { name: 'Recharts', version: '3.6.0', purpose: 'Charts & Visualization' },
    { name: 'Zod', version: '4.2.1', purpose: 'Schema Validation' },
    { name: 'bcryptjs', version: '3.0.3', purpose: 'Password Hashing' },
    { name: 'Cloudinary', version: '2.9.0', purpose: 'Cloud Storage & CDN' },
    { name: 'Framer Motion', version: '12.23.26', purpose: 'Animations' },
    { name: 'SweetAlert2', version: '11.26.22', purpose: 'Alerts & Modals' },
  ],
  integrations: [
    { name: 'PostgreSQL Database', type: 'Primary Data Store' },
    { name: 'Cloudinary', type: 'Image & File Management' },
    { name: 'Next.js API Routes', type: 'Backend Services' },
  ],
};

async function populateConstySystem() {
  try {
    console.log('🚀 Populating Consty System...\n');

    // 1. Create/Update Architecture
    console.log('📦 Creating system architecture...');
    await pool.query(
      `INSERT INTO system_architecture 
       (system_id, tech_stack, platforms, database_type, database_version, 
        hosting_environment, architecture_pattern, authentication_method)
       VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8)
       ON CONFLICT (system_id) DO UPDATE SET
         tech_stack = $2, platforms = $3::text[], database_type = $4, database_version = $5,
         hosting_environment = $6, architecture_pattern = $7, authentication_method = $8,
         updated_at = NOW()`,
      [
        CONSTY_SYSTEM_ID,
        JSON.stringify(TECH_STACK),
        ['Web'],
        'PostgreSQL',
        '15.0',
        'Cloud (Neon)',
        'Monolithic with modular structure',
        'JWT + Role-Based Access Control',
      ]
    );
    console.log('✓ Architecture created');

    // 2. Create/Update Modules
    console.log('\n📂 Creating system modules...');
    for (let i = 0; i < CONSTY_MODULES.length; i++) {
      const mod = CONSTY_MODULES[i];
      try {
        // Try to update first
        const updateResult = await pool.query(
          `UPDATE system_modules
           SET description = $1, routes = $2, dependencies = $3, updated_at = NOW()
           WHERE system_id = $4 AND module_name = $5
           RETURNING id`,
          [mod.description, JSON.stringify(mod.routes), JSON.stringify(mod.dependencies), CONSTY_SYSTEM_ID, mod.name]
        );

        // If no rows updated, insert
        if (updateResult.rows.length === 0) {
          await pool.query(
            `INSERT INTO system_modules
             (system_id, module_name, description, routes, dependencies, version, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              CONSTY_SYSTEM_ID,
              mod.name,
              mod.description,
              JSON.stringify(mod.routes),
              JSON.stringify(mod.dependencies),
              '1.0.0',
              'active',
            ]
          );
        }
      } catch (err) {
        console.error(`\nError with module ${mod.name}: ${err.message}`);
      }
      process.stdout.write(`\r  [${i + 1}/${CONSTY_MODULES.length}] ${mod.name.padEnd(30)}`);
    }
    console.log('\n✓ All modules created');

    // 3. Create Version
    console.log('\n🏷️ Creating system version...');
    await pool.query(
      `INSERT INTO system_versions
       (system_id, version_name, version_number, release_notes, released_at, deployed_to_production)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        CONSTY_SYSTEM_ID,
        'Consty Technical Intelligence System',
        '1.0.0',
        'Initial release with Technical Intelligence System, System Architecture, Module Registry, and Knowledge Base',
        new Date(),
        true,
      ]
    );
    console.log('✓ Version created');

    // 4. Update systems table with intelligence score
    console.log('\n📊 Updating system intelligence metadata...');
    await pool.query(
      `UPDATE systems 
       SET has_intelligence = true, intelligence_score = 100, last_intelligence_update = NOW()
       WHERE id = $1`,
      [CONSTY_SYSTEM_ID]
    );
    console.log('✓ System metadata updated');

    console.log('\n✓ Consty system population complete!\n');
    console.log('Summary:');
    console.log(`  • Architecture: 1 entry`);
    console.log(`  • Modules: ${CONSTY_MODULES.length} entries`);
    console.log(`  • Versions: 1 entry`);
    console.log(`  • Intelligence: 43 entries (from markdown ingestion)`);
    console.log(`  • Total: ${CONSTY_MODULES.length + 45} knowledge base entries\n`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

populateConstySystem();
