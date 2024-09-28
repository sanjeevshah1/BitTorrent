import * as fs from 'node:fs';
import * as net from "node:net";
import * as path from 'path';
import bencodec from 'bencodec';
import { createHash } from 'crypto';
import { decodeBencode } from './Bencode/decodeBencode';
import { TorrentFile, Info } from './types';
import { extractPieceHashes, urlEncodeHash, fetchTracker } from './utils';

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

async function handshake(hash: Buffer, peerId: string, portNumber: number) {
    console.log("Starting handshake process...");
    try {
            const handshake = Uint8Array.from([
            19,
            ...(Array.from(Buffer.from("BitTorrent protocol"))),
            ...[0, 0, 0, 0, 0, 0, 0, 0],
            ...Array.from(hash),
            ...(Array.from(Buffer.from(peerId))),
        ]);

        console.log("Handshake payload created:", handshake);

        const socket = new net.Socket();

        socket.setTimeout(10000); // 10 seconds timeout

        socket.connect(portNumber, peerId, () => {
            console.log(`Connected to peer ${peerId}:${portNumber}`);
            socket.write(handshake);
            console.log("Handshake sent");
        });

        socket.on("data", (data) => {
            console.log("Received data from peer:", data);
            if (data.length >= 68) { // Minimum length of a handshake response
                const protocol = data.toString('utf8', 1, 20);
                const receivedInfoHash = data.subarray(28, 48).toString('hex');
                const peerId = data.subarray(48, 68).toString('hex');
                
                console.log("Received protocol:", protocol);
                console.log("Received info hash:", receivedInfoHash);
                console.log("Peer ID:", peerId);      
                if (receivedInfoHash !== hash.toString('hex')) {
                    console.error("Received info hash doesn't match our info hash");
                }else{
                    console.log("Handshake successful");
                }
            } else {
                console.error("Received data is too short for a handshake");
            }
            
            socket.destroy();
        });

        socket.on("error", (error) => {
            console.error("Socket error:", error.message);
        });

        socket.on("close", () => {
            console.log("Connection closed");
        });

        socket.on("timeout", () => {
            console.error("Connection timed out");
            socket.destroy();
        });

    } catch (error) {
        console.error("Error in handshake process:", error);
    }
}

const DEFAULT_CHUNK_SIZE = 2 ** 14;

const MessageTypes = [
  "choke",
  "unchoke",
  "interested",
  "not interested",
  "have",
  "bitfield",
  "request",
  "piece",
  "cancel",
  "handshake",
] as const;

async function downloadFile(hash: Buffer, peerId: string, portNumber: number, outputFilePath: string, pieceIndex: number, pieceLength: number) {
    console.log(`${new Date().toISOString()} - Starting download process for piece ${pieceIndex}...`);

    const socket = new net.Socket();
    socket.setTimeout(120000); // 2 minute timeout

    try {
        await fs.promises.mkdir(path.dirname(outputFilePath), { recursive: true });

        await connectToPeer(socket, peerId, portNumber);
        
        const peerIdBuffer = await sendHandshake(socket, hash);
        console.log(`Handshake successful. Peer ID: ${peerIdBuffer.toString('hex')}`);

        await sendInterested(socket);
        console.log("Sent interested message");

        await waitForUnchoke(socket);
        console.log("Received unchoke message");

        const pieceData = await downloadPiece(socket, pieceIndex, pieceLength);
        console.log(`Downloaded piece ${pieceIndex}, length: ${pieceData.length}`);

        await fs.promises.writeFile(outputFilePath, pieceData);
        console.log(`Piece ${pieceIndex} saved to ${outputFilePath}`);

    } catch (error) {
        console.error(`${new Date().toISOString()} - Error in download process:`, error);
        throw error;
    } finally {
        socket.destroy();
    }
}

function connectToPeer(socket: net.Socket, peerId: string, portNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.connect(portNumber, peerId, () => {
            console.log(`Connected to peer ${peerId}:${portNumber}`);
            resolve();
        });
        socket.on('error', reject);
    });
}

function sendHandshake(socket: net.Socket, hash: Buffer): Promise<Buffer> {
    const handshake = Buffer.concat([
        Buffer.from([19]),
        Buffer.from("BitTorrent protocol"),
        Buffer.alloc(8),
        hash,
        Buffer.from("00112233445566778899"),
    ]);
    socket.write(handshake);
    return waitForMessage(socket, "handshake");
}

function sendInterested(socket: net.Socket): void {
    socket.write(Buffer.from([0, 0, 0, 1, 2]));
}

function waitForUnchoke(socket: net.Socket): Promise<void> {
    return new Promise<void>(async (resolve) => {
        const message = await waitForMessage(socket, "unchoke");
        console.log("Received unchoke message", message);
        resolve();
    });
}

async function downloadPiece(socket: net.Socket, pieceIndex: number, pieceLength: number): Promise<Buffer> {
    let left = pieceLength;
    let offset = 0;
    const pieceBuffer: Buffer[] = [];

    while (left > 0) {
        const length = Math.min(left, DEFAULT_CHUNK_SIZE);
        const piece = await requestPiece(socket, pieceIndex, offset, length);
        const content = piece.subarray(13);
        pieceBuffer.push(content);
        left -= content.length;
        offset += content.length;
    }

    return Buffer.concat(pieceBuffer);
}

function requestPiece(socket: net.Socket, index: number, begin: number, length: number): Promise<Buffer> {
    const request = Buffer.concat([
        Buffer.from([0, 0, 0, 13, 6]),
        uint32ToBuffer(index),
        uint32ToBuffer(begin),
        uint32ToBuffer(length),
    ]);
    socket.write(request);
    return waitForMessage(socket, "piece");
}

function waitForMessage(socket: net.Socket, expectedType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);

        function handleData(data: Buffer) {
            buffer = Buffer.concat([buffer, data]);
            
            while (buffer.length > 0) {
                if (expectedType === "handshake") {
                    if (buffer.length < 68) return;
                    resolve(buffer.subarray(0, 68));
                    buffer = buffer.subarray(68);
                    return;
                }

                if (buffer.length < 4) return;
                const messageLength = buffer.readUInt32BE(0);
                if (buffer.length < messageLength + 4) return;

                const messageId = buffer[4];
                const message = buffer.subarray(0, messageLength + 4);
                buffer = buffer.subarray(messageLength + 4);

                if (MessageTypes[messageId] === expectedType) {
                    resolve(message);
                    return;
                }
            }
        }

        socket.on("data", handleData);
        socket.once("error", reject);
        socket.once("close", () => reject(new Error("Connection closed")));
    });
}

function uint32ToBuffer(num: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(num);
    return buf;
}

async function handleDownloadPieceCommand() {
    const torrentFilePath = args[5];
    const outputFilePath = args[4];
    const pieceIndex = parseInt(args[6], 10);
    if (!fs.existsSync(torrentFilePath)) {
        throw new Error(`Torrent file not found: ${torrentFilePath}`);
    }
    const torrentFileData = await fs.promises.readFile(torrentFilePath);
    const decodedTorrentFile = bencodec.decode(torrentFileData) as { info: any, announce: string };
    const fileInfo = decodedTorrentFile.info;
    const encodedInfo = bencodec.encode(fileInfo);

    const info_hash = createHash('sha1').update(encodedInfo).digest();
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
     const fetchUrl = `${req.trackerUrl}?peer_id=${req.peer_id}&info_hash=${req.info_hash}&port=${req.port}&uploaded=${req.uploaded}&downloaded=${req.downloaded}&left=${req.left}&compact=${req.compact}`
    const peers = await fetchTracker(fetchUrl);

    for (const peer of peers) {
        const [peerId, portStr] = peer.split(":");
        const portNumber = parseInt(portStr, 10);

        try {
            await downloadFile(info_hash, peerId, portNumber, outputFilePath, pieceIndex, fileInfo['piece length']);
            console.log("Download process completed successfully");
            return;
        } catch (error) {
            console.error(`Failed to download from peer ${peerId}:${portNumber}:`, error);
        }
    }

    throw new Error("Failed to download from all available peers");
}



if (args[2] === 'download') {
    handleDownloadPieceCommand().catch(error => {
        console.error("Error during download:", error);
        process.exit(1);
    });
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
