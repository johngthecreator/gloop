import { useState, useCallback, useRef, useEffect } from "react";
import type { CoopEvent } from "../types/coop";

export interface UseWebRTCOptions {
  signalingUrl: string;
  roomId: string;
}

export interface UseWebRTCReturn {
  connected: boolean;
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

type SignalingMessage =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "peer-disconnected" };

export function useWebRTC({
  signalingUrl,
  roomId,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const onEvent = useRef<((event: CoopEvent) => void) | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const isHostRef = useRef(false);
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
    setIsHost(false);
    setPeerId(null);
  }, []);

  const sendSignaling = useCallback((msg: SignalingMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.onopen = () => {
      setConnected(true);
    };
    dc.onclose = () => {
      setConnected(false);
    };
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
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignaling({
          type: "ice-candidate",
          candidate: e.candidate.toJSON(),
        });
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

  const connect = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    // Generate a stable peer ID for this session
    const myPeerId = crypto.randomUUID().slice(0, 8);
    setPeerId(myPeerId);

    // Build WS URL: convert http(s) to ws(s) and append room path
    const base = signalingUrl.replace(/\/$/, "");
    const wsUrl = base.replace(/^http/, "ws") + "/room/" + roomId;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // First client to connect is the host / offerer
      isHostRef.current = true;
      setIsHost(true);

      const pc = createPeerConnection();

      // Host creates data channel
      const dc = pc.createDataChannel("canvas");
      setupDataChannel(dc);

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            sendSignaling({
              type: "offer",
              sdp: pc.localDescription.sdp,
            });
          }
        });
    };

    ws.onmessage = async (e) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "peer-disconnected") {
        // Remote peer left; tear down the PC but keep the WS alive for reconnection
        dcRef.current?.close();
        dcRef.current = null;
        pcRef.current?.close();
        pcRef.current = null;
        setConnected(false);

        // Re-create offer so a new joiner can connect
        if (activeRef.current) {
          const pc = createPeerConnection();
          const dc = pc.createDataChannel("canvas");
          setupDataChannel(dc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (pc.localDescription) {
            sendSignaling({ type: "offer", sdp: pc.localDescription.sdp });
          }
        }
        return;
      }

      if (msg.type === "offer") {
        // We're the answerer (joiner)
        isHostRef.current = false;
        setIsHost(false);

        // If we already had a PC (e.g., our own offer was out), replace it
        pcRef.current?.close();

        const pc = createPeerConnection();

        // Answerer receives data channel from host
        pc.ondatachannel = (e) => {
          setupDataChannel(e.channel);
        };

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
      if (activeRef.current) {
        // Unexpected close — clean up everything
        cleanup();
      }
    };

    ws.onerror = () => {
      cleanup();
    };
  }, [
    signalingUrl,
    roomId,
    createPeerConnection,
    setupDataChannel,
    sendSignaling,
    cleanup,
  ]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const sendEvent = useCallback((event: CoopEvent) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(event));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { connected, isHost, peerId, sendEvent, onEvent, connect, disconnect };
}
