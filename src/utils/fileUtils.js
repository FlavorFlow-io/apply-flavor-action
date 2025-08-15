import * as fs from 'fs';
import * as path from 'path';

/**
 * File utility functions for branding operations
 */

export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isTextFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    // Check for null bytes which indicate binary files
    for (let i = 0; i < Math.min(buffer.length, 8000); i++) {
      if (buffer[i] === 0) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

export function writeFileContent(filePath, content) {
  try {
    ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

export function findFiles(directory, pattern) {
  const files = [];
  
  function walkDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile() && pattern.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  if (fs.existsSync(directory)) {
    walkDir(directory);
  }
  
  return files;
}

export function findAndroidAppModule() {
  const buildFiles = findFiles('.', /^build\.gradle(\.kts)?$/);
  
  for (const buildFile of buildFiles) {
    try {
      const content = readFileContent(buildFile);
      if (isAndroidApplicationPlugin(content)) {
        return path.dirname(buildFile);
      }
    } catch (error) {
      continue;
    }
  }
  
  // Fallback to 'app' directory
  return 'app';
}

function isAndroidApplicationPlugin(content) {
  // Check for various Android application plugin declarations
  const patterns = [
    /com\.android\.application/,
    /apply plugin:\s*['"]com\.android\.application['"]/,
    /id\s*['"]com\.android\.application['"]/,
    /id\s*\(\s*['"]com\.android\.application['"]\s*\)/,
    /alias\s*\(\s*libs\.plugins\.android\.application\s*\)/,
    /id\s*\(\s*libs\.plugins\.android\.application\s*\)/
  ];
  
  const hasPlugin = patterns.some(pattern => pattern.test(content));
  const hasAndroidBlock = /android\s*\{/.test(content);
  
  return hasPlugin && hasAndroidBlock;
}

export function cleanupEmptyDirectories(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }
  
  try {
    const items = fs.readdirSync(directory);
    
    // First, recursively clean up subdirectories
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        cleanupEmptyDirectories(fullPath);
      }
    }
    
    // Check if directory is now empty
    const remainingItems = fs.readdirSync(directory);
    if (remainingItems.length === 0) {
      fs.rmdirSync(directory);
    }
  } catch (error) {
    // Ignore errors when cleaning up
  }
}
