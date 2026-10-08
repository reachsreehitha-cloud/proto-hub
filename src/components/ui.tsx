import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }) {
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200",
    ghost: "bg-transparent text-zinc-300 hover:bg-white/5",
    outline: "border border-white/15 text-zinc-100 hover:bg-white/5",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition ${variants[variant]} disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400/50 ${className}`}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400/50"
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function IconButton({
  label,
  className = "",
  tone = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "ghost" | "danger";
}) {
  const tones = {
    ghost: "text-zinc-300 hover:bg-white/10 hover:text-white",
    danger: "text-red-300 hover:bg-red-500/10",
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  // Opaque fills + high-contrast text so badges pass WCAG AA over cover images
  const tones = {
    default: "bg-zinc-100 text-zinc-900",
    success: "bg-emerald-300 text-emerald-950",
    warning: "bg-amber-300 text-amber-950",
    muted: "bg-zinc-300 text-zinc-900",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
