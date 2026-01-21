/**
 * Custom CSV Parser for Odoo development.
 * Handles conversion between CSV string and Matrix (string[][])
 */
export class OdooCsvParser {
    private matrix: string[][] = [];

    /**
     * @param content Optional initial CSV content to parse
     */
    constructor(content?: string) {
        if (content) {
            this.matrix = this.parseToMatrix(content);
        }
    }

    /**
     * Converts a CSV string into a 2D Matrix (Array of Arrays).
     * Handles quoted values containing commas.
     * @param content The raw CSV content
     * @returns string[][]
     */
    public parseToMatrix(content: string): string[][] {
        const rows: string[][] = [];
        // Split by lines, but handle both \n and \r\n
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            if (!line.trim()) continue;

            const row: string[] = [];
            let currentField = '';
            let insideQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    // Handle escaped quotes (double quotes "")
                    if (insideQuotes && nextChar === '"') {
                        currentField += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        insideQuotes = !insideQuotes;
                    }
                } else if (char === ',' && !insideQuotes) {
                    // Start a new field
                    row.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            // Push the last field
            row.push(currentField.trim());
            rows.push(row);
        }

        this.matrix = rows;
        return rows;
    }

    /**
     * Converts the current internal Matrix back into a CSV string.
     * Automatically wraps values in quotes if they contain commas.
     * @returns string
     */
    public convertMatrixToText(): string {
        return this.matrix.map(row => {
            return row.map(field => {
                // If field contains comma or quotes, wrap in quotes and escape internal quotes
                if (field.includes(',') || field.includes('"')) {
                    const escaped = field.replace(/"/g, '""');
                    return `"${escaped}"`;
                }
                return field;
            }).join(',');
        }).join('\n');
    }

    /**
     * Get the current matrix data
     */
    public getMatrix(): string[][] {
        return this.matrix;
    }

    /**
     * Manually set the matrix data
     */
    public setMatrix(matrix: string[][]) {
        this.matrix = matrix;
    }

    /**
     * Adds a new row to the end of the matrix
     */
    public addRow(row: string[]) {
        this.matrix.push(row);
    }
}
