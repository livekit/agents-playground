import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { useState } from "react";
import { LoadingSVG } from "@/components/button/LoadingSVG";

interface RpcPanelProps {
  config: any;
  rpcMethod: string;
  rpcPayload: string;
  setRpcMethod: (method: string) => void;
  setRpcPayload: (payload: string) => void;
  handleRpcCall: () => Promise<any>;
}

export function RpcPanel({
  config,
  rpcMethod,
  rpcPayload,
  setRpcMethod,
  setRpcPayload,
  handleRpcCall,
}: RpcPanelProps) {
  const [rpcResult, setRpcResult] = useState<{ success: boolean; data: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCall = async () => {
    setIsLoading(true);
    setRpcResult(null);
    try {
      const result = await handleRpcCall();
      setRpcResult({ success: true, data: result });
    } catch (error) {
      setRpcResult({ 
        success: false, 
        data: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfigurationPanelItem title="RPC" collapsible={true} defaultCollapsed={true}>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">
          Perform an{" "}
          <a
            href="https://docs.livekit.io/home/client/data/rpc/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 underline"
          >
            RPC call
          </a>{" "}
          on the agent.
        </p>
        <div className="text-xs text-gray-500 mt-2">Method Name</div>
        <input
          type="text"
          value={rpcMethod}
          onChange={(e) => setRpcMethod(e.target.value)}
          className="w-full text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2"
          placeholder="my_method"
        />

        <div className="text-xs text-gray-500 mt-2">Payload</div>
        <textarea
          value={rpcPayload}
          onChange={(e) => setRpcPayload(e.target.value)}
          className="w-full text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2"
          placeholder='{"my": "payload"}'
          rows={2}
        />

        <button
          onClick={handleCall}
          disabled={!rpcMethod || isLoading}
          className={`mt-2 px-2 py-1 rounded-sm text-xs flex items-center justify-center gap-2
            ${
              rpcMethod && !isLoading
                ? `bg-${config.settings.theme_color}-500 hover:bg-${config.settings.theme_color}-600`
                : "bg-gray-700 cursor-not-allowed"
            } text-white`}
        >
          {isLoading ? (
            <>
              <LoadingSVG diameter={12} strokeWidth={2} />
              Performing RPC...
            </>
          ) : (
            "Perform RPC"
          )}
        </button>

        {rpcResult && (
          <>
            <div className="text-xs text-gray-500 mt-2">
              {rpcResult.success ? "Result" : "Error"}
            </div>
            <div
              className={`w-full text-sm bg-transparent border rounded-sm px-3 py-2 ${
                rpcResult.success
                  ? "border-green-500 text-green-500"
                  : "border-red-500 text-red-500"
              }`}
            >
              {typeof rpcResult.data === "object"
                ? JSON.stringify(rpcResult.data, null, 2)
                : String(rpcResult.data)}
            </div>
          </>
        )}
      </div>
    </ConfigurationPanelItem>
  );
} 