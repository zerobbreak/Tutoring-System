import { cn } from "#/lib/utils";

/** Shared class names for auth marketing form pages (use with theme auth tokens). */
export const authLabelClass = "text-(--auth-ink)";
export const authFormTitleClass =
  "text-3xl font-bold tracking-tight text-(--auth-ink)";
export const authInputClass =
  "border-(--auth-border) focus:border-(--auth-ink) focus:ring-(--auth-ink)";
export const authPrimaryButtonClass =
  "w-full bg-(--auth-ink) py-6 text-white hover:bg-(--auth-ink)/90 transition-all duration-300 transform hover:scale-[1.02]";
export const authAccentLinkClass =
  "font-semibold text-(--auth-accent) hover:underline";
export const authMutedClass = "text-(--auth-muted)";
export const authMutedSubtleClass = "text-(--auth-muted-subtle)";
export const authHeroMutedClass = "text-(--auth-hero-muted)";
export const authFooterClass = "mt-8 text-center text-sm text-(--auth-muted)";

export function authInputClassName(hasError?: boolean) {
  return cn(authInputClass, hasError && "border-red-500 focus:ring-red-500");
}

export function authPageSpinnerClass() {
  return "h-8 w-8 animate-spin rounded-full border-4 border-(--auth-ink) border-t-transparent";
}
