import { encodeDictionary } from "./Encode/encodeDictionary";
import {decodeBencode} from "./Bencode/decodeBencode"
import { sha1 } from "js-sha1";
import * as fs from 'node:fs';

const args = process.argv;
const bencodedValue = args[3];
console.log(bencodedValue);

if (args[2] === "decode") {
    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}

if (args[2] === "info") {
    try {
        const torrentFilePath = args[3];
        const bencodedData = fs.readFileSync(torrentFilePath, 'utf8');
        const decoded = decodeBencode(bencodedData) as Record<string, any>;
        console.log("Decoded torrent is", decoded);

        const infoDictionary = decoded.info;
        const encodedInfoDictionary = encodeDictionary(infoDictionary);
        console.log("Encoded info is",encodedInfoDictionary)

        const againDecoded = decodeBencode(encodedInfoDictionary);
        console.log("Again decoded is", againDecoded);

        const hash = sha1.hex(encodedInfoDictionary);
        console.log("SHA-1 Hash (Hex):", hash);

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}