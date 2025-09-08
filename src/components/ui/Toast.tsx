import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
  };

  return (
    <div
      className={cn(
        'transform transition-all duration-300 ease-in-out',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        'bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4',
        typeStyles[toast.type || 'info']
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {toast.title && (
            <h4 className="font-medium text-sm mb-1">{toast.title}</h4>
          )}
          {toast.description && (
            <p className="text-sm opacity-90">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="ml-2 flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Convenience functions for common toast types
export function useToastHelpers() {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string) => 
      addToast({ title, description, type: 'success' }),
    error: (title: string, description?: string) => 
      addToast({ title, description, type: 'error' }),
    warning: (title: string, description?: string) => 
      addToast({ title, description, type: 'warning' }),
    info: (title: string, description?: string) => 
      addToast({ title, description, type: 'info' }),
  };
}
