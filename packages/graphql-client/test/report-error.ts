/**
 * Replaces `globalThis.reportError` with one that records what it gets, for
 * the specs of errors reported rather than thrown. `restore` puts it back.
 */
export function stubReportError() {
	const errors: unknown[] = [];
	const target = globalThis as {
		reportError?: ((error: unknown) => void) | undefined;
	};
	const original = target.reportError;
	target.reportError = (error) => {
		errors.push(error);
	};
	return {
		errors,
		restore: () => {
			target.reportError = original;
		},
	};
}
