export function CloudProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useCloud() {
  const generateToken: () => Promise<string> = async () => {
    throw new Error("Not implemented");
  };
  const wsUrl = "";

  return { generateToken, wsUrl };
}