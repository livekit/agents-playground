export interface DisconnectedPillProps {
  icon: JSX.Element;
  prefix?: string;
  // keyword: string;
  title: string;
}

export default function DisconnectedPill({
  icon,
  prefix,
  // keyword,
  title,
}: DisconnectedPillProps) {
  const words = title.split(" ");

  console.log(words);

  const [word] = words.filter((entry) => entry === "Connect");
  console.log(word);

  const index = words.indexOf(word);

  console.log(index);

  const start = `<span className="text-red-500>`;
  const end = `</span>`;
  const finalWord = `${start}${word}${end}`;

  console.log(finalWord);

  return (
    <div className="flex items-center justify-center text-white px-6 py-3 gap-3 rounded-full bg-skin-fill-accent w-full h-full">
      {icon}
      {prefix}
      <span className="text-skin-connect">Connect</span>

      {title}
    </div>
  );
}
