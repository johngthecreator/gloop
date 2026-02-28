export class Room implements DurableObject {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    if (this.state.getWebSockets().length >= 2) {
      return new Response('Room is full', { status: 409 })
    }

    const pair = new WebSocketPair()
    this.state.acceptWebSocket(pair[1])

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  // Called after the WebSocket handshake completes. Assign roles so the
  // clients never race to become host — the server decides.
  webSocketOpen(ws: WebSocket) {
    const peers = this.state.getWebSockets()
    if (peers.length === 1) {
      // First to connect is the host — tell them to wait for a joiner.
      ws.send(JSON.stringify({ type: 'role', role: 'host' }))
    } else {
      // Second client is the joiner. Tell them their role, then wake the host.
      ws.send(JSON.stringify({ type: 'role', role: 'joiner' }))
      for (const peer of peers) {
        if (peer !== ws) {
          peer.send(JSON.stringify({ type: 'peer-connected' }))
        }
      }
    }
  }

  // Pure relay: forward any message from one peer to the other.
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    for (const peer of this.state.getWebSockets()) {
      if (peer !== ws) {
        peer.send(typeof message === 'string' ? message : message)
      }
    }
  }

  // Do NOT call ws.close() here — the socket is already closing when this fires.
  // Filter out the closing socket before notifying the remaining peer.
  webSocketClose(ws: WebSocket) {
    for (const peer of this.state.getWebSockets()) {
      if (peer !== ws) {
        try {
          peer.send(JSON.stringify({ type: 'peer-disconnected' }))
        } catch {
          // Remaining peer may also be closing — ignore.
        }
      }
    }
  }

  webSocketError(ws: WebSocket) {
    for (const peer of this.state.getWebSockets()) {
      if (peer !== ws) {
        try {
          peer.send(JSON.stringify({ type: 'peer-disconnected' }))
        } catch {
          // ignore
        }
      }
    }
  }
}
