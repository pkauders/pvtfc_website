#!/usr/bin/env node

/**
 * PVTFC Static Site Generator
 *
 * Reads JSON data files and HTML templates, then generates
 * static HTML pages ready for GitHub Pages deployment.
 *
 * Usage: node build.js
 *
 * To edit site content, modify the JSON files in /data.
 * To edit page structure, modify templates in /src/templates.
 * To edit shared components, modify partials in /src/partials.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'templates');
const PARTIALS_DIR = path.join(ROOT, 'src', 'partials');
const DOCS_DIR = path.join(ROOT, 'docs');

// --- Load all data files ---
function loadData() {
  const data = {};
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const key = path.basename(file, '.json');
    data[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
  }
  return data;
}

// --- Load partials ---
function loadPartials() {
  const partials = {};
  const files = fs.readdirSync(PARTIALS_DIR).filter(f => f.endsWith('.html'));
  for (const file of files) {
    const key = path.basename(file, '.html');
    partials[key] = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf-8');
  }
  return partials;
}

// --- Template engine ---

/**
 * Simple template engine supporting:
 *   {{variable}}              - Variable interpolation
 *   {{nested.variable}}       - Dot-notation access
 *   {{#each array}}...{{/each}} - Array iteration (use {{this.prop}})
 *   {{#if condition}}...{{/if}} - Conditional blocks
 *   {{#if condition}}...{{else}}...{{/if}} - If/else
 *   {{> partialName}}         - Partial inclusion
 *   {{#unless condition}}...{{/unless}} - Negated conditional
 */
function resolvePath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return '';
    return acc[key];
  }, obj);
}

/**
 * Find the matching closing tag for a block, handling nesting.
 * Returns { body, rest } where body is the content inside the block
 * and rest is everything after {{/tag}}.
 * For if blocks, body may contain an {{else}} split.
 */
function findBlockEnd(content, tag) {
  const openPattern = new RegExp(`\\{\\{#(?:${tag}|if|each|unless)\\s`);
  const closePattern = new RegExp(`\\{\\{/(${tag}|if|each|unless)\\}\\}`);
  let depth = 1;
  let pos = 0;

  while (depth > 0 && pos < content.length) {
    const remaining = content.slice(pos);
    const openMatch = remaining.match(openPattern);
    const closeMatch = remaining.match(closePattern);

    if (!closeMatch) break;

    const openIdx = openMatch ? openMatch.index : Infinity;
    const closeIdx = closeMatch.index;

    if (openIdx < closeIdx) {
      depth++;
      pos += openIdx + openMatch[0].length;
    } else {
      depth--;
      if (depth === 0) {
        const body = content.slice(0, pos + closeIdx);
        const rest = content.slice(pos + closeIdx + closeMatch[0].length);
        return { body, rest };
      }
      pos += closeIdx + closeMatch[0].length;
    }
  }

  return { body: content, rest: '' };
}

function render(template, context, partials) {
  let output = '';
  let remaining = template;

  while (remaining.length > 0) {
    // Find the next {{ tag
    const tagIdx = remaining.indexOf('{{');
    if (tagIdx === -1) {
      output += remaining;
      break;
    }

    // Add everything before the tag
    output += remaining.slice(0, tagIdx);
    remaining = remaining.slice(tagIdx);

    // Partial: {{> name}}
    const partialMatch = remaining.match(/^\{\{>\s*(\w+)\s*\}\}/);
    if (partialMatch) {
      const name = partialMatch[1];
      const partial = partials[name];
      if (!partial) {
        console.warn(`Warning: Partial "${name}" not found`);
      } else {
        output += render(partial, context, partials);
      }
      remaining = remaining.slice(partialMatch[0].length);
      continue;
    }

    // Block: {{#each path}}
    const eachMatch = remaining.match(/^\{\{#each\s+([\w.]+)\}\}/);
    if (eachMatch) {
      remaining = remaining.slice(eachMatch[0].length);
      const { body, rest } = findBlockEnd(remaining, 'each');
      const arr = resolvePath(context, eachMatch[1]);
      if (Array.isArray(arr)) {
        output += arr.map((item, index) => {
          const itemContext = { ...context, this: item, '@index': index, '@first': index === 0, '@last': index === arr.length - 1 };
          return render(body, itemContext, partials);
        }).join('');
      }
      remaining = rest;
      continue;
    }

    // Block: {{#if path}}
    const ifMatch = remaining.match(/^\{\{#if\s+([\w.]+)\}\}/);
    if (ifMatch) {
      remaining = remaining.slice(ifMatch[0].length);
      const { body, rest } = findBlockEnd(remaining, 'if');
      const val = resolvePath(context, ifMatch[1]);

      // Check for {{else}} at the top level of this block
      let ifBody = body;
      let elseBody = '';
      // Find top-level {{else}} (not inside nested blocks)
      let depth = 0;
      for (let i = 0; i < body.length; i++) {
        if (body.slice(i).startsWith('{{#')) depth++;
        if (body.slice(i).match(/^\{\{\/(if|each|unless)\}\}/)) depth--;
        if (depth === 0 && body.slice(i).startsWith('{{else}}')) {
          ifBody = body.slice(0, i);
          elseBody = body.slice(i + '{{else}}'.length);
          break;
        }
      }

      output += render(val ? ifBody : elseBody, context, partials);
      remaining = rest;
      continue;
    }

    // Block: {{#unless path}}
    const unlessMatch = remaining.match(/^\{\{#unless\s+([\w.]+)\}\}/);
    if (unlessMatch) {
      remaining = remaining.slice(unlessMatch[0].length);
      const { body, rest } = findBlockEnd(remaining, 'unless');
      const val = resolvePath(context, unlessMatch[1]);
      if (!val) {
        output += render(body, context, partials);
      }
      remaining = rest;
      continue;
    }

    // Variable: {{path}}
    const varMatch = remaining.match(/^\{\{([\w.@]+)\}\}/);
    if (varMatch) {
      const val = resolvePath(context, varMatch[1]);
      if (val !== undefined && val !== null) {
        output += String(val);
      }
      remaining = remaining.slice(varMatch[0].length);
      continue;
    }

    // Not a recognized tag, output literally
    output += '{{';
    remaining = remaining.slice(2);
  }

  return output;
}

// --- Build ---
function build() {
  console.log('Building PVTFC site...\n');

  const data = loadData();
  const partials = loadPartials();

  // Ensure output directory
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Process each template
  const templates = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.html'));

  for (const file of templates) {
    const template = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');

    // Build page-specific context
    const pageName = path.basename(file, '.html');
    const context = {
      ...data,
      page: pageName,
      [`page_${pageName}`]: true
    };

    const html = render(template, context, partials);
    const outPath = path.join(DOCS_DIR, file);
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`  Built: ${file}`);
  }

  // Copy assets
  copyDir(path.join(ROOT, 'assets'), path.join(DOCS_DIR, 'assets'));
  console.log('  Copied: assets/\n');

  console.log(`Done! ${templates.length} pages built to /docs`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

build();
