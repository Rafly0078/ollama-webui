'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'ghost' | 'surface' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  surface: 'btn-surface',
  danger:
    'btn bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4',
  lg: 'h-12 px-6 text-base',
  icon: 'h-9 w-9',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'surface', size = 'md', ...props }, ref) => (
    <button ref={ref} className={cn(variants[variant], sizes[size], className)} {...props} />
  ),
);
Button.displayName = 'Button';
