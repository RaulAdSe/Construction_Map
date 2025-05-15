from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "API is working"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/v1/test")
def test_endpoint():
    return {"message": "Test endpoint is working"} 