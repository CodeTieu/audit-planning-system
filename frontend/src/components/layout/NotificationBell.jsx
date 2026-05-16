import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X } from 'lucide-react'
import api from '../../lib/api'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const NOTIF_ICONS = {
  review: '📋',
  return: '↩',
  approval: '✅',
  assignment: '👤',
  deadline: '⏰',
  default: '🔔',
}

function getIcon(type) {
  return NOTIF_ICONS[type] || NOTIF_ICONS.default
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const dropdownRef = useRef(null)
  const intervalRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('notifications/')
      const data = res.data
      const list = Array.isArray(data) ? data : data.results ?? []
      setNotifications(list.slice(0, 10))
      setUnreadCount(list.filter((n) => !n.is_read && !n.read).length)
    } catch {
      // silently fail — notifications are non-critical
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, 30000)
    return () => clearInterval(intervalRef.current)
  }, [fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside)
    }
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await api.post('notifications/mark_all_read/')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })))
      setUnreadCount(0)
    } catch {
      // If endpoint doesn't exist yet, just clear locally
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })))
      setUnreadCount(0)
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleClickNotif(notif) {
    if (!notif.is_read && !notif.read) {
      try {
        await api.post(`notifications/${notif.id}/mark_read/`)
        setNotifications((prev) =>
          prev.map((n) => n.id === notif.id ? { ...n, is_read: true, read: true } : n)
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white text-[10px] font-bold px-1"
            style={{ backgroundColor: '#dc2626' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="fixed right-4 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ top: '56px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-[#1e3a5f]">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-xs text-[#1e3a5f] hover:underline disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const isRead = notif.is_read || notif.read
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    className={[
                      'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                      isRead ? 'hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100',
                    ].join(' ')}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {getIcon(notif.notification_type || notif.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={['text-xs font-semibold truncate', isRead ? 'text-gray-700' : 'text-[#1e3a5f]'].join(' ')}>
                        {notif.title || notif.subject || 'Notification'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notif.message || notif.body || ''}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#1e3a5f] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center text-xs text-gray-400">
              Showing {notifications.length} most recent
            </div>
          )}
        </div>
      )}
    </div>
  )
}
