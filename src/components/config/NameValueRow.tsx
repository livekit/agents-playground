import * as React from "react";
import { ReactNode } from "react";

type NameValueRowProps = {
  name: string;
  value?: ReactNode;
  valueColor?: string;
};

export const NameValueRow: React.FC<NameValueRowProps> = ({
  name,
  value,
  valueColor = "gray-300",
}) => {
  return (
    <div className="flex flex-row w-full items-baseline text-sm">
      <div className="grow shrink-0 text-gray-500">{name}</div>
      <div className={`text-xs shrink text-${valueColor} text-right`}>
        {value}
      </div>
    </div>
  );
};

type EditableNameValueRowProps = {
  name: string;
  value: string;
  valueColor?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  editable: boolean;
};

export const EditableNameValueRow: React.FC<EditableNameValueRowProps> = ({
  name,
  value,
  valueColor = "gray-300",
  onValueChange,
  placeholder,
  editable,
}) => {
  if (editable && onValueChange) {
    return (
      <div className="flex flex-row w-full items-baseline text-sm">
        <div className="grow shrink-0 text-gray-500">{name}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`text-xs shrink text-${valueColor} text-right bg-transparent border-b border-gray-800 focus:outline-none focus:border-gray-600 px-2 py-0`}
          placeholder={placeholder}
        />
      </div>
    );
  }
  return (
    <NameValueRow
      name={name}
      value={value}
      valueColor={valueColor}
    />
  );
};

type SelectionNameValueRowProps = {
  name: string;
  value: string;
  options: string[];
  valueColor?: string;
  onValueChange?: (value: string) => void;
  editable: boolean;
};

export const SelectionNameValueRow: React.FC<SelectionNameValueRowProps> = ({
  name,
  value,
  options,
  valueColor = "gray-300",
  onValueChange,
  editable,
}) => {
  if (editable && onValueChange) {
    return (
      <div className="flex flex-row w-full items-baseline text-sm">
        <div className="grow shrink-0 text-gray-500">{name}</div>
        <select
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`text-xs shrink text-${valueColor} text-right bg-transparent border-b border-gray-800 focus:outline-none focus:border-gray-600 px-2 py-0`}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <NameValueRow
      name={name}
      value={value}
      valueColor={valueColor}
    />
  );
};


type EditableJSONProps = {
  name: string;
  value: string;
  valueColor?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  editable: boolean;
};
export const InputJSON: React.FC<EditableJSONProps> = ({
  name,
  value,
  valueColor = "gray-300",
  onValueChange,
  placeholder,
  editable,
}) => {
  const [text, setText] = React.useState(value);
  const [isValidJSON, setIsValidJSON] = React.useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setText(newValue);
    if (onValueChange) {
      if (newValue.trim() === "") {
        setIsValidJSON(true);
        onValueChange(newValue);
      } else {
        try {
          JSON.parse(newValue);
          setIsValidJSON(true);
          onValueChange(newValue);
        } catch {
          setIsValidJSON(false);
        }
      }
    }
  };

  if (editable && onValueChange) {
    return (
      <div className="flex flex-col w-full text-sm">
        <div className="text-gray-500 mb-1">{name}</div>
        <textarea
          className={`text-xs text-${valueColor} bg-transparent border ${isValidJSON ? 'border-gray-800' : 'border-red-500'} focus:outline-none focus:border-gray-600 px-2 py-1`}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          rows={12} // Increased height
        />
        {!isValidJSON && (
          <div className="text-red-500 text-xs mt-1">Invalid JSON</div>
        )}
      </div>
    );
  }
  return (
    <NameValueRow
      name={name}
      value={<pre className={`text-${valueColor}`}>{value}</pre>}
      valueColor={valueColor}
    />
  );
};
