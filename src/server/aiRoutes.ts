import express, { type Request, type Response } from 'express';
import type { AiAgentRole, UserRole } from '../types';
import { consumePublicRateLimit } from './publicRedaction';
import { getClientIp } from './security';
import { getDb, recordAuditLog, saveDb } from './store';

const AGENT_INSTRUCTIONS: Record<AiAgentRole, string> = {
  student: 'You are an AI Student Tutor for Aloms English Center. Teach English Grammar, Vocabulary, Pronunciation, and Spoken English clearly with Bengali + English explanations and practice examples.',
  teacher: 'You are an AI Teacher Copilot for Aloms English Center. Help educators design HSC/SSC/IELTS lesson plans, board-standard MCQ questions, rubrics, and written feedback.',
  admin: 'You are an AI Admin Strategist for Aloms English Center. Analyze admissions, branch performance, fee collection, and academic KPIs concisely.',
  support: 'You are an AI Student Support Desk for Aloms English Center. Answer questions on enrollment, payments, coupons, branches, and exam rules.',
  learning: 'You are an AI Learning Advisor for Aloms English Center. Build personalized weekly study plans using student exam scores, learning modules, and course progress.',
};

type ChatMessage = { role: 'system' | 'user'; content: string };

async function requestConfiguredAi(messages: ChatMessage[], jsonMode = false): Promise<string> {
  const endpoint = process.env.AI_API_URL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!endpoint || !apiKey || !model) {
    throw new Error('AI provider is not configured. Set AI_API_URL, AI_API_KEY, and AI_MODEL.');
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('AI_API_URL must be a valid HTTPS endpoint.');
  }
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('AI provider endpoint must use HTTPS in production.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`AI provider returned HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI provider returned an empty response.');
  return content;
}

export function createAiRouter(getAuthUser: (req: Request) => { id: string; name: string; role: UserRole } | null) {
  const router = express.Router();

  router.post('/chat', async (req: Request, res: Response) => {
    const agentRole = (['student', 'teacher', 'admin', 'support', 'learning'].includes(String(req.body?.agent))
      ? req.body.agent
      : 'support') as AiAgentRole;
    const message = String(req.body?.message ?? '').trim().slice(0, 1500);
    if (!message) {
      res.status(400).json({ error: 'Please enter a message for the AI Agent.' });
      return;
    }

    const authUser = getAuthUser(req);
    if (agentRole === 'admin' && authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Main Admin authorization is required for AI Admin Strategist.' });
      return;
    }
    if (agentRole === 'teacher' && authUser?.role !== 'admin' && authUser?.role !== 'teacher') {
      res.status(403).json({ error: 'Teacher or Admin authorization is required for AI Teacher Copilot.' });
      return;
    }
    if (agentRole === 'learning' && !authUser) {
      res.status(401).json({ error: 'Please sign in to access personalized AI Study Advisor.' });
      return;
    }
    if (!authUser) {
      const rateCheck = consumePublicRateLimit(`ai-guest:${getClientIp(req)}`, 20, 5 * 60 * 1000);
      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
        res.status(429).json({ error: `Guest AI chat rate limit reached. Try again in ${rateCheck.retryAfterSeconds}s or sign in.` });
        return;
      }
    }

    const db = getDb();
    const contextSummary = agentRole === 'admin' && authUser?.role === 'admin'
      ? `Branches: ${db.branches.length}, Active Courses: ${db.courses.length}, Users: ${db.users.length}, Enrollments: ${db.enrollments.length}, Exam Attempts: ${db.examAttempts.length}.`
      : `Active Courses: ${db.courses.map((course) => `${course.title} (৳${course.price})`).slice(0, 5).join('; ')}.`;

    try {
      const reply = await requestConfiguredAi([
        { role: 'system', content: AGENT_INSTRUCTIONS[agentRole] },
        { role: 'user', content: `Platform Context: ${contextSummary}\n\nUser Question: ${message}` },
      ]);
      if (authUser) {
        recordAuditLog(db, authUser, 'AI_AGENT_QUERY', `agent:${agentRole}`, message.slice(0, 80));
        saveDb(db);
      }
      res.json({ agent: agentRole, reply });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI service unavailable.';
      const unavailable = message.includes('not configured');
      res.status(unavailable ? 503 : 502).json({ error: unavailable ? message : 'AI request failed. Check provider configuration and service logs.' });
    }
  });

  router.post('/generate-questions', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'teacher')) {
      res.status(403).json({ error: 'Teacher or Admin role required for AI question generation.' });
      return;
    }

    const subject = String(req.body?.subject ?? 'HSC English 2nd Paper').trim().slice(0, 120);
    const chapter = String(req.body?.chapter ?? 'Right Form of Verbs').trim().slice(0, 120);
    const count = Math.min(10, Math.max(1, Number(req.body?.count) || 3));
    try {
      const content = await requestConfiguredAi([
        { role: 'system', content: 'Return only valid JSON with a top-level "items" array. Each item must contain prompt, options (exactly four strings), correctIndex (0-3), explanation, and marks.' },
        { role: 'user', content: `Generate ${count} high-quality MCQ questions for Bangladesh HSC/SSC/IELTS students on Subject: "${subject}", Chapter: "${chapter}".` },
      ], true);
      const parsed = JSON.parse(content) as { items?: unknown };
      if (!Array.isArray(parsed.items)) throw new Error('AI provider returned invalid question data.');
      res.json({ items: parsed.items });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI question generation failed.';
      const unavailable = message.includes('not configured');
      res.status(unavailable ? 503 : 502).json({ error: unavailable ? message : 'AI question generation failed. Check provider configuration and service logs.' });
    }
  });

  return router;
}
