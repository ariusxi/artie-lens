import { existsSync, readFileSync } from 'fs'

import { COMMENT_MARKER } from './comment.helpers'

export interface PullRequestContext {
  token: string
  owner: string
  repo: string
  pr: number
}

const getPullRequestNumber = (env: NodeJS.ProcessEnv): number | null => {
  if (env.GITHUB_EVENT_PATH && existsSync(env.GITHUB_EVENT_PATH)) {
    try {
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf-8'))
      if (event.pull_request?.number) return event.pull_request.number
    } catch {
      // fall through to the ref
    }
  }

  const match = /refs\/pull\/(\d+)\//.exec(env.GITHUB_REF ?? '')
  return match ? Number(match[1]) : null
}

// Reads the pull request context GitHub Actions exposes through the environment.
export const getPullRequestContext = (env: NodeJS.ProcessEnv = process.env): PullRequestContext | null => {
  const token = env.GITHUB_TOKEN
  const repository = env.GITHUB_REPOSITORY
  if (!token || !repository) return null

  const [owner, repo] = repository.split('/')
  const pr = getPullRequestNumber(env)
  if (!owner || !repo || !pr) return null

  return { token, owner, repo, pr }
}

export const postStickyComment = async (context: PullRequestContext, body: string): Promise<void> => {
  const base = `https://api.github.com/repos/${context.owner}/${context.repo}`
  const headers = {
    Authorization: `Bearer ${context.token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'artie-lens',
    'Content-Type': 'application/json',
  }

  const listed = await fetch(`${base}/issues/${context.pr}/comments?per_page=100`, { headers })
  const comments = (await listed.json()) as { id: number; body: string }[]
  const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER))

  if (existing) {
    await fetch(`${base}/issues/comments/${existing.id}`, { method: 'PATCH', headers, body: JSON.stringify({ body }) })
    return
  }

  await fetch(`${base}/issues/${context.pr}/comments`, { method: 'POST', headers, body: JSON.stringify({ body }) })
}
