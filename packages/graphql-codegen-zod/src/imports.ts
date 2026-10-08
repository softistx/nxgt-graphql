/**
 * The named imports of the generated file, one line per module, an alias
 * when two modules export the same name.
 */
export class Imports {
	readonly #byModule = new Map<string, Map<string, string>>([
		['zod', new Map([['z', 'z']])],
	]);
	readonly #taken: Set<string>;

	/** `reserved`: the names the file declares, which no import may take. */
	constructor(reserved: Iterable<string> = []) {
		this.#taken = new Set(['z', ...reserved]);
	}

	/** The local name `exported` from `module` is reached by. */
	add(module: string, exported: string): string {
		const names = this.#byModule.get(module) ?? new Map<string, string>();
		this.#byModule.set(module, names);
		const known = names.get(exported);
		if (known) return known;
		let local = exported;
		for (let n = 2; this.#taken.has(local); n++) local = `${exported}${n}`;
		this.#taken.add(local);
		names.set(exported, local);
		return local;
	}

	/** The import lines, `zod` first, double-quoted as every string the file holds. */
	lines(): string[] {
		return [...this.#byModule].map(
			([module, names]) =>
				`import { ${[...names]
					.map(([exported, local]) =>
						exported === local ? local : `${exported} as ${local}`,
					)
					.join(', ')} } from ${JSON.stringify(module)};`,
		);
	}
}
