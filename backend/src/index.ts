// Signaling server — implementation handled by backend agent
export { Room } from './room'

import { Hono } from 'hono'

export interface Env {
  ROOMS: DurableObjectNamespace
}

const app = new Hono<{ Bindings: Env }>()

// WebSocket signaling endpoint — /room/:roomId
app.get('/room/:roomId', async (c) => {
  const roomId = c.req.param('roomId')
  const id = c.env.ROOMS.idFromName(roomId)
  const stub = c.env.ROOMS.get(id)
  return stub.fetch(c.req.raw)
})

export default app
