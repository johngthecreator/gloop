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

    const websockets = this.state.getWebSockets()
    if (websockets.length >= 2) {
      return new Response('Room is full', { status: 409 })
    }

    const pair = new WebSocketPair()
    this.state.acceptWebSocket(pair[1])

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const peers = this.state.getWebSockets()
    for (const peer of peers) {
      if (peer !== ws) {
        peer.send(typeof message === 'string' ? message : message)
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    ws.close()
    const remaining = this.state.getWebSockets()
    for (const peer of remaining) {
      peer.send(JSON.stringify({ type: 'peer-disconnected' }))
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    ws.close()
    const remaining = this.state.getWebSockets()
    for (const peer of remaining) {
      peer.send(JSON.stringify({ type: 'peer-disconnected' }))
    }
  }
}
