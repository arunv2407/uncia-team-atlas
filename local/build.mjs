import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=await import('../node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js');
await fs.mkdir('local-dist',{recursive:true});
await build({entryPoints:['local/entry.tsx'],bundle:true,format:'esm',platform:'browser',target:'es2022',outdir:'local-dist',entryNames:'app',minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
for(const name of ['seed','model'])await build({entryPoints:[`app/${name}.ts`],bundle:true,platform:'node',format:'esm',outfile:`local-dist/${name}.mjs`,target:'node24'});
await fs.writeFile('local-dist/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UNCIA | Team Atlas</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>');
console.log('Standalone local build ready. No ChatGPT sign-in or hosted runtime is used.');
