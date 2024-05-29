import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { SettingsDropdown } from "@/components/playground/SettingsDropdown";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import { ReactNode } from "react";

type PlaygroundHeader = {
  logo?: ReactNode;
  title?: ReactNode;
  githubLink?: string;
  height: number;
  accentColor: string;
  connectionState: ConnectionState;
  onConnectClicked: () => void;
};

export const PlaygroundHeader = ({
  logo,
  title,
  githubLink,
  accentColor,
  height,
  onConnectClicked,
  connectionState,
}: PlaygroundHeader) => {
  const { config } = useConfig();
  return (
    <div
      className={`flex gap-4 pt-4 text-${accentColor}-500 justify-between items-center shrink-0`}
      style={{
        height: height + "px",
      }}
    >
      <div className="flex items-center gap-3 basis-2/3">
        <div className="flex lg:basis-1/2">
          <a href="https://livekit.io">{logo ?? <LKLogo />}</a>
        </div>
        <div className="lg:basis-1/2 lg:text-center text-xs lg:text-base lg:font-semibold text-white">
          {title}
        </div>
      </div>
      <div className="flex basis-1/3 justify-end items-center gap-2">
        {/* {githubLink && (
          <a
            href={githubLink}
            target="_blank"
            className={`text-white hover:text-white/80`}
          >
            <GithubSVG />
          </a>
        )} */}
        {config.settings.editable && <SettingsDropdown />}
        <Button
          accentColor={
            connectionState === ConnectionState.Connected ? "red" : accentColor
          }
          disabled={connectionState === ConnectionState.Connecting}
          onClick={() => {
            onConnectClicked();
          }}
        >
          {connectionState === ConnectionState.Connecting ? (
            <LoadingSVG />
          ) : connectionState === ConnectionState.Connected ? (
            "Disconnect"
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
};

const LKLogo = () => (
  <svg
    width="46"
    height="60"
    viewBox="0 0 46 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0.154175 53.44L10.4626 4.76379e-05L6.90572 35.7682L24.4848 36.9143L24.4521 42.9008L31.3896 59.249L24.7707 48.3597L0.154175 53.44Z"
      fill="#47ABFF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M28.2642 26.813L31.3898 59.2448L26.0956 35.1874L14.2159 34.5544L15.1669 22.1598L10.4628 7.86648e-05L17.7661 24.1684L28.2642 26.813Z"
      fill="#47ABFF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M30.3303 19.1601L30.6629 25.4919L20.9838 23.2173L20.9644 16.0715L10.4628 3.05015e-05L23.5952 16.7281L30.3303 19.1601Z"
      fill="#47ABFF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M32.0935 22.0604L41.0833 24.9262L41.9973 32.5173L32.3667 31.2483L32.0935 22.0604Z"
      fill="#47ABFF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M35.9453 32.8982L42.6011 33.7566L43.5588 39.9823L38.665 40.2083L31.3895 59.249L36.4959 40.4912L35.9453 32.8982Z"
      fill="#47ABFF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M45.2391 40.8988L45.9999 46.657L40.2188 48.2888L31.3895 59.249L40.1624 45.6581L39.9068 41.4179L45.2391 40.8988Z"
      fill="#47ABFF"
    />
  </svg>
);

const GithubSVG = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 98 96"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      fill="currentColor"
    />
  </svg>
);
