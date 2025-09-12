export interface DisconnectedPillProps {
  icon: JSX.Element;
  prefix?: string;
  // keyword: string;
  title: string;
}

export default function DisconnectedPill({
  icon,
  prefix,
  title,
}: DisconnectedPillProps) {
  return (
    <div className="flex items-center justify-center text-skin-primary px-6 py-3 gap-2 rounded-full bg-skin-fill-accent w-full h-full">
      {icon}
      {prefix}
      <span>-</span>
      <span className="text-skin-connect">Connect</span>

      {title}
    </div>
  );
}
