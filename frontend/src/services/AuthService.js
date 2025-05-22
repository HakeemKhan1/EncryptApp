import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'; // Backend API URL

const register = (username, email, password, publicKey) => {
    return axios.post(`${API_URL}/register`, {
        username,
        email,
        password,
        public_key: publicKey,
    });
};

const login = async (username, password) => {
    const response = await axios.post(`${API_URL}/token`, 
        new URLSearchParams({ // FastAPI's OAuth2PasswordRequestForm expects form data
            username: username,
            password: password
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );
    if (response.data.access_token) {
        localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
};

const logout = () => {
    localStorage.removeItem('user');
};

const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
};

const getAuthHeader = () => {
    const user = getCurrentUser();
    if (user && user.access_token) {
        return { Authorization: `Bearer ${user.access_token}` };
    } else {
        return {};
    }
};

const getUserPublicKey = (username) => {
    return axios.get(`${API_URL}/users/${username}/public_key`, { headers: getAuthHeader() });
};

const sendMessage = (recipientUsername, encryptedContent) => {
    return axios.post(`${API_URL}/messages`, 
        { recipient_username: recipientUsername, encrypted_content: encryptedContent },
        { headers: getAuthHeader() }
    );
};

const getMessages = () => {
    return axios.get(`${API_URL}/messages`, { headers: getAuthHeader() });
};

const updatePublicKey = (publicKey) => {
    return axios.put(`${API_URL}/users/me/public_key?public_key=${encodeURIComponent(publicKey)}`, {}, { headers: getAuthHeader() });
};


const AuthService = {
    register,
    login,
    logout,
    getCurrentUser,
    getAuthHeader,
    getUserPublicKey,
    sendMessage,
    getMessages,
    updatePublicKey,
};

export default AuthService;
