const fs = require('fs');
fs.mkdirSync('node_modules/@tensorflow/tfjs-node', { recursive: true });
fs.writeFileSync('node_modules/@tensorflow/tfjs-node/index.js', "module.exports = require('@tensorflow/tfjs');\n");
fs.writeFileSync('node_modules/@tensorflow/tfjs-node/package.json', JSON.stringify({
  name: "@tensorflow/tfjs-node",
  version: "4.22.0",
  main: "index.js"
}));
