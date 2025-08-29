import React, { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = {
  accentColor?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button: React.FC<ButtonProps> = ({
  accentColor,
  children,
  className,
  disabled,
  ...allProps
}) => {
  return (
    <button
      className={`flex flex-row ${
        disabled ? "pointer-events-none" : ""
      } text-sm justify-center border px-3 py-1 rounded-md active:scale-[0.98] ${className}`}
      {...allProps}
    >
      {children}
    </button>
  );
};
