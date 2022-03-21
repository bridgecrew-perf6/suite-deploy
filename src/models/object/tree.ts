import { Command, Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';

import { Nsi } from '../../Nsi';

export class NsiObjectTreeProvider implements TreeDataProvider<NsiObjectTree> {
	private _onDidChangeTreeData: EventEmitter<NsiObjectTree | undefined | void> = new EventEmitter<NsiObjectTree | undefined | void>();
	readonly onDidChangeTreeData: Event<NsiObjectTree | undefined | void> = this._onDidChangeTreeData.event;

	constructor(
		private nsi: Nsi
	) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: NsiObjectTree): TreeItem {
		return element;
	}
	
	getChildren(element?: NsiObjectTree): Thenable<NsiObjectTree[]> {
		return Promise.resolve(this.getObjects(element));
	}

	private async getObjects(element: NsiObjectTree | undefined = undefined): Promise<NsiObjectTree[]> {
		const result: NsiObjectTree[] = [];
		const index = await this.nsi.objectsClass.getObjects();
		if (index) {
			if (element) {
				// add the objects for the selected element
				const selectedObjects = index.filter(object => object.type === element.id);
				selectedObjects.forEach((object) => {
					// determine the appropriate command
					let clickCommand = 'nsi.openFile';
					let clickFile = object.xmlFile;
					// determine the appropriate tree context value
					let context = 'object'; // inline JSON and XML buttons
					// build the tool tip
					let tooltip = `${object.type}  (id: ${object.id})`;
					// build the object label
					let objectLabel = object.id;
					// add deployed / undeployed prefixes
					if (object.deployed === true) {
						tooltip = '(DEPLOYED) ' + objectLabel;
						objectLabel = '(D) ' + objectLabel;
					}
					if (object.deployed === false) {
						tooltip = '(Undeployed) ' + objectLabel;
						objectLabel = '(Undeployed) ' + objectLabel;
					}
					// add the item to the tree
					result.push(
						new NsiObjectTree(
							objectLabel,
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
							object.xmlFile,
							object.jsonFile
						)
					);
				});
			} else {
				// INITIAL LOAD
				// add index first
				result.push(
					new NsiObjectTree(
						'INDEX',
						TreeItemCollapsibleState.None, 
						'index',
						'',
						'Main index.',
						{
							command: 'nsi.openFile',
							title: '',
							arguments: [this.nsi.objectsClass.indexPath]
						},
						'index',
						'',
						this.nsi.objectsClass.indexPath,
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
							new NsiObjectTree(
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
								'',
								'',
							)
						);
					});
				}
			}
		}
		return result;
	}
}

export class NsiObjectTree extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly id: string,
		public readonly description: string,
		public readonly tooltip: string,
		public readonly command: Command,
		public readonly contextValue: string,
		public readonly xmlFile: string,
		public readonly jsonFile: string,
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
		this.xmlFile = xmlFile;
		this.jsonFile = jsonFile;
	}
}
