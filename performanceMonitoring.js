const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prompts = require('prompts');

class ComponentNode {
  constructor(name, filePath, type = 'component') {
    this.name = name;
    this.filePath = filePath;
    this.type = type;
    this.children = new Set();
    this.parents = new Set();
    this.imports = new Set();
  }
}

class ComponentAnalyzer {
  constructor() {
    this.components = new Map();
    this.currentFilePath = '';
  }

  addComponent(name, type = 'component') {
    if (!this.components.has(name)) {
      this.components.set(
        name,
        new ComponentNode(name, this.currentFilePath, type),
      );
    }
    return this.components.get(name);
  }

  addRelationship(parentName, childName) {
    const parent = this.components.get(parentName);
    const child = this.components.get(childName);
    if (parent && child) {
      parent.children.add(childName);
      child.parents.add(parentName);
    }
  }

  detectComponentType(filePath, componentName) {
    const normalized = filePath.toLowerCase();
    if (normalized.includes('/pages/') || normalized.includes('/screens/')) {
      return 'page';
    }
    if (normalized.includes('/layouts/')) {
      return 'layout';
    }
    if (normalized.includes('/components/')) {
      return 'component';
    }
    if (componentName.includes('Provider')) {
      return 'provider';
    }
    return 'component';
  }

  analyzeFile(filePath) {
    if (!shouldProcessFile(filePath)) return;

    this.currentFilePath = filePath;
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const importedComponents = new Set();
      const analyzer = this;

      traverse(ast, {
        ImportDeclaration(path) {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
              const name = spec.local.name;
              if (/^[A-Z]/.test(name)) {
                importedComponents.add(name);
              }
            }
          });
        },

        FunctionDeclaration(path) {
          if (isReactComponent(path)) {
            const name = path.node.id.name;
            const type = analyzer.detectComponentType(filePath, name);
            analyzer.addComponent(name, type);

            path.traverse({
              JSXElement(jsxPath) {
                const elementName = jsxPath.node.openingElement.name.name;
                if (
                  /^[A-Z]/.test(elementName) &&
                  importedComponents.has(elementName)
                ) {
                  analyzer.addRelationship(name, elementName);
                }
              },
            });
          }
        },

        VariableDeclarator(path) {
          if (
            t.isArrowFunctionExpression(path.node.init) &&
            path.node.id &&
            isReactComponent(path)
          ) {
            const name = path.node.id.name;
            const type = analyzer.detectComponentType(filePath, name);
            analyzer.addComponent(name, type);

            path.traverse({
              JSXElement(jsxPath) {
                const elementName = jsxPath.node.openingElement.name.name;
                if (
                  /^[A-Z]/.test(elementName) &&
                  importedComponents.has(elementName)
                ) {
                  analyzer.addRelationship(name, elementName);
                }
              },
            });
          }
        },
      });
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error);
    }
  }

  printHierarchy() {
    const printed = new Set();
    const roots = Array.from(this.components.values()).filter(
      (component) => component.parents.size === 0,
    );

    console.log('\n📊 Component Hierarchy:\n');

    const printNode = (node, level = 0) => {
      if (printed.has(node.name)) return;
      printed.add(node.name);

      const indent = '  '.repeat(level);
      const typeEmoji =
        {
          page: '📱',
          layout: '🔲',
          component: '🧩',
          provider: '🔌',
        }[node.type] || '🧩';

      console.log(`${indent}${typeEmoji} ${node.name} (${node.type})`);

      for (const childName of node.children) {
        const child = this.components.get(childName);
        if (child) {
          printNode(child, level + 1);
        }
      }
    };

    roots.forEach((root) => printNode(root));
  }

  getComponentsAsTree() {
    const tree = [];
    const visited = new Set();

    // Helper function to build tree structure
    const buildTree = (component) => {
      if (visited.has(component.name)) return null;
      visited.add(component.name);

      const node = {
        name: component.name,
        type: component.type,
        filePath: component.filePath,
        children: [],
      };

      for (const childName of component.children) {
        const childComponent = this.components.get(childName);
        if (childComponent) {
          const childNode = buildTree(childComponent);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      }

      return node;
    };

    // Find root components (those without parents)
    const rootComponents = Array.from(this.components.values()).filter(
      (component) => component.parents.size === 0,
    );

    // Build tree starting from root components
    rootComponents.forEach((component) => {
      const node = buildTree(component);
      if (node) {
        tree.push(node);
      }
    });

    return tree;
  }

  convertTreeToChoices(tree, level = 0) {
    let choices = [];
    const indent = '  '.repeat(level);
    const typeEmojis = {
      page: '📱',
      layout: '🔲',
      component: '🧩',
      provider: '🔌',
    };

    tree.forEach((node) => {
      // Add parent component
      choices.push({
        title: `${indent}${typeEmojis[node.type] || '🧩'} ${node.name}`,
        value: node.name,
        description: `${node.type} - ${path.basename(node.filePath)}`,
      });

      // Add children recursively
      if (node.children.length > 0) {
        choices = choices.concat(
          this.convertTreeToChoices(node.children, level + 1),
        );
      }
    });

    return choices;
  }

  async selectComponentsToProfile() {
    const tree = this.getComponentsAsTree();
    const choices = this.convertTreeToChoices(tree);

    // Add "Select All" option
    const allComponents = Array.from(this.components.keys());
    choices.unshift({
      title: '📋 Select All Components',
      value: '*all*',
      description: `Select all ${allComponents.length} components`,
    });

    // Add group selection options for each type
    const typeGroups = {
      page: '📱 Select All Pages',
      layout: '🔲 Select All Layouts',
      component: '🧩 Select All Components',
      provider: '🔌 Select All Providers',
    };

    Object.entries(typeGroups).forEach(([type, title]) => {
      const componentsOfType = Array.from(this.components.values()).filter(
        (c) => c.type === type,
      );

      if (componentsOfType.length > 0) {
        choices.unshift({
          title,
          value: `*${type}*`,
          description: `Select all ${componentsOfType.length} ${type}s`,
        });
      }
    });

    const response = await prompts([
      {
        type: 'multiselect',
        name: 'components',
        message: 'Select components to add Profiler to',
        choices,
        hint: 'Space to select, Return to submit',
        instructions: '\nSpace to select, A to toggle all, Return to submit',
      },
    ]);

    let selectedComponents = response.components || [];

    // Handle special selection values
    if (selectedComponents.includes('*all*')) {
      return allComponents;
    }

    // Handle type group selections
    for (const type of Object.keys(typeGroups)) {
      if (selectedComponents.includes(`*${type}*`)) {
        const componentsOfType = Array.from(this.components.values())
          .filter((c) => c.type === type)
          .map((c) => c.name);
        selectedComponents = selectedComponents.concat(componentsOfType);
      }
    }

    // Remove special selection values and duplicates
    return [...new Set(selectedComponents.filter((c) => !c.startsWith('*')))];
  }
}

function shouldProcessFile(filePath) {
  if (
    filePath.endsWith('.test.tsx') ||
    filePath.endsWith('.spec.tsx') ||
    filePath.endsWith('.stories.tsx')
  ) {
    return false;
  }
  return filePath.endsWith('.tsx');
}

function isReactComponent(path) {
  const name = path.node.id?.name || path.parent?.id?.name;
  if (!name || !/^[A-Z]/.test(name)) {
    return false;
  }

  let hasJSXReturn = false;
  path.traverse({
    ReturnStatement(returnPath) {
      const arg = returnPath.node.argument;
      if (t.isJSXElement(arg) || t.isJSXFragment(arg)) {
        hasJSXReturn = true;
      }
    },
  });

  return hasJSXReturn;
}

function processFileWithSelectedComponents(filePath, selectedComponents) {
  if (!shouldProcessFile(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let modified = false;
    let hasProfilerImport = false;
    let needsProfilerCallback = false;

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react') {
          const hasProfiler = path.node.specifiers.some(
            (spec) =>
              t.isImportSpecifier(spec) && spec.imported.name === 'Profiler',
          );
          if (hasProfiler) {
            hasProfilerImport = true;
          }
        }
      },

      Program: {
        exit(path) {
          if (!hasProfilerImport && needsProfilerCallback) {
            const importDeclaration = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('Profiler'),
                  t.identifier('Profiler'),
                ),
              ],
              t.stringLiteral('react'),
            );
            path.node.body.unshift(importDeclaration);

            const callbackFunction = t.functionDeclaration(
              t.identifier('onRenderCallback'),
              [
                t.identifier('id'),
                t.identifier('phase'),
                t.identifier('actualDuration'),
                t.identifier('baseDuration'),
                t.identifier('startTime'),
                t.identifier('commitTime'),
                t.identifier('interactions'),
              ],
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(
                      t.identifier('console'),
                      t.identifier('log'),
                    ),
                    [
                      t.templateLiteral(
                        [
                          t.templateElement({ raw: 'Profiler [' }),
                          t.templateElement({ raw: '] Phase: ' }),
                          t.templateElement({ raw: ', Actual Duration: ' }),
                          t.templateElement({ raw: 'ms' }, true),
                        ],
                        [
                          t.identifier('id'),
                          t.identifier('phase'),
                          t.identifier('actualDuration'),
                        ],
                      ),
                    ],
                  ),
                ),
              ]),
            );
            path.node.body.splice(1, 0, callbackFunction);
            modified = true;
          }
        },
      },

      FunctionDeclaration(path) {
        if (
          isReactComponent(path) &&
          selectedComponents.includes(path.node.id.name)
        ) {
          wrapReturnWithProfiler(path);
          needsProfilerCallback = true;
          modified = true;
        }
      },

      VariableDeclarator(path) {
        if (
          t.isArrowFunctionExpression(path.node.init) &&
          path.node.id &&
          selectedComponents.includes(path.node.id.name) &&
          isReactComponent(path)
        ) {
          wrapReturnWithProfiler(path.get('init'));
          needsProfilerCallback = true;
          modified = true;
        }
      },
    });

    if (modified) {
      const output = generate(
        ast,
        {
          retainLines: true,
          retainFunctionParens: true,
        },
        content,
      );

      fs.writeFileSync(filePath, output.code);
      console.log(`✅ Modified: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

function wrapReturnWithProfiler(path) {
  path.traverse({
    ReturnStatement(returnPath) {
      const arg = returnPath.node.argument;

      if (!t.isJSXElement(arg) && !t.isJSXFragment(arg)) {
        return;
      }

      if (t.isJSXElement(arg) && arg.openingElement.name.name === 'Profiler') {
        return;
      }

      const componentName =
        path.node.id?.name || path.parent?.id?.name || 'UnknownComponent';

      const wrapped = t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('Profiler'),
          [
            t.jsxAttribute(
              t.jsxIdentifier('id'),
              t.stringLiteral(componentName),
            ),
            t.jsxAttribute(
              t.jsxIdentifier('onRender'),
              t.jsxExpressionContainer(t.identifier('onRenderCallback')),
            ),
          ],
          false,
        ),
        t.jsxClosingElement(t.jsxIdentifier('Profiler')),
        [arg],
      );

      returnPath.node.argument = wrapped;
    },
  });
}

function processDirectory(dirPath, selectedComponents) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      if (file !== 'node_modules' && file !== 'build' && file !== 'dist') {
        processDirectory(filePath, selectedComponents);
      }
    } else if (shouldProcessFile(filePath)) {
      processFileWithSelectedComponents(filePath, selectedComponents);
    }
  });
}

async function main() {
  if (process.argv.length < 3) {
    console.log('Please provide the React project directory path');
    process.exit(1);
  }

  const projectPath = process.argv[2];
  console.log('🔍 Analyzing React component hierarchy...');

  const analyzer = new ComponentAnalyzer();

  function scanDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        if (file !== 'node_modules' && file !== 'build' && file !== 'dist') {
          scanDirectory(filePath);
        }
      } else if (shouldProcessFile(filePath)) {
        analyzer.analyzeFile(filePath);
      }
    });
  }

  scanDirectory(projectPath);
  analyzer.printHierarchy();

  const selectedComponents = await analyzer.selectComponentsToProfile();

  if (selectedComponents.length === 0) {
    console.log('No components selected. Exiting...');
    return;
  }

  console.log(
    `\n🎯 Adding Profiler to selected components: ${selectedComponents.join(
      ', ',
    )}\n`,
  );
  processDirectory(projectPath, selectedComponents);
  console.log('\n✨ Finished processing files');
}

main().catch(console.error);
