import { create } from 'xmlbuilder2';

export interface OdooConfig {
    url: string;
    db: string;
    email: string;
    password: string;
}

export class OdooRpc {
    private config: OdooConfig;

    constructor(config: OdooConfig) {
        this.config = config;
    }

    /**
     * Authenticates with Odoo and returns the user ID (uid).
     */
    public async authenticate(): Promise<number> {
        const url = `${this.config.url.replace(/\/$/, '')}/xmlrpc/2/common`;
        const payload = create({ version: '1.0' })
            .ele('methodCall')
            .ele('methodName').txt('authenticate').up()
            .ele('params')
            .ele('param').ele('value').ele('string').txt(this.config.db).up().up().up()
            .ele('param').ele('value').ele('string').txt(this.config.email).up().up().up()
            .ele('param').ele('value').ele('string').txt(this.config.password).up().up().up()
            .ele('param').ele('value').ele('struct').up().up().up()
            .up()
            .up()
            .end({ prettyPrint: true });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: payload
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.statusText}`);
        }

        const xml = await response.text();
        return this.parseUid(xml);
    }

    private parseUid(xml: string): number {
        const obj = create(xml).toObject() as any;
        const response = obj.methodResponse;

        if (response.fault) {
            const faultValue = this.unpackValue(response.fault.value);
            throw new Error(`Authentication failed: ${faultValue.faultString || 'Invalid credentials'}`);
        }

        if (response.params?.param?.value) {
            const val = this.unpackValue(response.params.param.value);
            if (typeof val === 'number') {
                return val;
            }
            if (!val) {
                throw new Error('Authentication failed: Invalid credentials.');
            }
        }

        throw new Error('Failed to parse authentication response.');
    }

    /**
     * Searches and reads records from a model.
     */
    public async browseRecord(uid: number, model: string, domain: any[], fields?: string[]): Promise<any[]> {
        const kwargs: any = {};
        if (fields) {
            kwargs.fields = fields;
        }
        return await this.call(uid, model, 'search_read', [domain], kwargs);
    }

    /**
     * Executes a method on a specific set of records.
     */
    public async functionCaller(uid: number, model: string, method: string, ids: number[], args: any[] = [], kwargs: any = {}): Promise<any> {
        const positionalArgs = [ids, ...args];
        return await this.call(uid, model, method, positionalArgs, kwargs);
    }

    /**
     * Executes a method on an Odoo model via execute_kw.
     */
    public async call(uid: number, model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
        const url = `${this.config.url.replace(/\/$/, '')}/xmlrpc/2/object`;

        const payload = create({ version: '1.0' })
            .ele('methodCall')
            .ele('methodName').txt('execute_kw').up()
            .ele('params')
            .ele('param').ele('value').ele('string').txt(this.config.db).up().up().up()
            .ele('param').ele('value').ele('int').txt(uid.toString()).up().up().up()
            .ele('param').ele('value').ele('string').txt(this.config.password).up().up().up()
            .ele('param').ele('value').ele('string').txt(model).up().up().up()
            .ele('param').ele('value').ele('string').txt(method).up().up().up()
            .ele('param').ele('value');

        this.serializeValue(payload, args);
        payload.up().up();

        const kwParam = payload.ele('param').ele('value');
        this.serializeValue(kwParam, kwargs);

        const finalPayload = payload.end({ prettyPrint: true });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: finalPayload
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.statusText}`);
        }

        const xml = await response.text();
        return this.parseResponse(xml);
    }

    private serializeValue(parent: any, value: any) {
        if (value === null || value === undefined) {
            parent.ele('boolean').txt('0');
        } else if (typeof value === 'string') {
            parent.ele('string').txt(value);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                parent.ele('int').txt(value.toString());
            } else {
                parent.ele('double').txt(value.toString());
            }
        } else if (typeof value === 'boolean') {
            parent.ele('boolean').txt(value ? '1' : '0');
        } else if (Array.isArray(value)) {
            const array = parent.ele('array').ele('data');
            value.forEach(item => {
                const val = array.ele('value');
                this.serializeValue(val, item);
            });
        } else if (typeof value === 'object') {
            const struct = parent.ele('struct');
            Object.entries(value).forEach(([k, v]) => {
                const member = struct.ele('member');
                member.ele('name').txt(k);
                const val = member.ele('value');
                this.serializeValue(val, v);
            });
        }
    }

    private parseResponse(xml: string): any {
        const obj = create(xml).toObject() as any;
        const response = obj.methodResponse;

        if (response.fault) {
            const faultValue = this.unpackValue(response.fault.value);
            throw new Error(`Odoo Fault: ${faultValue.faultString || JSON.stringify(faultValue)}`);
        }

        if (response.params?.param?.value) {
            return this.unpackValue(response.params.param.value);
        }

        return null;
    }

    private unpackValue(valueObj: any): any {
        if (!valueObj || typeof valueObj !== 'object') {
            return valueObj || '';
        }

        const keys = Object.keys(valueObj);
        if (keys.length === 0) return '';

        const type = keys[0];
        const content = valueObj[type];

        switch (type) {
            case 'int':
            case 'i4':
            case 'i8':
                return parseInt(content);
            case 'double':
                return parseFloat(content);
            case 'string':
                return typeof content === 'object' ? '' : content;
            case 'boolean':
                return content === '1' || content === 'true';
            case 'array':
                const data = content.data;
                if (!data || !data.value) return [];
                const values = Array.isArray(data.value) ? data.value : [data.value];
                return values.map((v: any) => this.unpackValue(v));
            case 'struct':
                const result: any = {};
                const members = Array.isArray(content.member) ? content.member : (content.member ? [content.member] : []);
                members.forEach((m: any) => {
                    if (m.name && m.value !== undefined) {
                        result[m.name] = this.unpackValue(m.value);
                    }
                });
                return result;
            case 'value':
                return this.unpackValue(content);
            case 'nil':
                return null;
            default:
                return content;
        }
    }
}
