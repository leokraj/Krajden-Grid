const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

console.log(`
============================================================
            KRAJDEN GRID - WINDOWS INSTALLER
============================================================
Welcome to the Krajden Grid Desktop Setup!
This installer will configure the transparent tactical overlay
on your Windows system.
`);

// Known backend URLs to try downloading the core files from
const SERVER_URLS = [
  'https://ais-dev-uozjwodwx7ctzjsx4334de-668611332745.us-east1.run.app',
  'https://ais-pre-uozjwodwx7ctzjsx4334de-668611332745.us-east1.run.app',
  'http://localhost:3000'
];

// Get default install path under local app data
const home = process.env.USERPROFILE || process.env.HOME || 'C:';
const defaultInstallPath = path.join(home, 'AppData', 'Local', 'KrajdenGrid');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function downloadWithRedirect(url, dest, onProgress, callback) {
  const file = fs.createWriteStream(dest);
  const client = url.startsWith('https') ? https : http;

  client.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
      file.close();
      fs.unlink(dest, () => {});
      const redirectUrl = response.headers.location;
      if (redirectUrl) {
        downloadWithRedirect(redirectUrl, dest, onProgress, callback);
      } else {
        callback(new Error('Redirect location header missing'));
      }
      return;
    }

    if (response.statusCode !== 200) {
      file.close();
      fs.unlink(dest, () => {});
      callback(new Error(`Failed to download (HTTP ${response.statusCode})`));
      return;
    }

    const totalSize = parseInt(response.headers['content-length'], 10) || 0;
    let downloadedSize = 0;
    let lastPercent = -1;

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (totalSize > 0) {
        const percent = Math.round((downloadedSize / totalSize) * 100);
        if (percent !== lastPercent && percent % 10 === 0) {
          onProgress(percent);
          lastPercent = percent;
        }
      }
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      if (totalSize > 0 && downloadedSize < totalSize) {
        fs.unlink(dest, () => {});
        callback(new Error(`Download interrupted: received ${downloadedSize} of ${totalSize} bytes`));
      } else if (downloadedSize < 50000000) {
        fs.unlink(dest, () => {});
        callback(new Error(`Download file size is too small (${(downloadedSize / 1024 / 1024).toFixed(2)} MB), probably incomplete.`));
      } else {
        callback(null);
      }
    });
  }).on('error', (err) => {
    file.close();
    fs.unlink(dest, () => {});
    callback(err);
  });
}

function tryDownload(urls, index, dest, onProgress, callback) {
  if (index >= urls.length) {
    callback(new Error('All download mirrors failed or timed out.'));
    return;
  }

  const baseUrl = urls[index];
  const downloadUrl = `${baseUrl}/api/download/KrajdenGrid-Portable.zip`;
  console.log(`\nAttempting download from mirror: ${baseUrl}...`);

  downloadWithRedirect(downloadUrl, dest, onProgress, (err) => {
    if (err) {
      console.log(`Mirror ${baseUrl} failed: ${err.message}`);
      tryDownload(urls, index + 1, dest, onProgress, callback);
    } else {
      callback(null);
    }
  });
}

rl.question(`Enter installation folder [Default: ${defaultInstallPath}]: `, (answer) => {
  const installPath = answer.trim() || defaultInstallPath;
  
  console.log(`\nInstalling to: ${installPath}`);
  
  // Create installation folder
  try {
    fs.mkdirSync(installPath, { recursive: true });
  } catch (err) {
    console.error(`Failed to create installation folder: ${err.message}`);
    rl.close();
    process.exit(1);
  }

  const tempZipPath = path.join(installPath, 'temp-app-package.zip');
  console.log('\nDownloading latest core files (approx. 120MB)...');

  tryDownload(SERVER_URLS, 0, tempZipPath, (percent) => {
    process.stdout.write(`\rDownloading application files: [${'='.repeat(percent / 10)}${' '.repeat(10 - percent / 10)}] ${percent}%`);
  }, (err) => {
    if (err) {
      console.error('\n\nFailed to download core application package.');
      console.log('If you are offline or have network rules, you can download the Portable ZIP version directly from the web panel!');
      rl.close();
      process.exit(1);
    }

    console.log('\n\nDownload complete! Extracting files...');

    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(tempZipPath);
      zip.extractAllTo(installPath, true);
      console.log('Extraction complete!');

      // Clean up temporary ZIP
      try {
        fs.unlinkSync(tempZipPath);
      } catch (e) {
        // Safe to ignore
      }

      // Create Desktop Shortcut
      console.log('Creating Desktop and Start Menu shortcuts...');
      const desktopLnk = path.join(home, 'Desktop', 'Krajden Grid.lnk');
      const targetExe = path.join(installPath, 'KrajdenGrid.exe');
      
      const psDesktopCommand = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${desktopLnk.replace(/'/g, "''")}'); $s.TargetPath = '${targetExe.replace(/'/g, "''")}'; $s.IconLocation = '${targetExe.replace(/'/g, "''")},0'; $s.Save()`;
      execSync(`powershell -Command "${psDesktopCommand}"`, { stdio: 'ignore' });
      
      // Create Start Menu Shortcut
      const startMenuFolder = path.join(home, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      fs.mkdirSync(startMenuFolder, { recursive: true });
      const startMenuLnk = path.join(startMenuFolder, 'Krajden Grid.lnk');
      
      const psStartCommand = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${startMenuLnk.replace(/'/g, "''")}'); $s.TargetPath = '${targetExe.replace(/'/g, "''")}'; $s.IconLocation = '${targetExe.replace(/'/g, "''")},0'; $s.Save()`;
      execSync(`powershell -Command "${psStartCommand}"`, { stdio: 'ignore' });
      
      console.log('Shortcuts created successfully!');
      
      // Launch App Option
      rl.question('\nLaunch Krajden Grid now? [Y/n]: ', (launchAns) => {
        if (launchAns.trim().toLowerCase() !== 'n') {
          console.log('Launching Krajden Grid...');
          const { spawn } = require('child_process');
          const child = spawn(targetExe, [], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
        }
        console.log('\nKrajden Grid has been installed successfully. Thank you!');
        rl.close();
        process.exit(0);
      });
    } catch (extractErr) {
      console.error('\nExtraction or shortcut creation failed:', extractErr.message);
      rl.close();
      process.exit(1);
    }
  });
});
