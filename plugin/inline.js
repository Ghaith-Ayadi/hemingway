// Post-build: inlines dist/ui.js into dist/ui.html so Figma gets a single self-contained file
const fs = require('fs')
const path = require('path')

const htmlPath = path.join(__dirname, 'dist', 'ui.html')
const jsPath   = path.join(__dirname, 'dist', 'ui.js')

let html = fs.readFileSync(htmlPath, 'utf8')
const js   = fs.readFileSync(jsPath,   'utf8')

// Replace the <script src="ui.js"> tag with an inline <script>
// Escape </script> inside JS to prevent premature tag closure
const safeJs = js.replace(/<\/script>/gi, '<\\/script>')
html = html.replace(/<script defer="defer" src="ui\.js"><\/script>/, `<script>${safeJs}</script>`)

fs.writeFileSync(htmlPath, html)
console.log('✓ Inlined ui.js into ui.html')
