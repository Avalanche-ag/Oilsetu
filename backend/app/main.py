from fastapi import FastAPI

from .database import engine, Base
from . import models
from .routes.reports import router as reports_router


# Create database tables
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="OilSetu Backend",
    description="SIH 26122 Backend API",
    version="1.0.0"
)


# Register report routes
app.include_router(reports_router)


@app.get("/")
def root():
    return {
        "project": "OilSetu",
        "status": "Backend is running",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }