/**
 * CacheManager 服务测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../../renderer/services/cacheManager';

describe('CacheManager', () => {
  let cache: CacheManager<string>;

  beforeEach(() => { cache = new CacheManager<string>({ maxSize: 3, defaultTTL: 1000 }); });
  afterEach(() => { cache.clear(); });

  describe('basic operations', () => {
    it('sets and gets value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('returns undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('checks existence with has()', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('deletes value', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('clears all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('expires after TTL', async () => {
      const shortCache = new CacheManager<string>({ maxSize: 10, defaultTTL: 50 });
      shortCache.set('key', 'value');
      expect(shortCache.get('key')).toBe('value');
      await new Promise(r => setTimeout(r, 100));
      expect(shortCache.get('key')).toBeUndefined();
    });

    it('respects custom TTL per item', async () => {
      cache.set('short', 'value', 50);
      cache.set('long', 'value', 5000);
      await new Promise(r => setTimeout(r, 100));
      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value');
    });
  });

  describe('LRU eviction', () => {
    it('evicts least recently used item', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.get('a'); // access 'a' to make it recently used
      cache.set('d', '4'); // should evict 'b'
      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe('3');
      expect(cache.get('d')).toBe('4');
    });
  });

  describe('getOrSet', () => {
    it('returns existing value without calling factory', () => {
      cache.set('key', 'existing');
      const factory = vi.fn(() => 'new');
      const result = cache.getOrSet('key', factory);
      expect(result).toBe('existing');
      expect(factory).not.toHaveBeenCalled();
    });

    it('calls factory for missing key', () => {
      const factory = vi.fn(() => 'new');
      const result = cache.getOrSet('key', factory);
      expect(result).toBe('new');
      expect(factory).toHaveBeenCalled();
    });
  });

  describe('getOrSetAsync', () => {
    it('returns existing value', async () => {
      cache.set('key', 'existing');
      const factory = vi.fn(async () => 'new');
      const result = await cache.getOrSetAsync('key', factory);
      expect(result).toBe('existing');
      expect(factory).not.toHaveBeenCalled();
    });

    it('awaits factory for missing key', async () => {
      const factory = vi.fn(async () => { await new Promise(r => setTimeout(r, 10)); return 'async'; });
      const result = await cache.getOrSetAsync('key', factory);
      expect(result).toBe('async');
      expect(factory).toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', () => {
      cache.set('key', 'value');
      cache.get('key'); // hit
      cache.get('key'); // hit
      cache.get('missing'); // miss
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 1);
    });
  });
});
