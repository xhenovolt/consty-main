#!/usr/bin/env node

/**
 * MARKDOWN INGESTION ENGINE - Ingest existing markdown files into system_intelligence
 * 
 * Usage:
 *   node scripts/ingest-markdown.mjs [system-name] [directory]
 * 
 * Examples:
 *   node scripts/ingest-markdown.mjs "Consty" .
 *   node scripts/ingest-markdown.mjs "Drais" ./Documentation
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, extname } from 'path';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Category detection rules
const CATEGORY_PATTERNS = {
  architecture: ['architecture', 'design', 'diagram', 'structure'],
  feature: ['feature', 'capability', 'function'],
  bug_fix: ['bug', 'fix', 'issue', 'hotfix'],
  deployment: ['deploy', 'release', 'production', 'launch', 'rollout'],
  decision: ['decision', 'rfc', 'adr', 'choice'],
  integration: ['integration', 'connect', 'api', 'webhook'],
  performance: ['performance', 'optimization', 'benchmark', 'speed'],
  security: ['security', 'auth', 'encryption', 'permission', 'rbac'],
  scaling: ['scale', 'load', 'concurrent'],
  api: ['api', 'endpoint', 'rest', 'graphql'],
  database: ['database', 'schema', 'migration', 'sql'],
  infrastructure: ['infra', 'docker', 'kubernetes', 'deployment', 'devops'],
  guide: ['guide', 'quick', 'tutorial', 'how', 'manual', 'documentation'],
  troubleshooting: ['troubleshoot', 'error', 'problem', 'debug', 'resolve'],
  release_notes: ['release', 'changelog', 'notes', 'version', 'update'],
};

function detectCategory(filename, content) {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Check filename
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerFilename.includes(pattern)) {
        return category;
      }
    }
  }
  
  // Check content (first 500 chars)
  const contentSnippet = content.substring(0, 500).toLowerCase();
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (contentSnippet.includes(pattern)) {
        return category;
      }
    }
  }
  
  return 'guide'; // Default
}

function extractTags(filename, category) {
  const tags = [];
  
  // Add category as tag
  tags.push(category);
  
  // Extract common tags from filename
  if (filename.includes('quick')) tags.push('quick-reference');
  if (filename.includes('implementation')) tags.push('implementation');
  if (filename.includes('complete')) tags.push('complete');
  if (filename.includes('integration')) tags.push('integration');
  if (filename.includes('deployment')) tags.push('deployment');
  if (filename.includes('schema')) tags.push('database-schema');
  if (filename.includes('rbac')) tags.push('access-control');
  if (filename.includes('system')) tags.push('system-design');
  
  return [...new Set(tags)];
}

function collectMarkdownFiles(dir, excludePatterns = []) {
  const files = [];
  const defaultExcludes = ['node_modules', '.next', '.git', 'Backup', '.env'];
  const excludes = [...defaultExcludes, ...excludePatterns];
  
  function walkDir(dirPath) {
    try {
      const entries = readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = resolve(dirPath, entry);
        const stat = statSync(fullPath);
        
        // Skip excluded directories
        if (excludes.some(exc => fullPath.includes(`/${exc}/`) || fullPath.endsWith(`/${exc}`))) {
          continue;
        }
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (extname(fullPath).match(/\.(md|txt)$/i)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not read ${dirPath}: ${err.message}`);
    }
  }
  
  walkDir(dir);
  return files;
}

async function getOrCreateSystem(systemName) {
  // Try to find existing system
  let result = await pool.query(
    'SELECT id FROM systems WHERE name = $1 OR name ILIKE $2',
    [systemName, `${systemName}%`]
  );
  
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  
  // Create new system
  result = await pool.query(
    `INSERT INTO systems (name, description, status)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [systemName, `${systemName} system - auto-created during MD ingestion`, 'active']
  );
  
  return result.rows[0].id;
}

async function ingestFile(systemId, filePath, baseDir) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const filename = relative(baseDir, filePath);
    const title = filename.replace(/\.(md|txt)$/i, '').replace(/[-_]/g, ' ');
    
    // Detect category
    const category = detectCategory(filename, content);
    const tags = extractTags(filename, category);
    
    // Extract summary
    const lines = content.split('\n');
    const summaryLines = [];
    let inCodeBlock = false;
    
    for (const line of lines) {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (!inCodeBlock && !line.startsWith('#') && line.trim().length > 0) {
        summaryLines.push(line);
        if (summaryLines.join(' ').length > 200) break;
      }
    }
    
    const summary = summaryLines.join(' ').substring(0, 500);
    
    // Check for duplicates
    const hashResult = await pool.query(
      `SELECT id FROM markdown_ingestion_jobs
       WHERE system_id = $1 AND filename = $2`,
      [systemId, filename]
    );
    
    if (hashResult.rows[0]) {
      return { status: 'skipped', filename, reason: 'Already ingested' };
    }
    
    // Create intelligence entry
    const result = await pool.query(
      `INSERT INTO system_intelligence
       (system_id, title, category, content, summary, tags, created_by, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, true)
       RETURNING id`,
      [systemId, title, category, content, summary, tags]
    );
    
    const intelligenceId = result.rows[0].id;
    
    // Log ingestion job
    await pool.query(
      `INSERT INTO markdown_ingestion_jobs
       (system_id, job_status, file_path, filename, content, category_assigned, intelligence_id, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [systemId, 'completed', filePath, filename, content, category, intelligenceId]
    );
    
    return {
      status: 'success',
      filename,
      title,
      category,
      tagsCount: tags.length,
      intelligenceId,
    };
  } catch (err) {
    console.error(`Error ingesting ${filePath}:`, err.message);
    return {
      status: 'error',
      filename: filePath,
      error: err.message,
    };
  }
}

async function main() {
  const systemName = process.argv[2] || 'Consty';
  const searchDir = process.argv[3] || '.';
  
  console.log(`\n🚀 Markdown Ingestion Engine`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`System: ${systemName}`);
  console.log(`Directory: ${resolve(searchDir)}\n`);
  
  try {
    // Get or create system
    console.log('📦 Getting system ID...');
    const systemId = await getOrCreateSystem(systemName);
    console.log(`✓ System ID: ${systemId}\n`);
    
    // Collect markdown files
    console.log('🔍 Scanning for markdown files...');
    const mdFiles = collectMarkdownFiles(searchDir);
    console.log(`✓ Found ${mdFiles.length} markdown files\n`);
    
    if (mdFiles.length === 0) {
      console.log('⚠️  No markdown files found. Exiting.');
      await pool.end();
      process.exit(0);
    }
    
    // Ingest files
    console.log('📥 Ingesting files...\n');
    const results = [];
    
    for (let i = 0; i < mdFiles.length; i++) {
      const file = mdFiles[i];
      process.stdout.write(`[${i + 1}/${mdFiles.length}] Ingesting ${relative(searchDir, file)}...`);
      
      const result = await ingestFile(systemId, file, searchDir);
      results.push(result);
      
      if (result.status === 'success') {
        console.log(' ✓');
      } else if (result.status === 'skipped') {
        console.log(' ⊘ (already ingested)');
      } else {
        console.log(' ✗');
      }
    }
    
    // Summary
    const successful = results.filter(r => r.status === 'success').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'error').length;
    
    console.log(`\n${'━'.repeat(50)}`);
    console.log(`\n📊 Ingestion Summary:`);
    console.log(`  ✓ Successful: ${successful}`);
    console.log(`  ⊘ Skipped: ${skipped}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log(`  Total: ${mdFiles.length}\n`);
    
    // Update system intelligence score
    if (successful > 0) {
      await pool.query(
        `UPDATE systems 
         SET has_intelligence = true, 
             last_intelligence_update = NOW(),
             intelligence_score = LEAST(100, intelligence_score + $1)
         WHERE id = $2`,
        [Math.min(successful * 2, 50), systemId]
      );
      console.log(`✓ Updated system intelligence metadata\n`);
    }
    
    console.log('✨ Ingestion complete!\n');
    await pool.end();
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
