import React, { useState, useCallback, useEffect } from "react";
import { ConnectionState } from "livekit-client";
import { AttributeItem } from "@/lib/types";
import { Button } from "@/components/button/Button";
import { useLocalParticipant } from "@livekit/components-react";

interface AttributesInspectorProps {
  attributes: AttributeItem[];
  onAttributesChange: (attributes: AttributeItem[]) => void;
  themeColor: string;
  disabled?: boolean;
  connectionState?: ConnectionState;
  metadata?: string;
  onMetadataChange?: (metadata: string) => void;
}

export const AttributesInspector: React.FC<AttributesInspectorProps> = ({
  attributes,
  onAttributesChange,
  themeColor,
  disabled = false,
  connectionState,
  metadata,
  onMetadataChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [localAttributes, setLocalAttributes] = useState<AttributeItem[]>(attributes);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSyncFlash, setShowSyncFlash] = useState(false);
  const { localParticipant } = useLocalParticipant();

  // Update local attributes when props change
  useEffect(() => {
    setLocalAttributes(attributes);
  }, [attributes]);

  const syncAttributesWithRoom = useCallback(() => {
    if (!localParticipant || connectionState !== ConnectionState.Connected) return;

    const attributesMap = localAttributes.reduce((acc, attr) => {
      if (attr.key && attr.key.trim() !== '') {
        acc[attr.key] = attr.value;
      }
      return acc;
    }, {} as Record<string, string>);

    localParticipant.setAttributes(attributesMap);
    setHasUnsavedChanges(false);
    setShowSyncFlash(true);
    setTimeout(() => setShowSyncFlash(false), 1000);
  }, [localAttributes, localParticipant, connectionState]);

  // Auto-save after 1 second of no changes, but only when connected
  useEffect(() => {
    if (!hasUnsavedChanges || connectionState !== ConnectionState.Connected) return;

    const timeoutId = setTimeout(() => {
      syncAttributesWithRoom();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, syncAttributesWithRoom, connectionState]);

  const handleKeyChange = (id: string, newKey: string) => {
    const updatedAttributes = localAttributes.map((attr) =>
      attr.id === id ? { ...attr, key: newKey } : attr,
    );
    setLocalAttributes(updatedAttributes);
    onAttributesChange(updatedAttributes);
    if (connectionState === ConnectionState.Connected && newKey.trim() !== '') {
      setHasUnsavedChanges(true);
    }
  };

  const handleValueChange = (id: string, newValue: string) => {
    const updatedAttributes = localAttributes.map((attr) =>
      attr.id === id ? { ...attr, value: newValue } : attr,
    );
    setLocalAttributes(updatedAttributes);
    onAttributesChange(updatedAttributes);
    if (connectionState === ConnectionState.Connected) {
      setHasUnsavedChanges(true);
    }
  };

  const handleRemoveAttribute = (id: string) => {
    const updatedAttributes = localAttributes.filter((attr) => attr.id !== id);
    setLocalAttributes(updatedAttributes);
    onAttributesChange(updatedAttributes);
    if (connectionState === ConnectionState.Connected) {
      setHasUnsavedChanges(true);
    }
  };

  const handleAddAttribute = () => {
    const newId = `attr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const updatedAttributes = [
      ...localAttributes,
      { id: newId, key: "", value: "" },
    ];
    setLocalAttributes(updatedAttributes);
    onAttributesChange(updatedAttributes);
    if (connectionState === ConnectionState.Connected) {
      setHasUnsavedChanges(true);
    }
  };

  return (
    <div>
      <div
        className="flex items-center justify-between mb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-sm text-gray-500">Attributes</div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {isExpanded && (
        <div className="border border-gray-800 rounded-sm bg-gray-900/30 p-3 mb-2">
          {disabled ? (
            localAttributes.length === 0 ? (
              <div className="text-sm text-gray-400 font-sans">No attributes set</div>
            ) : (
              localAttributes.map((attribute) => (
                <div key={attribute.id} className="flex items-center gap-2 mb-2">
                  <input
                    value={attribute.key}
                    onChange={(e) => handleKeyChange(attribute.id, e.target.value)}
                    className="flex-1 min-w-0 text-gray-400 text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-1 font-mono"
                    placeholder="Name"
                    disabled
                  />
                  <input
                    value={attribute.value}
                    onChange={(e) => handleValueChange(attribute.id, e.target.value)}
                    className="flex-1 min-w-0 text-gray-400 text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-1 font-mono"
                    placeholder="Value"
                    disabled
                  />
                </div>
              ))
            )
          ) : (
            <>
              {localAttributes.map((attribute) => (
                <div key={attribute.id} className="flex items-center gap-2 mb-2">
                  <input
                    value={attribute.key}
                    onChange={(e) => handleKeyChange(attribute.id, e.target.value)}
                    className="flex-1 min-w-0 text-gray-400 text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-1 font-mono"
                    placeholder="Name"
                    disabled={disabled}
                  />
                  <input
                    value={attribute.value}
                    onChange={(e) => handleValueChange(attribute.id, e.target.value)}
                    className="flex-1 min-w-0 text-gray-400 text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-1 font-mono"
                    placeholder="Value"
                    disabled={disabled}
                  />
                  <button
                    onClick={() => handleRemoveAttribute(attribute.id)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white"
                    disabled={disabled}
                    style={{ display: disabled ? "none" : "flex" }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <Button
                  accentColor={themeColor}
                  onClick={handleAddAttribute}
                  className="text-xs flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Attribute
                </Button>
                {showSyncFlash && (
                  <div className="text-xs text-gray-400 animate-fade-in-out">
                    Changes saved
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <>
        <div
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
        >
          <div className="text-sm text-gray-500">Metadata</div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-500 transition-transform ${isMetadataExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
        {isMetadataExpanded && (
          disabled || connectionState === ConnectionState.Connected ? (
            <div className="border border-gray-800 rounded-sm bg-gray-900/30 px-3 py-2 mb-4 min-h-[40px] flex items-center">
              {metadata ? (
                <pre className="w-full text-gray-400 text-xs bg-transparent font-mono whitespace-pre-wrap break-words m-0 p-0 border-0">
                  {metadata}
                </pre>
              ) : (
                <div className="text-sm text-gray-400 font-sans w-full text-left">No metadata set</div>
              )}
            </div>
          ) : (
            <textarea
              value={metadata}
              onChange={(e) => onMetadataChange?.(e.target.value)}
              className="w-full text-gray-400 text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2 font-mono mb-4"
              placeholder="Enter metadata..."
              rows={3}
            />
          )
        )}
      </>
    </div>
  );
};
