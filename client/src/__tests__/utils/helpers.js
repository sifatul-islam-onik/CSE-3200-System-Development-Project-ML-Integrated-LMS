import {
  withRetry,
  debounce,
  throttle,
  safeJsonParse,
  processBatch,
} from '../../utils/helpers';

describe('helpers utils', () => {
  describe('withRetry', () => {
    it('returns result when function succeeds after retries', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('temporary error');
        }
        return 'ok';
      });

      const result = await withRetry(fn, 3, 0);

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws the final error when retries are exhausted', async () => {
      const fn = jest.fn(async () => {
        throw new Error('always fails');
      });

      await expect(withRetry(fn, 2, 0)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns fallback for invalid JSON', () => {
      expect(safeJsonParse('{invalid}', { fallback: true })).toEqual({ fallback: true });
    });
  });

  describe('processBatch', () => {
    it('processes all items in configured batch size', async () => {
      const result = await processBatch([1, 2, 3, 4, 5], async (n) => n * 2, 2);
      expect(result).toEqual([2, 4, 6, 8, 10]);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('executes only once with the last call arguments', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('executes immediately and then ignores calls until limit passes', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith('first');

      jest.advanceTimersByTime(100);
      throttled('third');

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('third');
    });
  });
});