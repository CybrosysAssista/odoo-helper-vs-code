const vscode = require('vscode');
const path = require('path');

// Comprehensive Odoo standards configuration
const ODOO_STANDARDS = {
    fileNaming: {
        views: /(_views|_templates|_menus)\.xml$/,
        security: /(ir\.model\.access\.csv|_groups\.xml|_security\.xml)$/,
        report: /_report_views\.xml|_reports\.xml|_templates\.xml$/,
        wizard: /_views\.xml$/,
        data: /_data\.xml|_demo\.xml$/,
        reportPy: /_report\.py$/,
        pythonSnakeCase: /^[a-z_]+\.py$/
    },
    classNaming: /^[A-Z][a-zA-Z0-9]*$/,
    modelClass: /class\s+(\w+)\s*\(.*models\.Model/,
    xmlPatterns: {
        recordWithModel: /<record[^>]*model="[^"]*"[^>]*id="[^"]*"/,
        recordWithIdFirst: /<record[^>]*id="[^"]*"[^>]*model="[^"]*"/,
        fieldNameNotFirst: /<field\s+(?!name=)[^>]*name=/,
        dataNoUpdate: /<data[^>]*noupdate="1"/,
        odooWithNoUpdate: /<odoo[^>]*noupdate="1"/,
        menuRecord: /<record[^>]*model="ir\.ui\.menu"/,
        viewRecord: /<record[^>]*model="ir\.ui\.view"[^>]*>/,
        qwebTemplate: /<t\s+t-name=/,
        menuItem: /<menuitem/,
        template: /<template/
    },
    namingPatterns: {
        // ID naming patterns
        menuId: /^[a-z_]+_menu(_[a-z_]+)?$/,
        viewId: /^[a-z_]+_view_(form|list|kanban|search|tree|calendar|graph|pivot|activity)(_inherit)?$/,
        actionId: /^[a-z_]+_action(_[a-z_]+)?$/,
        groupId: /^[a-z_]+_group_[a-z_]+$/,
        ruleId: /^[a-z_]+_rule_[a-z_]+$/,
        inheritView: /^[a-z_]+_view_[a-z_]+$/,
        inheritSuffix: /\.inherit\.[a-z_]+$/,
        // Name field patterns (dots instead of underscores)
        viewName: /^[a-z._]+\.view\.(form|list|kanban|search|tree|calendar|graph|pivot|activity)(\.[a-z._]+)?$/,
        actionName: /^[A-Z]/,  // Actions should have descriptive names starting with capital
        // Python naming patterns
        methodCompute: /^_compute_[a-z_]+$/,
        methodSearch: /^_search_[a-z_]+$/,
        methodDefault: /^_default_[a-z_]+$/,
        methodSelection: /^_selection_[a-z_]+$/,
        methodOnchange: /^_onchange_[a-z_]+$/,
        methodConstraint: /^_check_[a-z_]+$/,
        methodAction: /^action_[a-z_]+$/,
        variableCamelCase: /^[a-z][a-zA-Z0-9]*$/,
        variableSnakeCase: /^[a-z_][a-z0-9_]*$/,
        fieldMany2One: /_id$/,
        fieldMany2Many: /_ids$/,
        fieldOne2Many: /_ids$/
    },
    // Python code patterns
    pythonPatterns: {
        cloneMethod: /\.clone\(\)/,
        crCommit: /cr\.commit\(\)/,
        directTranslation: /_\([^)]*%[^)]*\)/,
        dynamicTranslation: /_\([^'"]/,
        concatenatedTranslation: /_\(\s*[^)]*\+\s*[^)]*\)/,
        formatOutsideTranslation: /_\([^)]*\)\s*%/,
        nestedTranslation: /_\([^)]*_\([^)]*\)[^)]*\)/,
        badDictCreation: /my_dict\s*=\s*{}\s*;\s*my_dict\[/,
        badDictUpdate: /my_dict\[[^\]]+\]\s*=.*my_dict\[[^\]]+\]\s*=/,
        lenCheck: /if\s+len\([^)]+\)\s*[><!]=?\s*[0-9]/,
        keysIteration: /for\s+\w+\s+in\s+\w+\.keys\(\)/,
        getWithNone: /\.get\([^,)]+,\s*None\)/,
        missingEnsureOne: /def\s+action_[a-z_]+\([^)]*\):[^{]*(?!.*self\.ensure_one\(\))/
    }
};

const XML_CHECKS = [
    {
        pattern: /<record/,
        test: line => {
            const hasModel = line.includes('model=');
            const hasId = line.includes('id=');
            if (hasModel && hasId) {
                // Check if id comes before model
                const modelIndex = line.indexOf('model=');
                const idIndex = line.indexOf('id=');
                return modelIndex < idIndex;
            }
            return false;
        },
        message: "Odoo XML standard: Place 'id' attribute before 'model' in <record>"
    },
    {
        pattern: /<field/,
        test: line => ODOO_STANDARDS.xmlPatterns.fieldNameNotFirst.test(line),
        message: "Odoo XML standard: The 'name' attribute should be the first in <field>"
    },
    {
        pattern: /<data/,
        test: line => {
            return ODOO_STANDARDS.xmlPatterns.dataNoUpdate.test(line);
        },
        message: "Odoo XML standard: Use noupdate=\"1\" on <odoo> tag instead of <data> if all records are not-updatable"
    },
    {
        pattern: /<record/,
        test: line => ODOO_STANDARDS.xmlPatterns.menuRecord.test(line),
        message: "Odoo XML standard: Use <menuitem> tag instead of <record model=\"ir.ui.menu\">"
    },
    // {
    //     pattern: /<record/,
    //     test: line => {
    //         if (!ODOO_STANDARDS.xmlPatterns.viewRecord.test(line)) return false;
    //         return false; // This will be handled in checkQWebTemplates function
    //     },
    //     message: "Odoo XML standard: Use <template> for QWeb views instead of <record>"
    // }
];

const ID_NAMING_CHECKS = [
    {
        pattern: /id="([^"]*_menu[^"]*)"/, 
        test: (id) => !ODOO_STANDARDS.namingPatterns.menuId.test(id),
        message: (id) => `Odoo naming: Menu ID '${id}' should follow pattern: <model_name>_menu or <model_name>_menu_<detail>`
    },
    {
        // Match ANY id in a view record, not just those containing _view_
        pattern: /id="([^"]*)"/, 
        context: 'ir.ui.view', // This will be checked in the function
        test: (id) => !ODOO_STANDARDS.namingPatterns.viewId.test(id),
        message: (id) => `Odoo naming: View ID '${id}' should follow pattern: <model_name>_view_<view_type>`
    },
    {
        pattern: /id="([^"]*_action[^"]*)"/, 
        test: (id) => !ODOO_STANDARDS.namingPatterns.actionId.test(id),
        message: (id) => `Odoo naming: Action ID '${id}' should follow pattern: <model_name>_action or <model_name>_action_<detail>`
    },
    {
        pattern: /id="([^"]*_group_[^"]*)"/, 
        test: (id) => !ODOO_STANDARDS.namingPatterns.groupId.test(id),
        message: (id) => `Odoo naming: Group ID '${id}' should follow pattern: <module_name>_group_<group_name>`
    },
    {
        pattern: /id="([^"]*_rule_[^"]*)"/, 
        test: (id) => !ODOO_STANDARDS.namingPatterns.ruleId.test(id),
        message: (id) => `Odoo naming: Rule ID '${id}' should follow pattern: <model_name>_rule_<concerned_group>`
    }
];

const NAME_FIELD_CHECKS = [
    {
        pattern: /<field name="name">([^<]*)<\/field>/,
        context: /model="ir\.ui\.view"/, // still kept for compatibility
        test: (name, line, lines, lineIndex) => {
            let isInherited = false;
            let isViewModel = false;

            // Look upwards to confirm we're inside a <record model="ir.ui.view">
            for (let i = lineIndex; i >= 0; i--) {
                const checkLine = lines[i];
                if (checkLine.includes('<record') && checkLine.includes('model="ir.ui.view"')) {
                    isViewModel = true;
                    break;
                }
                if (checkLine.includes('</record>')) break;
            }

            if (!isViewModel) return false; // Skip if not a view definition

            // Check if this is an inherited view
            for (let i = lineIndex - 5; i <= lineIndex + 5; i++) {
                if (i >= 0 && i < lines.length && lines[i].includes('inherit_id')) {
                    isInherited = true;
                    break;
                }
            }

            if (isInherited) return false; // Skip inherited views for this rule

            // Finally apply the naming rule
            return !ODOO_STANDARDS.namingPatterns.viewName.test(name.trim());
        },
        message: (name) =>
            `Odoo naming: View name '${name}' should use dots instead of underscores and follow pattern: <model.name>.view.<type>`
    },
    {
        pattern: /<field name="name">([^<]*)<\/field>/,
        context: /model="ir\.ui\.view"/,
        test: (name, line, lines, lineIndex) => {
            let isInherited = false;

            for (let i = lineIndex - 5; i <= lineIndex + 5; i++) {
                if (i >= 0 && i < lines.length && lines[i].includes('inherit_id')) {
                    isInherited = true;
                    break;
                }
            }

            if (!isInherited) return false; // only check if it's an inherited view
            return !ODOO_STANDARDS.namingPatterns.inheritSuffix.test(name.trim());
        },
        message: (name) =>
            `Odoo naming: Inherited view name '${name}' should contain '.inherit.<details>' suffix`
    }
];

// New Python-specific checks based on Odoo standards
const PYTHON_CHECKS = [
    {
        pattern: ODOO_STANDARDS.pythonPatterns.cloneMethod,
        message: "Odoo Python: Don't use .clone() - use dict(my_dict) or list(old_list) instead"
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.crCommit,
        message: "Odoo Python: NEVER call cr.commit() yourself unless you created your own cursor"
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.directTranslation,
        message: "Odoo Python: Don't format strings before translation - use _('Text %s', value) instead"
    },
{
        pattern: ODOO_STANDARDS.pythonPatterns.concatenatedTranslation,
        message: "Odoo Python: Don't use concatenated strings inside translation functions (_) - write the full string as a literal."
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.formatOutsideTranslation,
        message: "Odoo Python: Don't format after translation - include formatting inside _() call"
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.nestedTranslation,
        message: "Odoo Python: Don't nest translation calls - field values are automatically translated"
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.lenCheck,
        message: "Odoo Python: Use 'if collection:' instead of 'if len(collection) > 0:'"
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.keysIteration,
        message: "Odoo Python: Use 'for key in my_dict:' instead of 'for key in my_dict.keys():'"
    },
    {
        pattern: ODOO_STANDARDS.pythonPatterns.getWithNone,
        message: "Odoo Python: .get('key', None) is redundant - use .get('key') instead"
    }
];

// Method naming checks
const PYTHON_METHOD_CHECKS = [
    {
        prefix: '_compute_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodCompute.test(methodName),
        message: (methodName) => `Odoo naming: Compute method '${methodName}' should follow pattern: _compute_<field_name>`
    },
    {
        prefix: '_search_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodSearch.test(methodName),
        message: (methodName) => `Odoo naming: Search method '${methodName}' should follow pattern: _search_<field_name>`
    },
    {
        prefix: '_default_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodDefault.test(methodName),
        message: (methodName) => `Odoo naming: Default method '${methodName}' should follow pattern: _default_<field_name>`
    },
    {
        prefix: '_selection_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodSelection.test(methodName),
        message: (methodName) => `Odoo naming: Selection method '${methodName}' should follow pattern: _selection_<field_name>`
    },
    {
        prefix: '_onchange_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodOnchange.test(methodName),
        message: (methodName) => `Odoo naming: Onchange method '${methodName}' should follow pattern: _onchange_<field_name>`
    },
    {
        prefix: '_check_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodConstraint.test(methodName),
        message: (methodName) => `Odoo naming: Constraint method '${methodName}' should follow pattern: _check_<constraint_name>`
    },
    {
        prefix: 'action_',
        test: (methodName) => !ODOO_STANDARDS.namingPatterns.methodAction.test(methodName),
        message: (methodName) => `Odoo naming: Action method '${methodName}' should follow pattern: action_<action_name>`
    }
];

// Field naming checks
const PYTHON_FIELD_CHECKS = [
    {
        pattern: /(\w+)\s*=\s*fields\.Many2one/,
        test: (fieldName) => !fieldName.endsWith('_id'),
        message: (fieldName) => `Odoo naming: Many2One field '${fieldName}' should have '_id' suffix`
    },
    {
        pattern: /(\w+)\s*=\s*fields\.One2many/,
        test: (fieldName) => !fieldName.endsWith('_ids'),
        message: (fieldName) => `Odoo naming: One2Many field '${fieldName}' should have '_ids' suffix`
    },
    {
        pattern: /(\w+)\s*=\s*fields\.Many2many/,
        test: (fieldName) => !fieldName.endsWith('_ids'),
        message: (fieldName) => `Odoo naming: Many2Many field '${fieldName}' should have '_ids' suffix`
    }
];

// Import order checks
const IMPORT_ORDER_CHECKS = [
    {
        pattern: /^(import|from)\s+/,
        checker: (lines) => {
            const imports = [];
            let currentSection = 0; // 0: stdlib, 1: odoo, 2: addons
            
            lines.forEach((line, i) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
                    let section = 0;
                    if (trimmed.includes('odoo') && !trimmed.includes('odoo.addons')) {
                        section = 1;
                    } else if (trimmed.includes('odoo.addons')) {
                        section = 2;
                    }
                    
                    if (section < currentSection) {
                        imports.push({
                            line: i,
                            message: `Odoo imports: Wrong import order. Should be: 1) Python stdlib, 2) Odoo core, 3) Odoo addons`
                        });
                    }
                    currentSection = Math.max(currentSection, section);
                }
            });
            
            return imports;
        }
    }
];

const FILE_NAMING_RULES = {
    xml: {
        views: { pattern: ODOO_STANDARDS.fileNaming.views, message: "should end with _views.xml, _templates.xml, or _menus.xml" },
        security: { pattern: ODOO_STANDARDS.fileNaming.security, message: "should be named ir.model.access.csv, *_groups.xml, or *_security.xml" },
        report: { pattern: ODOO_STANDARDS.fileNaming.report, message: "should end with _report_views.xml, _reports.xml, or _templates.xml" },
        wizard: { pattern: ODOO_STANDARDS.fileNaming.wizard, message: "should end with _views.xml" },
        data: { pattern: ODOO_STANDARDS.fileNaming.data, message: "should end with _data.xml or _demo.xml" }
    },
    py: {
        controllers: { pattern: ODOO_STANDARDS.fileNaming.pythonSnakeCase, message: "should be snake_case and named <module>.py or portal.py" },
        wizard: { pattern: ODOO_STANDARDS.fileNaming.pythonSnakeCase, message: "should be snake_case" },
        report: { pattern: ODOO_STANDARDS.fileNaming.reportPy, message: "should end with _report.py" }
    }
};

function toSnakeCase(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function createDiagnostic(lineIndex, startCol, endCol, message, severity = vscode.DiagnosticSeverity.Warning) {
    return new vscode.Diagnostic(
        new vscode.Range(lineIndex, startCol, lineIndex, endCol),
        message,
        severity
    );
}

function checkModelClass(lines, fileBaseName, diagnostics) {
    lines.forEach((line, i) => {
        const classMatch = line.trim().match(ODOO_STANDARDS.modelClass);
        if (!classMatch) return;

        const className = classMatch[1];
        const expectedFileName = toSnakeCase(className);
        
        if (expectedFileName !== fileBaseName) {
            diagnostics.push(createDiagnostic(
                i, 0, line.length,
                `Odoo standard: File name should be '${expectedFileName}.py' for class '${className}'`
            ));
        }
        
        if (!ODOO_STANDARDS.classNaming.test(className)) {
            diagnostics.push(createDiagnostic(
                i, 0, line.length,
                `Odoo standard: Model class '${className}' should use CamelCase`
            ));
        }
    });
}

function checkPythonStandards(lines, diagnostics) {
    // Check general Python patterns
    lines.forEach((line, i) => {
        PYTHON_CHECKS.forEach(check => {
            if (check.pattern.test(line)) {
                diagnostics.push(createDiagnostic(i, 0, line.length, check.message));
            }
        });
    });
    
    // Improved method naming check
    lines.forEach((line, i) => {
        const match = line.match(/def\s+(\w+)/);
        if (match) {
            const methodName = match[1];
            PYTHON_METHOD_CHECKS.forEach(check => {
                // Remove underscores and angle brackets for a loose match
                const typeKeyword = check.prefix.replace(/_/g, '').replace(/<|>/g, '');
                // If the method name contains the type (e.g., 'compute', 'search', etc.)
                // and does NOT start with the correct prefix, flag it
                if (
                    methodName.toLowerCase().includes(typeKeyword) &&
                    !methodName.startsWith(check.prefix)
                ) {
                    diagnostics.push(createDiagnostic(i, 0, line.length, check.message(methodName)));
                }
            });
        }
    });
    
    // Check field naming
    lines.forEach((line, i) => {
        PYTHON_FIELD_CHECKS.forEach(check => {
            const match = line.match(check.pattern);
            if (match) {
                const fieldName = match[1];
                if (check.test(fieldName)) {
                    diagnostics.push(createDiagnostic(i, 0, line.length, check.message(fieldName)));
                }
            }
        });
    });
    
    // Check action methods for ensure_one()
    lines.forEach((line, i) => {
        if (line.trim().startsWith('def action_')) {
            // Look for ensure_one() in the next few lines
            let hasEnsureOne = false;
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                if (lines[j].includes('self.ensure_one()')) {
                    hasEnsureOne = true;
                    break;
                }
                if (lines[j].trim().startsWith('def ') || lines[j].trim().startsWith('class ')) {
                    break;
                }
            }
            if (!hasEnsureOne) {
                diagnostics.push(createDiagnostic(
                    i, 0, line.length,
                    "Odoo standard: Action methods should call self.ensure_one() at the beginning"
                ));
            }
        }
    });
}

function checkImportOrder(lines, diagnostics) {
    IMPORT_ORDER_CHECKS.forEach(check => {
        const issues = check.checker(lines);
        issues.forEach(issue => {
            diagnostics.push(createDiagnostic(issue.line, 0, lines[issue.line].length, issue.message));
        });
    });
}

function checkXmlStandards(lines, diagnostics) {
    lines.forEach((line, i) => {
        XML_CHECKS.forEach(check => {
            if (line.includes(check.pattern.source?.slice(1, -1) || check.pattern.toString().slice(1, -1))) {
                if (check.test(line)) {
                    diagnostics.push(createDiagnostic(i, 0, line.length, check.message));
                }
            }
        });
    });
}

function checkIdNaming(lines, diagnostics) {
    lines.forEach((line, i) => {
        ID_NAMING_CHECKS.forEach(check => {
            const match = line.match(check.pattern);
            if (match) {
                const id = match[1];
                if (check.context === 'ir.ui.view') {
                    let isViewModel = false;
                    for (let j = i; j >= 0; j--) {
                        const checkLine = lines[j];
                        if (checkLine.includes('<record') && checkLine.includes('model="ir.ui.view"')) {
                            isViewModel = true;
                            break;
                        }
                        if (checkLine.includes('</record>') || checkLine.includes('<template')) {
                            break;
                        }
                    }
                    if (!isViewModel) return;
                }
                if (check.test(id)) {
                    diagnostics.push(createDiagnostic(i, 0, line.length, check.message(id)));
                }
            }
        });
    });
}

function checkNameFields(lines, diagnostics) {
    lines.forEach((line, i) => {
        NAME_FIELD_CHECKS.forEach(check => {
            const match = line.match(check.pattern);
            if (match) {
                const name = match[1];
                if (check.test(name, line, lines, i)) {
                    diagnostics.push(createDiagnostic(i, 0, line.length, check.message(name)));
                }
            }
        });
    });
}

function checkQWebTemplates(lines, diagnostics) {
    let currentRecord = null;
    let recordStartLine = -1;
    
    lines.forEach((line, i) => {
        // Track record context
        if (line.includes('<record') && line.includes('model="ir.ui.view"')) {
            currentRecord = 'view';
            recordStartLine = i;
        } else if (line.includes('</record>')) {
            currentRecord = null;
            recordStartLine = -1;
        }
        
        // Check for QWeb templates in view records
        // if (currentRecord === 'view' && (line.includes('t-name=') || line.includes('<t '))) {
        //     diagnostics.push(createDiagnostic(
        //         recordStartLine, 0, lines[recordStartLine].length,
        //         "Odoo XML standard: Use <template> for QWeb views instead of <record>"
        //     ));
        //     currentRecord = null; // Avoid duplicate warnings
        // }
    });
}

function checkFileNaming(fileName, dirName, fileExtension, diagnostics) {
    const rules = FILE_NAMING_RULES[fileExtension];
    if (!rules || !rules[dirName]) return;

    const rule = rules[dirName];
    if (!rule.pattern.test(fileName)) {
        diagnostics.push(createDiagnostic(
            0, 0, fileName.length,
            `Odoo standard: ${capitalize(dirName)} file '${fileName}' ${rule.message}`
        ));
    }
}

function checkModelNaming(lines, diagnostics) {
    lines.forEach((line, i) => {
        // Check for model name definition
        const modelMatch = line.match(/_name\s*=\s*['"](.*)['"]/);
        if (modelMatch) {
            const modelName = modelMatch[1];
            if (modelName.includes('s.') || modelName.endsWith('s')) {
                // Check if it's a legitimate plural (like 'res.partners' vs 'res.partner')
                const parts = modelName.split('.');
                const lastPart = parts[parts.length - 1];
                if (lastPart.endsWith('s') && lastPart !== 'res' && lastPart !== 'pos') {
                    diagnostics.push(createDiagnostic(
                        i, 0, line.length,
                        `Odoo standard: Model name '${modelName}' should use singular form`
                    ));
                }
            }
        }
        
        // Check for transient/wizard naming
        const transientMatch = line.match(/class.*models\.TransientModel/);
        if (transientMatch) {
            const nameMatch = lines.slice(i, i + 10)
                .find(l => l.includes('_name'))
                ?.match(/_name\s*=\s*['"](.*)['"]/);
            if (nameMatch && !nameMatch[1].includes('.') && !nameMatch[1].includes('wizard')) {
                diagnostics.push(createDiagnostic(
                    i, 0, line.length,
                    `Odoo standard: Transient model name should follow pattern '<base_model>.<action>' (avoid 'wizard')`
                ));
            }
        }
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function runOdooLint(document, collection) {
    // Check if code standard warnings are enabled
    const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
    const enableCodeStandardWarnings = config.get('enableCodeStandardWarnings', true);

    // If warnings are disabled, clear any existing diagnostics and return early
    if (!enableCodeStandardWarnings) {
        collection.set(document.uri, []);
        return;
    }

    const diagnostics = [];
    const filePath = document.uri.fsPath;
    const fileName = path.basename(filePath);
    const fileBaseName = fileName.replace(/\.(py|xml)$/, '');
    const dirName = path.basename(path.dirname(filePath));
    const lines = document.getText().split('\n');
    
    const isXml = fileName.endsWith('.xml');
    const isPython = fileName.endsWith('.py');
    
    // Check model class standards (Python files in models directory only)
    if (isPython && dirName === 'models' && document.languageId === 'python') {
        checkModelClass(lines, fileBaseName, diagnostics);
        checkModelNaming(lines, diagnostics);
    }
    
    // Check Python-specific standards
    if (isPython && document.languageId === 'python') {
        checkPythonStandards(lines, diagnostics);
        checkImportOrder(lines, diagnostics);
    }
    
    // Check XML standards
    if (isXml) {
        checkXmlStandards(lines, diagnostics);
        checkIdNaming(lines, diagnostics);
        checkNameFields(lines, diagnostics);
        checkQWebTemplates(lines, diagnostics);
    }
    
    // Check file naming conventions
    const fileExtension = isXml ? 'xml' : isPython ? 'py' : null;
    if (fileExtension) {
        checkFileNaming(fileName, dirName, fileExtension, diagnostics);
    }
    
    collection.set(document.uri, diagnostics);
}

module.exports = { runOdooLint };