"use client"

import React, { createContext, useState } from "react";
import { ToastType } from "./PlaygroundToast";

type ToastProviderData = {
  setToastMessage: (
    message: { message: string; type: ToastType } | null
  ) => void;
  toastMessage: { message: string; type: ToastType } | null;
};

const ToastContext = createContext<ToastProviderData | undefined>(undefined);

export const ToastProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [toastMessage, setToastMessage] = useState<{message: string, type: ToastType} | null>(null);

  return (
    <ToastContext.Provider
      value={{
        toastMessage,
        setToastMessage
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}