/**
 * Example Tests - 示例测试
 */

import { describe, it, expect, vi } from 'vitest';
import { CacheManager } from '@renderer/services/cacheManager';
import { EventBus } from '@renderer/services/eventBus';

describe('CacheManager', () => {
  it('should set and get values', () => {
    const cache = new CacheManager<string>();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    const cache = new CacheManager<string>();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('should respect TTL', async () => {
    const cache = new CacheManager<string>(100, 50);
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('key')).toBeUndefined();
  });

  it('should evict LRU items when full', () => {
    const cache = new CacheManager<string>(2, 60000);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a'); // 访问 a，增加命中
    cache.set('c', '3'); // 应该淘汰 b
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
  });

  it('should track stats', () => {
    const cache = new CacheManager<string>();
    cache.set('key', 'value');
    cache.get('key'); // hit
    cache.get('missing'); // miss
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });
});

describe('EventBus', () => {
  it('should subscribe and emit events', () => {
    const bus = new EventBus<{ test: string }>();
    const callback = vi.fn();
    bus.on('test', callback);
    bus.emit('test', 'hello');
    expect(callback).toHaveBeenCalledWith('hello');
  });

  it('should handle once subscriptions', () => {
    const bus = new EventBus<{ test: string }>();
    const callback = vi.fn();
    bus.once('test', callback);
    bus.emit('test', 'first');
    bus.emit('test', 'second');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
  });

  it('should unsubscribe correctly', () => {
    const bus = new EventBus<{ test: string }>();
    const callback = vi.fn();
    const unsubscribe = bus.on('test', callback);
    unsubscribe();
    bus.emit('test', 'hello');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should store last event', () => {
    const bus = new EventBus<{ test: string }>();
    bus.emit('test', 'value');
    expect(bus.getLastEvent('test')).toBe('value');
  });

  it('should count listeners', () => {
    const bus = new EventBus<{ test: string }>();
    expect(bus.listenerCount('test')).toBe(0);
    bus.on('test', () => {});
    bus.on('test', () => {});
    expect(bus.listenerCount('test')).toBe(2);
  });
});

describe('Utils', () => {
  it('should debounce function calls', async () => {
    const fn = vi.fn();
    const debounced = (func: () => void, wait: number) => {
      let timeout: NodeJS.Timeout;
      return () => { clearTimeout(timeout); timeout = setTimeout(func, wait); };
    };
    const debouncedFn = debounced(fn, 50);
    debouncedFn();
    debouncedFn();
    debouncedFn();
    expect(fn).not.toHaveBeenCalled();
    await new Promise(r => setTimeout(r, 60));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
