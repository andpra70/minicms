import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Leggi il file HTML di build
const distPath = path.join(__dirname, '../dist')
const buildPath = path.join(__dirname, '../build')

// Crea la cartella build se non esiste
if (!fs.existsSync(buildPath)) {
  fs.mkdirSync(buildPath, { recursive: true })
}

// Copia index.html dalla cartella dist alla cartella build
const indexPath = path.join(distPath, 'index.html')
const buildIndexPath = path.join(buildPath, 'index.html')

if (fs.existsSync(indexPath)) {
  let htmlContent = fs.readFileSync(indexPath, 'utf8')
  
  // Rimuovi i riferimenti a JavaScript e CSS per HTML puro
  htmlContent = htmlContent.replace(/<script[^>]*><\/script>/g, '')
  htmlContent = htmlContent.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
  
  // Sostituisci il contenuto del div root con contenuto statico di base
  htmlContent = htmlContent.replace(
    '<div id="root"></div>',
    `<div id="root">
      <h1>MiniCMS Static</h1>
      <p>Sito generato staticamente</p>
      <nav>
        <ul>
          <li><a href="#home">Home</a></li>
          <li><a href="#about">About</a></li>
        </ul>
      </nav>
      <main>
        <section id="home">
          <h2>Benvenuto</h2>
          <p>Questo è un sito statico generato dal MiniCMS.</p>
        </section>
        <section id="about" style="display: none;">
          <h2>About</h2>
          <p>Informazioni sul sito.</p>
        </section>
      </main>
    </div>
    <script>
      // Navigazione semplice senza framework
      document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
          e.preventDefault()
          const targetId = e.target.getAttribute('href').substring(1)
          
          // Nascondi tutte le sezioni
          document.querySelectorAll('section').forEach(s => s.style.display = 'none')
          
          // Mostra la sezione target
          const targetSection = document.getElementById(targetId)
          if (targetSection) {
            targetSection.style.display = 'block'
          }
        }
      })
    </script>`
  )
  
  fs.writeFileSync(buildIndexPath, htmlContent)
  console.log('File HTML statico generato in build/index.html')
} else {
  console.error('index.html non trovato nella cartella dist')
}

// Copia assets se esistono
const assetsPath = path.join(distPath, 'assets')
const buildAssetsPath = path.join(buildPath, 'assets')

if (fs.existsSync(assetsPath)) {
  // Copia ricorsivamente gli asset
  function copyRecursive(src, dest) {
    const exists = fs.existsSync(src)
    const stats = exists && fs.statSync(src)
    const isDirectory = exists && stats.isDirectory()
    
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursive(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        )
      })
    } else {
      fs.copyFileSync(src, dest)
    }
  }
  
  copyRecursive(assetsPath, buildAssetsPath)
  console.log('Asset copiati in build/assets')
}

console.log('Build statica completata!')