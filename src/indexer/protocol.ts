import type { ParsedPythonFile } from '../parsing/python';
import type { ParsedRegistryCall } from '../parsing/javascript';
import type { XmlEntry } from '../parsing/xml';

/** Whole-millisecond modification time and size: what decides whether a file is parsed again. */
export interface FileMetadata {
    mtime: number;
    size: number;
}

export type FileKind = 'manifest' | 'python' | 'javascript' | 'css' | 'xml';

export interface FileRequest {
    path: string;
    kind: FileKind;
    /** Metadata from the last time the file was parsed; the file is skipped while it still matches. */
    meta?: FileMetadata;
}

export type FileResult =
    | { path: string; status: 'unchanged' }
    | { path: string; status: 'missing' }
    | { path: string; status: 'error'; message: string }
    | {
        path: string;
        status: 'parsed';
        meta: FileMetadata;
        /** Name of the Odoo module the file is in; absent when it is in none. */
        module?: string;
        /** Module folder (the folder holding `__manifest__.py`). */
        moduleRoot?: string;
        manifest?: { depends: string[] };
        python?: ParsedPythonFile;
        registry?: ParsedRegistryCall[];
        css?: [string, number][];
        xml?: XmlEntry[];
    };

export interface ProcessMessage {
    id: number;
    type: 'process';
    items: FileRequest[];
}

export interface InitMessage {
    type: 'init';
    extensionPath: string;
}

export type WorkerResponse =
    | { id: number; ok: true; results: FileResult[] }
    | { id: number; ok: false; error: string };
