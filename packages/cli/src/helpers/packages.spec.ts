import { installPackage } from '@antfu/install-pkg';
import c from 'picocolors';
import { describe, it, expect, vi } from 'vitest';

import { installPackages } from './packages.ts';

vi.mock('@antfu/install-pkg', () => ({
  installPackage: vi.fn(),
}));

describe('installPackages', () => {
  it('should call installPackage for each dependency', async () => {
    // Capture process.stderr.write to check output
    const writeMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const dependencies = ['eslint', 'prettier'];
    await installPackages(dependencies);

    // Ensure that installPackage was called for each dependency
    expect(installPackage).toHaveBeenCalledTimes(dependencies.length);
    expect(installPackage).toHaveBeenCalledWith('eslint', { dev: true });
    expect(installPackage).toHaveBeenCalledWith('prettier', { dev: true });

    // Check if the console output was written correctly
    expect(writeMock).toHaveBeenCalledWith(`Installing ${c.green('eslint')}...\n`);
    expect(writeMock).toHaveBeenCalledWith(`Installing ${c.green('prettier')}...\n`);

    // Restore original implementation
    writeMock.mockRestore();
  });
});
