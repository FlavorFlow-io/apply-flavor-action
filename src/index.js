import * as core from "@actions/core";
import * as path from "path";
import * as fs from "fs";
import { findAndroidAppModule } from './utils/fileUtils.js';
import { detectExistingPackage, updatePackageReferences } from './utils/packageUtils.js';
import { updateComposeTheme } from './utils/composeUtils.js';
import { updateAppName, updateXmlColors, createThemeXml, updateApplicationId } from './utils/androidUtils.js';
import { generateAppIcons, generateAdaptiveIcons } from './utils/iconUtils.js';

async function downloadLogo(logoUrl, apiKey, outputPath) {
  try {
    core.info(`Downloading logo from: ${logoUrl}`);
    
    // Fetch the logo
    const response = await fetch(logoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    // Get content type to determine file extension
    const contentType = response.headers.get('content-type') || '';
    let extension = '.png'; // default fallback
    
    if (contentType.includes('image/svg+xml')) {
      extension = '.svg';
    } else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
      extension = '.jpg';
    } else if (contentType.includes('image/gif')) {
      extension = '.gif';
    } else if (contentType.includes('image/webp')) {
      extension = '.webp';
    }
    // .png is already the default, no need to reassign

    // Create final output path with proper extension
    const finalOutputPath = `${outputPath}${extension}`;
    const outputDir = path.dirname(finalOutputPath);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get the image data as buffer
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Write the file
    fs.writeFileSync(finalOutputPath, buffer);

    // Verify file was written successfully
    if (fs.existsSync(finalOutputPath)) {
      const stats = fs.statSync(finalOutputPath);
      core.info(`Logo downloaded successfully: ${finalOutputPath}`);
      core.info(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
      core.info(`Content type: ${contentType}`);
      return finalOutputPath;
    } else {
      throw new Error('Logo file was not created successfully');
    }
  } catch (error) {
    throw new Error(`Failed to download logo: ${error.message}`);
  }
}

async function handleLogoDownload(flavor, apiKey) {
  if (!flavor.logo_url || !flavor.id) {
    core.info("No logo URL or flavor ID found, skipping logo download");
    return null;
  }

  core.info("=== Logo Download ===");
  try {
    const logoOutputPath = `./assets/logos/${flavor.name || flavor.id}`;
    const logoPath = await downloadLogo(flavor.logo_url, apiKey, logoOutputPath);
    
    core.info(`Logo saved to: ${logoPath}`);
    return logoPath;
  } catch (logoError) {
    core.warning(`Logo download failed: ${logoError.message}`);
    core.warning("Continuing without logo...");
    return null;
  }
}

async function applyBranding(flavor, logoPath) {
  try {
    core.info("=== Applying Branding ===");
    
    // Find Android app module
    const appModule = findAndroidAppModule();
    core.info(`Using Android app module: ${appModule}`);
    
    // Detect existing package name
    const existingPackage = detectExistingPackage(appModule);
    const newPackage = flavor.package_name;
    
    if (existingPackage && newPackage && existingPackage !== newPackage) {
      core.info(`Updating package name from ${existingPackage} to ${newPackage}`);
      updatePackageReferences(appModule, existingPackage, newPackage);
    }
    
    // Update application ID in build.gradle
    if (newPackage) {
      updateApplicationId(appModule, newPackage);
    }
    
    // Update app name
    if (flavor.app_name) {
      updateAppName(appModule, flavor);
    }
    
    // Update colors and theme
    if (flavor.theme) {
      // Update XML colors for compatibility
      updateXmlColors(appModule, flavor);
      
      // Update Compose theme
      updateComposeTheme(appModule, flavor);
      
      // Create theme XML
      createThemeXml(appModule, flavor);
    }
    
    // Generate app icons from logo
    if (logoPath) {
      core.info("=== Generating App Icons ===");
      const iconSuccess = await generateAppIcons(logoPath, appModule);
      if (iconSuccess) {
        core.info("✓ App icons generated successfully");
        
        // Also generate adaptive icons for modern Android
        const backgroundColor = flavor.theme?.light?.background || '#FFFFFF';
        await generateAdaptiveIcons(logoPath, appModule, backgroundColor);
      }
    } else {
      core.info("No logo available - skipping icon generation");
    }
    
    core.info("✓ Branding applied successfully!");
    
  } catch (error) {
    throw new Error(`Failed to apply branding: ${error.message}`);
  }
}

try {
  // Get inputs
  const apiKey = core.getInput("project-api-key");
  const flavorJson = core.getInput("flavor");

  if (!apiKey) {
    throw new Error("project-api-key input is required");
  }
  
  if (!flavorJson) {
    throw new Error("flavor input is required");
  }

  // Parse flavor JSON
  let flavor;
  try {
    flavor = JSON.parse(flavorJson);
  } catch (parseError) {
    throw new Error(`Invalid flavor JSON: ${parseError.message}`);
  }

  core.info("=== Applying Branding Configuration ===");
  core.info(`Flavor Name: ${flavor.name || flavor.id || 'Unknown'}`);
  core.info(`Package Name: ${flavor.package_name || 'Not specified'}`);
  core.info(`App Name: ${flavor.app_name || 'Not specified'}`);

  // Log theme information if available
  if (flavor.theme && flavor.theme.light) {
    core.info("=== Theme Configuration ===");
    const theme = flavor.theme.light;
    if (theme.primary) core.info(`Primary Color: ${theme.primary}`);
    if (theme.secondary) core.info(`Secondary Color: ${theme.secondary}`);
    if (theme.background) core.info(`Background Color: ${theme.background}`);
    if (theme.surface) core.info(`Surface Color: ${theme.surface}`);
    if (theme.on_primary) core.info(`On Primary Color: ${theme.on_primary}`);
    if (theme.on_secondary) core.info(`On Secondary Color: ${theme.on_secondary}`);
    if (theme.on_background) core.info(`On Background Color: ${theme.on_background}`);
    if (theme.on_surface) core.info(`On Surface Color: ${theme.on_surface}`);
  }

  // Download logo if available
  const logoPath = await handleLogoDownload(flavor, apiKey);
  if (logoPath) {
    core.setOutput("logo-path", logoPath);
  }

  // Apply all branding changes
  await applyBranding(flavor, logoPath);

  // Set outputs
  core.setOutput("status", "success");
  core.setOutput("flavor-name", flavor.name || flavor.id || 'unknown');
  core.setOutput("package-name", flavor.package_name || '');
  
  core.info("=== Branding Applied Successfully ===");

} catch (error) {
  core.setFailed(error.message);
}