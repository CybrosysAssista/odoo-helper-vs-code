import * as vscode from 'vscode';
import * as path from 'path';
import { getPythonParserService } from '../../services/pythonParserService';
import functionIndexService from '../../services/functionIndexService';
import moduleIndexService from '../../services/moduleIndexService';

export class PythonInheritedFunctionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionItem[] | undefined> {
        // Check if cursor is after 'def '
        const lineText = document.lineAt(position.line).text;
        const textUntilCursor = lineText.slice(0, position.character);

        if (!/^\s*def\s+\w*$/.test(textUntilCursor)) {
            return undefined;
        }

        // Check if in a valid Odoo module
        const modules = await moduleIndexService.getModules();
        const module = modules.find(m => document.uri.fsPath.startsWith(m.path));
        if (!module) {
            return undefined;
        }

        const pythonParser = getPythonParserService();
        if (!pythonParser.isInitialized()) {
            return undefined;
        }

        const tree = pythonParser.parse(document.getText());
        if (!tree) {
            return undefined;
        }

        try {
            const offset = document.offsetAt(position);

            // Robust way to find the current class context:
            // 1. Try descendant at offset
            // 2. Try descendant at offset - 1
            // 3. Fallback: Find the class that started most recently before the cursor
            let classNode = null;
            let node = tree.rootNode.descendantForIndex(offset);

            const findClassUp = (startNode: any) => {
                let curr = startNode;
                while (curr) {
                    if (curr.type === 'class_definition') return curr;
                    curr = curr.parent;
                }
                return null;
            };

            classNode = findClassUp(node);
            if (!classNode && offset > 0) {
                const prevNode = tree.rootNode.descendantForIndex(offset - 1);
                classNode = findClassUp(prevNode);
                if (classNode) {
                    // found class
                }
            }

            if (!classNode) {
                // Final fallback: scan all classes and pick the one starting closest before offset
                const allClassNodes: any[] = [];
                const collect = (n: any) => {
                    if (n.type === 'class_definition') allClassNodes.push(n);
                    for (const c of n.children) collect(c);
                };
                collect(tree.rootNode);

                let best = null;
                for (const cls of allClassNodes) {
                    if (cls.startIndex <= offset) {
                        if (!best || cls.startIndex > best.startIndex) {
                            best = cls;
                        }
                    }
                }
                classNode = best;
                if (classNode) {
                    // found class
                }
            }

            if (!classNode) {
                return undefined;
            }

            const bodyNode = classNode.childForFieldName('body');
            if (!bodyNode) {
                return undefined;
            }

            let inheritModels: string[] = [];

            // Look for _inherit in class body
            for (const child of bodyNode.children) {
                if (child.type === 'expression_statement') {
                    const assignment = child.firstChild;
                    if (assignment?.type === 'assignment') {
                        const left = assignment.childForFieldName('left');
                        const right = assignment.childForFieldName('right');

                        if (left?.text === '_inherit') {
                            inheritModels = this.extractModels(right);
                            break;
                        }
                    }
                }
            }

            if (inheritModels.length === 0) {
                return undefined;
            }

            const suggestions: vscode.CompletionItem[] = [];
            const seenFunctions = new Set<string>();

            for (const modelName of inheritModels) {
                const functions = functionIndexService.getFunctionsForModel(modelName);

                const baseFunctions = functions.filter(f => !f.isInherited);

                for (const func of baseFunctions) {
                    if (seenFunctions.has(func.functionName)) continue;
                    seenFunctions.add(func.functionName);

                    const item = new vscode.CompletionItem(func.functionName, vscode.CompletionItemKind.Method);
                    item.detail = `Inherited from ${func.modelName} (${func.moduleName})`;

                    const params = func.parameters.join(', ');
                    const callParams = func.parameters.filter(p => p !== 'self').join(', ');

                    const snippet = new vscode.SnippetString();
                    snippet.appendText(`${func.functionName}(${params}):\n`);
                    const config = vscode.workspace.getConfiguration('editor');
                    const tabSize = config.get<number>('tabSize', 4);
                    const indent = ' '.repeat(tabSize);
                    snippet.appendText(`${indent}res = super().${func.functionName}(${callParams})\n`);
                    snippet.appendText(`${indent}return res`);

                    item.insertText = snippet;
                    item.documentation = new vscode.MarkdownString(`Overrides \`${func.functionName}\` from \`${func.modelName}\`.`);
                    suggestions.push(item);
                }
            }

            return suggestions;

        } catch (error) {
            console.error('[PythonInheritedFunctionProvider] Error:', error);
        } finally {
            tree.delete();
        }

        return undefined;
    }

    private extractModels(node: any): string[] {
        if (node.type === 'string') {
            return [node.text.slice(1, -1)];
        }
        if (node.type === 'list' || node.type === 'tuple') {
            const models: string[] = [];
            for (const child of node.namedChildren) {
                if (child.type === 'string') {
                    models.push(child.text.slice(1, -1));
                }
            }
            return models;
        }
        return [];
    }
}
