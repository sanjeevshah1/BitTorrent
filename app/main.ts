import * as fs from 'node:fs';
import { createHash } from 'crypto';
import bencodec from 'bencodec';
import { decodeBencode } from './Bencode/decodeBencode';

const args = process.argv;
const bencodedValue = args[3];

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

function extractPieceHashes(pieces: Buffer): string[] {
    const hashes: string[] = [];
    for (let i = 0; i < pieces.length; i += 20) {
        hashes.push(pieces.slice(i, i + 20).toString('hex'));
    }
    return hashes;
}
interface data {
    announce: string,
    info: {
        name: string,
        "piece length": number,
        pieces: Buffer,
        length: number,
    }
}

if (args[2] === "info") {
    try {
        const torrentFilePath = args[3];
        const bencodedData = fs.readFileSync(torrentFilePath);
        const decoded:data = bencodec.decode(bencodedData);
        const info = decoded.info;
        const encodedInfo = bencodec.encode(info);
        const infoHash = createHash('sha1').update(encodedInfo).digest('hex');
        

        console.log(`Tracker URl: ${decoded.announce}`);
        console.log(`Length: ${info.length}`);
        console.log(`Info Hash: ${infoHash}`);
        console.log("Piece Length:",info["piece length"]);
        const pieceHashes = extractPieceHashes(info.pieces);
        console.log("Piece Hashes:");
        pieceHashes.forEach((hash, index) => {
            console.log(hash);
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}