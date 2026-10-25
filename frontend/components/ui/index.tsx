import Link from "next/link";
import "./card.css";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type {
  ComponentProps,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
type ButtonVariant =
  "primary" | "outline" | "soft" | "danger" | "warning" | "caution";
type ButtonSize = "console" | "app" | "sm";
export const buttonVariants = cva("button", {
  variants: {
    variant: {
      primary: "button-primary",
      outline: "button-outline",
      soft: "button-soft",
      danger: "button-danger",
      warning: "button-warning",
      caution: "button-caution",
    },
    size: { console: "button-console", app: "button-app", sm: "button-sm" },
  },
  defaultVariants: { variant: "primary", size: "console" },
});
export function Button({
  variant = "primary",
  size = "console",
  className = "",
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
export function LinkButton({
  variant = "primary",
  size = "console",
  className = "",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
export function Card({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: "default" | "subtle" }) {
  return <section className={`card card-${variant} ${className}`} {...props} />;
}
/** Explicit footer for a card's primary actions. */
export function CardActions({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <footer className={cn("card-actions", className)} {...props} />;
}
export function Chip({
  children,
  variant = "neutral",
  className = "",
}: {
  children: ReactNode;
  variant?: string;
  className?: string;
}) {
  return (
    <span className={`chip chip-${variant} ${className}`}>{children}</span>
  );
}
export { Field, SelectField, TextareaField } from "./fields";
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name="package" size={32} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}
const paths: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  review: (
    <>
      <path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 13l2 2 5-5" />
    </>
  ),
  offers: (
    <>
      <path d="M4 5h16v14H4zM4 6l8 7 8-7" />
    </>
  ),
  reception: (
    <>
      <path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4" />
    </>
  ),
  inventory: (
    <>
      <path d="m3 7 9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11" />
    </>
  ),
  package: (
    <>
      <path d="m3 7 9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11" />
    </>
  ),
  needs: (
    <>
      <path d="M4 5h16v16H4zM8 3v4m8-4v4M8 12h8m-8 4h5" />
    </>
  ),
  capacity: (
    <>
      <path d="M4 20V9m5 11V4m6 16v-7m5 7V7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 11h18" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8" cy="8" r="1" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h3l2-3h6l2 3h3v14H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  scan: (
    <>
      <path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M7 12h10" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  microphone: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  "arrow-left": <path d="M19 12H5m7-7-7 7 7 7" />,
  "arrow-right": <path d="M5 12h14m-7-7 7 7-7 7" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2zM12 9v5m0 3h.01" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M7 17 17 7M7 7h10v10" />,
  pin: (
    <>
      <path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z" />
      <circle cx="12" cy="9" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name] ?? paths.package}
    </svg>
  );
}
