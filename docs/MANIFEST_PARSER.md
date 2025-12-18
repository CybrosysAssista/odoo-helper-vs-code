# Advanced Manifest Parser

The `ManifestParser` provides a powerful way to parse and navigate Odoo `__manifest__.py` files with **exact position tracking** for every key and value.

## 🎯 What It Does

Instead of simple string matching, it creates a **structured map** of your manifest with:
- ✅ Exact positions (line & character) for every element
- ✅ Recursive parsing of nested dictionaries (like `assets`)
- ✅ Type information (string, list, dict, boolean, number)
- ✅ Easy navigation with helper functions

## 📊 Data Structure

```typescript
interface ParsedManifest {
    data: Map<string, ManifestValue>;
    range: Range;
}

interface ManifestValue {
    type: 'string' | 'list' | 'dict' | 'boolean' | 'number';
    value: any;
    range: Range;  // { start: { line, character }, end: { line, character } }
    items?: Array<{ value: any; range: Range }>;  // For lists
    children?: Map<string, ManifestValue>;  // For dicts (recursive!)
}
```

## 🚀 Basic Usage

```javascript
const { getPythonParserService } = require('./services/pythonParserService');

const parser = getPythonParserService();
const manifestParser = parser.getManifestParser();

// Parse the manifest
const parsed = manifestParser.parseManifest(manifestText);

// Get top-level keys
const keys = Array.from(parsed.data.keys());
// ['name', 'version', 'depends', 'data', 'assets', 'demo']

// Get a value
const name = parsed.data.get('name');
console.log(name.value);  // "Sale Management"
console.log(name.range);  // { start: { line: 1, character: 12 }, ... }
```

## 🔍 Navigating Nested Structures

### Example Manifest:
```python
{
    'name': 'Sale',
    'data': ['views/sale.xml'],
    'assets': {
        'web.assets_backend': [
            'sale/static/src/js/sale.js',
        ],
        'web.assets_frontend': [
            'sale/static/src/js/portal.js',
        ],
    },
}
```

### Navigate Manually:
```javascript
// Get assets dictionary
const assets = parsed.data.get('assets');

// Get web.assets_backend list
const backend = assets.children.get('web.assets_backend');

// Get files in the list
console.log(backend.value);  // ['sale/static/src/js/sale.js']
console.log(backend.items[0].range);  // Position of first file
```

### Navigate with Helper:
```javascript
const { getNestedValue } = require('./services/manifestParser');

// Much simpler!
const backend = getNestedValue(parsed, 'assets', 'web.assets_backend');
console.log(backend.value);  // ['sale/static/src/js/sale.js']
```

## 📝 Common Operations

### 1. Check if File Exists in List
```javascript
const { listContains } = require('./services/manifestParser');

const dataList = parsed.data.get('data');
const exists = listContains(dataList, 'views/sale_order_views.xml');
// true or false
```

### 2. Get Insertion Position
```javascript
const dataList = parsed.data.get('data');
const insertPos = manifestParser.getListInsertPosition(dataList);
// { line: 5, character: 45 }

// Now you can insert at this position
const edit = new vscode.WorkspaceEdit();
edit.insert(uri, new vscode.Position(insertPos.line, insertPos.character),
    `,\n        'views/new_view.xml'`);
```

### 3. Add File to Assets Bundle
```javascript
// Get the specific bundle
const bundle = getNestedValue(parsed, 'assets', 'web.assets_backend');

// Check if file exists
if (!listContains(bundle, 'sale/static/src/js/new_file.js')) {
    // Get insertion position
    const pos = manifestParser.getListInsertPosition(bundle);
    
    // Insert the file
    edit.insert(uri, new vscode.Position(pos.line, pos.character),
        `,\n            'sale/static/src/js/new_file.js'`);
}
```

### 4. List All Asset Bundles
```javascript
const assets = parsed.data.get('assets');

if (assets && assets.children) {
    const bundles = Array.from(assets.children.keys());
    console.log(bundles);
    // ['web.assets_backend', 'web.assets_frontend', ...]
}
```

### 5. Get All Files in All Bundles
```javascript
const assets = parsed.data.get('assets');

if (assets && assets.children) {
    for (const [bundleName, bundle] of assets.children.entries()) {
        if (bundle.type === 'list') {
            console.log(`${bundleName}:`);
            bundle.items.forEach(item => {
                console.log(`  - ${item.value} (line ${item.range.start.line})`);
            });
        }
    }
}
```

## 🎨 Advanced Examples

### Example 1: Print Entire Structure
```javascript
function printStructure(parsed, indent = '') {
    for (const [key, value] of parsed.data.entries()) {
        console.log(`${indent}${key}: ${value.type}`);
        
        if (value.type === 'dict' && value.children) {
            printStructure({ data: value.children }, indent + '  ');
        } else if (value.type === 'list') {
            value.items?.forEach((item, i) => {
                console.log(`${indent}  [${i}] ${item.value}`);
            });
        } else {
            console.log(`${indent}  = ${value.value}`);
        }
    }
}

printStructure(parsed);
```

Output:
```
name: string
  = Sale Management
version: string
  = 1.0
depends: list
  [0] base
  [1] product
data: list
  [0] security/ir.model.access.csv
  [1] views/sale_order_views.xml
assets: dict
  web.assets_backend: list
    [0] sale/static/src/js/sale_order.js
  web.assets_frontend: list
    [0] sale/static/src/js/portal.js
```

### Example 2: Find All XML Files
```javascript
function findAllXmlFiles(parsed) {
    const xmlFiles = [];
    
    // Check data list
    const data = parsed.data.get('data');
    if (data && data.items) {
        data.items.forEach(item => {
            if (item.value.endsWith('.xml')) {
                xmlFiles.push({ file: item.value, location: 'data', position: item.range });
            }
        });
    }
    
    // Check assets
    const assets = parsed.data.get('assets');
    if (assets && assets.children) {
        for (const [bundle, list] of assets.children.entries()) {
            if (list.items) {
                list.items.forEach(item => {
                    if (item.value.endsWith('.xml')) {
                        xmlFiles.push({ file: item.value, location: `assets.${bundle}`, position: item.range });
                    }
                });
            }
        }
    }
    
    return xmlFiles;
}
```

### Example 3: Validate Manifest Structure
```javascript
function validateManifest(parsed) {
    const errors = [];
    
    // Check required keys
    const required = ['name', 'version', 'depends'];
    for (const key of required) {
        if (!parsed.data.has(key)) {
            errors.push(`Missing required key: ${key}`);
        }
    }
    
    // Check depends is a list
    const depends = parsed.data.get('depends');
    if (depends && depends.type !== 'list') {
        errors.push(`'depends' must be a list`);
    }
    
    // Check version format
    const version = parsed.data.get('version');
    if (version && version.type === 'string') {
        if (!/^\d+\.\d+/.test(version.value)) {
            errors.push(`Invalid version format: ${version.value}`);
        }
    }
    
    return errors;
}
```

## 🔧 API Reference

### ManifestParser Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `parseManifest(text)` | Parse manifest text | `ParsedManifest \| null` |
| `getListInsertPosition(listValue)` | Get position to insert in list | `Position \| null` |
| `getDictInsertPosition(dictValue)` | Get position to insert in dict | `Position \| null` |

### Helper Functions

| Function | Description |
|----------|-------------|
| `getNestedValue(parsed, ...keys)` | Navigate nested structure |
| `listContains(listValue, searchValue)` | Check if value exists in list |

## 📖 See Also

- `src/services/manifestParser.ts` - Implementation
- `src/examples/manifestParserExample.js` - Complete examples
- `MANIFEST_TREE_SITTER.md` - Basic manifest manipulation
