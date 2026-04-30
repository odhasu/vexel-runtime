const fs = require('fs');
const path = require('path');

let cachedLoader = null;

function handleLoader(req, res) {
  if (!cachedLoader) {
    const loaderPath = path.join(__dirname, '..', '..', 'dist', 'scaled-loader.js');
    try {
      cachedLoader = fs.readFileSync(loaderPath, 'utf8');
    } catch (e) {
      // Fallback: try unobfuscated source
      const srcPath = path.join(__dirname, '..', 'loader.js');
      try {
        cachedLoader = fs.readFileSync(srcPath, 'utf8');
      } catch (e2) {
        return res.status(404).send('// loader not found');
      }
    }
  }

  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
  res.send(cachedLoader);
}

module.exports = handleLoader;
