import preval from "next-plugin-preval";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../../tailwind.config.js";

async function getTheme() {
  const fullTWConfig = resolveConfig(tailwindConfig);
  return fullTWConfig.theme;
}

export default preval(getTheme());
