const { processFile, processDirectory } = require('./fileProcessor');
const { validatePath, checkDependencies } = require('./utils');
const fs = require('fs');

// Counter for tracking total effects across all files
let globalEffectCounter = 0;

function updateEffectCounter(count) {
  globalEffectCounter += count;
}

// Main execution
console.log('Starting useEffect debug script...');

// Get path from command line argument
const targetPath = process.argv[2];

if (!validatePath(targetPath)) {
  process.exit(1);
}

// Check required dependencies
checkDependencies();

// Process based on whether it's a file or directory
const stats = fs.statSync(targetPath);
if (stats.isDirectory()) {
  processDirectory(targetPath, updateEffectCounter);
} else {
  processFile(targetPath, updateEffectCounter);
}

console.log('\nProcessing complete!');
console.log(`Total useEffects found and modified: ${globalEffectCounter}`);
