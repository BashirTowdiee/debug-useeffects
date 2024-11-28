const fs = require('fs');

function validatePath(targetPath) {
  if (!targetPath) {
    console.error('Please provide a path as an argument');
    console.log('Usage: node debug-useeffects.js <path>');
    return false;
  }

  if (!fs.existsSync(targetPath)) {
    console.error(`Path not found: ${targetPath}`);
    return false;
  }

  return true;
}

function checkDependencies() {
  const requiredDeps = [
    '@babel/parser',
    '@babel/traverse',
    '@babel/generator',
    '@babel/types',
  ];

  const missingDeps = [];

  requiredDeps.forEach((dep) => {
    try {
      require(dep);
    } catch (error) {
      missingDeps.push(dep);
    }
  });

  if (missingDeps.length > 0) {
    console.error(
      'Required dependencies are missing. Please install them manually:',
    );
    console.error(`npm install --save-dev ${missingDeps.join(' ')}`);
    process.exit(1);
  }
}

module.exports = {
  validatePath,
  checkDependencies,
};
