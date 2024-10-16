import * as fs from 'node:fs';
import bencodec from 'bencodec';
import { createHash } from 'crypto';
import { decodeBencode } from './Bencode/decodeBencode';
import { TorrentFile, Info } from './types';
import { extractPieceHashes,
        urlEncodeHash,
        fetchTracker,
        handshake,
        handleDownloadPieceCommand,  
    } from './utils';

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

if (args[2] === "peers") {
    try {
        const torrentFilePath: string  = args[3];
        const torrentFileData: Buffer = fs.readFileSync(torrentFilePath);
        const decodedTorrentFile: TorrentFile = bencodec.decode(torrentFileData);
        const fileInfo: Info = decodedTorrentFile.info;
        const encodedInfo: Buffer |string = bencodec.encode(fileInfo);
 
        const info_hash:Buffer = createHash('sha1').update(encodedInfo).digest();
        const req = {
            trackerUrl:  decodedTorrentFile.announce,
            info_hash: urlEncodeHash(info_hash),
            peer_id: "00112233445566778899",
            port: 6881,
            uploaded: 0,
            downloaded: 0,
            left: fileInfo.length,
            compact: 1,
        };
        console.log("The Info Hash is: ",info_hash);
        const fetchUrl = `${req.trackerUrl}?peer_id=${req.peer_id}&info_hash=${req.info_hash}&port=${req.port}&uploaded=${req.uploaded}&downloaded=${req.downloaded}&left=${req.left}&compact=${req.compact}`
        fetchTracker(fetchUrl).then((response) =>{
            console.log("Peers:", response);
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}



if (args[2] === "handshake"){
    try{
        const torrentFilePath: string  = args[3];
        const peerIdAndPort: string = args[4];
        const [peerId, port] = peerIdAndPort.split(":");
        const portNumber = parseInt(port);
        const torrentFileData: Buffer = fs.readFileSync(torrentFilePath);
        const decodedTorrentFile: TorrentFile = bencodec.decode(torrentFileData);
        const fileInfo: Info = decodedTorrentFile.info;
        const encodedInfo: Buffer |string = bencodec.encode(fileInfo);
        const info_hash_not_hex:Buffer = createHash('sha1').update(encodedInfo).digest();
        handshake(info_hash_not_hex, peerId, portNumber);
    }catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}

if (args[2] === 'download') {
    handleDownloadPieceCommand().catch(error => {
        console.error("Error during download:", error);
        process.exit(1);
    });
}