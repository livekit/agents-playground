import React, { useCallback } from "react";

type TokenGeneratorData = {
  generateConnectionDetails: () => Promise<void>
  connectionDetails: {token: string, url: string} | undefined
}

const TokenGeneratorContext = React.createContext<TokenGeneratorData | undefined>(undefined);

type Props = {
  tokenGenerator: () => Promise<{ token: string; url: string }>;
  children: React.ReactNode;
};

export function TokenGeneratorProvider({tokenGenerator, children}: Props) {
  const [connectionDetails, setConnectionDetails] = React.useState<
    { token: string; url: string } | undefined
  >(undefined);

  const generateConnectionDetails = useCallback(async () => {
    const details = await tokenGenerator();
    setConnectionDetails(details);
  }, [tokenGenerator])

  return (
    <TokenGeneratorContext.Provider value={{ generateConnectionDetails, connectionDetails }}>
      {children}
    </TokenGeneratorContext.Provider>
  );
}

export function useTokenGenerator() {
  const context = React.useContext(TokenGeneratorContext);
  if (!context) {
    throw new Error("useTokenGenerator must be used within a TokenGeneratorProvider");
  }
  return context;
}