const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

let effectCounter = 0;

function createEffectLogger(componentName, filePath, lineNumber, effectIndex) {
  return {
    // Counter variable initialization
    counterVar: t.variableDeclaration('let', [
      t.variableDeclarator(
        t.identifier(`effectCallCount_${effectIndex}`),
        t.numericLiteral(0),
      ),
    ]),

    // Counter increment
    incrementCounter: t.expressionStatement(
      t.assignmentExpression(
        '+=',
        t.identifier(`effectCallCount_${effectIndex}`),
        t.numericLiteral(1),
      ),
    ),

    // Console log statement
    logStatement: t.expressionStatement(
      t.callExpression(
        t.memberExpression(t.identifier('console'), t.identifier('log')),
        [
          t.stringLiteral(
            `[${componentName}_Effect_${effectIndex}] useEffect at ${filePath}:${lineNumber} - Call count:`,
          ),
          t.identifier(`effectCallCount_${effectIndex}`),
        ],
      ),
    ),
  };
}

function createDependenciesLogger(componentName, effectIndex, deps) {
  return t.callExpression(
    t.memberExpression(t.identifier('console'), t.identifier('log')),
    [
      t.stringLiteral(`[${componentName}_Effect_${effectIndex}] Dependencies:`),
      deps,
    ],
  );
}

function transformCode(code, filePath) {
  // Parse the code into an AST
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'decorators-legacy'],
  });

  let fileModified = false;
  let effectsFound = 0;

  // Traverse the AST
  traverse(ast, {
    CallExpression(path) {
      if (
        path.node.callee.type === 'Identifier' &&
        path.node.callee.name === 'useEffect'
      ) {
        effectsFound++;
        const callback = path.node.arguments[0];

        if (
          callback.type === 'ArrowFunctionExpression' ||
          callback.type === 'FunctionExpression'
        ) {
          // Get the component name
          let componentName = 'Unknown';
          let parent = path.findParent(
            (p) => p.isFunctionDeclaration() || p.isVariableDeclarator(),
          );
          if (parent) {
            componentName = parent.node.id ? parent.node.id.name : 'Anonymous';
          }

          // Get line number information
          const lineNumber = path.node.loc
            ? path.node.loc.start.line
            : 'unknown';

          // Create logger statements
          const logger = createEffectLogger(
            componentName,
            filePath,
            lineNumber,
            effectCounter,
          );

          // Get the dependencies array if it exists
          const deps = path.node.arguments[1];
          // const depsLogging = false;
          const depsLogging = deps
            ? createDependenciesLogger(componentName, effectCounter, deps)
            : null;

          // Add variable declaration to the program root
          const program = path.findParent((p) => p.isProgram());
          program.unshiftContainer('body', logger.counterVar);

          // Add console.log statements and counter increment
          if (callback.body.type === 'BlockStatement') {
            callback.body.body.unshift(logger.logStatement);
            callback.body.body.unshift(logger.incrementCounter);
            if (depsLogging) {
              callback.body.body.unshift(t.expressionStatement(depsLogging));
            }
          } else {
            const statements = [logger.incrementCounter, logger.logStatement];
            if (depsLogging) {
              statements.push(t.expressionStatement(depsLogging));
            }
            statements.push(t.returnStatement(callback.body));
            callback.body = t.blockStatement(statements);
          }

          effectCounter++;
          fileModified = true;
        }
      }
    },
  });

  if (!fileModified) {
    return { modified: null, effectsCount: 0 };
  }

  const output = generate(
    ast,
    {
      quotes: 'single',
    },
    code,
  );

  return { modified: output.code, effectsCount: effectsFound };
}

module.exports = {
  transformCode,
};
