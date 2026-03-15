import { describe, expect, it } from 'vitest';

import { DAGParser } from '../engine/dag.js';

describe('DAGParser', () => {
  it('handles a single node', () => {
    const parser = new DAGParser();
    const plan = parser.parse([{ id: 'a', agent: 'x', task: 't' }]);
    expect(plan.order).toEqual(['a']);
    expect(plan.parallelGroups).toEqual([['a']]);
  });

  it('handles linear graph', () => {
    const parser = new DAGParser();
    const plan = parser.parse([
      { id: 'a', agent: 'x', task: 't' },
      { id: 'b', agent: 'x', task: 't', depends_on: ['a'] },
      { id: 'c', agent: 'x', task: 't', depends_on: ['b'] },
    ]);
    expect(plan.order).toEqual(['a', 'b', 'c']);
  });

  it('handles diamond graph', () => {
    const parser = new DAGParser();
    const plan = parser.parse([
      { id: 'a', agent: 'x', task: 't' },
      { id: 'b', agent: 'x', task: 't', depends_on: ['a'] },
      { id: 'c', agent: 'x', task: 't', depends_on: ['a'] },
      { id: 'd', agent: 'x', task: 't', depends_on: ['b', 'c'] },
    ]);
    expect(plan.parallelGroups).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('throws on unknown dependency', () => {
    const parser = new DAGParser();
    expect(() =>
      parser.parse([
        { id: 'a', agent: 'x', task: 't', depends_on: ['missing'] },
        { id: 'b', agent: 'x', task: 't' },
      ]),
    ).toThrow();
  });

  it('throws on cycle', () => {
    const parser = new DAGParser();
    expect(() =>
      parser.parse([
        { id: 'a', agent: 'x', task: 't', depends_on: ['c'] },
        { id: 'b', agent: 'x', task: 't', depends_on: ['a'] },
        { id: 'c', agent: 'x', task: 't', depends_on: ['b'] },
      ]),
    ).toThrow();
  });
});
