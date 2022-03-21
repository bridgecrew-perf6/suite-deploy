import * as cp from "child_process";

import { window } from 'vscode';

import { Nsi } from '../Nsi';

export class NsiShellCommand {
	private _process: any;

	constructor(
		private nsi: Nsi
	) {
	}

	public async execute(command: string, cwd: string | undefined = undefined): Promise<string> {
		this.nsi.log(`ShellCommand.execute(${command}, ${cwd}) initiated.`);
		if (this._process) {
			// let user know that there is already a process running
			window.showInformationMessage('Skipping since there is an active process currently executing.');
			return '';
		} else {
			const result = await this.exec(command);
			// this.nsi.log(result);
			this._process = null;
			return result;
		}
	}

	private exec(command:string, cwd: string | undefined = undefined): Promise<string>{
		this.nsi.log(`ShellCommand.exec(${command}, ${cwd}) initiated.`);
		if (!cwd && this.nsi.workspacePath) {
			cwd = this.nsi.workspacePath;
		}
		return new Promise<string>((resolve, reject) => {
				cp.exec(command, { cwd: cwd }, (err, out) => {
					if (err) {
						reject(err);
					}
					return resolve(out);
				});
			});
	}
}
