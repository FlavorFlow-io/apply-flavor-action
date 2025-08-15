import * as core from '@actions/core';
import { readFileContent, writeFileContent, ensureDirectoryExists } from './fileUtils.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Package management utilities for Android projects
 */

const PACKAGE_PATTERN = /^package\s+([a-zA-Z][a-zA-Z0-9_.]*)/m;
const JAVA_SOURCE_DIR = 'src/main/java';
const KOTLIN_SOURCE_DIR = 'src/main/kotlin';

export function extractPackageFromFile(filePath) {
  try {
    const content = readFileContent(filePath);
    const match = content.match(PACKAGE_PATTERN);
    return match ? match[1] : null;
  } catch (error) {
    core.debug(`Failed to extract package from ${filePath}: ${error.message}`);
    return null;
  }
}

export function detectExistingPackage(appModule) {
  const sourceDirs = [JAVA_SOURCE_DIR, KOTLIN_SOURCE_DIR];
  
  for (const sourceDir of sourceDirs) {
    const sourcePath = path.join(appModule, sourceDir);
    const packageName = findPackageInDirectory(sourcePath);
    if (packageName) {
      return packageName;
    }
  }
  
  return null;
}

function findPackageInDirectory(sourcePath) {
  try {
    const files = fs.readdirSync(sourcePath, { recursive: true });
    
    for (const file of files) {
      if (file.endsWith('.kt') || file.endsWith('.java')) {
        const filePath = path.join(sourcePath, file);
        const packageName = extractPackageFromFile(filePath);
        if (packageName) {
          return packageName;
        }
      }
    }
  } catch (error) {
    core.debug(`Failed to read directory ${sourcePath}: ${error.message}`);
  }
  
  return null;
}

export function updatePackageReferences(appModule, oldPackage, newPackage) {
  if (!oldPackage || !newPackage || oldPackage === newPackage) {
    return;
  }
  
  core.info(`Updating package references from ${oldPackage} to ${newPackage}`);
  
  // First update all package references in files throughout the project
  updateAllPackageReferencesInProject(appModule, oldPackage, newPackage);
  
  // Then restructure the source directories
  const sourceDirs = [
    JAVA_SOURCE_DIR, 
    KOTLIN_SOURCE_DIR,
    'src/test/java',
    'src/test/kotlin',
    'src/androidTest/java',
    'src/androidTest/kotlin'
  ];
  
  for (const sourceDir of sourceDirs) {
    const sourcePath = path.join(appModule, sourceDir);
    if (fs.existsSync(sourcePath)) {
      restructurePackageDirectory(sourcePath, oldPackage, newPackage);
    }
  }
  
  // Update build files and manifest
  updateBuildFiles(appModule, oldPackage, newPackage);
  updateManifest(appModule, oldPackage, newPackage);
}

function updateAllPackageReferencesInProject(appModule, oldPackage, newPackage) {
  // Update source files
  const sourceDirs = [JAVA_SOURCE_DIR, KOTLIN_SOURCE_DIR];
  
  for (const sourceDir of sourceDirs) {
    const sourcePath = path.join(appModule, sourceDir);
    updateReferencesInDirectory(sourcePath, oldPackage, newPackage);
  }
}

function restructurePackageDirectory(sourcePath, oldPackage, newPackage) {
  try {
    core.info(`Processing source directory: ${sourcePath}`);
    
    // Find the old package root directory
    const oldPackageRoot = findOldPackageRoot(sourcePath, oldPackage);
    
    if (oldPackageRoot && fs.existsSync(oldPackageRoot)) {
      // Calculate new package root
      const newPackagePath = packageToPath(newPackage);
      const newPackageRoot = path.join(sourcePath, newPackagePath);
      
      // Move the entire package structure
      movePackageStructure(oldPackageRoot, newPackageRoot, newPackage);
    } else {
      // No existing package found, create new structure
      const newPackagePath = packageToPath(newPackage);
      const newPackageDir = path.join(sourcePath, newPackagePath);
      ensureDirectoryExists(newPackageDir);
      core.info(`Created new package directory: ${newPackageDir}`);
    }
  } catch (error) {
    core.warning(`Failed to restructure package directory ${sourcePath}: ${error.message}`);
  }
}

function findOldPackageRoot(sourcePath, oldPackage) {
  if (!oldPackage) {
    return null;
  }
  
  const oldPackagePath = packageToPath(oldPackage);
  const oldPackageRoot = path.join(sourcePath, oldPackagePath);
  
  // Check if the exact package path exists
  if (fs.existsSync(oldPackageRoot)) {
    return oldPackageRoot;
  }
  
  // If not, try to find the deepest existing part of the package path
  const packageParts = oldPackage.split('.');
  for (let i = packageParts.length; i > 0; i--) {
    const partialPackage = packageParts.slice(0, i).join('.');
    const partialPath = path.join(sourcePath, packageToPath(partialPackage));
    
    if (fs.existsSync(partialPath)) {
      // Check if this directory contains source files
      if (hasSourceFiles(partialPath)) {
        return partialPath;
      }
    }
  }
  
  return null;
}

function hasSourceFiles(directory) {
  try {
    const files = fs.readdirSync(directory, { recursive: true });
    return files.some(file => file.endsWith('.kt') || file.endsWith('.java'));
  } catch (error) {
    return false;
  }
}

function movePackageStructure(oldPackageRoot, newPackageRoot, newPackage) {
  try {
    core.info(`Moving package structure from ${oldPackageRoot} to ${newPackageRoot}`);
    
    // Create new package root directory
    ensureDirectoryExists(newPackageRoot);
    
    let movedItems = 0;
    
    // Get all files and directories recursively
    const files = fs.readdirSync(oldPackageRoot, { recursive: true });
    
    for (const file of files) {
      const oldFilePath = path.join(oldPackageRoot, file);
      const stats = fs.statSync(oldFilePath);
      
      if (stats.isFile()) {
        const newFilePath = path.join(newPackageRoot, file);
        
        // Create directory structure if needed
        ensureDirectoryExists(path.dirname(newFilePath));
        
        if (file.endsWith('.kt') || file.endsWith('.java')) {
          // Update source files
          const content = readFileContent(oldFilePath);
          const relativeDirPath = path.dirname(file);
          const updatedContent = updatePackageDeclarationWithSubdir(content, newPackage, relativeDirPath);
          
          writeFileContent(newFilePath, updatedContent);
          core.info(`✓ Moved ${file} with updated package`);
        } else {
          // Copy non-source files as-is
          fs.copyFileSync(oldFilePath, newFilePath);
          core.info(`✓ Copied ${file}`);
        }
        
        movedItems++;
        // Remove old file
        fs.unlinkSync(oldFilePath);
      }
    }
    
    if (movedItems > 0) {
      // Clean up old empty directories
      cleanupOldPackageStructure(oldPackageRoot);
      core.info(`✅ Moved ${movedItems} items preserving directory structure`);
    }
  } catch (error) {
    core.error(`Failed to move package structure: ${error.message}`);
    throw error;
  }
}

function updatePackageDeclarationWithSubdir(content, newPackage, relativeDirPath) {
  // Calculate the full package name including subdirectory
  let fullPackage = newPackage;
  
  if (relativeDirPath && relativeDirPath !== '.' && relativeDirPath !== '') {
    const subPackage = pathToPackage(relativeDirPath);
    fullPackage = `${newPackage}.${subPackage}`;
  }
  
  // Update package declaration
  content = content.replace(
    /^package\s+[a-zA-Z][a-zA-Z0-9_.]*\s*$/m,
    `package ${fullPackage}`
  );
  
  return content;
}

function cleanupOldPackageStructure(oldPackageRoot) {
  try {
    // Remove the old package directory if it's empty
    if (fs.existsSync(oldPackageRoot)) {
      // Check if directory is empty
      const files = fs.readdirSync(oldPackageRoot);
      if (files.length === 0) {
        fs.rmdirSync(oldPackageRoot);
        core.info(`✓ Removed empty directory: ${oldPackageRoot}`);
        
        // Recursively clean up parent directories if they become empty
        const parentDir = path.dirname(oldPackageRoot);
        if (parentDir !== oldPackageRoot) {
          cleanupOldPackageStructure(parentDir);
        }
      }
    }
  } catch (error) {
    core.debug(`Could not cleanup directory ${oldPackageRoot}: ${error.message}`);
  }
}

function updateReferencesInDirectory(directory, oldPackage, newPackage) {
  try {
    const files = fs.readdirSync(directory, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      
      if (fs.statSync(filePath).isFile() && 
          (file.endsWith('.kt') || file.endsWith('.java'))) {
        updateReferencesInFile(filePath, oldPackage, newPackage);
      }
    }
  } catch (error) {
    core.debug(`Failed to update references in ${directory}: ${error.message}`);
  }
}

function updateReferencesInFile(filePath, oldPackage, newPackage) {
  try {
    const content = readFileContent(filePath);
    const updatedContent = updatePackageReferencesInContent(content, oldPackage, newPackage);
    
    if (content !== updatedContent) {
      writeFileContent(filePath, updatedContent);
      core.debug(`Updated package references in ${filePath}`);
    }
  } catch (error) {
    core.warning(`Failed to update ${filePath}: ${error.message}`);
  }
}

function updatePackageReferencesInContent(content, oldPackage, newPackage) {
  // Update package declaration
  content = content.replace(
    new RegExp(`^package\\s+${escapeRegex(oldPackage)}`, 'm'),
    `package ${newPackage}`
  );
  
  // Update import statements
  content = content.replace(
    new RegExp(`import\\s+${escapeRegex(oldPackage)}`, 'g'),
    `import ${newPackage}`
  );
  
  // Update qualified class references
  content = content.replace(
    new RegExp(`\\b${escapeRegex(oldPackage)}\\.`, 'g'),
    `${newPackage}.`
  );
  
  return content;
}

function updateBuildFiles(appModule, oldPackage, newPackage) {
  const buildFiles = ['build.gradle', 'build.gradle.kts'];
  
  for (const buildFile of buildFiles) {
    const buildPath = path.join(appModule, buildFile);
    
    try {
      if (fs.existsSync(buildPath)) {
        const content = readFileContent(buildPath);
        const updatedContent = content.replace(
          new RegExp(`applicationId\\s*=?\\s*["']${escapeRegex(oldPackage)}["']`, 'g'),
          `applicationId "${newPackage}"`
        );
        
        if (content !== updatedContent) {
          writeFileContent(buildPath, updatedContent);
          core.info(`Updated applicationId in ${buildPath}`);
        }
      }
    } catch (error) {
      core.warning(`Failed to update ${buildPath}: ${error.message}`);
    }
  }
}

function updateManifest(appModule, oldPackage, newPackage) {
  const manifestPath = path.join(appModule, 'src/main/AndroidManifest.xml');
  
  try {
    if (fs.existsSync(manifestPath)) {
      const content = readFileContent(manifestPath);
      const updatedContent = content.replace(
        new RegExp(`package\\s*=\\s*["']${escapeRegex(oldPackage)}["']`, 'g'),
        `package="${newPackage}"`
      );
      
      if (content !== updatedContent) {
        writeFileContent(manifestPath, updatedContent);
        core.info(`Updated package in AndroidManifest.xml`);
      }
    }
  } catch (error) {
    core.warning(`Failed to update AndroidManifest.xml: ${error.message}`);
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function packageToPath(packageName) {
  return packageName.replace(/\./g, '/');
}

export function pathToPackage(packagePath) {
  return packagePath.replace(/\//g, '.');
}
