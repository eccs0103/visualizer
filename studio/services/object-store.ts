"use strict";

import "adaptive-extender/web";

//#region Object store
export class ObjectStore {
	#nameDatabase: string;
	#nameStore: string;

	constructor(nameDatabase: string, nameStore: string) {
		this.#nameDatabase = nameDatabase;
		this.#nameStore = nameStore;
	}

	async #open(): Promise<IDBDatabase> {
		const nameDatabase = this.#nameDatabase;
		const nameStore = this.#nameStore;
		const result = await Promise.withSignal<IDBDatabase>((signal, resolve, reject) => {
			const request = indexedDB.open(nameDatabase, 1);
			request.addEventListener("upgradeneeded", (event) => {
				if (!request.result.objectStoreNames.contains(nameStore)) request.result.createObjectStore(nameStore);
			}, { signal });
			request.addEventListener("success", (event) => resolve(request.result), { signal });
			request.addEventListener("error", (event) => reject(request.error), { signal });
		});
		return result;
	}

	async get(key: IDBValidKey): Promise<unknown> {
		const database = await this.#open();
		const transaction = database.transaction(this.#nameStore, "readonly");
		const store = transaction.objectStore(this.#nameStore);
		const request = store.get(key);
		const result = await Promise.withSignal((signal, resolve, reject) => {
			request.addEventListener("success", (event) => { database.close(); resolve(request.result); }, { signal });
			request.addEventListener("error", (event) => { database.close(); reject(request.error); }, { signal });
		});
		return result;
	}

	async put(key: IDBValidKey, value: unknown): Promise<void> {
		const database = await this.#open();
		const transaction = database.transaction(this.#nameStore, "readwrite");
		const store = transaction.objectStore(this.#nameStore);
		const request = store.put(value, key);
		const result = await Promise.withSignal((signal, resolve, reject) => {
			request.addEventListener("success", (event) => { database.close(); resolve(); }, { signal });
			request.addEventListener("error", (event) => { database.close(); reject(request.error); }, { signal });
		});
		return result;
	}

	async delete(key: IDBValidKey): Promise<void> {
		const database = await this.#open();
		const transaction = database.transaction(this.#nameStore, "readwrite");
		const store = transaction.objectStore(this.#nameStore);
		const request = store.delete(key);
		const result = await Promise.withSignal((signal, resolve, reject) => {
			request.addEventListener("success", (event) => { database.close(); resolve(); }, { signal });
			request.addEventListener("error", (event) => { database.close(); reject(request.error); }, { signal });
		});
		return result;
	}
}
//#endregion
