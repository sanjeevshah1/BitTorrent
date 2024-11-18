import { DecodedResponse } from "./types";
import bencodec from 'bencodec';
import * as net from "node:net";
export function extractPieceHashes(pieces: Buffer): string[] {
    const hashes: string[] = [];
    for (let i = 0; i < pieces.length; i += 20) {
        hashes.push(pieces.subarray(i, i + 20).toString('hex'));
    }
    return hashes;
}
export const parsePeers = (peers: Buffer): string[] => {
    const peerList: string[] = [];
    
    for (let i = 0; i < peers.length; i += 6) {
        // Extracting 6-byte chunks
        const ipBytes = peers.subarray(i, i + 4); 
        const portBytes = peers.subarray(i + 4, i + 6); 

        // Converting the IP bytes into an IPv4 address
        const ip = Array.from(ipBytes).join('.'); 

        // Converting the port bytes into a port number
        const port = (portBytes[0] << 8) + portBytes[1]; 

        peerList.push(`${ip}:${port}`); // Combining IP and port to form the expected format
    }

    return peerList;
};

export function urlEncodeHash(value: Buffer): string {
    let result = "";
    for (let index = 0; index < value.length; index++) {
      result += `%${value.subarray(index, index + 1).toString("hex")}`;
    }
    return result;
}

export const fetchTracker = async (URL: string) : Promise<string[]> => {
    const response = await fetch(URL);
    const responseBuffer = await response.arrayBuffer();
    const decodedResponse: DecodedResponse = bencodec.decode(Buffer.from(responseBuffer));
    const decodedPeers = decodedResponse.peers;
    const parsedPeers = parsePeers(decodedPeers);
    return parsedPeers;

};

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

  export function sendKeepAlive(socket: net.Socket) {

    const keepAlive = Buffer.alloc(4);
    socket.write(keepAlive);
    // console.log("Sent keep-alive message");
}

export function connectToPeer(
    socket: net.Socket,
    peerId: string,
    portNumber: number
): Promise<void> {

    return new Promise((resolve, reject) => {
        socket.connect(portNumber, peerId, () => {
            // console.log(`Connected to peer ${peerId}:${portNumber}`);
            resolve();
        });
        socket.on('error', reject);
    });
}

export function sendHandshake(socket: net.Socket, hash: Buffer): Promise<Buffer> {

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

export function sendInterested(socket: net.Socket): void {
    socket.write(Buffer.from([0, 0, 0, 1, 2]));
}

export function waitForUnchoke(socket: net.Socket): Promise<void> {

    return new Promise<void>(async (resolve) => {
        const message = await waitForMessage(socket, "unchoke");
        // console.log("Received unchoke message", message);
        resolve();
    });
}

export function uint32ToBuffer(num: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(num);
    return buf;
}

export function waitForMessage(socket: net.Socket, expectedType: string): Promise<Buffer> {

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

