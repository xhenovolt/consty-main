#!/usr/bin/env node
/**
 * Consty UI Contrast Checker (Part 15)
 * 
 * Flags dangerous color combinations that cause invisible text:
 *   - text-white without a colored/dark background context
 *   - text-gray-* without dark: counterpart (in app pages)
 *   - bg-white without dark: counterpart
 *   - hardcoded oklch/hsl vars in CSS
 * 
 * Run: node scripts/check-contrast.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const ISSUES = [];
let filesChecked = 0;

// Patterns that indicate likely contrast failures
const DANGER_PATTERNS = [
  {
    pattern: /\bbg-white(?!\/)\b(?!.*dark:bg-)/g,
    label: 'bg-white without dark: counterpart',
    severity: 'error',
    fix: 'Use bg-card or bg-background instead',
  },
  {
    pattern: /\btext-white\b(?!.*(?:bg-blue|bg-green|bg-red|bg-purple|bg-emerald|bg-orange|bg-gradient|from-))/g,
    label: 'text-white potentially without colored background',
    severity: 'warning',
    fix: 'Use text-foreground for semantic text; keep text-white only on colored bg',
  },
  {
    pattern: /\btext-gray-(?:900|800|700)\b(?!.*dark:text-)/g,
    label: 'text-gray-[900|800|700] without dark: counterpart',
    severity: 'error',
    fix: 'Use text-foreground',
  },
  {
    pattern: /\btext-gray-(?:600|500|400)\b(?!.*dark:text-)/g,
    label: 'text-gray-[600|500|400] without dark: counterpart',
    severity: 'error',
    fix: 'Use text-muted-foreground',
  },
  {
    pattern: /\bborder-gray-(?:100|200|300)\b(?!.*dark:border-)/g,
    label: 'border-gray-[100|200|300] without dark: counterpart',
    severity: 'warning',
    fix: 'Use border-border',
  },
  {
    pattern: /\bbg-gray-(?:50|100)\b(?!.*dark:bg-)/g,
    label: 'bg-gray-[50|100] without dark: counterpart',
    severity: 'warning',
    fix: 'Use bg-muted',
  },
  {
    pattern: /oklch\([\d.]+ [\d.]+ [\d.]+\)/g,
    label: 'Raw oklch() value (incompatible with rgb() token system)',
    severity: 'error',
    fix: 'Use raw RGB channel values in CSS vars: e.g. 255 255 255',
  },
  {
    pattern: /hsl\(var\(--/g,
    label: 'hsl(var(--*)) format (incompatible with raw RGB channel values)',
    severity: 'error',
    fix: 'Change to rgb(var(--*) / <alpha-value>)',
  },
];

function walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.next', '.git'].includes(entry.name)) {
      files.push(...walkDir(full));
    } else if (entry.isFile() && ['.js', '.jsx', '.ts', '.tsx', '.css'].includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function checkFile(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  filesChecked++;
  
  // Skip docs pages and animation CSS which intentionally use decorative colors
  if (filepath.includes('/docs/') || filepath.includes('AnimatedAuthBackground')) return;

  for (const { pattern, label, severity, fix } of DANGER_PATTERNS) {
    // Reset regexp state
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(content)) !== null) {
      const lineIndex = content.substring(0, match.index).split('\n').length - 1;
      const lineContent = lines[lineIndex].trim().substring(0, 100);
      ISSUES.push({ filepath, line: lineIndex + 1, severity, label, fix, snippet: lineContent });
    }
  }
}

console.log('🔍 Consty Contrast Checker\n');
const allFiles = walkDir(SRC_DIR);
allFiles.forEach(checkFile);

const errors = ISSUES.filter(i => i.severity === 'error');
const warnings = ISSUES.filter(i => i.severity === 'warning');

if (ISSUES.length === 0) {
  console.log(`✅ No contrast issues found in ${filesChecked} files!\n`);
} else {
  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    for (const { filepath, line, label, fix, snippet } of errors.slice(0, 20)) {
      const rel = filepath.replace(process.cwd() + '/', '');
      console.log(`  ${rel}:${line}`);
      console.log(`    Problem : ${label}`);
      console.log(`    Fix     : ${fix}`);
      console.log(`    Code    : ${snippet}`);
      console.log();
    }
  }
  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    for (const { filepath, line, label, fix, snippet } of warnings.slice(0, 10)) {
      const rel = filepath.replace(process.cwd() + '/', '');
      console.log(`  ${rel}:${line} — ${label}`);
    }
    console.log();
  }
  console.log(`Summary: ${errors.length} errors, ${warnings.length} warnings in ${filesChecked} files`);
  if (errors.length > 0) process.exit(1);
}
