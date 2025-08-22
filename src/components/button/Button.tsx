import React, { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = {
  accentColor: string;
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
      } text-gray-950 text-sm justify-center border border-transparent bg-skin-button-primary px-3 py-1 rounded-md transition ease-out duration-250 hover:bg-transparent hover:shadow-bg-skin-fill-accent  hover:border-skin-fill-primary hover:text-skin-primary active:scale-[0.98] ${className}`}
      {...allProps}
    >
      {children}
    </button>
  );
};
