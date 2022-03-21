import { plainToInstance } from 'class-transformer';
import * as fs from 'fs';
import * as path from 'path';
import { parseString } from 'xml2js';

import { window } from 'vscode';

import { Nsi } from '../Nsi';

export class NsiObjectIndex {
	constructor(
		readonly type: string,
		readonly id: string,
		readonly xmlFile: string,
		readonly jsonFile: string,
		public deployed?: boolean
	) {
		this.type = type;
		this.id = id;
		this.xmlFile = xmlFile;
		this.jsonFile = jsonFile;
		this.deployed = deployed;
	}
}
interface NsiObjectSourceInterface {
	readonly scriptid: string;
}

export class NsiObjectFile extends NsiObjectIndex {
	constructor(
		type: string,
		id: string,
		xmlFile: string,
		jsonFile: string,
	) {
		super(
			type,
			id,
			xmlFile,
			jsonFile,
		);
	}
}

export class NsiIndex {
	constructor(
		readonly objects: NsiObjectIndex[]
	) {
		this.objects = objects;
	}
}

export class NsiObjects {
	private readonly _rootPath!: string;
	private readonly _indexPath!: string;
	private _objects: NsiObjectIndex[];

	constructor(
		private nsi: Nsi
	) {
		this._rootPath = path.join(nsi.nsiProjectPath, 'Objects');
		this._indexPath = path.join(this._rootPath, 'index.json');
		this._objects = this.getObjects() || [];
	}

	get indexPath(): string {
		return this._indexPath;
	}

	public getObjects(): NsiObjectIndex[] | undefined {
		this.nsi.log(`NsiObjects.getObjects() initiated`);
		if (this._objects === undefined || this._objects.length === 0) {
			const objectsFromFile = this.getIndexFromFile();
			if (objectsFromFile) {
				return objectsFromFile.objects;
			} else {
				return undefined;
			}
		} else {
			return this._objects;
		}
	}

	public getObjectRecord(scriptId: string): NsiObjectIndex | undefined {
		// this.nsi.log(`Nsi.getObjectRecord() initiated for "${scriptId}"`);
		let result = undefined;
		let index = this._objects.findIndex(object => object.id === scriptId);
		if (index && index > 0) {
			result = this._objects[index];
		}
		this.nsi.log(`Nsi.getObjectRecord() returning "${this.getObjectCount()} objects"`);
		return result;
	}

	public getObjectCount(): Number {
		return this._objects.length || 0;
	}

	 public resetObjects(): void {
		this._objects = [];
	}

	public addObject(objectIndex: NsiObjectIndex) {
		this.nsi.log(`NsiObjects.addObject() initiated for "${objectIndex.id}".`);
		this._objects.push(objectIndex);
	}

	public updateObjectFields(field: string, values: {id: string, value: any}[]) {
		this.nsi.log(`NsiObjects.updateObjectFields() initiated for field: "${field}".`);
		// update each value if corresponding id is found
		values.forEach(element => {
			let objIndex = this._objects.findIndex((obj => obj.id === element.id));
			switch (field) {
				case 'deployed':
					this._objects[objIndex].deployed = element.value;
					break;
				default:
					this.nsi.error(`Unexpected field value of "${field}" was supplied to NsiJsons.updateObjectFields`);
				return;
			}
		});
		// save updated object values to file
		this.createIndex(this._objects);
	}

	public async createObjects(): Promise<void> {
		this.nsi.log(`NsiObjects.createObjects() initiated.`);
		// clear objects index
		this.resetObjects();
		// create object files
		this.createObjectFiles();
	}

	private async createObjectFiles() {
		this.nsi.log(`NsiObjects.createObjectFiles() initiated.`);
		const fsSrcDir = fs.readdirSync(this.nsi.sdfObjectsPath, 'utf-8');
		await fsSrcDir.forEach(srcFileName => {
			const srcFile = path.join(this.nsi.sdfObjectsPath, srcFileName);
			if (path.extname(srcFileName) === '.xml') {
				const destFileName = path.parse(srcFileName).name + '.json';
				const destFile = path.join(this._rootPath, destFileName);
				this.createObjectFile(srcFile, destFile);
			} else {
				this.nsi.log(`NsiObjects.createObjectFiles - UNEXPECTED FILE: ${srcFile}`);
			}
		});
	}

	public async createObjectFile(srcXmlFile: string, destJsonFile: string): Promise<void> {
		// this.nsi.log(`NsiObjects.createObjectFile() initiated for "${srcXmlFile}".`);
		if (fs.existsSync(srcXmlFile)) {
			// load the SDF Object file (XML format)
			const srcText = fs.readFileSync(srcXmlFile, 'utf-8');
			// use xml2js (https://www.npmjs.com/package/xml2js) parseString() function to convert XML into JSON
			let origJson = {} as any;
			parseString(srcText, { mergeAttrs: true, explicitArray: false }, function (err, result) {
				origJson = result;
			});
			// build object
			const type: string = Object.keys(origJson)[0];
			const scriptId: string = origJson[type]['scriptid'];
			const objectFile = new NsiObjectFile(
				type,
				scriptId,
				srcXmlFile,
				destJsonFile,
			);
			// add the object to the index
			this.addObject(objectFile);
			// save JSON to destination file
			const destText = JSON.stringify(objectFile);
			fs.writeFileSync(destJsonFile, destText);
		} else {
			this.nsi.error(`NsiObjects.createObjectFile() could not load file ${srcXmlFile}.`);
			window.showErrorMessage(`NsiObjects.createObjectFile() could not load file ${srcXmlFile}.`);
		}
	}

	public async createIndex(objects: NsiObjectIndex[] | undefined): Promise<void> {
		// this.nsi.log(`NsiObjects.createIndex() initiated.`);
		// save to file
		this.saveIndex(objects);
		// also save to memory
		if (objects) {
			this._objects = objects;
		} else {
			this._objects = [];
		}
		// this.nsi.log(`NsiObjects.createIndex() finished.`);
	}

	public async initializeFolders(): Promise<void> {
		this.nsi.log(`NsiObjects.initializeFolders() initiated.`);
		// reset folder
		fs.rmSync(this._rootPath, { recursive: true, force: true });
		fs.mkdirSync(this._rootPath);
	}

	public async reset(): Promise<void> {
		this.nsi.log(`NsiObjects.reset() initiated.`);
		// clear the objects
		this.resetObjects();
		// reset the objects directory
		this.initializeFolders();
		this.nsi.log(`NsiObjects.reset() finished.`);
	}

	 public getIndexFromFile(): NsiIndex | undefined {
		this.nsi.log(`NsiObjects.getIndexFromFile() initiated.`);
		if (fs.existsSync(this._indexPath)) {
			// load the index file
			const indexFileContents = fs.readFileSync(this._indexPath, 'utf-8');
			// convert index file contents into class
			const index: NsiIndex = JSON.parse(indexFileContents);
			const indexClass = plainToInstance(NsiIndex, index);
			return indexClass;
		} else {
			return undefined;
		}
	}

	public saveIndex(objects: NsiObjectIndex[] | undefined): void {
		this.nsi.log(`NsiObjects.saveIndex() initiated.`);
		const content = { "objects": objects };
		const contentJSON = JSON.stringify(content);
		fs.writeFileSync(this._indexPath, contentJSON);
	}
}