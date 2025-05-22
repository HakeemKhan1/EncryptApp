import React, { useState, useEffect, useCallback } from 'react';
import AuthService from '../services/AuthService';
import CryptoService from '../services/CryptoService';
import { jwtDecode } from 'jwt-decode'; // Corrected import

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [recipient, setRecipient] = useState('');
    const [currentUser, setCurrentUser] = useState(undefined);
    const [privateKey, setPrivateKey] = useState(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const fetchCurrentUser = useCallback(() => {
        const userToken = AuthService.getCurrentUser();
        if (userToken && userToken.access_token) {
            try {
                const decodedToken = jwtDecode(userToken.access_token); // Use jwtDecode
                setCurrentUser({ username: decodedToken.sub, ...userToken });

                // Attempt to load private key
                const storedPrivateKeyPem = localStorage.getItem(`privateKey_${decodedToken.sub}`);
                if (storedPrivateKeyPem) {
                    CryptoService.importPrivateKeyFromPem(storedPrivateKeyPem)
                        .then(key => setPrivateKey(key))
                        .catch(err => {
                            console.error("Failed to load private key:", err);
                            setError("Could not load your private key. You may not be able to decrypt messages.");
                        });
                } else {
                    setError("Private key not found. Please ensure you registered correctly or re-upload your key if functionality allows.");
                }
            } catch (e) {
                console.error("Error decoding token:", e);
                AuthService.logout(); // Log out if token is invalid
                setCurrentUser(undefined);
                setError("Invalid session. Please log in again.");
            }
        } else {
            setCurrentUser(undefined); // No user logged in
        }
    }, []);

    const fetchMessages = useCallback(async () => {
        if (!currentUser || !privateKey) {
            // Don't fetch if user or private key isn't ready
            if (currentUser && !privateKey && !error.includes("Private key not found")) {
                 // Only set error if it's not already about missing key
                setError("Private key not available for decryption.");
            }
            return;
        }
        try {
            setError('');
            const response = await AuthService.getMessages();
            const decryptedMessages = await Promise.all(
                response.data.map(async (msg) => {
                    try {
                        const decryptedContent = await CryptoService.decryptMessage(privateKey, msg.encrypted_content);
                        return { ...msg, decrypted_content: decryptedContent, isEncrypted: false };
                    } catch (decryptionError) {
                        console.error(`Failed to decrypt message ID ${msg.id}:`, decryptionError);
                        return { ...msg, decrypted_content: "[Could not decrypt message]", isEncrypted: true };
                    }
                })
            );

            // Merge server messages with local optimistic messages sent to others
            setMessages(prevLocalMessages => {
                const serverMessageIds = new Set(decryptedMessages.map(msg => msg.id));
                
                // Filter optimistic messages: sent by current user to someone else, and not already in server response
                const optimisticSentToOthers = prevLocalMessages.filter(localMsg =>
                    localMsg.sender_username === currentUser.username &&
                    localMsg.recipient_username !== currentUser.username && // Ensure it was sent to another user
                    !serverMessageIds.has(localMsg.id) && // Not already covered by server response
                    localMsg.id.toString().startsWith('temp-') // A way to identify optimistic messages if needed, or rely on sender/recipient
                );

                // Combine server messages and the filtered optimistic messages
                const combinedMessages = [...decryptedMessages, ...optimisticSentToOthers];

                // Sort by timestamp to maintain order
                combinedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                return combinedMessages;
            });

        } catch (err) {
            console.error("Failed to fetch messages:", err);
            setError('Failed to fetch messages. ' + (err.response?.data?.detail || err.message));
        }
    }, [currentUser, privateKey, error]); // Added error to dependency array

    useEffect(() => {
        fetchCurrentUser();
    }, [fetchCurrentUser]);

    useEffect(() => {
        if (currentUser && privateKey) {
            fetchMessages();
        }
    }, [currentUser, privateKey, fetchMessages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!recipient || !newMessage) {
            setError("Recipient and message cannot be empty.");
            return;
        }
        if (!currentUser) {
            setError("You must be logged in to send messages.");
            return;
        }
        setError('');
        setSuccessMessage('');

        try {
            const recipientPublicKeyResponse = await AuthService.getUserPublicKey(recipient);
            const recipientPublicKeyPem = recipientPublicKeyResponse.data;
            const recipientPublicKey = await CryptoService.importPublicKeyFromPem(recipientPublicKeyPem);
            
            const encryptedMessage = await CryptoService.encryptMessage(recipientPublicKey, newMessage);
            
            // Store the original message text before clearing
            const originalMessageText = newMessage;
            
            const sentMessageResponse = await AuthService.sendMessage(recipient, encryptedMessage);
            
            // Optimistically add the message to the UI
            // Assuming sentMessageResponse.data might contain the created message ID or more details
            // For now, we construct it mostly client-side.
            // A more robust solution would use an ID returned by the server.
            const optimisticMessage = {
                id: sentMessageResponse.data?.id || `temp-${Date.now()}`, // Use server ID if available, else temporary
                sender_username: currentUser.username,
                recipient_username: recipient, // Good to have for context, though not directly used in current rendering
                decrypted_content: originalMessageText, // Show the original text to the sender
                encrypted_content: encryptedMessage, // Store for completeness
                timestamp: new Date().toISOString(),
                isEncrypted: false, // Sender sees their own message decrypted
            };

            setMessages(prevMessages => [...prevMessages, optimisticMessage]);
            
            setNewMessage('');
            // setRecipient(''); // Optionally clear recipient
            setSuccessMessage(`Message sent to ${recipient}!`);
            
            // Fetch messages to get the latest state from the server,
            // which will include the message we just sent (with its server-assigned ID).
            // The list reconciliation should handle duplicates if keys are managed well,
            // or if the temporary ID is replaced by the server ID.
            fetchMessages(); 

        } catch (err) {
            console.error("Failed to send message:", err);
            setError('Failed to send message. ' + (err.response?.data?.detail || err.message));
        }
    };
    
    if (!currentUser) {
        return <div className="container mt-3"><p>Please <a href="/login">login</a> to view the chat.</p></div>;
    }

    // Determine if a message is sent by the current user
    const isSentByCurrentUser = (senderUsername) => {
        return senderUsername === currentUser.username;
    };

    return (
        <div className="chat-container"> {/* Apply the main chat container style */}
            <div className="chat-header">
                <h4>{currentUser.username}</h4>
                <p>Chat with your friends securely!</p>
                <p style={{ fontSize: '0.8em', color: '#aaa' }}>Logged in as: {currentUser.username}</p>
            </div>
            
            {error && <div className="alert alert-danger m-2">{error}</div>}
            {successMessage && <div className="alert alert-success m-2">{successMessage}</div>}

            <div className="messages-list">
                {messages.length > 0 ? messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`message-item ${isSentByCurrentUser(msg.sender_username) ? 'sent' : 'received'}`}
                    >
                        {/* Username can be shown above the bubble if desired, or removed for iMessage look */}
                        {/* {!isSentByCurrentUser(msg.sender_username) && <strong>{msg.sender_username}</strong>} */}
                        <div className="message-content" style={{ color: msg.isEncrypted ? 'red' : 'inherit' }}>
                            {msg.decrypted_content || msg.encrypted_content}
                        </div>
                        <small className="message-timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                    </div>
                )) : <div className="text-center p-3">No messages yet. Start a conversation!</div>}
            </div>

            <form onSubmit={handleSendMessage} className="message-form">
                 {/* Recipient input can be part of the form or managed elsewhere (e.g., selecting a chat) */}
                 <div className="form-group" style={{display: 'flex', flexDirection: 'column', marginRight: '10px', flexBasis: '200px' /* Fixed or percentage width */}}>
                    <label htmlFor="recipient" style={{fontSize: '0.8em', color: '#aaa', marginBottom: '3px', marginLeft: '5px'}}>To:</label>
                    <input
                        type="text"
                        className="form-control" // This class might need adjustment in App.css if it conflicts
                        id="recipient"
                        placeholder="Recipient username"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        required
                        style={{borderRadius: '8px', padding: '8px 12px', border: '1px solid #444', backgroundColor: '#2c2c2e', color: '#f1f1f1', fontSize: '14px'}}
                    />
                </div>
                <textarea
                    id="newMessage"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    required
                ></textarea>
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;
