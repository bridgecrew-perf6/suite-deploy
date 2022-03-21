import { plainToInstance } from 'class-transformer';

import { Command, Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';

import { Nsi } from '../../Nsi';
import { NsiCliObject } from '../cli/object';

export class NsiObjTreeProvider implements TreeDataProvider<NsiObjTree> {
	private _onDidChangeTreeData: EventEmitter<NsiObjTree | undefined | void> = new EventEmitter<NsiObjTree | undefined | void>();
	readonly onDidChangeTreeData: Event<NsiObjTree | undefined | void> = this._onDidChangeTreeData.event;

	constructor(
		private nsi: Nsi
	) {
	}

	public refresh(): void {
		// this.nsi.log('NsiObjTreeProvider.refresh() initiated.');
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: NsiObjTree): TreeItem {
		return element;
	}
	
	getChildren(element?: NsiObjTree): Thenable<NsiObjTree[]> {
		return Promise.resolve(this.getObjs(element));
	}

	private async getObjs(element: NsiObjTree | undefined = undefined): Promise<NsiObjTree[]> {
		const result: NsiObjTree[] = [];
		const index = await this.nsi.cliObjectsClass.getObjects();
		if (index) {
			if (element) {
				// then add the objects for the selected element
				let selectedObjects: NsiCliObject[] = index.filter(object => object.type === element.id);  // add/verify type in object
				selectedObjects.forEach((selectedObject) => {
					const object = plainToInstance(NsiCliObject, selectedObject);
					// determine the appropriate command
					let clickCommand = 'nsi.jsonFile';
					let clickFile = 'TBD';
					// determine the appropriate tree context value
					let context = 'obj';
					// build the tool tip
					let tooltip = `${object.type}  (id: ${object.id})`;
					// add the item to the tree
					result.push(
						new NsiObjTree(
							object.id,
							TreeItemCollapsibleState.None, 
							object.id,
							'',
							tooltip,
							{
								command: clickCommand,
								title: '',
								arguments: [clickFile]
							},
							context,
						)
					);
				});
			} else {
				// INITIAL LOAD
				// add index first
				result.push(
					new NsiObjTree(
						'INDEX',
						TreeItemCollapsibleState.None, 
						'index',
						'',
						'Main index.',
						{
							command: 'nsi.openFile',
							title: '',
							arguments: [this.nsi.cliObjectsClass.indexPath]
						},
						'index',
					)
				);
				// then add all the object types
				const objectTypes = [...new Set(index.map(objects => objects.type))];
				if (objectTypes) {
					// sort object types
					objectTypes.sort();
					// loop thru object types
					objectTypes.forEach(objectType => {
						// determine the appropriate command
						let clickCommand = 'NsiObjs.jsonFile';
						let clickFile = '';
						let context = 'objType';
						// build the tool tip
						let tooltip = `${objectType}`;
						// add the item to the tree
						result.push(
							new NsiObjTree(
								objectType,
								TreeItemCollapsibleState.Collapsed,
								objectType,
								'',
								objectType,
								{
									command: clickCommand,
									title: '',
									arguments: [clickFile]
								},
								context,
							)
						);
					});
				}
			}
		}
		return result;
	}
}

export class NsiObjTree extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly id: string,
		public readonly description: string,
		public readonly tooltip: string,
		public readonly command: Command,
		public readonly contextValue: string,
	) {
		super(
			label,
			collapsibleState
		);
		this.id = id,
		this.description = description,
		this.tooltip = tooltip,
		this.command = command,
		this.contextValue = contextValue;
	}
}
