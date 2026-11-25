import { Bot, Send, Sparkles, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { AiAgentRole } from '../types';

const AGENT_OPTIONS: { id: AiAgentRole; label: string; hint: string }[] = [
  { id: 'student', label: 'AI Student Tutor', hint: 'Grammar, Spoken & IELTS practice' },
  { id: 'teacher', label: 'AI Teacher Copilot', hint: 'Lesson plans & rubrics' },
  { id: 'support', label: 'AI Support Desk', hint: 'Fees, bKash 4-step & branches' },
  { id: 'learning', label: 'AI Study Advisor', hint: 'Personalized weekly study plan' },
  { id: 'admin', label: 'AI Admin Strategist', hint: 'Enrollment & branch KPIs' },
];

export function AiChatbotWidget() {
  const { user, apiFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const availableAgents = useMemo(
    () =>
      AGENT_OPTIONS.filter((opt) => {
        if (opt.id === 'admin') return user?.role === 'admin';
        if (opt.id === 'teacher') return user?.role === 'admin' || user?.role === 'teacher';
        if (opt.id === 'learning') return Boolean(user);
        return true;
      }),
    [user]
  );
  const [agent, setAgent] = useState<AiAgentRole>(
    user?.role === 'teacher' ? 'teacher' : user?.role === 'admin' ? 'admin' : 'student'
  );
  useEffect(() => {
    if (!availableAgents.some((opt) => opt.id === agent)) {
      setAgent(availableAgents[0]?.id ?? 'student');
    }
  }, [agent, availableAgents]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; agent?: string }[]
  >([
    {
      role: 'assistant',
      agent: 'Aloms AI Tutor',
      text: 'Assalamu Alaikum! Ask me anything about English Grammar, IELTS Band 8+, HSC/SSC suggestions, or campus admissions.',
    },
  ]);

  const sendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setInput('');
    setLoading(true);
    try {
      const res = await apiFetch<{ reply: string; agent: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ agent, message: prompt }),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', agent: `AI ${res.agent}`, text: res.reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const speakLastReply = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Aloms AI Tutor Chatbot"
        className="fixed bottom-5 left-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#062436] px-4 text-xs font-extrabold text-white shadow-xl border border-amber-400/40 transition-transform hover:scale-105 hover:bg-[#0b3854]"
      >
        <Bot className="h-5 w-5 text-amber-400" />
        <span className="hidden sm:inline">AI Tutor</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Aloms AI Multi-Agent Chatbot"
          className="fixed bottom-20 left-5 z-50 flex h-[480px] w-[min(370px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between bg-[#062436] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <div>
                <h3 className="text-sm font-extrabold">Aloms Specialist AI</h3>
                <p className="text-[10px] text-slate-300">Role-Aware Academic Assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AI chatbot"
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <label htmlFor="ai-widget-agent" className="sr-only">
              Select AI Agent
            </label>
            <select
              id="ai-widget-agent"
              value={agent}
              onChange={(e) => setAgent(e.target.value as AiAgentRole)}
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              {availableAgents.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-2xl p-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-6 bg-indigo-600 text-white'
                    : 'mr-6 border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase text-indigo-600">
                    <span>{m.agent}</span>
                    <button
                      type="button"
                      onClick={() => speakLastReply(m.text)}
                      aria-label="Listen pronunciation"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-indigo-100"
                    >
                      <Volume2 className="h-3 w-3" /> Listen
                    </button>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={sendPrompt} className="flex items-center gap-2 border-t border-slate-200 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask grammar, IELTS, or course question..."
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label="Send message to AI"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
