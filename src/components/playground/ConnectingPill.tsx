import { ConnectingSpinner } from "./icons";

export interface ConnectingPill {
  icon: JSX.Element;
  prefix?: string;
  title: string;
}

export default function ConnectingPill({ icon, title }: ConnectingPill) {
  return (
    <div className="flex items-center justify-center text-skin-primary pl-6 pt-1 pb-1 pr-1 gap-2 rounded-full bg-skin-fill-accent">
      {icon}
      {title}
      <ConnectingSpinner />
    </div>
  );
}
