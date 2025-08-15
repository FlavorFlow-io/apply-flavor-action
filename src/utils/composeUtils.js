import * as core from '@actions/core';
import { readFileContent, writeFileContent, ensureDirectoryExists } from './fileUtils.js';
import * as path from 'path';

/**
 * Compose theme management utilities
 */

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

function findComposeThemeFiles(appModule, config) {
  const themeFiles = [];
  const searchDirs = [
    'src/main/java',
    'src/main/kotlin'
  ];
  
  for (const searchDir of searchDirs) {
    const sourcePath = path.join(appModule, searchDir);
    
    try {
      const files = require('fs').readdirSync(sourcePath, { recursive: true });
      
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
  const theme = config.theme?.light || {};
  
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
  
  // Update or add color definitions
  const colorMappings = [
    { name: 'Primary', value: theme.primary || '#6650a4' },
    { name: 'Secondary', value: theme.secondary || '#625b71' },
    { name: 'Tertiary', value: theme.tertiary || '#7D5260' },
    { name: 'Background', value: theme.background || '#FFFBFE' },
    { name: 'Surface', value: theme.surface || '#FFFBFE' },
    { name: 'OnPrimary', value: theme.on_primary || '#FFFFFF' },
    { name: 'OnSecondary', value: theme.on_secondary || '#FFFFFF' },
    { name: 'OnTertiary', value: theme.on_tertiary || '#FFFFFF' },
    { name: 'OnBackground', value: theme.on_background || '#1C1B1F' },
    { name: 'OnSurface', value: theme.on_surface || '#1C1B1F' }
  ];
  
  for (const color of colorMappings) {
    const hexValue = hexToComposeColor(color.value);
    const pattern = new RegExp(`val\\s+${color.name}\\s*=\\s*Color\\([^)]+\\)`, 'g');
    const replacement = `val ${color.name} = Color(${hexValue})`;
    
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
    } else {
      // Add new color definition
      content += `\nval ${color.name} = Color(${hexValue})`;
    }
  }
  
  return content;
}

function updateThemeFile(content, config) {
  const theme = config.theme?.light || {};
  
  // Update lightColorScheme
  const lightColors = [
    `primary = ${theme.primary ? 'Primary' : 'Color(0xFF6650a4)'}`,
    `secondary = ${theme.secondary ? 'Secondary' : 'Color(0xFF625b71)'}`,
    `tertiary = ${theme.tertiary ? 'Tertiary' : 'Color(0xFF7D5260)'}`,
    `background = ${theme.background ? 'Background' : 'Color(0xFFFFFBFE)'}`,
    `surface = ${theme.surface ? 'Surface' : 'Color(0xFFFFFBFE)'}`,
    `onPrimary = ${theme.on_primary ? 'OnPrimary' : 'Color(0xFFFFFFFF)'}`,
    `onSecondary = ${theme.on_secondary ? 'OnSecondary' : 'Color(0xFFFFFFFF)'}`,
    `onTertiary = ${theme.on_tertiary ? 'OnTertiary' : 'Color(0xFFFFFFFF)'}`,
    `onBackground = ${theme.on_background ? 'OnBackground' : 'Color(0xFF1C1B1F)'}`,
    `onSurface = ${theme.on_surface ? 'OnSurface' : 'Color(0xFF1C1B1F)'}`
  ];
  
  const lightScheme = `lightColorScheme(\n    ${lightColors.join(',\n    ')}\n)`;
  
  // Replace existing lightColorScheme
  const lightPattern = /lightColorScheme\s*\([^)]*\)/s;
  if (lightPattern.test(content)) {
    content = content.replace(lightPattern, lightScheme);
  }
  
  return content;
}

function createComposeThemeFiles(appModule, config) {
  const packageName = config.package_name || 'com.example.app';
  const packagePath = packageName.replace(/\./g, '/');
  
  // Create theme directory
  const themeDir = path.join(appModule, 'src/main/kotlin', packagePath, 'ui/theme');
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
  const theme = config.theme?.light || {};
  
  const content = `package ${packageName}

import androidx.compose.ui.graphics.Color

// Light theme colors
val Primary = Color(${hexToComposeColor(theme.primary || '#6650a4')})
val Secondary = Color(${hexToComposeColor(theme.secondary || '#625b71')})
val Tertiary = Color(${hexToComposeColor(theme.tertiary || '#7D5260')})
val Background = Color(${hexToComposeColor(theme.background || '#FFFBFE')})
val Surface = Color(${hexToComposeColor(theme.surface || '#FFFBFE')})
val OnPrimary = Color(${hexToComposeColor(theme.on_primary || '#FFFFFF')})
val OnSecondary = Color(${hexToComposeColor(theme.on_secondary || '#FFFFFF')})
val OnTertiary = Color(${hexToComposeColor(theme.on_tertiary || '#FFFFFF')})
val OnBackground = Color(${hexToComposeColor(theme.on_background || '#1C1B1F')})
val OnSurface = Color(${hexToComposeColor(theme.on_surface || '#1C1B1F')})

// Dark theme colors
val DarkPrimary = Color(${hexToComposeColor(theme.primary || '#D0BCFF')})
val DarkSecondary = Color(${hexToComposeColor(theme.secondary || '#CCC2DC')})
val DarkTertiary = Color(${hexToComposeColor(theme.tertiary || '#EFB8C8')})
val DarkBackground = Color(0xFF121212)
val DarkSurface = Color(0xFF121212)
val DarkOnPrimary = Color(0xFF381E72)
val DarkOnSecondary = Color(0xFF332D41)
val DarkOnTertiary = Color(0xFF492532)
val DarkOnBackground = Color(0xFFE6E1E5)
val DarkOnSurface = Color(0xFFE6E1E5)
`;
  
  writeFileContent(path.join(themeDir, 'Color.kt'), content);
}

function createThemeFile(themeDir, config, packageName) {
  const appName = config.app_name?.replace(/\s+/g, '') || 'App';
  
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
    darkTheme: Boolean = isSystemInDarkTheme(),
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
