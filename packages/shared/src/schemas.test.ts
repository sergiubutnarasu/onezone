import { describe, it, expect } from 'vitest';
import {
  CreateProjectSchema,
  CreateTaskSchema,
  SocketAuthSchema,
} from './schemas.js';

describe('CreateProjectSchema', () => {
  const validInput = {
    name: 'My Project',
    description: 'A test project',
    defaultAgentId: 'agent-123',
    defaultModel: 'gpt-4',
  };

  it('accepts a valid project input', () => {
    expect(() => CreateProjectSchema.parse(validInput)).not.toThrow();
    expect(CreateProjectSchema.parse(validInput)).toEqual(validInput);
  });

  it('accepts input without optional description', () => {
    const input = { name: 'Project', defaultAgentId: 'a1', defaultModel: 'm1' };
    expect(() => CreateProjectSchema.parse(input)).not.toThrow();
  });

  it('rejects empty name', () => {
    const input = { ...validInput, name: '' };
    expect(() => CreateProjectSchema.parse(input)).toThrow(/String must contain at least 1 character/);
  });

  it('rejects name exceeding 255 characters', () => {
    const input = { ...validInput, name: 'x'.repeat(256) };
    expect(() => CreateProjectSchema.parse(input)).toThrow(/String must contain at most 255 character/);
  });

  it('rejects description exceeding 1000 characters', () => {
    const input = { ...validInput, description: 'x'.repeat(1001) };
    expect(() => CreateProjectSchema.parse(input)).toThrow(/String must contain at most 1000 character/);
  });

  it('rejects missing defaultAgentId', () => {
    const input = { name: 'Project', defaultModel: 'm1' };
    expect(() => CreateProjectSchema.parse(input)).toThrow(/required/i);
  });

  it('rejects missing defaultModel', () => {
    const input = { name: 'Project', defaultAgentId: 'a1' };
    expect(() => CreateProjectSchema.parse(input)).toThrow(/required/i);
  });

  it('rejects missing name', () => {
    const input = { defaultAgentId: 'a1', defaultModel: 'm1' };
    expect(() => CreateProjectSchema.parse(input)).toThrow(/required/i);
  });
});

describe('CreateTaskSchema', () => {
  const validInput = {
    name: 'My Task',
    description: 'Do something',
    terminalId: 'term-123',
    agentId: 'agent-123',
    model: 'gpt-4',
  };

  it('accepts a valid task input', () => {
    expect(() => CreateTaskSchema.parse(validInput)).not.toThrow();
    expect(CreateTaskSchema.parse(validInput)).toEqual(validInput);
  });

  it('accepts input without optional description', () => {
    const input = {
      name: 'Task',
      terminalId: 't1',
      agentId: 'a1',
      model: 'm1',
    };
    expect(() => CreateTaskSchema.parse(input)).not.toThrow();
  });

  it('rejects empty name', () => {
    const input = { ...validInput, name: '' };
    expect(() => CreateTaskSchema.parse(input)).toThrow(/String must contain at least 1 character/);
  });

  it('rejects name exceeding 255 characters', () => {
    const input = { ...validInput, name: 'x'.repeat(256) };
    expect(() => CreateTaskSchema.parse(input)).toThrow(/String must contain at most 255 character/);
  });

  it('rejects description exceeding 1000 characters', () => {
    const input = { ...validInput, description: 'x'.repeat(1001) };
    expect(() => CreateTaskSchema.parse(input)).toThrow(/String must contain at most 1000 character/);
  });

  it('rejects missing terminalId', () => {
    const input = { name: 'Task', agentId: 'a1', model: 'm1' };
    expect(() => CreateTaskSchema.parse(input)).toThrow(/required/i);
  });

  it('rejects missing agentId', () => {
    const input = { name: 'Task', terminalId: 't1', model: 'm1' };
    expect(() => CreateTaskSchema.parse(input)).toThrow(/required/i);
  });

  it('rejects missing model', () => {
    const input = { name: 'Task', terminalId: 't1', agentId: 'a1' };
    expect(() => CreateTaskSchema.parse(input)).toThrow(/required/i);
  });
});

describe('SocketAuthSchema', () => {
  it('accepts a valid user auth payload', () => {
    const input = { role: 'user' as const };
    expect(() => SocketAuthSchema.parse(input)).not.toThrow();
    expect(SocketAuthSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid terminal auth payload', () => {
    const input = {
      role: 'terminal' as const,
      terminalId: 'term-1',
      terminalName: 'My Terminal',
      terminalHostname: 'host-1',
    };
    expect(() => SocketAuthSchema.parse(input)).not.toThrow();
  });

  it('accepts payload with taskId and projectId', () => {
    const input = {
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      projectId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'user' as const,
    };
    expect(() => SocketAuthSchema.parse(input)).not.toThrow();
  });

  it('accepts minimal payload with only role', () => {
    const input = { role: 'user' as const };
    expect(() => SocketAuthSchema.parse(input)).not.toThrow();
  });

  it('rejects invalid role', () => {
    const input = { role: 'admin' };
    expect(() => SocketAuthSchema.parse(input)).toThrow(/Invalid enum value/);
  });

  it('rejects invalid taskId (non-uuid)', () => {
    const input = { taskId: 'not-a-uuid', role: 'user' as const };
    expect(() => SocketAuthSchema.parse(input)).toThrow(/Invalid uuid/);
  });

  it('rejects invalid projectId (non-uuid)', () => {
    const input = { projectId: 'not-a-uuid', role: 'user' as const };
    expect(() => SocketAuthSchema.parse(input)).toThrow(/Invalid uuid/);
  });

  it('rejects missing role', () => {
    const input = {};
    expect(() => SocketAuthSchema.parse(input)).toThrow(/required/i);
  });

  it('accepts payload with all optional fields omitted', () => {
    const input = { role: 'terminal' as const };
    expect(() => SocketAuthSchema.parse(input)).not.toThrow();
  });
});
