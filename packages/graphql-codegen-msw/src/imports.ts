/** One name imported from a module: its local name, and whether it is a type only. */
interface Imported {
	readonly local: string;
	readonly type: boolean;
}

/**
 * The named imports of the generated file, one line per module in the order
 * they were first asked for, an alias when a name is taken. A module whose
 * every name is a type is written `import type`.
 */
export class Imports {
	readonly #byModule = new Map<string, Map<string, Imported>>();
	readonly #taken: Set<string>;

	/** `reserved`: the names the file declares, which no import may take. */
	constructor(reserved: Iterable<string> = []) {
		this.#taken = new Set(reserved);
	}

	/** The local name of the value `exported` from `module`. */
	value(module: string, exported: string): string {
		return this.#add(module, exported, false);
	}

	/** The local name of the type `exported` from `module`. */
	type(module: string, exported: string): string {
		return this.#add(module, exported, true);
	}

	#add(module: string, exported: string, type: boolean): string {
		const names = this.#byModule.get(module) ?? new Map<string, Imported>();
		this.#byModule.set(module, names);
		const known = names.get(exported);
		if (known) {
			if (!type && known.type) names.set(exported, { ...known, type: false });
			return known.local;
		}
		let local = exported;
		for (let n = 2; this.#taken.has(local); n++) local = `${exported}${n}`;
		this.#taken.add(local);
		names.set(exported, { local, type });
		return local;
	}

	/** The import lines, double-quoted as every string the file holds. */
	lines(): string[] {
		return [...this.#byModule].map(([module, names]) => {
			const all = [...names];
			const typeOnly = all.every(([, { type }]) => type);
			const specifiers = all.map(([exported, { local, type }]) => {
				const name = exported === local ? local : `${exported} as ${local}`;
				return type && !typeOnly ? `type ${name}` : name;
			});
			return `import ${typeOnly ? 'type ' : ''}{ ${specifiers.join(', ')} } from ${JSON.stringify(module)};`;
		});
	}
}
