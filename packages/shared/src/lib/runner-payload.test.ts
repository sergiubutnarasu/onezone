import { describe, it, expect } from 'vitest';
import {
  RUNNER_PROMPT_PREFIX,
  BYPASS_RUNNER_PROMPT_PREFIX,
  parseRunnerPayload,
} from './runner-payload.js';

describe('runner-payload', () => {
  describe('prefix constants', () => {
    it('RUNNER_PROMPT_PREFIX contains "onezone-runner"', () => {
      expect(RUNNER_PROMPT_PREFIX).toContain('onezone-runner');
      expect(RUNNER_PROMPT_PREFIX).toContain('$ARGUMENTS[0]');
    });

    it('BYPASS_RUNNER_PROMPT_PREFIX contains "onezone-bypass-runner"', () => {
      expect(BYPASS_RUNNER_PROMPT_PREFIX).toContain('onezone-bypass-runner');
      expect(BYPASS_RUNNER_PROMPT_PREFIX).toContain('$ARGUMENTS[0]');
    });

    it('prefixes are different', () => {
      expect(RUNNER_PROMPT_PREFIX).not.toBe(BYPASS_RUNNER_PROMPT_PREFIX);
    });
  });

  describe('parseRunnerPayload', () => {
    it('parses a valid runner payload', () => {
      const payload = { projectId: 'p1', taskId: 't1' };
      const command = `${RUNNER_PROMPT_PREFIX}\n\n${JSON.stringify(payload)}`;
      expect(parseRunnerPayload(command)).toEqual(payload);
    });

    it('parses a valid bypass runner payload', () => {
      const payload = { projectId: 'p1', taskId: 't1' };
      const command = `${BYPASS_RUNNER_PROMPT_PREFIX}\n\n${JSON.stringify(payload)}`;
      expect(parseRunnerPayload(command)).toEqual(payload);
    });

    it('returns null for a command without a known prefix', () => {
      expect(parseRunnerPayload('some random command')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseRunnerPayload('')).toBeNull();
    });

    it('returns null when JSON is malformed', () => {
      const command = `${RUNNER_PROMPT_PREFIX} not-json`;
      expect(parseRunnerPayload(command)).toBeNull();
    });

    it('returns null when prefix matches but there is no JSON', () => {
      const command = `${RUNNER_PROMPT_PREFIX} `;
      expect(parseRunnerPayload(command)).toBeNull();
    });

    it('handles nested JSON objects', () => {
      const payload = { nested: { a: 1, b: [2, 3] } };
      const command = `${RUNNER_PROMPT_PREFIX} ${JSON.stringify(payload)}`;
      expect(parseRunnerPayload(command)).toEqual(payload);
    });

    it('handles arrays as payload', () => {
      const payload = [1, 2, 3];
      const command = `${RUNNER_PROMPT_PREFIX} ${JSON.stringify(payload)}`;
      expect(parseRunnerPayload(command)).toEqual(payload);
    });

    it('trims whitespace between prefix and JSON', () => {
      const payload = { key: 'value' };
      const command = `${RUNNER_PROMPT_PREFIX}   \n\n  ${JSON.stringify(payload)}`;
      expect(parseRunnerPayload(command)).toEqual(payload);
    });
  });
});
