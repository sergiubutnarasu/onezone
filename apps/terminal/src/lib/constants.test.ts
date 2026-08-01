import { describe, it, expect } from 'vitest';
import {
  ONEZONE_BASE_LOCATION,
  ONEZONE_PROJECTS_LOCATION,
  IO_SERVER_DISCONNECT,
  COMMAND_EXIT_ACK_TIMEOUT_MS,
  COMMAND_EXIT_WARN_ATTEMPTS,
  TERMINATION_GRACE_MS,
  SERVICE_NAME,
  AGENT_TAG_MAPPINGS,
} from './constants.js';

describe('constants', () => {
  describe('path constants', () => {
    it('ONEZONE_BASE_LOCATION is ".onezone"', () => {
      expect(ONEZONE_BASE_LOCATION).toBe('.onezone');
    });

    it('ONEZONE_PROJECTS_LOCATION combines base with projects', () => {
      expect(ONEZONE_PROJECTS_LOCATION).toBe('.onezone/projects');
    });
  });

  describe('socket constants', () => {
    it('IO_SERVER_DISCONNECT is a branded string literal', () => {
      expect(IO_SERVER_DISCONNECT).toBe('io server disconnect');
    });
  });

  describe('timing constants', () => {
    it('COMMAND_EXIT_ACK_TIMEOUT_MS is 5000', () => {
      expect(COMMAND_EXIT_ACK_TIMEOUT_MS).toBe(5000);
    });

    it('COMMAND_EXIT_WARN_ATTEMPTS is 3', () => {
      expect(COMMAND_EXIT_WARN_ATTEMPTS).toBe(3);
    });

    it('TERMINATION_GRACE_MS is 2000', () => {
      expect(TERMINATION_GRACE_MS).toBe(2000);
    });
  });

  describe('service constants', () => {
    it('SERVICE_NAME is "onezone"', () => {
      expect(SERVICE_NAME).toBe('onezone');
    });
  });

  describe('AGENT_TAG_MAPPINGS', () => {
    it('maps claude-code to itself', () => {
      expect(AGENT_TAG_MAPPINGS['claude-code']).toBe('claude-code');
    });

    it('maps github-copilot-cli to github-copilot', () => {
      expect(AGENT_TAG_MAPPINGS['github-copilot-cli']).toBe('github-copilot');
    });

    it('maps opencode to itself', () => {
      expect(AGENT_TAG_MAPPINGS['opencode']).toBe('opencode');
    });

    it('has exactly 3 entries', () => {
      expect(Object.keys(AGENT_TAG_MAPPINGS)).toHaveLength(3);
    });
  });
});
