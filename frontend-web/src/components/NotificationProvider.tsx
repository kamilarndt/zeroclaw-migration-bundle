import React, { createContext, useContext, useCallback, useState, useEffect, useRef, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  timestamp: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = React.memo(({ children }: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id)!);
      timersRef.current.delete(id);
    }
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove after duration (default 5 seconds)
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      const timerId = setTimeout(() => {
        removeNotification(newNotification.id);
        timersRef.current.delete(newNotification.id);
      }, duration);
      timersRef.current.set(newNotification.id, timerId);
    }
  }, [removeNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
      }}
    >
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
});

NotificationProvider.displayName = 'NotificationProvider';

const NotificationContainer = React.memo(() => {
  const { notifications, removeNotification } = useNotifications();

  const getNotificationStyles = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          icon: <CheckCircle size={20} className="text-green-400" />,
        };
      case 'error':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          icon: <AlertCircle size={20} className="text-red-400" />,
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/20',
          icon: <AlertTriangle size={20} className="text-yellow-400" />,
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          icon: <Info size={20} className="text-blue-400" />,
        };
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {notifications.map((notification) => {
        const styles = getNotificationStyles(notification.type);

        return (
          <div
            key={notification.id}
            className={`${styles.bg} backdrop-blur-sm rounded-lg p-4 border ${styles.border} shadow-lg animate-slide-in`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {styles.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-white text-sm">
                    {notification.title}
                  </h4>
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                {notification.message && (
                  <p className="text-gray-400 text-sm mt-1">
                    {notification.message}
                  </p>
                )}

                {notification.action && (
                  <button
                    onClick={() => {
                      notification.action!.onClick();
                      removeNotification(notification.id);
                    }}
                    className="mt-3 text-sm font-medium text-white/80 hover:text-white transition-colors"
                  >
                    {notification.action.label} →
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {notification.timestamp.toLocaleTimeString()}
            </div>
          </div>
        );
      })}
    </div>
  );
});

NotificationContainer.displayName = 'NotificationContainer';

// Helper functions for common notifications
export const notify = {
  success: (title: string, message?: string, duration?: number) => {
    // This will be called from components that have access to the context
    console.warn('notify.success called without context. Use useNotifications hook.');
  },
  error: (title: string, message?: string, duration?: number) => {
    console.warn('notify.error called without context. Use useNotifications hook.');
  },
  info: (title: string, message?: string, duration?: number) => {
    console.warn('notify.info called without context. Use useNotifications hook.');
  },
  warning: (title: string, message?: string, duration?: number) => {
    console.warn('notify.warning called without context. Use useNotifications hook.');
  },
};
