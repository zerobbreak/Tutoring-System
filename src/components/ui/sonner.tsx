import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

import { cn } from "#/lib/utils";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ className, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className={cn("toaster group", className)}
      position="top-center"
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground",
            "group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          ),
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
