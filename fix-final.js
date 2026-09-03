const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');
content = content.replace('import * as faceapi from "@vladmandic/face-api";\n', '');
content = content.replace('import Webcam from "react-webcam";\n', '');
fs.writeFileSync('src/app/page.tsx', content, 'utf8');
