# useEffect Debugger

A command-line tool that automatically adds debugging logs to React useEffect hooks in your codebase. This tool helps you track when useEffects are triggered and what their dependencies are.

## Features

- Automatically adds debug logging to all useEffect hooks in specified files
- Tracks the number of times each useEffect is called
- Logs dependency changes
- Supports JavaScript, TypeScript, and JSX/TSX files
- Preserves code formatting and comments
- Skips node_modules and hidden directories
- Reports total number of useEffects modified

## Installation

1. Clone the repository or copy the files to your project
2. Install the required dependencies:

```bash
npm install
```

Or install dependencies manually:

```bash
npm install --save-dev @babel/parser @babel/traverse @babel/generator @babel/types
```

## Usage

Run the script by providing a path to a file or directory:

```bash
node debug-useeffects.js <path>
```

Examples:

```bash
# Process a single file
node debug-useeffects.js src/components/MyComponent.tsx

# Process an entire directory
node debug-useeffects.js src/components
```

## Output Example

The tool will modify your useEffect hooks to include debug logging. For example:

```javascript
// Before
useEffect(() => {
  fetchData();
}, [id]);

// After
let effectCallCount_0 = 0;
useEffect(() => {
  effectCallCount_0 += 1;
  console.log(
    '[MyComponent_Effect_0] useEffect at src/components/MyComponent.tsx:10 - Call count:',
    effectCallCount_0,
  );
  console.log('[MyComponent_Effect_0] Dependencies:', [id]);
  fetchData();
}, [id]);
```

## Project Structure

- `debug-useeffects.js`: Main entry point
- `fileProcessor.js`: Handles file system operations
- `codeTransformer.js`: Manages code transformation and AST manipulation
- `utils.js`: Utility functions for path validation and dependency checking

## How It Works

1. The tool recursively finds all JavaScript/TypeScript files in the specified path
2. For each file containing useEffect:
   - Parses the code into an AST (Abstract Syntax Tree)
   - Finds all useEffect calls
   - Adds debugging code to track calls and dependencies
   - Generates modified code while preserving formatting
   - Writes the changes back to the file

## Limitations

- Only modifies files with `.js`, `.jsx`, `.ts`, or `.tsx` extensions
- Requires files to be valid JavaScript/TypeScript
- Does not process files in `node_modules` or hidden directories
- Cannot process malformed React components

## Contributing

Feel free to submit issues and pull requests. To contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or need help, please open an issue in the repository.
