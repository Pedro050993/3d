// Gera dist/index.html: um único arquivo com JS e CSS embutidos, que abre
// direto no navegador (duplo clique) sem servidor.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const r = await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');
const html = readFileSync('src/index.html', 'utf8')
  .replace('<!--CSS-->', () => `<style>${css}</style>`)
  .replace('<!--JS-->', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
