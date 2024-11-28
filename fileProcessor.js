const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformer');

function processFile(filePath, updateCounter) {
  console.log(`\nProcessing file: ${filePath}`);

  try {
    // Read file content
    const code = fs.readFileSync(filePath, 'utf-8');

    // Skip if file doesn't contain useEffect
    if (!code.includes('useEffect')) {
      console.log('No useEffect found in file');
      return;
    }

    const { modified, effectsCount } = transformCode(code, filePath);

    // Only write back if we made changes
    if (modified) {
      console.log(
        `Found ${effectsCount} useEffect${effectsCount !== 1 ? 's' : ''}`,
      );
      fs.writeFileSync(filePath, modified);
      console.log(`Successfully modified ${filePath}`);
      updateCounter(effectsCount);
    } else {
      console.log('No modifications were necessary');
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function processDirectory(dirPath, updateCounter) {
  console.log(`\nScanning directory: ${dirPath}`);

  try {
    const items = fs.readdirSync(dirPath);

    items.forEach((item) => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      // Skip node_modules and hidden directories
      if (stat.isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules') {
          processDirectory(fullPath, updateCounter);
        }
      } else if (stat.isFile() && /\.(js|jsx|tsx|ts)$/.test(item)) {
        processFile(fullPath, updateCounter);
      }
    });
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
  }
}

module.exports = {
  processFile,
  processDirectory,
};
