import * as core from "@actions/core";
import { findAndroidAppModule } from './utils/fileUtils.js';
import { detectExistingPackage, updatePackageReferences } from './utils/packageUtils.js';
import { updateComposeTheme } from './utils/composeUtils.js';
import { updateAppName, updateXmlColors, createThemeXml, updateApplicationId } from './utils/androidUtils.js';
import { generateAppIcons, generateAdaptiveIcons } from './utils/iconUtils.js';
import { downloadAndSetAssets, setFlavorVariables, downloadAsset } from './utils/assetUtils.js';

async function handleLogoDownload(flavor, apiKey) {
  if (!flavor.logo_url || !flavor.id) {
    core.info("No logo URL or flavor ID found, skipping logo download");
    return null;
  }

  core.info("=== Logo Download ===");
  try {
    const logoOutputPath = `./assets/logos/${flavor.name || flavor.id}`;
    const logoPath = await downloadAsset(flavor.logo_url, apiKey, logoOutputPath);
    
    core.info(`Logo saved to: ${logoPath}`);
    return logoPath;
  } catch (logoError) {
    core.warning(`Logo download failed: ${logoError.message}`);
    core.warning("Continuing without logo...");
    return null;
  }
}

async function applyTheming(appModule, flavor, projectType) {
  if (!flavor.theme) {
    return;
  }

  if (projectType === 'android-native-compose') {
    core.info("Using project type: android-native-compose - updating Compose theme files only");
    updateComposeTheme(appModule, flavor);
  } else if (projectType === 'android-native-xml') {
    core.info("Using project type: android-native-xml - updating XML theme files only");
    updateXmlColors(appModule, flavor);
    createThemeXml(appModule, flavor);
  } else {
    core.info("No project type specified - skipping theming file manipulation");
  }
}

async function applyBranding(flavor, logoPath, projectType) {
  try {
    core.info("=== Applying Branding ===");
    core.info(`Project Type: ${projectType || 'none - environment variables only'}`);
    
    // If no project type is specified, skip all file manipulations
    if (!projectType) {
      core.info("No project type specified - skipping all file manipulations");
      core.info("Only environment variables and assets will be processed");
      return;
    }
    
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
    
    // Update colors and theme based on project type
    await applyTheming(appModule, flavor, projectType);
    
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
  // Expose theme colors as environment variables
  if (flavor.theme) {
    if (flavor.theme.light && typeof flavor.theme.light === 'object') {
      for (const [key, value] of Object.entries(flavor.theme.light)) {
        if (typeof value !== 'undefined') {
          const envVar = `FLAVORFLOW_THEME_LIGHT_${key.toUpperCase()}`;
          core.exportVariable(envVar, String(value));
          core.info(`Set environment variable: ${envVar}=${value}`);
        }
      }
    }
    if (flavor.theme.dark && typeof flavor.theme.dark === 'object') {
      for (const [key, value] of Object.entries(flavor.theme.dark)) {
        if (typeof value !== 'undefined') {
          const envVar = `FLAVORFLOW_THEME_DARK_${key.toUpperCase()}`;
          core.exportVariable(envVar, String(value));
          core.info(`Set environment variable: ${envVar}=${value}`);
        }
      }
    }
  }
  // Get inputs
  const apiKey = core.getInput("project-api-key");
  const flavorJson = core.getInput("flavor");
  const assetsDestination = core.getInput("assets-destination") || "./assets";
  const projectType = core.getInput("project-type");

  if (!apiKey) {
    throw new Error("project-api-key input is required");
  }
  
  if (!flavorJson) {
    throw new Error("flavor input is required");
  }

  // Validate project type if provided
  const validProjectTypes = ['android-native-compose', 'android-native-xml'];
  if (projectType && !validProjectTypes.includes(projectType)) {
    throw new Error(`Invalid project-type: ${projectType}. Valid types are: ${validProjectTypes.join(', ')}`);
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
  core.info(`Project Type: ${projectType || 'none - environment variables only'}`);
  core.info(`Assets Destination: ${assetsDestination}`);


  // Set environment variables from flavor variables
  if (flavor.variables) {
    setFlavorVariables(flavor.variables);
  }

  // Expose FLAVORFLOW_NAME, FLAVORFLOW_APP_NAME, FLAVORFLOW_PACKAGE_NAME
  if (flavor.name) {
    core.exportVariable('FLAVORFLOW_NAME', String(flavor.name));
    core.info(`Set environment variable: FLAVORFLOW_NAME=${flavor.name}`);
  }
  if (flavor.app_name) {
    core.exportVariable('FLAVORFLOW_APP_NAME', String(flavor.app_name));
    core.info(`Set environment variable: FLAVORFLOW_APP_NAME=${flavor.app_name}`);
  }
  if (flavor.package_name) {
    core.exportVariable('FLAVORFLOW_PACKAGE_NAME', String(flavor.package_name));
    core.info(`Set environment variable: FLAVORFLOW_PACKAGE_NAME=${flavor.package_name}`);
  }

  // Download assets and set environment variables
  let downloadedAssets = {};
  if (flavor.assets) {
    downloadedAssets = await downloadAndSetAssets(flavor.assets, apiKey, assetsDestination);
  }

  // Log theme information if available
  if (flavor.theme?.light) {
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

  // Download logo if available and project type is specified
  let logoPath = null;
  if (projectType) {
    logoPath = await handleLogoDownload(flavor, apiKey);
    if (logoPath) {
      core.setOutput("logo-path", logoPath);
      core.exportVariable('FLAVORFLOW_LOGO', logoPath);
      core.info(`Set environment variable: FLAVORFLOW_LOGO=${logoPath}`);
    }
  } else {
    core.info("No project type specified - skipping logo download");
  }

  // Apply all branding changes
  await applyBranding(flavor, logoPath, projectType);

  // Set outputs
  core.setOutput("status", "success");
  core.setOutput("flavor-name", flavor.name || flavor.id || 'unknown');
  core.setOutput("package-name", flavor.package_name || '');
  core.setOutput("assets-downloaded", Object.keys(downloadedAssets).length.toString());
  core.setOutput("variables-set", flavor.variables ? Object.keys(flavor.variables).length.toString() : "0");
  core.setOutput("project-type", projectType || 'none');
  
  if (projectType) {
    core.info("=== Branding Applied Successfully ===");
  } else {
    core.info("=== Environment Variables Set Successfully ===");
  }
  core.info(`Downloaded ${Object.keys(downloadedAssets).length} assets`);
  core.info(`Set ${flavor.variables ? Object.keys(flavor.variables).length : 0} environment variables`);

} catch (error) {
  core.setFailed(error.message);
}