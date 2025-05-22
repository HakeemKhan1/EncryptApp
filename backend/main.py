from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import datetime
import jwt # PyJWT
from passlib.context import CryptContext # passlib
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend

# Configuration
SECRET_KEY = "your-secret-key"  # CHANGE THIS!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# In-memory "database" for simplicity. Replace with a real database in production.
fake_users_db = {} 
fake_messages_db = [] 

# --- Models ---
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None

class UserCreate(UserBase):
    password: str
    public_key: str # User's RSA public key in PEM format

class UserInDB(UserBase):
    hashed_password: str
    public_key: str

class User(UserBase):
    pass # For returning user info without password

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class MessageCreate(BaseModel):
    recipient_username: str
    encrypted_content: str # Message content encrypted with recipient's public key

class Message(BaseModel):
    id: int
    sender_username: str
    recipient_username: str
    encrypted_content: str
    timestamp: datetime.datetime

app = FastAPI()

# CORS Middleware
# Origins that are allowed to make cross-origin requests.
# For development, you might use ["http://localhost:3000"] if your React app runs on port 3000.
# Using ["*"] is permissive and generally not recommended for production.
origins = [
    "http://localhost",
    "http://localhost:3000", # Assuming React frontend runs on this port
    "http://127.0.0.1:3000",
    # Add other origins as needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# --- Utility Functions ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except jwt.PyJWTError:
        raise credentials_exception
    user = fake_users_db.get(token_data.username)
    if user is None:
        raise credentials_exception
    # Convert UserInDB to dict then to User model
    user_dict = fake_users_db.get(token_data.username)
    if user_dict is None: # Should not happen if get() above worked, but good practice
        raise credentials_exception
    return User(**user_dict)


# --- Routes ---
@app.get("/")
async def root():
    return {"message": "SecureChat API"}

@app.post("/register", response_model=User)
async def register_user(user: UserCreate):
    if user.username in fake_users_db:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    user_in_db = UserInDB(username=user.username, email=user.email, hashed_password=hashed_password, public_key=user.public_key)
    fake_users_db[user.username] = user_in_db.model_dump() # Store as dict
    return User(**user_in_db.model_dump())

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user_dict = fake_users_db.get(form_data.username)
    if not user_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = UserInDB(**user_dict)
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/users/{username}/public_key", response_model=str)
async def get_user_public_key(username: str):
    user_dict = fake_users_db.get(username)
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    public_key = user_dict.get("public_key")
    if not public_key:
        raise HTTPException(status_code=404, detail="Public key not found for user")
    return public_key

# --- Message Routes ---
@app.post("/messages", response_model=Message)
async def send_message(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    recipient_username = message_data.recipient_username
    if recipient_username not in fake_users_db:
        raise HTTPException(status_code=404, detail=f"Recipient user '{recipient_username}' not found")

    # In a real app, you'd load the recipient's public key to verify it,
    # or even re-encrypt if messages were stored differently.
    # Here, we assume the client correctly encrypted with the recipient's public key.

    new_message_id = len(fake_messages_db) + 1
    message = Message(
        id=new_message_id,
        sender_username=current_user.username,
        recipient_username=recipient_username,
        encrypted_content=message_data.encrypted_content,
        timestamp=datetime.datetime.utcnow()
    )
    fake_messages_db.append(message.model_dump()) # Store as dict
    return message

@app.get("/messages", response_model=List[Message])
async def get_messages(current_user: User = Depends(get_current_user)):
    user_messages = [
        Message(**msg) for msg in fake_messages_db 
        if msg["recipient_username"] == current_user.username
    ]
    # In a real app, you might want to add pagination.
    # Also, messages should ideally be decrypted by the client, not exposed raw if sensitive.
    # For this example, we return them as is.
    return user_messages

# It's good practice to allow users to update their public key
@app.put("/users/me/public_key", response_model=User)
async def update_my_public_key(public_key: str, current_user: User = Depends(get_current_user)):
    user_in_db = fake_users_db.get(current_user.username)
    if not user_in_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Update the public key in our "database"
    user_in_db["public_key"] = public_key
    fake_users_db[current_user.username] = user_in_db
    
    return User(**user_in_db)
