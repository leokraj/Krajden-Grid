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

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // === MongoDB Client Setup ===
  let db: Db | null = null;
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'overgrid';

  try {
    const mongoClient = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 1500,
      connectTimeoutMS: 1500
    });
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    console.log(`Connected to MongoDB: ${dbName}`);
  } catch (err: any) {
    console.error('Failed to connect to MongoDB, using in-memory mock storage fallback:', err.message);
  }

  // Fallback in-memory DB if Mongo is unavailable
  const mockDb: Record<string, any[]> = {
    users: [],
    user_sessions: [],
    user_cliparts: [],
    trials: [],
    licenses: [],
    payment_transactions: [],
    presets: [],
    measurements: [],
    image_layouts: []
  };

  const getCollection = (name: string) => {
    if (db) {
      return {
        findOne: (query: any, projection?: any) => db!.collection(name).findOne(query, projection),
        find: (query: any, projection?: any) => {
          const cursor = db!.collection(name).find(query, projection);
          return {
            toArray: () => cursor.toArray(),
            sort: (sortQuery: any) => {
              const sortedCursor = cursor.sort(sortQuery);
              return { toArray: () => sortedCursor.toArray() };
            }
          };
        },
        insertOne: (doc: any) => db!.collection(name).insertOne(doc),
        updateOne: (query: any, update: any, options?: any) => db!.collection(name).updateOne(query, update, options),
        deleteOne: (query: any) => db!.collection(name).deleteOne(query),
        deleteMany: (query: any) => db!.collection(name).deleteMany(query)
      };
    } else {
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
          return {
            toArray: async () => res,
            sort: () => ({ toArray: async () => res })
          };
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
  app.get('/api/download/:filename', (req, res) => {
    try {
      const requestedFilename = req.params.filename;
      // Extract only the base name of the file to completely prevent any directory traversal attacks
      const filename = path.basename(requestedFilename);

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

      for (const dir of possibleDirs) {
        const testPath = path.join(dir, filename);
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }

      console.log(`[Download] Requested: ${requestedFilename} -> Sanitized: ${filename}`);
      console.log(`[Download] Selected path: ${filePath || 'NOT FOUND'}`);

      if (!filePath || !fs.existsSync(filePath)) {
        console.warn(`[Download] File not found in any search paths: ${filename}`);
        return res.status(404).json({ detail: 'File not found' });
      }

      // Special dynamic modification for .bat setup scripts to use the correct domain
      if (filename.toLowerCase() === 'krajdengrid-setup.bat') {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const origin = `${protocol}://${req.headers.host}`;
        console.log(`[Download] Dynamically injecting origin ${origin} into KrajdenGrid-Setup.bat`);
        
        let batContent = fs.readFileSync(filePath, 'utf8');
        // Replace any hardcoded ais-dev/ais-pre URLs with the dynamic origin
        batContent = batContent.replace(
          /https:\/\/ais-(dev|pre)-uozjwodwx7ctzjsx4334de-668611332745\.us-east1\.run\.app/g,
          origin
        );
        
        const buffer = Buffer.from(batContent, 'utf8');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=0');
        return res.send(buffer);
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      console.log(`[Download] Serving file size: ${fileSize} bytes`);

      // Determine content type
      let contentType = 'application/octet-stream';
      if (filename.endsWith('.zip')) {
        contentType = 'application/zip';
      } else if (filename.endsWith('.bat')) {
        contentType = 'text/plain';
      } else if (filename.endsWith('.exe')) {
        contentType = 'application/octet-stream';
      }

      // Set download headers
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=0');

      // Check for Range request
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).json({ detail: 'Requested range not satisfiable' });
        }

        const chunksize = (end - start) + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunksize);
        res.setHeader('Content-Type', contentType);

        const fileStream = fs.createReadStream(filePath, { start, end });
        
        fileStream.on('error', (streamErr) => {
          console.error(`[Download] Stream error during range transfer of ${filename}:`, streamErr);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        fileStream.pipe(res);
      } else {
        // Full file transfer
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Type', contentType);

        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (streamErr) => {
          console.error(`[Download] Stream error during transfer of ${filename}:`, streamErr);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        fileStream.pipe(res);
      }

      // Handle connection close or abort safely without crashing the server or throwing unhandled errors
      const cleanup = () => {
        req.off('close', onAbort);
        res.off('close', onAbort);
        res.off('finish', cleanup);
      };

      const onAbort = () => {
        console.log(`[Download] Connection closed or aborted by client for: ${filename}`);
        cleanup();
      };

      req.on('close', onAbort);
      res.on('close', onAbort);
      res.on('finish', cleanup);

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

  const multer = (await import('multer')).default;
  const upload = multer({ dest: UPLOADS_DIR });

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
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
