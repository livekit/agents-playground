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
      <div className={`text-xs uppercase shrink text-${valueColor} text-right`}>
        {value}
      </div>
    </div>
  );
};
