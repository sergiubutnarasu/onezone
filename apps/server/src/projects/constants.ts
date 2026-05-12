const PLANNING_INSTRUCTIONS = `
Your task is to analyze the user's project description and generate a structured plan for how to approach the project. This includes:
1. Breaking down the project into smaller, manageable tasks.
2. Providing a suggested project structure (e.g., folders, files) based on the project's needs.
3. Offering guidance on the next steps to take in order to move the project forward.

When generating the project structure, consider the following:
- The type of project (e.g., web development, data analysis, machine learning).
- The technologies and tools that may be relevant to the project.
- Best practices for organizing code and resources.

When providing guidance on next steps, consider:
- The initial setup required for the project (e.g., setting up a development environment, installing dependencies).
- The key milestones or deliverables that should be targeted.
- Any potential challenges or considerations that the user should be aware of.  

Please provide your analysis and plan in a clear and organized manner, using bullet points or numbered lists where appropriate.

# RULES
1. Create a plan file under the \`workdir/.onezone/\` directory with the name \`project-plan.md\` that contains the structured plan for the project.
2. Add your analysis and plan to the \`project-plan.md\` file in a clear and organized manner, using bullet points or numbered lists where appropriate.

**Important**: Do not wait for the user input. If need the user input, please make a reasonable assumption and continue with the task.

---
`;

const IN_PROGRESS_INSTRUCTIONS = `
 Your task is to read the \`workdir/.onezone/project-plan.md\` file, which contains a structured plan for a project, and then implement the tasks and structure defined in that plan.

When developing based on the project plan, consider the following:

- The specific tasks that need to be completed as outlined in the project plan.
- The suggested project structure (e.g., folders, files) that should be created based on the project's needs.
- The technologies and tools that may be relevant to the project, as mentioned in the project plan.
- Best practices for organizing code and resources, as well as any guidance on next steps provided in the project plan.

Please implement the tasks and structure defined in the \`project-plan.md\` file in a clear and organized manner, following the guidelines and best practices mentioned in the plan.

**Important**: Do not wait for the user input. If need the user input, please make a reasonable assumption and continue with the task.

---
`;

const TESTING_INSTRUCTIONS = `
Your task is to read the \`workdir/.onezone/project-plan.md\` file, which contains a structured plan for a project, and then test the implementation of the project based on that plan.

When testing the implementation, consider the following:

- Whether the specific tasks outlined in the project plan have been implemented correctly and are functioning as intended.
- Whether the suggested project structure (e.g., folders, files) has been created appropriately based on the project's needs.
- Whether the technologies and tools mentioned in the project plan have been utilized correctly and are working as expected.
- Whether best practices for organizing code and resources have been followed, as well as any guidance on next steps provided in the project plan.

Please provide a detailed report of your testing results, highlighting any issues or discrepancies found in the implementation compared to the project plan, as well as any suggestions for improvement or further testing that may be needed.

**Important**: Do not wait for the user input. If need the user input, please make a reasonable assumption and continue with the task.

---
`;

const IN_REVIEW_INSTRUCTIONS = `
Your task is to read the \`workdir/.onezone/project-plan.md\` file, which contains a structured plan for a project, and then review the implementation of the project based on that plan.

When reviewing the implementation, consider the following:

- Whether the specific tasks outlined in the project plan have been completed effectively.
- Whether the suggested project structure (e.g., folders, files) has been followed appropriately based on the project's needs.
- Whether the technologies and tools mentioned in the project plan have been utilized correctly and effectively.
- Whether best practices for organizing code and resources have been followed, as well as any guidance on next steps provided in the project plan.

Please provide your feedback and suggestions for improvement in a clear and organized manner, highlighting any areas where the implementation may not align with the project plan or where there may be opportunities for enhancement.

**Important**: Do not wait for the user input. If need the user input, please make a reasonable assumption and continue with the task.

---
`;

export const DEFAULT_KANBAN_COLUMNS = [
  { name: "Planning", instructions: PLANNING_INSTRUCTIONS, index: 0 },
  { name: "In Progress", instructions: IN_PROGRESS_INSTRUCTIONS, index: 1 },
  { name: "Testing", instructions: TESTING_INSTRUCTIONS, index: 2 },
  { name: "In Review", instructions: IN_REVIEW_INSTRUCTIONS, index: 3 },
];
