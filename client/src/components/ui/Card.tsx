import React from "react";
import clsx from "clsx";

export const cardClass = "rounded-2xl border border-line bg-surface";

const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-6" } as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof paddings;
  as?: "div" | "section" | "article";
}

export const Card: React.FC<CardProps> = ({ padding = "md", as: Tag = "div", className, ...rest }) => (
  <Tag className={clsx(cardClass, paddings[padding], className)} {...rest} />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={clsx("flex items-start justify-between gap-3 border-b border-line px-5 py-4", className)} {...rest} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...rest }) => (
  <h2 className={clsx("text-base font-semibold text-ink", className)} {...rest} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...rest }) => (
  <p className={clsx("mt-0.5 text-sm text-muted", className)} {...rest} />
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={clsx("p-5", className)} {...rest} />
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={clsx("flex items-center justify-end gap-2 border-t border-line px-5 py-4", className)} {...rest} />
);
