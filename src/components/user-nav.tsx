import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  formatRoleLabel,
  isAdminDashboardRole,
  isTutorDashboardRole,
} from "../lib/user-role";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

interface UserNavProps {
  user: any;
}

export function UserNav({ user }: UserNavProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : user.email?.[0].toUpperCase();

  const roleRaw = user.user_metadata?.role as string | undefined;
  const roleLabel = formatRoleLabel(roleRaw);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="relative h-10 w-10 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-[var(--lagoon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setOpen(!open)}
      >
        <Avatar className="h-10 w-10">
          {user.user_metadata?.avatar_url ? (
            <AvatarImage src={user.user_metadata.avatar_url} alt={user.email} />
          ) : (
            <AvatarFallback className="bg-[var(--lagoon)] text-white">{initials}</AvatarFallback>
          )}
        </Avatar>
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-bold text-[#0A1128] truncate">
              {user.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-[var(--lagoon)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--lagoon-deep)]">
              {roleLabel}
            </span>
          </div>
          <div className="py-1">
            <a
              href={
                isAdminDashboardRole(roleRaw)
                  ? "/admin"
                  : isTutorDashboardRole(roleRaw)
                    ? "/tutor"
                    : "/"
              }
              className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </a>
            <a
              href="/settings"
              className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setOpen(false)}
            >
              Settings
            </a>
            <button
              className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
