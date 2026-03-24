// Build script: bundles CodeMirror 6 into a single ESM file
// so there's only ONE @codemirror/state instance (no CDN dedup issue)
import { build } from 'esbuild';

await build({
  entryPoints: ['./cm-entry.mjs'],
  bundle: true,
  format: 'esm',
  outfile: './public/cm-bundle.js',
  minify: false,
  external: [],   // bundle everything — no external deps
});

console.log('✅ cm-bundle.js built');
