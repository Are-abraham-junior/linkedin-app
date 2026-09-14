import React from "react";
import clsx from "clsx";

interface ContainerProps {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "header" | "footer" | "nav";
  id?: string;
}

export const Container: React.FC<ContainerProps> = ({ className, children, as = "div", id }) => {
  const Tag = as;
  return (
    <Tag id={id} className={clsx("mx-auto w-full max-w-site px-5 sm:px-8", className)}>
      {children}
    </Tag>
  );
};
