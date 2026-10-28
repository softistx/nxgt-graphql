import { Naming, type NamingConfig, type OperationKind } from './naming';

export type { NamingConfig, OperationKind } from './naming';

/**
 * The name of the schema the plugin writes for an operation's variables, from
 * the plugin's own `config`: `zGetHttpThingQueryVariables`. The plugin names
 * its schemas through the same `Naming.variablesSchema`, so a companion plugin
 * importing this from `@nxgt/graphql-codegen-zod/naming` always agrees with
 * the generated file.
 */
export function variablesSchemaName(
	config: NamingConfig,
	operationName: string,
	operationKind: OperationKind,
): string {
	return new Naming(config).variablesSchema(operationName, operationKind)
		.schema;
}
