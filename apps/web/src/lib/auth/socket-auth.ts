import { Socket } from "socket.io-client";
import { tryRefresh } from "./refresh";

/**
 * Attaches a listener to the socket's 'error' event. When the server rejects
 * the connection as Unauthorized, it refreshes the access token and reconnects
 * the socket so the next handshake uses the new cookie.
 */
export function attachSocketAuthRefresh(socket: Socket): () => void {
  let closed = false;

  const onError = (err: { message?: string }) => {
    if (err?.message === "Unauthorized") {
      tryRefresh()
        .then((ok) => {
          if (closed) return;
          if (ok) {
            socket.connect();
            return;
          }
          if (!ok && typeof window !== "undefined") {
            window.location.href = "/auth/login";
          }
        })
        .catch(() => {});
    }
  };

  socket.on("error", onError);

  return () => {
    closed = true;
    socket.off("error", onError);
  };
}
