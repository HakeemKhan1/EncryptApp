

# SecureChat+ – End-to-End Encrypted Messaging App

Created by Hakeem Khan  
![SecureChat+](https://github.com/user-attachments/assets/42d12386-5713-40f4-8023-a4ecde37ec84)

SecureChat+ is a full-stack secure messaging platform that enables users to communicate through **end-to-end encrypted messages** using **RSA cryptography**. It uses **React** on the frontend and **FastAPI** (or Flask) on the backend to provide secure messaging, user authentication, and encrypted storage — all wrapped in a clean and intuitive UI.

---

## Table of Contents
1. [Features](#1-features)  
2. [Getting Started](#2-getting-started)  
3. [Future Enhancements](#3-future-enhancements)  
4. [License](#4-license)  

---

## 1. Features

- **User Authentication**  
  - Secure password hashing with `bcrypt`  
  - JWT-based sessions  
- **RSA Encryption**  
  - Each user has their own RSA keypair  
  - Messages encrypted with public key, decrypted with private key  
- **Messaging System**  
  - Send and receive encrypted messages  
  - Time-stamped messages for context  
- **Modern Frontend**  
  - Built with React and styled with TailwindCSS  
  - Components for login, chat, and inbox views  
- **Backend Security**  
  - FastAPI or Flask backend with secure endpoints  
  - Messages stored in encrypted form in the database  

## 2. Getting Started

### 2.1 Prerequisites
- Node.js v16+  
- Python 3.9+  
- pip (Python package manager)  

### 2.2 Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/securechat.git
cd securechat
```

#### 2. Setup the Frontend
```bash
cd frontend
npm install
npm start
```

#### 3. Setup the Backend
```bash
cd ../backend
pip install -r requirements.txt
python main.py
```

#### 4. Visit the App
- Frontend: [http://localhost:3000](http://localhost:3000)  
- Backend: [http://localhost:8000](http://localhost:8000)  

## 3. Future Enhancements

- Add support for file attachments (images, PDFs)  
- Implement 2FA login  
- Deploy with Docker & HTTPS via Nginx  
- Add mobile responsiveness & PWA support  
- Add unit and integration testing  

---

## 4. License

This project is licensed under the [MIT License](LICENSE).

---
