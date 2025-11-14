export interface DisconnectedPillProps {
  icon: JSX.Element;
  prefix?: string;
  title: string;
  showSeparator?: boolean;
}

export default function DisconnectedPill({
  icon,
  prefix,
  title,
  showSeparator = true,
}: DisconnectedPillProps) {
  return (
    <div className="flex items-center justify-center text-skin-primary px-6 py-3 gap-2 rounded-full bg-skin-fill-accent">
      {icon}
      {prefix}
      {showSeparator && <span>-</span>}
      <span className="text-skin-connect">Connect</span>

      {title}
    </div>
  );
}
