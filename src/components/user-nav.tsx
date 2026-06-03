import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { supabase } from "../lib/supabase";
import {
  formatRoleLabel,
  getPostAuthDashboardPath,
  getUserRole,
} from "../lib/user-role";
import type { AppShellUser } from "./app-shell";

interface UserNavProps {
  user: AppShellUser;
}

export function UserNav({ user }: UserNavProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = APP_PATHS.auth.login;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? "?";

  const roleRaw = getUserRole(user);
  const roleLabel = formatRoleLabel(roleRaw);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="relative h-10 w-10 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-(--lagoon) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar className="h-10 w-10">
          {user.user_metadata?.avatar_url ? (
            <AvatarImage src={user.user_metadata.avatar_url} alt={user.email} />
          ) : (
            <AvatarFallback className="bg-(--lagoon) text-white">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right animate-in fade-in zoom-in-95 duration-100 rounded-xl bg-popover p-1 shadow-xl ring-1 ring-border focus:outline-none">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-bold text-foreground">
              {user.user_metadata?.full_name || "User"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-(--lagoon)/10 px-2 py-0.5 text-[10px] font-bold uppercase text-(--lagoon-deep)">
              {roleLabel}
            </span>
          </div>
          <div className="py-1">
            <Link
              to={getPostAuthDashboardPath(roleRaw)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to={APP_PATHS.settings}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            <button
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
