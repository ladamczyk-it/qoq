/* eslint-disable @typescript-eslint/no-unsafe-call */
import { spawn } from 'child_process';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeCommand } from './command';

import type { ChildProcess } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

const asChildProcess = (value: unknown): ChildProcess => value as ChildProcess;

describe('executeCommand', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  const mockChildProcess = {
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('stdout data'));
        }
      }),
    },
    stderr: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('stderr data'));
        }
      }),
    },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    }),
  };

  it('should execute command with no arguments', async () => {
    mockSpawn.mockReturnValue(asChildProcess(mockChildProcess));

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });

  it('should execute command with multiple arguments', async () => {
    mockSpawn.mockReturnValue(asChildProcess(mockChildProcess));

    const result = await executeCommand('some-command', ['arg1', 'arg2']);
    expect(result).toBe(0);
  });

  it('should reject with error on command execution with error', async () => {
    mockSpawn.mockReturnValue(
      asChildProcess({
        ...mockChildProcess,
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Mock error'));
          }
        }),
      })
    );

    await expect(executeCommand('some-command')).rejects.toThrowError('Mock error');
  });

  it('should resolve with non-zero exit code on command execution with error', async () => {
    mockSpawn.mockReturnValue(
      asChildProcess({
        ...mockChildProcess,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      })
    );

    const result = await executeCommand('some-command');
    expect(result).toBe(1);
  });

  it('should execute command with no output', async () => {
    mockSpawn.mockReturnValue(asChildProcess(mockChildProcess));

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });

  it('should capture and resolve stdout when captureOutput is true', async () => {
    mockSpawn.mockReturnValue(asChildProcess(mockChildProcess));

    const result = await executeCommand('some-command', [], 'inherit', true);
    expect(result).toBe('stdout data');
  });

  it('should resolve with OK when close provides no exit code', async () => {
    mockSpawn.mockReturnValue(
      asChildProcess({
        ...mockChildProcess,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(null);
          }
        }),
      })
    );

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });

  it('should resolve when the child exposes no stdout or stderr streams', async () => {
    mockSpawn.mockReturnValue(
      asChildProcess({
        stdout: null,
        stderr: null,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      })
    );

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });
});
