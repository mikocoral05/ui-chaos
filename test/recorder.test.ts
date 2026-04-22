import { beforeEach, describe, expect, it } from 'vitest';
import { ActionRecorder } from '../src/recorder.ts';
import type { RecordedAction } from '../src/types.ts';

describe('ActionRecorder', () => {
  let recorder: ActionRecorder;

  beforeEach(() => {
    recorder = new ActionRecorder(3);
  });

  it('records actions in insertion order', () => {
    const action: RecordedAction = {
      id: 1,
      type: 'click',
      selector: '#submit',
      timestamp: 1000
    };

    recorder.record(action);
    expect(recorder.getHistory()).toEqual([action]);
  });

  it('trims history to the configured max size', () => {
    recorder.record({ id: 1, type: 'click', selector: '#one', timestamp: 1000 });
    recorder.record({ id: 2, type: 'click', selector: '#two', timestamp: 1001 });
    recorder.record({ id: 3, type: 'click', selector: '#three', timestamp: 1002 });
    recorder.record({ id: 4, type: 'click', selector: '#four', timestamp: 1003 });

    const history = recorder.getHistory();
    expect(history).toHaveLength(3);
    expect(history.map((action) => action.id)).toEqual([2, 3, 4]);
  });

  it('clears history on demand', () => {
    recorder.record({ id: 1, type: 'click', selector: '#submit', timestamp: 1000 });
    recorder.clear();
    expect(recorder.getHistory()).toEqual([]);
  });
});
