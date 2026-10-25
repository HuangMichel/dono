import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";

// Local development can share the root configuration with FastAPI. Only the
// three explicit NEXT_PUBLIC values below are exposed to browser code.
const existing = { ...process.env };
const publicKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_API_BASE_URL",
];
if (publicKeys.some((key) => !process.env[key])) {
  // Next may already have loaded frontend/.env.local using the same module.
  // Force the root load, then preserve every existing process/frontend setting.
  nextEnv.loadEnvConfig(
    fileURLToPath(new URL("../", import.meta.url)),
    process.env.NODE_ENV !== "production",
    console,
    true,
  );
  Object.assign(process.env, existing);
}

const config = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  },
};

export default config;
