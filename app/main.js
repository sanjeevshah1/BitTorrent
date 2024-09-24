"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var encodeDictionary_1 = require("./Encode/encodeDictionary");
var decodeBencode_1 = require("./Bencode/decodeBencode");
var js_sha1_1 = require("js-sha1");
var fs = require("node:fs");
var args = process.argv;
var bencodedValue = args[3];
console.log(bencodedValue);
if (args[2] === "decode") {
    try {
        var decoded = (0, decodeBencode_1.decodeBencode)(bencodedValue);
        console.log(JSON.stringify(decoded));
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        }
        else {
            console.log("Unknown error occurred");
        }
    }
}
if (args[2] === "info") {
    try {
        var torrentFilePath = args[3];
        var bencodedData = fs.readFileSync(torrentFilePath, 'utf8');
        var decoded = (0, decodeBencode_1.decodeBencode)(bencodedData);
        console.log("Decoded torrent is", decoded);
        var infoDictionary = decoded.info;
        var encodedInfoDictionary = (0, encodeDictionary_1.encodeDictionary)(infoDictionary);
        console.log("Encoded info is", encodedInfoDictionary);
        var againDecoded = (0, decodeBencode_1.decodeBencode)(encodedInfoDictionary);
        console.log("Again decoded is", againDecoded);
        var hash = js_sha1_1.sha1.hex(encodedInfoDictionary);
        console.log("SHA-1 Hash (Hex):", hash);
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        }
        else {
            console.log("Unknown error occurred");
        }
    }
}
