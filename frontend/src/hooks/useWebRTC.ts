import { useState, useCallback, useRef, useEffect } from "react";
import type { CoopEvent } from "../types/coop";

export interface UseWebRTCOptions {
  signalingUrl: string;
  roomId: string;
}

export interface UseWebRTCReturn {
  /** DataChannel is open — actual peer-to-peer data is flowing. */
  connected: boolean;
  /** WebSocket open, assigned host role, waiting for the joiner to arrive. */
  hosting: boolean;
  isHost: boolean;
  peerId: string | null;
  sendEvent: (event: CoopEvent) => void;
  onEvent: React.MutableRefObject<((event: CoopEvent) => void) | null>;
  connect: () => void;
  disconnect: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Messages from the signaling server to the client.
type ServerMessage =
  | { type: "role"; role: "host" | "joiner" }
  | { type: "peer-connected" }
  | { type: "peer-disconnected" }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit };

export function useWebRTC({
  signalingUrl,
  roomId,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [connected, setConnected] = useState(false);
  const [hosting, setHosting] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const onEvent = useRef<((event: CoopEvent) => void) | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const activeRef = useRef(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setHosting(false);
    setIsHost(false);
    setPeerId(null);
  }, []);

  const sendSignaling = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.onopen = () => setConnected(true);
    dc.onclose = () => setConnected(false);
    dc.onmessage = (e) => {
      try {
        const event: CoopEvent = JSON.parse(e.data);
        onEvent.current?.(event);
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  const createPeerConnection = useCallback(() => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignaling({ type: "ice-candidate", candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        setConnected(false);
      }
    };
    return pc;
  }, [sendSignaling]);

  // Called when the server tells the host that a joiner has arrived (or re-arrived).
  const startOffer = useCallback(async () => {
    const pc = createPeerConnection();
    const dc = pc.createDataChannel("canvas");
    setupDataChannel(dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (pc.localDescription) {
      sendSignaling({ type: "offer", sdp: pc.localDescription.sdp });
    }
  }, [createPeerConnection, setupDataChannel, sendSignaling]);

  const connect = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    const myPeerId = crypto.randomUUID().slice(0, 8);
    setPeerId(myPeerId);

    const base = signalingUrl.replace(/\/$/, "");
    const wsUrl = base.replace(/^http/, "ws") + "/room/" + roomId;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // NOTE: We do NOT send anything on ws.onopen. The server sends us a role
    // assignment first. Only after receiving "peer-connected" (for the host)
    // or "offer" (for the joiner) do we begin the WebRTC handshake.
    // This prevents both clients from racing to send offers simultaneously.

    ws.onmessage = async (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "role") {
        if (msg.role === "host") {
          setIsHost(true);
          setHosting(true); // visible "waiting for peer" state
        } else {
          setIsHost(false);
          // joiner: just wait — the host will send an offer when peer-connected fires
        }
        return;
      }

      if (msg.type === "peer-connected") {
        // Server told the host their peer arrived. Kick off the WebRTC handshake.
        await startOffer();
        return;
      }

      if (msg.type === "peer-disconnected") {
        // Tear down the WebRTC session but keep the WebSocket open.
        // If we're the host, the server will send peer-connected again if someone rejoins.
        dcRef.current?.close();
        dcRef.current = null;
        pcRef.current?.close();
        pcRef.current = null;
        setConnected(false);
        // Host goes back to "waiting" state; joiner goes back to idle on the WS.
        if (isHost) setHosting(true);
        return;
      }

      if (msg.type === "offer") {
        // We're the joiner — answer the host's offer.
        const pc = createPeerConnection();
        pc.ondatachannel = (ev) => setupDataChannel(ev.channel);
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: msg.sdp }),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          sendSignaling({ type: "answer", sdp: pc.localDescription.sdp });
        }
      } else if (msg.type === "answer") {
        const pc = pcRef.current;
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: msg.sdp }),
          );
        }
      } else if (msg.type === "ice-candidate") {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
      }
    };

    ws.onclose = () => {
      if (activeRef.current) cleanup();
    };
    ws.onerror = () => cleanup();
  }, [
    signalingUrl,
    roomId,
    startOffer,
    createPeerConnection,
    setupDataChannel,
    sendSignaling,
    cleanup,
    isHost,
  ]);

  const disconnect = useCallback(() => cleanup(), [cleanup]);

  const sendEvent = useCallback((event: CoopEvent) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(event));
    }
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { connected, hosting, isHost, peerId, sendEvent, onEvent, connect, disconnect };
}
