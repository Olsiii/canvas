import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import type WebSocket from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

type DocRoom = {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  /** conn → awareness client ids controlled by that connection */
  conns: Map<WebSocket, Set<number>>;
  persistTimer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, DocRoom>();
const roomsLoading = new Map<string, Promise<DocRoom>>();

function send(conn: WebSocket, message: Uint8Array) {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    return;
  }
  try {
    conn.send(message, { binary: true }, (err) => {
      if (err) conn.close();
    });
  } catch {
    conn.close();
  }
}

function toUint8(message: WebSocket.RawData): Uint8Array {
  if (message instanceof ArrayBuffer) return new Uint8Array(message);
  if (ArrayBuffer.isView(message)) {
    return new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  }
  // ws may deliver fragmented frames as Buffer[]
  return new Uint8Array(Buffer.concat(message));
}

async function loadYdoc(docId: string): Promise<Y.Doc> {
  const ydoc = new Y.Doc();
  const row = await db.query.docs.findFirst({ where: eq(schema.docs.id, docId) });
  if (row?.ydocState && row.ydocState.length > 0) {
    Y.applyUpdate(ydoc, new Uint8Array(row.ydocState));
  }
  return ydoc;
}

async function persistYdoc(docId: string, ydoc: Y.Doc) {
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  await db
    .update(schema.docs)
    .set({ ydocState: state, updatedAt: new Date() })
    .where(eq(schema.docs.id, docId));
}

function schedulePersist(docId: string, room: DocRoom) {
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    void persistYdoc(docId, room.ydoc).catch((err) => {
      console.error(`[docs] failed to persist ${docId}:`, err);
    });
  }, 800);
}

function createRoom(docId: string, ydoc: Y.Doc): DocRoom {
  const awareness = new awarenessProtocol.Awareness(ydoc);
  awareness.setLocalState(null);

  const room: DocRoom = {
    ydoc,
    awareness,
    conns: new Map(),
    persistTimer: null,
  };

  ydoc.on("update", (update: Uint8Array) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    for (const conn of room.conns.keys()) send(conn, message);
    schedulePersist(docId, room);
  });

  awareness.on(
    "update",
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      conn: unknown,
    ) => {
      const changed = added.concat(updated, removed);
      if (conn != null) {
        const controlled = room.conns.get(conn as WebSocket);
        if (controlled) {
          for (const id of added) controlled.add(id);
          for (const id of removed) controlled.delete(id);
        }
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
      );
      const message = encoding.toUint8Array(encoder);
      for (const c of room.conns.keys()) send(c, message);
    },
  );

  return room;
}

async function getOrCreateRoom(docId: string): Promise<DocRoom> {
  const existing = rooms.get(docId);
  if (existing) return existing;

  const loading = roomsLoading.get(docId);
  if (loading) return loading;

  const promise = loadYdoc(docId).then((ydoc) => {
    const again = rooms.get(docId);
    if (again) {
      ydoc.destroy();
      return again;
    }
    const room = createRoom(docId, ydoc);
    rooms.set(docId, room);
    roomsLoading.delete(docId);
    return room;
  });
  roomsLoading.set(docId, promise);
  return promise;
}

function handleMessage(docId: string, room: DocRoom, conn: WebSocket, message: WebSocket.RawData) {
  try {
    const data = toUint8(message);
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync: {
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, conn);
        if (encoding.length(encoder) > 1) send(conn, encoding.toUint8Array(encoder));
        break;
      }
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
        break;
      }
      case messageQueryAwareness: {
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            room.awareness,
            Array.from(room.awareness.getStates().keys()),
          ),
        );
        send(conn, encoding.toUint8Array(encoder));
        break;
      }
    }
  } catch (err) {
    console.error(`[docs] bad WS message for ${docId}:`, err);
  }
}

export async function attachDocConnection(docId: string, conn: WebSocket) {
  conn.binaryType = "arraybuffer";

  // Buffer early frames while the room loads so we don't drop the client's
  // SyncStep1 that can arrive before the async DB read finishes.
  const pending: WebSocket.RawData[] = [];
  const early = (message: WebSocket.RawData) => {
    pending.push(message);
  };
  conn.on("message", early);

  const room = await getOrCreateRoom(docId);
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    conn.off("message", early);
    return;
  }

  room.conns.set(conn, new Set());
  conn.off("message", early);

  const onMessage = (message: WebSocket.RawData) => handleMessage(docId, room, conn, message);
  conn.on("message", onMessage);
  for (const message of pending) onMessage(message);

  const cleanup = () => {
    const controlled = room.conns.get(conn);
    room.conns.delete(conn);
    if (controlled && controlled.size > 0) {
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(controlled), null);
    }
    if (room.conns.size === 0) {
      // Grace period so React Strict Mode remounts can rejoin the same room.
      if (room.persistTimer) clearTimeout(room.persistTimer);
      room.persistTimer = setTimeout(() => {
        if (room.conns.size > 0) return;
        void persistYdoc(docId, room.ydoc)
          .catch((err) => console.error(`[docs] persist on close ${docId}:`, err))
          .finally(() => {
            if (room.conns.size === 0 && rooms.get(docId) === room) {
              room.ydoc.destroy();
              room.awareness.destroy();
              rooms.delete(docId);
            }
          });
      }, 2000);
    }
  };

  conn.on("close", cleanup);

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.ydoc);
    send(conn, encoding.toUint8Array(encoder));
  }

  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(awarenessStates.keys())),
    );
    send(conn, encoding.toUint8Array(encoder));
  }
}
