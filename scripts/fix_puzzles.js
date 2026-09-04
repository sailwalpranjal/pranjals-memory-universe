const fs = require('fs');
let code = fs.readFileSync('src/app/puzzles/page.tsx', 'utf8');

code = code.replace(/useState<any\[\]>\(\[\]\)/g, "useState<{id: string, url: string}[]>([])");
code = code.replace(/filter\(\(p: any\) => p\.url\)/g, "filter((p: {url: string}) => p.url)");
code = code.replace(/map\(\(p: any\) => p\.url\)/g, "map((p: {url: string}) => p.url)");
code = code.replace(/catch \(err: any\)/g, "catch (err: unknown)");
code = code.replace(/err\.message/g, "(err as Error).message");
code = code.replace(/useState<any>\(null\)/g, "useState<{url: string, photo_metadata: {latitude: number, longitude: number}} | null>(null)");
code = code.replace(/filter\(\(p: any\) => p\.url && p\.photo_metadata\?\.latitude && p\.photo_metadata\?\.longitude\)/g, "filter((p: {url: string, photo_metadata?: {latitude: number, longitude: number}}) => p.url && p.photo_metadata?.latitude && p.photo_metadata?.longitude)");
code = code.replace(/handleMapClick = \(e: any\)/g, "handleMapClick = (e: {lngLat: {lat: number, lng: number}})");
code = code.replace(/let points =/g, "const points =");
code = code.replace(/<img src=\{p\.url\}/g, '<img src={p.url} alt=""');

fs.writeFileSync('src/app/puzzles/page.tsx', code);
console.log('done');
