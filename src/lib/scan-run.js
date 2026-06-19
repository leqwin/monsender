// Injected after scan-core.js by scripting.executeScript. Runs once
// in the active tab on a user gesture; nothing persists. The final expression is
// the executeScript result. Firefox cannot structured-clone the collected array
// of objects back across the content-script sandbox boundary, but a string
// always clones, so the list is serialized here and parsed by the caller.
JSON.stringify(self.ML.scanCore.collect(document, window));
