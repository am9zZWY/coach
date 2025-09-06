import os
import openai
import json
import httpx
from jsonschema import validate, ValidationError
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

# --- Security Setup ---
# In production, these should be loaded from environment variables.
# For development, we can use defaults but print a warning.

SECRET_KEY = os.getenv("SECRET_KEY", "a_default_secret_key_for_development")
if SECRET_KEY == "a_default_secret_key_for_development":
    print("WARNING: Using default SECRET_KEY. Please set a secure SECRET_KEY in your environment for production.")

ENCRYPTION_KEY_STR = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY_STR:
    # In a real production environment, this should probably fail hard if not set.
    # For ease of development, we generate one, but it means encrypted data is lost on restart.
    print("WARNING: ENCRYPTION_KEY not found in environment. Generating a new one.")
    ENCRYPTION_KEY = Fernet.generate_key()
else:
    ENCRYPTION_KEY = ENCRYPTION_KEY_STR.encode()

fernet = Fernet(ENCRYPTION_KEY)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database setup
# The database file will be located in the /app/data directory inside the container.
# This directory is mounted as a volume in docker-compose.yml to persist data.
DATABASE_URL = "sqlite:////app/data/test.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, Sequence('user_id_seq'), primary_key=True)
    username = Column(String(50), unique=True, index=True)
    hashed_password = Column(String(128))
    is_active = Column(Boolean, default=True)
    openai_api_key = Column(String(512), nullable=True)  # Encrypted OpenAI API key
    weather_api_key = Column(String(512), nullable=True) # Encrypted Weather API key
    weather_location = Column(String(255), nullable=True)


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
    email_address: str
    imap_server: str
    imap_port: int
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool

    class Config:
        from_attributes = True


class MailAccountResponse(BaseModel):
    id: int
    email_address: str
    imap_server: str
    imap_port: int

    class Config:
        from_attributes = True


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
            email_address=cred.email_address,
            imap_server=cred.imap_server,
            imap_port=cred.imap_port,
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
        email_address=credentials.email_address,
        imap_server=credentials.imap_server,
        imap_port=credentials.imap_port,
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
    # Manually map to response model to avoid leaking any extra fields if the model changes
    return [
        MailAccountResponse(
            id=acc.id,
            email_address=acc.email_address,
            imap_server=acc.imap_server,
            imap_port=acc.imap_port,
        ) for acc in accounts
    ]


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


class OpenAIApiKeyUpdate(BaseModel):
    api_key: str


class WeatherSettings(BaseModel):
    api_key: str
    location: str

@app.put("/users/me/weather_settings")
async def update_weather_settings(
    weather_data: WeatherSettings,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user's weather API key and location."""
    user_to_update = db.query(User).filter(User.id == current_user.id).first()
    if user_to_update:
        if weather_data.api_key:
            encrypted_key = fernet.encrypt(weather_data.api_key.encode()).decode()
            user_to_update.weather_api_key = encrypted_key
        if weather_data.location:
            user_to_update.weather_location = weather_data.location
        db.add(user_to_update)
        db.commit()
        return {"message": "Weather settings updated successfully."}
    else:
        raise HTTPException(status_code=404, detail="User not found")

class WeatherSettingsResponse(BaseModel):
    location: str | None

@app.get("/users/me/weather_settings", response_model=WeatherSettingsResponse)
async def get_weather_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's weather location."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if user:
        return {"location": user.weather_location}
    else:
        raise HTTPException(status_code=404, detail="User not found")


@app.get("/weather")
async def get_weather(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Fetch weather data from WeatherAPI for the user's location."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user or not user.weather_api_key or not user.weather_location:
        raise HTTPException(status_code=400, detail="Weather API key or location not set for user.")

    try:
        decrypted_api_key = fernet.decrypt(user.weather_api_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Failed to decrypt Weather API key.")

    weather_api_url = f"https://api.weatherapi.com/v1/current.json?key={decrypted_api_key}&q={user.weather_location}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(weather_api_url)
            response.raise_for_status()  # Raise an exception for bad status codes
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Error from WeatherAPI: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Failed to connect to WeatherAPI: {str(e)}")


@app.put("/users/me/openai_api_key")
async def update_openai_api_key(
    api_key_data: OpenAIApiKeyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user's OpenAI API key."""
    if not api_key_data.api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    encrypted_key = fernet.encrypt(api_key_data.api_key.encode()).decode()
    # It's better to fetch the user object from the session and update it.
    user_to_update = db.query(User).filter(User.id == current_user.id).first()
    if user_to_update:
        user_to_update.openai_api_key = encrypted_key
        db.add(user_to_update)
        db.commit()
        return {"message": "OpenAI API key updated successfully."}
    else:
        raise HTTPException(status_code=404, detail="User not found")


class AssistantRunRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    json_schema: dict = None


@app.post("/assistant/run")
async def assistant_run(
    request: AssistantRunRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Run the assistant by making a call to OpenAI."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user or not user.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not set for user.")

    try:
        decrypted_api_key = fernet.decrypt(user.openai_api_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Failed to decrypt API key. Check ENCRYPTION_KEY.")

    try:
        client = openai.OpenAI(api_key=decrypted_api_key)

        messages = [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_prompt},
        ]

        extra_params = {}
        if request.json_schema:
            extra_params["response_format"] = {"type": "json_object"}
            # Add a message to the prompt to ask for JSON conforming to the schema
            messages[0]["content"] += f"\\n\\nPlease provide your response in a JSON format that conforms to the following schema: {json.dumps(request.json_schema)}"

        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=messages,
            **extra_params
        )

        response_content = response.choices[0].message.content
        if request.json_schema:
            try:
                json_response = json.loads(response_content)
                validate(instance=json_response, schema=request.json_schema)
                return json_response
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="OpenAI did not return valid JSON.")
            except ValidationError as e:
                raise HTTPException(status_code=500, detail=f"OpenAI response did not match schema: {e.message}")
        else:
            return {"response": response_content}

    except openai.APIConnectionError as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API connection error: {e}")
    except openai.RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"OpenAI API rate limit exceeded: {e}")
    except openai.APIStatusError as e:
        raise HTTPException(status_code=e.status_code, detail=f"OpenAI API status error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


class AssistantRunWithToolsRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    tools: list


@app.post("/assistant/run_with_tools")
async def assistant_run_with_tools(
    request: AssistantRunWithToolsRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Run the assistant with tools by making a call to OpenAI."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user or not user.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not set for user.")

    try:
        decrypted_api_key = fernet.decrypt(user.openai_api_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Failed to decrypt API key. Check ENCRYPTION_KEY.")

    try:
        client = openai.OpenAI(api_key=decrypted_api_key)

        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            tools=request.tools,
            tool_choice="auto",
        )

        return response.choices[0].message

    except openai.APIConnectionError as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API connection error: {e}")
    except openai.RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"OpenAI API rate limit exceeded: {e}")
    except openai.APIStatusError as e:
        raise HTTPException(status_code=e.status_code, detail=f"OpenAI API status error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
