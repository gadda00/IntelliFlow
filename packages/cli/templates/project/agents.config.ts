/**
 * Custom agent registration for {{PROJECT_NAME}}
 * ================================================
 *
 * This file is optional. If you only use the built-in Busara agents, you can
 * delete it. If you want to register custom agents, implement them and add
 * them to the array below.
 *
 * See docs/AGENTS.md in the Busara monorepo for a step-by-step guide on
 * writing a new agent.
 */

import type { BaseAgent } from '@busara/agents';

// Example: import your custom agent
// import { MyCustomAgent } from './agents/MyCustomAgent';

/** List of custom agents to register in the local Busara instance. */
export const customAgents: BaseAgent[] = [
  // new MyCustomAgent(),
];

export default customAgents;
