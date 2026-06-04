"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleFoldingRangeProvider = void 0;
const simpleAnalysisIndex_1 = require("./analysis/simpleAnalysisIndex");
class SimpleFoldingRangeProvider {
    constructor() {
        this.enabled = true;
    }
    provideFoldingRanges(document) {
        if (!this.enabled) {
            return [];
        }
        return (0, simpleAnalysisIndex_1.analyzeDocument)(document).folds;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
exports.SimpleFoldingRangeProvider = SimpleFoldingRangeProvider;
//# sourceMappingURL=nativeFoldingProvider.js.map