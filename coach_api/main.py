from datetime import datetime, timedelta, UTC
from typing import Union, List

import jwt
import uvicorn
from cryptography.fernet import Fernet, InvalidToken
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Sequence, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from starlette.middleware.cors import CORSMiddleware

from mail import get_mails

# Database setup
DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Encryption setup for email passwords
# In production, load this from environment variables or a secret manager
# Generate with: Fernet.generate_key()
ENCRYPTION_KEY = Fernet.generate_key()  # Replace with a secure, fixed key (32 bytes base64 urlsafe)
fernet = Fernet(ENCRYPTION_KEY)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, Sequence('user_id_seq'), primary_key=True)
    username = Column(String(50), unique=True, index=True)
    hashed_password = Column(String(128))
    is_active = Column(Boolean, default=True)


class MailAccount(Base):
    __tablename__ = "mail_accounts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    email_address = Column(String(255))
    imap_server = Column(String(255))
    imap_port = Column(Integer)
    password = Column(String(512))  # Encrypted email password


Base.metadata.create_all(bind=engine)

# Password hashing for user accounts
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme definition
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Union[str, None] = None


class UserCreate(BaseModel):
    username: str
    password: str
    mail_accounts: List['MailCredentials'] = []


class MailCredentials(BaseModel):
    email: str
    imap_server: str
    port: int
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool

    class Config:
        from_attributes = True


class MailAccountResponse(BaseModel):
    id: int
    email: str
    imap_server: str
    port: int

    class Config:
        from_attributes = True


SECRET_KEY = "your_secret_key"  # Change this to a secure random key in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise credentials_exception

    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


# FastAPI setup
app = FastAPI()

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = get_user(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        hashed_password=hashed_password,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Add mail accounts if provided
    for cred in user_data.mail_accounts:
        encrypted_pass = fernet.encrypt(cred.password.encode()).decode()
        mail_acc = MailAccount(
            user_id=db_user.id,
            email_address=cred.email,
            imap_server=cred.imap_server,
            imap_port=cred.port,
            password=encrypted_pass
        )
        db.add(mail_acc)
    db.commit()

    return db_user


@app.post("/mail_accounts")
async def add_mail_account(
        credentials: MailCredentials,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Add a new mail account for the user"""
    encrypted_pass = fernet.encrypt(credentials.password.encode()).decode()
    mail_acc = MailAccount(
        user_id=current_user.id,
        email_address=credentials.email,
        imap_server=credentials.imap_server,
        imap_port=credentials.port,
        password=encrypted_pass
    )
    db.add(mail_acc)
    db.commit()
    db.refresh(mail_acc)
    return {"message": "Mail account added successfully", "id": mail_acc.id}


@app.get("/mail_accounts", response_model=List[MailAccountResponse])
async def get_mail_accounts(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Get list of user's mail accounts (without passwords)"""
    accounts = db.query(MailAccount).filter(MailAccount.user_id == current_user.id).all()
    return accounts


@app.get("/mail/{account_id}")
async def read_mails(
        account_id: int,
        only_unread: bool = False,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Fetch emails from a specific mail account"""
    account = db.query(MailAccount).filter(MailAccount.id == account_id, MailAccount.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Mail account not found")
    if not account.password:
        raise HTTPException(status_code=400, detail="No password set for this account")

    try:
        decrypted_pass = fernet.decrypt(account.password.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Invalid encryption token - check key")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")

    return get_mails(
        account.email_address,
        decrypted_pass,
        account.imap_server,
        account.imap_port,
        only_unread=only_unread
    )


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
