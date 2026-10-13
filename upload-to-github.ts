import fs from 'fs';
import path from 'path';
import axios from 'axios';

const owner = 'leokraj';
const repo = 'Krajden-Grid';
const tag = 'v1.3.0';
const title = 'Krajden Grid v1.3.0';
const filePath = path.join(process.cwd(), 'backend', 'downloads', 'KrajdenGrid-Portable.zip');

async function uploadToGitHub() {
  console.log('=== GITHUB RELEASE UPLOAD ENGINE ===');

  // 1. Resolve token
  let token = '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';
  if (!token && fs.existsSync('/app/.dev.env.json')) {
    try {
      const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
      token = devEnv.GITHUB_TOKEN || devEnv.GeminiUpload;
    } catch (e) {
      console.warn('Failed to parse /app/.dev.env.json:', e);
    }
  }
  if (!token) {
    token = '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';
  }

  // 2. Validate local file
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ ERROR: Local file not found at ${filePath}`);
    process.exit(1);
  }
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;
  console.log(`Local file validated: KrajdenGrid-Portable.zip (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 3. Check if release already exists
    let release: any = null;
    console.log(`Checking if release ${tag} already exists on ${owner}/${repo}...`);
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
        { headers }
      );
      release = response.data;
      console.log(`Found existing release: "${release.name}" (ID: ${release.id})`);
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        console.log(`Release ${tag} does not exist. Creating a new one...`);
      } else {
        throw new Error(`Failed to check existing release: ${err.message}`);
      }
    }

    // 4. Create release if not found
    if (!release) {
      try {
        const createResponse = await axios.post(
          `https://api.github.com/repos/${owner}/${repo}/releases`,
          {
            tag_name: tag,
            name: title,
            body: `Production build release of ${title}`,
            draft: false,
            prerelease: false,
          },
          { headers }
        );
        release = createResponse.data;
        console.log(`Successfully created release: "${release.name}" (ID: ${release.id})`);
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.message;
        const errDetails = err.response?.data ? JSON.stringify(err.response.data) : '';
        throw new Error(`Failed to create release: ${errMsg}. Details: ${errDetails}`);
      }
    }

    const uploadUrlTemplate = release.upload_url; // Format: "https://uploads.github.com/.../assets{?name,label}"
    const uploadBaseUrl = uploadUrlTemplate.split('{')[0];

    // Helper to delete an asset if it already exists
    const ensureAssetCleaned = async (assetName: string) => {
      const existingAsset = release.assets?.find((a: any) => a.name === assetName);
      if (existingAsset) {
        console.log(`Asset "${assetName}" already exists in the release (ID: ${existingAsset.id}). Deleting old asset...`);
        try {
          await axios.delete(
            `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`,
            { headers }
          );
          console.log(`Deleted existing asset "${assetName}".`);
        } catch (err: any) {
          throw new Error(`Failed to delete existing asset "${assetName}": ${err.message}`);
        }
      }
    };

    // Helper to upload a single asset from path
    const uploadAssetFile = async (assetName: string, targetPath: string, contentType = 'application/zip') => {
      await ensureAssetCleaned(assetName);

      console.log(`Uploading "${assetName}" to GitHub Releases...`);
      const fileBuffer = fs.readFileSync(targetPath);

      const uploadHeaders = {
        ...headers,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
      };

      try {
        const uploadResponse = await axios.post(
          `${uploadBaseUrl}?name=${assetName}`,
          fileBuffer,
          {
            headers: uploadHeaders,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );
        console.log(`✅ Successfully uploaded asset: "${assetName}"!`);
        return uploadResponse.data.browser_download_url;
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.message;
        const errDetails = err.response?.data ? JSON.stringify(err.response.data) : '';
        throw new Error(`Failed to upload asset "${assetName}": ${errMsg}. Details: ${errDetails}`);
      }
    };

    // 5. Upload assets
    const url1 = await uploadAssetFile('KrajdenGrid-Portable.zip', filePath, 'application/zip');
    const url2 = await uploadAssetFile('KrajdenGrid-Windows.zip', path.join(process.cwd(), 'backend', 'downloads', 'KrajdenGrid-Windows.zip'), 'application/zip');
    
    const batPath = path.join(process.cwd(), 'backend', 'downloads', 'KrajdenGrid-Setup.bat');
    let url3 = '';
    if (fs.existsSync(batPath)) {
      url3 = await uploadAssetFile('KrajdenGrid-Setup.bat', batPath, 'text/plain');
    }

    console.log('\n==================================================');
    console.log('🎉 ALL ASSETS UPLOADED SUCCESSFULLY!');
    console.log(`Asset 1: ${url1}`);
    console.log(`Asset 2: ${url2}`);
    if (url3) console.log(`Asset 3: ${url3}`);
    console.log('==================================================\n');

  } catch (error: any) {
    console.error('\n❌ Release process failed:', error.message);
    process.exit(1);
  }
}

uploadToGitHub();
