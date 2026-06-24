// Busara WebSocket Mini-Service
// Real-time agent progress streaming for analysis runs.
// Port: 3003 (must match the Caddyfile rule)

import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3003;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'busara-websocket', port: PORT }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Busara WebSocket Server');
});

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/',
});

// In-memory store of recent broadcasts per analysisId
const recentUpdates = new Map<string, any[]>();
const subscribers = new Map<string, Set<string>>(); // analysisId -> socket ids

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('subscribe_analysis', ({ analysisId }: { analysisId: string }) => {
    if (!analysisId) return;
    socket.join(`analysis:${analysisId}`);
    if (!subscribers.has(analysisId)) subscribers.set(analysisId, new Set());
    subscribers.get(analysisId)!.add(socket.id);
    console.log(`[WS] ${socket.id} subscribed to ${analysisId}`);

    // Send any buffered updates
    const buffered = recentUpdates.get(analysisId) ?? [];
    socket.emit('subscription_confirmed', { analysisId, bufferedUpdates: buffered });
  });

  socket.on('unsubscribe_analysis', ({ analysisId }: { analysisId: string }) => {
    socket.leave(`analysis:${analysisId}`);
    subscribers.get(analysisId)?.delete(socket.id);
  });

  // Backend services (Next.js API routes) emit through here
  socket.on('agent_update', (update: any) => {
    const { analysisId } = update;
    if (!analysisId) return;
    const list = recentUpdates.get(analysisId) ?? [];
    list.push(update);
    if (list.length > 200) list.shift();
    recentUpdates.set(analysisId, list);
    io.to(`analysis:${analysisId}`).emit('agent_update', update);
  });

  socket.on('chat_message', (msg: any) => {
    // Broadcast chat messages to all subscribers of the analysis
    if (msg.analysisId) {
      io.to(`analysis:${msg.analysisId}`).emit('chat_message', msg);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
    for (const [, set] of subscribers) set.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Busara WebSocket] Listening on port ${PORT}`);
});

// Clean up old buffered updates every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, updates] of recentUpdates) {
    // Keep only updates from the last 30 minutes
    const fresh = updates.filter(u => now - new Date(u.timestamp).getTime() < 30 * 60 * 1000);
    if (fresh.length === 0) recentUpdates.delete(id);
    else recentUpdates.set(id, fresh);
  }
}, 5 * 60 * 1000);
