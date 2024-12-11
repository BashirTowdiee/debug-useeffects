const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('useState')) {
    return;
  }

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let useStateImported = false;
    const findings = [];

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react') {
          const specifier = path.node.specifiers.find(
            (spec) => spec.imported?.name === 'useState',
          );
          if (specifier) {
            useStateImported = true;
          }
        }
      },

      CallExpression(path) {
        if (!useStateImported) return;

        if (path.node.callee.name === 'useState') {
          const [initialValue] = path.node.arguments;
          if (!initialValue) return;

          // Get component name and location info
          const componentName = findComponentName(path);
          const loc = path.node.loc;
          const lineNumber = loc?.start?.line;

          // Get the variable name being initialized
          let variableName = '';
          if (
            path.parent.type === 'VariableDeclarator' &&
            path.parent.id.type === 'ArrayPattern'
          ) {
            variableName = path.parent.id.elements[0]?.name || 'unknown';
          }

          // Check for complex initializations
          let isComplex = false;
          let reason = '';
          let initCode = content.slice(initialValue.start, initialValue.end);

          if (
            initialValue.type === 'ArrowFunctionExpression' ||
            initialValue.type === 'FunctionExpression'
          ) {
            isComplex = true;
            reason = 'Function initialization';
          } else if (initialValue.type === 'ConditionalExpression') {
            isComplex = true;
            reason = 'Ternary operator';
          } else if (initialValue.type === 'LogicalExpression') {
            isComplex = true;
            reason = 'Logical expression';
          } else if (initialValue.type === 'CallExpression') {
            isComplex = true;
            reason = 'Function call';
          } else if (
            initialValue.type === 'ObjectExpression' &&
            initialValue.properties.length > 0
          ) {
            isComplex = true;
            reason = 'Complex object';
          } else if (
            initialValue.type === 'ArrayExpression' &&
            initialValue.elements.length > 0
          ) {
            isComplex = true;
            reason = 'Non-empty array';
          } else if (initialValue.type === 'BinaryExpression') {
            isComplex = true;
            reason = 'Binary expression';
          }
          // Skip basic initializations
          else if (
            initialValue.type === 'BooleanLiteral' ||
            (initialValue.type === 'StringLiteral' &&
              initialValue.value === '') ||
            (initialValue.type === 'NumericLiteral' &&
              initialValue.value === 0) ||
            initialValue.type === 'NullLiteral' ||
            (initialValue.type === 'Identifier' &&
              initialValue.name === 'undefined')
          ) {
            return;
          }

          if (isComplex) {
            findings.push({
              componentName,
              variableName,
              filePath,
              lineNumber,
              reason,
              initialization: initCode.trim(),
            });
          }
        }
      },
    });

    return findings;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return [];
  }
}

function findComponentName(path) {
  let current = path;
  while (current) {
    if (
      current.node.type === 'FunctionDeclaration' ||
      current.node.type === 'FunctionExpression' ||
      current.node.type === 'ArrowFunctionExpression'
    ) {
      if (current.node.id) {
        return current.node.id.name;
      }
      if (current.parent?.type === 'VariableDeclarator') {
        return current.parent.id.name;
      }
    }
    current = current.parentPath;
  }
  return 'Unknown Component';
}

function processDirectory(directoryPath) {
  const allFindings = [];

  function traverse(currentPath) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const filePath = path.join(currentPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        if (file !== 'node_modules' && file !== 'build' && file !== 'dist') {
          traverse(filePath);
        }
      } else if (file.match(/\.(jsx?|tsx?)$/)) {
        const findings = analyzeFile(filePath);
        if (findings && findings.length > 0) {
          allFindings.push(...findings);
        }
      }
    });
  }

  traverse(directoryPath);
  return allFindings;
}

// Main execution
if (process.argv.length < 3) {
  console.log('Please provide the React project directory path');
  process.exit(1);
}

const projectPath = process.argv[2];
console.log(`Analyzing React project at: ${projectPath}\n`);

const findings = processDirectory(projectPath);

if (findings.length === 0) {
  console.log('No complex useState initializations found.');
} else {
  console.log(`Found ${findings.length} complex useState initializations:\n`);

  findings.forEach((finding, index) => {
    console.log(
      `${index + 1}. ${finding.componentName} (${finding.variableName})`,
    );
    console.log(
      `   File: ${path.relative(process.cwd(), finding.filePath)}:${
        finding.lineNumber
      }`,
    );
    console.log(`   Type: ${finding.reason}`);
    console.log(`   Init: ${finding.initialization}`);
    console.log();
  });

  // Print summary by type
  const typeCount = findings.reduce((acc, finding) => {
    acc[finding.reason] = (acc[finding.reason] || 0) + 1;
    return acc;
  }, {});

  console.log('\nSummary by initialization type:');
  Object.entries(typeCount)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
}
