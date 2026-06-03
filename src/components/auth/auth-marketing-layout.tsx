import type { ReactNode } from "react";
import sidebarImage from "#/assets/auth-sidebar.png";

type AuthMarketingLayoutProps = {
  heroTitle?: ReactNode;
  heroDescription?: string;
  /** Optional icon/badge above the hero title (e.g. MFA shield). */
  heroBadge?: ReactNode;
  formTitle?: string;
  formDescription?: string;
  children: ReactNode;
  /** Use slightly smaller hero title (forgot/recover/mfa). */
  heroTitleSize?: "default" | "compact";
};

export function AuthMarketingLayout({
  heroTitle,
  heroDescription,
  heroBadge,
  formTitle,
  formDescription,
  children,
  heroTitleSize = "default",
}: AuthMarketingLayoutProps) {
  const heroTitleClass =
    heroTitleSize === "compact"
      ? "mb-4 font-serif text-5xl leading-tight"
      : "mb-6 font-serif text-6xl leading-tight";

  return (
    <div className="flex min-h-screen bg-(--auth-canvas)">
      <div className="relative hidden w-[60%] overflow-hidden lg:block">
        <img
          src={sidebarImage}
          alt="Knowledge and Learning"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-tr from-(--auth-hero-overlay)/90 to-(--auth-hero-overlay)/20" />
        {heroTitle || heroDescription ? (
          <div className="absolute inset-0 flex flex-col justify-end p-16 text-white">
            {heroBadge ? <div className="mb-6">{heroBadge}</div> : null}
            {heroTitle ? <h1 className={heroTitleClass}>{heroTitle}</h1> : null}
            {heroDescription ? (
              <p className="max-w-md text-lg font-light leading-relaxed text-(--auth-hero-muted)">
                {heroDescription}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          {formTitle ? (
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-(--auth-ink)">
                {formTitle}
              </h2>
              {formDescription ? (
                <p className="mt-2 text-sm text-(--auth-muted)">{formDescription}</p>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Full-page canvas + centered spinner while auth routes resolve session. */
export function AuthPageLoading({ label }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-(--auth-canvas)"
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-(--auth-ink) border-t-transparent" />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
