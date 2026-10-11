import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
	BookCard,
	BookQuery,
	book,
	TickSubscription,
	url,
	withClient,
} from '../../test/react';
import { normalizedCache } from '../cache/normalized-cache';
import { createGraphQLClient } from '../client';
import type { GraphQLClient } from '../options';
import { useFragment } from './use-fragment';
import { useQuery } from './use-query';
import { useSubscription } from './use-subscription';

/** No DOM here: a server render, as an application's SSR runs it. */
function render(client: GraphQLClient, view: () => string): string {
	const View = () => view();
	const Wrapper = withClient(client);
	return renderToString(
		createElement(Wrapper, { children: createElement(View) }),
	);
}

function counting(cache = false) {
	let requests = 0;
	const client = createGraphQLClient({
		url,
		fetch: async () => {
			requests++;
			return Response.json({ data: {} });
		},
		...(cache && { cache: normalizedCache() }),
	});
	return { client, requests: () => requests };
}

describe('a server render', () => {
	test('sends no query and no subscription: it renders loading', async () => {
		const { client, requests } = counting();
		const html = render(client, () => {
			const { loading } = useQuery(BookQuery, { id: '1' });
			const { active } = useSubscription(TickSubscription, { room: 'a' });
			return `${loading ? 'loading' : 'done'} ${active}`;
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(html).toBe('loading true');
		expect(requests()).toBe(0);
	});

	test('renders what the cache holds', () => {
		const { client, requests } = counting(true);
		client.cache?.write(BookQuery, { id: '1' }, { book: book('Dune') });
		const html = render(client, () => {
			const { data, loading } = useQuery(BookQuery, { id: '1' });
			const card = useFragment(BookCard, 'Book:1');
			return `${data?.book.title} ${loading} ${card?.title}`;
		});
		expect(html).toBe('Dune false Dune');
		expect(requests()).toBe(0);
	});
});
