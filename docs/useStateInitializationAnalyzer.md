# useState Initialization Analyzer

A static analysis tool that helps identify complex useState initializations in React projects. This tool scans your codebase to find useState hooks that use non-standard initialization patterns, which might impact performance or lead to unnecessary re-renders.

## Installation

1. Install the required dependencies:

```bash
npm install @babel/parser @babel/traverse
```

2. Save the script as `analyze-usestate.js`

## Usage

Run the script by providing the path to your React project:

```bash
node analyze-usestate.js /path/to/your/react/project
```

## What it Detects

The analyzer looks for the following initialization patterns in useState:

1. Function Initializations

   ```javascript
   useState(() => computeExpensiveValue());
   ```

2. Ternary Operators

   ```javascript
   useState(condition ? valueA : valueB);
   ```

3. Logical Expressions

   ```javascript
   useState(prop1 || defaultValue);
   ```

4. Function Calls

   ```javascript
   useState(getData());
   ```

5. Complex Objects

   ```javascript
   useState({ key: 'value', nested: { prop: true } });
   ```

6. Non-empty Arrays

   ```javascript
   useState(['initial', 'values']);
   ```

7. Binary Expressions
   ```javascript
   useState(width + height);
   ```

The tool ignores standard initializations like:

- `useState(false)`
- `useState('')`
- `useState(0)`
- `useState(null)`
- `useState(undefined)`

## Output

The tool provides:

1. A detailed list of each complex initialization found, including:

   - Component name
   - Variable name
   - File location and line number
   - Type of complexity
   - Actual initialization code

2. A summary showing the count of each initialization type found

Example output:

```
Found 3 complex useState initializations:

1. UserProfile (userData)
   File: src/components/UserProfile.tsx:15
   Type: Complex object
   Init: { name: '', email: '', preferences: {} }

2. ProductList (filters)
   File: src/components/ProductList.tsx:23
   Type: Function initialization
   Init: () => loadSavedFilters()

Summary by initialization type:
Complex object: 1
Function initialization: 1
```

## Benefits

- Helps identify potential performance bottlenecks
- Finds initialization patterns that might cause unnecessary re-renders
- Assists in code reviews by flagging complex state initializations
- Supports TypeScript and JSX files

## Limitations

- Only analyzes static code (cannot detect runtime complexity)
- Requires proper parsing of the source files
- May have false positives for intentionally complex initializations

## Contributing

Feel free to open issues or submit pull requests for:

- Additional initialization patterns to detect
- Improved detection accuracy
- Better output formatting
- Bug fixes and edge cases
