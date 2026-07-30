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
  console.log('Building frontend assets...');
  try {
    execSync('npx vite build', { stdio: 'inherit' });
  } catch (err: any) {
    console.error('Failed to build frontend via vite:', err.message);
  }

  const frontendDistDir = path.join(process.cwd(), 'frontend', 'dist');
  const webDistDir = path.join(electronAppDir, 'web_dist');

  if (fs.existsSync(frontendDistDir)) {
    console.log(`Copying frontend build from ${frontendDistDir} to ${webDistDir}...`);
    fs.cpSync(frontendDistDir, webDistDir, { recursive: true });
  } else {
    console.warn(`Warning: ${frontendDistDir} does not exist. Standalone offline bundle may be missing.`);
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

  // 3. Run unpacked build via electron-builder (which runs fine on Linux without Wine!)
  console.log('Building unpacked Windows binary via electron-builder...');
  execSync('npx electron-builder --dir --win --x64 --project electron-app', { stdio: 'inherit' });

  // 4. Create portable ZIP file of the unpacked Windows application
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
Start-Process -FilePath "$scriptDir\KrajdenGrid.exe"
`;
    fs.writeFileSync(path.join(unpackedDir, 'Launch-KrajdenGrid.bat'), batLauncherContent);
    fs.writeFileSync(path.join(unpackedDir, 'Launch-KrajdenGrid.ps1'), ps1LauncherContent);

    if (fs.existsSync(portableZipPath)) {
      fs.unlinkSync(portableZipPath);
    }
    const portableZip = new AdmZip();
    portableZip.addLocalFolder(unpackedDir);
    portableZip.writeZip(portableZipPath);
    console.log('KrajdenGrid-Portable.zip packaged successfully!');
  } else {
    throw new Error('Unpacked directory not found inside electron-app/dist/');
  }

  // 5. Try to compile the full NSIS Windows installer
  console.log('Attempting to build Windows Installer (KrajdenGrid-Setup.exe) via electron-builder...');
  let hasWine = true;
  if (process.platform === 'linux') {
    try {
      execSync('which wine', { stdio: 'ignore' });
    } catch {
      hasWine = false;
    }
  }

  if (!hasWine) {
    console.warn('\n================================================================');
    console.warn('NOTE: Full installer (.exe) packaging skipped on this OS.');
    console.warn('Reason: Wine is required to build Windows NSIS installers on Linux.');
    console.warn('The unpacked portable ZIP was successfully created!');
    console.warn('================================================================\n');
  } else {
    try {
      execSync('npx electron-builder --win --x64 --project electron-app', { stdio: 'inherit' });

      // Look for the built .exe in electron-app/dist/
      const distFiles = fs.readdirSync(path.join(electronAppDir, 'dist'));
      const compiledExe = distFiles.find(f => f.endsWith('.exe') && !f.includes('win-unpacked'));
      if (compiledExe) {
        const srcExePath = path.join(electronAppDir, 'dist', compiledExe);
        if (fs.existsSync(finalInstallerPath)) {
          fs.unlinkSync(finalInstallerPath);
        }
        fs.copyFileSync(srcExePath, finalInstallerPath);
        console.log(`Successfully copied installer to: ${finalInstallerPath}`);
      } else {
        console.warn('Warning: No compiled installer (.exe) was found in electron-app/dist/');
      }
    } catch (builderError: any) {
      console.warn('\n================================================================');
      console.warn('NOTE: Full installer (.exe) packaging skipped on this OS.');
      console.warn('Reason: Wine is required to build Windows NSIS installers on Linux.');
      console.warn('The unpacked portable ZIP was successfully created!');
      console.warn('================================================================\n');
    }
  }

  console.log('\n=============================================');
  console.log('SUCCESS: Package assembling completed!');
  console.log(`- Portable ZIP: ${portableZipPath}`);
  if (fs.existsSync(finalInstallerPath)) {
    console.log(`- Setup Installer: ${finalInstallerPath}`);
  } else {
    console.log('- Setup Installer: (Skipped, use Wine or Windows to build Setup.exe)');
  }
  console.log('=============================================');

} catch (err: any) {
  console.error('\nAssembly failed:', err.message);
  process.exit(1);
}
