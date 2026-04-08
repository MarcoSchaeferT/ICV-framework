import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...nextCoreWebVitals],

    rules: {
        "no-restricted-imports": ["error", {
            name: "next/link",
            message: "Please use the Link component from '@/i18n/routing'; instead.",
            importNames: ["default"],
        }, {
            name: "next/naviagation",
            message: "Please use the Link component from '@/i18n/routing'; instead.",
            importNames: ["redirect", "permanentRedirect", "useRouter", "usePathname"],
        }],
    },
}]);