import { Args, Command, Flags } from '@oclif/core';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createAgentSocket } from '../lib/socket-client.js';
import { runProcess } from '../lib/process-runner.js';

export default class Run extends Command {
  static description = 'Connect to a task room and run a command, streaming output in real time';

  static examples = [
    '<%= config.bin %> run --task <taskId> ffprobe -v quiet -print_format json -show_format input.mp4',
    '<%= config.bin %> run --task <taskId> --name my-agent ffmpeg -i input.mp4 output.mp4',
  ];

  static strict = false;

  static flags = {
    task: Flags.string({
      description: 'Task ID to connect to',
      required: true,
    }),
    server: Flags.string({
      description: 'Server URL',
      default: 'http://localhost:5026',
    }),
    name: Flags.string({
      description: 'Agent name (defaults to hostname)',
      default: hostname(),
    }),
    'agent-id': Flags.string({
      description: 'Agent ID (defaults to a random UUID)',
    }),
  };

  static args = {
    command: Args.string({
      description: 'Command to run',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags, argv } = await this.parse(Run);

    // Collect all argv after flags as the full command + args
    // oclif strict=false puts extra args in argv
    const allArgs = argv as string[];
    const cmdName = allArgs[0];
    const cmdArgs = allArgs.slice(1);

    if (!cmdName) {
      this.error('No command specified. Usage: onezone-agent run --task <id> <cmd> [args...]');
    }

    const agentId = flags['agent-id'] || randomUUID();
    const agentName = flags.name;
    const taskId = flags.task;
    const roomId = `task:${taskId}`;

    const socket = createAgentSocket({
      serverUrl: flags.server,
      taskId,
      agentId,
      agentName,
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        this.log(`[${agentName}] Connected to ${flags.server} | room: ${roomId}`);

        socket.emit('agent:command:start', {
          roomId,
          agentId,
          agentName,
          command: [cmdName, ...cmdArgs].join(' '),
        });

        runProcess(
          cmdName,
          cmdArgs,
          (stream, line) => {
            socket.emit('output:line', {
              roomId,
              agentId,
              agentName,
              command: [cmdName, ...cmdArgs].join(' '),
              stream,
              content: line,
            });
            // Mirror to local terminal
            if (stream === 'stderr') {
              process.stderr.write(line + '\n');
            } else {
              process.stdout.write(line + '\n');
            }
          },
          (exitCode) => {
            socket.emit('agent:command:exit', {
              roomId,
              agentId,
              command: [cmdName, ...cmdArgs].join(' '),
              exitCode,
            });
            this.log(`[${agentName}] Command exited with code ${exitCode}`);
            socket.disconnect();
            resolve();
          },
        );
      });

      socket.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });
    });
  }
}
