/**
 * jest-esm-transformer.cjs
 * 
 * A standalone CommonJS transform that converts ESM import/export syntax to
 * CommonJS require/module.exports so Jest (CJS runner) can process ESM test files.
 * Uses ONLY @babel/core (already installed) – no extra npm packages needed.
 */
const core = require('@babel/core');

/**
 * Transform a single file:
 * 1. Convert `import X from 'Y'` / `import { X }` / `import * as X` → require(X)
 * 2. Convert `export class/function/const/let/var X` → assignments on module.exports
 * 3. Strip `export default`
 * Leaves all non-import/export JavaScript syntax untouched.
 */
function transform(src, filename) {
  const lines = src.split(/\r?\n/);
  
  // Track which imports came from which path for interop (default vs named vs *)
  const importedNames = [];
  const starImports = new Set();
  const defaultImports = new Map(); // localName => fromPath
  
  let out = [];
  
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    
    // Skip existing export lines - handle all export syntax
    if (/^\s*export\s+default\s+/.test(l)) {
      // export default Something  →  module.exports.default = Something
      // We need local indent to preserve formatting
      const indent = l.match(/^\s*/)[0];
      const name = l.replace(/^\s*export\s+default\s+/, '').replace(/;\s*$/, '').trim();
      out.push(indent + 'module.exports.default = ' + name + ';');
      importedNames.push(name);
      continue;
    }
    
    if (/^\s*export\s+(\w+)\s/.test(l)) {
      // export const/function/class X = ...
      const indent = l.match(/^\s*/)[0];
      // Remove 'export ' prefix
      const code = l.replace(/^\s*export\s+/, '');
      // If it's an assignment (const/function/class X = Y), also export to module.exports
      const match = code.match(/^((?:const|function|class)\s+\w+\s*=\s*)/);
      if (match) {
        const rest = code.substring(match[1].length);
        const assignee = code.replace(/^(\w+)\s+/, '').replace(/\s*;?\s*$/, ''); // the whole expression
        const name = code.replace(/^(\w+)\s+/, ''); // after the keyword
        // Simpler: just remove 'export ' prefix and add module.exports assignment
        const nameMatch = code.match(/^(?:const|function|class)\s+(\w+)/);
        if (nameMatch) {
          const varName = nameMatch[1];
          out.push(indent + code);
          out.push(indent + 'if (!module.exports.' + varName + ') module.exports.' + varName + ' = ' + varName + ';');
          importedNames.push(varName);
          continue;
        }
      }
      out.push(l);
      continue;
    }
    
    if (/^\s*export\s*\{/.test(l)) {
      // export { A, B }  → require from already-extracted require vars
      // Handle inline: export { A, B } from './mod'
      const fromMatch = l.match(/export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
      if (fromMatch) {
        const names = fromMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        const mod = fromMatch[2];
        const indent = l.match(/^\s*/)[0];
        const varName = '$_' + mod.replace(/[^a-zA-Z]/g, '_');
        if (!importedNames.includes(varName)) {
          out.push(indent + 'const ' + varName + ' = require(' + JSON.stringify(mod) + ');');
          importedNames.push(varName);
        }
        for (const n of names) {
          out.push(indent + 'module.exports.' + n + ' = ' + varName + '.' + n + ';');
        }
        continue;
      }
      // Simple re-export: handle inline
      out.push(l);
      continue;
    }
    
    // Matches top-level import statements only
    if (/^\s*import\s+/.test(l) && !/\s*function\s*\(/.test(l)) {
      const indent = l.match(/^\s*/)[0];
      
      // import * as X from 'Y'
      const starMatch = l.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (starMatch) {
        const localName = starMatch[1];
        const modPath = starMatch[2];
        const varName = '$' + localName;
        out.push(indent + 'const ' + varName + ' = require(' + JSON.stringify(modPath) + ');');
        // Setup interop: if it's ESM default, wrap in { default: ... }
        out.push(indent + 'if (' + varName + ' && !(' + varName + '.__esModule)) {');
        out.push(indent + '  Object.defineProperty(' + varName + ', \'__esModule\', { value: true });');
        out.push(indent + '  Object.keys(' + varName + ').forEach(k => { if (!(k in module.exports)) module.exports[k] = ' + varName + '[k]; });');
        out.push(indent + '}');
        starImports.add(varName);
        importedNames.push(varName);
        continue;
      }
      
      // import X from 'Y'   (default import)
      const defaultMatch = l.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (defaultMatch && defaultMatch[1] !== 'React' && defaultMatch[1] !== 'useState' && defaultMatch[1] !== 'useEffect' && defaultMatch[1] !== 'Fragment') {
        const localName = defaultMatch[1];
        const modPath = defaultMatch[2];
        const varName = '$' + localName;
        out.push(indent + 'const ' + varName + ' = require(' + JSON.stringify(modPath) + ');');
        out.push(indent + 'const ' + localName + ' = (' + varName + '.default != null) ? ' + varName + '.default : ' + varName + ';');
        importedNames.push(localName);
        continue;
      }
      
      // import { A, B as C } from 'Y'
      const namedMatch = l.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
      if (namedMatch) {
        const namesSpec = namedMatch[1];
        const modPath = namedMatch[2];
        const varName = '$_' + modPath.replace(/[^a-zA-Z]/g, '_');
        out.push(indent + 'const ' + varName + ' = require(' + JSON.stringify(modPath) + ');');
        out.push(indent + 'const _default = (' + varName + '.default != null) ? ' + varName + '.default : ' + varName + ';');
        
        // Split names handling `as` renames
        const specs = namesSpec.split(',').map(s => {
          const [orig, alias] = s.trim().split(/\s+as\s+/);
          return { orig: orig.trim(), alias: alias ? alias.trim() : orig.trim() };
        });
        
        for (const s of specs) {
          out.push(indent + 'const ' + s.alias + ' = _default.' + s.orig + ' !== undefined ? _default.' + s.orig + ' : ' + varName + '.' + s.orig + ';');
        }
        continue;
      }
    }
    
    out.push(l);
  }
  
  // Ensure module.exports exists for export targets
  const hasExport = src.includes('export ') || src.includes('module.exports');
  
  return {
    code: out.join('\n'),
    hasExportDefault: src.includes('export default'),
  };
}

module.exports = transform;
