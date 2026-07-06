"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./src/database"));
const parcels = database_1.default.getParcels();
console.log(`Parcels: ${parcels.length}`);
for (const p of parcels) {
    const settings = database_1.default.getParcelSettings(p.guia);
    console.log(settings);
}
console.log("Done");
