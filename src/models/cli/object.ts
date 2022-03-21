import * as fs from 'fs';
import * as path from 'path';

import { commands, window } from 'vscode';

import { Nsi } from '../../Nsi';
import { NsiShellCommand } from '../../util/shellCommand';


/**
 * The SuiteCloud CLI object fields which are retrieved via the SDF CLI "suitecloud object:list" command.
 */
export class NsiCliObject {
	constructor(
		readonly type: string,
		readonly id: string,
	) {
	}
}


export class NsiCliObjects {
	private readonly _rootPath!: string;
	private readonly _indexPath!: string;
	private _objects: NsiCliObject[];
	private _shell: NsiShellCommand;
	private _deployFilePath;

	constructor(
		private nsi: Nsi
	) {
		this._rootPath = path.join(nsi.nsiProjectPath, 'SDF_CLI');
		this._indexPath = path.join(this._rootPath, 'index.json');
		this._objects = this.getObjects() || [];
		this._shell = new NsiShellCommand(this.nsi);
		if (this.nsi.sdfProjectPath) {
			this._deployFilePath = path.join(this.nsi.sdfProjectPath, 'deploy.xml');
		}
	}

	get indexPath(): string {
		return this._indexPath;
	}

	get objects(): NsiCliObject[] {
		return this._objects;
	}

	public resetObjs(): void {
		this._objects = [];
	}

	public async retrieveServerObjects(): Promise<NsiCliObject[]> {
		this.nsi.log(`NsiCliObjects.retrieveServerObjects() initiated.`);
		// retrieve suitecloud objects via "suitecloud object:list"
		const result = await this._shell.execute('suitecloud object:list');
		const resultArray = result.split('\n');
		// console.log(resultArray);
		// clear objects
		this._objects = [];
		// build new object
		resultArray.forEach(objectString => {
			this.addObject(objectString);
		});
		return this._objects;
	}

	public async importObject(objectId: string) {
		this.nsi.log(`NsiCliObjects.importObject(${objectId}) initiated.`);
		// import (update) object via "suitecloud object:import"
		const result = await this._shell.execute(`suitecloud object:import --type ALL --destinationfolder "/Objects" --scriptid ${objectId}`);
		console.log(result);
	}

	public async deployObject(objectId: string) {
		this.nsi.log(`NsiCliObjects.deployObject(${objectId}) initiated.`);
		if (this.saveDeployFile(objectId)) {
			// deploy object via "suitecloud project:deploy"
			const result = await this._shell.execute(`suitecloud project:deploy --accountspecificvalues ERROR`);
			console.log(result);
		}
	}

	public async verify(): Promise<void> {
		this.nsi.log(`NsiCliObjects.verify() initiated.`);
		window.showInformationMessage('SuiteDeploy verification initiated.');
		// retrieve objects via "suitecloud object:list"
		await this.nsi.retrieveServerObjects();
		// check every local file to see if deployed
		const localObjects = this.nsi.objectsClass.getObjects();
		let localDeployedIds: string[] = [];
		let deployedValues: {id: string, value: boolean}[] = [];
		localObjects && localObjects.forEach(object => {
			// this.nsi.log(`NsiCliObjects.verify() checking local object: ${object.id}.`);
			if (this.getObjectRecord(object.id)) {
				localDeployedIds.push(object.id);
				deployedValues.push({ id: object.id, value: true }); 
				this.nsi.log(`    DEPLOYED: ${object.id}.`);
			} else {
				deployedValues.push({ id: object.id, value: false }); 
				this.nsi.log(`NOT deployed: ${object.id}.`);
			}
		});
		if (deployedValues) {
			// update local objects to indicate if they are deployed are not
			this.nsi.objectsClass.updateObjectFields('deployed', deployedValues);
			// update (import) deployed local objects
			const importObjectIds = localDeployedIds.join(" ");
			this.nsi.log(`importing objects: "${importObjectIds}"`);
			const result = this._shell.execute(`suitecloud object:import --type ALL --destinationfolder "/Objects" --scriptid ${importObjectIds}`).then((result) => {
				const resultArray = result.split('\n');
				console.log(resultArray);
			});
		}
		// log and notify execution
		this.nsi.log(`NsiCliObjects.verify() finished.`);
		window.showInformationMessage('SuiteDeploy verification finished.');
	}

	private addObject(objectString: string) {
		// this.nsi.log(`NsiCliObjects.addObject(${objectString}) initiated.`);
		// if object is valid then add it
		if (objectString && objectString.length > 0) {
			const colonPosition = objectString.indexOf(':');
			if (colonPosition && objectString.length > (colonPosition + 1)) {
				// valid format
				// determine individual elements of string
				const objectType = objectString.substring(0, colonPosition);
				const objectId = objectString.substring(colonPosition + 1);
				// add SDF object to object array
				const object = new NsiCliObject(objectType, objectId);
				this._objects.push(object);
				// this.nsi.log(`NsiCliObjects.addObject() added ${objectType} ${objectId}`);
			} else {
				// invalid format
				this.nsi.log(`NsiCliObjects.addObject() skipping added since "${objectString}" invalid.`);
			}
		} else {
			this.nsi.log(`NsiCliObjects.addObject() skipping since not supplied valid string.`);
		}
	}

	public getObjects(): NsiCliObject[] | undefined {
		this.nsi.log(`NsiCliObjects.getObjects() initiated.`);
		if (this.objects === undefined || this.objects.length === 0) {
			const objectsFromFile = this.getIndexFromFile(this.indexPath);
			return objectsFromFile;
		} else {
			this.nsi.log(`NsiCliObjects.getObjects() returning "${this.getObjectCount()} objects"`);
			return this.objects;
		}
	}
	
	private getIndexFromFile(indexPath: string): NsiCliObject[] | undefined {
		this.nsi.log(`NsiCliObjects.getIndexFromFile(${indexPath}) initiated.`);
		if (fs.existsSync(indexPath)) {
			// load the index file
			const objectFileContents = fs.readFileSync(indexPath, 'utf-8');
			// convert index file contents into class
			const objectFile: NsiCliObject[] = JSON.parse(objectFileContents);
			return objectFile;
		} else {
			return undefined;
		}
	}
	
	public getObjectRecord(objectId: string): NsiCliObject | undefined {
		// this.nsi.log(`NsiCliObjects.getObjectRecord() initiated for "${objectId}"`);
		let result = undefined;
		let index = this._objects.findIndex(object => object.id === objectId);
		if (index && index > 0) {
			result = this._objects[index];
		}
		// this.nsi.log(`Nsi.getObjectRecord() returning "${JSON.stringify(result)}"`);
		return result;
	}

	public getObjectCount(): Number {
		return this._objects.length || 0;
	}

	public async createIndex(objects: NsiCliObject[]): Promise<void> {
		// this.nsi.log(`NsiCliObjects.createIndex() initiated.`);
		// save to file
		this.saveIndex(objects);
		// also save to memory
		this._objects = objects;
		// this.nsi.log(`NsiCliObjects.createIndex() finished.`);
	}

	public async initializeFolders(): Promise<void> {
		this.nsi.log(`NsiCliObjects.initializeFolders() initiated.`);
		// reset folder
		fs.rmSync(this._rootPath, { recursive: true, force: true });
		fs.mkdirSync(this._rootPath);
	}

	public async reset(): Promise<void> {
		this.nsi.log(`NsiCliObjects.reset() initiated.`);
		// clear the objects
		this.resetObjs();
		// reset the objs directory
		this.initializeFolders();
		this.nsi.log(`NsiCliObjects.reset() finished.`);
	}

	public saveIndex(objects: NsiCliObject[]): void {
		this.nsi.log(`NsiCliObjects.saveIndex() initiated.`);
		const content = { "objects": objects };
		const contentJSON = JSON.stringify(content);
		fs.writeFileSync(this._indexPath, contentJSON);
	}


	// HELPERS

	public saveDeployFile(objectId: string): boolean {
		this.nsi.log(`NsiCliObjects.saveDeployFile(${objectId}) initiated.`);
		if (this._deployFilePath) {
			const content = `<deploy><objects><path>~/Objects/${objectId}.xml</path></objects></deploy>`;
			fs.writeFileSync(this._deployFilePath, content);
			return true;
		} else {
			this.nsi.log(`NsiCliObjects.saveDeployFile() stopped since the workspace directory is not defined.`);
			return false;
		}
	}
}
