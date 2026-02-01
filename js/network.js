// P2P Networking - granular param sync for multi-instrument setup

class MoogNetwork {
  constructor(master) {
    this.master = master;
    this.peer = null;
    this.connections = [];
    this.peers = [];
    this.roomId = null;
    this.myId = null;
    this.isHost = false;
    this.connected = false;
    this.myName = '';
    this.onStatusChange = null;

    // Throttled param batching
    this._pendingParams = {};
    this._paramFlushScheduled = false;

    // Tab tracking
    this.onPeerTabChange = null; // (peerId, tabId) => {}

    // Talkback audio
    this._localStream = null;
    this._mediaConnections = []; // PeerJS media calls
    this._remoteAudios = [];
  }

  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async createRoom(playerName) {
    this.roomId = this._generateRoomCode();
    this.myName = playerName || 'Host';
    this.isHost = true;

    return new Promise((resolve, reject) => {
      const peerId = `moogstudio-${this.roomId}-host`;
      this.peer = new Peer(peerId, { debug: 0 });

      this.peer.on('open', (id) => {
        this.myId = id;
        this.connected = true;
        this._setupMediaHandling();
        this._updateStatus();
        resolve(this.roomId);
      });

      this.peer.on('connection', (conn) => this._handleNewConnection(conn));

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          this.roomId = this._generateRoomCode();
          this.peer.destroy();
          this.createRoom(playerName).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  async joinRoom(roomCode, playerName) {
    this.roomId = roomCode.toUpperCase();
    this.myName = playerName || 'Player';
    this.isHost = false;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(undefined, { debug: 0 });

      this.peer.on('open', (id) => {
        this.myId = id;
        this._setupMediaHandling();
        const hostId = `moogstudio-${this.roomId}-host`;
        const conn = this.peer.connect(hostId, {
          reliable: true,
          metadata: { name: this.myName },
        });

        conn.on('open', () => {
          this.connections.push(conn);
          this.connected = true;
          conn.send({ type: 'join', name: this.myName, peerId: this.myId });
          this._setupConnectionHandlers(conn);
          this._updateStatus();
          resolve(this.roomId);
        });

        conn.on('error', (err) => reject(err));
        setTimeout(() => { if (!this.connected) reject(new Error('Room not found')); }, 10000);
      });

      this.peer.on('error', (err) => reject(err));
    });
  }

  _handleNewConnection(conn) {
    if (this.connections.length >= 2) {
      conn.on('open', () => {
        conn.send({ type: 'error', message: 'Room is full (max 3 players)' });
        setTimeout(() => conn.close(), 1000);
      });
      return;
    }

    conn.on('open', () => {
      this.connections.push(conn);
      this.peers.push(conn.peer);
      this._setupConnectionHandlers(conn);
      this._updateStatus();
    });
  }

  _setupConnectionHandlers(conn) {
    conn.on('data', (data) => this._handleMessage(conn, data));
    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      this.peers = this.peers.filter(p => p !== conn.peer);
      if (this.onPeerTabChange) this.onPeerTabChange(conn.peer, null);
      this._updateStatus();
    });
  }

  _handleMessage(conn, data) {
    switch (data.type) {
      case 'join':
        if (this.isHost) {
          // Send full state
          conn.send({
            type: 'fullSync',
            state: this.master.getFullState(),
          });
          // Notify others
          this._broadcastToAll({ type: 'playerJoined', name: data.name }, conn.peer);
        }
        break;

      case 'fullSync':
        this.master.applyFullState(data.state);
        break;

      case 'paramBatch':
        for (const p of data.params) {
          this.master.applyParam(p.instrument, p.path, p.value);
        }
        // Host forwards to others
        if (this.isHost) {
          this._broadcastToAll(data, data.fromPeer);
        }
        break;

      case 'noteOn':
        this.master.init().then(() => {
          const inst = this.master.instruments[data.instrument];
          if (inst) inst.triggerNote(data.note);
        });
        if (this.isHost) this._broadcastToAll(data, data.fromPeer);
        break;

      case 'noteOff':
        const instOff = this.master.instruments[data.instrument];
        if (instOff) instOff.releaseNote();
        if (this.isHost) this._broadcastToAll(data, data.fromPeer);
        break;

      case 'seqControl':
        const instSeq = this.master.instruments[data.instrument];
        if (instSeq) {
          if (data.action === 'start') instSeq.startSequencer();
          else instSeq.stopSequencer();
        }
        if (this.isHost) this._broadcastToAll(data, data.fromPeer);
        break;

      case 'patchChange':
        if (data.action === 'add') {
          this.master.addCrossPatch(data.sourceInst, data.sourceId, data.destInst, data.destId);
        } else {
          this.master.removeCrossPatch(data.sourceInst, data.sourceId, data.destInst, data.destId);
        }
        if (this.isHost) this._broadcastToAll(data, data.fromPeer);
        break;

      case 'tabChange':
        if (this.onPeerTabChange) {
          this.onPeerTabChange(data.fromPeer, data.tabId);
        }
        if (this.isHost) this._broadcastToAll(data, data.fromPeer);
        break;

      case 'error':
        alert(data.message);
        break;
    }
  }

  // Granular param broadcast with batching
  broadcastParam(instrument, path, value) {
    const key = `${instrument}.${path}`;
    this._pendingParams[key] = { instrument, path, value };

    if (!this._paramFlushScheduled) {
      this._paramFlushScheduled = true;
      setTimeout(() => {
        const batch = Object.values(this._pendingParams);
        this._pendingParams = {};
        this._paramFlushScheduled = false;

        if (batch.length === 0) return;
        const msg = { type: 'paramBatch', params: batch, fromPeer: this.myId };
        for (const conn of this.connections) {
          if (conn.open) conn.send(msg);
        }
      }, 33); // ~30fps
    }
  }

  broadcastNoteOn(instrument, note) {
    const msg = { type: 'noteOn', instrument, note, fromPeer: this.myId };
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
  }

  broadcastNoteOff(instrument) {
    const msg = { type: 'noteOff', instrument, fromPeer: this.myId };
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
  }

  broadcastPatchChange(action, sourceInst, sourceId, destInst, destId) {
    const msg = { type: 'patchChange', action, sourceInst, sourceId, destInst, destId, fromPeer: this.myId };
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
  }

  broadcastTab(tabId) {
    const msg = { type: 'tabChange', tabId, fromPeer: this.myId };
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
  }

  // === Talkback Audio ===

  async startTalkback() {
    if (this._localStream) return; // already active
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Call all connected peers with audio
      for (const conn of this.connections) {
        if (conn.open) {
          const call = this.peer.call(conn.peer, this._localStream);
          this._mediaConnections.push(call);
        }
      }
    } catch (e) {
      console.error('Talkback mic access denied:', e);
      this._localStream = null;
    }
  }

  stopTalkback() {
    if (this._localStream) {
      this._localStream.getTracks().forEach(t => t.stop());
      this._localStream = null;
    }
    for (const mc of this._mediaConnections) {
      mc.close();
    }
    this._mediaConnections = [];
  }

  _setupMediaHandling() {
    if (!this.peer) return;
    this.peer.on('call', (call) => {
      // Answer incoming calls with no stream (receive only)
      call.answer();
      call.on('stream', (remoteStream) => {
        // Play remote audio
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play().catch(() => {});
        this._remoteAudios.push(audio);
      });
      call.on('close', () => {
        // Clean up
      });
    });
  }

  _broadcastToAll(data, excludePeer) {
    for (const conn of this.connections) {
      if (conn.open && conn.peer !== excludePeer) {
        conn.send(data);
      }
    }
  }

  _updateStatus() {
    if (this.onStatusChange) {
      this.onStatusChange({
        connected: this.connected,
        roomId: this.roomId,
        isHost: this.isHost,
        peerCount: this.connections.length,
      });
    }
  }

  destroy() {
    for (const conn of this.connections) conn.close();
    if (this.peer) this.peer.destroy();
  }
}
