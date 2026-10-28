import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Archive,
  AtSign,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { NotificationItem } from '../../types/flowforge';

export const InboxView: React.FC = () => {
  const { activeWorkspaceId, setUnreadCount, openTaskDrawer, addToast } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentioned' | 'archived'>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInbox = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const res = await api.getNotifications(activeWorkspaceId, filter);
      setItems(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [activeWorkspaceId, filter]);

  const handleToggleRead = async (item: NotificationItem) => {
    const res = await api.updateNotification(item.id, { read: !item.read_at });
    setItems(res.notifications || []);
    setUnreadCount(res.unread_count || 0);
  };

  const handleArchive = async (item: NotificationItem) => {
    const res = await api.updateNotification(item.id, { archived: true });
    setItems(res.notifications || []);
    setUnreadCount(res.unread_count || 0);
  };

  const handleMarkAllRead = async () => {
    if (!activeWorkspaceId) return;
    const res = await api.markAllNotificationsRead(activeWorkspaceId);
    setItems(res.notifications || []);
    setUnreadCount(res.unread_count || 0);
    addToast({ type: 'success', title: 'Barcha bildirishnomalar o‘qilgan deb belgilandi' });
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 h-full overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-indigo-400" />
            <span>Inbox — Bildirishnomalar va @Chaqiruvlar Markazi</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Vazifa biriktirilishi, @mention chaqiruvlar, izohlar va bloker yechilgani haqidagi xabarlar
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition"
        >
          <CheckCheck className="w-4 h-4 text-emerald-400" />
          <span>Barchasini o‘qilgan qilish</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'all', label: 'Barchasi' },
          { id: 'unread', label: 'O‘qilmaganlar' },
          { id: 'mentioned', label: '@Mentions (Meni eslashgan)' },
          { id: 'archived', label: 'Arxivlanganlar' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification Cards */}
      <div className="space-y-2.5">
        {items.map((item) => {
          const isUnread = !item.read_at;
          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border flex items-start justify-between gap-4 transition ${
                isUnread
                  ? 'bg-indigo-950/20 border-indigo-500/40'
                  : 'bg-slate-900/70 border-slate-800/80'
              }`}
            >
              <div
                onClick={async () => {
                  if (isUnread) await handleToggleRead(item);
                  if (item.entity_type === 'task') openTaskDrawer(item.entity_id);
                }}
                className="flex-1 cursor-pointer space-y-1"
              >
                <div className="flex items-center gap-2">
                  {isUnread && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                  {item.type === 'mentioned' && <AtSign className="w-3.5 h-3.5 text-amber-400" />}
                  {item.task_key && (
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {item.task_key}
                    </span>
                  )}
                  <span className="text-sm font-bold text-white">{item.title}</span>
                </div>
                {item.body && <p className="text-xs text-slate-300">{item.body}</p>}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                  {item.actor && <span>Kimdan: {item.actor.full_name}</span>}
                  <span>•</span>
                  <span>{item.created_at.slice(0, 16).replace('T', ' ')}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.entity_type === 'task' && (
                  <button
                    onClick={() => openTaskDrawer(item.entity_id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Vazifani ochish"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleToggleRead(item)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title={isUnread ? 'O‘qilgan deb belgilash' : 'O‘qilmagan qilish'}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isUnread ? 'text-slate-400' : 'text-emerald-400'}`} />
                </button>
                {!item.archived_at && (
                  <button
                    onClick={() => handleArchive(item)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                    title="Arxivlash"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center text-slate-500 text-sm bg-slate-900/40 rounded-2xl border border-slate-800/60">
            Ushbu bo‘limda bildirishnomalar yo‘q.
          </div>
        )}
      </div>
    </div>
  );
};
