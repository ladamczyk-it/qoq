/* eslint-disable @typescript-eslint/no-unsafe-call */
import { spawn } from 'child_process';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeCommand } from './command';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

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
    mockSpawn.mockReturnValue(mockChildProcess);

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });

  it('should execute command with multiple arguments', async () => {
    mockSpawn.mockReturnValue(mockChildProcess);

    const result = await executeCommand('some-command', ['arg1', 'arg2']);
    expect(result).toBe(0);
  });

  it('should reject with error on command execution with error', async () => {
    mockSpawn.mockReturnValue({
      ...mockChildProcess,
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('Mock error'));
        }
      }),
    });

    await expect(executeCommand('some-command')).rejects.toThrowError('Mock error');
  });

  it('should resolve with non-zero exit code on command execution with error', async () => {
    mockSpawn.mockReturnValue({
      ...mockChildProcess,
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(1);
        }
      }),
    });

    const result = await executeCommand('some-command');
    expect(result).toBe(1);
  });

  it('should execute command with no output', async () => {
    mockSpawn.mockReturnValue(mockChildProcess);

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });

  it('should capture and resolve stdout when captureOutput is true', async () => {
    mockSpawn.mockReturnValue(mockChildProcess);

    const result = await executeCommand('some-command', [], 'inherit', true);
    expect(result).toBe('stdout data');
  });

  it('should resolve with OK when close provides no exit code', async () => {
    mockSpawn.mockReturnValue({
      ...mockChildProcess,
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(null);
        }
      }),
    });

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });

  it('should resolve when the child exposes no stdout or stderr streams', async () => {
    mockSpawn.mockReturnValue({
      stdout: null,
      stderr: null,
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      }),
    });

    const result = await executeCommand('some-command');
    expect(result).toBe(0);
  });
});
