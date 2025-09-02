import * as core from "@actions/core";
import * as path from "path";
import * as fs from "fs";

/**
 * Downloads an asset from URL and returns the absolute path
 * @param {string} assetUrl - The URL to download the asset from
 * @param {string} apiKey - API key for authentication
 * @param {string} outputPath - Path where the asset should be saved
 * @returns {Promise<string>} - Absolute path to the downloaded asset
 */
export async function downloadAsset(assetUrl, apiKey, outputPath) {
  try {
    core.info(`Downloading asset from: ${assetUrl}`);
    
    // Fetch the asset
    const response = await fetch(assetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    // Get content type to determine file extension
    const contentType = response.headers.get('content-type') || '';
    let extension = getExtensionFromContentType(contentType);
    
    // If no extension could be determined from content type, try to get it from URL
    if (!extension) {
      const urlPath = new URL(assetUrl).pathname;
      const urlExtension = path.extname(urlPath);
      if (urlExtension) {
        extension = urlExtension;
      } else {
        extension = '.bin'; // fallback for unknown types
      }
    }

    // Create final output path with proper extension
    const finalOutputPath = `${outputPath}${extension}`;
    const outputDir = path.dirname(finalOutputPath);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get the asset data as buffer
    const assetBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(assetBuffer);

    // Write the file
    fs.writeFileSync(finalOutputPath, buffer);

    // Verify file was written successfully
    if (fs.existsSync(finalOutputPath)) {
      const stats = fs.statSync(finalOutputPath);
      core.info(`Asset downloaded successfully: ${finalOutputPath}`);
      core.info(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
      core.info(`Content type: ${contentType}`);
      
      // Return absolute path
      return path.resolve(finalOutputPath);
    } else {
      throw new Error('Asset file was not created successfully');
    }
  } catch (error) {
    throw new Error(`Failed to download asset: ${error.message}`);
  }
}

/**
 * Gets file extension from content type
 * @param {string} contentType - The content type header
 * @returns {string|null} - File extension or null if unknown
 */
function getExtensionFromContentType(contentType) {
  const contentTypeLower = contentType.toLowerCase();
  
  // Define content type to extension mappings
  const contentTypeMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'application/pdf': '.pdf',
    'application/json': '.json',
    'application/xml': '.xml',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg'
  };
  
  // Find matching content type
  for (const [type, extension] of Object.entries(contentTypeMap)) {
    if (contentTypeLower.includes(type)) {
      return extension;
    }
  }
  
  return null;
}

/**
 * Downloads all assets from the flavor configuration and sets environment variables
 * @param {Object} assets - Assets object from flavor configuration
 * @param {string} apiKey - API key for authentication
 * @param {string} destinationDir - Directory where assets should be downloaded
 * @returns {Promise<Object>} - Object mapping asset names to their absolute paths
 */
export async function downloadAndSetAssets(assets, apiKey, destinationDir) {
  if (!assets || typeof assets !== 'object') {
    core.info("No assets found to download");
    return {};
  }

  core.info("=== Downloading Assets ===");
  const downloadedAssets = {};
  
  for (const [assetName, assetUrl] of Object.entries(assets)) {
    try {
      const outputPath = path.join(destinationDir, assetName);
      const absolutePath = await downloadAsset(assetUrl, apiKey, outputPath);
      
      // Set environment variable for the asset
      const envVarName = assetName.toUpperCase();
      core.exportVariable(envVarName, absolutePath);
      core.info(`Set environment variable: ${envVarName}=${absolutePath}`);
      
      downloadedAssets[assetName] = absolutePath;
    } catch (error) {
      core.warning(`Failed to download asset '${assetName}': ${error.message}`);
      // Continue with other assets even if one fails
    }
  }
  
  core.info(`Successfully downloaded ${Object.keys(downloadedAssets).length} assets`);
  return downloadedAssets;
}

/**
 * Sets environment variables from the flavor variables configuration
 * @param {Object} variables - Variables object from flavor configuration
 */
export function setFlavorVariables(variables) {
  if (!variables || typeof variables !== 'object') {
    core.info("No variables found to set");
    return;
  }

  core.info("=== Setting Flavor Variables ===");
  
  for (const [varName, varValue] of Object.entries(variables)) {
    try {
      const envVarName = varName.toUpperCase();
      const stringValue = String(varValue);
      
      core.exportVariable(envVarName, stringValue);
      core.info(`Set environment variable: ${envVarName}=${stringValue}`);
    } catch (error) {
      core.warning(`Failed to set variable '${varName}': ${error.message}`);
    }
  }
}
