export type Info = {
    name: string,
    "piece length": number,
    pieces: Buffer,
    length: number,
}

export type TorrentFile = {
    announce: string,
    info: Info,
}
export type DecodedResponse = {
    peers: Buffer,
    interval: number,
    complete: number,
    incomplete: number,
}