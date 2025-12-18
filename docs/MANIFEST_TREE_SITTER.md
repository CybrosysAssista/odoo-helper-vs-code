# Adding Files to Manifest Using Tree-sitter

This guide shows you how to use Tree-sitter to safely add files to your Odoo `__manifest__.py`.

## 🎯 Why Use Tree-sitter?

**Traditional approach (Regex):**
```javascript
// ❌ Fragile - breaks on comments, multi-line formatting
const newData = text.replace(
    /'data': \[(.*?)\]/s,
    `'data': [$1, '${newFile}']`
);
```

**Tree-sitter approach:**
```javascript
// ✅ Robust - understands Python syntax
const position = parser.findManifestListInsertPosition(text, 'data');
edit.insert(uri, position, `, '${newFile}'`);
```

## 📝 Basic Example

```javascript
const { getPythonParserService } = require('./services/pythonParserService');

async function addToManifest(manifestUri, filePath) {
    const parser = getPythonParserService();
    const document = await vscode.workspace.openTextDocument(manifestUri);
    const text = document.getText();

    // 1. Check if file already exists
    if (parser.manifestListContains(text, 'data', filePath)) {
        console.log('File already in manifest');
        return;
    }

    // 2. Find where to insert
    const position = parser.findManifestListInsertPosition(text, 'data');
    
    // 3. Insert the file
    const edit = new vscode.WorkspaceEdit();
    edit.insert(manifestUri, new vscode.Position(position.line, position.character), 
        `,\n        '${filePath}'`);
    
    await vscode.workspace.applyEdit(edit);
    await document.save();
}
```

## 🚀 Using the Built-in Command

We've created a ready-to-use command:

### From Command Palette:
1. Open any XML/CSV file in your Odoo module
2. Press `Ctrl+Shift+P`
3. Type "Add File to Manifest"
4. Done! ✅

### Programmatically:
```javascript
vscode.commands.executeCommand(
    'cybrosys-assista-odoo-helper.addFileToManifest',
    fileUri
);
```

## 📚 Complete API Reference

### 1. Check if File Exists
```javascript
const exists = parser.manifestListContains(text, 'data', 'views/sale_view.xml');
// Returns: true or false
```

### 2. Get All Files in List
```javascript
const files = parser.getManifestData(text, 'data');
// Returns: ['security/ir.model.access.csv', 'views/sale_view.xml', ...]
```

### 3. Find Insertion Position
```javascript
const position = parser.findManifestListInsertPosition(text, 'data');
// Returns: { line: 15, character: 45 }
```

## 🎨 Advanced Examples

### Example 1: Add with Smart Indentation
```javascript
async function addWithProperIndent(manifestUri, filePath) {
    const document = await vscode.workspace.openTextDocument(manifestUri);
    const text = document.getText();
    const lines = text.split('\n');
    
    const position = parser.findManifestListInsertPosition(text, 'data');
    
    // Detect indentation from existing line
    const currentLine = lines[position.line];
    const indent = currentLine.match(/^(\s*)/)[1];
    
    const edit = new vscode.WorkspaceEdit();
    edit.insert(
        manifestUri, 
        new vscode.Position(position.line, position.character),
        `,\n${indent}'${filePath}'`
    );
    
    await vscode.workspace.applyEdit(edit);
    await document.save();
}
```

### Example 2: Add Multiple Files at Once
```javascript
async function addMultipleFiles(manifestUri, filePaths) {
    const parser = getPythonParserService();
    const document = await vscode.workspace.openTextDocument(manifestUri);
    const text = document.getText();
    
    // Filter out files that already exist
    const newFiles = filePaths.filter(file => 
        !parser.manifestListContains(text, 'data', file)
    );
    
    if (newFiles.length === 0) {
        console.log('All files already in manifest');
        return;
    }
    
    // Add all files in one edit
    const position = parser.findManifestListInsertPosition(text, 'data');
    const lines = text.split('\n');
    const indent = lines[position.line].match(/^(\s*)/)[1];
    
    const newContent = newFiles.map(file => 
        `\n${indent}'${file}'`
    ).join(',');
    
    const edit = new vscode.WorkspaceEdit();
    edit.insert(
        manifestUri,
        new vscode.Position(position.line, position.character),
        `,${newContent}`
    );
    
    await vscode.workspace.applyEdit(edit);
    await document.save();
}
```

### Example 3: Smart List Detection
```javascript
async function addToCorrectList(manifestUri, filePath) {
    // Automatically choose 'data' or 'demo' based on path
    let targetList = 'data';
    
    if (filePath.includes('/demo/')) {
        targetList = 'demo';
    }
    
    const position = parser.findManifestListInsertPosition(text, targetList);
    
    if (!position) {
        console.log(`No "${targetList}" list found in manifest`);
        return;
    }
    
    // Add to the correct list
    // ... (same as basic example)
}
```

## 🔍 How It Works

When you call `findManifestListInsertPosition(text, 'data')`, Tree-sitter:

1. **Parses** the Python file into a syntax tree
2. **Finds** the dictionary pair with key `"data"`
3. **Locates** the list value `[...]`
4. **Returns** the position of the last item in the list

This works even if:
- ✅ The list spans multiple lines
- ✅ There are comments in the list
- ✅ The formatting is unusual
- ✅ There are syntax errors elsewhere in the file

## 🎯 Real-World Use Case

Automatically add a view file when it's created:

```javascript
// In your createOdooViewFile handler:
async function handleCreateOdooViewFile(uri) {
    // ... create the view file ...
    
    // Automatically add to manifest
    const manifestUri = vscode.Uri.file(
        path.join(moduleRoot.fsPath, '__manifest__.py')
    );
    
    const relativePath = path.relative(moduleRoot.fsPath, newViewFile.fsPath);
    
    await vscode.commands.executeCommand(
        'cybrosys-assista-odoo-helper.addFileToManifest',
        newViewFile
    );
}
```

## 📖 See Also

- `src/examples/manifestTreeSitterExample.js` - More examples
- `src/commands/addToManifest.js` - Implementation
- `src/services/pythonParserService.ts` - Parser API
- `TREE_SITTER.md` - Tree-sitter overview
