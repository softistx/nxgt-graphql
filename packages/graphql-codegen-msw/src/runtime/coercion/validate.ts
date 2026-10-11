// graphql 17's `validateInputValue`, as @graphql-tools/executor 2 runs it
// on each variable, walked over the generated input types: the same
// problems, at the same paths, in the same order.
import {
	declared,
	type InputType,
	type InputTypes,
	printType,
	type TypeRef,
} from './document';
import { issueAt, type PlacedIssue } from './issues';
import {
	builtinRefusal,
	enumRefusal,
	objectRefusal,
	scalarRefusal,
} from './messages';

type Path = readonly (string | number)[];
type InputObject = Extract<InputType, { kind: 'input' }>;

/** One value graphql refuses: where, the value there, and why. */
export interface Problem {
	readonly path: Path;
	readonly value: unknown;
	readonly reason: string;
}

/** What a walk reads, and the problems it found so far. */
export interface Walk {
	readonly types: InputTypes;
	readonly issues: readonly PlacedIssue[];
	readonly problems: Problem[];
}

/** Where a walk stands: graphql's path below the variable, and the Zod schema's. */
interface At {
	readonly path: Path;
	/**
	 * From the variable's name. It differs from graphql's where a single
	 * value stands for a list: the schema wraps it (`[0]`), graphql does not.
	 */
	readonly zodPath: Path;
}

/** Walks `value` at `type`, recording each problem in `walk.problems`. */
export function validateValue(
	walk: Walk,
	value: unknown,
	type: TypeRef,
	at: At,
): void {
	if (type.kind === 'non-null') {
		if (value === undefined)
			report(walk, at, value, objectRefusal.notProvided(printType(type)));
		else if (value === null)
			report(walk, at, value, objectRefusal.isNull(printType(type)));
		else validateValue(walk, value, type.of, at);
	} else if (value === null || value === undefined) {
		// A nullable type takes null, and an absent field is the object's.
	} else if (type.kind === 'list') {
		validateList(walk, value, type.of, at);
	} else {
		validateNamed(walk, value, type.name, at);
	}
}

function validateList(walk: Walk, value: unknown, item: TypeRef, at: At): void {
	if (!Array.isArray(value)) {
		validateValue(walk, value, item, { ...at, zodPath: [...at.zodPath, 0] });
		return;
	}
	value.forEach((element, index) => {
		validateValue(walk, element, item, {
			path: [...at.path, index],
			zodPath: [...at.zodPath, index],
		});
	});
}

function validateNamed(walk: Walk, value: unknown, name: string, at: At): void {
	// A name the generated file does not describe is judged as a custom
	// scalar is: refused only where the Zod schema refused it.
	const named: InputType = walk.types[name] ?? { kind: 'scalar' };
	if (named.kind === 'input') {
		validateObject(walk, value, name, named, at);
		return;
	}
	const reason =
		named.kind === 'builtin'
			? builtinRefusal(name, value)
			: named.kind === 'enum'
				? enumRefusal(name, named.values, value)
				: scalarRefusal(name, issueAt(walk.issues, at.zodPath));
	if (reason !== undefined) report(walk, at, value, reason);
}

function validateObject(
	walk: Walk,
	value: unknown,
	name: string,
	type: InputObject,
	at: At,
): void {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		report(walk, at, value, objectRefusal.notAnObject(name, value));
		return;
	}
	const object = value as Record<string, unknown>;
	for (const [field, source] of Object.entries(type.fields)) {
		const { type: fieldType, hasDefault } = declared(source);
		const fieldValue = Object.hasOwn(object, field) ? object[field] : undefined;
		if (fieldValue !== undefined)
			validateValue(walk, fieldValue, fieldType, {
				path: [...at.path, field],
				zodPath: [...at.zodPath, field],
			});
		else if (fieldType.kind === 'non-null' && !hasDefault)
			report(walk, at, object, objectRefusal.missingField(name, field, object));
	}
	const names = Object.keys(type.fields);
	const known: string[] = [];
	for (const key of Object.keys(object)) {
		if (object[key] === undefined) continue;
		if (Object.hasOwn(type.fields, key)) known.push(key);
		else
			report(
				walk,
				at,
				object,
				objectRefusal.unknownField(name, key, names, object),
			);
	}
	if (type.oneOf) validateOneOf(walk, object, name, known, at);
}

/** A `@oneOf` input object: exactly one field, and not null. */
function validateOneOf(
	walk: Walk,
	object: Record<string, unknown>,
	name: string,
	known: readonly string[],
	at: At,
): void {
	const [only] = known;
	if (known.length !== 1 || only === undefined)
		report(walk, at, object, objectRefusal.oneOf(name));
	else if (object[only] === null)
		report(
			walk,
			{ ...at, path: [...at.path, only] },
			object,
			objectRefusal.oneOf(name),
		);
}

function report(walk: Walk, at: At, value: unknown, reason: string): void {
	walk.problems.push({ path: at.path, value, reason });
}
