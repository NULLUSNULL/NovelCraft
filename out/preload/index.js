let electron = require("electron");
// src/preload/index.ts
electron.contextBridge.exposeInMainWorld("novelcraft", {
	getAppInfo: () => electron.ipcRenderer.invoke("app:info"),
	listProjects: () => electron.ipcRenderer.invoke("projects:list"),
	createProject: (project) => electron.ipcRenderer.invoke("projects:create", project),
	getProject: (id) => electron.ipcRenderer.invoke("projects:get", id),
	openProject: (id) => electron.ipcRenderer.invoke("projects:open", id),
	saveProject: (project) => electron.ipcRenderer.invoke("projects:save", project),
	deleteProject: (id) => electron.ipcRenderer.invoke("projects:delete", id),
	importProject: () => electron.ipcRenderer.invoke("projects:import"),
	exportProject: (id) => electron.ipcRenderer.invoke("projects:export", id),
	revealProject: (id) => electron.ipcRenderer.invoke("projects:reveal", id),
	createBackup: (id) => electron.ipcRenderer.invoke("backups:create", id),
	listBackups: (id) => electron.ipcRenderer.invoke("backups:list", id),
	restoreBackup: (id, backupId) => electron.ipcRenderer.invoke("backups:restore", id, backupId),
	deleteBackup: (id, backupId) => electron.ipcRenderer.invoke("backups:delete", id, backupId),
	listSnapshots: (id, documentId) => electron.ipcRenderer.invoke("snapshots:list", id, documentId),
	createSnapshot: (id, documentId) => electron.ipcRenderer.invoke("snapshots:create", id, documentId),
	deleteSnapshot: (id, documentId, snapshotId) => electron.ipcRenderer.invoke("snapshots:delete", id, documentId, snapshotId),
	getSettings: () => electron.ipcRenderer.invoke("settings:get"),
	saveSettings: (settings) => electron.ipcRenderer.invoke("settings:save", settings),
	listModels: (providerId) => electron.ipcRenderer.invoke("ai:models", providerId),
	testProvider: (providerId, provider) => electron.ipcRenderer.invoke("ai:test", providerId, provider),
	aiChat: (request) => electron.ipcRenderer.invoke("ai:chat", request),
	aiComplete: (request) => electron.ipcRenderer.invoke("ai:complete", request),
	cancelAi: (requestId) => electron.ipcRenderer.invoke("ai:cancel", requestId),
	onAiStream: (callback) => {
		const listener = (_event, data) => callback(data);
		electron.ipcRenderer.on("ai:stream", listener);
		return () => electron.ipcRenderer.removeListener("ai:stream", listener);
	},
	exportManuscript: (payload) => electron.ipcRenderer.invoke("export:manuscript", payload),
	minimizeWindow: () => electron.ipcRenderer.invoke("window:minimize"),
	setUiScale: (factor) => electron.webFrame.setZoomFactor(Math.min(2, Math.max(.5, factor))),
	maximizeWindow: () => electron.ipcRenderer.invoke("window:maximize"),
	closeWindow: () => electron.ipcRenderer.invoke("window:close"),
	setWindowDirty: (dirty) => electron.ipcRenderer.send("window:dirty", dirty),
	onBeforeClose: (callback) => {
		const listener = () => callback();
		electron.ipcRenderer.on("app:before-close", listener);
		return () => electron.ipcRenderer.removeListener("app:before-close", listener);
	},
	closeReady: () => electron.ipcRenderer.send("app:close-ready"),
	openExternal: (url) => electron.ipcRenderer.invoke("app:open-external", url)
});
