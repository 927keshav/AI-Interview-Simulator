"use client";

function decodeBytes(bytes: ArrayBuffer | Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodePdfBinary(bytes: ArrayBuffer | Uint8Array) {
  return new TextDecoder("latin1", { fatal: false }).decode(bytes);
}

function decodeXmlText(xml: string) {
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .trim();
}

function readPdfBytes(bytes: Uint8Array, start: number, length: number) {
  return bytes.slice(start, start + length);
}

function parseHexValue(value: string) {
  return Number.parseInt(value.replace(/[<>]/g, ""), 16);
}

function codePointToString(value: number) {
  return String.fromCodePoint(value);
}

function parseToUnicodeMap(cmap: string) {
  const map = new Map<number, string>();

  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const match of block[1].matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
      map.set(parseHexValue(match[1]), codePointToString(parseHexValue(match[2])));
    }
  }

  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const match of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g,
    )) {
      const start = parseHexValue(match[1]);
      const end = parseHexValue(match[2]);
      const destinationStart = parseHexValue(match[3]);

      for (let code = start; code <= end; code += 1) {
        map.set(code, codePointToString(destinationStart + code - start));
      }
    }
  }

  return map;
}

async function inflateZlib(bytes: Uint8Array) {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("PDF decompression is not supported in this browser.");
  }

  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([body]).stream().pipeThrough(
    new DecompressionStream("deflate"),
  );
  const buffer = await new Response(stream).arrayBuffer();

  return new Uint8Array(buffer);
}

async function getFontUnicodeMaps(raw: string, bytes: Uint8Array) {
  const toUnicodeByObject = new Map<string, Map<number, string>>();
  const fontToUnicodeObject = new Map<string, string>();
  const fontNameToObject = new Map<string, string>();

  for (const match of raw.matchAll(/(\d+)\s+0\s+obj([\s\S]*?)endobj/g)) {
    const objectId = match[1];
    const objectText = match[2];
    const toUnicodeRef = objectText.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)?.[1];

    if (objectText.includes("/Type /Font") && toUnicodeRef) {
      fontToUnicodeObject.set(objectId, toUnicodeRef);
    }

    const streamMatch = objectText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);

    if (streamMatch) {
      const streamStart = (match.index ?? 0) + match[0].indexOf(streamMatch[1]);
      const streamBytes = readPdfBytes(bytes, streamStart, streamMatch[1].length);
      const streamText = objectText.includes("/FlateDecode")
        ? decodeBytes(await inflateZlib(streamBytes))
        : decodeBytes(streamBytes);

      if (streamText?.includes("begincmap")) {
        toUnicodeByObject.set(objectId, parseToUnicodeMap(streamText));
      }
    }
  }

  for (const match of raw.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
    fontNameToObject.set(match[1], match[2]);
  }

  return { fontNameToObject, fontToUnicodeObject, toUnicodeByObject };
}

function unescapePdfLiteral(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([()\\])/g, "$1");
}

function bytesFromLiteral(value: string) {
  return Uint8Array.from(
    [...unescapePdfLiteral(value)].map((character) => character.charCodeAt(0) & 0xff),
  );
}

function bytesFromHex(value: string) {
  const normalized = value.replace(/\s/g, "");
  const evenHex = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
  const bytes = new Uint8Array(evenHex.length / 2);

  for (let index = 0; index < evenHex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(evenHex.slice(index, index + 2), 16);
  }

  return bytes;
}

function decodePdfTextBytes(bytes: Uint8Array, unicodeMap?: Map<number, string>) {
  if (!unicodeMap) {
    return decodeBytes(bytes);
  }

  let text = "";

  for (let index = 0; index < bytes.length; index += 2) {
    const code =
      index + 1 < bytes.length ? (bytes[index] << 8) | bytes[index + 1] : bytes[index];

    text += unicodeMap.get(code) ?? "";
  }

  return text;
}

async function extractPdfStreams(raw: string, bytes: Uint8Array) {
  const streams: string[] = [];

  for (const match of raw.matchAll(/<<[\s\S]*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const objectText = match[0];
    const streamStart = (match.index ?? 0) + objectText.indexOf(match[1]);
    const streamBytes = readPdfBytes(bytes, streamStart, match[1].length);

    try {
      streams.push(
        objectText.includes("/FlateDecode")
          ? decodeBytes(await inflateZlib(streamBytes))
          : decodeBytes(streamBytes),
      );
    } catch {
      streams.push(decodeBytes(streamBytes));
    }
  }

  return streams;
}

async function extractPdfText(raw: string, bytes: Uint8Array) {
  const { fontNameToObject, fontToUnicodeObject, toUnicodeByObject } =
    await getFontUnicodeMaps(raw, bytes);
  const streams = await extractPdfStreams(raw, bytes);
  const fallbackText = raw
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const textRuns: string[] = [];

  for (const stream of streams) {
    let currentMap: Map<number, string> | undefined;
    const tokenPattern =
      /\/(F\d+)\s+[\d.]+\s+Tf|\(([^()]*(?:\\.[^()]*)*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\[((?:.|\n|\r)*?)\]\s*TJ/g;

    for (const match of stream.matchAll(tokenPattern)) {
      if (match[1]) {
        const fontObject = fontNameToObject.get(match[1]);
        const toUnicodeObject = fontObject
          ? fontToUnicodeObject.get(fontObject)
          : undefined;

        currentMap = toUnicodeObject
          ? toUnicodeByObject.get(toUnicodeObject)
          : undefined;
        continue;
      }

      if (match[2]) {
        textRuns.push(decodePdfTextBytes(bytesFromLiteral(match[2]), currentMap));
        continue;
      }

      if (match[3]) {
        textRuns.push(decodePdfTextBytes(bytesFromHex(match[3]), currentMap));
        continue;
      }

      if (match[4]) {
        const arrayText = [
          ...match[4].matchAll(/\(([^()]*(?:\\.[^()]*)*)\)|<([0-9A-Fa-f\s]+)>/g),
        ]
          .map((arrayMatch) =>
            arrayMatch[1]
              ? decodePdfTextBytes(bytesFromLiteral(arrayMatch[1]), currentMap)
              : decodePdfTextBytes(bytesFromHex(arrayMatch[2]), currentMap),
          )
          .join("");

        textRuns.push(arrayText);
      }
    }
  }

  const extractedText = textRuns
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return extractedText.length > 40 ? extractedText : fallbackText;
}

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function inflateRaw(bytes: Uint8Array) {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("DOCX decompression is not supported in this browser.");
  }

  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([body]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const buffer = await new Response(stream).arrayBuffer();

  return new Uint8Array(buffer);
}

async function extractDocxText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  while (offset < bytes.length - 30) {
    const signature = readUint32(bytes, offset);

    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compressionMethod = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const uncompressedSize = readUint32(bytes, offset + 22);
    const fileNameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const fileName = decodeBytes(bytes.slice(nameStart, nameStart + fileNameLength));
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    if (fileName === "word/document.xml") {
      const fileBytes =
        compressionMethod === 0
          ? compressed
          : compressionMethod === 8
            ? await inflateRaw(compressed)
            : null;

      if (!fileBytes) {
        throw new Error("This DOCX compression format is not supported.");
      }

      return decodeXmlText(decodeBytes(fileBytes));
    }

    offset = dataStart + Math.max(compressedSize, uncompressedSize, 1);
  }

  throw new Error("Could not find resume text in the DOCX file.");
}

export async function extractResumeFileText(file: File) {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    const bytes = new Uint8Array(buffer);
    const text = await extractPdfText(decodePdfBinary(bytes), bytes);

    if (!text) {
      throw new Error("Could not extract readable text from this PDF.");
    }

    return text;
  }

  if (
    type.includes("wordprocessingml") ||
    type.includes("msword") ||
    name.endsWith(".docx")
  ) {
    return extractDocxText(buffer);
  }

  return decodeBytes(buffer);
}
