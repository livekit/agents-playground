import React, { useCallback, useMemo } from "react";

type ConnectionDetailsGeneratorData = {
  connectionDetails: { token: string; url: string } | undefined;
  overrideToken: string | undefined;
  overrideUrl: string | undefined;
  setGenerator: (
    generator: (() => Promise<{ token: string; url: string }>) | undefined
  ) => void;
  generateConnectionDetails: () => Promise<void>;
  setOverrideToken: (token: string | undefined) => void;
  setOverrideUrl: (url: string | undefined) => void;
};

const TokenGeneratorContext = React.createContext<ConnectionDetailsGeneratorData | undefined>(undefined);

type Props = {
  connectionDetailsGenerator:
    | (() => Promise<{ token: string; url: string }>)
    | undefined;
  children: React.ReactNode;
};

export function ConnectionDetailsGeneratorProvider({connectionDetailsGenerator, children}: Props) {
  const [_connectionDetails, _setConnectionDetails] = React.useState<
    { token: string; url: string } | undefined
  >(undefined);
  const [overrideToken, setOverrideToken] = React.useState<string | undefined>(undefined)
  const [overrideUrl, setOverrideUrl] = React.useState<string | undefined>(
    undefined
  );
  const [generator, setGenerator] = React.useState<
    (() => Promise<{ token: string; url: string }>) | undefined
  >(connectionDetailsGenerator);

  const generateConnectionDetails = useCallback(async () => {
    if (!generator) {
      console.error(
        "Token generator not provided, can't generate connection details."
      );
      return;
    }
    const details = await generator();
    _setConnectionDetails(details);
  }, [generator]);

  const connectionDetails = useMemo(() => {
    if (_connectionDetails) {
      return _connectionDetails;
    }

  }, [_connectionDetails]);

  return (
    <TokenGeneratorContext.Provider
      value={{
        connectionDetails,
        overrideToken,
        overrideUrl,
        setGenerator,
        generateConnectionDetails,
        setOverrideToken,
        setOverrideUrl,
      }}
    >
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