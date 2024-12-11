const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const readline = require('readline');

// Store all discovered functions
const functionRegistry = {
  components: new Set(),
  hooks: new Set(),
  handlers: new Set(),
  utils: new Set(),
};

// Store function hierarchies and locations
const functionHierarchy = new Map();
const functionLocations = new Map();

// Menu state
const selections = new Set();

function getFunctionName(path) {
  if (path.node.id && path.node.id.name) {
    return path.node.id.name;
  }

  if (path.parent && t.isVariableDeclarator(path.parent) && path.parent.id) {
    if (t.isIdentifier(path.parent.id)) {
      return path.parent.id.name;
    }
  }

  if (
    path.parent &&
    t.isObjectProperty(path.parent) &&
    t.isIdentifier(path.parent.key)
  ) {
    return path.parent.key.name;
  }

  return null;
}

function findParentComponent(path) {
  let current = path;
  while (current) {
    if (
      current.node.type === 'FunctionDeclaration' ||
      (current.node.type === 'VariableDeclarator' &&
        t.isArrowFunctionExpression(current.node.init))
    ) {
      const name = getFunctionName(current);
      if (name && name[0] === name[0].toUpperCase()) {
        return name;
      }
    }
    current = current.parentPath;
  }
  return null;
}

function processFile(filePath, scanOnly = true, functionsToLog = new Set()) {
  const validExtensions = ['.js', '.jsx', '.ts', '.tsx'];
  const ext = path.extname(filePath);

  if (
    !validExtensions.includes(ext) ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.endsWith('.d.ts')
  ) {
    return { modifiedFiles: 0, modifiedFunctions: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        ['decorators', { decoratorsBeforeExport: true }],
      ],
    });

    let modified = false;
    let modifiedFunctions = 0;

    traverse(ast, {
      Function(path) {
        const functionName = getFunctionName(path);
        if (!functionName) return;

        // Find parent component if any
        const componentName = findParentComponent(path);

        if (scanOnly) {
          functionLocations.set(functionName, filePath);

          if (componentName) {
            functionHierarchy.set(functionName, componentName);
          } else {
            const parentPath = path.findParent(
              (p) =>
                p.isFunctionDeclaration() ||
                p.isFunctionExpression() ||
                p.isArrowFunctionExpression(),
            );
            if (parentPath) {
              const parentName = getFunctionName(parentPath);
              if (parentName) {
                functionHierarchy.set(functionName, parentName);
              }
            }
          }
        } else if (functionsToLog.has(functionName)) {
          // Skip if this is the component definition itself
          if (componentName === functionName) {
            return;
          }

          const parentName =
            componentName || functionHierarchy.get(functionName) || 'global';
          const logStatement = t.expressionStatement(
            t.callExpression(
              t.memberExpression(t.identifier('console'), t.identifier('log')),
              [t.stringLiteral(`[${parentName}] Called: ${functionName}`)],
            ),
          );

          if (t.isBlockStatement(path.node.body)) {
            path.get('body').unshiftContainer('body', logStatement);
          } else {
            const originalBody = path.node.body;
            path.node.body = t.blockStatement([
              logStatement,
              t.returnStatement(originalBody),
            ]);
          }

          modified = true;
          modifiedFunctions++;
        }
      },
    });

    if (modified) {
      const output = generate(ast, { retainLines: true }, content);
      fs.writeFileSync(filePath, output.code);
      console.log(`Modified: ${filePath} (${modifiedFunctions} functions)`);
      return { modifiedFiles: 1, modifiedFunctions };
    }

    return { modifiedFiles: 0, modifiedFunctions: 0 };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return { modifiedFiles: 0, modifiedFunctions: 0 };
  }
}

async function processDirectory(
  directoryPath,
  scanOnly = true,
  functionsToLog = new Set(),
) {
  const files = fs.readdirSync(directoryPath);
  let totalModifiedFiles = 0;
  let totalModifiedFunctions = 0;

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      if (!['node_modules', 'build', 'dist', '__tests__'].includes(file)) {
        const results = await processDirectory(
          filePath,
          scanOnly,
          functionsToLog,
        );
        totalModifiedFiles += results.modifiedFiles;
        totalModifiedFunctions += results.modifiedFunctions;
      }
    } else {
      const ext = path.extname(file);
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        const results = processFile(filePath, scanOnly, functionsToLog);
        totalModifiedFiles += results.modifiedFiles;
        totalModifiedFunctions += results.modifiedFunctions;
      }
    }
  }

  return {
    modifiedFiles: totalModifiedFiles,
    modifiedFunctions: totalModifiedFunctions,
  };
}

function categorizeFunctions() {
  // Clear existing categories
  Object.keys(functionRegistry).forEach((key) => functionRegistry[key].clear());

  functionHierarchy.forEach((parentName, funcName) => {
    // Categorize functions based on name patterns
    if (funcName.startsWith('handle') || funcName.startsWith('on')) {
      functionRegistry.handlers.add(funcName);
    } else if (funcName.startsWith('use')) {
      functionRegistry.hooks.add(funcName);
    } else {
      functionRegistry.utils.add(funcName);
    }
  });
}

function displayFunctionStats() {
  console.log('\nFunction Statistics:');
  console.log('-'.repeat(50));
  console.log(`Components: ${functionRegistry.components.size}`);
  console.log(`Hooks: ${functionRegistry.hooks.size}`);
  console.log(`Event Handlers: ${functionRegistry.handlers.size}`);
  console.log(`Utility Functions: ${functionRegistry.utils.size}`);
  console.log('-'.repeat(50));
}

function displayMenu() {
  console.clear();
  displayFunctionStats();

  console.log('\nSelect categories to add logging (space-separated numbers):');
  console.log(`[${selections.has('1') ? 'X' : ' '}] 1. Components`);
  console.log(`[${selections.has('2') ? 'X' : ' '}] 2. Hooks`);
  console.log(`[${selections.has('3') ? 'X' : ' '}] 3. Event Handlers`);
  console.log(`[${selections.has('4') ? 'X' : ' '}] 4. Utility Functions`);
  console.log('\nCommands:');
  console.log('l: List selected categories');
  console.log('a: Add logging to selected categories');
  console.log('c: Clear selections');
  console.log('q: Quit');
}

function listSelectedCategories() {
  console.log('\nSelected Categories:');
  console.log('-'.repeat(50));

  const categoryMap = {
    1: 'components',
    2: 'hooks',
    3: 'handlers',
    4: 'utils',
  };

  selections.forEach((selection) => {
    const category = categoryMap[selection];
    if (category) {
      console.log(`\n${category.toUpperCase()}:`);
      functionRegistry[category].forEach((func) => {
        const location = functionLocations.get(func);
        const parent = functionHierarchy.get(func);
        console.log(`${func}${parent ? ` (in ${parent})` : ''}`);
        console.log(`  Location: ${location}`);
      });
    }
  });
}

async function addLoggingToSelection() {
  const categoryMap = {
    1: 'components',
    2: 'hooks',
    3: 'handlers',
    4: 'utils',
  };

  const functionsToLog = new Set();

  selections.forEach((selection) => {
    const category = categoryMap[selection];
    if (category) {
      functionRegistry[category].forEach((func) => functionsToLog.add(func));
    }
  });

  if (functionsToLog.size === 0) {
    console.log('\nNo functions selected for logging!');
    return;
  }

  console.log(`\nAdding logs to ${functionsToLog.size} functions...`);

  try {
    const results = await processDirectory(
      process.argv[2],
      false,
      functionsToLog,
    );

    if (results.modifiedFiles > 0) {
      console.log(`\nSuccess! Modified ${results.modifiedFiles} files.`);
      console.log(`Added logs to ${results.modifiedFunctions} functions.`);
    } else {
      console.log('\nNo files were modified. Please check your selection.');
    }
  } catch (error) {
    console.error('Error adding logs:', error);
  }
}

async function handleInput(input) {
  input = input.trim().toLowerCase();

  if (input === 'q') {
    return true; // quit
  }

  if (input === 'l') {
    listSelectedCategories();
    await waitForEnter();
    return false;
  }

  if (input === 'c') {
    selections.clear();
    return false;
  }

  if (input === 'a') {
    if (selections.size === 0) {
      console.log('\nNo categories selected!');
      await waitForEnter();
      return false;
    }
    await addLoggingToSelection();
    await waitForEnter();
    return false;
  }

  // Handle number selections
  const numbers = input
    .split(' ')
    .filter((n) => ['1', '2', '3', '4'].includes(n));
  numbers.forEach((num) => {
    if (selections.has(num)) {
      selections.delete(num);
    } else {
      selections.add(num);
    }
  });

  return false;
}

async function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function waitForEnter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await askQuestion(rl, '\nPress Enter to continue...');
  rl.close();
}

async function showMenuAndHandleInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let quit = false;
  while (!quit) {
    displayMenu();
    const input = await askQuestion(rl, '\nEnter selection: ');
    quit = await handleInput(input);
  }

  rl.close();
}

async function scanProject(projectPath) {
  console.log('Scanning project...');
  try {
    await processDirectory(projectPath, true);
    categorizeFunctions();
    await showMenuAndHandleInput();
  } catch (error) {
    console.error('Error scanning project:', error);
    process.exit(1);
  }
}

// Main execution
if (process.argv.length < 3) {
  console.log('Please provide the project directory path');
  process.exit(1);
}

scanProject(process.argv[2]);
