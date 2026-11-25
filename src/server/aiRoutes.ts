import { GoogleGenAI, Type } from '@google/genai';
import express, { type Request, type Response } from 'express';
import type { AiAgentRole, UserRole } from '../types';
import { consumePublicRateLimit } from './publicRedaction';
import { getClientIp } from './security';
import { getDb, recordAuditLog, saveDb } from './store';

const AGENT_INSTRUCTIONS: Record<AiAgentRole, string> = {
  student:
    'You are AI Student Tutor for Aloms English Center. Teach English Grammar, Vocabulary, Pronunciation, and Spoken English clearly with Bengali + English explanations and practice examples.',
  teacher:
    'You are AI Teacher Copilot for Aloms English Center. Help educators design HSC/SSC/IELTS lesson plans, board-standard MCQ questions, rubrics, and written feedback.',
  admin:
    'You are AI Admin Strategist for Aloms English Center. Analyze admissions, branch performance, fee collection, and academic KPIs concisely.',
  support:
    'You are AI Student Support Desk for Aloms English Center. Answer questions on enrollment, bKash/Nagad/Rocket/Card 4-step checkout, coupons, branches (Mirpur, Uttara, Chattogram), and exam rules.',
  learning:
    'You are AI Learning Advisor for Aloms English Center. Build personalized weekly study plans using student exam scores, SCORM modules, and course progress.',
};

function createGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'edupro-lms',
      },
    },
  });
}

export function createAiRouter(getAuthUser: (req: Request) => { id: string; name: string; role: UserRole } | null) {
  const router = express.Router();

  router.post('/chat', async (req: Request, res: Response) => {
    const agentRole = (['student', 'teacher', 'admin', 'support', 'learning'].includes(
      String(req.body?.agent)
    )
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
        res.status(429).json({
          error: `Guest AI chat rate limit reached. Try again in ${rateCheck.retryAfterSeconds}s or sign in.`,
        });
        return;
      }
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in environment secrets. Please set it in Settings > Secrets to activate live Gemini AI agents.',
      });
      return;
    }

    const db = getDb();
    const contextSummary =
      agentRole === 'admin' && authUser?.role === 'admin'
        ? `Branches: ${db.branches.length}, Active Courses: ${db.courses.length}, Students/Users: ${db.users.length}, Enrollments: ${db.enrollments.length}, Exam Attempts: ${db.examAttempts.length}.`
        : `Active Courses: ${db.courses.map((c) => `${c.title} (৳${c.price})`).slice(0, 5).join('; ')}. Branches: Mirpur DOHS, Uttara Sector 7, Chattogram GEC.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Platform Context: ${contextSummary}\n\nUser Question: ${message}`,
        config: {
          systemInstruction: AGENT_INSTRUCTIONS[agentRole],
        },
      });
      const reply = response.text?.trim() || 'No response generated.';
      if (authUser) {
        recordAuditLog(
          db,
          authUser,
          'AI_AGENT_QUERY',
          `agent:${agentRole}`,
          message.slice(0, 80)
        );
        saveDb(db);
      }
      res.json({ agent: agentRole, reply });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI service error';
      res.status(502).json({ error: `AI request failed: ${msg}` });
    }
  });

  router.post('/generate-questions', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'teacher')) {
      res.status(403).json({ error: 'Teacher or Admin role required for AI question generation.' });
      return;
    }
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in environment secrets. Use Bulk Text/JSON Import or add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const subject = String(req.body?.subject ?? 'HSC English 2nd Paper').trim();
    const chapter = String(req.body?.chapter ?? 'Right Form of Verbs').trim();
    const count = Math.min(10, Math.max(1, Number(req.body?.count) || 3));

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate ${count} high-quality MCQ questions for Bangladesh HSC/SSC/IELTS students on Subject: "${subject}", Chapter: "${chapter}". Each question must have exactly 4 options and clear grammar explanation.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                marks: { type: Type.INTEGER },
              },
            },
          },
        },
      });

      const items = JSON.parse((response.text ?? '[]').trim());
      res.json({ items });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      res.status(502).json({ error: `AI question generation failed: ${msg}` });
    }
  });

  return router;
}
