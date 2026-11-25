import {
  Award,
  Flame,
  Heart,
  Lock,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../context/AuthContext';
import type { CategoryItem, CommunityPost } from '../types';

interface LeaderboardRow {
  userId: string;
  displayName: string;
  isMasked: boolean;
  branchName: string;
  xp: number;
  level: number;
  streakDays: number;
  badges: string[];
}

export function CommunityPage() {
  const { user, apiFetch } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [activeCat, setActiveCat] = useState('All');
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Exam Strategy & Tips');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState('');
  const [commentTextByPost, setCommentTextByPost] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public/community');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
        setCategories(data.categories ?? []);
        setLeaderboard(data.leaderboard ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setMsg(null);
    const res = await apiFetch<{ post: CommunityPost }>('/api/portal/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: newTitle.trim(),
        category: newCategory,
        content: newContent.trim(),
        image: newImage.trim() || undefined,
      }),
    });
    setPosts((prev) => [res.post, ...prev]);
    setNewTitle('');
    setNewContent('');
    setNewImage('');
    setMsg('Discussion post published to the AEC Community.');
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const res = await apiFetch<{ post: CommunityPost }>(`/api/community/posts/${postId}/like`, {
      method: 'POST',
    });
    setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
  };

  const handleComment = async (postId: string) => {
    const text = (commentTextByPost[postId] ?? '').trim();
    if (!text || !user) return;
    const res = await apiFetch<{ post: CommunityPost }>(`/api/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
    setCommentTextByPost((prev) => ({ ...prev, [postId]: '' }));
  };

  const filteredPosts =
    activeCat === 'All' ? posts : posts.filter((p) => p.category === activeCat);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#062436] via-[#0b3954] to-[#1e1b4b] p-8 text-white shadow-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">
            <Trophy className="h-3.5 w-3.5" /> Study Community & Privacy-Aware Rewards
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            AEC Community, Blog & XP Leaderboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-sky-100">
            Read HSC/SSC/IELTS grammar articles by our faculty, ask study questions, and track
            verified XP, streaks, and achievement badges.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Blog & Community Feed */}
          <div className="space-y-6 lg:col-span-8">
            <div className="flex flex-wrap gap-2">
              {['All', ...categories.filter((c) => c.type === 'post').map((c) => c.name)].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCat(cat)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeCat === cat
                        ? 'bg-[#062436] text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {user && (
              <form
                onSubmit={handleCreatePost}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Plus className="h-4 w-4 text-indigo-600" />
                    <span>Publish Article or Study Question</span>
                  </h2>
                  <select
                    aria-label="Post Category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold"
                  >
                    <option value="Exam Strategy & Tips">Exam Strategy & Tips</option>
                    <option value="Grammar Clinics">Grammar Clinics</option>
                    <option value="IELTS Band 8 Guide">IELTS Band 8 Guide</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Headline or question title..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Share grammar notes, exam advice, or ask a question..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <ImageUploadField
                  label="Attach Study Photo / Diagram (Optional · Device Upload & My Storage)"
                  value={newImage}
                  onChange={setNewImage}
                  category="community"
                />
                <div className="flex items-center justify-between">
                  {msg ? <p className="text-xs font-semibold text-emerald-700">{msg}</p> : <span />}
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Publish Post
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">Loading community feed...</p>
            ) : (
              filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                >
                  {post.image && (
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-52 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-bold text-sky-700">
                        {post.category}
                      </span>
                      <span className="text-slate-500">
                        {post.authorName} · <strong className="uppercase">{post.authorRole}</strong>
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-extrabold text-slate-900">{post.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {post.content}
                    </p>

                    <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => void handleLike(post.id)}
                        disabled={!user}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Heart className="h-3.5 w-3.5" />
                        <span>{post.likes} Likes</span>
                      </button>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {post.comments.length} Comments
                      </span>
                    </div>

                    {post.comments.length > 0 && (
                      <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                        {post.comments.map((c) => (
                          <div key={c.id} className="text-xs text-slate-700">
                            <span className="font-bold text-slate-900">{c.authorName}: </span>
                            <span>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {user && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={commentTextByPost[post.id] ?? ''}
                          onChange={(e) =>
                            setCommentTextByPost((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          placeholder="Write a helpful comment..."
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void handleComment(post.id)}
                          aria-label={`Comment on ${post.title}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#062436] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          <Send className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Right Rail: Privacy-Aware Learner Leaderboard */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <Award className="h-5 w-5 text-amber-500" />
                  <span>XP & Streak Leaderboard</span>
                </h2>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Privacy Aware
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Students can toggle public name visibility anytime in their portal under My Courses & Rewards.
              </p>

              <div className="mt-4 space-y-2.5">
                {leaderboard.map((row, idx) => (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : idx === 1
                              ? 'bg-slate-300 text-slate-900'
                              : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-xs font-extrabold text-slate-900">
                          {row.displayName}
                          {row.isMasked && <Lock className="h-3 w-3 text-slate-400" />}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Lvl {row.level} · {row.branchName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono-tabular text-xs font-extrabold text-indigo-700">
                        {row.xp} XP
                      </p>
                      <p className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600">
                        <Flame className="h-3 w-3" /> {row.streakDays}d
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
