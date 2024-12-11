# useState Logger Script

A static analysis tool that automatically instruments React useState setter calls with logging statements. This tool helps track state changes across your React application by adding console logs whenever a state setter function is called.

## Installation

1. Install the required dependencies:

```bash
npm install @babel/parser @babel/traverse @babel/generator @babel/types
```

2. Save the script as `useState-logger.js`

## Usage

Run the script by providing the path to your React project:

```bash
node useState-logger.js /path/to/your/react/project
```

## Features

The script automatically:

1. Identifies all useState declarations in React components
2. Tracks state setter functions
3. Adds logging statements before each setter call
4. Preserves code formatting and structure
5. Processes entire directory trees
6. Handles both JavaScript and TypeScript files

## How It Works

For every useState declaration like:

```javascript
const [count, setCount] = useState(0);
```

When `setCount` is called, the script adds a console.log:

```javascript
// Original code
setCount(newValue);

// Transformed to
console.log('[ComponentName] count updated to:', newValue);
setCount(newValue);
```

## Output Format

The logging format shows:

- Component name in brackets
- State variable name
- New value being set

Example console output:

```
[Counter] count updated to: 5
[UserProfile] name updated to: "John"
[TodoList] items updated to: ["task1", "task2"]
```

## File Processing

The script:

- Recursively processes all .js, .jsx, .ts, and .tsx files
- Skips node_modules, build, and dist directories
- Reports modified files during processing
- Provides error messages for any processing failures

## Benefits

- Debug state changes in real-time
- Track state updates across components
- Identify unexpected state modifications
- Understand state update patterns
- Simplify debugging of state-related issues

## Limitations

1. Only tracks direct setter calls
2. Cannot track setState calls in class components
3. Does not track state updates in custom hooks
4. Modifies source files directly (backup recommended)

## Development Notes

The script uses Babel's AST tools to:

- Parse React components
- Identify useState declarations
- Track setter functions
- Insert logging statements
- Regenerate modified code

## Error Handling

The script includes error handling for:

- Invalid file paths
- Parsing errors
- Invalid syntax
- Missing dependencies
- File system errors

## Best Practices

1. Backup your code before running the script
2. Run on development code only
3. Remove logging statements before production deployment
4. Consider using source control to track changes

## CLI Output

The script provides:

- Initial processing message
- Progress updates for modified files
- Error messages for failed processing
- Completion message

Example:

```
Processing React project at: /path/to/project
Modified: src/components/Counter.tsx
Modified: src/components/UserProfile.tsx
Finished processing files
```

## Contributing

Feel free to contribute by:

- Adding new logging formats
- Improving error handling
- Adding support for more patterns
- Enhancing performance
- Adding tests

## License

MIT License - feel free to use and modify as needed.
