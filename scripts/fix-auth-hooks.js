const fs = require('fs');
const path = require('path');

const files = [
  'routes/auth/onboard.js',
  'routes/auth/pin-reset.js',
  'routes/cooperatives/index.js',
  'routes/cooperatives/members.js',
  'routes/farmers/index.js',
  'routes/lots/index.js',
  'routes/lots/images.js',
  'routes/lots/events.js',
  'routes/lots/transfer.js',
  'routes/verification/index.js',
  'routes/audit/index.js',
  'routes/export/index.js',
  'routes/partners/index.js',
  'routes/sync/index.js'
];

for (const rel of files) {
  const file = path.join(process.cwd(), rel);
  let text = fs.readFileSync(file, 'utf8');
  const importLine = "const { authenticate, requireRole } = require('../../utils/auth-hooks');\n";

  if (!text.includes("utils/auth-hooks")) {
    const firstLineBreak = text.indexOf('\n');
    text = text.slice(0, firstLineBreak + 1) + importLine + text.slice(firstLineBreak + 1);
  }

  text = text.replace(/app\.authenticate/g, 'authenticate');
  text = text.replace(/app\.requireRole\(/g, 'requireRole(');
  fs.writeFileSync(file, text, 'utf8');
}

console.log(`Updated ${files.length} files.`);
