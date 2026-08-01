from fastapi import APIRouter

from app.api.v1 import auth, dealers, products, stocks, orders, dashboard, ws, reports, empty_crates

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(dealers.router)
api_router.include_router(products.router)
api_router.include_router(stocks.router)
api_router.include_router(orders.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(empty_crates.router)
api_router.include_router(ws.router)
