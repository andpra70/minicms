import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  base: './',
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // Plugin per gestire il salvataggio del sito statico in public/
    {
      name: 'save-static-html',
      configResolved() {},
      apply: 'serve',
      middlewares: [
        (req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/save-static-html') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const { html } = JSON.parse(body);
                const publicPath = path.join(__dirname, 'public', 'sito-statico.html');
                fs.writeFileSync(publicPath, html, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'File salvato in public/sito-statico.html' }));
              } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: (error as Error).message }));
              }
            });
            return;
          }
          next();
        }
      ]
    }
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    proxy: {
      '/fileserver': {
        target: 'https://zanotti.iliadboxos.it:55443',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Copia la cartella public nella dist
  publicDir: 'public',
})
