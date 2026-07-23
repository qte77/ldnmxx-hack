// Build-time constant injected by vite `define` (← npm_package_version, stamped by `make bump`),
// so the footer always shows the shipped release without a runtime fetch or bundled JSON import.
declare const __APP_VERSION__: string;
