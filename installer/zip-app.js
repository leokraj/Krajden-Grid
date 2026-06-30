const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

console.log('Zipping win-unpacked. This may take a moment...');
const zip = new AdmZip();
zip.addLocalFolder(path.join(__dirname, '../electron-app/dist/win-unpacked'));
zip.writeZip(path.join(__dirname, 'app.zip'));
console.log('Zipping complete! app.zip created.');
