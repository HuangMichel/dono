"""Workflow router composition."""

from fastapi import APIRouter

from app.api import bookings, matching_routes, offers, qr_routes, stock_commands

router = APIRouter()
router.include_router(matching_routes.router)
router.include_router(offers.router)
router.include_router(bookings.router)
router.include_router(qr_routes.router)
router.include_router(stock_commands.router)
