import { Command, Flags } from "@oclif/core";
import type { KanbanColumn, ProjectInfo } from "@onezone/shared";
import { readFile } from "node:fs/promises";
import { authenticatedFetch } from "../../lib/config.js";

interface BoardColumnInput {
  name: string;
  instructions?: string;
  agentId?: string | null;
  model?: string | null;
}

interface SkillInput {
  source: string;
  skillName: string;
}

function parseColumns(value: unknown): BoardColumnInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Board config must be a JSON array of columns.");
  }

  return value.map((column, index) => {
    if (!column || typeof column !== "object") {
      throw new Error(`Column ${index + 1} must be an object.`);
    }

    const raw = column as Record<string, unknown>;
    if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
      throw new Error(`Column ${index + 1} needs a non-empty name.`);
    }

    return {
      name: raw.name.trim(),
      instructions:
        typeof raw.instructions === "string" ? raw.instructions.trim() : undefined,
      agentId:
        typeof raw.agentId === "string" || raw.agentId === null
          ? raw.agentId
          : undefined,
      model:
        typeof raw.model === "string" || raw.model === null ? raw.model : undefined,
    };
  });
}

function parseSkill(value: string): SkillInput {
  const match = value.match(
    /^(?:npx\s+(?:--yes\s+)?skills\s+add\s+)?(\S+)\s+--skill\s+(.+)$/,
  );
  if (!match) {
    throw new Error(
      `Invalid skill "${value}". Use '<source> --skill <name>' or 'npx skills add <source> --skill <name>'.`,
    );
  }

  const skillName = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  if (skillName.length === 0) {
    throw new Error(`Invalid skill "${value}". Skill name cannot be empty.`);
  }

  return { source: match[1], skillName };
}

function parseSkills(values: string[] | undefined): SkillInput[] {
  if (!values || values.length === 0) return [];

  const skills = values.map(parseSkill);
  return Array.from(
    new Map(skills.map((skill) => [skill.skillName, skill])).values(),
  );
}

async function updateProjectStatus(
  baseUrl: string,
  projectId: string,
  status: ProjectInfo["status"],
): Promise<void> {
  const response = await authenticatedFetch(
    `${baseUrl}/projects/${projectId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    baseUrl,
  );
  if (!response.ok) {
    throw new Error(
      `Failed to mark project ${status}: ${response.status} ${response.statusText}`,
    );
  }
}

export default class ProjectNew extends Command {
  static description = "Create a new project with a generated kanban board";

  static examples = [
    '<%= config.bin %> project new --name "My project" --agent <agentUuid> --model <model> --config ./board.json',
    '<%= config.bin %> project new --project <projectUuid> --name "My project" --agent <agentUuid> --model <model> --config ./board.json',
    '<%= config.bin %> project new --name "My project" --agent <agentUuid> --model <model> --columns \'[{"name":"Plan","instructions":"Clarify scope"}]\'',
    '<%= config.bin %> project new --name "My project" --agent <agentUuid> --model <model> --config ./board.json --skill "vercel-labs/agent-skills --skill nextjs"',
  ];

  static flags = {
    project: Flags.string({
      description: "Existing pending project ID (UUID) to complete",
      required: false,
    }),
    name: Flags.string({
      description: "Project name",
      required: true,
    }),
    description: Flags.string({
      description: "Project description",
      required: false,
    }),
    repository: Flags.string({
      description: "Repository URL",
      required: false,
    }),
    agent: Flags.string({
      description: "Default agent ID (UUID)",
      required: true,
    }),
    model: Flags.string({
      description: "Default model",
      required: true,
    }),
    config: Flags.string({
      description: "Path to a JSON file containing an array of columns",
      required: false,
    }),
    columns: Flags.string({
      description: "Inline JSON array of columns",
      required: false,
    }),
    skill: Flags.string({
      description:
        "Skill to add to the project. Repeatable. Format: '<source> --skill <name>' or 'npx skills add <source> --skill <name>'.",
      multiple: true,
      required: false,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProjectNew);
    const baseUrl = flags.server;

    if (!flags.config && !flags.columns) {
      this.error("Provide --config or --columns.", { exit: 1 });
    }

    if (flags.config && flags.columns) {
      this.error("Use only one of --config or --columns.", { exit: 1 });
    }

    let columns: BoardColumnInput[];
    let skills: SkillInput[];
    try {
      const json = flags.config
        ? await readFile(flags.config, "utf8")
        : flags.columns!;
      columns = parseColumns(JSON.parse(json));
      skills = parseSkills(flags.skill);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (columns.length === 0) {
      this.error("Board config must contain at least one column.", { exit: 1 });
    }

    let pendingProjectId: string | undefined;
    try {
      let project: ProjectInfo;
      if (flags.project) {
        pendingProjectId = flags.project;
        const updateResponse = await authenticatedFetch(
          `${baseUrl}/projects/${flags.project}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: flags.name,
              description: flags.description,
              repository: flags.repository,
              defaultAgentId: flags.agent,
              defaultModel: flags.model,
            }),
          },
          baseUrl,
        );
        if (!updateResponse.ok) {
          this.error(
            `Failed to update project: ${updateResponse.status} ${updateResponse.statusText}`,
            { exit: 1 },
          );
        }
        project = (await updateResponse.json()) as ProjectInfo;
      } else {
        const projectResponse = await authenticatedFetch(
          `${baseUrl}/projects`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: flags.name,
              description: flags.description,
              repository: flags.repository,
              defaultAgentId: flags.agent,
              defaultModel: flags.model,
            }),
          },
          baseUrl,
        );
        if (!projectResponse.ok) {
          this.error(
            `Failed to create project: ${projectResponse.status} ${projectResponse.statusText}`,
            { exit: 1 },
          );
        }
        project = (await projectResponse.json()) as ProjectInfo;
      }

      const listResponse = await authenticatedFetch(
        `${baseUrl}/projects/${project.id}/kanban-columns`,
        {},
        baseUrl,
      );
      if (!listResponse.ok) {
        this.error(
          `Server returned ${listResponse.status}: ${listResponse.statusText}`,
          { exit: 1 },
        );
      }

      const existingColumns = (await listResponse.json()) as KanbanColumn[];
      for (const column of existingColumns) {
        const deleteResponse = await authenticatedFetch(
          `${baseUrl}/projects/${project.id}/kanban-columns/${column.id}`,
          { method: "DELETE" },
          baseUrl,
        );
        if (!deleteResponse.ok) {
          this.error(
            `Failed to delete column ${column.id}: ${deleteResponse.status} ${deleteResponse.statusText}`,
            { exit: 1 },
          );
        }
      }

      const createdColumns: KanbanColumn[] = [];
      for (const column of columns) {
        const columnPayload = {
          ...column,
          agentId: flags.agent,
          model: flags.model,
        };
        const createResponse = await authenticatedFetch(
          `${baseUrl}/projects/${project.id}/kanban-columns`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(columnPayload),
          },
          baseUrl,
        );
        if (!createResponse.ok) {
          this.error(
            `Failed to create column "${column.name}": ${createResponse.status} ${createResponse.statusText}`,
            { exit: 1 },
          );
        }
        createdColumns.push((await createResponse.json()) as KanbanColumn);
      }

      for (const skill of skills) {
        const skillResponse = await authenticatedFetch(
          `${baseUrl}/projects/${project.id}/skills`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(skill),
          },
          baseUrl,
        );
        if (!skillResponse.ok && skillResponse.status !== 409) {
          this.error(
            `Failed to add skill "${skill.skillName}": ${skillResponse.status} ${skillResponse.statusText}`,
            { exit: 1 },
          );
        }
      }

      this.log(`Created project: ${project.id}`);
      this.log(`Created board with ${createdColumns.length} column(s).`);
      if (skills.length > 0) {
        this.log(`Added ${skills.length} skill(s).`);
      }
      for (const column of createdColumns) {
        this.log(`${column.index}: ${column.name} (${column.id})`);
      }

      if (pendingProjectId) {
        await updateProjectStatus(baseUrl, pendingProjectId, "ready");
      }
    } catch (err: unknown) {
      if (pendingProjectId) {
        await updateProjectStatus(baseUrl, pendingProjectId, "failed").catch(() => undefined);
      }
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }
  }
}