// Test environment type relaxations and shims

// 1) Provide a declaration for 'tunnel' used by https-proxy-request tests
declare module 'tunnel' {
  const anyExport: any;
  export = anyExport;
}

