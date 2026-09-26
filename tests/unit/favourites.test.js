import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFavourite, removeFavourite, reorderFavourites, renameFavourite, recordUse,
  decorateFavourites, suggestions, sortByUse, isValidModelId, FAVOURITES_LIMIT, SUGGESTED
} from '../../src/core/favourites.js';
import { FALLBACK_CATALOGUE } from '../../src/core/model-compat.js';

const CATALOGUE = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000, supported_parameters: ['tools', 'response_format'] },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', context_length: 131072, supported_parameters: ['response_format'] }
];

test('valid OpenRouter model ids are accepted and rubbish is not', () => {
  for (const id of ['openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct', 'openai/gpt-oss-20b:free']) {
    assert.equal(isValidModelId(id), true, id);
  }
  for (const id of ['', 'gpt-4o', '/leading', 'trailing/', 'a b/c', 'javascript:alert(1)']) {
    assert.equal(isValidModelId(id), false, id);
  }
});

test('a favourite is added once and duplicates are refused', () => {
  const first = addFavourite([], 'openai/gpt-4o-mini');
  assert.equal(first.ok, true);
  const second = addFavourite(first.favourites, { id: 'openai/gpt-4o-mini' });
  assert.equal(second.ok, false);
  assert.match(second.error, /already a favourite/);
});

test('an invalid id is refused with an explanation', () => {
  const result = addFavourite([], 'not a model');
  assert.equal(result.ok, false);
  assert.match(result.error, /vendor\/model/);
});

test('the favourites list is capped', () => {
  let favourites = [];
  for (let i = 0; i < FAVOURITES_LIMIT; i++) favourites = addFavourite(favourites, `v${i}/model`).favourites;
  const result = addFavourite(favourites, 'extra/model');
  assert.equal(result.ok, false);
  assert.match(result.error, new RegExp(`up to ${FAVOURITES_LIMIT} favourites`));
});

test('favourites can be removed, renamed and reordered', () => {
  let favourites = addFavourite([], 'a/one').favourites;
  favourites = addFavourite(favourites, 'b/two').favourites;
  favourites = renameFavourite(favourites, 'a/one', 'Daily driver');
  assert.equal(favourites[0].label, 'Daily driver');
  favourites = reorderFavourites(favourites, 0, 1);
  assert.deepEqual(favourites.map(f => f.id), ['b/two', 'a/one']);
  assert.deepEqual(reorderFavourites(favourites, 9, 0).map(f => f.id), ['b/two', 'a/one'], 'out-of-range moves are ignored');
  assert.deepEqual(removeFavourite(favourites, 'b/two').map(f => f.id), ['a/one']);
});

test('use is recorded and drives the default order', () => {
  let favourites = addFavourite([], 'a/one').favourites;
  favourites = addFavourite(favourites, 'b/two').favourites;
  favourites = recordUse(favourites, 'b/two', 1000);
  favourites = recordUse(favourites, 'b/two', 2000);
  assert.equal(favourites[1].useCount, 2);
  assert.deepEqual(sortByUse(favourites).map(f => f.id), ['b/two', 'a/one']);
});

test('favourites are decorated with real capabilities from the catalogue', () => {
  const favourites = [{ id: 'openai/gpt-4o-mini' }, { id: 'meta-llama/llama-3.3-70b-instruct' }];
  const decorated = decorateFavourites(favourites, CATALOGUE, { currentModel: 'openai/gpt-4o-mini' });
  assert.equal(decorated[0].available, true);
  assert.equal(decorated[0].selected, true);
  assert.equal(decorated[0].supportsResearch, true);
  assert.equal(decorated[0].displayName, 'GPT-4o mini');
  assert.equal(decorated[1].supportsResearch, false, 'a model without tools cannot do researched review');
  assert.equal(decorated[1].contextLength, 131072);
});

test('a withdrawn model is kept and explained, not silently dropped', () => {
  const decorated = decorateFavourites([{ id: 'gone/model' }], CATALOGUE);
  assert.equal(decorated.length, 1);
  assert.equal(decorated[0].available, false);
  assert.match(decorated[0].unavailableReason, /not in the current OpenRouter catalogue/);
  assert.equal(decorated[0].supportsResearch, null, 'capability is unknown, not false');
});

test('a custom label wins over the catalogue name', () => {
  const decorated = decorateFavourites([{ id: 'openai/gpt-4o-mini', label: 'Mine' }], CATALOGUE);
  assert.equal(decorated[0].displayName, 'Mine');
});

test('suggestions exclude what is already a favourite and what the catalogue lacks', () => {
  assert.deepEqual(suggestions(FALLBACK_CATALOGUE, []).map(s => s.id), SUGGESTED.map(s => s.id));
  const withOne = suggestions(FALLBACK_CATALOGUE, [{ id: 'openai/gpt-4o-mini' }]);
  assert.ok(!withOne.some(s => s.id === 'openai/gpt-4o-mini'));
  assert.deepEqual(suggestions([{ id: 'only/model' }], []), []);
});

test('malformed stored favourites are discarded on read', () => {
  const decorated = decorateFavourites([null, { id: '' }, 'openai/gpt-4o-mini'], CATALOGUE);
  assert.equal(decorated.length, 1);
  assert.equal(decorated[0].id, 'openai/gpt-4o-mini');
});
