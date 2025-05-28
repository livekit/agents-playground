import React from "react";
import { ConnectionState } from "livekit-client";
import { AttributeItem } from "@/lib/types";

interface AttributesEditorProps {
  attributes: AttributeItem[];
  onAttributesChange: (attributes: AttributeItem[]) => void;
  themeColor: string;
  disabled?: boolean;
  connectionState?: ConnectionState;
}

export const AttributesEditor: React.FC<AttributesEditorProps> = ({
  attributes,
  onAttributesChange,
  themeColor,
  disabled = false,
  connectionState,
}) => {
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
    <div className="border border-gray-800 rounded-sm p-3 bg-gray-900/30">
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

      <button
        onClick={handleAddAttribute}
        className={`text-xs py-1 px-2 rounded-sm flex items-center gap-1 ${
          disabled
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : `bg-${themeColor}-500 hover:bg-${themeColor}-600 text-white`
        }`}
        disabled={disabled}
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
        Add Attribute
      </button>
    </div>
  );
};
