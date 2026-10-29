// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let electron = require("electron");
let node_path = require("node:path");
node_path = __toESM(node_path);
let adm_zip = require("adm-zip");
adm_zip = __toESM(adm_zip);
let node_fs = require("node:fs");
let node_crypto = require("node:crypto");
let node_os = require("node:os");
node_os = __toESM(node_os);
var DEFAULT_SETTINGS = {
	general: {
		theme: "dark",
		accentColor: "sage",
		uiScale: 100,
		tourCompleted: false,
		reopenLastProject: true,
		showWordCount: true,
		animations: true,
		autosaveSeconds: 2,
		language: "es"
	},
	editor: {
		fontFamily: "serif",
		fontSize: 19,
		lineHeight: 1.8,
		maxWidth: 760,
		spellcheck: true,
		focusDim: false
	},
	ai: {
		enabled: true,
		selectionActions: true,
		activeProviderId: "ollama-local",
		includeManuscript: true,
		includeCodex: true,
		includePlots: true,
		includeSceneContent: false
	},
	backups: {
		snapshotsEnabled: true,
		snapshotLimit: 40,
		autoBackupMinutes: 30,
		backupLimit: 20,
		backupOnExit: true,
		trashRetentionDays: 30
	},
	providers: [
		{
			id: "ollama-local",
			name: "Ollama",
			protocol: "ollama",
			category: "local",
			baseUrl: "http://localhost:11434",
			model: "llama3.2",
			temperature: .7,
			maxTokens: 2048
		},
		{
			id: "lmstudio-local",
			name: "LM Studio",
			protocol: "openai",
			category: "local",
			baseUrl: "http://localhost:1234/v1",
			model: "local-model",
			temperature: .7,
			maxTokens: 2048
		},
		{
			id: "openai-cloud",
			name: "OpenAI",
			protocol: "openai",
			category: "cloud",
			baseUrl: "https://api.openai.com/v1",
			model: "gpt-4.1-mini",
			temperature: .7,
			maxTokens: 2048
		},
		{
			id: "anthropic-cloud",
			name: "Anthropic",
			protocol: "anthropic",
			category: "cloud",
			baseUrl: "https://api.anthropic.com",
			model: "claude-sonnet-4-5",
			temperature: .7,
			maxTokens: 2048
		}
	]
};
// src/shared/project.ts
function makeId(prefix = "id") {
	const cryptoObject = globalThis.crypto;
	if (cryptoObject?.randomUUID) return `${prefix}_${cryptoObject.randomUUID()}`;
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function nowIso() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
function stripHtml(html) {
	return html.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<\/h[1-6]>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
// src/main/storage.ts
var cachedBaseDir = "";
var migrationPromise = null;
function getBaseDir() {
	if (cachedBaseDir) return cachedBaseDir;
	cachedBaseDir = process.env.NOVELCRAFT_DATA_DIR || node_path.default.join(electron.app.getPath("userData"), "data");
	return cachedBaseDir;
}
function getProjectsDir() {
	if (process.env.NOVELCRAFT_DATA_DIR) return node_path.default.join(getBaseDir(), "projects");
	return node_path.default.join(electron.app.getPath("documents"), "NovelCraft");
}
async function moveProjectDir(source, destination) {
	try {
		await node_fs.promises.rename(source, destination);
	} catch {
		await node_fs.promises.cp(source, destination, { recursive: true });
		await node_fs.promises.rm(source, {
			recursive: true,
			force: true
		});
	}
}
async function migrateProjectsLocation() {
	const targetRoot = getProjectsDir();
	const legacyRoot = node_path.default.join(getBaseDir(), "projects");
	if (node_path.default.resolve(legacyRoot) !== node_path.default.resolve(targetRoot) && await pathExists(legacyRoot)) {
		const entries = await node_fs.promises.readdir(legacyRoot, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const source = node_path.default.join(legacyRoot, entry.name);
			const destination = node_path.default.join(targetRoot, entry.name);
			if (await pathExists(destination)) continue;
			await moveProjectDir(source, destination).catch(() => void 0);
		}
		await node_fs.promises.rmdir(legacyRoot).catch(() => void 0);
	}
	const library = await readJson(getLibraryFile(), []);
	if (!Array.isArray(library) || !library.length) return;
	let changed = false;
	for (const item of library) {
		const targetPath = node_path.default.join(targetRoot, item.id);
		if (await pathExists(node_path.default.join(targetPath, "project.json"))) {
			if (item.path !== targetPath) {
				item.path = targetPath;
				changed = true;
			}
			continue;
		}
		if (item.path && item.path !== targetPath && await pathExists(node_path.default.join(item.path, "project.json"))) {
			await moveProjectDir(item.path, targetPath).catch(() => void 0);
			if (await pathExists(node_path.default.join(targetPath, "project.json"))) {
				item.path = targetPath;
				changed = true;
			}
		}
	}
	if (changed) await writeJsonAtomic(getLibraryFile(), library);
}
function getProjectDir(projectId) {
	assertSafeId(projectId);
	return node_path.default.join(getProjectsDir(), projectId);
}
function getProjectFile(projectId) {
	return node_path.default.join(getProjectDir(projectId), "project.json");
}
function getLibraryFile() {
	return node_path.default.join(getBaseDir(), "library.json");
}
function getSettingsFile() {
	return node_path.default.join(getBaseDir(), "settings.json");
}
function getSecretsFile() {
	return node_path.default.join(getBaseDir(), "secrets.json");
}
function assertSafeId(id) {
	if (!/^[A-Za-z0-9_-]{3,160}$/.test(id)) throw new Error("Identificador no válido");
}
async function ensureBaseDirs() {
	await node_fs.promises.mkdir(getProjectsDir(), { recursive: true });
	if (!migrationPromise) migrationPromise = migrateProjectsLocation().catch(() => void 0);
	await migrationPromise;
}
async function readJson(filePath, fallback) {
	try {
		const raw = await node_fs.promises.readFile(filePath, "utf8");
		return JSON.parse(raw);
	} catch (error) {
		if (error.code === "ENOENT") return fallback;
		if (error instanceof SyntaxError) {
			const backup = `${filePath}.corrupt-${Date.now()}`;
			await node_fs.promises.copyFile(filePath, backup).catch(() => void 0);
			return fallback;
		}
		throw error;
	}
}
async function writeJsonAtomic(filePath, data) {
	await node_fs.promises.mkdir(node_path.default.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	const payload = JSON.stringify(data, null, 2);
	await node_fs.promises.writeFile(tempPath, payload, "utf8");
	await node_fs.promises.rename(tempPath, filePath);
}
function validateProject(value) {
	if (!value || typeof value !== "object") throw new Error("El archivo del proyecto no es válido");
	const project = value;
	if (!project.id || !/^[A-Za-z0-9_-]{3,160}$/.test(project.id)) throw new Error("El proyecto no tiene un identificador válido");
	if (!project.title || typeof project.title !== "string") throw new Error("El proyecto no tiene título");
	if (!project.nodes || typeof project.nodes !== "object") throw new Error("El proyecto no contiene documentos");
	if (!Array.isArray(project.characters)) project.characters = [];
	if (!Array.isArray(project.locations)) project.locations = [];
	if (!Array.isArray(project.items)) project.items = [];
	if (!Array.isArray(project.plots)) project.plots = [];
	if (!Array.isArray(project.plotEdges)) project.plotEdges = [];
	if (!Array.isArray(project.trash)) project.trash = [];
	if (!project.schemaVersion) project.schemaVersion = 1;
	return project;
}
async function pathExists(filePath) {
	try {
		await node_fs.promises.access(filePath);
		return true;
	} catch {
		return false;
	}
}
async function safeRemoveDir(target, root) {
	const resolvedRoot = node_path.default.resolve(root);
	const resolvedTarget = node_path.default.resolve(target);
	if (resolvedTarget === resolvedRoot || !resolvedTarget.startsWith(`${resolvedRoot}${node_path.default.sep}`)) throw new Error("Ruta de borrado no permitida");
	await node_fs.promises.rm(resolvedTarget, {
		recursive: true,
		force: true
	});
}
// src/main/settings.ts
function normalizeSettings(raw) {
	const defaults = structuredClone(DEFAULT_SETTINGS);
	if (!raw) return defaults;
	return {
		general: {
			...defaults.general,
			...raw.general || {}
		},
		editor: {
			...defaults.editor,
			...raw.editor || {}
		},
		ai: {
			...defaults.ai,
			...raw.ai || {}
		},
		backups: {
			...defaults.backups,
			...raw.backups || {}
		},
		providers: Array.isArray(raw.providers) && raw.providers.length ? raw.providers.map((provider) => ({ ...provider })) : defaults.providers
	};
}
function encryptSecret(value) {
	if (!value) return "";
	try {
		if (electron.safeStorage.isEncryptionAvailable()) return `enc:${electron.safeStorage.encryptString(value).toString("base64")}`;
	} catch {
		return `b64:${Buffer.from(value, "utf8").toString("base64")}`;
	}
	return `b64:${Buffer.from(value, "utf8").toString("base64")}`;
}
function decryptSecret(value) {
	if (!value) return "";
	try {
		if (value.startsWith("enc:")) return electron.safeStorage.decryptString(Buffer.from(value.slice(4), "base64"));
		if (value.startsWith("b64:")) return Buffer.from(value.slice(4), "base64").toString("utf8");
	} catch {
		return "";
	}
	return "";
}
async function readSecrets() {
	return readJson(getSecretsFile(), {});
}
async function getSettings() {
	const settings = normalizeSettings(await readJson(getSettingsFile(), null));
	const secrets = await readSecrets();
	settings.providers = settings.providers.map((provider) => ({
		...provider,
		apiKey: "",
		hasApiKey: Boolean(secrets[provider.id]),
		clearApiKey: false
	}));
	if (!settings.providers.some((provider) => provider.id === settings.ai.activeProviderId)) settings.ai.activeProviderId = settings.providers[0]?.id || "";
	return settings;
}
async function saveSettings(input) {
	const secrets = await readSecrets();
	const providers = input.providers.map((provider) => {
		const secret = secrets[provider.id];
		if (provider.clearApiKey) delete secrets[provider.id];
		else if (provider.apiKey?.trim()) secrets[provider.id] = encryptSecret(provider.apiKey.trim());
		else if (!secret && provider.hasApiKey) secrets[provider.id] = "";
		return {
			id: provider.id,
			name: provider.name.trim() || "Proveedor sin nombre",
			protocol: provider.protocol,
			category: provider.category,
			baseUrl: provider.baseUrl.trim(),
			model: provider.model.trim(),
			temperature: Number.isFinite(provider.temperature) ? provider.temperature : .7,
			maxTokens: Number.isFinite(provider.maxTokens) ? provider.maxTokens : 2048
		};
	});
	const providerIds = new Set(providers.map((provider) => provider.id));
	for (const id of Object.keys(secrets)) if (!providerIds.has(id)) delete secrets[id];
	const stored = {
		general: input.general,
		editor: input.editor,
		ai: {
			...input.ai,
			activeProviderId: providers.some((provider) => provider.id === input.ai.activeProviderId) ? input.ai.activeProviderId : providers[0]?.id || ""
		},
		backups: input.backups,
		providers
	};
	await writeJsonAtomic(getSettingsFile(), stored);
	await writeJsonAtomic(getSecretsFile(), secrets);
	return getSettings();
}
async function getProviderWithSecret(providerId) {
	const provider = (await getSettings()).providers.find((candidate) => candidate.id === providerId);
	if (!provider) return null;
	const secrets = await readSecrets();
	return {
		...provider,
		apiKey: decryptSecret(secrets[providerId])
	};
}
async function resolveProvider(providerId, override) {
	if (override) {
		const stored = await getProviderWithSecret(providerId);
		const apiKey = override.apiKey?.trim() || stored?.apiKey || "";
		return {
			...override,
			apiKey,
			hasApiKey: Boolean(apiKey)
		};
	}
	return getProviderWithSecret(providerId);
}
// src/main/projects.ts
function totalWords(project) {
	return Object.values(project.nodes).reduce((total, node) => total + (node.wordCount || 0), 0);
}
function purgeExpiredTrash(project, retentionDays) {
	if (!Array.isArray(project.trash)) {
		project.trash = [];
		return false;
	}
	if (retentionDays <= 0) return false;
	const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
	const next = project.trash.filter((entry) => {
		const deletedAt = new Date(entry.deletedAt).getTime();
		return Number.isFinite(deletedAt) && deletedAt >= cutoff;
	});
	if (next.length === project.trash.length) return false;
	project.trash = next;
	return true;
}
function toEntry(project, projectPath, lastOpenedAt = nowIso()) {
	return {
		id: project.id,
		title: project.title,
		author: project.author,
		genre: project.genre,
		coverColor: project.coverColor,
		coverImage: project.coverImage || "",
		wordCount: totalWords(project),
		wordGoal: project.wordGoal,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
		lastOpenedAt,
		path: projectPath
	};
}
async function readLibrary() {
	await ensureBaseDirs();
	const library = await readJson(getLibraryFile(), []);
	return Array.isArray(library) ? library : [];
}
async function writeLibrary(library) {
	await writeJsonAtomic(getLibraryFile(), library);
}
async function upsertLibrary(project, lastOpenedAt) {
	const library = await readLibrary();
	const existing = library.find((entry) => entry.id === project.id);
	const entry = toEntry(project, getProjectDir(project.id), lastOpenedAt || existing?.lastOpenedAt || nowIso());
	await writeLibrary(existing ? library.map((item) => item.id === project.id ? entry : item) : [...library, entry]);
	return entry;
}
async function removeLibrary(projectId) {
	await writeLibrary((await readLibrary()).filter((entry) => entry.id !== projectId));
}
async function readProject(projectId) {
	assertSafeId(projectId);
	await ensureBaseDirs();
	return validateProject(await readJson(getProjectFile(projectId), null));
}
async function getProject(projectId) {
	return readProject(projectId);
}
async function listProjects() {
	const library = await readLibrary();
	const valid = [];
	for (const entry of library) if (await pathExists(node_path.default.join(entry.path, "project.json"))) valid.push(entry);
	if (valid.length !== library.length) await writeLibrary(valid);
	return valid.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}
async function createProject(project) {
	await ensureBaseDirs();
	validateProject(project);
	const projectDir = getProjectDir(project.id);
	if (await pathExists(projectDir)) throw new Error("Ya existe un proyecto con ese identificador");
	project.updatedAt = nowIso();
	await node_fs.promises.mkdir(projectDir, { recursive: true });
	await writeJsonAtomic(getProjectFile(project.id), project);
	return upsertLibrary(project);
}
async function openProject(projectId) {
	const project = await readProject(projectId);
	if (purgeExpiredTrash(project, (await getSettings()).backups.trashRetentionDays)) await writeJsonAtomic(getProjectFile(project.id), project);
	await upsertLibrary(project, nowIso());
	return project;
}
async function saveProject(input) {
	const project = validateProject(structuredClone(input));
	const settings = await getSettings();
	purgeExpiredTrash(project, settings.backups.trashRetentionDays);
	const previous = await readJson(getProjectFile(project.id), null);
	let snapshotCount = 0;
	if (settings.backups.snapshotsEnabled && previous?.nodes) {
		for (const [documentId, node] of Object.entries(previous.nodes)) {
			const nextNode = project.nodes[documentId];
			if (!nextNode) continue;
			if ((node.content || "") !== (nextNode.content || "") && stripHtml(node.content || "")) {
				await writeSnapshot(project.id, {
					documentId,
					title: node.title,
					content: node.content,
					wordCount: node.wordCount,
					createdAt: node.updatedAt || nowIso()
				});
				snapshotCount += 1;
			}
		}
		await trimSnapshots(project.id, settings.backups.snapshotLimit);
	}
	project.updatedAt = nowIso();
	await writeJsonAtomic(getProjectFile(project.id), project);
	await upsertLibrary(project, nowIso());
	const backupCreated = await maybeAutoBackup(project.id, settings.backups.autoBackupMinutes, settings.backups.backupLimit);
	return {
		savedAt: project.updatedAt,
		snapshots: snapshotCount,
		backupCreated
	};
}
function snapshotDir(projectId, documentId) {
	assertSafeId(projectId);
	assertSafeId(documentId);
	return node_path.default.join(getProjectDir(projectId), "snapshots", documentId);
}
function snapshotToInfo(id, data) {
	const text = stripHtml(data.content);
	return {
		...data,
		id,
		preview: text.slice(0, 260)
	};
}
async function writeSnapshot(projectId, data) {
	const dir = snapshotDir(projectId, data.documentId);
	await node_fs.promises.mkdir(dir, { recursive: true });
	const id = `${(data.createdAt || nowIso()).replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 7)}`;
	const info = snapshotToInfo(id, data);
	const stored = {
		...data,
		id
	};
	await writeJsonAtomic(node_path.default.join(dir, `${id}.json`), stored);
	return info;
}
async function trimSnapshots(projectId, limit) {
	const safeLimit = Math.max(1, Math.min(500, limit || 40));
	const snapshotsRoot = node_path.default.join(getProjectDir(projectId), "snapshots");
	let docDirs = [];
	try {
		docDirs = await node_fs.promises.readdir(snapshotsRoot);
	} catch {
		return;
	}
	for (const docDir of docDirs) {
		const dir = node_path.default.join(snapshotsRoot, docDir);
		try {
			const files = (await node_fs.promises.readdir(dir)).filter((file) => file.endsWith(".json")).sort().reverse();
			for (const file of files.slice(safeLimit)) await node_fs.promises.rm(node_path.default.join(dir, file), { force: true }).catch(() => void 0);
		} catch {
			continue;
		}
	}
}
async function listSnapshots(projectId, documentId) {
	const dir = snapshotDir(projectId, documentId);
	assertSafeId(projectId);
	let files = [];
	try {
		files = await node_fs.promises.readdir(dir);
	} catch {
		return [];
	}
	const snapshots = [];
	for (const file of files.filter((entry) => entry.endsWith(".json")).sort().reverse()) try {
		const raw = await readJson(node_path.default.join(dir, file), null);
		if (!raw) continue;
		snapshots.push(snapshotToInfo(file.replace(/\.json$/, ""), raw));
	} catch {
		continue;
	}
	return snapshots;
}
async function createSnapshot(projectId, documentId) {
	const node = (await readProject(projectId)).nodes[documentId];
	if (!node) throw new Error("Documento no encontrado");
	return writeSnapshot(projectId, {
		documentId,
		title: node.title,
		content: node.content,
		wordCount: node.wordCount,
		createdAt: nowIso()
	});
}
async function deleteSnapshot(projectId, documentId, snapshotId) {
	if (!/^[A-Za-z0-9_.-]+$/.test(snapshotId)) throw new Error("Snapshot no válido");
	const target = node_path.default.join(snapshotDir(projectId, documentId), `${snapshotId}.json`);
	await node_fs.promises.rm(target, { force: true });
}
function backupDir(projectId) {
	return node_path.default.join(getProjectDir(projectId), "backups");
}
function backupKind(fileName) {
	if (fileName.includes("-auto-")) return "auto";
	if (fileName.includes("-safety-")) return "safety";
	return "manual";
}
async function archiveProject(projectId, destination) {
	const zip = new adm_zip.default();
	const projectFile = getProjectFile(projectId);
	zip.addLocalFile(projectFile, "", "project.json");
	const snapshotsRoot = node_path.default.join(getProjectDir(projectId), "snapshots");
	if (await pathExists(snapshotsRoot)) zip.addLocalFolder(snapshotsRoot, "snapshots");
	const project = await readProject(projectId);
	zip.addFile("manifest.json", Buffer.from(JSON.stringify({
		app: "NovelCraft",
		version: 1,
		projectId: project.id,
		title: project.title,
		author: project.author,
		exportedAt: nowIso()
	}, null, 2), "utf8"));
	await node_fs.promises.mkdir(node_path.default.dirname(destination), { recursive: true });
	await zip.writeZipPromise(destination, { overwrite: true });
}
async function createBackup(projectId, kind = "manual") {
	const dir = backupDir(projectId);
	await node_fs.promises.mkdir(dir, { recursive: true });
	const fileName = `novelcraft-${kind}-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.zip`;
	const destination = node_path.default.join(dir, fileName);
	await archiveProject(projectId, destination);
	const stat = await node_fs.promises.stat(destination);
	return {
		id: fileName,
		fileName,
		size: stat.size,
		createdAt: stat.mtime.toISOString(),
		kind
	};
}
async function listBackups(projectId) {
	const dir = backupDir(projectId);
	let files = [];
	try {
		files = await node_fs.promises.readdir(dir);
	} catch {
		return [];
	}
	const backups = [];
	for (const fileName of files.filter((file) => file.endsWith(".zip"))) try {
		const stat = await node_fs.promises.stat(node_path.default.join(dir, fileName));
		backups.push({
			id: fileName,
			fileName,
			size: stat.size,
			createdAt: stat.mtime.toISOString(),
			kind: backupKind(fileName)
		});
	} catch {
		continue;
	}
	return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function trimBackups(projectId, limit) {
	const backups = await listBackups(projectId);
	const safeLimit = Math.max(1, limit || 20);
	for (const backup of backups.slice(safeLimit)) await node_fs.promises.rm(node_path.default.join(backupDir(projectId), backup.id), { force: true }).catch(() => void 0);
}
async function maybeAutoBackup(projectId, intervalMinutes, backupLimit) {
	if (!intervalMinutes || intervalMinutes <= 0) return false;
	const latestAuto = (await listBackups(projectId)).find((backup) => backup.kind === "auto");
	if (latestAuto) {
		if (Date.now() - new Date(latestAuto.createdAt).getTime() < intervalMinutes * 6e4) return false;
	}
	await createBackup(projectId, "auto");
	await trimBackups(projectId, backupLimit);
	return true;
}
function validateBackupId(backupId) {
	if (!/^[A-Za-z0-9_.-]+\.zip$/.test(backupId) || backupId.includes("..")) throw new Error("Backup no válido");
}
async function restoreBackup(projectId, backupId) {
	validateBackupId(backupId);
	const current = await readProject(projectId);
	const backupPath = node_path.default.join(backupDir(projectId), backupId);
	if (!await pathExists(backupPath)) throw new Error("El backup ya no existe");
	const entry = new adm_zip.default(backupPath).getEntry("project.json");
	if (!entry) throw new Error("El backup no contiene un proyecto válido");
	const project = validateProject(JSON.parse(entry.getData().toString("utf8")));
	if (project.id !== current.id) throw new Error("El backup pertenece a otro proyecto");
	await createBackup(projectId, "safety");
	project.updatedAt = nowIso();
	await writeJsonAtomic(getProjectFile(projectId), project);
	await upsertLibrary(project, nowIso());
	await trimBackups(projectId, (await getSettings()).backups.backupLimit);
	return project;
}
async function deleteBackup(projectId, backupId) {
	validateBackupId(backupId);
	await node_fs.promises.rm(node_path.default.join(backupDir(projectId), backupId), { force: true });
}
async function deleteProject(projectId) {
	assertSafeId(projectId);
	await safeRemoveDir(getProjectDir(projectId), getProjectsDir());
	await removeLibrary(projectId);
}
async function exportProjectArchive(projectId) {
	const safeName = (await readProject(projectId)).title.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "proyecto";
	const result = await electron.dialog.showSaveDialog({
		title: "Exportar proyecto NovelCraft",
		defaultPath: `${safeName}.novelcraft.zip`,
		filters: [{
			name: "Proyecto NovelCraft",
			extensions: ["zip"]
		}]
	});
	if (result.canceled || !result.filePath) return { canceled: true };
	await archiveProject(projectId, result.filePath);
	return {
		canceled: false,
		filePath: result.filePath
	};
}
async function importProject() {
	const result = await electron.dialog.showOpenDialog({
		title: "Importar proyecto NovelCraft",
		properties: ["openFile"],
		filters: [{
			name: "Proyecto NovelCraft",
			extensions: ["zip"]
		}]
	});
	if (result.canceled || !result.filePaths[0]) return null;
	const entry = new adm_zip.default(result.filePaths[0]).getEntry("project.json");
	if (!entry) throw new Error("El archivo no es un proyecto NovelCraft");
	const project = validateProject(JSON.parse(entry.getData().toString("utf8")));
	await ensureBaseDirs();
	if ((await readLibrary()).some((item) => item.id === project.id) || await pathExists(getProjectDir(project.id))) {
		project.id = makeId("project");
		project.title = `${project.title} (importado)`;
	}
	project.createdAt = project.createdAt || nowIso();
	project.updatedAt = nowIso();
	await node_fs.promises.mkdir(getProjectDir(project.id), { recursive: true });
	await writeJsonAtomic(getProjectFile(project.id), project);
	return upsertLibrary(project, nowIso());
}
async function revealProject(projectId) {
	electron.shell.showItemInFolder(getProjectFile(projectId));
}
async function createExitBackup() {
	const settings = await getSettings();
	if (!settings.backups.backupOnExit) return;
	const recent = (await readLibrary()).sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))[0];
	if (!recent) return;
	if (!await pathExists(getProjectFile(recent.id))) return;
	const newest = (await listBackups(recent.id))[0];
	if (newest && Date.now() - new Date(newest.createdAt).getTime() < 3e5) return;
	await createBackup(recent.id, "auto");
	await trimBackups(recent.id, settings.backups.backupLimit);
}
// src/main/ai.ts
var controllers = /* @__PURE__ */ new Map();
function trimTrailingSlash(value) {
	return value.replace(/\/+$/, "");
}
function openAiUrl(baseUrl, endpoint) {
	return `${trimTrailingSlash(baseUrl)}${endpoint}`;
}
function anthropicUrl(baseUrl) {
	const base = trimTrailingSlash(baseUrl);
	return base.endsWith("/v1") ? `${base}/messages` : `${base}/v1/messages`;
}
function anthropicModelsUrl(baseUrl) {
	const base = trimTrailingSlash(baseUrl);
	return base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
}
function friendlyError(error, provider) {
	const message = error instanceof Error ? error.message : String(error);
	if (message === "fetch failed" || message.includes("ECONNREFUSED")) {
		if (provider.category === "local") return `No se pudo conectar con ${provider.name} en ${provider.baseUrl}. Comprueba que el servidor local esté en marcha.`;
		return `No se pudo conectar con ${provider.name}. Revisa tu conexión y la URL del proveedor.`;
	}
	return message;
}
async function parseError(response) {
	let detail = "";
	try {
		const text = await response.text();
		const parsed = JSON.parse(text);
		if (typeof parsed.error === "string") detail = parsed.error;
		else if (parsed.error?.message) detail = parsed.error.message;
		else if (parsed.message) detail = parsed.message;
		else detail = text.slice(0, 400);
	} catch {
		detail = response.statusText;
	}
	return `Error ${response.status}: ${detail || response.statusText || "respuesta no válida"}`;
}
async function consumeSse(response, onData) {
	if (!response.body) throw new Error("El proveedor no devolvió contenido");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split(/\r?\n/);
		buffer = lines.pop() || "";
		for (const line of lines) if (line.startsWith("data:")) onData(line.slice(5).trim());
	}
	buffer += decoder.decode();
	if (buffer.startsWith("data:")) onData(buffer.slice(5).trim());
}
async function consumeNdjson(response, onLine) {
	if (!response.body) throw new Error("El proveedor no devolvió contenido");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split(/\r?\n/);
		buffer = lines.pop() || "";
		for (const line of lines) if (line.trim()) onLine(line.trim());
	}
	if (buffer.trim()) onLine(buffer.trim());
}
function authHeaders(provider, anthropic = false) {
	const headers = { "Content-Type": "application/json" };
	if (provider.apiKey) {
		if (anthropic) {
			headers["x-api-key"] = provider.apiKey;
			headers["anthropic-version"] = "2023-06-01";
		} else headers.Authorization = `Bearer ${provider.apiKey}`;
	}
	return headers;
}
function openAiMessages(messages) {
	return messages.map((message) => ({
		role: message.role,
		content: message.content
	}));
}
function anthropicMessages(messages) {
	return {
		system: messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n"),
		messages: messages.filter((message) => message.role !== "system").map((message) => ({
			role: message.role === "assistant" ? "assistant" : "user",
			content: message.content
		}))
	};
}
async function streamProvider(provider, messages, onDelta, signal, temperature, maxTokens) {
	let full = "";
	if (provider.protocol === "ollama") {
		const response = await fetch(openAiUrl(provider.baseUrl, "/api/chat"), {
			method: "POST",
			headers: authHeaders(provider),
			body: JSON.stringify({
				model: provider.model,
				messages: openAiMessages(messages),
				stream: true,
				options: {
					temperature,
					num_predict: maxTokens
				}
			}),
			signal
		});
		if (!response.ok) throw new Error(await parseError(response));
		await consumeNdjson(response, (line) => {
			try {
				const event = JSON.parse(line);
				if (event.error) throw new Error(event.error);
				const delta = event.message?.content || "";
				if (delta) {
					full += delta;
					onDelta(delta);
				}
			} catch (error) {
				if (error instanceof SyntaxError) return;
				throw error;
			}
		});
		return full;
	}
	if (provider.protocol === "anthropic") {
		const payload = anthropicMessages(messages);
		const response = await fetch(anthropicUrl(provider.baseUrl), {
			method: "POST",
			headers: authHeaders(provider, true),
			body: JSON.stringify({
				model: provider.model,
				max_tokens: maxTokens,
				temperature,
				system: payload.system || void 0,
				messages: payload.messages,
				stream: true
			}),
			signal
		});
		if (!response.ok) throw new Error(await parseError(response));
		await consumeSse(response, (data) => {
			if (!data || data === "[DONE]") return;
			try {
				const event = JSON.parse(data);
				if (event.type === "error") throw new Error(event.error?.message || "Error de Anthropic");
				if (event.type === "content_block_delta" && event.delta?.text) {
					full += event.delta.text;
					onDelta(event.delta.text);
				}
			} catch (error) {
				if (error instanceof SyntaxError) return;
				throw error;
			}
		});
		return full;
	}
	const response = await fetch(openAiUrl(provider.baseUrl, "/chat/completions"), {
		method: "POST",
		headers: authHeaders(provider),
		body: JSON.stringify({
			model: provider.model,
			messages: openAiMessages(messages),
			stream: true,
			temperature,
			max_tokens: maxTokens
		}),
		signal
	});
	if (!response.ok) throw new Error(await parseError(response));
	await consumeSse(response, (data) => {
		if (!data || data === "[DONE]") return;
		try {
			const event = JSON.parse(data);
			if (event.error?.message) throw new Error(event.error.message);
			const delta = event.choices?.[0]?.delta?.content || event.choices?.[0]?.text || "";
			if (delta) {
				full += delta;
				onDelta(delta);
			}
		} catch (error) {
			if (error instanceof SyntaxError) return;
			throw error;
		}
	});
	return full;
}
async function completeProvider(provider, messages, temperature, maxTokens, signal) {
	if (provider.protocol === "ollama") {
		const response = await fetch(openAiUrl(provider.baseUrl, "/api/chat"), {
			method: "POST",
			headers: authHeaders(provider),
			body: JSON.stringify({
				model: provider.model,
				messages: openAiMessages(messages),
				stream: false,
				options: {
					temperature,
					num_predict: maxTokens
				}
			}),
			signal
		});
		if (!response.ok) throw new Error(await parseError(response));
		const data = await response.json();
		if (data.error) throw new Error(data.error);
		return data.message?.content || "";
	}
	if (provider.protocol === "anthropic") {
		const payload = anthropicMessages(messages);
		const response = await fetch(anthropicUrl(provider.baseUrl), {
			method: "POST",
			headers: authHeaders(provider, true),
			body: JSON.stringify({
				model: provider.model,
				max_tokens: maxTokens,
				temperature,
				system: payload.system || void 0,
				messages: payload.messages
			}),
			signal
		});
		if (!response.ok) throw new Error(await parseError(response));
		const data = await response.json();
		if (data.error) throw new Error(data.error.message);
		return (data.content || []).filter((block) => block.type === "text").map((block) => block.text || "").join("");
	}
	const response = await fetch(openAiUrl(provider.baseUrl, "/chat/completions"), {
		method: "POST",
		headers: authHeaders(provider),
		body: JSON.stringify({
			model: provider.model,
			messages: openAiMessages(messages),
			stream: false,
			temperature,
			max_tokens: maxTokens
		}),
		signal
	});
	if (!response.ok) throw new Error(await parseError(response));
	const data = await response.json();
	if (data.error) throw new Error(data.error.message);
	return data.choices?.[0]?.message?.content || "";
}
async function streamAiChat(request, onEvent) {
	const provider = await resolveProvider(request.providerId);
	if (!provider) {
		const error = "No hay un proveedor de IA configurado. Añade uno en Ajustes → IA.";
		onEvent({
			requestId: request.requestId,
			error,
			done: true
		});
		throw new Error(error);
	}
	if (!provider.baseUrl || !provider.model) {
		const error = "El proveedor de IA necesita una URL y un modelo.";
		onEvent({
			requestId: request.requestId,
			error,
			done: true
		});
		throw new Error(error);
	}
	const controller = new AbortController();
	controllers.set(request.requestId, controller);
	try {
		const content = await streamProvider(provider, request.messages, (delta) => onEvent({
			requestId: request.requestId,
			delta
		}), controller.signal, request.temperature ?? provider.temperature, request.maxTokens ?? provider.maxTokens);
		onEvent({
			requestId: request.requestId,
			done: true
		});
		return { content };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			onEvent({
				requestId: request.requestId,
				done: true
			});
			return { content: "" };
		}
		const message = friendlyError(error, provider);
		onEvent({
			requestId: request.requestId,
			error: message,
			done: true
		});
		throw new Error(message);
	} finally {
		controllers.delete(request.requestId);
	}
}
async function aiComplete(providerId, messages, temperature, maxTokens) {
	const provider = await resolveProvider(providerId);
	if (!provider) throw new Error("No hay un proveedor de IA configurado");
	try {
		return { content: await completeProvider(provider, messages, temperature ?? provider.temperature, maxTokens ?? provider.maxTokens) };
	} catch (error) {
		throw new Error(friendlyError(error, provider));
	}
}
function cancelAiRequest(requestId) {
	controllers.get(requestId)?.abort();
	controllers.delete(requestId);
}
async function discoverModels(providerId, override) {
	const provider = await resolveProvider(providerId, override);
	if (!provider) throw new Error("Proveedor no encontrado");
	try {
		if (provider.protocol === "ollama") {
			const response = await fetch(openAiUrl(provider.baseUrl, "/api/tags"), { headers: authHeaders(provider) });
			if (!response.ok) throw new Error(await parseError(response));
			return ((await response.json()).models || []).map((model) => model.name || "").filter(Boolean);
		}
		if (provider.protocol === "anthropic") {
			const response = await fetch(anthropicModelsUrl(provider.baseUrl), { headers: authHeaders(provider, true) });
			if (!response.ok) throw new Error(await parseError(response));
			const models = ((await response.json()).data || []).map((model) => model.id || "").filter(Boolean);
			return models.length ? models : [provider.model];
		}
		const response = await fetch(openAiUrl(provider.baseUrl, "/models"), { headers: authHeaders(provider) });
		if (!response.ok) throw new Error(await parseError(response));
		const data = await response.json();
		const models = (data.data || data.models || []).map((model) => model.id || "").filter(Boolean);
		return models.length ? models : [provider.model];
	} catch (error) {
		throw new Error(friendlyError(error, provider));
	}
}
async function testAiProvider(providerId, override) {
	try {
		const models = await discoverModels(providerId, override);
		return {
			ok: true,
			message: models.length > 0 ? `Conexión correcta. ${models.length} modelo${models.length === 1 ? "" : "s"} disponible${models.length === 1 ? "" : "s"}.` : "Conexión correcta.",
			models
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "No se pudo conectar"
		};
	}
}
// src/main/exporter.ts
function safeFileName(value) {
	return value.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "manuscrito";
}
function markdownToText(markdown) {
	return markdown.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/_(.*?)_/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/!\[.*?\]\(.*?\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^>\s?/gm, "").replace(/^\s*[-*+]\s+/gm, "· ").replace(/\n{3,}/g, "\n\n").trim();
}
function xmlEscape(value) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function toXhtml(html) {
	const entities = {
		"&nbsp;": "&#160;",
		"&mdash;": "&#8212;",
		"&ndash;": "&#8211;",
		"&hellip;": "&#8230;",
		"&ldquo;": "&#8220;",
		"&rdquo;": "&#8221;",
		"&lsquo;": "&#8216;",
		"&rsquo;": "&#8217;",
		"&middot;": "&#183;",
		"&bull;": "&#8226;",
		"&copy;": "&#169;",
		"&reg;": "&#174;",
		"&trade;": "&#8482;"
	};
	let output = html;
	for (const [entity, numeric] of Object.entries(entities)) output = output.replace(new RegExp(entity, "gi"), numeric);
	output = output.replace(/<(br|hr|img|input|col|area|base|embed|link|meta|param|source|track|wbr)(\b[^>]*?)\/?>/gi, "<$1$2/>");
	output = output.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|amp;|lt;|gt;|quot;|apos;)/g, "&amp;");
	return output;
}
function languageCode(language) {
	const normalized = language.trim().toLowerCase();
	if (normalized.startsWith("es")) return "es";
	if (normalized.startsWith("en")) return "en";
	if (normalized.startsWith("fr")) return "fr";
	if (normalized.startsWith("de")) return "de";
	if (normalized.startsWith("pt")) return "pt";
	if (normalized.startsWith("it")) return "it";
	return "es";
}
function parseImageDataUrl(value) {
	if (!value) return null;
	const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value);
	if (!match) return null;
	const mediaType = (match[1] || "image/jpeg").toLowerCase();
	if (!mediaType.startsWith("image/")) return null;
	const data = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
	if (!data.length) return null;
	return {
		data,
		extension: {
			"image/jpeg": "jpg",
			"image/jpg": "jpg",
			"image/png": "png",
			"image/gif": "gif",
			"image/webp": "webp",
			"image/svg+xml": "svg"
		}[mediaType] || "jpg",
		mediaType
	};
}
function buildEpub(title, coverImage, data) {
	const language = languageCode(data.language);
	const image = parseImageDataUrl(coverImage);
	const chapters = data.chapters.length ? data.chapters : [{
		title: "Manuscrito",
		html: "<p>Sin contenido.</p>"
	}];
	const showTitlePage = data.includeTitlePage || Boolean(image);
	const navItems = [];
	const manifest = ["<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>", "<item id=\"css\" href=\"style.css\" media-type=\"text/css\"/>"];
	const spine = [];
	if (showTitlePage) {
		navItems.push("<li><a href=\"titlepage.xhtml\">Portada</a></li>");
		manifest.push("<item id=\"titlepage\" href=\"titlepage.xhtml\" media-type=\"application/xhtml+xml\"/>");
		spine.push("<itemref idref=\"titlepage\"/>");
	}
	if (image) manifest.push(`<item id="cover-image" href="cover.${image.extension}" media-type="${image.mediaType}" properties="cover-image"/>`);
	chapters.forEach((chapter, index) => {
		const id = `chapter-${index + 1}`;
		navItems.push(`<li><a href="${id}.xhtml">${xmlEscape(chapter.title)}</a></li>`);
		manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
		spine.push(`<itemref idref="${id}"/>`);
	});
	const cover = image ? `<div class="cover-wrap"><img src="cover.${image.extension}" alt="Portada"/></div>` : "";
	const titleBlock = data.includeTitlePage ? `<h1>${xmlEscape(title)}</h1>${data.author ? `<p class="author">${xmlEscape(data.author)}</p>` : ""}${data.genre ? `<p class="genre">${xmlEscape(data.genre)}</p>` : ""}<div class="rule"></div><p class="mark">NovelCraft</p>` : "";
	const synopsis = data.includeTitlePage && data.synopsis.trim() ? `<section class="synopsis"><h2>Sinopsis</h2><p>${xmlEscape(data.synopsis).replace(/\n/g, "<br/>")}</p></section>` : "";
	const titlePage = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${xmlEscape(title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><section epub:type="titlepage" class="titlepage">${cover}${titleBlock}</section>${synopsis}</body>
</html>`;
	const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>Contenido</title><link rel="stylesheet" href="style.css"/></head>
<body><nav epub:type="toc" id="toc"><h1>Contenido</h1><ol>${navItems.join("")}</ol></nav></body>
</html>`;
	const modified = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
	const description = data.synopsis.trim() ? `<dc:description>${xmlEscape(data.synopsis)}</dc:description>` : "";
	const creator = data.author.trim() ? `<dc:creator>${xmlEscape(data.author)}</dc:creator>` : "";
	const subject = data.genre.trim() ? `<dc:subject>${xmlEscape(data.genre)}</dc:subject>` : "";
	const coverMeta = image ? "<meta name=\"cover\" content=\"cover-image\"/>" : "";
	const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${language}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:uuid:${(0, node_crypto.randomUUID)()}</dc:identifier>
<dc:title>${xmlEscape(title)}</dc:title>
<dc:language>${language}</dc:language>
${creator}
${subject}
${description}
<meta property="dcterms:modified">${modified}</meta>
${coverMeta}
</metadata>
<manifest>${manifest.join("")}</manifest>
<spine toc="nav">${spine.join("")}</spine>
</package>`;
	const style = `body { margin: 5% 7%; color: #1e1b17; font-family: Georgia, 'Times New Roman', serif; font-size: 1em; line-height: 1.68; }
h1, h2, h3 { font-weight: normal; line-height: 1.2; }
h1 { font-size: 2em; margin: 0 0 1em; }
h2 { font-size: 1.5em; margin: 1.4em 0 0.7em; }
p { margin: 0 0 0.65em; text-align: justify; }
.titlepage { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
.cover-wrap { margin-bottom: 2em; }
.cover-wrap img { max-width: 100%; max-height: 70vh; border-radius: 4px; }
.titlepage .author { font-size: 1.1em; letter-spacing: 0.04em; color: #4d463d; text-align: center; }
.titlepage .genre { font-family: sans-serif; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.16em; color: #8d7d68; text-align: center; }
.titlepage .rule { width: 2.5em; height: 1px; background: #b9905d; margin: 1.8em 0; }
.titlepage .mark { font-family: sans-serif; font-size: 0.65em; letter-spacing: 0.2em; text-transform: uppercase; color: #a89a88; text-align: center; }
.synopsis { page-break-after: always; }
.synopsis p { font-style: italic; }
.scene-separator { text-align: center; letter-spacing: 0.6em; color: #9c8f7e; }
.scene-title { font-size: 1.1em; font-style: italic; text-align: center; color: #5c5348; }
blockquote { margin: 1em 2em; font-style: italic; border-left: 2px solid #d8c8b3; padding-left: 1em; }
img { max-width: 100%; height: auto; }
`;
	const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
	const zip = new adm_zip.default(void 0, { noSort: true });
	zip.addFile("mimetype", Buffer.from("application/epub+zip"));
	const mimetype = zip.getEntry("mimetype");
	if (mimetype) mimetype.header.method = 0;
	zip.addFile("META-INF/container.xml", Buffer.from(container, "utf8"));
	zip.addFile("OEBPS/content.opf", Buffer.from(opf, "utf8"));
	zip.addFile("OEBPS/nav.xhtml", Buffer.from(nav, "utf8"));
	zip.addFile("OEBPS/style.css", Buffer.from(style, "utf8"));
	if (showTitlePage) zip.addFile("OEBPS/titlepage.xhtml", Buffer.from(titlePage, "utf8"));
	if (image) zip.addFile(`OEBPS/cover.${image.extension}`, image.data);
	chapters.forEach((chapter, index) => {
		const id = `chapter-${index + 1}`;
		const document = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${xmlEscape(chapter.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><section epub:type="chapter">${toXhtml(chapter.html)}</section></body>
</html>`;
		zip.addFile(`OEBPS/${id}.xhtml`, Buffer.from(document, "utf8"));
	});
	return zip.toBuffer();
}
async function renderPdf(html) {
	const tempDir = await node_fs.promises.mkdtemp(node_path.default.join(node_os.default.tmpdir(), "novelcraft-pdf-"));
	const tempFile = node_path.default.join(tempDir, "manuscrito.html");
	await node_fs.promises.writeFile(tempFile, html, "utf8");
	const printWindow = new electron.BrowserWindow({
		show: false,
		width: 900,
		height: 1200,
		webPreferences: {
			sandbox: true,
			javascript: false,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	try {
		await printWindow.loadFile(tempFile);
		return await printWindow.webContents.printToPDF({
			printBackground: true,
			preferCSSPageSize: true,
			pageSize: "A4",
			margins: {
				top: .7,
				bottom: .7,
				left: .75,
				right: .75
			}
		});
	} finally {
		printWindow.destroy();
		await node_fs.promises.rm(tempDir, {
			recursive: true,
			force: true
		}).catch(() => void 0);
	}
}
async function exportManuscript(payload) {
	const extensionMap = {
		pdf: "pdf",
		html: "html",
		markdown: "md",
		txt: "txt",
		epub: "epub"
	};
	const filterNames = {
		pdf: "Documento PDF",
		html: "Página HTML",
		markdown: "Markdown",
		txt: "Texto plano",
		epub: "Libro electrónico EPUB"
	};
	const extension = extensionMap[payload.format];
	const baseName = safeFileName(payload.title);
	let target = payload.outputPath;
	if (!target) {
		const result = await electron.dialog.showSaveDialog({
			title: "Publicar manuscrito",
			defaultPath: `${baseName}.${extension}`,
			filters: [{
				name: filterNames[payload.format],
				extensions: [extension]
			}]
		});
		if (result.canceled || !result.filePath) return { canceled: true };
		target = result.filePath;
	}
	if (!node_path.default.extname(target)) target = `${target}.${extension}`;
	if (payload.format === "epub") {
		if (!payload.epub) throw new Error("No hay datos EPUB para exportar.");
		const buffer = buildEpub(payload.title, payload.coverImage, payload.epub);
		await node_fs.promises.writeFile(target, buffer);
	} else if (payload.format === "pdf") {
		const buffer = await renderPdf(payload.html);
		await node_fs.promises.writeFile(target, buffer);
	} else if (payload.format === "html") await node_fs.promises.writeFile(target, payload.html, "utf8");
	else if (payload.format === "markdown") await node_fs.promises.writeFile(target, payload.markdown, "utf8");
	else await node_fs.promises.writeFile(target, markdownToText(payload.markdown), "utf8");
	return {
		canceled: false,
		filePath: target
	};
}
// src/main/index.ts
var mainWindow = null;
var allowClose = false;
var closingHandshake = false;
var exitBackupDone = false;
var closeTimer = null;
async function finishClose() {
	if (closeTimer) {
		clearTimeout(closeTimer);
		closeTimer = null;
	}
	mainWindow?.hide();
	if (!exitBackupDone) {
		exitBackupDone = true;
		try {
			await createExitBackup();
		} catch {}
	}
	allowClose = true;
	mainWindow?.close();
}
electron.app.setName("NovelCraft");
var windowIcon = () => electron.app.isPackaged ? (0, node_path.join)(process.resourcesPath, "icon.png") : (0, node_path.join)(electron.app.getAppPath(), "assets", "icon.png");
function registerIpc() {
	electron.ipcMain.handle("app:info", () => ({
		version: electron.app.getVersion(),
		platform: process.platform,
		electron: process.versions.electron,
		chrome: process.versions.chrome,
		dataPath: getBaseDir()
	}));
	electron.ipcMain.handle("projects:list", () => listProjects());
	electron.ipcMain.handle("projects:create", (_event, project) => createProject(project));
	electron.ipcMain.handle("projects:get", (_event, projectId) => getProject(projectId));
	electron.ipcMain.handle("projects:open", (_event, projectId) => openProject(projectId));
	electron.ipcMain.handle("projects:save", (_event, project) => saveProject(project));
	electron.ipcMain.handle("projects:delete", (_event, projectId) => deleteProject(projectId));
	electron.ipcMain.handle("projects:import", () => importProject());
	electron.ipcMain.handle("projects:export", (_event, projectId) => exportProjectArchive(projectId));
	electron.ipcMain.handle("projects:reveal", (_event, projectId) => revealProject(projectId));
	electron.ipcMain.handle("backups:create", (_event, projectId) => createBackup(projectId, "manual"));
	electron.ipcMain.handle("backups:list", (_event, projectId) => listBackups(projectId));
	electron.ipcMain.handle("backups:restore", (_event, projectId, backupId) => restoreBackup(projectId, backupId));
	electron.ipcMain.handle("backups:delete", (_event, projectId, backupId) => deleteBackup(projectId, backupId));
	electron.ipcMain.handle("snapshots:list", (_event, projectId, documentId) => listSnapshots(projectId, documentId));
	electron.ipcMain.handle("snapshots:create", (_event, projectId, documentId) => createSnapshot(projectId, documentId));
	electron.ipcMain.handle("snapshots:delete", (_event, projectId, documentId, snapshotId) => deleteSnapshot(projectId, documentId, snapshotId));
	electron.ipcMain.handle("settings:get", () => getSettings());
	electron.ipcMain.handle("settings:save", (_event, settings) => saveSettings(settings));
	electron.ipcMain.handle("ai:models", (_event, providerId) => discoverModels(providerId));
	electron.ipcMain.handle("ai:test", (_event, providerId, provider) => testAiProvider(providerId, provider));
	electron.ipcMain.handle("ai:chat", async (event, request) => {
		return streamAiChat(request, (streamEvent) => {
			if (!event.sender.isDestroyed()) event.sender.send("ai:stream", streamEvent);
		});
	});
	electron.ipcMain.handle("ai:complete", (_event, request) => aiComplete(request.providerId, request.messages, request.temperature, request.maxTokens));
	electron.ipcMain.handle("ai:cancel", (_event, requestId) => cancelAiRequest(requestId));
	electron.ipcMain.handle("export:manuscript", (_event, payload) => exportManuscript(payload));
	electron.ipcMain.handle("window:minimize", () => mainWindow?.minimize());
	electron.ipcMain.handle("window:maximize", () => {
		if (!mainWindow) return false;
		if (mainWindow.isMaximized()) mainWindow.unmaximize();
		else mainWindow.maximize();
		return mainWindow.isMaximized();
	});
	electron.ipcMain.handle("window:close", () => mainWindow?.close());
	electron.ipcMain.on("window:dirty", (_event, dirty) => {
		if (!mainWindow) return;
		mainWindow.setDocumentEdited(dirty);
		mainWindow.setTitle(`${dirty ? "● " : ""}NovelCraft — ${mainWindow.getTitle().replace(/^● NovelCraft — /, "")}`);
	});
	electron.ipcMain.on("app:close-ready", () => {
		if (!closingHandshake) return;
		finishClose();
	});
	electron.ipcMain.handle("app:open-external", async (_event, url) => {
		try {
			const parsed = new URL(url);
			if ([
				"https:",
				"http:",
				"mailto:"
			].includes(parsed.protocol)) await electron.shell.openExternal(url);
		} catch {
			return;
		}
	});
}
function buildMenu() {
	if (process.platform !== "darwin") {
		electron.Menu.setApplicationMenu(null);
		return;
	}
	const template = [
		{
			label: electron.app.name,
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" }
			]
		},
		{ role: "editMenu" },
		{ role: "windowMenu" }
	];
	electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
}
function createWindow() {
	const isMac = process.platform === "darwin";
	mainWindow = new electron.BrowserWindow({
		width: 1500,
		height: 950,
		minWidth: 900,
		minHeight: 620,
		show: false,
		frame: isMac,
		titleBarStyle: isMac ? "hiddenInset" : "hidden",
		trafficLightPosition: isMac ? {
			x: 18,
			y: 17
		} : void 0,
		backgroundColor: "#0e0f12",
		title: "NovelCraft",
		icon: windowIcon(),
		autoHideMenuBar: true,
		webPreferences: {
			preload: (0, node_path.join)(__dirname, "../preload/index.js"),
			sandbox: false,
			contextIsolation: true,
			nodeIntegration: false,
			spellcheck: true
		}
	});
	mainWindow.on("ready-to-show", () => {
		mainWindow?.show();
		modernizeWindow();
		getSettings().then((settings) => {
			const scale = settings.general.uiScale || 100;
			if (Number.isFinite(scale) && scale !== 100) mainWindow?.webContents.setZoomFactor(Math.min(2, Math.max(.5, scale / 100)));
		}).catch(() => void 0);
	});
	mainWindow.on("close", (event) => {
		if (allowClose) return;
		if (!mainWindow) return;
		event.preventDefault();
		if (closingHandshake) return;
		closingHandshake = true;
		mainWindow.webContents.send("app:before-close");
		closeTimer = setTimeout(() => {
			finishClose();
		}, 4e3);
	});
	mainWindow.on("closed", () => {
		mainWindow = null;
		if (closeTimer) clearTimeout(closeTimer);
	});
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("mailto:")) electron.shell.openExternal(url);
		return { action: "deny" };
	});
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (url !== (mainWindow?.webContents.getURL() || "")) {
			event.preventDefault();
			if (url.startsWith("https://") || url.startsWith("http://")) electron.shell.openExternal(url);
		}
	});
	if (process.env["ELECTRON_RENDERER_URL"]) mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	else mainWindow.loadFile((0, node_path.join)(__dirname, "../renderer/index.html"));
}
function modernizeWindow() {
	if (!mainWindow) return;
	if (process.platform === "darwin") mainWindow.setWindowButtonVisibility(true);
}
electron.app.whenReady().then(async () => {
	electron.app.setAppUserModelId("com.novelcraft.app");
	electron.nativeTheme.themeSource = "dark";
	await ensureBaseDirs();
	registerIpc();
	buildMenu();
	createWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) {
			allowClose = false;
			closingHandshake = false;
			exitBackupDone = false;
			createWindow();
		}
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
	allowClose = true;
});
