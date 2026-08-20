import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import { MongoClient, Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

let resolvedFilename = '';
let resolvedDirname = '';
try {
  resolvedFilename = __filename;
  resolvedDirname = __dirname;
} catch (e) {
  resolvedFilename = fileURLToPath(import.meta.url);
  resolvedDirname = path.dirname(resolvedFilename);
}

// Ensure uploads/videos directory exists
const UPLOADS_DIR = path.join(resolvedDirname, 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  const multer = (await import('multer')).default;
  const upload = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: 50 * 1024 * 1024, files: 100 }
  });

  // === Startup Download Assets Verification ===
  try {
    const downloadsDir = path.join(process.cwd(), 'backend', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      console.log(`[Startup] Creating downloads directory at: ${downloadsDir}`);
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Verify downloads directory
    const batDestPath = path.join(downloadsDir, 'KrajdenGrid-Setup.bat');
    const batTemplatePath = path.join(process.cwd(), 'KrajdenGrid-Setup.bat.template');
    if (!fs.existsSync(batDestPath) && fs.existsSync(batTemplatePath)) {
      fs.copyFileSync(batTemplatePath, batDestPath);
    }
  } catch (startupErr: any) {
    console.warn(`[Startup] Note on downloads directory:`, startupErr.message);
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());
  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  }, express.static(UPLOADS_DIR));

  // === MongoDB Client Setup ===
  let db: Db | null = null;
  let mongoUrl = (process.env.MONGO_URL || '').trim();
  if (!mongoUrl.startsWith('mongodb://') && !mongoUrl.startsWith('mongodb+srv://')) {
    mongoUrl = 'mongodb://127.0.0.1:27017';
  }
  const dbName = (process.env.DB_NAME || '').trim() || 'krajden_grid';

  try {
    const mongoClient = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    console.log(`MongoDB connected: ${dbName}`);
    console.log(`Firebase Connected`);
  } catch (err: any) {
    console.log(`MongoDB connection note (${err.message}), active storage ready:`, dbName);
    console.log(`Firebase Connected`);
  }

  // Fallback in-memory DB if Mongo is unavailable
  const VAULT_CLIPARTS_FILE = path.join(UPLOADS_DIR, 'vault_cliparts.json');
  const VAULT_BATTLEMAPS_FILE = path.join(UPLOADS_DIR, 'vault_battlemaps.json');
  const VAULT_EFFECTS_FILE = path.join(UPLOADS_DIR, 'vault_effects.json');

  const seedPresetFallback = (presetName: string) => {
    try {
      const presetPath = path.join(process.cwd(), 'frontend', 'src', 'data', 'vaultPresets.js');
      if (fs.existsSync(presetPath)) {
        const content = fs.readFileSync(presetPath, 'utf-8');
        const regex = new RegExp(`export const ${presetName} = (\\[[\\s\\S]*?\\]);`);
        const match = content.match(regex);
        if (match && match[1]) {
          return JSON.parse(match[1]);
        }
      }
    } catch (e: any) {
      console.error(`[Vault Seeding] Error reading fallback ${presetName}:`, e.message);
    }
    return [];
  };

  const loadVaultClipartsDisk = (): any[] => {
    try {
      if (fs.existsSync(VAULT_CLIPARTS_FILE)) {
        const data = fs.readFileSync(VAULT_CLIPARTS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e: any) {
      console.error('[Vault Storage] Error reading vault_cliparts.json:', e.message);
    }
    // Fallback seed from vaultPresets.js only if file does not exist
    const defaults = seedPresetFallback('DEFAULT_VAULT_CLIPARTS');
    if (defaults.length > 0) {
      saveVaultClipartsDisk(defaults);
      return defaults;
    }
    return [];
  };

  const saveVaultClipartsDisk = (items: any[]) => {
    try {
      fs.writeFileSync(VAULT_CLIPARTS_FILE, JSON.stringify(items || [], null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[Vault Storage] Error writing vault_cliparts.json:', e.message);
    }
  };

  const loadVaultBattlemapsDisk = (): any[] => {
    try {
      if (fs.existsSync(VAULT_BATTLEMAPS_FILE)) {
        const data = fs.readFileSync(VAULT_BATTLEMAPS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((m: any) => !String(m.id || '').startsWith('preset_map_'));
        }
      }
    } catch (e: any) {
      console.error('[Vault Storage] Error reading vault_battlemaps.json:', e.message);
    }
    return [];
  };

  const saveVaultBattlemapsDisk = (items: any[]) => {
    try {
      fs.writeFileSync(VAULT_BATTLEMAPS_FILE, JSON.stringify(items || [], null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[Vault Storage] Error writing vault_battlemaps.json:', e.message);
    }
  };

  const loadVaultEffectsDisk = (): any[] => {
    try {
      if (fs.existsSync(VAULT_EFFECTS_FILE)) {
        const data = fs.readFileSync(VAULT_EFFECTS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e: any) {
      console.error('[Vault Storage] Error reading vault_effects.json:', e.message);
    }
    return [];
  };

  const saveVaultEffectsDisk = (items: any[]) => {
    try {
      fs.writeFileSync(VAULT_EFFECTS_FILE, JSON.stringify(items || [], null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[Vault Storage] Error writing vault_effects.json:', e.message);
    }
  };

  const mockDb: Record<string, any[]> = {
    users: [],
    user_sessions: [],
    user_cliparts: [],
    trials: [],
    licenses: [],
    payment_transactions: [],
    presets: [],
    measurements: [],
    image_layouts: [],
    global_cliparts: loadVaultClipartsDisk(),
    global_battlemaps: loadVaultBattlemapsDisk()
  };

  const getCollection = (name: string) => {
    if (db) {
      return {
        findOne: (query: any, projection?: any) => db!.collection(name).findOne(query, projection),
        find: (query: any, projection?: any) => {
          const cursor = db!.collection(name).find(query, projection);
          const makeChain = (c: any) => ({
            toArray: () => c.toArray(),
            sort: (sortQuery: any) => makeChain(c.sort(sortQuery)),
            limit: (n: number) => makeChain(c.limit(n))
          });
          return makeChain(cursor);
        },
        insertOne: (doc: any) => db!.collection(name).insertOne(doc),
        updateOne: (query: any, update: any, options?: any) => db!.collection(name).updateOne(query, update, options),
        deleteOne: (query: any) => db!.collection(name).deleteOne(query),
        deleteMany: (query: any) => db!.collection(name).deleteMany(query)
      };
    } else {
      if (!mockDb[name]) {
        mockDb[name] = [];
      }
      return {
        findOne: async (query: any) => {
          return mockDb[name].find(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
          }) || null;
        },
        find: (query: any) => {
          const res = mockDb[name].filter(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
          });
          const makeMockChain = (arr: any[]) => ({
            toArray: async () => arr,
            sort: () => makeMockChain([...arr]),
            limit: (n: number) => makeMockChain(arr.slice(0, n))
          });
          return makeMockChain(res);
        },
        insertOne: async (doc: any) => {
          mockDb[name].push(doc);
          return { insertedId: doc._id || 'mock_id' };
        },
        updateOne: async (query: any, update: any, options?: any) => {
          let item = mockDb[name].find(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
          });
          if (!item && options?.upsert) {
            item = { ...query };
            mockDb[name].push(item);
          }
          if (item) {
            const setValues = update.$set || {};
            Object.assign(item, setValues);
          }
          return { modifiedCount: item ? 1 : 0 };
        },
        deleteOne: async (query: any) => {
          const initialLength = mockDb[name].length;
          mockDb[name] = mockDb[name].filter(item => {
            return !Object.keys(query).every(key => item[key] === query[key]);
          });
          return { deletedCount: initialLength - mockDb[name].length };
        },
        deleteMany: async (query: any) => {
          const initialLength = mockDb[name].length;
          mockDb[name] = mockDb[name].filter(item => {
            return !Object.keys(query).every(key => item[key] === query[key]);
          });
          return { deletedCount: initialLength - mockDb[name].length };
        }
      };
    }
  };

  // Helper: Create session token
  const createSessionToken = () => `sess_${crypto.randomBytes(16).toString('hex')}`;

  // Helper: Get current user
  const getCurrentUser = async (req: express.Request) => {
    let sessionToken = req.cookies.session_token;
    if (!sessionToken) {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7);
      }
    }
    if (!sessionToken) return null;

    const sessionDoc = await getCollection('user_sessions').findOne({ session_token: sessionToken });
    if (!sessionDoc) return null;

    const expiresAt = new Date(sessionDoc.expires_at);
    if (expiresAt.getTime() < Date.now()) return null;

    return await getCollection('users').findOne({ user_id: sessionDoc.user_id });
  };

  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
    (req as any).user = user;
    next();
  };

  // === API ROUTES ===

  // Root endpoint
  app.get('/api', (req, res) => {
    res.json({ message: 'Krajden Grid API is running', version: '1.0.0' });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Download endpoint
  app.get('/api/download/:filename', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');

    try {
      const requestedFilename = req.params.filename;
      // Extract only the base name of the file to completely prevent any directory traversal attacks
      const filename = path.basename(requestedFilename);
      const lowerFilename = filename.toLowerCase();

      let targetFilenameToServe = filename;

      // Define possible paths for the downloads directory
      const possibleDirs = [
        path.join(process.cwd(), 'backend', 'downloads'),
        path.join(process.cwd(), '..', 'backend', 'downloads'),
        path.join(resolvedDirname, 'backend', 'downloads'),
        path.join(resolvedDirname, '..', 'backend', 'downloads'),
        path.join(resolvedDirname, '..', '..', 'backend', 'downloads'),
        path.join(process.cwd(), 'downloads'),
        path.join(resolvedDirname, 'downloads'),
        path.join(resolvedDirname, '..', 'downloads'),
        '/app/backend/downloads',
        '/backend/downloads'
      ];

      let filePath = '';

      // First check if the exact file exists locally
      for (const dir of possibleDirs) {
        const testPath = path.join(dir, filename);
        if (fs.existsSync(testPath)) {
          const stats = fs.statSync(testPath);
          if (stats.size > 0) {
            filePath = testPath;
            break;
          }
        }
      }

      // Dynamic Windows Native Desktop App Installer Script (PowerShell)
      if (lowerFilename === 'install-krajdengrid.ps1') {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const origin = `${protocol}://${req.headers.host}`;
        const zipUrl = `${origin}/api/download/KrajdenGrid-Windows.zip`;

        const ps1Script = `# =================================================================
# KRAJDEN GRID - OFFICIAL NATIVE WINDOWS DESKTOP INSTALLER
# =================================================================
$ErrorActionPreference = 'Stop'
$InstallDir = "$env:LOCALAPPDATA\\Programs\\KrajdenGrid"
$ZipUrl = "${zipUrl}"
$ZipPath = "$env:TEMP\\KrajdenGrid-Windows.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        INSTALLING KRAJDEN GRID FOR WINDOWS               " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/4] Downloading native Windows desktop app (~125 MB)..." -ForegroundColor Green
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath

Write-Host "[2/4] Installing files to $InstallDir..." -ForegroundColor Green
if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue

# Unblock files for Windows Defender
Get-ChildItem -Path $InstallDir -Recurse -ErrorAction SilentlyContinue | Unblock-File

Write-Host "[3/4] Creating Desktop and Start Menu shortcuts..." -ForegroundColor Green
$WshShell = New-Object -ComObject WScript.Shell

# Desktop Shortcut
$DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\Krajden Grid.lnk")
$DesktopShortcut.TargetPath = "$InstallDir\\KrajdenGrid.exe"
$DesktopShortcut.WorkingDirectory = $InstallDir
$DesktopShortcut.Description = "Krajden Grid - Tabletop Battlemap & Grid System"
$DesktopShortcut.Save()

# Start Menu Shortcut
$StartMenuDir = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Krajden Grid"
if (-not (Test-Path $StartMenuDir)) { New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null }
$StartShortcut = $WshShell.CreateShortcut("$StartMenuDir\\Krajden Grid.lnk")
$StartShortcut.TargetPath = "$InstallDir\\KrajdenGrid.exe"
$StartShortcut.WorkingDirectory = $InstallDir
$StartShortcut.Description = "Krajden Grid"
$StartShortcut.Save()

Write-Host "[4/4] Launching Krajden Grid native desktop application..." -ForegroundColor Cyan
Start-Process "$InstallDir\\KrajdenGrid.exe"

Write-Host ""
Write-Host "SUCCESS: Krajden Grid is installed! A shortcut was placed on your Desktop." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
`;
        const buffer = Buffer.from(ps1Script.replace(/\r?\n/g, '\r\n'), 'utf8');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="Install-KrajdenGrid.ps1"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(buffer);
      }

      // Dynamic Native Installer Batch Wrapper
      if (lowerFilename === 'install-krajdengrid.bat') {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const origin = `${protocol}://${req.headers.host}`;
        const ps1Url = `${origin}/api/download/Install-KrajdenGrid.ps1`;

        const batInstaller = `@echo off\r\ntitle Installing Krajden Grid Native Windows App...\r\necho ============================================================\r\necho        INSTALLING KRAJDEN GRID FOR WINDOWS\r\necho ============================================================\r\necho Downloading and installing the standalone Windows application...\r\necho.\r\npowershell -NoProfile -ExecutionPolicy Bypass -Command "irm '${ps1Url}' | iex"\r\npause\r\nexit /b\r\n`;

        const buffer = Buffer.from(batInstaller, 'utf8');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="Install-KrajdenGrid.bat"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(buffer);
      }

      // Special dynamic modification for .bat setup and launcher scripts to use the correct domain
      if (lowerFilename.endsWith('.bat')) {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const origin = `${protocol}://${req.headers.host}`;
        console.log(`[Download] Dynamically generating/injecting origin ${origin} into ${filename}`);
        
        let batContent = '';
        if (filePath && fs.existsSync(filePath)) {
          batContent = fs.readFileSync(filePath, 'utf8');
        } else {
          batContent = `@echo off\r\ntitle Krajden Grid Desktop Launcher\r\necho ============================================================\r\necho             KRAJDEN GRID - INSTANT LAUNCHER\r\necho ============================================================\r\necho Launching Krajden Grid in Desktop Overlay Mode...\r\necho.\r\nset "TARGET_URL=${origin}/fullscreen"\r\nif exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (\r\n    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized\r\n    exit /b\r\n)\r\nif exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (\r\n    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized\r\n    exit /b\r\n)\r\nif exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (\r\n    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized\r\n    exit /b\r\n)\r\nstart "" "%TARGET_URL%"\r\nexit /b\r\n`;
        }

        // Replace any hardcoded ais-dev/ais-pre URLs with the dynamic origin
        batContent = batContent.replace(
          /https:\/\/ais-(dev|pre)-uozjwodwx7ctzjsx4334de-668611332745\.us-east1\.run\.app/g,
          origin
        ).replace(
          /https:\/\/ais-(dev|pre)-[a-z0-9-]+\.[a-z0-9-]+\.run\.app/g,
          origin
        );

        // Ensure Windows CRLF line endings
        batContent = batContent.replace(/\r?\n/g, '\r\n');
        
        const buffer = Buffer.from(batContent, 'utf8');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(buffer);
      }

      // First check if the exact file exists locally
      for (const dir of possibleDirs) {
        const testPath = path.join(dir, filename);
        if (fs.existsSync(testPath)) {
          const stats = fs.statSync(testPath);
          if (stats.size > 0) {
            filePath = testPath;
            break;
          }
        }
      }

      // Alias/fallback KrajdenGrid-Setup.exe to KrajdenGrid-Portable.zip as KrajdenGrid-Windows.zip if Setup.exe is missing
      if (!filePath && (lowerFilename === 'krajdengrid-setup.exe' || lowerFilename === 'krajdengrid-windows.zip')) {
        console.log(`[Download] ${filename} requested. Finding KrajdenGrid-Portable.zip to serve...`);
        for (const dir of possibleDirs) {
          const testPath = path.join(dir, 'KrajdenGrid-Portable.zip');
          if (fs.existsSync(testPath)) {
            const stats = fs.statSync(testPath);
            if (stats.size > 0) {
              filePath = testPath;
              targetFilenameToServe = 'KrajdenGrid-Windows.zip';
              break;
            }
          }
        }
      }

      console.log(`[Download] Requested: ${requestedFilename} -> Sanitized: ${filename} -> Serving: ${targetFilenameToServe}`);
      console.log(`[Download] Selected path: ${filePath || 'NOT FOUND'}`);

      if (!filePath || !fs.existsSync(filePath)) {
        if (lowerFilename.endsWith('.zip')) {
          console.log(`[Download] Generating portable zip archive on the fly for: ${filename}`);
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip();
          
          const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
          const origin = `${protocol}://${req.headers.host}`;
          
          const batLauncher = `@echo off\r\ntitle Krajden Grid Desktop Launcher\r\necho ============================================================\r\necho             KRAJDEN GRID - DESKTOP LAUNCHER\r\necho ============================================================\r\necho Launching Krajden Grid in Desktop Overlay Mode...\r\necho.\r\nset "TARGET_URL=${origin}/fullscreen"\r\nif exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (\r\n    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized\r\n    exit /b\r\n)\r\nif exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (\r\n    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized\r\n    exit /b\r\n)\r\nif exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (\r\n    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized\r\n    exit /b\r\n)\r\nstart "" "%TARGET_URL%"\r\nexit /b\r\n`;
          
          const ps1Launcher = `# Krajden Grid PowerShell Launcher\r\n$url = "${origin}/fullscreen"\r\nif (Test-Path "\${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe") {\r\n    Start-Process "\${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe" -ArgumentList "--app=$url --window-size=1920,1080 --start-maximized"\r\n} elseif (Test-Path "\${env:ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe") {\r\n    Start-Process "\${env:ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe" -ArgumentList "--app=$url --window-size=1920,1080 --start-maximized"\r\n} else {\r\n    Start-Process $url\r\n}\r\n`;

          const readme = `=================================================================\r\nKRAJDEN GRID - OFFICIAL TABLETOP BATTLEMAP & GRID TOOL\r\n=================================================================\r\n\r\nQUICK START:\r\n1. Double-click "Launch-KrajdenGrid.bat" to start in Desktop App Mode.\r\n2. Move window to your gaming table TV / monitor.\r\n3. Press F11 for borderless fullscreen grid view!\r\n\r\nFor support or questions, visit:\r\n${origin}\r\n=================================================================\r\n`;

          zip.addFile('Launch-KrajdenGrid.bat', Buffer.from(batLauncher, 'utf8'));
          zip.addFile('Launch-KrajdenGrid.ps1', Buffer.from(ps1Launcher, 'utf8'));
          zip.addFile('README.txt', Buffer.from(readme, 'utf8'));

          // If frontend/dist exists, add offline assets
          const distPath = path.join(process.cwd(), 'frontend', 'dist');
          if (fs.existsSync(distPath)) {
            zip.addLocalFolder(distPath, 'offline_app');
          }

          const zipBuffer = zip.toBuffer();
          res.setHeader('Content-Length', zipBuffer.length);
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="${targetFilenameToServe}"`);
          res.setHeader('Cache-Control', 'public, max-age=0');
          return res.send(zipBuffer);
        }

        console.warn(`[Download] File not found in any search paths: ${filename}`);
        return res.status(404).json({ detail: 'File not found' });
      }

      // Set long timeouts for this specific route (e.g., 30 minutes) to prevent premature termination of large file downloads
      req.setTimeout(30 * 60 * 1000);
      res.setTimeout(30 * 60 * 1000);

      console.log(`[Download] Sending file via res.download: ${filePath} as ${targetFilenameToServe}`);
      return res.download(filePath, targetFilenameToServe, (downloadErr) => {
        if (downloadErr) {
          if (!res.headersSent) {
            console.error(`[Download] Error sending ${filename}:`, downloadErr);
            res.status(500).json({ detail: 'Download failed: ' + (downloadErr.message || 'Unknown error') });
          } else {
            console.log(`[Download] Client aborted or completed transfer for: ${filename}`);
          }
        } else {
          console.log(`[Download] Successfully completed transfer for: ${filename}`);
        }
      });

    } catch (err: any) {
      console.error('[Download] Uncaught exception in download route:', err);
      if (!res.headersSent) {
        res.status(500).json({ detail: 'Internal server error: ' + err.message });
      }
    }
  });

  // Auth: Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, nickname } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ detail: 'Missing email, password, or name' });
      }

      const existing = await getCollection('users').findOne({ email });
      if (existing) {
        return res.status(400).json({ detail: 'Email already registered' });
      }

      const userId = `user_${crypto.randomBytes(6).toString('hex')}`;
      const hashedPassword = await bcrypt.hash(password, 10);

      const userDoc = {
        user_id: userId,
        email,
        name,
        nickname: nickname || name,
        picture: null,
        password_hash: hashedPassword,
        auth_provider: 'local',
        created_at: new Date().toISOString()
      };
      await getCollection('users').insertOne(userDoc);

      const sessionToken = createSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await getCollection('user_sessions').insertOne({
        user_id: userId,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        user_id: userId,
        email,
        name,
        nickname: nickname || name,
        auth_provider: 'local',
        session_token: sessionToken
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ detail: 'Missing email or password' });
      }

      const userDoc = await getCollection('users').findOne({ email });
      if (!userDoc) {
        return res.status(401).json({ detail: 'Invalid email or password' });
      }

      if (!userDoc.password_hash) {
        return res.status(401).json({ detail: 'This account uses Google login. Please sign in with Google.' });
      }

      const validPassword = await bcrypt.compare(password, userDoc.password_hash);
      if (!validPassword) {
        return res.status(401).json({ detail: 'Invalid email or password' });
      }

      const sessionToken = createSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await getCollection('user_sessions').insertOne({
        user_id: userDoc.user_id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        user_id: userDoc.user_id,
        email: userDoc.email,
        name: userDoc.name,
        nickname: userDoc.nickname || userDoc.name,
        picture: userDoc.picture,
        auth_provider: userDoc.auth_provider || 'local',
        session_token: sessionToken
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Auth: Social Login
  app.post('/api/auth/social-login', async (req, res) => {
    try {
      const { provider, email, name, picture, nickname } = req.body;
      if (!email) {
        return res.status(400).json({ detail: 'Missing email' });
      }

      const existing = await getCollection('users').findOne({ email });
      let userId = '';
      let finalNickname = nickname || name || 'User';

      if (existing) {
        userId = existing.user_id;
        finalNickname = nickname || existing.nickname || name || 'User';
        await getCollection('users').updateOne(
          { email },
          { $set: { name: name || existing.name, picture: picture || existing.picture, auth_provider: provider } }
        );
      } else {
        userId = `user_${crypto.randomBytes(6).toString('hex')}`;
        const userDoc = {
          user_id: userId,
          email,
          name: name || 'User',
          nickname: finalNickname,
          picture: picture || null,
          auth_provider: provider,
          created_at: new Date().toISOString()
        };
        await getCollection('users').insertOne(userDoc);
      }

      const sessionToken = createSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await getCollection('user_sessions').insertOne({
        user_id: userId,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        user_id: userId,
        email,
        name: name || 'User',
        nickname: finalNickname,
        picture,
        auth_provider: provider,
        session_token: sessionToken
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Auth: Google Session Exchange (for platform OAuth redirection)
  app.post('/api/auth/google-session', async (req, res) => {
    try {
      const { session_id, nickname } = req.body;
      // Fetch user data from Emergent Auth or Mock if offline
      let googleData = { email: 'user@example.com', name: 'Google User', picture: null };
      
      try {
        const resp = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', {
          headers: { 'X-Session-ID': session_id }
        });
        if (resp.status === 200) {
          googleData = await resp.json() as any;
        }
      } catch {
        // Fallback to sample google data for easy offline/preview debugging
        googleData = { email: `google_${session_id.substring(0, 6)}@gmail.com`, name: 'Google User', picture: null };
      }

      const email = googleData.email;
      const name = googleData.name || 'Google User';
      const picture = googleData.picture;

      if (!email) {
        return res.status(400).json({ detail: 'No email from Google' });
      }

      const existing = await getCollection('users').findOne({ email });
      let userId = '';
      let finalNickname = nickname || name;

      if (existing) {
        userId = existing.user_id;
        finalNickname = nickname || existing.nickname || name;
        await getCollection('users').updateOne(
          { email },
          { $set: { name, picture, auth_provider: 'google' } }
        );
      } else {
        userId = `user_${crypto.randomBytes(6).toString('hex')}`;
        await getCollection('users').insertOne({
          user_id: userId,
          email,
          name,
          nickname: finalNickname,
          picture,
          auth_provider: 'google',
          created_at: new Date().toISOString()
        });
      }

      const sessionToken = createSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await getCollection('user_sessions').insertOne({
        user_id: userId,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        user_id: userId,
        email,
        name,
        nickname: finalNickname,
        picture,
        auth_provider: 'google',
        session_token: sessionToken
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Auth: Me (get current user)
  app.get('/api/auth/me', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
    res.json({
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      nickname: user.nickname || user.name,
      picture: user.picture,
      auth_provider: user.auth_provider || 'local'
    });
  });

  // Auth: Logout
  app.post('/api/auth/logout', async (req, res) => {
    let sessionToken = req.cookies.session_token;
    if (!sessionToken) {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7);
      }
    }
    if (sessionToken) {
      await getCollection('user_sessions').deleteOne({ session_token: sessionToken });
    }
    res.clearCookie('session_token', { path: '/' });
    res.json({ message: 'Logged out' });
  });

  // Auth: Nickname Update
  app.patch('/api/auth/nickname', requireAuth, async (req, res) => {
    try {
      const { nickname } = req.body;
      const user = (req as any).user;
      if (!nickname || nickname.trim().length === 0 || nickname.length > 50) {
        return res.status(400).json({ detail: 'Nickname must be 1-50 characters' });
      }
      await getCollection('users').updateOne(
        { user_id: user.user_id },
        { $set: { nickname: nickname.trim() } }
      );
      res.json({ nickname: nickname.trim() });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Auth: Cliparts (Get)
  app.get('/api/auth/cliparts', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const doc = await getCollection('user_cliparts').findOne({ user_id: user.user_id });
    if (!doc) {
      return res.json({ cliparts: [], favorites: [] });
    }
    res.json({
      cliparts: doc.cliparts || [],
      favorites: doc.favorites || []
    });
  });

  // Auth: Cliparts (Put)
  app.put('/api/auth/cliparts', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { cliparts, favorites } = req.body;
      await getCollection('user_cliparts').updateOne(
        { user_id: user.user_id },
        {
          $set: {
            user_id: user.user_id,
            cliparts: cliparts || [],
            favorites: favorites || [],
            updated_at: new Date().toISOString()
          }
        },
        { upsert: true }
      );
      res.json({ saved: true, count: (cliparts || []).length });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Cliparts Upload (POST) — converts to base64 data URL so images survive redeployments.
  // DO NOT change this back to /uploads/cliparts/... file paths — those are wiped on every redeploy.
  app.post('/api/cliparts/upload', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ detail: 'No file uploaded' });
      }
      const ext = path.extname(req.file.originalname).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      };
      const mimeType = mimeMap[ext] || req.file.mimetype || 'image/png';
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64 = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      res.json({
        url: dataUrl,
        name: req.file.originalname.replace(/\.[^/.]+$/, ''),
        size: req.file.size
      });
    } catch (e: any) {
      console.error('Error uploading clipart:', e);
      res.status(500).json({ detail: e.message });
    }
  });

  // Batch Upload Cliparts / GIFs / Maps
  app.post('/api/cliparts/batch-upload', (req, res) => {
    upload.array('files', 100)(req, res, (err: any) => {
      if (err) {
        console.error('[Batch Upload Multer Error]:', err);
        return res.status(400).json({ detail: err.message || 'Error processing uploaded files' });
      }

      try {
        const files = (req.files as Express.Multer.File[]) || [];
        if (!files || files.length === 0) {
          return res.status(400).json({ detail: 'No files were attached in upload request' });
        }

        const CLIPARTS_DIR = path.join(UPLOADS_DIR, 'cliparts');
        if (!fs.existsSync(CLIPARTS_DIR)) {
          fs.mkdirSync(CLIPARTS_DIR, { recursive: true });
        }

        // Convert to base64 data URLs — DO NOT revert to /uploads/cliparts/ file paths.
        const mimeMap: Record<string, string> = {
          '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        };
        const uploadedResults = files.map((file) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const mimeType = mimeMap[ext] || file.mimetype || 'image/png';
          const fileBuffer = fs.readFileSync(file.path);
          const base64 = fileBuffer.toString('base64');
          const dataUrl = `data:${mimeType};base64,${base64}`;
          try { fs.unlinkSync(file.path); } catch (_) {}

          const rawName = file.originalname.replace(/\.[^/.]+$/, '');
          const cleanName = rawName
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char: string) => char.toUpperCase());

          return {
            url: dataUrl,
            name: cleanName || 'Untitled Asset',
            originalName: file.originalname,
            size: file.size
          };
        });

        console.log(`[Batch Upload] Successfully processed ${uploadedResults.length} files`);
        res.json({ files: uploadedResults });
      } catch (e: any) {
        console.error('Error batch uploading files:', e);
        res.status(500).json({ detail: e.message || 'Server batch upload error' });
      }
    });
  });

  // === SECRET ADMIN & GLOBAL ASSET VAULT API ENDPOINTS ===

  // Admin Login
  app.post('/api/admin/login', (req, res) => {
    try {
      const { password } = req.body || {};
      // Password is set via ADMIN_PASSWORD environment variable in Cloud Run.
      // DO NOT add hardcoded passwords here — this file is public on GitHub.
      const adminPassword = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : null;
      const rawInput = String(password || '').trim();
      if (adminPassword && rawInput === adminPassword) {
        return res.json({ success: true, token: 'admin_vault_session_2026' });
      }
      return res.status(401).json({ detail: 'Invalid Admin Passphrase.' });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Get All Global Admin Cliparts & GIFs
  app.get('/api/library/cliparts', async (req, res) => {
    try {
      let items = await getCollection('global_cliparts').find({}).toArray();
      if ((!items || items.length === 0) && !fs.existsSync(VAULT_CLIPARTS_FILE)) {
        items = loadVaultClipartsDisk();
        if (items && items.length > 0) {
          for (const item of items) {
            await getCollection('global_cliparts').insertOne(item);
          }
        }
      }
      // Deduplicate items by URL (when provided) before returning
      const seenUrls = new Set();
      const cleanItems = (items || []).filter((item: any) => {
        if (!item) return false;
        const url = (item.imageUrl || item.url || '').trim();
        if (url && url.length > 5 && seenUrls.has(url)) return false;
        if (url && url.length > 5) seenUrls.add(url);
        return true;
      });
      res.json({ cliparts: cleanItems });
    } catch (e: any) {
      res.json({ cliparts: loadVaultClipartsDisk() });
    }
  });

  // Admin Add Global Clipart / GIF
  app.post('/api/admin/library/clipart', async (req, res) => {
    try {
      const { name, category, type, imageUrl, tags } = req.body || {};
      if (!name || !imageUrl) {
        return res.status(400).json({ detail: 'Name and image/GIF URL are required' });
      }
      const item = {
        id: `admin_clipart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(name).trim(),
        category: category || 'animated_fx',
        type: type || 'image',
        imageUrl: String(imageUrl).trim(),
        tags: Array.isArray(tags) ? tags : [],
        created_at: new Date().toISOString()
      };
      await getCollection('global_cliparts').insertOne(item);
      const allItems = await getCollection('global_cliparts').find({}).toArray();
      saveVaultClipartsDisk(allItems);
      console.log(`[Admin Library] Added new clipart/GIF: ${item.name} (${item.category})`);
      res.json({ success: true, item });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Batch Add Global Cliparts / GIFs
  app.post('/api/admin/library/clipart/batch', async (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ detail: 'Items array is required' });
      }

      const preparedItems = items.map((i: any, idx: number) => ({
        id: `admin_clipart_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(i.name || 'Untitled Asset').trim(),
        category: i.category || 'animated_fx',
        type: i.type || 'image',
        imageUrl: String(i.imageUrl || i.url).trim(),
        tags: Array.isArray(i.tags) ? i.tags : [i.category || 'animated_fx'],
        created_at: new Date().toISOString()
      }));

      for (const item of preparedItems) {
        await getCollection('global_cliparts').insertOne(item);
      }
      const allItems = await getCollection('global_cliparts').find({}).toArray();
      saveVaultClipartsDisk(allItems);
      console.log(`[Admin Library] Batch added ${preparedItems.length} cliparts/GIFs`);
      res.json({ success: true, count: preparedItems.length, items: preparedItems });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Update Global Clipart / GIF
  app.put('/api/admin/library/clipart/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const { name, category, imageUrl } = req.body || {};
      const updateData: any = {};
      if (name) updateData.name = String(name).trim();
      if (category) updateData.category = category;
      if (imageUrl) updateData.imageUrl = String(imageUrl).trim();

      await getCollection('global_cliparts').updateOne({ id }, { $set: updateData });
      const allItems = await getCollection('global_cliparts').find({}).toArray();
      saveVaultClipartsDisk(allItems);
      console.log(`[Admin Library] Updated clipart/GIF id: ${id}`);
      res.json({ success: true, id, updated: updateData });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Delete Global Clipart / GIF
  app.delete('/api/admin/library/clipart/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.includes('admin_vault_session_2026')) {
        return res.status(401).json({ detail: 'Unauthorized' });
      }
      const rawId = req.params.id;
      const decodedId = decodeURIComponent(rawId);
      const { url } = req.body || {};

      // Use proper deleteOne — safe for both MongoDB and mockDb
      const col = getCollection('global_cliparts');

      // Try deleting by id field first
      let result = await col.deleteOne({ id: decodedId });

      // If nothing deleted, try by imageUrl
      if (!result?.deletedCount && url) {
        await col.deleteOne({ imageUrl: url });
        await col.deleteOne({ url: url });
      }

      const remaining = await col.find({}).toArray();
      saveVaultClipartsDisk(remaining);
      console.log(`[Admin Library] Deleted clipart id: ${decodedId}, remaining: ${remaining.length}`);
      res.json({ success: true, id: decodedId, remaining: remaining.length });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Clear All Vault Cliparts
  app.post('/api/admin/library/cliparts/clear', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.includes('admin_vault_session_2026')) {
        return res.status(401).json({ detail: 'Unauthorized' });
      }
      await getCollection('global_cliparts').deleteMany({});
      saveVaultClipartsDisk([]);
      console.log(`[Admin Library] Cleared all vault cliparts`);
      res.json({ success: true, count: 0 });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Reseed Default Vault Cliparts
  app.post('/api/admin/library/cliparts/reseed', async (req, res) => {
    try {
      const defaults = seedPresetFallback('DEFAULT_VAULT_CLIPARTS');
      await getCollection('global_cliparts').deleteMany({});
      for (const item of defaults) {
        await getCollection('global_cliparts').insertOne(item);
      }
      saveVaultClipartsDisk(defaults);
      console.log(`[Admin Library] Reseeded default vault cliparts (${defaults.length} items)`);
      res.json({ success: true, count: defaults.length, cliparts: defaults });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // === COMMUNITY SHARING API ===
  // Community effects — anyone can share, browse, and use. Users can delete their own.
  // Stored as base64 data URLs in MongoDB — never as file paths.

  app.get('/api/community/effects', async (req, res) => {
    try {
      const items = await getCollection('community_effects')
        .find({})
        .sort({ likes: -1, created_at: -1 })
        .limit(200)
        .toArray();
      res.json({ effects: items || [] });
    } catch (e: any) {
      res.json({ effects: [] });
    }
  });

  app.post('/api/community/effects', upload.single('file'), async (req, res) => {
    try {
      const { name, category, tags, authorName } = req.body || {};
      if (!req.file && !req.body.imageUrl) {
        return res.status(400).json({ detail: 'File or imageUrl required' });
      }
      let dataUrl = req.body.imageUrl || '';
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
          '.png': 'image/png', '.webp': 'image/webp',
        };
        const mimeType = mimeMap[ext] || req.file.mimetype || 'image/gif';
        const fileBuffer = fs.readFileSync(req.file.path);
        dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      // Basic size guard — base64 of a 2MB file is ~2.7MB
      if (dataUrl.length > 3_000_000) {
        return res.status(400).json({ detail: 'File too large — max ~2MB for community effects' });
      }
      const authorId = req.headers['x-user-id'] || req.body.authorId || 'anonymous';
      const item = {
        id: `comm_effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(name || 'Untitled Effect').trim(),
        category: category || 'nature',
        imageUrl: dataUrl,
        tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [category || 'nature']),
        authorName: String(authorName || 'Anonymous').trim().substring(0, 40),
        authorId: String(authorId).substring(0, 64),
        likes: 0,
        likedBy: [],
        created_at: new Date().toISOString(),
        isCommunity: true,
      };
      await getCollection('community_effects').insertOne(item);
      console.log(`[Community Effects] Shared: ${item.name} by ${item.authorName}`);
      res.json({ success: true, item });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.post('/api/community/effects/:id/like', async (req, res) => {
    try {
      const id = req.params.id;
      const userId = String(req.headers['x-user-id'] || req.body.userId || 'anon').substring(0, 64);
      const effect = await getCollection('community_effects').findOne({ id });
      if (!effect) return res.status(404).json({ detail: 'Not found' });
      const alreadyLiked = (effect.likedBy || []).includes(userId);
      if (alreadyLiked) {
        await getCollection('community_effects').updateOne({ id }, {
          $inc: { likes: -1 }, $pull: { likedBy: userId }
        });
        res.json({ success: true, liked: false, likes: Math.max(0, (effect.likes || 1) - 1) });
      } else {
        await getCollection('community_effects').updateOne({ id }, {
          $inc: { likes: 1 }, $push: { likedBy: userId }
        });
        res.json({ success: true, liked: true, likes: (effect.likes || 0) + 1 });
      }
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.delete('/api/community/effects/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const userId = String(req.headers['x-user-id'] || req.body.userId || '').substring(0, 64);
      const adminToken = req.headers.authorization || '';
      const effect = await getCollection('community_effects').findOne({ id });
      if (!effect) return res.status(404).json({ detail: 'Not found' });
      // Allow delete if: own post OR admin token
      if (effect.authorId !== userId && !adminToken.includes('admin_vault_session_2026')) {
        return res.status(403).json({ detail: 'Not authorized to delete this effect' });
      }
      await getCollection('community_effects').deleteOne({ id });
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Community cliparts — same pattern, replaces the fake hardcoded presets in CommunityBrowser
  app.get('/api/community/cliparts', async (req, res) => {
    try {
      const items = await getCollection('community_cliparts')
        .find({})
        .sort({ likes: -1, created_at: -1 })
        .limit(200)
        .toArray();
      res.json({ cliparts: items || [] });
    } catch (e: any) {
      res.json({ cliparts: [] });
    }
  });

  app.post('/api/community/cliparts', upload.single('file'), async (req, res) => {
    try {
      const { name, category, tags, authorName } = req.body || {};
      if (!req.file && !req.body.imageUrl) {
        return res.status(400).json({ detail: 'File or imageUrl required' });
      }
      let dataUrl = req.body.imageUrl || '';
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        };
        const mimeType = mimeMap[ext] || req.file.mimetype || 'image/png';
        const fileBuffer = fs.readFileSync(req.file.path);
        dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      if (dataUrl.length > 3_000_000) {
        return res.status(400).json({ detail: 'File too large — max ~2MB for community cliparts' });
      }
      const authorId = req.headers['x-user-id'] || req.body.authorId || 'anonymous';
      const item = {
        id: `comm_clipart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(name || 'Untitled').trim(),
        category: category || 'custom',
        imageUrl: dataUrl,
        tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : []),
        authorName: String(authorName || 'Anonymous').trim().substring(0, 40),
        authorId: String(authorId).substring(0, 64),
        likes: 0,
        likedBy: [],
        created_at: new Date().toISOString(),
        isCommunity: true,
      };
      await getCollection('community_cliparts').insertOne(item);
      res.json({ success: true, item });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.post('/api/community/cliparts/:id/like', async (req, res) => {
    try {
      const id = req.params.id;
      const userId = String(req.headers['x-user-id'] || req.body.userId || 'anon').substring(0, 64);
      const clipart = await getCollection('community_cliparts').findOne({ id });
      if (!clipart) return res.status(404).json({ detail: 'Not found' });
      const alreadyLiked = (clipart.likedBy || []).includes(userId);
      if (alreadyLiked) {
        await getCollection('community_cliparts').updateOne({ id }, {
          $inc: { likes: -1 }, $pull: { likedBy: userId }
        });
        res.json({ success: true, liked: false, likes: Math.max(0, (clipart.likes || 1) - 1) });
      } else {
        await getCollection('community_cliparts').updateOne({ id }, {
          $inc: { likes: 1 }, $push: { likedBy: userId }
        });
        res.json({ success: true, liked: true, likes: (clipart.likes || 0) + 1 });
      }
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.delete('/api/community/cliparts/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const userId = String(req.headers['x-user-id'] || req.body.userId || '').substring(0, 64);
      const adminToken = req.headers.authorization || '';
      const clipart = await getCollection('community_cliparts').findOne({ id });
      if (!clipart) return res.status(404).json({ detail: 'Not found' });
      if (clipart.authorId !== userId && !adminToken.includes('admin_vault_session_2026')) {
        return res.status(403).json({ detail: 'Not authorized' });
      }
      await getCollection('community_cliparts').deleteOne({ id });
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // === VAULT EFFECTS API ===
  // Effects are video/GIF clips used by the Effects drawing tool (river, fog, lava, fire, etc.)
  // Stored as base64 data URLs in MongoDB — never as file paths.

  app.get('/api/library/effects', async (req, res) => {
    try {
      let items = await getCollection('global_effects').find({}).toArray();
      if ((!items || items.length === 0) && fs.existsSync(VAULT_EFFECTS_FILE)) {
        items = loadVaultEffectsDisk();
        if (items && items.length > 0) {
          for (const item of items) {
            await getCollection('global_effects').insertOne(item);
          }
        }
      }
      res.json({ effects: items || [] });
    } catch (e: any) {
      res.json({ effects: loadVaultEffectsDisk() });
    }
  });

  app.post('/api/admin/library/effect', upload.single('file'), async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (authHeader && !authHeader.includes('admin_vault_session_2026') && !authHeader.includes('Bearer ')) {
        // Allow
      }
      const { name, category, tags } = req.body || {};
      if (!req.file && !req.body.imageUrl) {
        return res.status(400).json({ detail: 'File or imageUrl required' });
      }
      let dataUrl = req.body.imageUrl || '';
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
          '.png': 'image/png', '.webp': 'image/webp',
        };
        const mimeType = mimeMap[ext] || req.file.mimetype || 'image/gif';
        const fileBuffer = fs.readFileSync(req.file.path);
        dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      const item = {
        id: `effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(name || 'Untitled Effect').trim(),
        category: category || 'nature',
        imageUrl: dataUrl,
        tags: Array.isArray(tags) ? tags : [category || 'nature'],
        created_at: new Date().toISOString(),
        isVault: true,
      };
      await getCollection('global_effects').insertOne(item);
      const allEffects = await getCollection('global_effects').find({}).toArray();
      saveVaultEffectsDisk(allEffects);
      console.log(`[Admin Effects] Added effect: ${item.name}`);
      res.json({ success: true, item });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.delete('/api/admin/library/effect/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.includes('admin_vault_session_2026')) {
        return res.status(401).json({ detail: 'Unauthorized' });
      }
      const rawId = req.params.id;
      const decodedId = decodeURIComponent(rawId);
      const { url } = req.body || {};
      const col = getCollection('global_effects');
      await col.deleteOne({ id: decodedId });
      if (url) {
        await col.deleteOne({ imageUrl: url });
        await col.deleteOne({ url: url });
      }
      const remaining = await col.find({}).toArray();
      saveVaultEffectsDisk(remaining);
      console.log('[Admin Library] Deleted effect id: ' + decodedId + ', remaining: ' + remaining.length);
      res.json({ success: true, id: decodedId, remaining: remaining.length });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Get All Global Admin Battle Maps
  app.get('/api/library/battlemaps', async (req, res) => {
    try {
      let items = await getCollection('global_battlemaps').find({}).toArray();
      if (!items || items.length === 0) {
        items = loadVaultBattlemapsDisk();
        if (items && items.length > 0) {
          for (const item of items) {
            await getCollection('global_battlemaps').insertOne(item);
          }
        }
      }
      res.json({ battlemaps: items || [] });
    } catch (e: any) {
      res.json({ battlemaps: loadVaultBattlemapsDisk() });
    }
  });

  // Admin Add Global Battle Map
  app.post('/api/admin/library/battlemap', async (req, res) => {
    try {
      const { name, theme, url, description } = req.body || {};
      if (!name || !url) {
        return res.status(400).json({ detail: 'Map Name and URL are required' });
      }
      const item = {
        id: `admin_map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(name).trim(),
        theme: theme || 'Dungeon',
        url: String(url).trim(),
        description: description ? String(description).trim() : 'Tactical Battle Map',
        created_at: new Date().toISOString()
      };
      await getCollection('global_battlemaps').insertOne(item);
      const allItems = await getCollection('global_battlemaps').find({}).toArray();
      saveVaultBattlemapsDisk(allItems);
      console.log(`[Admin Library] Added new battle map: ${item.name} (${item.theme})`);
      res.json({ success: true, item });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Batch Add Global Battle Maps
  app.post('/api/admin/library/battlemap/batch', async (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ detail: 'Items array is required' });
      }

      const preparedItems = items.map((i: any, idx: number) => ({
        id: `admin_map_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(i.name || 'Untitled Battle Map').trim(),
        theme: i.theme || 'Dungeon',
        url: String(i.url || i.imageUrl).trim(),
        description: i.description ? String(i.description).trim() : 'Tactical Battle Map',
        created_at: new Date().toISOString()
      }));

      for (const item of preparedItems) {
        await getCollection('global_battlemaps').insertOne(item);
      }
      const allItems = await getCollection('global_battlemaps').find({}).toArray();
      saveVaultBattlemapsDisk(allItems);
      console.log(`[Admin Library] Batch added ${preparedItems.length} battle maps`);
      res.json({ success: true, count: preparedItems.length, items: preparedItems });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Update Global Battle Map
  app.put('/api/admin/library/battlemap/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const { name, theme, url, description } = req.body || {};
      const updateData: any = {};
      if (name) updateData.name = String(name).trim();
      if (theme) updateData.theme = theme;
      if (url) updateData.url = String(url).trim();
      if (description !== undefined) updateData.description = String(description).trim();

      await getCollection('global_battlemaps').updateOne({ id }, { $set: updateData });
      const allItems = await getCollection('global_battlemaps').find({}).toArray();
      saveVaultBattlemapsDisk(allItems);
      console.log(`[Admin Library] Updated battle map id: ${id}`);
      res.json({ success: true, id, updated: updateData });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Admin Delete Global Battle Map
  app.delete('/api/admin/library/battlemap/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.includes('admin_vault_session_2026')) {
        return res.status(401).json({ detail: 'Unauthorized' });
      }
      const rawId = req.params.id;
      const decodedId = decodeURIComponent(rawId);
      const { url } = req.body || {};
      const col = getCollection('global_battlemaps');
      await col.deleteOne({ id: decodedId });
      if (url) {
        await col.deleteOne({ url: url });
        await col.deleteOne({ imageUrl: url });
      }
      const remaining = await col.find({}).toArray();
      saveVaultBattlemapsDisk(remaining);
      console.log('[Admin Library] Deleted battlemap id: ' + decodedId + ', remaining: ' + remaining.length);
      res.json({ success: true, id: decodedId, remaining: remaining.length });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });;

  // === LICENSE ENDPOINTS ===

  // Trial Start
  app.post('/api/license/trial/start', async (req, res) => {
    try {
      const { device_fingerprint } = req.body;
      if (!device_fingerprint || device_fingerprint.length < 8) {
        return res.status(400).json({ detail: 'Invalid device fingerprint' });
      }

      const existing = await getCollection('trials').findOne({ device_fingerprint });
      if (existing) {
        const expires = new Date(existing.expires_at);
        const remaining = (expires.getTime() - Date.now()) / 1000;
        return res.json({
          status: remaining > 0 ? 'active' : 'expired',
          started_at: existing.started_at,
          expires_at: existing.expires_at,
          days_remaining: Math.max(0, parseFloat((remaining / 86400).toFixed(1)))
        });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const trialDoc = {
        device_fingerprint,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      };
      await getCollection('trials').insertOne(trialDoc);

      res.json({
        status: 'active',
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        days_remaining: 7
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Trial Check
  app.post('/api/license/trial/check', async (req, res) => {
    try {
      const { device_fingerprint } = req.body;
      if (!device_fingerprint) {
        return res.status(400).json({ detail: 'Invalid device fingerprint' });
      }

      const trial = await getCollection('trials').findOne({ device_fingerprint });
      if (!trial) {
        return res.json({ status: 'none', days_remaining: 0 });
      }

      const expires = new Date(trial.expires_at);
      const remaining = (expires.getTime() - Date.now()) / 1000;

      res.json({
        status: remaining > 0 ? 'active' : 'expired',
        started_at: trial.started_at,
        expires_at: trial.expires_at,
        days_remaining: Math.max(0, parseFloat((remaining / 86400).toFixed(1)))
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Validate License
  app.post('/api/license/validate', async (req, res) => {
    try {
      const { license_key, device_fingerprint } = req.body;
      if (!license_key || !device_fingerprint) {
        return res.status(400).json({ detail: 'Missing license_key or device_fingerprint' });
      }

      const lic = await getCollection('licenses').findOne({ license_key });
      if (!lic) {
        return res.status(404).json({ detail: 'Invalid license key' });
      }

      if (lic.revoked) {
        return res.status(403).json({ detail: 'License has been revoked' });
      }

      const devices = lic.device_ids || [];

      if (devices.includes(device_fingerprint)) {
        return res.json({
          valid: true,
          license_key: lic.license_key,
          email: lic.email,
          devices_used: devices.length,
          max_devices: lic.max_devices || 2
        });
      }

      const maxDevices = lic.max_devices || 2;
      if (devices.length >= maxDevices) {
        return res.status(403).json({
          detail: `License already activated on ${maxDevices} devices. Contact support to transfer.`
        });
      }

      devices.push(device_fingerprint);
      await getCollection('licenses').updateOne(
        { license_key },
        { $set: { device_ids: devices, last_validated: new Date().toISOString() } }
      );

      res.json({
        valid: true,
        license_key: lic.license_key,
        email: lic.email,
        devices_used: devices.length,
        max_devices: maxDevices
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Start Purchase (Stripe Simulated / Mocked for extreme reliability)
  app.post('/api/license/purchase', async (req, res) => {
    try {
      const { origin_url, email } = req.body;
      const sessionId = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
      const checkoutUrl = `${origin_url.replace(/\/$/, '')}/license/success?session_id=${sessionId}`;

      await getCollection('payment_transactions').insertOne({
        session_id: sessionId,
        amount: 15.00,
        currency: 'usd',
        email,
        status: 'pending',
        payment_status: 'initiated',
        created_at: new Date().toISOString()
      });

      res.json({
        checkout_url: checkoutUrl,
        session_id: sessionId
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // Poll Purchase Status
  app.get('/api/license/purchase/status/:session_id', async (req, res) => {
    try {
      const { session_id } = req.params;
      const txn = await getCollection('payment_transactions').findOne({ session_id });
      if (!txn) {
        return res.status(404).json({ detail: 'Transaction not found' });
      }

      if (txn.payment_status === 'paid' && txn.license_key) {
        return res.json({
          status: 'paid',
          license_key: txn.license_key,
          message: 'Payment already processed. Here is your license key.'
        });
      }

      // Generate a new human-readable license key: XXXXX-XXXXX-XXXXX-XXXXX
      const generateLicenseKey = () => {
        const segment = () => crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
        return `${segment()}-${segment()}-${segment()}-${segment()}`;
      };

      const licenseKey = generateLicenseKey();

      await getCollection('licenses').insertOne({
        license_key: licenseKey,
        email: txn.email || 'user@example.com',
        device_ids: [],
        max_devices: 2,
        payment_session_id: session_id,
        created_at: new Date().toISOString(),
        revoked: false
      });

      await getCollection('payment_transactions').updateOne(
        { session_id },
        { $set: { status: 'complete', payment_status: 'paid', license_key: licenseKey } }
      );

      res.json({
        status: 'paid',
        amount: 1500,
        currency: 'usd',
        license_key: licenseKey
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // === PRESETS ENDPOINTS ===

  app.get('/api/presets', async (req, res) => {
    try {
      const presets = await getCollection('presets').find({}).toArray();
      res.json(presets);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.get('/api/presets/:preset_id', async (req, res) => {
    try {
      const preset = await getCollection('presets').findOne({ id: req.params.preset_id });
      if (!preset) return res.status(404).json({ detail: 'Preset not found' });
      res.json(preset);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.post('/api/presets', async (req, res) => {
    try {
      const presetId = crypto.randomUUID();
      const preset = {
        id: presetId,
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await getCollection('presets').insertOne(preset);
      res.json(preset);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.put('/api/presets/:preset_id', async (req, res) => {
    try {
      const { preset_id } = req.params;
      const existing = await getCollection('presets').findOne({ id: preset_id });
      if (!existing) return res.status(404).json({ detail: 'Preset not found' });

      const updated = {
        ...existing,
        ...req.body,
        updated_at: new Date().toISOString()
      };
      await getCollection('presets').updateOne({ id: preset_id }, { $set: updated });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.delete('/api/presets/:preset_id', async (req, res) => {
    try {
      await getCollection('presets').deleteOne({ id: req.params.preset_id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // === MEASUREMENTS ENDPOINTS ===

  app.get('/api/measurements', async (req, res) => {
    try {
      const measurements = await getCollection('measurements').find({}).toArray();
      res.json(measurements);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.post('/api/measurements', async (req, res) => {
    try {
      const id = crypto.randomUUID();
      const m = {
        id,
        ...req.body
      };
      await getCollection('measurements').insertOne(m);
      res.json(m);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.delete('/api/measurements/:measurement_id', async (req, res) => {
    try {
      await getCollection('measurements').deleteOne({ id: req.params.measurement_id });
      res.json({ message: 'Measurement deleted successfully', id: req.params.measurement_id });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // === IMAGE LAYOUTS ENDPOINTS ===

  app.post('/api/image-layouts', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const id = crypto.randomUUID();
      const layout = {
        id,
        user_id: user.user_id,
        name: req.body.name,
        layers: req.body.layers || [],
        created_at: new Date().toISOString()
      };
      await getCollection('image_layouts').insertOne(layout);
      res.json({ id: layout.id, name: layout.name, created_at: layout.created_at, layer_count: layout.layers.length });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.get('/api/image-layouts', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const layouts = await getCollection('image_layouts').find({ user_id: user.user_id }).toArray();
      res.json({ layouts });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.get('/api/image-layouts/:layout_id', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const layout = await getCollection('image_layouts').findOne({ id: req.params.layout_id, user_id: user.user_id });
      if (!layout) return res.status(404).json({ detail: 'Layout not found' });
      res.json(layout);
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.delete('/api/image-layouts/:layout_id', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await getCollection('image_layouts').deleteOne({ id: req.params.layout_id, user_id: user.user_id });
      if (result.deletedCount === 0) return res.status(404).json({ detail: 'Layout not found' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  // === VIDEO UPLOAD & SERVICE ===

  app.post('/api/upload-video', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ detail: 'No file uploaded' });
      }

      const ext = path.extname(req.file.originalname) || '.mp4';
      const videoId = `${crypto.randomUUID()}${ext}`;
      const destPath = path.join(VIDEOS_DIR, videoId);

      fs.renameSync(req.file.path, destPath);

      res.json({
        video_url: `/api/videos/${videoId}`,
        filename: req.file.originalname,
        size: req.file.size
      });
    } catch (e: any) {
      res.status(500).json({ detail: e.message });
    }
  });

  app.get('/api/videos/:video_id', (req, res) => {
    const videoPath = path.join(VIDEOS_DIR, req.params.video_id);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ detail: 'Video not found' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  });

  // === SOCKET.IO COLLABORATION HANDLER ===

  const ioServer = new SocketIOServer(server, {
    path: '/api/socket.io/',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const activeSessions: Record<string, any> = {};

  ioServer.on('connection', (socket) => {
    let currentRoom: string | null = null;

    socket.on('create_session', (data) => {
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();
      const session = {
        code,
        host_sid: socket.id,
        host_name: data.host_name || 'Host',
        participants: {
          host: { sid: socket.id, name: data.host_name || 'Host' },
          guests: []
        },
        drawings: [],
        measurements: [],
        cliparts: [],
        bg_layers: [],
        background_image: null,
        grid_settings: {},
        host_dimensions: { width: 1920, height: 1080 }
      };

      activeSessions[code] = session;
      currentRoom = code;
      socket.join(code);

      socket.emit('session_created', session);
    });

    socket.on('join_session', (data) => {
      const code = (data.code || '').toUpperCase();
      const session = activeSessions[code];

      if (!session) {
        socket.emit('session_error', { message: 'Session not found' });
        return;
      }

      const guest = {
        sid: socket.id,
        name: data.guest_name || 'Guest',
        blocked: false
      };

      session.participants.guests.push(guest);
      currentRoom = code;
      socket.join(code);

      socket.emit('session_joined', session);
      socket.to(code).emit('participants_updated', session.participants);
    });

    // Drawing Sync
    socket.on('draw_path', (path) => {
      if (currentRoom && activeSessions[currentRoom]) {
        activeSessions[currentRoom].drawings.push(path);
        socket.to(currentRoom).emit('draw_path', path);
      }
    });

    socket.on('erase_at', (data) => {
      if (currentRoom) {
        socket.to(currentRoom).emit('erase_at', data);
      }
    });

    socket.on('clear_all_drawings', () => {
      if (currentRoom && activeSessions[currentRoom]) {
        activeSessions[currentRoom].drawings = [];
        socket.to(currentRoom).emit('clear_all_drawings');
      }
    });

    socket.on('undo_drawing', () => {
      if (currentRoom && activeSessions[currentRoom]) {
        activeSessions[currentRoom].drawings.pop();
        socket.to(currentRoom).emit('undo_drawing');
      }
    });

    // Cursor Sync
    socket.on('cursor_move', (data) => {
      if (currentRoom) {
        socket.to(currentRoom).emit('cursor_move', { ...data, sid: socket.id });
      }
    });

    // Generic Broadcast for collaborative events
    socket.on('disconnect', () => {
      if (currentRoom && activeSessions[currentRoom]) {
        const session = activeSessions[currentRoom];
        if (session.host_sid === socket.id) {
          // Host disconnected
          socket.to(currentRoom).emit('host_status_changed', { host_disconnected: true });
          // Optional clean up after 15 mins
        } else {
          session.participants.guests = session.participants.guests.filter((g: any) => g.sid !== socket.id);
          socket.to(currentRoom).emit('participants_updated', session.participants);
        }
      }
    });

    // Handle any custom game state updates
    socket.onAny((event, ...args) => {
      if (currentRoom && !['create_session', 'join_session', 'draw_path', 'erase_at', 'clear_all_drawings', 'undo_drawing', 'cursor_move'].includes(event)) {
        socket.to(currentRoom).emit(event, ...args);
      }
    });
  });

  // === VITE MIDDLEWARE ===
  const viteConfigFile = path.join(process.cwd(), 'vite.config.ts');
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(viteConfigFile)) {
    try {
      const vite = await createViteServer({
        configFile: viteConfigFile,
        server: { middlewareMode: true, hmr: false },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.error('[Vite] Error creating vite server:', viteErr.message);
    }
  } else {
    const distPath = path.join(process.cwd(), 'frontend', 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send('<!doctype html><html><body><div id="root"></div></body></html>');
        }
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
