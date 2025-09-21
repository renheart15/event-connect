const fs = require('fs');
const path = 'android/app/capacitor.build.gradle';

if (!fs.existsSync(path)) {
  console.error('❌ capacitor.build.gradle not found.');
  process.exit(1);
}

let content = fs.readFileSync(path, 'utf8');
const replaced = content.replace(/VERSION_21/g, 'VERSION_17');

if (content !== replaced) {
  fs.writeFileSync(path, replaced);
  console.log('✅ Patched Java version to 17 in capacitor.build.gradle');
} else {
  console.log('ℹ️ Java version is already set to 17.');
}
