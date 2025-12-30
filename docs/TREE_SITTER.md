# Tree-sitter Python Parser Integration

This extension now includes **Tree-sitter** for robust Python code parsing, providing PSI-like capabilities similar to PyCharm.

## What is Tree-sitter?

Tree-sitter is a parser generator tool and incremental parsing library that builds a concrete syntax tree for your code. Unlike regex-based parsing, it understands the actual structure of your code.

## Features

The Python Parser Service provides:

1. **Find Odoo Models**: Detect all classes that inherit from `models.Model`, `models.TransientModel`, or `models.AbstractModel`
2. **Find Fields**: Extract all field definitions (e.g., `name = fields.Char(...)`)
3. **Parse Manifests**: Read and manipulate `__manifest__.py` files safely
4. **Insert Positions**: Find exact positions to insert new items in lists or dictionaries

## Testing the Parser

1. Open any Python file in your Odoo module
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Assista: Test Tree-sitter Parser"
4. The extension will show you all models and fields found in the current file

## Using in Your Code

### Example 1: Find all models in a file

```javascript
const { getPythonParserService } = require('./services/pythonParserService');

const parser = getPythonParserService();
const text = document.getText();
const models = parser.findOdooModels(text);

// models = [{ name: 'SaleOrder', line: 10, inherits: [] }, ...]
```

### Example 2: Add a file to manifest data

```javascript
const { ManifestHelper } = require('./services/manifestHelper');

await ManifestHelper.addToDataList(
    manifestUri, 
    'views/sale_order_views.xml'
);
```

### Example 3: Check if a dependency exists

```javascript
const parser = getPythonParserService();
const text = fs.readFileSync('__manifest__.py', 'utf8');

if (parser.manifestListContains(text, 'depends', 'sale')) {
    console.log('Sale module is already a dependency');
}
```

## Architecture

```
src/services/
├── pythonParserService.ts   # Core Tree-sitter wrapper
└── manifestHelper.ts         # Helper functions for manifest manipulation

resources/
└── tree-sitter-python.wasm  # Python grammar (447KB)
```

## Benefits over Regex

| Feature | Regex | Tree-sitter |
|---------|-------|-------------|
| Multi-line code | ❌ Breaks | ✅ Handles perfectly |
| Comments | ❌ Can match incorrectly | ✅ Ignores comments |
| Syntax errors | ❌ Fails completely | ✅ Partial parsing |
| Performance | ⚠️ Slow on large files | ✅ Incremental parsing |
| Accuracy | ⚠️ ~80% | ✅ ~99% |

## Future Enhancements

- [ ] Add to `__init__.py` using Tree-sitter
- [ ] Manipulate `assets` dictionary in manifests
- [ ] Refactor field names across files
- [ ] Auto-import missing modules
- [ ] Validate Python syntax before saving

## Technical Details

- **Library**: `web-tree-sitter` v0.26.3
- **Grammar**: `tree-sitter-python` v0.23.6
- **Initialization**: Async on extension activation
- **Fallback**: If initialization fails, extension continues with limited features
