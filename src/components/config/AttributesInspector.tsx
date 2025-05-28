import React, { useState } from "react";
import { ConnectionState } from "livekit-client";
import { AttributeItem } from "@/lib/types";
import { Button } from "@/components/button/Button";

interface AttributesInspectorProps {
  attributes: AttributeItem[];
  onAttributesChange: (attributes: AttributeItem[]) => void;
  themeColor: string;
  disabled?: boolean;
  connectionState?: ConnectionState;
}

export const AttributesInspector: React.FC<AttributesInspectorProps> = ({
  attributes,
  onAttributesChange,
  themeColor,
  disabled = false,
  connectionState,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleKeyChange = (id: string, newKey: string) => {
    const updatedAttributes = attributes.map((attr) =>
      attr.id === id ? { ...attr, key: newKey } : attr,
    );
    onAttributesChange(updatedAttributes);
  };

  const handleValueChange = (id: string, newValue: string) => {
    const updatedAttributes = attributes.map((attr) =>
      attr.id === id ? { ...attr, value: newValue } : attr,
    );
    onAttributesChange(updatedAttributes);
  };

  const handleRemoveAttribute = (id: string) => {
    const updatedAttributes = attributes.filter((attr) => attr.id !== id);
    onAttributesChange(updatedAttributes);
  };

  const handleAddAttribute = () => {
    const newId = `attr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const updatedAttributes = [
      ...attributes,
      { id: newId, key: "", value: "" },
    ];
    onAttributesChange(updatedAttributes);
  };

  return (
    <div>
        <div 
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-sm text-gray-500">Participant Attributes</div>
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
        <div className="border border-gray-800 rounded-sm bg-gray-900/30 p-3">
          {attributes.map((attribute) => (
            <div key={attribute.id} className="flex items-center gap-2 mb-2">
              <input
                value={attribute.key}
                onChange={(e) => handleKeyChange(attribute.id, e.target.value)}
                className="flex-1 min-w-0 text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-1"
                placeholder="Key"
                disabled={disabled}
              />
              <input
                value={attribute.value}
                onChange={(e) => handleValueChange(attribute.id, e.target.value)}
                className="flex-1 min-w-0 text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-1"
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

          {!disabled && (
            <div className="flex justify-start">
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
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2 text-right">
        <a
          href="https://docs.livekit.io/home/client/state/participant-attributes"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-300 underline"
        >
           Learn more about participant attributes
        </a>
      </p>
    </div>
  );
};
