import { useEffect, useState } from 'react';

// Declare Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        initData: string;
        initDataUnsafe: {
          user?: { id: number; first_name: string; username?: string };
          chat?: { id: number; type: string };
          start_param?: string;
        };
      };
    };
  }
}

// Types
interface Thread {
  id: string;
  thread_id?: string;
  title: string;
  is_active: boolean;
  updated_at: string;
  active_skills: string[];
}

interface Skill {
  name: string;
  description: string;
  category: string;
}

export default function TelegramHub() {
  const [tab, setTab] = useState<'threads' | 'skills'>('threads');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = window.location.origin; // Uses dash.karndt.pl through tunnel

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();
    }

    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load threads
      const threadsRes = await fetch(`${API_BASE}/api/v1/telegram/threads`, {
        headers: {
          'X-Telegram-InitData': window.Telegram?.WebApp?.initData || '',
        },
      });
      if (threadsRes.ok) {
        const threadsData = await threadsRes.json();
        setThreads(threadsData.data || []);
        const active = threadsData.data?.find((t: Thread) => t.is_active);
        if (active) setActiveThreadId(active.id);
      }

      // Load skills
      const skillsRes = await fetch(`${API_BASE}/api/v1/skills`, {
        headers: {
          'X-Telegram-InitData': window.Telegram?.WebApp?.initData || '',
        },
      });
      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        setSkills(skillsData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function createThread() {
    try {
      // Get chat_id from Telegram WebApp
      const chatId = window.Telegram?.WebApp?.initDataUnsafe?.chat?.id;
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

      // For private chats, use user_id as chat_id since chat.id might not be available
      const effectiveChatId = chatId?.toString() || userId?.toString();

      const res = await fetch(`${API_BASE}/api/v1/telegram/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-InitData': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({
          title: 'Nowa konwersacja',
          chat_id: effectiveChatId
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newThreadId = data.data || data.thread_id;
        await setActiveThread(newThreadId);
        window.Telegram?.WebApp?.close();
      }
    } catch (err) {
      setError('Failed to create thread');
    }
  }

  async function setActiveThread(threadId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/threads/active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-InitData': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({ thread_id: threadId }),
      });
      if (res.ok) {
        setActiveThreadId(threadId);
        await loadData();
      }
    } catch (err) {
      setError('Failed to switch thread');
    }
  }

  async function toggleSkill(skillName: string) {
    if (!activeThreadId) return;

    const currentThread = threads.find(t => t.id === activeThreadId);
    if (!currentThread) return;

    const currentSkills = currentThread.active_skills || [];
    const newSkills = currentSkills.includes(skillName)
      ? currentSkills.filter(s => s !== skillName)
      : [...currentSkills, skillName];

    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/threads/${activeThreadId}/skills`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-InitData': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({ skills: newSkills }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      setError('Failed to update skills');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-gray-400">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm border-b border-gray-800 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">⌘</span>
            ZeroClaw Hub
          </h1>
          <button
            onClick={() => window.Telegram?.WebApp?.close()}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-800 rounded text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800 max-w-lg mx-auto">
        <button
          onClick={() => setTab('threads')}
          className={`flex-1 py-3 text-sm font-medium ${
            tab === 'threads'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Konwersacje
        </button>
        <button
          onClick={() => setTab('skills')}
          className={`flex-1 py-3 text-sm font-medium ${
            tab === 'skills'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Skille
        </button>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4">
        {tab === 'threads' && (
          <div className="space-y-3">
            <button
              onClick={createThread}
              className="w-full p-4 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-3 transition-colors"
            >
              <span className="text-xl">+</span>
              <span>Nowa konwersacja</span>
            </button>

            {threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => setActiveThread(thread.id)}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  thread.is_active
                    ? 'bg-blue-600/30 border border-blue-500'
                    : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{thread.title || thread.id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {thread.active_skills.length} skilli
                    </div>
                  </div>
                  {thread.is_active && (
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded">Aktywny</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'skills' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              {activeThreadId ? (
                <span>Aktywne skille dla wybranego wątku</span>
              ) : (
                <span className="text-yellow-400">⚠️ Wybierz konwersację aby zmienić skille</span>
              )}
            </div>

            {skills.map((skill) => {
              const currentThread = threads.find(t => t.id === activeThreadId);
              const isActive = currentThread?.active_skills?.includes(skill.name) || false;

              return (
                <div
                  key={skill.name}
                  className={`p-4 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-gray-800/50 border-gray-700'
                  } ${!activeThreadId ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{skill.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{skill.category}</div>
                    </div>
                    <button
                      onClick={() => toggleSkill(skill.name)}
                      disabled={!activeThreadId}
                      className={`w-12 h-6 rounded-full transition-all ${
                        isActive ? 'bg-blue-600' : 'bg-gray-700'
                      } ${!activeThreadId ? 'cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          isActive ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
