import { describe, it, expect } from 'vitest';
import {
  createTaskRoomId,
  extractTaskId,
  createProjectRoomId,
  createUserRoomId,
} from './room-ids.js';

describe('room-ids', () => {
  describe('createTaskRoomId', () => {
    it('prefixes the task id with "task:"', () => {
      expect(createTaskRoomId('abc-123')).toBe('task:abc-123');
    });

    it('handles empty string', () => {
      expect(createTaskRoomId('')).toBe('task:');
    });

    it('handles uuid-like strings', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(createTaskRoomId(uuid)).toBe(`task:${uuid}`);
    });
  });

  describe('extractTaskId', () => {
    it('removes the "task:" prefix', () => {
      expect(extractTaskId('task:abc-123')).toBe('abc-123');
    });

    it('returns the full string when prefix is missing', () => {
      expect(extractTaskId('abc-123')).toBe('abc-123');
    });

    it('handles empty string', () => {
      expect(extractTaskId('')).toBe('');
    });

    it('removes only the first occurrence of "task:"', () => {
      expect(extractTaskId('task:task:123')).toBe('task:123');
    });
  });

  describe('createProjectRoomId', () => {
    it('prefixes the project id with "project:"', () => {
      expect(createProjectRoomId('proj-1')).toBe('project:proj-1');
    });

    it('handles empty string', () => {
      expect(createProjectRoomId('')).toBe('project:');
    });
  });

  describe('createUserRoomId', () => {
    it('prefixes the user id with "user:"', () => {
      expect(createUserRoomId('user-1')).toBe('user:user-1');
    });

    it('handles empty string', () => {
      expect(createUserRoomId('')).toBe('user:');
    });
  });
});
