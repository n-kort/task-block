import { Plugin, TFile } from 'obsidian';
import { migrateLegacyFields } from './model/tasks';

async function migrateFile(plugin: Plugin, file: TFile | null): Promise<void> {
	if (!file || file.extension !== 'md') return;
	const content = await plugin.app.vault.cachedRead(file);
	if (migrateLegacyFields(content) === content) return;
	await plugin.app.vault.process(file, migrateLegacyFields);
}

export function registerMigration(plugin: Plugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-open', (file) => void migrateFile(plugin, file)),
	);
	plugin.app.workspace.onLayoutReady(
		() => void migrateFile(plugin, plugin.app.workspace.getActiveFile()),
	);
}
