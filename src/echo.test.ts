import { describe, test, expect } from 'bun:test';
import { createEchoResponse } from './echo';

describe('createEchoResponse', () => {
  test('returns echo and timestamp for object body', () => {
    const body = { message: 'hello', count: 42 };
    const result = createEchoResponse(body);

    expect(result.echo).toEqual(body);
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  test('returns echo and timestamp for string body', () => {
    const result = createEchoResponse('hello world');

    expect(result.echo).toBe('hello world');
    expect(typeof result.timestamp).toBe('string');
  });

  test('returns echo and timestamp for array body', () => {
    const body = [1, 2, 3];
    const result = createEchoResponse(body);

    expect(result.echo).toEqual([1, 2, 3]);
    expect(typeof result.timestamp).toBe('string');
  });

  test('returns echo and timestamp for null body', () => {
    const result = createEchoResponse(null);

    expect(result.echo).toBeNull();
    expect(typeof result.timestamp).toBe('string');
  });

  test('returns echo and timestamp for empty object', () => {
    const result = createEchoResponse({});

    expect(result.echo).toEqual({});
    expect(typeof result.timestamp).toBe('string');
  });

  test('timestamp is a valid ISO string', () => {
    const before = new Date().toISOString();
    const result = createEchoResponse({ test: true });
    const after = new Date().toISOString();

    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });

  test('preserves nested objects', () => {
    const body = { a: { b: { c: 'deep' } }, arr: [{ x: 1 }] };
    const result = createEchoResponse(body);

    expect(result.echo).toEqual(body);
  });
});
