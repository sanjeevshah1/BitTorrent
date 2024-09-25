"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("node:fs");
var crypto_1 = require("crypto");
var bencodec_1 = require("bencodec");
var decodeBencode_1 = require("./Bencode/decodeBencode");
var args = process.argv;
if (args[2] === "decode") {
    try {
        var bencodedValue = args[3];
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
        hashes.push(pieces.subarray(i, i + 20).toString('hex'));
    }
    return hashes;
}
if (args[2] === "info") {
    try {
        var torrentFilePath = args[3];
        var torrentFileData = fs.readFileSync(torrentFilePath);
        var decodedTorrentFile = bencodec_1.default.decode(torrentFileData);
        var fileInfo = decodedTorrentFile.info;
        var encodedInfo = bencodec_1.default.encode(fileInfo);
        var infoHash = (0, crypto_1.createHash)('sha1').update(encodedInfo).digest('hex');
        var pieceHashes = extractPieceHashes(fileInfo.pieces);
        console.log("Tracker URl: ".concat(decodedTorrentFile.announce));
        console.log("Length:", fileInfo.length);
        console.log("Info Hash: ".concat(infoHash));
        console.log("Piece Length:", fileInfo["piece length"]);
        console.log("Piece Hashes:");
        pieceHashes.forEach(function (hash, index) {
            console.log(index + 1, ":", hash);
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
