// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('server configuration', () => {
  it('uses documented local defaults', () => {
    const config = loadConfig({});

    expect(config.environment).toBe('development');
    expect(config.port).toBe(3001);
    expect(config.databasePath).toMatch(/[\\/]data[\\/]frontier\.sqlite$/);
  });

  it.each([
    [{ NODE_ENV: 'staging' }, 'NODE_ENV'],
    [{ PORT: '-1' }, 'PORT'],
    [{ PORT: 'not-a-number' }, 'PORT'],
    [{ PORT: '65536' }, 'PORT'],
  ])('rejects invalid environment values', (environment, expectedMessage) => {
    expect(() => loadConfig(environment)).toThrow(expectedMessage);
  });
});
