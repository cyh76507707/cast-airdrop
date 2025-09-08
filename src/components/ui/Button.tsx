import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  children, 
  className, 
  variant = 'default', 
  size = 'md',
  loading = false,
  disabled,
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
    outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'h-10 px-3 text-sm min-h-[40px]', // Increased from h-8 to h-10 for better touch
    md: 'h-12 px-4 py-3 min-h-[44px]', // Increased from h-10 to h-12 for better touch
    lg: 'h-14 px-6 text-lg min-h-[48px]', // Increased from h-12 to h-14 for better touch
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
