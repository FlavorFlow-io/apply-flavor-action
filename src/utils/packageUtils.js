import * as core from '@actions/core';
import { readFileContent, writeFileContent, ensureDirectoryExists } from './fileUtils.js';
import * as path from 'path';

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
    const files = require('fs').readdirSync(sourcePath, { recursive: true });
    
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
  
  // Update source files
  const sourceDirs = [JAVA_SOURCE_DIR, KOTLIN_SOURCE_DIR];
  
  for (const sourceDir of sourceDirs) {
    const sourcePath = path.join(appModule, sourceDir);
    updateReferencesInDirectory(sourcePath, oldPackage, newPackage);
  }
  
  // Update build files
  updateBuildFiles(appModule, oldPackage, newPackage);
  
  // Update manifest
  updateManifest(appModule, oldPackage, newPackage);
}

function updateReferencesInDirectory(directory, oldPackage, newPackage) {
  try {
    const files = require('fs').readdirSync(directory, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      
      if (require('fs').statSync(filePath).isFile() && 
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
      if (require('fs').existsSync(buildPath)) {
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
    if (require('fs').existsSync(manifestPath)) {
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
