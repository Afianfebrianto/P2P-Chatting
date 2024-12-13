import { useState, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';

interface Message {
  text: string;
  from: 'me' | 'partner';
  file?: File;
}

type ConnectionStatus = 'disconnected' | 'ready' | 'connected' | 'error';

export default function Home() {
  const [peerId, setPeerId] = useState<string>('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [partnerId, setPartnerId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  

  useEffect(() => {
    let peerInstance: Peer | null = null;
    
    const initPeer = () => {
      setIsConnecting(true);
      setErrorMessage('');
      
      console.log('Initializing PeerJS connection...');
      
      try {
        // Using public PeerJS server instead of local server
        peerInstance = new Peer({
          debug: 3,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        peerInstance.on('open', (id: string) => {
          console.log('Connected to PeerJS server. ID:', id);
          setPeerId(id);
          setConnectionStatus('ready');
          setIsConnecting(false);
        });

        peerInstance.on('connection', (conn: DataConnection) => {
          console.log('Incoming connection from:', conn.peer);
          handleConnection(conn);
        });

        peerInstance.on('error', (error: Error) => {
          console.error('PeerJS error:', error);
          setErrorMessage(`Connection error: ${error.message}`);
          setConnectionStatus('error');
          setIsConnecting(false);
        });

        peerInstance.on('disconnected', () => {
          console.log('Disconnected from PeerJS server');
          setErrorMessage('Disconnected from server. Click "Retry Connection" to reconnect.');
          setConnectionStatus('disconnected');
          setIsConnecting(false);
        });

        setPeer(peerInstance);
      } catch (error) {
        console.error('Error creating Peer instance:', error);
        setErrorMessage(`Failed to initialize connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setConnectionStatus('error');
        setIsConnecting(false);
      }
    };

    initPeer();

    return () => {
      if (peerInstance) {
        peerInstance.destroy();
      }
    };
  }, []);

  const handleConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      console.log('Connection opened with:', conn.peer);
      setConnection(conn);
      setConnectionStatus('connected');
      setPartnerId(conn.peer);
      setErrorMessage('');
    });

    conn.on('data', (data: unknown) => {
      if (typeof data === 'string') {
        setMessages(prev => [...prev, { text: data, from: 'partner' }]);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed');
      setConnectionStatus('disconnected');
      setConnection(null);
      setErrorMessage('Connection closed');
    });

    conn.on('error', (error: Error) => {
      console.error('Connection error:', error);
      setErrorMessage(`Connection error: ${error.message}`);
      setConnectionStatus('error');
    });
  };

  const retryConnection = () => {
    if (peer) {
      peer.destroy();
    }
    window.location.reload();
  };

  const connectToPeer = () => {
    if (!partnerId.trim() || !peer) return;
    
    console.log('Attempting to connect to peer:', partnerId);
    try {
      const conn = peer.connect(partnerId);
      handleConnection(conn);
    } catch (error) {
      console.error('Error connecting to peer:', error);
      setErrorMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !connection) return;

    try {
      connection.send(newMessage);
      setMessages(prev => [...prev, { text: newMessage, from: 'me' }]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-r from-indigo-500 to-blue-500 p-4">
      <div className="max-w-2xl mx-auto bg-gradient-to-r from-blue-800 to-indigo-900 rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4 text-white">Local Network Chat</h1>
          
          {/* Connection Status and Debug Info */}
          <div className="mb-4 p-4 bg-indigo-700 rounded-lg">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-100">Status :</span>
                <span className={`${
                  connectionStatus === 'connected' ? 'text-green-600' :
                  connectionStatus === 'ready' ? 'text-blue-100' :
                  'text-red-600'
                }`}>
                  {isConnecting ? 'Connecting...' : connectionStatus}
                </span>
              </div>
              
              {peerId && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-100">Your ID:</span>
                  <code className="bg-white px-2 py-1 rounded select-all text-black">{peerId}</code>
                </div>
              )}

              {errorMessage && (
                <div className="text-red-600 text-sm mt-2">
                  {errorMessage}
                  {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
                    <button
                      onClick={retryConnection}
                      className="ml-2 text-blue-500 hover:text-blue-700 underline"
                    >
                      Retry Connection
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Connection Form */}
          {connectionStatus !== 'connected' && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                placeholder="Enter partner's ID"
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={connectToPeer}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!peerId || isConnecting}
              >
                Connect
              </button>
            </div>
          )}
        </div>

        {/* Messages Display */}
        <div className="h-96 overflow-y-auto mb-4 p-4 border rounded">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-2 ${
                msg.from === 'me' ? 'text-right' : 'text-left'
              }`}
            >
              <span
                className={`inline-block p-2 rounded ${
                  msg.from === 'me'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {msg.text}
              </span>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded"
            disabled={connectionStatus !== 'connected'}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            disabled={connectionStatus !== 'connected'}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}