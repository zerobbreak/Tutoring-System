# Institution theming and terminology: per-tenant branding in Emeris

Research date: 2026-10-19. Purpose: decide how each institution (tenant) can apply its own brand (colours, logo, possibly fonts) and its own vocabulary and structure (module/course/subject, term/semester/block, campus/site, tutor/TA/demonstrator, lecturer/facilitator, optional features) if Emeris is sold as a subscription SaaS.
Scope: Tailwind CSS v4 and shadcn/ui theming, OKLCH and WCAG contrast, SSR delivery in TanStack Start, tenant resolution, terminology dictionaries and ICU MessageFormat, Supabase Storage for logos, and guardrails for a self-serve theme editor. Primary sources only; anything not verified is labelled.

## Question

How can each institution adjust the theme to its brand and "match its exact structure" (terminology, and possibly which features and nav items are on)? What is the safest, most maintainable way to do this in this stack?

## Short answer (recommendation for this stack)

- **Colours: change CSS variables at runtime, not the Tailwind build.** `src/styles.css` already maps every shadcn token through `@theme inline` (`--color-primary: var(--primary)`, and so on). Utilities like `bg-primary` therefore compile to `var(--primary)`, so a per-tenant `<style>` that redefines `--primary` on `:root` and `.dark` re-themes the app with no rebuild ([Tailwind theme variables](https://tailwindcss.com/docs/theme); [shadcn theming](https://ui.shadcn.com/docs/theming)).
- **Let tenants pick 1-2 brand colours, not 30 tokens.** Derive the shadcn token set (light and dark) on the server in OKLCH, then check every foreground/background pair against WCAG 2.2: 4.5:1 for text, 3:1 for UI parts and focus rings. If the raw brand colour fails, keep it for decorative accents and derive a darker or lighter variant for `--primary` ([WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- **Lock the semantic colours.** `--destructive`, the emerald (success) and amber (warning) status colours, and the claim-status badges stay platform-owned, as `context/theme.md` already requires.
- **Deliver the theme in SSR `<head>` from the root route.** The root loader returns the institution's published branding. The root `head()` (which receives `loaderData`) emits it through the `styles` option, so the first paint is already on-brand. Use `ScriptOnce` for the existing light/dark preference, which currently flashes because `ThemeToggle` reads `localStorage` in a `useEffect` ([TanStack head management](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management); [RouteOptions](https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType)).
- **Resolve the tenant in two steps.** Logged-in pages use the user's `institution_id`, which RLS already enforces. Public pages (`/auth/*`, `/student/check-in`) need the tenant from the URL: a subdomain or custom domain later, and a QR link that carries the session id now (the session row already knows its institution).
- **Terminology: use a typed label dictionary with platform defaults plus per-tenant overrides.** Keep DB enums (`TUTOR`, `LECTURER`, claim statuses), table names and routes (`/tutor`, `/lecturer`) unchanged; only display strings change. Write plural forms as ICU MessageFormat, which always needs an `other` case ([ICU messages](https://unicode-org.github.io/icu/userguide/format_parse/messages/); [CLDR plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules)).
- **Treat "structure" as data and feature flags, not code forks.** Campuses, academic terms and modules are already rows (`public.campuses`, `public.academic_terms`, `public.modules`). Add per-tenant feature toggles that hide nav items and pages, enforced on the server as well as in the nav.
- **Logos: put them in a new public `branding` bucket, uploaded only through a server action.** Store paths under `<institution_id>/...`, with RLS on `storage.objects` limiting writes to that folder. Prefer PNG or WebP uploads; do not serve tenant-uploaded SVG inline, because SVG can contain script ([Supabase buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals); [Storage access control](https://supabase.com/docs/guides/storage/security/access-control); [MDN SVG script](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script)).
- **Self-serve editor: draft → preview → contrast gate → publish, with versions and one-click rollback.** Institution `ADMIN` edits its own draft. Only allow-listed tokens can be set. Fonts come from a curated list, not arbitrary URLs.

## Current state in the repo

- **Tokens.** `src/styles.css` defines two layers:
  - Brand variables (`--sea-ink`, `--lagoon`, `--lagoon-deep`, `--palm`, `--sand`, `--foam`, plus surface/chip/hero tokens) as hex/rgba, with dark values on `.dark`.
  - The full shadcn set (`--background` … `--sidebar-ring`, `--chart-1..5`, `--radius`) in OKLCH, exposed via `@theme inline`.
  - Dark mode is a `.dark` class (`@custom-variant dark (&:is(.dark *))`).
  - The shadcn tokens are still the stock zinc-grey defaults. The lagoon "brand" lives in the custom variables, 55 `var(--lagoon|sea-ink|palm…)` uses in `.tsx`, and about 85 hard-coded `teal-/cyan-/emerald-/sky-` Tailwind classes.
  - The `body` gradient hard-codes `rgba(79, 184, 178, 0.1)`.
  - Implication: re-theming only `--primary` will not re-brand the app. The brand surface has to be consolidated onto a small set of tokens first.
- **Fonts.** These are loaded with a Google Fonts `@import` at the top of `styles.css` (Outfit, Manrope, Playfair Display, Fraunces). `--font-sans` and `--font-serif` are set in `@theme inline`.
- **Light/dark.** `src/components/theme-toggle.tsx` sets `.dark` on `<html>` inside `useEffect` from `localStorage["tutor-theme"]`. This is client-only, so dark-mode users see a light flash on load.
- **Root route.** `src/routes/__root.tsx` loads `getCurrentUserFn()` in the root `loader` and has a static `head()` (title "Tutoring System", one stylesheet link). `RootDocument` renders `<HeadContent />`. `src/lib/root-session.ts` has no institution data in `RootLoaderData`.
- **Brand strings.** "Emeris Admin" and "Emeris Learning" are hard-coded in the app shells. The public nav and `<title>` say "Tutoring System".
- **Tenant table.** `public.institutions` has:
  - `id, name, domain, country, plan_tier, is_active, created_at`
  - Later added: `scheduling_settings jsonb`, `default_tutor_hourly_rate_cents`, `rate_currency`, `auto_submit_claims`.
  - There are no branding or terminology columns.
  - RLS: `institutions_select_active` lets any authenticated user read active institutions. `institutions_admin_update_own` lets an institution admin update its whole row.
- **Side finding.** `server-actions/admin-institutions/update-institution-profile.ts` lets an institution ADMIN set `plan_tier`. In a paid SaaS, plan/entitlements should be SUPER_ADMIN or billing-owned. Keep branding in its own table so this policy is not widened further.
- **Labels.** "Module", "Modules", "Campus", "Semester 1", "Tutor" and "Lecturer" are hard-coded across components. A rough grep found about 22 `"Module…` and 33 `"Tutor…` string literals in `.tsx`, plus toasts like "Campus created.", "Module code is required.".
- **CSP.** No Content-Security-Policy header is set anywhere in `src/`.
- **Public check-in.** `src/routes/student/check-in.tsx` reads `?token=…&session=…`, so the session id that identifies the institution is already in the QR URL.

## Findings by topic

### 1. Tailwind CSS v4: tokens are CSS variables, so runtime overrides work

- `@theme` variables are "not _just_ CSS variables — they also instruct Tailwind to create new utility classes". Use `@theme` for tokens that map to utilities, and `:root` for "regular CSS variables that shouldn't have corresponding utility classes" [1].
- `@theme inline` matters when a theme variable references another variable. "The utility class will use the theme variable _value_ instead of referencing the actual theme variable." Without it, "your utility classes might resolve to unexpected values because of how variables are resolved in CSS" [1].
  - This is what makes per-tenant overrides safe here. `bg-primary` compiles to `var(--primary)`, which resolves wherever `--primary` is defined (`:root`, `.dark`, or a tenant `<style>`).
- "All of your theme variables are turned into regular CSS variables when you compile your CSS" [1]. By default "only used CSS variables will be generated"; `@theme static` emits all of them [1].
  - Redefining `--primary` at runtime needs no rebuild, because the compiled CSS references the variable, not a literal.
  - The Tailwind docs do not describe per-tenant runtime overriding as a feature. That this works follows from normal CSS cascade (verified by reading how `@theme inline` compiles), not from a documented guarantee.
- Practical rule: the tenant stylesheet sets only the raw tokens (`--primary`, `--ring`, `--sidebar-primary`, …) under `:root` and `.dark`. It never touches `@theme`.

### 2. shadcn/ui conventions

- shadcn uses "semantic background and foreground pairs": `primary` with `primary-foreground`, and so on. Tokens: `background, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, radius`, `chart-1..5`, and `sidebar, sidebar-primary, sidebar-accent, sidebar-border, sidebar-ring` with `-foreground` pairs [2].
- "These tokens live in your CSS file under `:root` and `.dark`." To add a token, "define it under `:root` and `.dark`, then expose it to Tailwind with `@theme inline`" [2].
- The defaults are written in OKLCH (for example `--primary: oklch(0.205 0 0)`) [2]. For Tailwind v4, "HSL colors are now converted to OKLCH", and projects should "Add the `inline` option to `@theme`" [3]. This repo already follows both.
- Implication: the pair structure gives a ready list of contrast checks (each `X` against `X-foreground`, plus `ring` against `background`). A generator only has to emit those pairs for light and dark.

### 3. Accessible palette from one brand colour

- **OKLCH.** `oklch()` uses L (perceived lightness 0-1), C (chroma, practically ≤ 0.4) and H (hue angle) [4].
  - Relative colour syntax (`oklch(from var(--brand) calc(l - 0.15) c h)`) can derive shades in CSS itself [4].
  - MDN marks `oklch()` "Baseline: Widely available … since May 2023" [4]. Support for relative colour syntax specifically was not verified, so derive shades on the server and emit literal values.
- **Gamut.** CSS Color 4 says an out-of-gamut colour is "CSS gamut mapped for display, producing a similar-looking but lower chroma (less saturated) color" [5].
  - HSL hue "is not perceptually uniform", and OkLCh hue differences "correctly reflect the visual separation of hues" [5].
  - So: hold hue fixed, step L for a tint/shade ramp, and clamp chroma into sRGB before checking contrast.
- **WCAG 2.2 is the normative target.**
  - 1.4.3 (AA): text needs at least 4.5:1, large text 3:1. "Text that is part of a logo or brand name has no contrast requirement" [6].
  - Contrast is `(L1 + 0.05) / (L2 + 0.05)` on sRGB relative luminance, and ratios must not be rounded up (4.499:1 fails) [6].
  - 1.4.11 (AA): UI components, states and focus indicators need 3:1 against adjacent colours [7].
  - 1.4.1 (A): colour must not be "the only visual means of conveying information" [8]. Claim-status badges therefore keep their text labels whatever the palette.
- **APCA is not normative.**
  - WCAG 3.0 is a Working Draft (10 September 2026). It says "The contrast algorithm used in WCAG 3 is yet to be determined" and should not be cited "as other than a work in progress" [9].
  - The APCA repo says APCA is "being evaluated as a replacement for WCAG 2 contrast math" and the standards using it "are still developmental"; the library is beta [10].
  - Use WCAG 2.x ratios to gate publishing. APCA can be shown as advisory information only.
- **When a brand colour fails contrast** (common for mid-tone yellows, oranges and light blues):
  - Keep the exact brand colour for non-text, decorative uses: the logo area, sidebar accent bar, chart-1, hero gradients.
  - Derive `--primary` by moving L along the same hue until `primary-foreground` reaches 4.5:1. Pick white or near-black foreground by whichever passes.
  - Derive the dark-mode `--primary` separately; usually a lighter L on a dark background.
  - Derive `--ring` to reach 3:1 against `--background`.
  - If no L value passes at that hue, fall back to the platform default and tell the admin why.
- **Libraries (official docs checked):**
  - **culori** [11][12] has an `oklch` mode, `toGamut` ("Obtain a color that's in the `dest` gamut"), `clampChroma`, `wcagContrast` ("Computes the contrast ratio between two colors"), `wcagLuminance`, `formatCss`/`formatHex`, and a tree-shaken `culori/fn` entry.
  - **Color.js** [13] supports `WCAG21` and `APCA` contrast (APCA 0.0.98G-4g, argument order matters). Its docs warn WCAG 2.1 "has been criticized for numerous false positive and false negative results, particularly in dark mode".
  - Either works server-side. culori's small functional API fits a pure `deriveTenantPalette(brand) → { light, dark, report }` function that can be unit-tested with Vitest.

### 4. SSR delivery without a flash of the wrong theme

- `head` "returns an object with `title`, `meta`, `links`, `styles`, and `scripts` properties". `<HeadContent />` is "**required**" and belongs in the root layout's `<head>` [14].
  - Nested routes override `title`/`meta`, "preferring the **last** occurrence" [14].
  - The `head` context includes `loaderData?: TLoaderData` [15]. The root route can therefore load branding in its existing `loader` and return `styles: [{ children: tenantCss }]` from `head()`.
  - The CSS then arrives in the server HTML before first paint: no flash, no client fetch.
  - The same `head()` can set the tenant `title`, `link rel="icon"` and `link rel="manifest"`.
- `ScriptOnce` renders a script during SSR that runs while the HTML is parsed, before hydration, and is meant for "theme detection" [14]. Use it to set `.dark` from `localStorage` / `prefers-color-scheme` before paint. This fixes the existing flash in `ThemeToggle`, which today runs in `useEffect`.
- **Build the CSS string on the server only, from validated values.**
  - Store tokens as structured data (an `oklch(L C H)` triple per allow-listed key) and serialise with a fixed template.
  - Never interpolate raw tenant strings into CSS. A value like `red;}</style><script>` must be impossible, so validate with Zod (numeric ranges) at write time and again at render.
- **Caching.**
  - The published theme changes rarely. Cache it in the root loader with a TanStack Query entry keyed by `institution_id` + `version`, added to `src/lib/query-keys.ts`.
  - The published CSS can also be served as a static, versioned stylesheet URL (for example `/branding/<institution>/<version>.css`) with long cache headers, so the `<style>` block does not repeat in every HTML response.
  - This is a trade-off, not a sourced claim: a versioned `<link>` caches better, while an inline `<style>` has no extra request.
- **CSP.** `style-src` allows inline styles via `'unsafe-inline'`, a per-request nonce ("needs to be dynamically generated as it has to be unique for each HTTP request"), or a hash [16]. The app sets no CSP today. If one is added:
  - Prefer the versioned external stylesheet, which needs no inline allowance.
  - Otherwise use a nonce on the tenant `<style>` and on the `ScriptOnce` script.
  - Inline `style=""` attributes used by components such as Radix/shadcn are governed separately (`style-src-attr` per the CSP spec; noted but not verified on MDN's directive page).

### 5. Tenant resolution

- Vercel's multi-tenant concepts page lists three strategies [17]:
  - subdomain (`tenant1.yourapp.com`)
  - custom domain mapped in a DB lookup
  - path-based (`/tenant1/dashboard`)
- Wildcards: "Add `*.yourapp.com` … Point your domain to Vercel's nameservers", or delegate certificate validation. One wildcard cert covers first-level subdomains only [17].
- Custom domains are added via SDK, verified by a TXT record, and get automatic SSL [17].
- Vercel's guidance is to strip client-supplied tenant headers: "Delete or overwrite inbound `x-tenant-*` headers … so clients can't supply tenant context themselves" [17].
- Vercel recommends multi-tenant (one codebase, one deployment) where "branding differ[s], but functionality is the same", including "SaaS dashboards" [18]. Hosting provider for Emeris is not decided (no `vercel.json` in repo); the concepts apply to any host.
- **In TanStack Start**, the equivalent of the Next.js proxy is global request middleware registered in `src/start.ts` via `createStart({ requestMiddleware })`. It can pass values on through `next({ context })` [19]. `getRequest()`, `getRequestHeader(name)` and `setResponseHeader` come from `@tanstack/react-start/server` [20]. Read the `Host` header there.
- **Recommended order of precedence:**
  1. Logged-in user's `institution_id`. This is authoritative, and RLS already enforces it.
  2. Host → `institutions.domain` (or a new `institution_domains` table), for branded login pages and future custom domains.
  3. Explicit public context: `/student/check-in?session=…` looks up the session's institution with a narrow server function that returns only public branding fields.
  4. Platform default theme.
- **If the host and the user's institution disagree** (a user from institution A on B's subdomain), redirect or show the user's own institution. Never mix data. Branding must never be an authorisation input.
- Path-based tenancy (`/acme/tutor/...`) would touch every route and `APP_PATHS`. It is not recommended.

### 6. Terminology and "structure"

- **Keep identifiers stable and change labels only.**
  - Role enums (`TUTOR`, `LECTURER`, `ADMIN`, `SUPER_ADMIN`), claim statuses, the DB trigger mirroring `claim-workflow/transitions.ts`, table names (`modules`, `campuses`, `academic_terms`), payroll CSV columns and route paths are contracts used by RLS policies, the DB trigger, exports and audit logs.
  - Renaming them per tenant would fork logic. A label layer gives the same visible result with no migration.
  - Payroll CSV headers should probably stay canonical (an open question below).
- **Dictionary shape.**
  - A typed key set in code, e.g. `term.module.singular`, `term.module.plural`, `role.tutor`, `role.lecturer`, `term.academicTerm`, `term.campus`, `term.session`.
  - Platform English defaults in code.
  - A per-tenant `terminology jsonb` with overrides, validated by a Zod schema generated from the key set (unknown keys rejected, max lengths).
  - A `useTerms()` hook / server helper that merges defaults ← tenant overrides.
  - With keys typed in TypeScript, a missing key is a compile error and a missing override falls back to the default.
- **Plurals and grammar.**
  - ICU MessageFormat says a message "has to be written and translated as a single unit". A plural argument "always need[s] an 'other' variant". Put `select` outside and `plural` inside when nesting [21].
  - FormatJS example: `{itemCount, plural, one {You have # item.} other {You have # items.}}`. "Don't use `=1` in place of `one`" [22].
  - CLDR categories are zero, one, two, few, many, other, and `other` is required [23].
  - Practical consequence: tenants should override nouns (singular and plural forms), not whole sentences. Sentences stay platform-owned templates that interpolate the noun, e.g. `"{module} code is required."`.
  - Full ICU (via FormatJS `intl-messageformat`) is only needed if non-English locales are added. For English-only noun swaps, a typed `{ singular, plural }` pair plus `Intl.PluralRules` is enough.
  - Articles ("a/an": "an Assistant" vs "a Tutor") are a known gotcha. Avoid them in templates or store them with the noun (unverified best practice, not from a cited source).
- **Structure beyond labels.**
  - Campuses, terms and modules are already data, so "term vs semester vs block" is mostly a label plus the term records the institution creates.
  - Real differences (no campuses; no lecturer verification step; no QR attendance) need feature flags.
  - Store them as typed booleans in `institution_settings.features`, read them in the role app shells to hide nav items, and check them in the server actions that own the feature. Hiding a nav item is not authorisation.
  - Changing the claim workflow itself (for example skipping `VERIFIED`) touches `transitions.ts` and the DB trigger together (see CLAUDE.md). It should be a separate product decision, not part of theming.

### 7. Logo, favicon and manifest via Supabase Storage

- A public bucket "effectively bypasses access controls for both retrieving and serving files", while uploads and deletes "still require RLS". Public buckets are "more performant than private buckets" [24]. Logos are not secret, so a public `branding` bucket fits.
- "By default Storage does not allow any uploads to buckets without RLS policies." Policies on `storage.objects` can restrict by folder with `storage.foldername(name)`, e.g. `(storage.foldername(name))[1] = 'private'` [25].
  - Use `(storage.foldername(name))[1] = public.get_auth_user_institution_id()::text` plus an admin check. Or upload only through a server action using `getSupabaseAdmin()` after `requireAdminContext`, which matches existing patterns.
- **Image transformations.** Available on Pro and above. Width/height 1-2500, max 25 MB, $5 per 1,000 origin images beyond quota [26].
  - The fetched summary also listed SVG as a supported format. Treat that as unverified.
  - Pre-generating fixed sizes (logo, 32/180/192/512 px icons) at upload time avoids depending on the plan tier.
- **SVG risk.** The SVG `<script>` element "allows you to add scripts to an SVG document" [27]. Accept PNG/WebP (and optionally SVG only after server-side sanitisation). Render logos with `<img>`, never by inlining markup.
- **Favicon and manifest.**
  - A manifest is linked with `<link rel="manifest" href="…">` and should be served as `application/manifest+json` [28].
  - A per-tenant manifest can be a server route that returns JSON built from the published branding (`name`, `icons`, `theme_color`), linked from the root `head()`. Dynamic manifests are not explicitly covered by the MDN page, so treat that as unverified but standard practice.

### 8. Guardrails for a self-serve theme editor

These are recommendations; the sources above support the contrast and security points.

- **Allow-list what tenants can set:**
  - `brand.primary` (required) and `brand.accent` (optional) as hex/OKLCH input.
  - `radius` from presets.
  - `font.heading` / `font.body` from a curated list.
  - Logo (light and dark), favicon, display name and short name.
  - Everything else is derived.
- **Locked platform tokens:**
  - `--destructive`, emerald/amber status colours, claim-status badge colours, chart colours used for status meaning, and focus-ring minimum contrast.
  - This matches `context/theme.md`: "Do not replace accessible semantic status colors with brand colors when the meaning would become less clear."
- **Lifecycle: draft → preview → publish.**
  - Preview applies the draft tokens in the editor only, by setting variables on a wrapper element or an iframe of sample screens (sidebar, table, claim card, dialog, toast) in light and dark.
  - Publish fails if any required pair is below WCAG 2.2 AA (4.5:1 text, 3:1 UI/focus [6][7]). Show the exact ratio, never rounded.
- **Versioning.**
  - Every publish writes an immutable version row. `published_version` points at one, and rollback is just moving the pointer.
  - Audit each publish and rollback through `lib/audit-log.ts`.
  - The versioned CSS URL changes with each version, which also busts caches.
- **Who may edit:**
  - Institution `ADMIN` manages its own draft and publish.
  - `SUPER_ADMIN` (platform) can edit any tenant, force-rollback, and gate premium options (custom domain, custom fonts) by plan.
  - Use separate RLS policies on the new table rather than widening `institutions_admin_update_own`.
- **Fonts.**
  - Fonts are loaded today by a global Google Fonts `@import`. Per-tenant fonts would add a per-tenant `<link>` and an extra third-party request, and a CSP `font-src`/`style-src` entry if CSP is added.
  - Offer a curated list of 4-6 fonts, or self-host them, and change only `--font-sans`/`--font-serif`.
  - Arbitrary font URLs are not recommended (licensing and CSP).
- **Prerequisite refactor (repo-specific).** Before tenant colours can show up consistently, consolidate the brand surface:
  - Map `--lagoon`/`--sea-ink`/`--palm` usages and the ~85 hard-coded `teal-/cyan-/sky-` classes onto shadcn tokens (`primary`, `accent`, `sidebar-*`, `ring`) or a small set of new brand tokens (e.g. `--brand`, `--brand-foreground`, `--brand-soft`) declared under `:root`/`.dark` and exposed via `@theme inline` [2].
  - Keep `emerald` for success.
  - Without this step a tenant theme changes buttons but leaves the teal shell.

## Proposed data model (PROPOSAL, not implemented)

```sql
-- Proposal only. One draft + immutable published versions per institution.
CREATE TABLE public.institution_branding_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  status          text NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  -- Inputs the admin chose (allow-listed, Zod-validated):
  inputs          jsonb NOT NULL,   -- { brandPrimary: "oklch(...)", brandAccent?, radius, fontHeading, fontBody }
  -- Server-derived output, written only by the server action:
  tokens          jsonb NOT NULL,   -- { light: { primary: [L,C,H], "primary-foreground": [...], ring, sidebar-primary, ... },
                                    --   dark:  { ... } }
  contrast_report jsonb NOT NULL,   -- [{ pair: "primary/primary-foreground", mode: "light", ratio: 5.12, pass: true }, ...]
  display_name    text,             -- shown in shells instead of "Emeris Learning"
  short_name      text,             -- manifest short_name
  logo_light_path text,             -- storage path in bucket 'branding': <institution_id>/v<version>/logo-light.png
  logo_dark_path  text,
  favicon_path    text,
  terminology     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { "term.module": {"singular":"Course","plural":"Courses"}, "role.tutor": {...} }
  features        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { "campuses": true, "qrAttendance": true, ... } (or a separate settings table)
  created_by      uuid NOT NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  published_by    uuid REFERENCES public.users(id),
  UNIQUE (institution_id, version)
);

ALTER TABLE public.institutions
  ADD COLUMN published_branding_version_id uuid
    REFERENCES public.institution_branding_versions(id);  -- rollback = repoint
-- Optional later: public.institution_domains (institution_id, hostname unique, verified_at) for subdomain/custom-domain resolution.
```

- **RLS (proposal).**
  - SELECT on published rows is available to the institution's members.
  - Public pages get a narrow server function returning only `display_name`, logo paths and `tokens` for a resolved institution.
  - INSERT/UPDATE of `DRAFT` rows needs `auth_user_is_admin()` and the same `institution_id`.
  - Changing status to `PUBLISHED` goes through a server action that re-derives tokens, re-runs the contrast gate and requires step-up TOTP (mirroring `requireStepUpMfa`). That last point is a suggestion, not an existing rule.
- **Code touchpoints (proposal).**
  - `src/lib/tenant-theme/` holds `derive-palette.ts` (pure, Vitest), `tokens-to-css.ts` (fixed template) and `terms.ts` (typed keys, defaults, merge).
  - `src/server-actions/admin-branding/` holds get-draft, save-draft, publish and rollback.
  - The root loader and `head()` in `__root.tsx` gain `branding`.
  - `ScriptOnce` handles dark mode.
  - The role app shells read `display_name`/logo/features.
  - `src/lib/query-keys.ts` gains a branding key.

## Open questions / decisions for the product owner

1. **Depth of customisation per plan.** Logo + one colour for all plans? Accent colour, fonts, custom domain and terminology on higher tiers? (This also decides whether `plan_tier` should stop being editable by institution ADMINs.)
2. **Tenant URL strategy.** Stay on one shared domain (tenant from login only), add `<slug>.emeris…` subdomains, or offer custom domains too? This affects branded login pages, the hosting choice (wildcard DNS) and the auth cookie domain.
3. **Branded login before sign-in?** If yes, a subdomain or slug is required. A shared login page cannot know the tenant before the user identifies.
4. **Student check-in branding.** Is showing the institution logo/colours on `/student/check-in` (resolved via the session id in the QR) wanted, and is exposing the institution name there acceptable?
5. **Terminology scope.**
   - Nouns only (module/course, tutor/demonstrator) or also free sentence overrides?
   - Should exports (payroll CSV, reports) and emails/notifications use tenant terms or canonical ones?
   - Recommendation: canonical in CSV headers, tenant terms in UI and emails.
6. **Structural variation.** Which feature toggles are real requirements (no campuses, no QR attendance, no lecturer verification)? Workflow-changing toggles touch the claim state machine and DB trigger and need separate design.
7. **Locked colours.** Confirm that status colours (success/warning/destructive and claim statuses) are never tenant-editable.
8. **Who publishes.** Institution ADMIN self-serve, or platform SUPER_ADMIN review before publish? Is step-up TOTP required to publish?
9. **Dark mode.** Must every tenant theme support dark mode (derived automatically), or may tenants choose light-only?
10. **Prerequisite refactor.** Is it acceptable to first consolidate the lagoon/teal hard-coded classes onto semantic tokens, a visible but neutral change to the current Emeris look?

## Sources

Tailwind / shadcn
- [1] Tailwind CSS. Theme variables. https://tailwindcss.com/docs/theme
- [2] shadcn/ui. Theming. https://ui.shadcn.com/docs/theming
- [3] shadcn/ui. Tailwind v4. https://ui.shadcn.com/docs/tailwind-v4

Colour and accessibility
- [4] MDN. `oklch()`. https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch
- [5] W3C. CSS Color Module Level 4 (Candidate Recommendation Draft, 9 October 2026). https://www.w3.org/TR/css-color-4/
- [6] W3C WAI. Understanding SC 1.4.3 Contrast (Minimum), WCAG 2.2. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- [7] W3C WAI. Understanding SC 1.4.11 Non-text Contrast, WCAG 2.2. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- [8] W3C WAI. Understanding SC 1.4.1 Use of Color, WCAG 2.2. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- [9] W3C. WCAG 3.0 Working Draft (10 September 2026). https://www.w3.org/TR/wcag-3.0/
- [10] Myndex. apca-w3 (APCA reference implementation, README). https://github.com/Myndex/apca-w3
- [11] culori (GitHub README). https://github.com/Evercoder/culori
- [12] culori API reference. https://culorijs.org/api/
- [13] Color.js. Contrast. https://colorjs.io/docs/contrast

TanStack
- [14] TanStack Router. Document Head Management. https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management
- [15] TanStack Router. RouteOptions type (`head` context incl. `loaderData`). https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType
- [19] TanStack Start. Middleware. https://tanstack.com/start/latest/docs/framework/react/guide/middleware
- [20] TanStack Start. Server Functions (Server Context & Request Handling). https://tanstack.com/start/latest/docs/framework/react/guide/server-functions

Security / web platform
- [16] MDN. CSP `style-src`. https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src
- [27] MDN. SVG `<script>` element. https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script
- [28] MDN. Web application manifest. https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest

Tenancy and hosting
- [17] Vercel. Multi-Tenant Platform Concepts. https://vercel.com/docs/platforms/multi-tenant-platforms/concepts
- [18] Vercel. Vercel for Platforms. https://vercel.com/docs/platforms

Terminology / i18n
- [21] ICU User Guide. Formatting Messages. https://unicode-org.github.io/icu/userguide/format_parse/messages/
- [22] FormatJS. ICU Message syntax. https://formatjs.github.io/docs/core-concepts/icu-syntax
- [23] Unicode CLDR. Plural Rules. https://cldr.unicode.org/index/cldr-spec/plural-rules

Supabase
- [24] Supabase. Storage buckets fundamentals. https://supabase.com/docs/guides/storage/buckets/fundamentals
- [25] Supabase. Storage access control. https://supabase.com/docs/guides/storage/security/access-control
- [26] Supabase. Storage image transformations. https://supabase.com/docs/guides/storage/serving/image-transformations

Gaps and unverified points:
- That runtime overriding of `@theme inline`-mapped variables works is inferred from Tailwind's compile behaviour, not stated as a feature.
- Browser support for CSS relative colour syntax was not checked.
- SVG support in Supabase image transformations came from a fetched summary and should be re-checked.
- `style-src-attr` / `style-src-elem` details were not read from their own MDN pages.
- Dynamic per-tenant manifests are not explicitly documented by MDN.
- The "a/an" article guidance is general practice, not from a cited source.
- The hosting provider for Emeris is undecided; Vercel docs are used as a representative primary source for subdomain and custom-domain mechanics.
