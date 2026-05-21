/**
 * Custom Jest transform: ESM-style import/export → CJS require()
 * Relies only on @babel/core (already installed as dev dep).
 */
const core = require('@babel/core');

/**
 * Converts ESM import/export to CJS emitFormats: ['cjs'],
 *  keeping everything else as-is.
 */
function esmToCjs(source, filename) {
  // Transform options: modules = commonjs, but we ONLY apply the module transform.
  // No syntax presets needed since Node 24 already handles modern JS syntax.
  const result = core.transformSync(source, {
    filename,
    presets: [],
    plugins: [
      // Core module transform: import → require, export → module.exports
      ['@babel/plugin-transform-modules-commonjs', {
        noInterop: false,       // add interopRequireDefault helper
        strictMode: false       // don't wrap in strict
      }],
      // Wrap all export declarations as named exports on module.exports
      // (babel/cjs does this automatically, but let's double-check)
    ],
    sourceType: 'module',
    configFile: false
  });
  return { code: result.code };
}

module.exports = esmToCjs;
