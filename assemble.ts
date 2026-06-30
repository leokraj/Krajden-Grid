import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';

console.log('=== KRAJDEN GRID PACKAGE ASSEMBLER ===');

const cacheDir = path.join(os.homedir(), '.cache', 'electron');
const electronZipPath = path.join(cacheDir, 'electron-v31.7.7-win32-x64.zip');
const buildDir = path.join(process.cwd(), 'build-temp');
const appOutDir = path.join(buildDir, 'KrajdenGrid');
const downloadsDir = path.join(process.cwd(), 'backend', 'downloads');

try {
  // 1. Ensure directories exist
  console.log('Creating directories...');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(downloadsDir, { recursive: true });

  // 2. Extract official precompiled Windows Electron binary
  if (!fs.existsSync(electronZipPath)) {
    console.log(`Official Electron Windows binary not found in cache at: ${electronZipPath}`);
    console.log('Downloading from official Electron releases...');
    fs.mkdirSync(cacheDir, { recursive: true });
    try {
      execSync(`curl -L -o "${electronZipPath}" "https://github.com/electron/electron/releases/download/v31.7.7/electron-v31.7.7-win32-x64.zip"`, { stdio: 'inherit' });
    } catch (downloadErr: any) {
      throw new Error(`Failed to download official Electron binary: ${downloadErr.message}`);
    }
  }
  console.log(`Extracting Electron precompiled Windows binary...`);
  const electronZip = new AdmZip(electronZipPath);
  electronZip.extractAllTo(appOutDir, true);
  console.log('Electron extracted successfully!');

  // 3. Rename electron.exe to KrajdenGrid.exe
  const oldExe = path.join(appOutDir, 'electron.exe');
  const newExe = path.join(appOutDir, 'KrajdenGrid.exe');
  if (fs.existsSync(oldExe)) {
    fs.renameSync(oldExe, newExe);
    console.log('Renamed electron.exe to KrajdenGrid.exe');
  } else {
    throw new Error('electron.exe not found in extracted binary folder');
  }

  // 4. Create resources/app directory and copy app source files
  const resourcesAppDir = path.join(appOutDir, 'resources', 'app');
  fs.mkdirSync(resourcesAppDir, { recursive: true });

  const filesToCopy = ['main.js', 'preload.js', 'package.json'];
  for (const file of filesToCopy) {
    const src = path.join(process.cwd(), 'electron-app', file);
    const dest = path.join(resourcesAppDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file} to resources/app/`);
    } else {
      console.warn(`Warning: source file ${src} not found`);
    }
  }

  // 5. Zip the entire compiled application into KrajdenGrid-Portable.zip
  const portableZipPath = path.join(downloadsDir, 'KrajdenGrid-Portable.zip');
  console.log(`Zipping compiled application into: ${portableZipPath}...`);
  const portableZip = new AdmZip();
  portableZip.addLocalFolder(appOutDir);
  portableZip.writeZip(portableZipPath);
  console.log('KrajdenGrid-Portable.zip created successfully!');

  // 6. Build Windows Installer (KrajdenGrid-Setup.exe) using pkg
  console.log('Building installer KrajdenGrid-Setup.exe via pkg...');
  execSync('npx -y npm --prefix installer run build', { stdio: 'inherit' });

  // Copy compiled installer to downloads folder
  const compiledInstaller = path.join(process.cwd(), 'installer', 'KrajdenGrid-Setup.exe');
  const destInstaller = path.join(downloadsDir, 'KrajdenGrid-Setup.exe');
  if (fs.existsSync(compiledInstaller)) {
    fs.copyFileSync(compiledInstaller, destInstaller);
    console.log(`Copied ${compiledInstaller} to ${destInstaller}`);
  } else {
    throw new Error('KrajdenGrid-Setup.exe was not created by pkg');
  }

  console.log('\n=============================================');
  console.log('SUCCESS: All packages assembled perfectly!');
  console.log(`- Portable ZIP: ${portableZipPath}`);
  console.log(`- Setup Installer: ${destInstaller}`);
  console.log('=============================================');

} catch (err: any) {
  console.error('\nAssembly failed:', err.message);
  process.exit(1);
} finally {
  // Clean up build temp directory
  console.log('Cleaning up temporary files...');
  try {
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  } catch (e: any) {
    console.warn('Cleanup warning:', e.message);
  }
}
