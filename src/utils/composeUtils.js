import * as core from '@actions/core';
import { readFileContent, writeFileContent, ensureDirectoryExists } from './fileUtils.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Compose theme management utilities
 */

/**
 * Check if the project uses Compose theming (has Theme.kt files)
 * @param {string} appModule - Path to the Android app module
 * @returns {boolean} - True if the project uses Compose theming
 */
export function usesComposeTheming(appModule) {
  try {
    const sourceDirs = ['src/main/java', 'src/main/kotlin'];
    
    for (const sourceDir of sourceDirs) {
      const sourcePath = path.join(appModule, sourceDir);
      
      if (fs.existsSync(sourcePath)) {
        const files = fs.readdirSync(sourcePath, { recursive: true });
        
        // Check for Theme.kt files or @Composable theme functions
        const hasComposeTheme = files.some(file => {
          if (typeof file === 'string' && file.endsWith('Theme.kt')) {
            return true;
          }
          if (typeof file === 'string' && file.endsWith('.kt')) {
            try {
              const filePath = path.join(sourcePath, file);
              const content = fs.readFileSync(filePath, 'utf8');
              return content.includes('@Composable') && 
                     (content.includes('Theme(') || content.includes('MaterialTheme'));
            } catch {
              return false;
            }
          }
          return false;
        });
        
        if (hasComposeTheme) {
          core.info('✓ Project uses Compose theming, XML themes not needed');
          return true;
        }
      }
    }
    
    core.info('✓ Project uses traditional XML theming');
    return false;
  } catch (error) {
    core.debug(`Failed to detect Compose theming: ${error.message}`);
    return false;
  }
}

export function updateComposeTheme(appModule, config) {
  const themeFiles = findComposeThemeFiles(appModule, config);
  
  if (themeFiles.length > 0) {
    core.info(`Found ${themeFiles.length} existing Compose theme files`);
    
    for (const themeFile of themeFiles) {
      updateExistingComposeTheme(themeFile, config);
    }
  } else {
    core.info('No existing Compose theme files found, creating new ones');
    createComposeThemeFiles(appModule, config);
  }
}

function detectPrimarySourceDirectory(appModule) {
  const sourceDirs = ['src/main/java', 'src/main/kotlin'];
  
  for (const sourceDir of sourceDirs) {
    const sourcePath = path.join(appModule, sourceDir);
    
    try {
      if (fs.existsSync(sourcePath)) {
        const files = fs.readdirSync(sourcePath, { recursive: true });
        
        // Check if this directory has source files
        const hasSourceFiles = files.some(file => 
          file.endsWith('.kt') || file.endsWith('.java')
        );
        
        if (hasSourceFiles) {
          core.info(`Detected primary source directory: ${sourceDir}`);
          return sourceDir;
        }
      }
    } catch (error) {
      core.debug(`Failed to check ${sourcePath}: ${error.message}`);
    }
  }
  
  // Default to Java if no source files found
  return 'src/main/java';
}

function findComposeThemeFiles(appModule, config) {
  const themeFiles = [];
  const searchDirs = [
    'src/main/java',
    'src/main/kotlin'
  ];
  
  for (const searchDir of searchDirs) {
    const sourcePath = path.join(appModule, searchDir);
    
    try {
      const files = fs.readdirSync(sourcePath, { recursive: true });
      
      for (const file of files) {
        if ((file.includes('theme') || file.includes('Theme')) && 
            (file.endsWith('.kt') || file.endsWith('.java'))) {
          themeFiles.push(path.join(sourcePath, file));
        }
      }
    } catch (error) {
      core.debug(`Failed to search in ${sourcePath}: ${error.message}`);
    }
  }
  
  return themeFiles;
}

function updateExistingComposeTheme(themeFile, config) {
  try {
    const content = readFileContent(themeFile);
    let updatedContent = content;
    
    if (themeFile.toLowerCase().includes('color')) {
      updatedContent = updateColorFile(content, config);
    } else if (themeFile.toLowerCase().includes('theme')) {
      updatedContent = updateThemeFile(content, config);
    }
    
    if (content !== updatedContent) {
      writeFileContent(themeFile, updatedContent);
      core.info(`Updated ${themeFile}`);
    }
  } catch (error) {
    core.warning(`Failed to update ${themeFile}: ${error.message}`);
  }
}

function updateColorFile(content, config) {
  const lightTheme = config.theme?.light || {};
  const darkTheme = config.theme?.dark || {};
  
  // Add color import if not present
  if (!content.includes('import androidx.compose.ui.graphics.Color')) {
    const packageMatch = content.match(/^package\s+[^\n]+/m);
    if (packageMatch) {
      content = content.replace(
        packageMatch[0],
        `${packageMatch[0]}\n\nimport androidx.compose.ui.graphics.Color`
      );
    }
  }
  
  // Check if Brand colors already exist
  const hasBrandColors = content.includes('// FlavorFlow Branding Colors');
  
  if (!hasBrandColors) {
    // Add comprehensive Brand color variables like the Python version
    const newVariables = [
      '',
      '// FlavorFlow Branding Colors',
      '// Use these colors in your theme for consistent branding',
      ''
    ];
    
    // Add core brand colors only if they exist in config
    if (lightTheme.primary) {
      newVariables.push(`val BrandLightPrimary = Color(${hexToComposeColor(lightTheme.primary)})`);
    }
    if (darkTheme.primary) {
      newVariables.push(`val BrandDarkPrimary = Color(${hexToComposeColor(darkTheme.primary)})`);
    }
    
    if (lightTheme.secondary) {
      newVariables.push(`val BrandLightSecondary = Color(${hexToComposeColor(lightTheme.secondary)})`);
    }
    if (darkTheme.secondary) {
      newVariables.push(`val BrandDarkSecondary = Color(${hexToComposeColor(darkTheme.secondary)})`);
    }
    
    if (lightTheme.tertiary) {
      newVariables.push(`val BrandLightTertiary = Color(${hexToComposeColor(lightTheme.tertiary)})`);
    }
    if (darkTheme.tertiary) {
      newVariables.push(`val BrandDarkTertiary = Color(${hexToComposeColor(darkTheme.tertiary)})`);
    }
    
    if (lightTheme.background) {
      newVariables.push(`val BrandLightBackground = Color(${hexToComposeColor(lightTheme.background)})`);
    }
    if (darkTheme.background) {
      newVariables.push(`val BrandDarkBackground = Color(${hexToComposeColor(darkTheme.background)})`);
    }
    
    if (lightTheme.surface) {
      newVariables.push(`val BrandLightSurface = Color(${hexToComposeColor(lightTheme.surface)})`);
    }
    if (darkTheme.surface) {
      newVariables.push(`val BrandDarkSurface = Color(${hexToComposeColor(darkTheme.surface)})`);
    }
    
    if (lightTheme.on_primary) {
      newVariables.push(`val BrandLightOnPrimary = Color(${hexToComposeColor(lightTheme.on_primary)})`);
    }
    if (darkTheme.on_primary) {
      newVariables.push(`val BrandDarkOnPrimary = Color(${hexToComposeColor(darkTheme.on_primary)})`);
    }
    
    if (lightTheme.on_secondary) {
      newVariables.push(`val BrandLightOnSecondary = Color(${hexToComposeColor(lightTheme.on_secondary)})`);
    }
    if (darkTheme.on_secondary) {
      newVariables.push(`val BrandDarkOnSecondary = Color(${hexToComposeColor(darkTheme.on_secondary)})`);
    }
    
    if (lightTheme.on_tertiary) {
      newVariables.push(`val BrandLightOnTertiary = Color(${hexToComposeColor(lightTheme.on_tertiary)})`);
    }
    if (darkTheme.on_tertiary) {
      newVariables.push(`val BrandDarkOnTertiary = Color(${hexToComposeColor(darkTheme.on_tertiary)})`);
    }
    
    if (lightTheme.on_background) {
      newVariables.push(`val BrandLightOnBackground = Color(${hexToComposeColor(lightTheme.on_background)})`);
    }
    if (darkTheme.on_background) {
      newVariables.push(`val BrandDarkOnBackground = Color(${hexToComposeColor(darkTheme.on_background)})`);
    }
    
    if (lightTheme.on_surface) {
      newVariables.push(`val BrandLightOnSurface = Color(${hexToComposeColor(lightTheme.on_surface)})`);
    }
    if (darkTheme.on_surface) {
      newVariables.push(`val BrandDarkOnSurface = Color(${hexToComposeColor(darkTheme.on_surface)})`);
    }
    
    // Only add if we have any brand variables
    if (newVariables.length > 4) {
      newVariables.push('');
      content = content.trim() + '\n\n' + newVariables.join('\n') + '\n';
    }
  } else {
    // Update existing Brand color variables
    content = updateColorVariables(content, config);
  }
  
  return content;
}

function updateColorVariables(content, config) {
  const lightTheme = config.theme?.light || {};
  const darkTheme = config.theme?.dark || {};
  
  // Define color variable patterns and their replacements
  const colorUpdates = [];
  
  if (lightTheme.primary) {
    colorUpdates.push([/val\s+BrandLightPrimary\s*=\s*Color\([^)]+\)/, `val BrandLightPrimary = Color(${hexToComposeColor(lightTheme.primary)})`]);
  }
  if (darkTheme.primary) {
    colorUpdates.push([/val\s+BrandDarkPrimary\s*=\s*Color\([^)]+\)/, `val BrandDarkPrimary = Color(${hexToComposeColor(darkTheme.primary)})`]);
  }
  
  if (lightTheme.secondary) {
    colorUpdates.push([/val\s+BrandLightSecondary\s*=\s*Color\([^)]+\)/, `val BrandLightSecondary = Color(${hexToComposeColor(lightTheme.secondary)})`]);
  }
  if (darkTheme.secondary) {
    colorUpdates.push([/val\s+BrandDarkSecondary\s*=\s*Color\([^)]+\)/, `val BrandDarkSecondary = Color(${hexToComposeColor(darkTheme.secondary)})`]);
  }
  
  if (lightTheme.tertiary) {
    colorUpdates.push([/val\s+BrandLightTertiary\s*=\s*Color\([^)]+\)/, `val BrandLightTertiary = Color(${hexToComposeColor(lightTheme.tertiary)})`]);
  }
  if (darkTheme.tertiary) {
    colorUpdates.push([/val\s+BrandDarkTertiary\s*=\s*Color\([^)]+\)/, `val BrandDarkTertiary = Color(${hexToComposeColor(darkTheme.tertiary)})`]);
  }
  
  if (lightTheme.background) {
    colorUpdates.push([/val\s+BrandLightBackground\s*=\s*Color\([^)]+\)/, `val BrandLightBackground = Color(${hexToComposeColor(lightTheme.background)})`]);
  }
  if (darkTheme.background) {
    colorUpdates.push([/val\s+BrandDarkBackground\s*=\s*Color\([^)]+\)/, `val BrandDarkBackground = Color(${hexToComposeColor(darkTheme.background)})`]);
  }
  
  if (lightTheme.surface) {
    colorUpdates.push([/val\s+BrandLightSurface\s*=\s*Color\([^)]+\)/, `val BrandLightSurface = Color(${hexToComposeColor(lightTheme.surface)})`]);
  }
  if (darkTheme.surface) {
    colorUpdates.push([/val\s+BrandDarkSurface\s*=\s*Color\([^)]+\)/, `val BrandDarkSurface = Color(${hexToComposeColor(darkTheme.surface)})`]);
  }
  
  if (lightTheme.on_primary) {
    colorUpdates.push([/val\s+BrandLightOnPrimary\s*=\s*Color\([^)]+\)/, `val BrandLightOnPrimary = Color(${hexToComposeColor(lightTheme.on_primary)})`]);
  }
  if (darkTheme.on_primary) {
    colorUpdates.push([/val\s+BrandDarkOnPrimary\s*=\s*Color\([^)]+\)/, `val BrandDarkOnPrimary = Color(${hexToComposeColor(darkTheme.on_primary)})`]);
  }
  
  if (lightTheme.on_secondary) {
    colorUpdates.push([/val\s+BrandLightOnSecondary\s*=\s*Color\([^)]+\)/, `val BrandLightOnSecondary = Color(${hexToComposeColor(lightTheme.on_secondary)})`]);
  }
  if (darkTheme.on_secondary) {
    colorUpdates.push([/val\s+BrandDarkOnSecondary\s*=\s*Color\([^)]+\)/, `val BrandDarkOnSecondary = Color(${hexToComposeColor(darkTheme.on_secondary)})`]);
  }
  
  if (lightTheme.on_tertiary) {
    colorUpdates.push([/val\s+BrandLightOnTertiary\s*=\s*Color\([^)]+\)/, `val BrandLightOnTertiary = Color(${hexToComposeColor(lightTheme.on_tertiary)})`]);
  }
  if (darkTheme.on_tertiary) {
    colorUpdates.push([/val\s+BrandDarkOnTertiary\s*=\s*Color\([^)]+\)/, `val BrandDarkOnTertiary = Color(${hexToComposeColor(darkTheme.on_tertiary)})`]);
  }
  
  if (lightTheme.on_background) {
    colorUpdates.push([/val\s+BrandLightOnBackground\s*=\s*Color\([^)]+\)/, `val BrandLightOnBackground = Color(${hexToComposeColor(lightTheme.on_background)})`]);
  }
  if (darkTheme.on_background) {
    colorUpdates.push([/val\s+BrandDarkOnBackground\s*=\s*Color\([^)]+\)/, `val BrandDarkOnBackground = Color(${hexToComposeColor(darkTheme.on_background)})`]);
  }
  
  if (lightTheme.on_surface) {
    colorUpdates.push([/val\s+BrandLightOnSurface\s*=\s*Color\([^)]+\)/, `val BrandLightOnSurface = Color(${hexToComposeColor(lightTheme.on_surface)})`]);
  }
  if (darkTheme.on_surface) {
    colorUpdates.push([/val\s+BrandDarkOnSurface\s*=\s*Color\([^)]+\)/, `val BrandDarkOnSurface = Color(${hexToComposeColor(darkTheme.on_surface)})`]);
  }
  
  // Apply all color updates
  for (const [pattern, replacement] of colorUpdates) {
    content = content.replace(pattern, replacement);
  }
  
  return content;
}

function updateThemeFile(content, config) {
  const hasDarkTheme = config.theme?.dark && Object.keys(config.theme.dark).length > 0;
  const darkThemeDefault = hasDarkTheme ? 'isSystemInDarkTheme()' : 'false';
  
  // Use the robust approach from Python script
  content = updateThemeKtColors(content, config);
  
  // Set dynamicColor to false by default to use custom colors
  content = content.replace(
    /dynamicColor:\s*Boolean\s*=\s*true/,
    'dynamicColor: Boolean = false, // Set to false to use custom colors'
  );
  
  // Update darkTheme parameter based on availability of dark theme in config
  content = content.replace(
    /darkTheme:\s*Boolean\s*=\s*[^,)]+/g,
    `darkTheme: Boolean = ${darkThemeDefault}`
  );
  
  return content;
}

function updateThemeKtColors(content, config) {
  const lightTheme = config.theme?.light || {};
  const darkTheme = config.theme?.dark || {};
  
  // First, try to fix any corrupted lightColorScheme blocks
  content = fixCorruptedColorSchemes(content);
  
  // Build light color scheme dynamically based on available colors
  const lightColorAssignments = [];
  if (lightTheme.primary) lightColorAssignments.push('primary = BrandLightPrimary');
  if (lightTheme.secondary) lightColorAssignments.push('secondary = BrandLightSecondary');
  if (lightTheme.tertiary) lightColorAssignments.push('tertiary = BrandLightTertiary');
  if (lightTheme.background) lightColorAssignments.push('background = BrandLightBackground');
  if (lightTheme.surface) lightColorAssignments.push('surface = BrandLightSurface');
  if (lightTheme.on_primary) lightColorAssignments.push('onPrimary = BrandLightOnPrimary');
  if (lightTheme.on_secondary) lightColorAssignments.push('onSecondary = BrandLightOnSecondary');
  if (lightTheme.on_tertiary) lightColorAssignments.push('onTertiary = BrandLightOnTertiary');
  if (lightTheme.on_background) lightColorAssignments.push('onBackground = BrandLightOnBackground');
  if (lightTheme.on_surface) lightColorAssignments.push('onSurface = BrandLightOnSurface');
  
  // Build dark color scheme dynamically based on available colors
  const darkColorAssignments = [];
  if (darkTheme.primary) darkColorAssignments.push('primary = BrandDarkPrimary');
  if (darkTheme.secondary) darkColorAssignments.push('secondary = BrandDarkSecondary');
  if (darkTheme.tertiary) darkColorAssignments.push('tertiary = BrandDarkTertiary');
  if (darkTheme.background) darkColorAssignments.push('background = BrandDarkBackground');
  if (darkTheme.surface) darkColorAssignments.push('surface = BrandDarkSurface');
  if (darkTheme.on_primary) darkColorAssignments.push('onPrimary = BrandDarkOnPrimary');
  if (darkTheme.on_secondary) darkColorAssignments.push('onSecondary = BrandDarkOnSecondary');
  if (darkTheme.on_tertiary) darkColorAssignments.push('onTertiary = BrandDarkOnTertiary');
  if (darkTheme.on_background) darkColorAssignments.push('onBackground = BrandDarkOnBackground');
  if (darkTheme.on_surface) darkColorAssignments.push('onSurface = BrandDarkOnSurface');
  
  // If no dark colors, use defaults
  if (darkColorAssignments.length === 0) {
    darkColorAssignments.push('primary = Purple80', 'secondary = PurpleGrey80', 'tertiary = Pink80');
  }
  
  // Replace light color scheme with dynamic assignments
  if (lightColorAssignments.length > 0) {
    const lightScheme = `lightColorScheme(
    ${lightColorAssignments.join(',\n    ')}
)`;
    content = content.replace(/lightColorScheme\s*\([^)]*\)/gs, lightScheme);
  }
  
  // Replace dark color scheme with dynamic assignments
  const darkScheme = `darkColorScheme(
    ${darkColorAssignments.join(',\n    ')}
)`;
  content = content.replace(/darkColorScheme\s*\([^)]*\)/gs, darkScheme);
  
  return content;
}

function fixCorruptedColorSchemes(content) {
  // Fix corrupted lightColorScheme blocks - remove orphaned code and extra commas
  content = content.replace(
    /lightColorScheme\s*\([^)]+\)\s*,\s*.*?\*\/\s*\)/gs,
    `lightColorScheme(
    primary = BrandLightPrimary,
    secondary = BrandLightSecondary,
    tertiary = BrandLightTertiary,
    background = BrandLightBackground,
    surface = BrandLightSurface,
    onPrimary = BrandLightOnPrimary,
    onSecondary = BrandLightOnSecondary,
    onTertiary = BrandLightOnTertiary,
    onBackground = BrandLightOnBackground,
    onSurface = BrandLightOnSurface
)`
  );
  
  // Fix corrupted darkColorScheme blocks - only include colors that exist
  content = content.replace(
    /darkColorScheme\s*\([^)]+\)\s*,\s*.*?\*\/\s*\)/gs,
    `darkColorScheme(
    primary = Purple80,
    secondary = PurpleGrey80,
    tertiary = Pink80
)`
  );
  
  return content;
}

function createComposeThemeFiles(appModule, config) {
  const packageName = config.package_name || 'com.example.app';
  const packagePath = packageName.replace(/\./g, '/');
  
  // Detect which source directory to use (Java or Kotlin)
  const sourceDir = detectPrimarySourceDirectory(appModule);
  
  // Create theme directory in the appropriate source directory
  const themeDir = path.join(appModule, sourceDir, packagePath, 'ui/theme');
  ensureDirectoryExists(themeDir);
  
  // Create Color.kt
  createColorFile(themeDir, config, `${packageName}.ui.theme`);
  
  // Create Theme.kt
  createThemeFile(themeDir, config, `${packageName}.ui.theme`);
  
  // Create Type.kt
  createTypographyFile(themeDir, config, `${packageName}.ui.theme`);
  
  core.info(`Created Compose theme files in ${themeDir}`);
}

function createColorFile(themeDir, config, packageName) {
  const lightTheme = config.theme?.light || {};
  const darkTheme = config.theme?.dark || {};
  
  let content = `package ${packageName}

import androidx.compose.ui.graphics.Color

`;

  // Add light theme colors only if they exist
  if (Object.keys(lightTheme).length > 0) {
    content += '// Light theme colors\n';
    
    if (lightTheme.primary) {
      content += `val Primary = Color(${hexToComposeColor(lightTheme.primary)})\n`;
    }
    if (lightTheme.secondary) {
      content += `val Secondary = Color(${hexToComposeColor(lightTheme.secondary)})\n`;
    }
    if (lightTheme.tertiary) {
      content += `val Tertiary = Color(${hexToComposeColor(lightTheme.tertiary)})\n`;
    }
    if (lightTheme.background) {
      content += `val Background = Color(${hexToComposeColor(lightTheme.background)})\n`;
    }
    if (lightTheme.surface) {
      content += `val Surface = Color(${hexToComposeColor(lightTheme.surface)})\n`;
    }
    if (lightTheme.on_primary) {
      content += `val OnPrimary = Color(${hexToComposeColor(lightTheme.on_primary)})\n`;
    }
    if (lightTheme.on_secondary) {
      content += `val OnSecondary = Color(${hexToComposeColor(lightTheme.on_secondary)})\n`;
    }
    if (lightTheme.on_tertiary) {
      content += `val OnTertiary = Color(${hexToComposeColor(lightTheme.on_tertiary)})\n`;
    }
    if (lightTheme.on_background) {
      content += `val OnBackground = Color(${hexToComposeColor(lightTheme.on_background)})\n`;
    }
    if (lightTheme.on_surface) {
      content += `val OnSurface = Color(${hexToComposeColor(lightTheme.on_surface)})\n`;
    }
    content += '\n';
  }

  // Add dark theme colors only if they exist
  if (Object.keys(darkTheme).length > 0) {
    content += '// Dark theme colors\n';
    
    if (darkTheme.primary) {
      content += `val DarkPrimary = Color(${hexToComposeColor(darkTheme.primary)})\n`;
    }
    if (darkTheme.secondary) {
      content += `val DarkSecondary = Color(${hexToComposeColor(darkTheme.secondary)})\n`;
    }
    if (darkTheme.tertiary) {
      content += `val DarkTertiary = Color(${hexToComposeColor(darkTheme.tertiary)})\n`;
    }
    if (darkTheme.background) {
      content += `val DarkBackground = Color(${hexToComposeColor(darkTheme.background)})\n`;
    }
    if (darkTheme.surface) {
      content += `val DarkSurface = Color(${hexToComposeColor(darkTheme.surface)})\n`;
    }
    if (darkTheme.on_primary) {
      content += `val DarkOnPrimary = Color(${hexToComposeColor(darkTheme.on_primary)})\n`;
    }
    if (darkTheme.on_secondary) {
      content += `val DarkOnSecondary = Color(${hexToComposeColor(darkTheme.on_secondary)})\n`;
    }
    if (darkTheme.on_tertiary) {
      content += `val DarkOnTertiary = Color(${hexToComposeColor(darkTheme.on_tertiary)})\n`;
    }
    if (darkTheme.on_background) {
      content += `val DarkOnBackground = Color(${hexToComposeColor(darkTheme.on_background)})\n`;
    }
    if (darkTheme.on_surface) {
      content += `val DarkOnSurface = Color(${hexToComposeColor(darkTheme.on_surface)})\n`;
    }
  }
  
  writeFileContent(path.join(themeDir, 'Color.kt'), content);
}

function createThemeFile(themeDir, config, packageName) {
  const appName = config.app_name?.replace(/\s+/g, '') || 'App';
  const hasDarkTheme = config.theme?.dark && Object.keys(config.theme.dark).length > 0;
  const darkThemeDefault = hasDarkTheme ? 'isSystemInDarkTheme()' : 'false';
  
  const content = `package ${packageName}

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    secondary = Secondary,
    tertiary = Tertiary,
    background = Background,
    surface = Surface,
    onPrimary = OnPrimary,
    onSecondary = OnSecondary,
    onTertiary = OnTertiary,
    onBackground = OnBackground,
    onSurface = OnSurface
)

private val DarkColorScheme = darkColorScheme(
    primary = DarkPrimary,
    secondary = DarkSecondary,
    tertiary = DarkTertiary,
    background = DarkBackground,
    surface = DarkSurface,
    onPrimary = DarkOnPrimary,
    onSecondary = DarkOnSecondary,
    onTertiary = DarkOnTertiary,
    onBackground = DarkOnBackground,
    onSurface = DarkOnSurface
)

@Composable
fun ${appName}Theme(
    darkTheme: Boolean = ${darkThemeDefault},
    dynamicColor: Boolean = false, // Set to false to use custom colors
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
`;
  
  writeFileContent(path.join(themeDir, 'Theme.kt'), content);
}

function createTypographyFile(themeDir, config, packageName) {
  const content = `package ${packageName}

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Set of Material typography styles to start with
val Typography = Typography(
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)
`;
  
  writeFileContent(path.join(themeDir, 'Type.kt'), content);
}

function hexToComposeColor(hexColor) {
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Add alpha channel if not present (ARGB format)
  if (hexColor.length === 6) {
    hexColor = 'FF' + hexColor;
  }
  
  return `0x${hexColor.toUpperCase()}`;
}

export { hexToComposeColor };
