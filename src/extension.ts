'use strict';

import { commands, ExtensionContext, Uri, window } from 'vscode';

import { NsiObjTree, NsiObjTreeProvider } from './models/obj/tree';
import { NsiObjectTree, NsiObjectTreeProvider } from './models/object/tree';
import { Nsi } from './Nsi';

export function activate(context: ExtensionContext) {
	// load main NSI model
	const nsi = new Nsi(context);

	// register the "Open Output" command
	context.subscriptions.push(commands.registerCommand('nsi.openOutput', () => {
		nsi.outputChannel.show(); 
	}));

	// register the reset command
	context.subscriptions.push(commands.registerCommand('nsi.reset', () => { nsi.reset(); }));

	// register the open file command
	commands.registerCommand('nsi.openFile', path => {
		commands.executeCommand('vscode.open', Uri.parse(`${path}`))
		.then(() => commands.executeCommand('editor.action.formatDocument'));
	});

	// LOCAL (objects) functionality
	
		// register the "generate objects command
		context.subscriptions.push(commands.registerCommand('nsi.processLocalObjects', () => { nsi.processLocalObjects(); }));

	// register the Object (local) Tree
	const objectTreeProvider = new NsiObjectTreeProvider(nsi);
	window.registerTreeDataProvider('nsiObjects', objectTreeProvider);
	commands.registerCommand('nsiObjects.verify', () => nsi.verify());
	commands.registerCommand('nsiObjects.refresh', () => objectTreeProvider.refresh());
	commands.registerCommand('nsiObjects.reset', () => nsi.processLocalObjects());
	commands.registerCommand('nsiObjects.jsonFile', (node: NsiObjectTree) => {
		commands.executeCommand('vscode.open', Uri.parse(`${node.jsonFile}`))
		.then(() => commands.executeCommand('editor.action.formatDocument'));
	});
	commands.registerCommand('nsiObjects.deployObject', (node: NsiObjTree) => {
		nsi.deployObject(node.id);
	});
	commands.registerCommand('nsiObjects.xmlFile', (node: NsiObjectTree) => commands.executeCommand('vscode.open', Uri.parse(`${node.xmlFile}`)));


	// SERVER (objs) functionality

	// register the "retrieve objects command ("suitecloud object:list")
	context.subscriptions.push(commands.registerCommand('nsi.retrieveServerObjects', () => { nsi.retrieveServerObjects(); }));

	// register the Obj (server) Tree
	const objTreeProvider = new NsiObjTreeProvider(nsi);
	window.registerTreeDataProvider('nsiObjs', objTreeProvider);
	commands.registerCommand('nsiObjs.refresh', () => objTreeProvider.refresh());
	commands.registerCommand('nsiObjs.reset', () => nsi.retrieveServerObjects());
	commands.registerCommand('nsiObjs.importObject', (node: NsiObjTree) => {
		nsi.importObject(node.id);
	});
}

export function deactivate() {}
