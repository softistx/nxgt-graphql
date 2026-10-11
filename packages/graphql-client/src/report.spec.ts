import { afterEach, describe, expect, mock, test } from 'bun:test';
import { reportError } from './report';

type Globals = {
	reportError?: ((error: unknown) => void) | undefined;
	queueMicrotask: (task: () => void) => void;
};
const globals = globalThis as unknown as Globals;
const { reportError: originalReport, queueMicrotask: originalQueue } = globals;

afterEach(() => {
	globals.reportError = originalReport;
	globals.queueMicrotask = originalQueue;
});

describe('reportError', () => {
	test('hands the error to globalThis.reportError when there is one', () => {
		const report = mock();
		globals.reportError = report;
		const error = new Error('boom');
		reportError(error);
		expect(report).toHaveBeenCalledWith(error);
	});

	test('else throws it from a microtask, outside the caller', () => {
		globals.reportError = undefined;
		const tasks: (() => void)[] = [];
		globals.queueMicrotask = (task) => tasks.push(task);
		const error = new Error('boom');
		expect(() => reportError(error)).not.toThrow();
		expect(tasks).toHaveLength(1);
		expect(() => tasks[0]?.()).toThrow(error);
	});
});
