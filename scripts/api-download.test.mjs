import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main, summarizeFailures } from './api-download.mjs';

const writeServiceConfig = async (schemaDir, service, config) => {
  const dir = join(schemaDir, service);

  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'services.config.json'),
    JSON.stringify(config, null, 2)
  );
};

describe('summarizeFailures', () => {
  const configs = [
    { service: 'account', config: { repo: 'pact-gateway', path: '/a.yaml' } },
    {
      service: 'files',
      config: { repo: 'pact-gateway', path: '/f.yaml', branch: 'develop' },
    },
  ];

  it('returns nothing when every service resolved', () => {
    const results = [
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ];

    expect(summarizeFailures(configs, results)).toEqual([]);
  });

  it('names every rejected service with its repo, path and branch', () => {
    const results = [
      {
        status: 'rejected',
        reason: new Error(
          'GitHub API 404 for PACT-Toolkit/pact-gateway/a.yaml'
        ),
      },
      { status: 'fulfilled', value: undefined },
    ];

    expect(summarizeFailures(configs, results)).toEqual([
      {
        service: 'account',
        repo: 'pact-gateway',
        path: '/a.yaml',
        branch: 'main',
        message: 'GitHub API 404 for PACT-Toolkit/pact-gateway/a.yaml',
      },
    ]);
  });

  it('aggregates every failure, not just the first', () => {
    const results = [
      { status: 'rejected', reason: new Error('not found') },
      { status: 'rejected', reason: new Error('bad branch') },
    ];

    const failures = summarizeFailures(configs, results);

    expect(failures).toHaveLength(2);
    expect(failures[0].service).toBe('account');
    expect(failures[1].service).toBe('files');
    expect(failures[1].branch).toBe('develop');
  });

  it('falls back to String(reason) when the rejection is not an Error', () => {
    const results = [{ status: 'rejected', reason: 'plain string reason' }];

    expect(summarizeFailures([configs[0]], results)[0].message).toBe(
      'plain string reason'
    );
  });
});

describe('main', () => {
  let schemaDir;
  let exitSpy;
  let errorSpy;
  let logSpy;
  let fetchMock;

  beforeEach(async () => {
    schemaDir = await mkdtemp(join(tmpdir(), 'pact-web-api-download-'));
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
    await rm(schemaDir, { recursive: true, force: true });
  });

  it('exits non-zero and names the failing service for a nonexistent repo path/branch, regardless of production flag', async () => {
    await writeServiceConfig(schemaDir, 'account', {
      repo: 'pact-gateway',
      path: '/api/swagger/nonexistent.yaml',
      branch: 'no-such-branch',
      production: false,
    });

    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await main({ schemaDir });

    expect(exitSpy).toHaveBeenCalledWith(1);

    const reported = errorSpy.mock.calls
      .flat()
      .some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('account') &&
          arg.includes('no-such-branch')
      );

    expect(reported).toBe(true);
  });

  it('reports every failing service when more than one config is broken', async () => {
    await writeServiceConfig(schemaDir, 'account', {
      repo: 'pact-gateway',
      path: '/api/swagger/account.yaml',
      branch: 'no-such-branch',
    });
    await writeServiceConfig(schemaDir, 'files', {
      repo: 'pact-gateway',
      path: '/api/swagger/files.yaml',
      branch: 'also-missing',
    });

    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await main({ schemaDir });

    expect(exitSpy).toHaveBeenCalledWith(1);

    const errorText = errorSpy.mock.calls.flat().join('\n');

    expect(errorText).toContain('account');
    expect(errorText).toContain('files');
    expect(errorText).toContain('2 service(s) failed');
  });

  it('does not exit non-zero when every configured service downloads successfully', async () => {
    await writeServiceConfig(schemaDir, 'account', {
      repo: 'pact-gateway',
      path: '/api/swagger/account.yaml',
      branch: 'master',
      production: false,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        encoding: 'base64',
        content: Buffer.from('openapi: 3.0.0').toString('base64'),
      }),
    });

    await main({ schemaDir });

    expect(exitSpy).not.toHaveBeenCalled();

    const written = await readFile(
      join(schemaDir, 'account', 'swagger.yaml'),
      'utf-8'
    );

    expect(written).toBe('openapi: 3.0.0');
  });

  it('skips manual services without downloading and does not fail the run', async () => {
    await writeServiceConfig(schemaDir, 'benchmark', {
      manual: true,
    });

    await main({ schemaDir });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(
      logSpy.mock.calls.flat().some((arg) => String(arg).includes('benchmark'))
    ).toBe(true);
  });
});
