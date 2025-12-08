import { useEffect, useRef } from "react";

type RealtimeTransportOptions = {
  wsUrl: string;
  connectionKey?: string;
  onJsonMessage: (data: any) => void;
  onBinaryMessage: (buffer: ArrayBuffer) => void;
  pushSystem?: (text: string, meta?: string) => void;
  setCallStatus?: (status: "idle" | "calling" | "in_call") => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
  reconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  wsConnectedRef: React.MutableRefObject<boolean>;
  setWsConnected: (value: boolean) => void;
};

export function useRealtimeTransport({
  wsUrl,
  connectionKey,
  onJsonMessage,
  onBinaryMessage,
  pushSystem,
  setCallStatus,
  wsRef,
  reconnectTimeoutRef,
  wsConnectedRef,
  setWsConnected,
}: RealtimeTransportOptions) {
  const onJsonRef = useRef(onJsonMessage);
  const onBinaryRef = useRef(onBinaryMessage);
  const pushSystemRef = useRef(pushSystem);
  const setCallStatusRef = useRef(setCallStatus);

  useEffect(() => {
    onJsonRef.current = onJsonMessage;
  }, [onJsonMessage]);

  useEffect(() => {
    onBinaryRef.current = onBinaryMessage;
  }, [onBinaryMessage]);

  useEffect(() => {
    pushSystemRef.current = pushSystem;
  }, [pushSystem]);

  useEffect(() => {
    setCallStatusRef.current = setCallStatus;
  }, [setCallStatus]);

  useEffect(() => {
    let didUnmount = false;
    const url = connectionKey
      ? `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}session=${encodeURIComponent(connectionKey)}`
      : wsUrl;

    const scheduleReconnect = () => {
      if (didUnmount || reconnectTimeoutRef.current) return;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, 1500);
    };

    const connect = () => {
      if (didUnmount) return;
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        if (didUnmount) return;
        setWsConnected(true);
        pushSystemRef.current?.("Realtime WebSocket connected", "link");
      };

      ws.onclose = () => {
        if (didUnmount) return;
        setWsConnected(false);
        pushSystemRef.current?.("Realtime WebSocket disconnected", "warning");
        setCallStatusRef.current?.("idle");
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        if (didUnmount) return;
        const message =
          err instanceof ErrorEvent
            ? err.message
            : typeof err === "object" && err && "message" in err
            ? (err as any).message
            : "";
        if (wsConnectedRef.current) {
          if (message) {
            console.error("WS error:", message);
            pushSystemRef.current?.(`WebSocket error: ${message}`, "error");
          } else {
            console.warn("WS error (no details)");
          }
        } else {
          console.warn("WS connection failed, will retry…", message || err);
        }
        try {
          ws.close();
        } catch {
          // ignore
        }
      };

      ws.onmessage = async (event) => {
        if (typeof event.data !== "string") {
          try {
            const arrayBuffer =
              event.data instanceof ArrayBuffer
                ? event.data
                : await (event.data as Blob).arrayBuffer();
            onBinaryRef.current(arrayBuffer);
          } catch (err) {
            console.error("Error handling incoming audio chunk:", err);
          }
          return;
        }

        try {
          const data = JSON.parse(event.data);
          onJsonRef.current(data);
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };
    };

    connect();

    return () => {
      didUnmount = true;
      try {
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      } catch {
        // ignore close errors
      }
      setWsConnected(false);
      setCallStatusRef.current?.("idle");
    };
  }, [
    wsUrl,
    connectionKey,
    wsRef,
    reconnectTimeoutRef,
    wsConnectedRef,
    setWsConnected,
  ]);
}
