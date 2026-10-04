import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { query as sdkQuery, type CanUseTool, type Options } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { Budget } from './budget'
import { isSafeFetchTarget, type Lookup } from './web'

export type Stage = 'scout' | 'researcher' | 'classifier'

export interface LlmRequest<T> {
  stage: Stage
  system: string
  prompt: string
  /** The reply must parse against this schema (zod at every boundary). */
  schema: z.ZodType<T>
  /** Allow the model to search/fetch the web (researcher only). */
  web?: boolean
}

/** Injectable LLM. Fakes return fixtures; the real one wraps the Claude Agent SDK. */
export interface Llm {
  complete<T>(req: LlmRequest<T>): Promise<T>
}

/** Variables the SDK subprocess may see. Everything else (SUPABASE_*, CURATOR_USER_ID, ...) is withheld. */
const SDK_ENV_ALLOW = [
  'PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'TZ',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL',
  'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy',
] as const

export function buildSdkEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of SDK_ENV_ALLOW) {
    const v = source[k]
    if (v !== undefined && v !== '') out[k] = v
  }
  return out
}

/** Built-in tools that are explicitly disabled; only WebSearch and WebFetch remain, and only for the researcher. */
export const DISALLOWED_TOOLS = [
  'Bash', 'BashOutput', 'KillShell', 'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep',
  'Task', 'Agent', 'TodoWrite', 'Skill', 'SlashCommand', 'ExitPlanMode', 'AskUserQuestion',
]

export type GateDecision = { allow: true } | { allow: false; reason: string }

/** Pure gate: WebSearch passes, WebFetch only for public https URLs (same checks as the validator probe), all else denied. */
export async function gateTool(toolName: string, input: unknown, lookup?: Lookup): Promise<GateDecision> {
  if (toolName === 'WebSearch') return { allow: true }
  if (toolName === 'WebFetch') {
    const url = typeof input === 'object' && input !== null && 'url' in input && typeof input.url === 'string' ? input.url : ''
    return (await isSafeFetchTarget(url, lookup)) ? { allow: true } : { allow: false, reason: 'WebFetch is limited to public https URLs' }
  }
  return { allow: false, reason: `tool ${toolName} is not available` }
}

/**
 * Enforced twice: canUseTool (no tool is pre-approved via allowedTools, so every call reaches it) and a PreToolUse hook
 * that fires regardless of permission rules. Redirects inside WebFetch are not visible here, so the agent host should
 * still be network-isolated.
 */
export function createToolGate(lookup?: Lookup): { canUseTool: CanUseTool; hooks: Options['hooks'] } {
  return {
    canUseTool: async (toolName, input) => {
      const d = await gateTool(toolName, input, lookup)
      return d.allow ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: d.reason }
    },
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (hookInput) => {
              if (hookInput.hook_event_name !== 'PreToolUse') return {}
              const d = await gateTool(hookInput.tool_name, hookInput.tool_input, lookup)
              return d.allow
                ? {}
                : { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.reason } }
            },
          ],
        },
      ],
    },
  }
}

export interface ClaudeLlmOptions {
  model: string
  budget: Budget
  /** Injectable for tests; defaults to the Claude Agent SDK. */
  query?: typeof sdkQuery
  /** Environment to derive the SDK subprocess env from. */
  env?: NodeJS.ProcessEnv
  lookup?: Lookup
}

/**
 * Real implementation. Tools are restricted: no file or shell access, only WebSearch/WebFetch when
 * `web` is set, gated by canUseTool, with permissionMode default and no pre-approved tools so nothing is silently allowed. The
 * subprocess gets an explicit minimal env. Structured output is requested as JSON schema and re-validated with zod.
 */
export function createClaudeLlm({ model, budget, query = sdkQuery, env = process.env, lookup }: ClaudeLlmOptions): Llm {
  return {
    async complete<T>(req: LlmRequest<T>): Promise<T> {
      const caps = budget.start()
      const tools = req.web ? ['WebSearch', 'WebFetch'] : []
      const cwd = mkdtempSync(join(tmpdir(), 'yarns-agent-'))
      const q = query({
        prompt: req.prompt,
        options: {
          model,
          systemPrompt: req.system,
          tools,
          disallowedTools: DISALLOWED_TOOLS,
          permissionMode: 'default',
          ...createToolGate(lookup),
          env: buildSdkEnv(env),
          cwd,
          settingSources: [],
          persistSession: false,
          maxTurns: caps.maxTurns,
          maxBudgetUsd: caps.maxBudgetUsd,
          outputFormat: { type: 'json_schema', schema: z.toJSONSchema(req.schema) as Record<string, unknown> },
        },
      })
      let structured: unknown
      let failure: string | undefined
      try {
        for await (const msg of q) {
          if (msg.type !== 'result') continue
          budget.record(msg.num_turns, msg.total_cost_usd)
          if (msg.subtype === 'success' && !msg.is_error) structured = msg.structured_output
          else failure = msg.subtype
        }
      } finally {
        rmSync(cwd, { recursive: true, force: true })
      }
      if (failure) throw new Error(`${req.stage}: agent run failed (${failure})`)
      return req.schema.parse(structured)
    },
  }
}
