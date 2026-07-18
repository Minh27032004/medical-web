import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button chuẩn shadcn/ui, token Untitled UI: bo 8px, shadow-xs,
 * focus ring 4px brand-100. Dùng `asChild` để render thành <Link>.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-xs hover:bg-blue-700 focus-visible:ring-blue-100",
        destructive:
          "bg-red-600 text-white shadow-xs hover:bg-red-700 focus-visible:ring-red-100",
        outline:
          "border border-gray-300 bg-white text-gray-700 shadow-xs hover:bg-gray-50 focus-visible:ring-gray-100",
        secondary:
          "bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-100",
        ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        link: "text-blue-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2.5",
        sm: "rounded-lg px-3 py-2 text-sm",
        lg: "rounded-lg px-4.5 py-3 text-base",
        icon: "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
