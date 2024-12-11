const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function processFile(filePath) {
  // Read the file content
  const content = fs.readFileSync(filePath, 'utf-8');

  // Skip if no useState is imported
  if (!content.includes('useState')) {
    return;
  }

  try {
    // Parse the code into an AST
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let modified = false;
    let useStateImported = false;

    // Track all useState variables
    const stateSetters = new Map();

    traverse(ast, {
      // Check if useState is imported from react
      ImportDeclaration(path) {
        if (path.node.source.value === 'react') {
          const specifier = path.node.specifiers.find(
            (spec) =>
              t.isImportSpecifier(spec) && spec.imported.name === 'useState',
          );
          if (specifier) {
            useStateImported = true;
          }
        }
      },

      // Find useState calls and track their setters
      VariableDeclarator(path) {
        if (!useStateImported) return;

        const init = path.node.init;
        if (
          t.isCallExpression(init) &&
          t.isIdentifier(init.callee) &&
          init.callee.name === 'useState'
        ) {
          if (t.isArrayPattern(path.node.id)) {
            const [state, setter] = path.node.id.elements;
            if (state && setter) {
              stateSetters.set(setter.name, state.name);
            }
          }
        }
      },

      // Add console.log to setter calls
      CallExpression(path) {
        const callee = path.node.callee;
        if (t.isIdentifier(callee) && stateSetters.has(callee.name)) {
          const stateName = stateSetters.get(callee.name);
          const componentName = findComponentName(path);

          // Create console.log statement
          const logStatement = t.expressionStatement(
            t.callExpression(
              t.memberExpression(t.identifier('console'), t.identifier('log')),
              [
                t.stringLiteral(`[${componentName}] ${stateName} updated to:`),
                path.node.arguments[0],
              ],
            ),
          );

          // Insert the console.log before the setter call
          path.insertBefore(logStatement);
          modified = true;
        }
      },
    });

    if (modified) {
      // Generate the modified code
      const output = generate(
        ast,
        {
          retainLines: true,
          retainFunctionParens: true,
        },
        content,
      );

      // Write the modified code back to the file
      fs.writeFileSync(filePath, output.code);
      console.log(`Modified: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function findComponentName(path) {
  let current = path;
  while (current) {
    if (
      t.isFunctionDeclaration(current.node) ||
      t.isFunctionExpression(current.node) ||
      t.isArrowFunctionExpression(current.node)
    ) {
      if (current.node.id) {
        return current.node.id.name;
      }
      // For arrow functions assigned to variables
      if (current.parent && t.isVariableDeclarator(current.parent)) {
        return current.parent.id.name;
      }
    }
    current = current.parentPath;
  }
  return 'Unknown Component';
}

function processDirectory(directoryPath) {
  const files = fs.readdirSync(directoryPath);

  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // Skip node_modules and build directories
      if (file !== 'node_modules' && file !== 'build' && file !== 'dist') {
        processDirectory(filePath);
      }
    } else if (file.match(/\.(jsx?|tsx?)$/)) {
      processFile(filePath);
    }
  });
}

// Main execution
if (process.argv.length < 3) {
  console.log('Please provide the React project directory path');
  process.exit(1);
}

const projectPath = process.argv[2];
console.log(`Processing React project at: ${projectPath}`);
processDirectory(projectPath);
console.log('Finished processing files');
