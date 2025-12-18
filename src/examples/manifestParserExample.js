const vscode = require('vscode');
const { getPythonParserService } = require('../services/pythonParserService');
const { getNestedValue, listContains } = require('../services/manifestParser');

/**
 * Example: Using the advanced ManifestParser
 * 
 * This shows how to navigate nested structures in __manifest__.py
 * and get exact positions for any key or value
 */

async function exampleParseManifest() {
    const parser = getPythonParserService();

    if (!parser.isInitialized()) {
        console.error('Parser not initialized');
        return;
    }

    // Example manifest content
    const manifestText = `{
    'name': 'Sale Management',
    'version': '1.0',
    'depends': ['base', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'views/sale_order_views.xml',
        'views/product_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'sale/static/src/js/sale_order.js',
            'sale/static/src/xml/sale_templates.xml',
        ],
        'web.assets_frontend': [
            'sale/static/src/js/portal.js',
        ],
    },
    'demo': [
        'demo/sale_demo.xml',
    ],
}`;

    // Get the manifest parser
    const manifestParser = parser.getManifestParser();

    if (!manifestParser) {
        console.error('Could not create manifest parser');
        return;
    }

    // Parse the manifest
    const parsed = manifestParser.parseManifest(manifestText);

    if (!parsed) {
        console.error('Failed to parse manifest');
        return;
    }

    console.log('=== Parsed Manifest Structure ===\n');

    // Example 1: Get top-level keys
    console.log('Top-level keys:', Array.from(parsed.data.keys()));
    // Output: ['name', 'version', 'depends', 'data', 'assets', 'demo']

    // Example 2: Get a simple value
    const nameValue = parsed.data.get('name');
    if (nameValue) {
        console.log('\nModule name:', nameValue.value);
        console.log('Position:', nameValue.range);
        // Output: Module name: Sale Management
        //         Position: { start: { line: 1, character: 12 }, end: { line: 1, character: 30 } }
    }

    // Example 3: Get a list
    const dataValue = parsed.data.get('data');
    if (dataValue && dataValue.type === 'list') {
        console.log('\nData files:', dataValue.value);
        console.log('Number of files:', dataValue.items?.length);

        // Get position of each item
        dataValue.items?.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.value} at line ${item.range.start.line}`);
        });
    }

    // Example 4: Navigate nested structure (assets)
    const assetsValue = parsed.data.get('assets');
    if (assetsValue && assetsValue.type === 'dict' && assetsValue.children) {
        console.log('\nAssets bundles:', Array.from(assetsValue.children.keys()));
        // Output: ['web.assets_backend', 'web.assets_frontend']

        // Get a specific bundle
        const backendAssets = assetsValue.children.get('web.assets_backend');
        if (backendAssets && backendAssets.type === 'list') {
            console.log('\nBackend assets:', backendAssets.value);
            console.log('Position:', backendAssets.range);
        }
    }

    // Example 5: Using helper function to get nested value
    const backendAssets = getNestedValue(parsed, 'assets', 'web.assets_backend');
    if (backendAssets) {
        console.log('\nBackend assets (using helper):', backendAssets.value);
    }

    // Example 6: Check if a file exists in a list
    const dataList = parsed.data.get('data');
    if (dataList) {
        const exists = listContains(dataList, 'views/sale_order_views.xml');
        console.log('\nContains sale_order_views.xml:', exists);
    }

    // Example 7: Get insertion position for adding to a list
    if (dataList) {
        const insertPos = manifestParser.getListInsertPosition(dataList);
        console.log('\nInsert position for new data file:', insertPos);
        // This is where you would insert a new file
    }

    // Example 8: Get insertion position for adding to assets
    const frontendAssets = getNestedValue(parsed, 'assets', 'web.assets_frontend');
    if (frontendAssets) {
        const insertPos = manifestParser.getListInsertPosition(frontendAssets);
        console.log('\nInsert position for new frontend asset:', insertPos);
    }

    return parsed;
}

/**
 * Practical example: Add a file to assets using the parser
 */
async function addFileToAssets(manifestUri, bundleName, filePath) {
    const parser = getPythonParserService();
    const manifestParser = parser.getManifestParser();

    if (!manifestParser) {
        vscode.window.showErrorMessage('Parser not ready');
        return false;
    }

    try {
        const document = await vscode.workspace.openTextDocument(manifestUri);
        const text = document.getText();
        const lines = text.split('\n');

        // Parse the manifest
        const parsed = manifestParser.parseManifest(text);

        if (!parsed) {
            vscode.window.showErrorMessage('Failed to parse manifest');
            return false;
        }

        // Navigate to the assets bundle
        const bundle = getNestedValue(parsed, 'assets', bundleName);

        if (!bundle) {
            vscode.window.showErrorMessage(`Bundle "${bundleName}" not found in manifest`);
            return false;
        }

        // Check if file already exists
        if (listContains(bundle, filePath)) {
            vscode.window.showInformationMessage(`${filePath} already in ${bundleName}`);
            return false;
        }

        // Get insertion position
        const insertPos = manifestParser.getListInsertPosition(bundle);

        if (!insertPos) {
            vscode.window.showErrorMessage('Could not find insertion position');
            return false;
        }

        // Calculate indentation
        const currentLine = lines[insertPos.line];
        const indent = currentLine.match(/^(\s*)/)?.[1] || '            ';

        // Create edit
        const edit = new vscode.WorkspaceEdit();
        const position = new vscode.Position(insertPos.line, insertPos.character);
        edit.insert(manifestUri, position, `,\n${indent}'${filePath}'`);

        // Apply edit
        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
            await document.save();
            vscode.window.showInformationMessage(`✅ Added ${filePath} to ${bundleName}`);
            return true;
        }

        return false;

    } catch (error) {
        console.error('Error adding file to assets:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        return false;
    }
}

/**
 * Example: Print the entire manifest structure
 */
function printManifestStructure(parsed, indent = '') {
    for (const [key, value] of parsed.data.entries()) {
        console.log(`${indent}${key}: ${value.type}`);

        if (value.type === 'dict' && value.children) {
            printManifestStructure({ data: value.children }, indent + '  ');
        } else if (value.type === 'list' && value.items) {
            value.items.forEach((item, i) => {
                console.log(`${indent}  [${i}] ${item.value}`);
            });
        } else {
            console.log(`${indent}  = ${value.value}`);
        }
    }
}

module.exports = {
    exampleParseManifest,
    addFileToAssets,
    printManifestStructure
};
