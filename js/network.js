// P2P Networking via PeerJS
// Manages room creation, peer connections, and state sync

class MoogNetwork {
  constructor(synth, ui) {
    this.synth = synth;
    this.ui = ui;
    this.peer = null;
    this.connections = [];
    this.peers = [];
    this.roomId = null;
    this.myId = null;
    this.isHost = false;
    this.connected = false;
    this.mySection = -1;
    this.playerSections = {}; // peerId -> section
    this.playerNames = {};    // peerId -> name
    this.myName = '';
    this.onStatusChange = null;
    this.stateThrottle = null;
    this.lastStateSent = 0;
  }

  // Generate a short room code
  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // Create a room (host)
  async createRoom(playerName) {
    this.roomId = this._generateRoomCode();
    this.myName = playerName || 'Player 1';
    this.isHost = true;

    return new Promise((resolve, reject) => {
      // Use room code as peer ID prefix for discoverability
      const peerId = `moogmother-${this.roomId}-host`;

      this.peer = new Peer(peerId, {
        debug: 0,
      });

      this.peer.on('open', (id) => {
        this.myId = id;
        this.connected = true;
        this.mySection = 0; // Host gets oscillator
        this.playerSections[id] = 0;
        this.playerNames[id] = this.myName;

        if (this.ui) {
          this.ui.mySection = 0;
          this.ui.playerNames[0] = this.myName;
        }

        console.log(`Room created: ${this.roomId} (${id})`);
        this._updateStatus();
        resolve(this.roomId);
      });

      this.peer.on('connection', (conn) => {
        this._handleNewConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        if (err.type === 'unavailable-id') {
          // Room code collision, try again
          this.roomId = this._generateRoomCode();
          this.peer.destroy();
          this.createRoom(playerName).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  // Join an existing room
  async joinRoom(roomCode, playerName) {
    this.roomId = roomCode.toUpperCase();
    this.myName = playerName || 'Player';
    this.isHost = false;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(undefined, {
        debug: 0,
      });

      this.peer.on('open', (id) => {
        this.myId = id;
        const hostId = `moogmother-${this.roomId}-host`;

        const conn = this.peer.connect(hostId, {
          reliable: true,
          metadata: { name: this.myName },
        });

        conn.on('open', () => {
          this.connections.push(conn);
          this.connected = true;

          // Send join message
          conn.send({
            type: 'join',
            name: this.myName,
            peerId: this.myId,
          });

          this._setupConnectionHandlers(conn);
          this._updateStatus();
          resolve(this.roomId);
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          reject(err);
        });

        // Timeout
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Could not find room ' + this.roomId));
          }
        }, 10000);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        reject(err);
      });
    });
  }

  _handleNewConnection(conn) {
    if (this.connections.length >= 2) {
      // Room full
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
    conn.on('data', (data) => {
      this._handleMessage(conn, data);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      this.peers = this.peers.filter(p => p !== conn.peer);

      // Free up their section
      const section = this.playerSections[conn.peer];
      if (section !== undefined) {
        delete this.playerSections[conn.peer];
        delete this.playerNames[conn.peer];
        if (this.ui) {
          this.ui.playerNames[section] = '';
        }
      }

      this._updateStatus();

      // Notify other peers
      if (this.isHost) {
        this._broadcastToAll({
          type: 'playerLeft',
          peerId: conn.peer,
        });
      }
    });
  }

  _handleMessage(conn, data) {
    switch (data.type) {
      case 'join':
        this._handleJoin(conn, data);
        break;

      case 'welcome':
        this._handleWelcome(data);
        break;

      case 'stateUpdate':
        this._handleStateUpdate(data);
        break;

      case 'noteOn':
        this.synth.init().then(() => {
          this.synth.triggerNote(data.note);
        });
        // Forward to other peers
        if (this.isHost) {
          this._broadcastToAll(data, conn.peer);
        }
        break;

      case 'noteOff':
        this.synth.releaseNote();
        if (this.isHost) {
          this._broadcastToAll(data, conn.peer);
        }
        break;

      case 'playerLeft':
        if (this.ui && data.section !== undefined) {
          this.ui.playerNames[data.section] = '';
        }
        break;

      case 'error':
        console.error('Room error:', data.message);
        alert(data.message);
        break;
    }
  }

  _handleJoin(conn, data) {
    if (!this.isHost) return;

    // Assign section
    const usedSections = new Set(Object.values(this.playerSections));
    let section = -1;
    for (let i = 0; i < 3; i++) {
      if (!usedSections.has(i)) {
        section = i;
        break;
      }
    }

    if (section === -1) {
      conn.send({ type: 'error', message: 'All sections taken!' });
      return;
    }

    this.playerSections[conn.peer] = section;
    this.playerNames[conn.peer] = data.name || 'Player';

    if (this.ui) {
      this.ui.playerNames[section] = data.name || 'Player';
    }

    // Send welcome with current state and section assignment
    conn.send({
      type: 'welcome',
      section: section,
      state: this.synth.getFullState(),
      players: Object.entries(this.playerSections).map(([id, sec]) => ({
        id, section: sec, name: this.playerNames[id] || 'Player',
      })),
    });

    // Notify other peers
    this._broadcastToAll({
      type: 'playerJoined',
      peerId: conn.peer,
      name: data.name,
      section: section,
    }, conn.peer);

    this._updateStatus();
  }

  _handleWelcome(data) {
    this.mySection = data.section;
    if (this.ui) {
      this.ui.mySection = data.section;
    }

    // Apply full synth state
    this.synth.applyFullState(data.state);
    if (this.ui) {
      this.ui.syncFromState();
    }

    // Update player names
    if (data.players) {
      for (const p of data.players) {
        if (this.ui) {
          this.ui.playerNames[p.section] = p.name;
        }
      }
    }

    this._updateStatus();
  }

  _handleStateUpdate(data) {
    // Apply the state changes
    this.synth.applyFullState(data.state);
    if (this.ui) {
      this.ui.syncFromState();
    }

    // If host, forward to other peers
    if (this.isHost) {
      this._broadcastToAll(data, data.fromPeer);
    }
  }

  broadcastState(state) {
    // Throttle state updates to ~30fps
    const now = Date.now();
    if (now - this.lastStateSent < 33) {
      clearTimeout(this.stateThrottle);
      this.stateThrottle = setTimeout(() => this.broadcastState(state), 33);
      return;
    }
    this.lastStateSent = now;

    const msg = {
      type: 'stateUpdate',
      state: state,
      fromPeer: this.myId,
    };

    for (const conn of this.connections) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  broadcastNoteOn(note) {
    const msg = { type: 'noteOn', note, fromPeer: this.myId };
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
  }

  broadcastNoteOff() {
    const msg = { type: 'noteOff', fromPeer: this.myId };
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
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
        mySection: this.mySection,
        peerCount: this.connections.length,
      });
    }
  }

  destroy() {
    for (const conn of this.connections) {
      conn.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}
