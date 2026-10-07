import { FileSystemNode } from "../../../../utils/utils";

/** Files of one POS extension, added to the `point_of_sale._assets_pos` bundle. */
export function posAssetFiles(screenFolder: string, files: { name: string, content: string }[]): FileSystemNode[] {
    return [{
        type: 'folder', name: 'static', doNotExist: false, children: [{
            type: 'folder', name: 'src', doNotExist: false, children: [{
                type: 'folder', name: 'app', doNotExist: false, children: [{
                    type: 'folder', name: 'screens', doNotExist: false, children: [{
                        type: 'folder', name: screenFolder, doNotExist: true,
                        children: files.map(file => ({
                            type: 'file',
                            name: file.name,
                            content: file.content,
                            updateManifest: true,
                            manifestCategory: 'asset',
                            assetCategory: 'pos',
                            depends: ['point_of_sale'],
                        })),
                    }],
                }],
            }],
        }],
    }];
}
