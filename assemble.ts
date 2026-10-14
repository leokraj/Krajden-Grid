import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';

console.log('=== KRAJDEN GRID MODERN PACKAGE ASSEMBLER ===');

const downloadsDir = path.join(process.cwd(), 'backend', 'downloads');
const electronAppDir = path.join(process.cwd(), 'electron-app');
const electronAssetsDir = path.join(electronAppDir, 'assets');
const iconIcoPath = path.join(electronAssetsDir, 'icon.ico');
const pngIconPath = path.join(process.cwd(), 'backend', 'frontend-build', 'icon-512.png');
const unpackedDir = path.join(electronAppDir, 'dist', 'win-unpacked');
const portableZipPath = path.join(downloadsDir, 'KrajdenGrid-Portable.zip');
const finalInstallerPath = path.join(downloadsDir, 'KrajdenGrid-Setup.exe');

try {
  // 1. Ensure directories exist
  console.log('Ensuring directories exist...');
  fs.mkdirSync(downloadsDir, { recursive: true });
  fs.mkdirSync(electronAssetsDir, { recursive: true });

  // 2. Build frontend and copy dist to electron-app/web_dist
  console.log('Building frontend assets via Vite...');
  execSync('npx vite build', { stdio: 'inherit' });

  const frontendDistDir = path.join(process.cwd(), 'frontend', 'dist');
  const webDistDir = path.join(electronAppDir, 'web_dist');

  // Delete everything in electron-app/web_dist/
  if (fs.existsSync(webDistDir)) {
    console.log(`Cleaning existing ${webDistDir}...`);
    fs.rmSync(webDistDir, { recursive: true, force: true });
  }
  fs.mkdirSync(webDistDir, { recursive: true });

  if (fs.existsSync(frontendDistDir)) {
    console.log(`Copying frontend build from ${frontendDistDir} to ${webDistDir}...`);
    fs.cpSync(frontendDistDir, webDistDir, { recursive: true });
  } else {
    console.warn(`Warning: ${frontendDistDir} does not exist. Standalone offline bundle may be missing.`);
  }

  // Copy offline data assets from electron-app/data if present
  const electronDataDir = path.join(electronAppDir, 'data');
  if (fs.existsSync(electronDataDir)) {
    console.log(`Copying offline data assets to ${path.join(webDistDir, 'data')}...`);
    fs.cpSync(electronDataDir, path.join(webDistDir, 'data'), { recursive: true });
  }

  // 3. Ensure icon.ico exists (generate if missing)
  if (!fs.existsSync(iconIcoPath)) {
    console.log('Generating missing icon.ico from icon-512.png...');
    if (fs.existsSync(pngIconPath)) {
      const pngData = fs.readFileSync(pngIconPath);
      const header = Buffer.alloc(6);
      header.writeUInt16LE(0, 0); // Reserved
      header.writeUInt16LE(1, 2); // Type (1 = ICO)
      header.writeUInt16LE(1, 4); // Number of images

      const entry = Buffer.alloc(16);
      entry.writeUInt8(0, 0);   // Width (0 means 256 or larger)
      entry.writeUInt8(0, 1);   // Height (0 means 256 or larger)
      entry.writeUInt8(0, 2);   // Color palette (0 = no palette)
      entry.writeUInt8(0, 3);   // Reserved
      entry.writeUInt16LE(1, 4); // Color planes
      entry.writeUInt16LE(32, 6); // Bits per pixel
      entry.writeUInt32LE(pngData.length, 8); // Image size
      entry.writeUInt32LE(22, 12); // Image offset

      const icoData = Buffer.concat([header, entry, pngData]);
      fs.writeFileSync(iconIcoPath, icoData);
      console.log('Icon generated successfully!');
    } else {
      console.warn('Warning: icon-512.png was not found. Using an empty placeholder or fallback.');
    }
  }

  // 4. Clean electron-app/dist before rebuilding
  const electronDistDir = path.join(electronAppDir, 'dist');
  if (fs.existsSync(electronDistDir)) {
    console.log(`Cleaning existing ${electronDistDir}...`);
    fs.rmSync(electronDistDir, { recursive: true, force: true });
  }

  // 5. Run unpacked build via electron-builder (which runs fine on Linux without Wine!)
  console.log('Building unpacked Windows binary via electron-builder...');
  execSync('npx electron-builder --dir --win --x64 --project electron-app', {
    stdio: 'inherit',
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });

  // 6. Ensure timestamps on all unpacked files (including KrajdenGrid.exe and app.asar) reflect the current build time
  const exePath = path.join(unpackedDir, 'KrajdenGrid.exe');
  const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
  const buildDate = new Date();
  
  function touchRecursive(dir: string, date: Date) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        fs.utimesSync(fullPath, date, date);
      } catch (e) {}
      if (entry.isDirectory()) {
        touchRecursive(fullPath, date);
      }
    }
  }
  touchRecursive(unpackedDir, buildDate);
  console.log(`Updated timestamps on all files in ${unpackedDir} to: ${buildDate.toISOString()}`);

  // 7. Create portable ZIP file of the unpacked Windows application
  console.log(`Packaging unpacked binary into: ${portableZipPath}...`);
  if (fs.existsSync(unpackedDir)) {
    // Add Windows Unblock + Launcher scripts
    const batLauncherContent = `@echo off
title Krajden Grid Desktop Launcher
echo [Krajden Grid] Unblocking files for Windows Defender / SmartScreen...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0*' -Recurse -ErrorAction SilentlyContinue | Unblock-File"
echo [Krajden Grid] Launching Krajden Grid...
start "" "%~dp0KrajdenGrid.exe"
`;
    const ps1LauncherContent = `# Krajden Grid Launcher Script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-ChildItem -Path $scriptDir -Recurse -ErrorAction SilentlyContinue | Unblock-File
Start-Process -FilePath "$scriptDir\\KrajdenGrid.exe"
`;
    fs.writeFileSync(path.join(unpackedDir, 'Launch-KrajdenGrid.bat'), batLauncherContent);
    fs.writeFileSync(path.join(unpackedDir, 'Launch-KrajdenGrid.ps1'), ps1LauncherContent);

    const windowsZipPath = path.join(downloadsDir, 'KrajdenGrid-Windows.zip');
    if (fs.existsSync(portableZipPath)) {
      fs.unlinkSync(portableZipPath);
    }
    if (fs.existsSync(windowsZipPath)) {
      fs.unlinkSync(windowsZipPath);
    }
    const portableZip = new AdmZip();
    portableZip.addLocalFolder(unpackedDir);
    portableZip.writeZip(portableZipPath);
    fs.copyFileSync(portableZipPath, windowsZipPath);
    console.log('KrajdenGrid-Portable.zip and KrajdenGrid-Windows.zip packaged successfully!');
  } else {
    throw new Error('Unpacked directory not found inside electron-app/dist/');
  }

  console.log('\n=============================================');
  console.log('SUCCESS: Package assembling completed!');
  console.log(`- Portable ZIP: ${portableZipPath}`);
  console.log(`- Windows ZIP: ${path.join(downloadsDir, 'KrajdenGrid-Windows.zip')}`);
  console.log('=============================================');

} catch (err: any) {
  console.error('\nAssembly failed:', err.message);
  process.exit(1);
}
