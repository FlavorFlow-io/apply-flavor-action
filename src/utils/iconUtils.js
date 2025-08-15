import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";

/**
 * Android app icon sizes and their corresponding folder names
 */
const ICON_SIZES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

/**
 * Generate app icons from a logo file
 * @param {string} logoPath - Path to the logo file
 * @param {string} appModule - Path to the Android app module
 * @returns {Promise<boolean>} - Success status
 */
export async function generateAppIcons(logoPath, appModule) {
  try {
    if (!logoPath || !fs.existsSync(logoPath)) {
      core.warning("Logo file not found, skipping icon generation");
      return false;
    }

    core.info("=== Generating App Icons ===");
    core.info(`Source logo: ${logoPath}`);

    // Check if ImageMagick or other image processing tools are available
    const hasImageMagick = await checkImageMagick();
    
    if (!hasImageMagick) {
      // Fallback: Copy the original logo as the main icon in WebP format
      await copyLogoAsIcon(logoPath, appModule);
      return true;
    }

    // Generate icons for all density folders in WebP format
    let successCount = 0;
    const totalSizes = Object.keys(ICON_SIZES).length;

    for (const [density, size] of Object.entries(ICON_SIZES)) {
      try {
        await generateIconForDensity(logoPath, appModule, density, size);
        successCount++;
        core.info(`✓ Generated ${density} icon (${size}x${size}) in WebP format`);
      } catch (error) {
        core.warning(`Failed to generate ${density} icon: ${error.message}`);
      }
    }

    if (successCount > 0) {
      core.info(`✓ Generated ${successCount}/${totalSizes} app icons successfully`);
      return true;
    } else {
      core.warning("Failed to generate any app icons");
      return false;
    }

  } catch (error) {
    core.error(`Icon generation failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if ImageMagick is available for image processing
 * @returns {Promise<boolean>}
 */
async function checkImageMagick() {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    await execAsync('convert --version');
    return true;
  } catch (error) {
    core.info("ImageMagick not available, using fallback icon generation");
    return false;
  }
}

/**
 * Clean up existing launcher icons to avoid duplicate resource errors
 * @param {string} appModule - Path to the Android app module
 */
function cleanupExistingIcons(appModule) {
  try {
    core.info("Cleaning up existing launcher icons...");
    
    for (const density of Object.keys(ICON_SIZES)) {
      const densityFolder = path.join(appModule, 'src', 'main', 'res', `mipmap-${density}`);
      
      if (fs.existsSync(densityFolder)) {
        // Remove both .png and .webp versions of ic_launcher
        const pngIcon = path.join(densityFolder, 'ic_launcher.png');
        const webpIcon = path.join(densityFolder, 'ic_launcher.webp');
        const foregroundPng = path.join(densityFolder, 'ic_launcher_foreground.png');
        const foregroundWebp = path.join(densityFolder, 'ic_launcher_foreground.webp');
        
        [pngIcon, webpIcon, foregroundPng, foregroundWebp].forEach(iconPath => {
          if (fs.existsSync(iconPath)) {
            fs.unlinkSync(iconPath);
            core.info(`✓ Removed existing icon: ${path.basename(iconPath)}`);
          }
        });
      }
    }
    
    // Also clean up adaptive icon folders
    const adaptiveFolders = [
      'mipmap-anydpi-v26',
      'mipmap-anydpi-v33'
    ];
    
    adaptiveFolders.forEach(folder => {
      const folderPath = path.join(appModule, 'src', 'main', 'res', folder);
      if (fs.existsSync(folderPath)) {
        const adaptiveIcon = path.join(folderPath, 'ic_launcher.xml');
        if (fs.existsSync(adaptiveIcon)) {
          fs.unlinkSync(adaptiveIcon);
          core.info(`✓ Removed existing adaptive icon: ${folder}/ic_launcher.xml`);
        }
      }
    });
    
    core.info("✓ Existing launcher icons cleaned up");
  } catch (error) {
    core.warning(`Failed to cleanup existing icons: ${error.message}`);
  }
}

/**
 * Generate icon for a specific density using ImageMagick in WebP format
 * @param {string} logoPath - Path to the source logo
 * @param {string} appModule - Path to the Android app module
 * @param {string} density - Density folder name (mdpi, hdpi, etc.)
 * @param {number} size - Icon size in pixels
 */
async function generateIconForDensity(logoPath, appModule, density, size) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Create density folder path
  const densityFolder = path.join(appModule, 'src', 'main', 'res', `mipmap-${density}`);
  const iconPath = path.join(densityFolder, 'ic_launcher.webp');

  // Create directory if it doesn't exist
  if (!fs.existsSync(densityFolder)) {
    fs.mkdirSync(densityFolder, { recursive: true });
  }

  // Generate icon using ImageMagick and convert to WebP format
  const command = `convert "${logoPath}" -resize ${size}x${size} -background transparent "${iconPath}"`;
  await execAsync(command);

  // Verify the icon was created
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Icon file was not created: ${iconPath}`);
  }
}

/**
 * Fallback: Copy the logo as the main app icon in WebP format
 * @param {string} logoPath - Path to the source logo
 * @param {string} appModule - Path to the Android app module
 */
async function copyLogoAsIcon(logoPath, appModule) {
  try {
    // Try to convert to WebP using ImageMagick first
    const hasImageMagick = await checkImageMagick();
    
    if (hasImageMagick) {
      // Convert and copy to all density folders
      for (const [density, size] of Object.entries(ICON_SIZES)) {
        const densityFolder = path.join(appModule, 'src', 'main', 'res', `mipmap-${density}`);
        const iconPath = path.join(densityFolder, 'ic_launcher.webp');
        
        if (!fs.existsSync(densityFolder)) {
          fs.mkdirSync(densityFolder, { recursive: true });
        }
        
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const command = `convert "${logoPath}" -resize ${size}x${size} -background transparent "${iconPath}"`;
          await execAsync(command);
          core.info(`✓ Converted logo to WebP icon: ${density} (${size}x${size})`);
        } catch (error) {
          // If conversion fails, copy as-is with .webp extension
          fs.copyFileSync(logoPath, iconPath);
          core.info(`✓ Copied logo as WebP icon: ${density}`);
        }
      }
    } else {
      // Fallback: Copy the logo file directly with .webp extension
      for (const [density] of Object.entries(ICON_SIZES)) {
        const densityFolder = path.join(appModule, 'src', 'main', 'res', `mipmap-${density}`);
        const iconPath = path.join(densityFolder, 'ic_launcher.webp');
        
        if (!fs.existsSync(densityFolder)) {
          fs.mkdirSync(densityFolder, { recursive: true });
        }
        
        fs.copyFileSync(logoPath, iconPath);
        core.info(`✓ Copied logo as WebP icon: ${density}`);
      }
    }

  } catch (error) {
    throw new Error(`Failed to copy logo as icon: ${error.message}`);
  }
}

/**
 * Generate adaptive icons for Android 8.0+ (API level 26+)
 * @param {string} logoPath - Path to the source logo
 * @param {string} appModule - Path to the Android app module
 * @param {string} backgroundColor - Background color for adaptive icon
 * @returns {Promise<boolean>} - Success status
 */
export async function generateAdaptiveIcons(logoPath, appModule, backgroundColor = '#FFFFFF') {
  try {
    if (!logoPath || !fs.existsSync(logoPath)) {
      core.warning("Logo file not found, skipping adaptive icon generation");
      return false;
    }

    core.info("=== Generating Adaptive Icons ===");

    // Create adaptive icon XML files
    await createAdaptiveIconXml(appModule, backgroundColor);
    
    // Generate foreground layer (the logo)
    await generateForegroundLayer(logoPath, appModule);

    core.info("✓ Adaptive icons generated successfully");
    return true;

  } catch (error) {
    core.error(`Adaptive icon generation failed: ${error.message}`);
    return false;
  }
}

/**
 * Create adaptive icon XML configuration
 * @param {string} appModule - Path to the Android app module
 * @param {string} backgroundColor - Background color
 */
async function createAdaptiveIconXml(appModule, backgroundColor) {
  const mipmapAnydpiV26 = path.join(appModule, 'src', 'main', 'res', 'mipmap-anydpi-v26');
  
  if (!fs.existsSync(mipmapAnydpiV26)) {
    fs.mkdirSync(mipmapAnydpiV26, { recursive: true });
  }

  // Create ic_launcher.xml
  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;

  fs.writeFileSync(path.join(mipmapAnydpiV26, 'ic_launcher.xml'), adaptiveIconXml);

  // Create background color resource
  const colorsDir = path.join(appModule, 'src', 'main', 'res', 'values');
  if (!fs.existsSync(colorsDir)) {
    fs.mkdirSync(colorsDir, { recursive: true });
  }

  const colorsPath = path.join(colorsDir, 'colors.xml');
  let colorsContent = '';

  if (fs.existsSync(colorsPath)) {
    colorsContent = fs.readFileSync(colorsPath, 'utf8');
  } else {
    colorsContent = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>';
  }

  // Add background color if not exists
  if (!colorsContent.includes('ic_launcher_background')) {
    const colorLine = `    <color name="ic_launcher_background">${backgroundColor}</color>`;
    colorsContent = colorsContent.replace('</resources>', `${colorLine}\n</resources>`);
    fs.writeFileSync(colorsPath, colorsContent);
  }
}

/**
 * Generate foreground layer for adaptive icons in WebP format
 * @param {string} logoPath - Path to the source logo
 * @param {string} appModule - Path to the Android app module
 */
async function generateForegroundLayer(logoPath, appModule) {
  // Generate foreground icons for different densities
  for (const [density, size] of Object.entries(ICON_SIZES)) {
    const densityFolder = path.join(appModule, 'src', 'main', 'res', `mipmap-${density}`);
    const foregroundPath = path.join(densityFolder, 'ic_launcher_foreground.webp');

    if (!fs.existsSync(densityFolder)) {
      fs.mkdirSync(densityFolder, { recursive: true });
    }

    // For foreground layer, use 108dp total size with 72dp safe area
    const foregroundSize = Math.round(size * 1.5); // 108/72 ratio
    
    const hasImageMagick = await checkImageMagick();
    
    if (hasImageMagick) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Create foreground with padding for safe area in WebP format
        const command = `convert "${logoPath}" -resize ${size}x${size} -background transparent -gravity center -extent ${foregroundSize}x${foregroundSize} "${foregroundPath}"`;
        await execAsync(command);
      } catch (error) {
        // Fallback: copy the original logo with .webp extension
        fs.copyFileSync(logoPath, foregroundPath);
        core.warning(`Failed to generate foreground for ${density}, copied original logo: ${error.message}`);
      }
    } else {
      // Fallback: copy the original logo with .webp extension
      fs.copyFileSync(logoPath, foregroundPath);
    }
  }
}
