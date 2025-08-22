"use strict";

import { DataPair } from "../core/extensions.js";

//#region Archive
/**
 * Represents an archive that stores data in localStorage.
 * @template T
 */
class Archive {
	/**
	 * @param {string} key The key to use for storing the data in localStorage.
	 * @param {T} initial The initial data to be stored if no data exists with the provided key.
	 */
	constructor(key, initial) {
		this.#key = key;
		this.#initial = initial;

		if (localStorage.getItem(this.#key) === null) {
			this.data = this.#initial;
		}
	}
	/** @type {string} */
	#key;
	/** @type {T} */
	#initial;
	/**
	 * Gets the data stored in the archive.
	 * @returns {T} The data stored in the archive.
	 */
	get data() {
		const item = localStorage.getItem(this.#key);
		if (item === null) throw new Error(`Key '${this.#key}' isn't defined`);
		return JSON.parse(item);
	}
	/**
	 * Sets the data in the archive.
	 * @param {T} value The data to be stored in the archive.
	 */
	set data(value) {
		localStorage.setItem(this.#key, JSON.stringify(value, undefined, `\t`));
	}
	/**
	 * Resets the data in the archive to its initial value.
	 * @returns {void}
	 */
	reset() {
		this.data = this.#initial;
	}
	/**
	 * Modifies the data in the archive using the provided action.
	 * @param {(value: T) => T} action The action to be applied to the data.
	 * @returns {void}
	 */
	change(action) {
		this.data = action(this.data);
	}
}
//#endregion
//#region Archive manager
/**
 * Class to manage archives with archivable instances.
 * @template N The type of the archived data.
 * @template {ArchivableInstance<N>} I The type of the archivable instance.
 */
class ArchiveManager {
	/** @type {boolean} */
	static #locked = true;
	/**
	 * Constructs a new archive manager instance.
	 * @template N
	 * @template {ArchivableInstance<N>} I
	 * @template {readonly any[]} A
	 * @param {string} path The path to the archive.
	 * @param {ArchivablePrototype<N, I, A>} prototype The prototype for creating instances.
	 * @param {A} args The arguments for the constructor.
	 * @returns {Promise<ArchiveManager<N, I>>} A promise with expected manager instance.
	 */
	static async construct(path, prototype, ...args) {
		ArchiveManager.#locked = false;
		/** @type {ArchiveManager<N, I>} */
		const self = new ArchiveManager();
		ArchiveManager.#locked = true;

		self.#construct = () => Reflect.construct(prototype, args);

		const archive = new Archive(path, self.#construct().export());
		const content = prototype.import(archive.data, `archive data`);
		if (!(content instanceof prototype)) throw new TypeError(`Given prototype must reconstruct own instance with import and export functions`);
		self.#content = content;

		window.addEventListener(`beforeunload`, (event) => {
			try {
				archive.data = self.#content.export();
			} catch (reason) {
				event.preventDefault();
			}
		});

		return self;
	}
	/**
	 * @throws {TypeError} If called directly.
	 */
	constructor() {
		if (ArchiveManager.#locked) throw new TypeError(`Illegal constructor`);
	}
	/** @type {() => I} */
	#construct;
	/** @type {I} */
	#content;
	/**
	 * Gets the content of the archive.
	 * @returns {I}
	 */
	get content() {
		return this.#content;
	}
	/**
	 * Reconstructs the content of the archive.
	 * @returns {void}
	 */
	reconstruct() {
		this.#content = this.#construct();
	}
}
//#endregion
//#region Database
/**
 * @typedef {InstanceType<typeof Database.Store>} DatabaseStore
 */

/**
 * Represents a database for storing data.
 */
class Database {
	//#region Store
	/**
	 * Represents a store within a database.
	 */
	static Store = class DatabaseStore {
		/** @type {boolean} */
		static #locked = true;
		/**
		 * @param {string} nameDatabase 
		 * @param {string} nameStore 
		 * @returns {Promise<DatabaseStore>}
		 */
		static async #newStore(nameDatabase, nameStore) {
			const database = await Database.#newDatabase(nameDatabase);
			DatabaseStore.#locked = false;
			const store = new DatabaseStore();
			DatabaseStore.#locked = true;
			store.#name = nameStore;
			store.#database = database;
			return store;
		}
		/**
		 * Opens an store in the database.
		 * @param {string} nameDatabase The name of the database.
		 * @param {string} nameStore The name of the store.
		 * @returns {Promise<DatabaseStore>} The opened store.
		 */
		static async open(nameDatabase, nameStore) {
			const store = await DatabaseStore.#newStore(nameDatabase, nameStore);
			const database = store.#database;
			if (!(await database.#openDatabaseWith(database => database.objectStoreNames.contains(nameStore)))) {
				await database.#upgradeDatabaseWith((database) => database.createObjectStore(nameStore, { autoIncrement: true }));
			}
			return store;
		}
		/**
		 * Suspends a store in the database.
		 * @param {string} nameDatabase The name of the database.
		 * @param {string} nameStore The name of the store.
		 * @returns {Promise<void>} A promise that resolves when the store is suspended.
		 */
		static async suspend(nameDatabase, nameStore) {
			const database = await Database.#newDatabase(nameDatabase);
			if (await database.#openDatabaseWith(database => database.objectStoreNames.contains(nameStore))) {
				await database.#upgradeDatabaseWith((database) => database.deleteObjectStore(nameStore));
			}
		}
		/**
		 * @throws {TypeError} If the constructor is called directly.
		 */
		constructor() {
			if (DatabaseStore.#locked) throw new TypeError(`Illegal constructor`);
		}
		/** @type {string} */
		#name;
		/**
		 * Gets the name of the store.
		 * @readonly
		 * @returns {string}
		 */
		get name() {
			return this.#name;
		}
		/** @type {Database} */
		#database;
		/**
		 * Gets the database the store belongs to.
		 * @readonly
		 * @returns {Database}
		 */
		get database() {
			return this.#database;
		}
		/**
		 * @template T
		 * @param {(idbos: IDBObjectStore) => T | PromiseLike<T>} action 
		 * @returns {Promise<T>}
		 */
		#openStoreWith(action) {
			return this.#database.#openDatabaseWith(async (idb) => {
				const idbos = idb.transaction([this.#name], `readwrite`).objectStore(this.#name);
				const result = await action(idbos);
				idbos.transaction.commit();
				return result;
			});
		}
		/**
		 * Inserts values into the store.
		 * @param {any[]} values The values to insert.
		 * @returns {Promise<number[]>} The keys of the inserted values.
		 */
		insert(...values) {
			return this.#openStoreWith(async (idbos) => {
				const keys = (/** @type {number[]} */ ([]));
				for (const value of values) {
					keys.push(Number(await Database.#resolve(idbos.add(value))));
				}
				return keys;
			});
		}
		/**
		 * Selects values from the store by keys.
		 * @param {number[]} keys The keys of the values to select.
		 * @returns {Promise<any[]>} The selected values.
		 */
		select(...keys) {
			return this.#openStoreWith(async (idbos) => {
				const values = (/** @type {any[]} */ ([]));
				for (const key of keys) {
					values.push(await Database.#resolve(idbos.get(Number(key))));
				}
				return values;
			});
		}
		/**
		 * Updates values in the store.
		 * @param {DataPair<number, any>[]} pairs The key-value pairs to update.
		 * @returns {Promise<void>}
		 */
		update(...pairs) {
			return this.#openStoreWith(async (idbos) => {
				for (const { value, key } of pairs) {
					await Database.#resolve(idbos.put(value, key));
				}
			});
		}
		/**
		 * Removes values from the store by keys.
		 * @param {number[]} keys The keys of the values to remove.
		 * @returns {Promise<void>}
		 */
		remove(...keys) {
			return this.#openStoreWith(async (idbos) => {
				for (const key of keys) {
					await Database.#resolve(idbos.delete(key));
				}
			});
		}
		/**
		 * Suspends the store.
		 * @returns {Promise<void>}
		 */
		suspend() {
			return Database.Store.suspend(this.#database.name, this.#name);
		}
	};
	//#endregion

	/**
	 * @template T
	 * @param {IDBRequest<T>} request 
	 * @returns {Promise<T>}
	 */
	static #resolve(request) {
		return Promise.withSignal((signal, resolve, reject) => {
			request.addEventListener(`success`, (event) => resolve(request.result), { signal });
			request.addEventListener(`error`, (event) => reject(request.error), { signal });
		});
	}
	/** @type {boolean} */
	static #locked = true;
	/**
	 * @param {string} nameDatabase 
	 * @returns {Promise<Database>}
	 */
	static async #newDatabase(nameDatabase) {
		Database.#locked = false;
		const database = new Database();
		Database.#locked = true;
		database.#name = nameDatabase;
		database.#version = await Database.#getVersion(nameDatabase);
		return database;
	}
	/**
	 * @param {string} nameDatabase 
	 * @returns {Promise<number>}
	 */
	static async #getVersion(nameDatabase) {
		for (const { name, version } of await indexedDB.databases()) {
			if (name === nameDatabase && version !== undefined) return version;
		}
		return 0;
	}
	/**
	 * Opens an existing database.
	 * @param {string} nameDatabase The name of the database.
	 * @returns {Promise<Database>} The opened database.
	 */
	static async open(nameDatabase) {
		const database = await Database.#newDatabase(nameDatabase);
		await database.#openDatabaseWith((database) => database);
		return database;
	}
	/**
	 * Suspends (deletes) a database.
	 * @param {string} nameDatabase The name of the database.
	 * @returns {Promise<void>}
	 */
	static async suspend(nameDatabase) {
		return Promise.withSignal((signal, resolve, reject) => {
			const requestIDBOpen = indexedDB.deleteDatabase(nameDatabase);
			requestIDBOpen.addEventListener(`success`, (event) => resolve(), { signal });
			requestIDBOpen.addEventListener(`error`, (event) => reject(requestIDBOpen.error), { signal });
		});
	}
	/**
	 * Gets a list of all databases.
	 * @readonly
	 * @returns {Promise<Readonly<string[]>>}
	 */
	static get databases() {
		return new Promise(async (resolve) => {
			const databases = [];
			for (const { name } of await indexedDB.databases()) {
				if (name === undefined) continue;
				databases.push(name);
			}
			resolve(Object.freeze(databases));
		});
	}
	/**
	 * @throws {TypeError} If the constructor is called directly.
	 */
	constructor() {
		if (Database.#locked) throw new TypeError(`Illegal constructor`);
	}
	/** @type {string} */
	#name;
	/**
	 * Gets the name of the database.
	 * @readonly
	 * @returns {string}
	 */
	get name() {
		return this.#name;
	}
	/** @type {number} */
	#version;
	/**
	 * @template T
	 * @param {(idb: IDBDatabase) => T} action 
	 * @returns {Promise<T>}
	 */
	#upgradeDatabaseWith(action) {
		return Promise.withSignal(async (signal, resolve, reject) => {
			const requestIDBOpen = indexedDB.open(this.#name, ++this.#version);
			requestIDBOpen.addEventListener(`upgradeneeded`, (event) => {
				const idb = requestIDBOpen.result;
				const result = action(idb);
				idb.close();
				resolve(result);
			}, { signal });
			requestIDBOpen.addEventListener(`blocked`, (event) => reject(requestIDBOpen.error), { signal });
		});
	}
	/**
	 * @template T
	 * @param {(idb: IDBDatabase) => T | PromiseLike<T>} action 
	 * @returns {Promise<T>}
	 */
	#openDatabaseWith(action) {
		if (this.#version < 1) this.#upgradeDatabaseWith((idb) => idb);
		return Promise.withSignal((signal, resolve, reject) => {
			const requestIDBOpen = indexedDB.open(this.#name);
			requestIDBOpen.addEventListener(`success`, async (event) => {
				const idb = requestIDBOpen.result;
				const result = await action(idb);
				idb.close();
				resolve(result);
			}, { signal });
			requestIDBOpen.addEventListener(`error`, (event) => reject(requestIDBOpen.error), { signal });
		});
	}
	/**
	 * Gets a list of all stores in the database.
	 * @readonly
	 * @returns {Promise<Readonly<string[]>>}
	 */
	get stores() {
		return this.#openDatabaseWith((database) => Object.freeze(Array.from(database.objectStoreNames)));
	}
	/**
	 * Suspends the database.
	 * @returns {Promise<void>}
	 */
	suspend() {
		return Database.suspend(this.#name);
	}
}
//#endregion

export { Archive, ArchiveManager, Database };
