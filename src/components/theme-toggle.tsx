import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip";

export function ThemeToggle() {
  const [themeDark, setThemeDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("tutor-theme");
    const prefersDark = stored === "dark";
    setThemeDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggleTheme = () => {
    const next = !themeDark;
    setThemeDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("tutor-theme", next ? "dark" : "light");
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-9"
          >
            {themeDark ? (
              <Sun className="size-5 text-amber-500" />
            ) : (
              <Moon className="size-5 text-slate-700" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Toggle theme</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
