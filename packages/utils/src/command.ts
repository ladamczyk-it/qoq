/* eslint-disable no-redeclare */
import { CommonSpawnOptions, spawn } from 'child_process';

export enum EExitCode {
  OK = 0,
  ERROR = 1,
  EXCEPTION = 2,
}

export async function executeCommand(
  command: string,
  args?: string[],
  stdio?: CommonSpawnOptions['stdio']
): Promise<EExitCode>;
export async function executeCommand(
  command: string,
  args?: string[],
  stdio?: CommonSpawnOptions['stdio'],
  captureOutput?: boolean
): Promise<string>;
export async function executeCommand(
  command: string,
  args: string[] = [],
  stdio: CommonSpawnOptions['stdio'] = 'inherit',
  captureOutput: boolean = false
): Promise<string | EExitCode> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: true,
      stdio,
    });

    let capturedOutput = '';

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        if (captureOutput) {
          capturedOutput += data.toString('utf-8');
        } else {
          process.stdout.write(data.toString('utf-8'));
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString('utf-8'));
      });
    }

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (captureOutput) {
        resolve(capturedOutput);
      } else {
        resolve(code ?? EExitCode.OK);
      }
    });
  });
}
