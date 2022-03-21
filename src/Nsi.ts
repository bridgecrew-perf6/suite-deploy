import * as fs from 'fs';
import * as path from 'path';

import { commands, ExtensionContext, OutputChannel, StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';

import { NsiObjects } from './models/objects';
import { NsiCliObjects } from './models/cli/object';

export class Nsi {
	private readonly _context: ExtensionContext;
	private readonly _outputChannel: OutputChannel;
	private readonly _statusBar: StatusBarItem;
	private readonly _workspacePath: string | undefined;
	private readonly _sdfProjectPath!: string;						// the SDF Project path (default is "./src")
	private readonly _sdfObjectsPath!: string;						// the SDF Objects path (e.g. "./src/Objects")
	private readonly _nsiProjectPath!: string;						// the SuiteDeploy Project path (e.g. "./src/SuiteDeploy")
	private readonly _cliObjectsClass: NsiCliObjects;
	private readonly _objectsClass: NsiObjects;
	
	constructor(
		context: ExtensionContext
	) {
		this._context = context;
		this._outputChannel = window.createOutputChannel('SuiteDeploy');
		this._statusBar = this.initializeStatusBar();
		this._workspacePath = (workspace.workspaceFolders && (workspace.workspaceFolders.length > 0)) ? workspace.workspaceFolders[0].uri.fsPath : undefined;
		if (this._workspacePath) {
			this._sdfProjectPath = path.join(this._workspacePath, 'src');
			this._sdfObjectsPath = path.join(this._sdfProjectPath, 'Objects');
			this._nsiProjectPath = path.join(this._sdfProjectPath, 'SuiteDeploy');
		}
		this._cliObjectsClass = new NsiCliObjects(this);
		this._objectsClass = new NsiObjects(this);
	}

	get context(): ExtensionContext {
		return this._context;
	}

	get outputChannel(): OutputChannel {
		return this._outputChannel;
	}

	get extensionPath(): string {
		return this._context.extensionPath ?? '';
	}

	get workspacePath(): string | undefined {
		return this._workspacePath;
	}

	get sdfProjectPath(): string | undefined {
		return this._sdfProjectPath;
	}

	get sdfObjectsPath(): string {
		return this._sdfObjectsPath;
	}

	get nsiProjectPath(): string {
		return this._nsiProjectPath;
	}

	get cliObjectsClass(): NsiCliObjects {
		return this._cliObjectsClass;
	}

	get objectsClass(): NsiObjects {
		return this._objectsClass;
	}

	public processLocalObjects(): void {
		this.log('Nsi.processLocalObjects() initiated.');
		// reset objects
		this._objectsClass.reset();
		// retrieve objects
		this.initializeFolders()
		.then(() => this._objectsClass.createObjects())
		.then(() => {
			// save local object values to file
			this._objectsClass.createIndex(this._objectsClass.getObjects());
			// update the status bar
			this.updateStatusBar();
			// refresh the objects view
			commands.executeCommand('nsiObjects.refresh');
			this.log('Nsi.processLocalObjects() finished');
			window.showInformationMessage('SuiteDeploy has processed local objects.');
		})
		.catch(error => this.error('Nsi.processLocalObjects() Error: ' + error.message));
	}

	public retrieveServerObjects(): void {
		window.showInformationMessage('SuiteDeploy retrieve objects has been triggered.');
		this.log('Nsi.retrieveServerObjects() initiated.');
		// reset objects
		this._cliObjectsClass.reset();
		// retrieve objects
		this._cliObjectsClass.retrieveServerObjects()
		.then((objects) => {
			// save server object values to file
			this._cliObjectsClass.createIndex(objects);
			// update the status bar
			this.updateStatusBar();
			// refresh the server objects view
			commands.executeCommand('nsiObjs.refresh');
			// show completed
			this.log(`Nsi.retrieveServerObjects() finished.`);
			window.showInformationMessage('SuiteDeploy retrieve objects has finished.');
		})
		.catch(error => this.error('Nsi.retrieveServerObjects() Error: ' + error.message));
	}

	public importObject(objectId: string): void {
		window.showInformationMessage(`SuiteDeploy import object "${objectId}" has been triggered.`);
		this.log(`Nsi.importObject(${objectId}) initiated.`);
		// retrieve objects
		this._cliObjectsClass.importObject(objectId)
		.then(() => {
			// refresh view
			this.processLocalObjects();
			// show completed
			this.log(`Nsi.importObject() finished.`);
			window.showInformationMessage('SuiteDeploy retrieve objects has finished.');
		})
		.catch(error => this.error('Nsi.importObject() Error: ' + error.message));
	}

	public deployObject(objectId: string): void {
		window.showInformationMessage(`SuiteDeploy deploy object "${objectId}" has been triggered.`);
		this.log(`Nsi.deployObject(${objectId}) initiated.`);
		// retrieve objects
		this._cliObjectsClass.deployObject(objectId)
		.then(() => {
			// show completed
			this.log(`Nsi.deployObject() finished.`);
			window.showInformationMessage('SuiteDeploy deploy object has finished.');
		})
		.catch(error => this.error('Nsi.deployObject() Error: ' + error.message));
	}

	public verify(): void {
		this._cliObjectsClass.verify().then(() => {
			// refresh the objects view
			commands.executeCommand('nsiObjects.refresh');
		});
	}

	private initializeStatusBar(): StatusBarItem {
		let statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 1);
		statusBar.command = 'nsi.openOutput';
		statusBar.tooltip = 'SuiteDeploy';
		statusBar.text = 'SuiteDeploy';
		// show
		statusBar.show();

		return statusBar;
	}

	public updateStatusBar(): void {
		let statusBarText = 'SuiteDeploy';
		const localObjectCount = this._objectsClass.getObjectCount();
		const serverObjecCount = this._cliObjectsClass.getObjectCount();
		if (serverObjecCount) {
			statusBarText += ` ${localObjectCount} / ${serverObjecCount}`;
		} else {
			statusBarText += ` ${localObjectCount}`;
		}
		this._statusBar.text = statusBarText;
	}

	public reset(): void {
		this.log(`Nsi.reset() initiated.`);
		// reset the objects
		this._objectsClass.reset();
		this._cliObjectsClass.reset();
		// remove the whole SuiteDeploy directory
		fs.rmSync(this._nsiProjectPath, { recursive: true, force: true });
		// refresh the object views
		commands.executeCommand('nsiObjects.refresh');
		commands.executeCommand('nsiObjs.refresh');
		// update the status bar
		this.updateStatusBar();
		// log and notify execution
		this.log(`Nsi.reset() finished.`);
		window.showInformationMessage('SuiteDeploy has been reset.');
	}

	public resetNsiObjects(): void {
		this.log(`Nsi.resetNsiObjects() initiated.`);
		// reset the objects
		this._objectsClass.reset();
		// refresh the objects view
		commands.executeCommand('nsiObjects.refresh');
		// update the status bar
		this.updateStatusBar();
		// log and notify execution
		this.log(`Nsi.resetNsiObjects() finished.`);
		window.showInformationMessage('NetSuite local objects have been refreshed.');
	}

	public resetNsiObjs(): void {
		this.log(`Nsi.resetNsiObjs() initiated.`);
		// reset the objs
		this._cliObjectsClass.reset();
		// refresh the objs view
		commands.executeCommand('nsiObjs.refresh');
		// update the status bar
		this.updateStatusBar();
		// log and notify execution
		this.log(`Nsi.resetNsiObjs() finished.`);
		window.showInformationMessage('NetSuite server objects have been refreshed.');
	}

	private async initializeFolders(): Promise<void> {
		this.log(`Nsi.initializeFolders() initiated.`);
		// create the SuiteDeploy's project root folder if it does not exist
		if (!this.isDirectory(this._nsiProjectPath)) {
				// create empty SuiteDeploy folder
				fs.mkdirSync(this._nsiProjectPath);
		};
		this._cliObjectsClass.initializeFolders();
		this._objectsClass.initializeFolders();
	}


	// HELPERS

	public log(message: string): void {
		console.log(message);
		// and add to output channel
		this.addToOutput(message);
	}

	public error(message: string): void {
		console.error(message);
		// and add to output channel
		this.addToOutput(`ERROR - ${message}`);
		this.outputChannel.show();
	}

	private addToOutput(message: string): OutputChannel {
		const title = new Date().toLocaleString();
		this.outputChannel.appendLine(`[${title}] ${message}`);
		return this.outputChannel;
  }

	public isDirectory(path: string, logAsError: boolean = false): boolean {
		const result = fs.existsSync(path);
		if (!result) {
			if (logAsError) {
				this.error(`Path ${path} does not exist.`);
			} else {
				this.log(`Path ${path} does not exist.`);
			}
		}
		return result;
	}
}
