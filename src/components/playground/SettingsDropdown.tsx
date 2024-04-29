import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronIcon } from "./icons";
import { useSettings } from "@/hooks/useAppConfig";

type SettingType = {
  title: string;
  type: "input" | "output" | "separator";
  key: string;
};

const settingsDropdown: SettingType[] = [
  {
    title: "Show video",
    type: "output",
    key: "video",
  },
  {
    title: "Show audio",
    type: "output",
    key: "audio",
  },
  {
    title: "Show chat",
    type: "output",
    key: "chat",
  },
  {
    title: "---",
    type: "separator",
    key: "separator",
  },
  {
    title: "Enable camera",
    type: "input",
    key: "camera",
  },
  {
    title: "Enable mic",
    type: "input",
    key: "mic",
  },
];

export const SettingsDropdown = () => {
  const [settings, setSettings] = useSettings();

  const isEnabled = (settingType: SettingType) => {
    const initialKey = settingType.type === "input" ? "inputs" : "outputs";
    return (settings as any)[initialKey][settingType.key] ?? false;
  };

  const toggleSetting = (settingType: SettingType) => {
    const initialKey = settingType.type === "input" ? "inputs" : "outputs";
    let newSettings = { ...(settings as any) };
    let newSetting = !newSettings[initialKey][settingType.key];
    newSettings[initialKey][settingType.key] = newSetting;
    setSettings(newSettings);
  };

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="group inline-flex max-h-12 items-center gap-1 rounded-md hover:bg-gray-800 bg-gray-900 border-gray-800 p-1 pr-2 text-gray-100">
        <button className="my-auto text-sm flex gap-1 pl-2 py-1 h-full items-center">
          Settings
          <ChevronIcon />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 flex w-60 flex-col gap-0 overflow-hidden rounded text-gray-100 border border-gray-800 bg-gray-900 py-2 text-sm"
          sideOffset={5}
          collisionPadding={16}
        >
          {settingsDropdown.map((setting) => {
            if (setting.type === "separator") {
              return (
                <div
                  key={setting.key}
                  className="border-t border-gray-800 my-2"
                />
              );
            }

            return (
              <DropdownMenu.Label
                key={setting.key}
                onClick={() => toggleSetting(setting)}
                className="flex max-w-full flex-row items-end gap-2 px-3 py-2 text-xs hover:bg-gray-800 cursor-pointer"
              >
                <div className="w-4 h-4 flex items-center">
                  {isEnabled(setting) && <CheckIcon />}
                </div>
                <span>{setting.title}</span>
              </DropdownMenu.Label>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
