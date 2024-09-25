"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("node:fs");
var crypto_1 = require("crypto");
var bencodec_1 = require("bencodec");
var decodeBencode_1 = require("./Bencode/decodeBencode");
var args = process.argv;
var bencodedValue = args[3];
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
function extractPieceHashes(pieces) {
    var hashes = [];
    for (var i = 0; i < pieces.length; i += 20) {
        hashes.push(pieces.slice(i, i + 20).toString('hex'));
    }
    return hashes;
}
if (args[2] === "info") {
    try {
        var torrentFilePath = args[3];
        var bencodedData = fs.readFileSync(torrentFilePath);
        var decoded = bencodec_1.default.decode(bencodedData);
        var info = decoded.info;
        var encodedInfo = bencodec_1.default.encode(info);
        var infoHash = (0, crypto_1.createHash)('sha1').update(encodedInfo).digest('hex');
        console.log("Tracker URl: ".concat(decoded.announce));
        console.log("Length: ".concat(info.length));
        console.log("Info Hash: ".concat(infoHash));
        console.log("Piece Length:", info["piece length"]);
        var pieceHashes = extractPieceHashes(info.pieces);
        console.log("Piece Hashes:");
        pieceHashes.forEach(function (hash, index) {
            console.log(hash);
        });
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
