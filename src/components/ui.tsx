"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

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
      className={`inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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

/**
 * Instant hover tip via portal (survives overflow:hidden on cards).
 * No delay. Shows on mouse enter / focus.
 */
export function Tip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: side === "bottom" ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={() => {
        place();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        place();
        setOpen(true);
      }}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-zinc-900 shadow-lg"
            style={{
              top: coords.top,
              left: coords.left,
              transform:
                side === "bottom"
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function IconButton({
  label,
  className = "",
  tone = "ghost",
  tip = true,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "ghost" | "danger";
  /** Instant CSS tip; set false to skip */
  tip?: boolean;
}) {
  const tones = {
    ghost: "text-zinc-300 hover:bg-white/10 hover:text-white",
    danger: "text-red-300 hover:bg-red-500/10",
  };
  const button = (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
      {...props}
    />
  );
  return tip ? <Tip label={label}>{button}</Tip> : button;
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
