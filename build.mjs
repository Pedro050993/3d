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

// Variante para publicar como página do claude.ai: o publicador envolve o
// conteúdo no próprio esqueleto, então saem doctype, html, head e body.
const cabeca = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<title>[^<]*<\/title>/, '<title>Obras 3D</title>');
const corpo = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
writeFileSync('dist/artifact.html', cabeca.trim() + '\n' + corpo.trim() + '\n');
console.log('dist/artifact.html gerado');
