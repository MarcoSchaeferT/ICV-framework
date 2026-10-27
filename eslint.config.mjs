import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tsdocPlugin from "eslint-plugin-tsdoc";

export default defineConfig([globalIgnores(["backend/.venv/"]), {
    extends: [...nextCoreWebVitals],
    plugins: {
        tsdoc: tsdocPlugin,
    },
    rules: {
        "no-restricted-imports": ["error", {
            name: "next/link",
            message: "Please use the Link component from '@/i18n/routing'; instead.",
            importNames: ["default"],
        }, {
            name: "next/navigation",
            message: "Please use the locale-aware navigation helpers from '@/i18n/routing' instead.",
            importNames: ["redirect", "useRouter", "usePathname"],
        }],
    },
}, {
    // JavaScript config and plugin files use JSDoc type annotations, which TSDoc does not parse.
    files: ["**/*.{ts,tsx}"],
    rules: {
        "tsdoc/syntax": "error",
    },
}]);
