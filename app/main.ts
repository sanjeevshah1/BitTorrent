import * as fs from 'node:fs';
import { createHash } from 'crypto';
import bencodec from 'bencodec';
import { decodeBencode } from './Bencode/decodeBencode';

const args = process.argv;

if (args[2] === "decode") { 
    try {
        const bencodedValue: string = args[3];
        const decoded: {} = decodeBencode(bencodedValue);
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
        hashes.push(pieces.subarray(i, i + 20).toString('hex'));
    }
    return hashes;
}
type Info = {
    name: string,
    "piece length": number,
    pieces: Buffer,
    length: number,
}

type TorrentFile = {
    announce: string,
    info: Info,
}

if (args[2] === "info") {
    try {
        const torrentFilePath: string  = args[3];
        const torrentFileData: Buffer = fs.readFileSync(torrentFilePath);
        const decodedTorrentFile: TorrentFile = bencodec.decode(torrentFileData);
        const fileInfo: Info = decodedTorrentFile.info;
        const encodedInfo: Buffer |string = bencodec.encode(fileInfo);
        const infoHash:string = createHash('sha1').update(encodedInfo).digest('hex');
        const pieceHashes: string[] = extractPieceHashes(fileInfo.pieces);

        console.log(`Tracker URl: ${decodedTorrentFile.announce}`);
        console.log(`Length:`,fileInfo.length);
        console.log(`Info Hash: ${infoHash}`);
        console.log("Piece Length:",fileInfo["piece length"]);
        console.log("Piece Hashes:");
        pieceHashes.forEach((hash, index) => {
            console.log(index + 1,":",hash);
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}