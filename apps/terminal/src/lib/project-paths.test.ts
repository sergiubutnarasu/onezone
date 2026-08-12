import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'node:path';
import { AgentTag } from '@onezone/shared';
import * as projectPaths from './project-paths.js';
import {
  isRtkAvailable,
  getProjectFolder,
  getProjectWorkDir,
  createProjectFolder,
  createProjectWorkDirFolder,
  ensureWorkDirProjectMarker,
  getAllInstalledSkills,
  removeSkill,
  getRulesContent,
  cloneProjectRepo,
  setupClaudeConfig,
  setupCopilotConfig,
  setupOpencodeConfig,
  setupRules,
} from './project-paths.js';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const TEST_HOME = '/test/home';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => TEST_HOME,
  };
});

const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockRmSync = vi.fn();
const mockCpSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
  cpSync: (...args: unknown[]) => mockCpSync(...args),
}));

const mockExecSync = vi.fn();
const mockExecFile = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
  execSync: (...args: unknown[]) => mockExecSync(...args),
  spawn: vi.fn(),
}));

describe('project-paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockWriteFileSync.mockReturnValue(undefined);
  });

  describe('getProjectFolder', () => {
    it('returns path under home/.onezone/projects', () => {
      const result = getProjectFolder('proj-1');
      expect(result).toBe(path.join(TEST_HOME, '.onezone', 'projects', 'proj-1'));
    });
  });

  describe('config folder removed', () => {
    it('does not export getProjectConfigFolder', () => {
      // @ts-expect-error - function must be removed
      expect(projectPaths.getProjectConfigFolder).toBeUndefined();
    });
    it('does not export createProjectConfigFolder', () => {
      // @ts-expect-error - function must be removed
      expect(projectPaths.createProjectConfigFolder).toBeUndefined();
    });
  });

  describe('getProjectWorkDir', () => {
    it('returns workdir subfolder', () => {
      const result = getProjectWorkDir('proj-1');
      expect(result).toBe(path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir'));
    });
  });

  describe('isRtkAvailable', () => {
    it('returns true when rtk --version succeeds', () => {
      mockExecSync.mockReturnValue('rtk version 1.0.0');
      expect(isRtkAvailable()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('rtk --version', { stdio: 'ignore' });
    });

    it('returns false when rtk --version throws', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found');
      });
      expect(isRtkAvailable()).toBe(false);
    });
  });

  describe('createProjectFolder', () => {
    it('creates folder when it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = createProjectFolder('proj-1');
      expect(result).toBe(true);
      expect(mockMkdirSync).toHaveBeenCalledWith(
        path.join(TEST_HOME, '.onezone', 'projects', 'proj-1'),
        { recursive: true },
      );
    });

    it('returns true when folder already exists', () => {
      mockExistsSync.mockReturnValue(true);
      const result = createProjectFolder('proj-1');
      expect(result).toBe(true);
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('returns false on error', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('permission denied');
      });
      const result = createProjectFolder('proj-1');
      expect(result).toBe(false);
    });
  });

  describe('createProjectWorkDirFolder', () => {
    it('creates workdir folder', () => {
      mockExistsSync.mockReturnValue(false);
      const result = createProjectWorkDirFolder('proj-1');
      expect(result).toBe(true);
      expect(mockMkdirSync).toHaveBeenCalledWith(
        path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir'),
        { recursive: true },
      );
    });
  });



  describe('ensureWorkDirProjectMarker', () => {
    it('creates .gitkeep when missing', () => {
      mockExistsSync.mockReturnValue(false);
      const result = ensureWorkDirProjectMarker('proj-1');
      expect(result).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir', '.gitkeep'),
        '',
        'utf8',
      );
    });

    it('does not recreate .gitkeep when it exists', () => {
      mockExistsSync.mockReturnValue(true);
      const result = ensureWorkDirProjectMarker('proj-1');
      expect(result).toBe(true);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('returns false on error', () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('permission denied');
      });
      const result = ensureWorkDirProjectMarker('proj-1');
      expect(result).toBe(false);
    });
  });

  describe('getAllInstalledSkills', () => {
    it('returns skills for claude agent', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('.claude'));
      mockReaddirSync.mockReturnValue(['skill-a', 'skill-b']);

      const result = getAllInstalledSkills('proj-1', AgentTag.ClaudeCode);
      expect(result).toContain('skill-a');
      expect(result).toContain('skill-b');
    });

    it('returns skills for copilot agent from both dirs', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('skills'));
      mockReaddirSync.mockReturnValue(['copilot-skill']);

      const result = getAllInstalledSkills('proj-1', AgentTag.GithubCopilotCLI);
      // Should read from both .github/skills and .agents/skills
      expect(mockReaddirSync).toHaveBeenCalledTimes(2);
      expect(result).toContain('copilot-skill');
    });

    it('returns empty array when skills dir does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = getAllInstalledSkills('proj-1', AgentTag.ClaudeCode);
      expect(result).toEqual([]);
    });

    it('returns empty array on error', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('fs error');
      });
      const result = getAllInstalledSkills('proj-1', AgentTag.ClaudeCode);
      expect(result).toEqual([]);
    });
  });

  describe('removeSkill', () => {
    it('removes skill directory when found', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('skill-to-remove'));
      mockRmSync.mockReturnValue(undefined);

      const result = removeSkill('proj-1', 'skill-to-remove', AgentTag.ClaudeCode);
      expect(result).toBe(true);
      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('skill-to-remove'),
        { recursive: true, force: true },
      );
    });

    it('returns false when skill not found', () => {
      mockExistsSync.mockReturnValue(false);
      const result = removeSkill('proj-1', 'missing-skill', AgentTag.ClaudeCode);
      expect(result).toBe(false);
      expect(mockRmSync).not.toHaveBeenCalled();
    });

    it('returns false on error', () => {
      mockExistsSync.mockReturnValue(true);
      mockRmSync.mockImplementation(() => {
        throw new Error('rm error');
      });
      const result = removeSkill('proj-1', 'skill-to-remove', AgentTag.ClaudeCode);
      expect(result).toBe(false);
    });
  });

  describe('getRulesContent', () => {
    it('returns content when rules.md exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('# Rules\n\nTest rules');
      const result = getRulesContent();
      expect(result).toBe('# Rules\n\nTest rules');
    });

    it('returns undefined when rules.md does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = getRulesContent();
      expect(result).toBeUndefined();
    });
  });

  describe('cloneProjectRepo', () => {
    beforeEach(() => {
      mockExecFile.mockReset();
    });

    it('returns true when .git already exists', async () => {
      mockExistsSync.mockImplementation((p: string) =>
        typeof p === 'string' && p.includes('.git')
      );
      const result = await cloneProjectRepo('proj-1', 'https://github.com/user/repo');
      expect(result).toBe(true);
    });

    it('returns false when signal is aborted', async () => {
      mockExistsSync.mockReturnValue(false);
      const abortController = new AbortController();
      abortController.abort();
      const result = await cloneProjectRepo('proj-1', 'https://github.com/user/repo', abortController.signal);
      expect(result).toBe(false);
    });

    it('converts https to ssh and clones successfully', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFile.mockImplementation((...args: unknown[]) => {
        const cb = args[args.length - 1] as (err: Error | null) => void;
        cb(null);
      });
      const result = await cloneProjectRepo('proj-1', 'https://github.com/user/repo');
      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--single-branch', '--depth', '1', 'git@github.com:user/repo.git', expect.any(String)],
        { signal: undefined },
        expect.any(Function),
      );
    });

    it('handles clone errors gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFile.mockImplementation((...args: unknown[]) => {
        const cb = args[args.length - 1] as (err: Error | null) => void;
        cb(new Error('clone failed'));
      });
      const result = await cloneProjectRepo('proj-1', 'https://github.com/user/repo');
      expect(result).toBe(false);
    });

    it('handles AbortError silently', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFile.mockImplementation((...args: unknown[]) => {
        const cb = args[args.length - 1] as (err: Error | null) => void;
        const err = new Error('aborted');
        (err as { name?: string }).name = 'AbortError';
        cb(err);
      });
      const result = await cloneProjectRepo('proj-1', 'https://github.com/user/repo');
      expect(result).toBe(false);
    });
  });

  describe('setupClaudeConfig', () => {
    it('copies skills into the workdir .claude/skills', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['onezone-runner']);
      const result = setupClaudeConfig('proj-1');
      expect(result).toBe(true);
      const workdir = path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir');
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('onezone-runner'),
        path.join(workdir, '.claude', 'skills', 'onezone-runner'),
        { recursive: true },
      );
    });

    it('warns when skills folder not found', () => {
      mockExistsSync.mockImplementation((p: string) =>
        typeof p === 'string' && !p.includes('static')
      );
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = setupClaudeConfig('proj-1');
      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skills folder not found'));
      warnSpy.mockRestore();
    });

    it('returns false on error', () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('mkdir error');
      });
      const result = setupClaudeConfig('proj-1');
      expect(result).toBe(false);
    });
  });

  describe('setupCopilotConfig', () => {
    it('copies skills into the workdir .github/skills and .agents/skills', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['onezone-runner']);
      const result = setupCopilotConfig('proj-1');
      expect(result).toBe(true);
      const workdir = path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir');
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('onezone-runner'),
        path.join(workdir, '.github', 'skills', 'onezone-runner'),
        { recursive: true },
      );
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('onezone-runner'),
        path.join(workdir, '.agents', 'skills', 'onezone-runner'),
        { recursive: true },
      );
    });

    it('returns false on error', () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('mkdir error');
      });
      const result = setupCopilotConfig('proj-1');
      expect(result).toBe(false);
    });
  });

  describe('setupOpencodeConfig', () => {
    it('copies skills into the workdir .opencode/skills', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['onezone-runner']);
      const result = setupOpencodeConfig('proj-1');
      expect(result).toBe(true);
      const workdir = path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir');
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('onezone-runner'),
        path.join(workdir, '.opencode', 'skills', 'onezone-runner'),
        { recursive: true },
      );
    });

    it('returns false on error', () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('mkdir error');
      });
      const result = setupOpencodeConfig('proj-1');
      expect(result).toBe(false);
    });
  });

  describe('createProjectWorkDirFolder error', () => {
    it('returns false on mkdir error', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('permission denied');
      });
      const result = createProjectWorkDirFolder('proj-1');
      expect(result).toBe(false);
    });
  });



  describe('getAllInstalledSkills with github-copilot-cli and opencode', () => {
    it('returns skills for github-copilot-cli agent', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('skills'));
      mockReaddirSync.mockReturnValue(['gh-skill']);
      const result = getAllInstalledSkills('proj-1', AgentTag.GithubCopilotCLI);
      expect(mockReaddirSync).toHaveBeenCalledTimes(2);
      expect(result).toContain('gh-skill');
    });

    it('returns skills for opencode agent', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('skills'));
      mockReaddirSync.mockReturnValue(['oc-skill']);
      const result = getAllInstalledSkills('proj-1', AgentTag.Opencode);
      expect(mockReaddirSync).toHaveBeenCalledTimes(2);
      expect(result).toContain('oc-skill');
    });
  });

  describe('setupRules', () => {
    it('writes rules.md content to workdir CLAUDE.md and AGENTS.md', () => {
      mockReadFileSync.mockReturnValue('# Rules');
      mockExistsSync.mockReturnValue(true);
      const result = setupRules('proj-1');
      expect(result).toBe(true);
      const workdir = path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir');
      expect(mockWriteFileSync).toHaveBeenCalledWith(path.join(workdir, 'CLAUDE.md'), '# Rules', 'utf8');
      expect(mockWriteFileSync).toHaveBeenCalledWith(path.join(workdir, 'AGENTS.md'), '# Rules', 'utf8');
    });
  });
});
