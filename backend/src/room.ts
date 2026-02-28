// Room Durable Object — implementation handled by backend agent
export class Room implements DurableObject {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Not implemented', { status: 501 })
  }
}
