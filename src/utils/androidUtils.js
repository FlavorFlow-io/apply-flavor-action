import * as core from '@actions/core';
import { readFileContent, writeFileContent, ensureDirectoryExists } from './fileUtils.js';
import * as path from 'path';

/**
 * Android resource management utilities
 */

export function updateAppName(appModule, config) {
  const appName = config.app_name;
  if (!appName) {
    core.info('No app name specified, skipping app name update');
    return;
  }
  
  const stringsPath = path.join(appModule, 'src/main/res/values/strings.xml');
  
  try {
    let content;
    
    if (require('fs').existsSync(stringsPath)) {
      content = readFileContent(stringsPath);
    } else {
      // Create new strings.xml
      content = `<?xml version="1.0" encoding="utf-8"?>
<resources>
</resources>`;
      ensureDirectoryExists(path.dirname(stringsPath));
    }
    
    // Update app_name
    const appNamePattern = /<string\s+name="app_name"[^>]*>.*?<\/string>/;
    const appNameReplacement = `<string name="app_name">${escapeXml(appName)}</string>`;
    
    if (appNamePattern.test(content)) {
      content = content.replace(appNamePattern, appNameReplacement);
    } else {
      // Add app_name to resources
      content = content.replace(
        '</resources>',
        `    ${appNameReplacement}\n</resources>`
      );
    }
    
    writeFileContent(stringsPath, content);
    core.info(`✓ Updated app name to: ${appName}`);
    
  } catch (error) {
    core.warning(`Failed to update app name: ${error.message}`);
  }
}

export function updateXmlColors(appModule, config) {
  const theme = config.theme?.light;
  if (!theme) {
    core.info('No theme configuration found, skipping XML colors update');
    return;
  }
  
  const colorsPath = path.join(appModule, 'src/main/res/values/colors.xml');
  
  const primaryColor = theme.primary || '#6650a4';
  const secondaryColor = theme.secondary || '#625b71';
  const backgroundColor = theme.background || '#FFFBFE';
  const surfaceColor = theme.surface || '#FFFBFE';
  
  const colorsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Brand Colors -->
    <color name="primary_color">${primaryColor}</color>
    <color name="secondary_color">${secondaryColor}</color>
    <color name="background_color">${backgroundColor}</color>
    <color name="surface_color">${surfaceColor}</color>
    
    <!-- Material Design Colors (for compatibility) -->
    <color name="purple_200">${primaryColor}</color>
    <color name="purple_500">${primaryColor}</color>
    <color name="purple_700">${secondaryColor}</color>
    <color name="teal_200">${secondaryColor}</color>
    <color name="teal_700">${secondaryColor}</color>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
    
    <!-- On Colors -->
    <color name="on_primary">${theme.on_primary || '#FFFFFF'}</color>
    <color name="on_secondary">${theme.on_secondary || '#FFFFFF'}</color>
    <color name="on_background">${theme.on_background || '#1C1B1F'}</color>
    <color name="on_surface">${theme.on_surface || '#1C1B1F'}</color>
</resources>`;
  
  try {
    ensureDirectoryExists(path.dirname(colorsPath));
    writeFileContent(colorsPath, colorsContent);
    core.info(`✓ Updated XML colors: primary=${primaryColor}, secondary=${secondaryColor}`);
  } catch (error) {
    core.warning(`Failed to update XML colors: ${error.message}`);
  }
}

export function createThemeXml(appModule, config) {
  const themeName = generateThemeName(config);
  const themesPath = path.join(appModule, 'src/main/res/values/themes.xml');
  
  // Detect existing theme parent
  const parentTheme = detectExistingThemeParent(appModule) || 'Theme.Material3.DayNight';
  
  const themeContent = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <!-- Base application theme -->
    <style name="${themeName}" parent="${parentTheme}">
        <!-- Customize your theme here -->
        <item name="colorPrimary">@color/primary_color</item>
        <item name="colorSecondary">@color/secondary_color</item>
        <item name="android:colorBackground">@color/background_color</item>
        <item name="colorSurface">@color/surface_color</item>
        <item name="colorOnPrimary">@color/on_primary</item>
        <item name="colorOnSecondary">@color/on_secondary</item>
        <item name="colorOnBackground">@color/on_background</item>
        <item name="colorOnSurface">@color/on_surface</item>
    </style>
    
    <style name="${themeName}.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
    </style>
    
    <style name="${themeName}.AppBarOverlay" parent="ThemeOverlay.AppCompat.Dark.ActionBar" />
    
    <style name="${themeName}.PopupOverlay" parent="ThemeOverlay.AppCompat.Light" />
</resources>`;
  
  try {
    ensureDirectoryExists(path.dirname(themesPath));
    writeFileContent(themesPath, themeContent);
    
    // Update manifest to use the new theme
    updateManifestTheme(appModule, themeName);
    
    core.info(`✓ Created theme: ${themeName}`);
  } catch (error) {
    core.warning(`Failed to create theme XML: ${error.message}`);
  }
}

function generateThemeName(config) {
  const appName = config.app_name || config.name || 'App';
  const cleanName = appName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  return `Theme.${cleanName}`;
}

function detectExistingThemeParent(appModule) {
  const themesPath = path.join(appModule, 'src/main/res/values/themes.xml');
  
  try {
    if (require('fs').existsSync(themesPath)) {
      const content = readFileContent(themesPath);
      
      // Look for existing parent themes
      const parentMatch = content.match(/parent="([^"]+)"/);
      if (parentMatch) {
        return parentMatch[1];
      }
    }
  } catch (error) {
    core.debug(`Failed to detect existing theme parent: ${error.message}`);
  }
  
  return null;
}

function updateManifestTheme(appModule, themeName) {
  const manifestPath = path.join(appModule, 'src/main/AndroidManifest.xml');
  
  try {
    if (require('fs').existsSync(manifestPath)) {
      const content = readFileContent(manifestPath);
      
      // Update application theme
      const updatedContent = content.replace(
        /android:theme="[^"]*"/,
        `android:theme="@style/${themeName}"`
      );
      
      if (content !== updatedContent) {
        writeFileContent(manifestPath, updatedContent);
        core.info(`✓ Updated manifest theme to: ${themeName}`);
      }
    }
  } catch (error) {
    core.warning(`Failed to update manifest theme: ${error.message}`);
  }
}

export function updateApplicationId(appModule, packageName) {
  if (!packageName) {
    core.info('No package name specified, skipping application ID update');
    return;
  }
  
  // First, we need to find the current package name to replace
  let currentPackageName = null;
  
  const buildFiles = ['build.gradle', 'build.gradle.kts'];
  
  // Find current package name from build files
  for (const buildFile of buildFiles) {
    const buildPath = path.join(appModule, buildFile);
    
    try {
      if (require('fs').existsSync(buildPath)) {
        const content = readFileContent(buildPath);
        
        // Look for current applicationId
        const appIdMatch = content.match(/applicationId\s*=?\s*["']([^"']+)["']/);
        if (appIdMatch) {
          currentPackageName = appIdMatch[1];
          break;
        }
        
        // Look for current namespace
        const namespaceMatch = content.match(/namespace\s*=\s*["']([^"']+)["']/);
        if (namespaceMatch) {
          currentPackageName = namespaceMatch[1];
          break;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  if (!currentPackageName) {
    core.warning('Could not find current package name in build files');
    return;
  }
  
  if (currentPackageName === packageName) {
    core.info(`Package name already set to: ${packageName}`);
    return;
  }
  
  // Now replace all occurrences of the old package name with the new one
  for (const buildFile of buildFiles) {
    const buildPath = path.join(appModule, buildFile);
    
    try {
      if (require('fs').existsSync(buildPath)) {
        let content = readFileContent(buildPath);
        const originalContent = content;
        
        // Replace all occurrences of the old package name with the new one
        content = content.replace(new RegExp(escapeRegex(currentPackageName), 'g'), packageName);
        
        if (content !== originalContent) {
          writeFileContent(buildPath, content);
          core.info(`✓ Updated package name from ${currentPackageName} to ${packageName} in ${buildFile}`);
          return; // Only update one build file
        }
      }
    } catch (error) {
      core.warning(`Failed to update ${buildPath}: ${error.message}`);
    }
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
